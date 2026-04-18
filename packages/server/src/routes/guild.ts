import { Router, type Router as RouterType } from 'express'
import { getGuildRoster, getCharacterMythicPlus, getGuildAchievements } from '../services/blizzard-api.js'
import { getRioGuild } from '../services/raiderio-api.js'
import { isBlizzardConfigured } from '../services/loot-data.js'
import { isWclConfigured, getGuildProgression } from '../services/warcraftlogs-api.js'

export const guildRouter: RouterType = Router()

const CLASS_NAMES: Record<number, string> = {
  1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue', 5: 'Priest',
  6: 'Death Knight', 7: 'Shaman', 8: 'Mage', 9: 'Warlock', 10: 'Monk',
  11: 'Druid', 12: 'Demon Hunter', 13: 'Evoker',
}

const RANK_LABELS: Record<number, string> = {
  0: 'GM', 1: 'Officer', 2: 'Officer', 3: 'Veteran', 4: 'Member',
  5: 'Member', 6: 'Initiate', 7: 'Initiate',
}

/**
 * GET /api/guild/:realm/:name/roster
 * Returns full guild roster with basic character info.
 */
guildRouter.get('/:realm/:name/roster', async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }

  try {
    const realm = req.params.realm.toLowerCase()
    const guild = req.params.name.toLowerCase()
    const region = (req.query.region as string | undefined) ?? 'eu'

    const roster = await getGuildRoster(realm, guild, region)
    const members = (roster.members ?? []) as Array<{
      character: { name: string; id: number; realm: { slug: string; name: string }; level: number; playable_class: { id: number }; playable_race?: { id: number } }
      rank: number
    }>

    // Filter to max-level characters only
    const maxLevel = members.reduce((max, m) => Math.max(max, m.character?.level ?? 0), 0)

    const results = members
      .filter((m) => m.character?.level >= maxLevel)
      .map((m) => ({
        name: m.character.name,
        realm: m.character.realm?.slug,
        realmName: m.character.realm?.name,
        level: m.character.level,
        class: CLASS_NAMES[m.character.playable_class?.id] ?? 'Unknown',
        classId: m.character.playable_class?.id,
        rank: m.rank,
        rankLabel: RANK_LABELS[m.rank] ?? `Rank ${m.rank}`,
      }))

    // Sort by rank then name
    results.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))

    res.json({
      success: true,
      data: {
        guild: roster.guild?.name ?? guild,
        realm,
        region,
        memberCount: results.length,
        members: results,
      },
    })
  } catch (err) {
    console.error('[GET /guild/:realm/:name/roster]', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch guild roster'
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * GET /api/guild/:realm/:name/mythic-plus
 * Returns guild members with their M+ runs this week.
 */
guildRouter.get('/:realm/:name/mythic-plus', async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }

  try {
    const realm = req.params.realm.toLowerCase()
    const guild = req.params.name.toLowerCase()
    const region = (req.query.region as string | undefined) ?? 'eu'
    const maxMembers = parseInt((req.query.limit as string) ?? '50', 10)

    // Fetch guild roster
    const roster = await getGuildRoster(realm, guild, region)
    const members = (roster.members ?? []) as Array<{
      character: { name: string; id: number; realm: { slug: string }; level: number; playable_class: { id: number } }
      rank: number
    }>

    // Filter to max-level characters and limit
    const maxLevel = members.reduce((max, m) => Math.max(max, m.character?.level ?? 0), 0)
    const eligible = members
      .filter((m) => m.character?.level >= maxLevel - 1) // within 1 level of max
      .slice(0, maxMembers)

    // Fetch M+ for each member in parallel (with concurrency limit via blizzardGet)
    const results = await Promise.all(
      eligible.map(async (m) => {
        const char = m.character
        const className = CLASS_NAMES[char.playable_class?.id] ?? 'Unknown'

        try {
          const mplus = await getCharacterMythicPlus(char.realm.slug, char.name, region)
          const bestRuns = (mplus.current_period?.best_runs ?? []).map((run: any) => ({
            dungeon: run.dungeon?.name ?? 'Unknown',
            level: run.keystone_level,
            timed: run.is_completed_within_time ?? false,
            duration: run.duration,
            completedAt: run.completed_timestamp,
            affixes: (run.keystone_affixes ?? []).map((a: any) => a.name),
          }))

          return {
            name: char.name,
            realm: char.realm.slug,
            class: className,
            classId: char.playable_class?.id,
            rank: m.rank,
            level: char.level,
            runs: bestRuns,
            totalRuns: bestRuns.length,
            highestKey: bestRuns.length > 0
              ? Math.max(...bestRuns.map((r: any) => r.level))
              : 0,
          }
        } catch {
          return {
            name: char.name,
            realm: char.realm.slug,
            class: className,
            classId: char.playable_class?.id,
            rank: m.rank,
            level: char.level,
            runs: [],
            totalRuns: 0,
            highestKey: 0,
          }
        }
      }),
    )

    // Sort by highest key descending
    results.sort((a, b) => b.highestKey - a.highestKey || b.totalRuns - a.totalRuns)

    res.json({
      success: true,
      data: {
        guild: roster.guild?.name ?? guild,
        realm: realm,
        region: region,
        memberCount: members.length,
        results,
      },
    })
  } catch (err) {
    console.error('[GET /guild/:realm/:name/mythic-plus]', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch guild M+ data'
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * GET /api/guild/:realm/:name/progression
 * Returns raid progression from WarcraftLogs.
 */
guildRouter.get('/:realm/:name/progression', async (req, res) => {
  if (!isWclConfigured()) {
    res.status(503).json({ success: false, error: 'WarcraftLogs API not configured' })
    return
  }
  try {
    const realm = req.params.realm.toLowerCase()
    const guild = req.params.name
    const region = (req.query.region as string | undefined) ?? 'eu'

    const data = await getGuildProgression(guild, realm, region)
    if (!data) {
      res.status(404).json({ success: false, error: 'Guild not found on WarcraftLogs' })
      return
    }

    const zr = data.zoneRanking ?? {}
    const progress = zr.progress ?? {}

    res.json({
      success: true,
      data: {
        guild: data.name,
        server: data.server?.name,
        region: data.server?.region?.slug,
        ranking: {
          worldRank: progress.worldRank?.number ?? null,
          regionRank: progress.regionRank?.number ?? null,
          serverRank: progress.serverRank?.number ?? null,
        },
      },
    })
  } catch (err) {
    console.error('[GET /guild/:realm/:name/progression]', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch progression'
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * GET /api/guild/:realm/:name/raiderio
 * Returns Raider.io guild data (raid rankings).
 */
guildRouter.get('/:realm/:name/raiderio', async (req, res) => {
  try {
    const realm = req.params.realm.toLowerCase()
    const guild = req.params.name
    const region = (req.query.region as string | undefined) ?? 'eu'

    const data = await getRioGuild(region, realm, guild)
    res.json({ success: true, data })
  } catch (err) {
    console.error('[GET /guild/:realm/:name/raiderio]', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch Raider.io data'
    res.status(500).json({ success: false, error: message })
  }
})
