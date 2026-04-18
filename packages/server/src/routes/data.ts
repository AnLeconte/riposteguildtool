import { Router, type Router as RouterType } from 'express'
import { INSTANCES } from '../data/raids.js'
import { fetchRaidLoot, isBlizzardConfigured } from '../services/loot-data.js'
import { getJournalInstances, getItem, getItemMedia, getClassMedia, getSpecMedia, getMythicKeystoneDungeons, getSpellMedia, getCurrentAffixes, getCharacterMythicPlus } from '../services/blizzard-api.js'
import { getRioCharacter, getRioGuild, getRioGuildTopMembers, getRioMythicPlusDungeons } from '../services/raiderio-api.js'
import { isWclConfigured, getCharacterParses, getGuildRecentReports } from '../services/warcraftlogs-api.js'

// ─── Static WoW class/spec ID mappings (never change) ────────────────────────

const CLASS_IDS: Record<string, number> = {
  warrior: 1, paladin: 2, hunter: 3, rogue: 4, priest: 5,
  death_knight: 6, shaman: 7, mage: 8, warlock: 9, monk: 10,
  druid: 11, demon_hunter: 12, evoker: 13,
}

const SPEC_IDS: Record<string, number> = {
  // Warrior
  arms: 71, fury: 72, protection_warrior: 73,
  // Paladin
  holy_paladin: 65, protection_paladin: 66, retribution: 70,
  // Hunter
  beast_mastery: 253, marksmanship: 254, survival: 255,
  // Rogue
  assassination: 259, outlaw: 260, subtlety: 261,
  // Priest
  discipline: 256, holy_priest: 257, shadow: 258,
  // Death Knight
  blood: 250, frost_dk: 251, unholy: 252,
  // Shaman
  elemental: 262, enhancement: 263, restoration_shaman: 264,
  // Mage
  arcane: 62, fire: 63, frost_mage: 64,
  // Warlock
  affliction: 265, demonology: 266, destruction: 267,
  // Monk
  brewmaster: 268, mistweaver: 270, windwalker: 269,
  // Druid
  balance: 102, feral: 103, guardian: 104, restoration_druid: 105,
  // Demon Hunter
  havoc: 577, vengeance: 581,
  // Evoker
  devastation: 1467, preservation: 1468, augmentation: 1473,
}

/**
 * Resolve spec ID from simc spec name + class name.
 * SimC uses short names like "arms", "frost", "holy", "protection", "restoration".
 * We disambiguate by class context.
 */
function resolveSpecId(spec: string, wowClass: string): number | undefined {
  const s = spec.toLowerCase()
  const c = wowClass.toLowerCase()

  // Direct match first
  if (SPEC_IDS[s] !== undefined) return SPEC_IDS[s]

  // Disambiguate shared names
  if (s === 'protection') {
    if (c === 'warrior') return SPEC_IDS.protection_warrior
    if (c === 'paladin') return SPEC_IDS.protection_paladin
  }
  if (s === 'holy') {
    if (c === 'paladin') return SPEC_IDS.holy_paladin
    if (c === 'priest') return SPEC_IDS.holy_priest
  }
  if (s === 'restoration') {
    if (c === 'shaman') return SPEC_IDS.restoration_shaman
    if (c === 'druid') return SPEC_IDS.restoration_druid
  }
  if (s === 'frost') {
    if (c === 'death_knight') return SPEC_IDS.frost_dk
    if (c === 'mage') return SPEC_IDS.frost_mage
  }

  return undefined
}

export const dataRouter: RouterType = Router()

// Cache static game data responses for 24h in the browser
dataRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600')
  next()
})

/**
 * GET /api/data/raids — list all instances (raids + dungeons).
 * Optional query param: ?type=raid|dungeon to filter by type.
 * Dynamically resolves dungeon_pool from Blizzard M+ Keystone API.
 */
dataRouter.get('/raids', async (req, res) => {
  try {
    const typeFilter = req.query.type as string | undefined
    const region = (req.query.region as string | undefined) ?? 'us'

    // Fetch current M+ dungeon pool from Blizzard to tag dungeons dynamically
    // Note: M+ keystone IDs differ from journal instance IDs, so we match by name
    let mythicPlusNames: Set<string> | null = null
    if (isBlizzardConfigured()) {
      try {
        const mpData = await getMythicKeystoneDungeons(region)
        const names = (mpData.dungeons ?? []).map(
          (d: any) => (d.name as string).toLowerCase(),
        )
        mythicPlusNames = new Set(names)
      } catch {
        // M+ API failed, skip pool tagging
      }
    }

    const instances = INSTANCES
      .filter((i) => !typeFilter || i.type === typeFilter)
      .map((i) => {
        let dungeon_pool = i.dungeon_pool as string | undefined
        // Dynamically resolve pool from Blizzard M+ Keystone API
        // M0 = all dungeons, M+ = only those in the seasonal rotation
        if (i.type === 'dungeon' && mythicPlusNames) {
          const isInMPlus = mythicPlusNames.has(i.name.toLowerCase())
          dungeon_pool = isInMPlus ? 'mythic_plus' : 'mythic_zero'
        } else if (i.type === 'dungeon') {
          // No API data — default all to mythic_plus
          dungeon_pool = 'mythic_plus'
        }
        return {
          id: i.id,
          blizzard_id: i.blizzard_id,
          name: i.name,
          type: i.type,
          dungeon_pool,
          boss_count: i.bosses.length,
        }
      })

    res.json({
      success: true,
      data: instances,
      blizzard_available: isBlizzardConfigured(),
    })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * GET /api/data/raid/:id — full instance with bosses and loot.
 * If the instance has no bosses AND Blizzard API is configured,
 * auto-fetches from Blizzard using its blizzard_id and caches the result.
 */
dataRouter.get('/raid/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const region = (req.query.region as string | undefined) ?? 'us'

    const instance = INSTANCES.find((i) => i.id === id)
    if (!instance) {
      res.status(404).json({ success: false, error: 'Instance not found' })
      return
    }

    // If no static bosses are available, auto-fetch from Blizzard
    if (instance.bosses.length === 0 && isBlizzardConfigured()) {
      try {
        const fetched = await fetchRaidLoot(instance.blizzard_id, region, instance.type)
        // Merge fetched data while preserving our own metadata
        const merged = {
          ...instance,
          ...fetched,
          id: instance.id,
          type: instance.type,
          name: fetched.name || instance.name,
        }
        res.json({ success: true, data: merged, source: 'blizzard' })
        return
      } catch (err) {
        console.error(`[GET /data/raid/${id}] Blizzard fetch failed, returning empty bosses:`, err)
        // Fall through — return the instance as-is with empty bosses
      }
    }

    res.json({ success: true, data: instance, source: 'static' })
  } catch (err) {
    console.error('[GET /data/raid/:id]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch instance data' })
  }
})

/** GET /api/data/blizzard/instances — search Blizzard journal instances (requires API credentials) */
dataRouter.get('/blizzard/instances', async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }
  try {
    const region = (req.query.region as string | undefined) ?? 'us'
    const instances = await getJournalInstances(region)
    res.json({ success: true, data: instances })
  } catch (err) {
    console.error('[GET /data/blizzard/instances]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch instances' })
  }
})

/** GET /api/data/item/:id — get item details (requires Blizzard API credentials) */
dataRouter.get('/item/:id', async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }
  try {
    const itemId = parseInt(req.params.id, 10)
    const region = (req.query.region as string | undefined) ?? 'us'
    const item = await getItem(itemId, region)
    res.json({ success: true, data: item })
  } catch (err) {
    console.error('[GET /data/item/:id]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch item' })
  }
})

/**
 * GET /api/data/items/batch?ids=123,456,789 — batch resolve item name + icon
 * Returns a map of id → { name, icon_url }
 */
dataRouter.get('/items/batch', async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }
  try {
    const idsParam = req.query.ids as string | undefined
    const region = (req.query.region as string | undefined) ?? 'us'
    if (!idsParam) {
      res.status(400).json({ success: false, error: 'ids query param required' })
      return
    }
    const ids = idsParam.split(',').map(Number).filter((n) => !isNaN(n) && n > 0)
    if (ids.length === 0) {
      res.json({ success: true, data: {} })
      return
    }
    // Cap at 50 to avoid abuse
    const capped = ids.slice(0, 50)

    const results: Record<number, { name?: string; icon_url?: string }> = {}
    await Promise.all(capped.map(async (id) => {
      const entry: { name?: string; icon_url?: string } = {}
      try {
        const item = await getItem(id, region)
        if (item?.name) entry.name = item.name as string
      } catch { /* skip */ }
      try {
        const media = await getItemMedia(id, region)
        entry.icon_url = media?.assets?.find((a: any) => a.key === 'icon')?.value
      } catch { /* skip */ }
      results[id] = entry
    }))

    res.json({ success: true, data: results })
  } catch (err) {
    console.error('[GET /data/items/batch]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch items' })
  }
})

/**
 * GET /api/data/class-icon?class=warrior&spec=arms
 * Returns { class_icon_url, spec_icon_url }
 */
dataRouter.get('/class-icon', async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }
  try {
    const wowClass = (req.query.class as string | undefined)?.toLowerCase()
    const spec = (req.query.spec as string | undefined)?.toLowerCase()
    const region = (req.query.region as string | undefined) ?? 'us'

    if (!wowClass) {
      res.status(400).json({ success: false, error: 'class query param required' })
      return
    }

    const result: { class_icon_url?: string; spec_icon_url?: string } = {}

    // Fetch class icon
    const classId = CLASS_IDS[wowClass]
    if (classId) {
      try {
        const media = await getClassMedia(classId, region)
        result.class_icon_url = media?.assets?.find((a: any) => a.key === 'icon')?.value
      } catch { /* skip */ }
    }

    // Fetch spec icon
    if (spec && wowClass) {
      const specId = resolveSpecId(spec, wowClass)
      if (specId) {
        try {
          const media = await getSpecMedia(specId, region)
          result.spec_icon_url = media?.assets?.find((a: any) => a.key === 'icon')?.value
        } catch { /* skip */ }
      }
    }

    res.json({ success: true, data: result })
  } catch (err) {
    console.error('[GET /data/class-icon]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch class/spec icons' })
  }
})

/** GET /api/data/item/:id/media — get item icon URL (requires Blizzard API credentials) */
dataRouter.get('/item/:id/media', async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }
  try {
    const itemId = parseInt(req.params.id, 10)
    const region = (req.query.region as string | undefined) ?? 'us'
    const media = await getItemMedia(itemId, region)
    const icon_url = media?.assets?.find((a: any) => a.key === 'icon')?.value
    res.json({ success: true, data: { icon_url } })
  } catch (err) {
    console.error('[GET /data/item/:id/media]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch item media' })
  }
})

/**
 * GET /api/data/spells/icons?ids=123,456,789
 * Batch resolve spell icon URLs from Blizzard API.
 */
dataRouter.get('/spells/icons', async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }
  try {
    const idsParam = req.query.ids as string | undefined
    const region = (req.query.region as string | undefined) ?? 'us'
    if (!idsParam) {
      res.status(400).json({ success: false, error: 'ids query param required' })
      return
    }
    const ids = idsParam.split(',').map(Number).filter((n) => !isNaN(n) && n > 0)
    if (ids.length === 0) {
      res.json({ success: true, data: {} })
      return
    }

    const results: Record<number, string> = {}
    await Promise.all(ids.slice(0, 100).map(async (id) => {
      try {
        const media = await getSpellMedia(id, region)
        const url = media?.assets?.find((a: any) => a.key === 'icon')?.value
        if (url) results[id] = url
      } catch { /* skip */ }
    }))

    res.json({ success: true, data: results })
  } catch (err) {
    console.error('[GET /data/spells/icons]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch spell icons' })
  }
})

/** GET /api/data/affixes — current M+ affixes this week (via Raider.io) */
dataRouter.get('/affixes', async (_req, res) => {
  try {
    const r = await fetch('https://raider.io/api/v1/mythic-plus/affixes?region=eu&locale=en')
    if (!r.ok) throw new Error(`Raider.io error: ${r.status}`)
    const data = await r.json() as {
      title: string
      affix_details: Array<{ id: number; name: string; description: string; icon: string; icon_url: string; wowhead_url: string }>
    }
    res.json({
      success: true,
      data: {
        title: data.title,
        affixes: data.affix_details.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          iconUrl: a.icon_url,
          wowheadUrl: a.wowhead_url,
        })),
      },
    })
  } catch (err) {
    console.error('[GET /data/affixes]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch affixes' })
  }
})

/** GET /api/data/news — latest WoW news from Wowhead RSS */
dataRouter.get('/news', async (_req, res) => {
  try {
    const r = await fetch('https://www.wowhead.com/news/rss/retail')
    if (!r.ok) throw new Error(`Wowhead RSS error: ${r.status}`)
    const xml = await r.text()

    // Simple XML parsing for RSS items
    const items: Array<{ title: string; link: string; description: string; category: string; date: string; image?: string }> = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
      const item = match[1]
      const get = (tag: string) => {
        const m = item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
        return m?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? ''
      }
      const mediaMatch = item.match(/media:content url="([^"]+)"/)
      items.push({
        title: get('title'),
        link: get('link'),
        description: get('description').replace(/<[^>]*>/g, '').slice(0, 150),
        category: get('category'),
        date: get('pubDate'),
        image: mediaMatch?.[1],
      })
    }

    res.json({ success: true, data: items })
  } catch (err) {
    console.error('[GET /data/news]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch news' })
  }
})

/** GET /api/data/token — WoW Token price */
dataRouter.get('/token', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  next()
}, async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }
  try {
    const region = (req.query.region as string | undefined) ?? 'eu'
    const { blizzardGetDynamic } = await import('../services/blizzard-api.js')
    const data = await blizzardGetDynamic(`/data/wow/token/index`, region)
    res.json({ success: true, data: { price: Math.round(data.price / 10000), raw: data.price } })
  } catch (err) {
    console.error('[GET /data/token]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch token price' })
  }
})

/** GET /api/data/encounter/:id/abilities — boss abilities with icons */
const spellIconCache = new Map<number, string>()

dataRouter.get('/encounter/:id/abilities', async (req, res) => {
  try {
    const encounterId = parseInt(req.params.id, 10)
    if (isNaN(encounterId)) { res.status(400).json({ success: false, error: 'Invalid encounter ID' }); return }
    const region = (req.query.region as string | undefined) ?? 'eu'

    const { getJournalEncounter } = await import('../services/blizzard-api.js')
    const encounter = await getJournalEncounter(encounterId, region)

    // Extract unique spells from sections
    const spells = new Map<number, { id: number; name: string; desc: string }>()
    function walk(sections: any[]) {
      for (const s of sections ?? []) {
        if (s.spell?.id && !spells.has(s.spell.id)) {
          spells.set(s.spell.id, { id: s.spell.id, name: s.spell.name ?? s.title ?? '', desc: (s.body_text ?? '').slice(0, 200) })
        }
        walk(s.sections)
      }
    }
    walk(encounter.sections)

    // Fetch icons from wowhead tooltip API (cached)
    const abilities = await Promise.all([...spells.values()].map(async (sp) => {
      let icon = spellIconCache.get(sp.id)
      if (!icon) {
        try {
          const resp = await fetch(`https://nether.wowhead.com/tooltip/spell/${sp.id}?dataEnv=1&locale=0`)
          if (resp.ok) {
            const data = await resp.json()
            icon = data.icon ?? ''
            spellIconCache.set(sp.id, icon)
          }
        } catch { /* skip */ }
      }
      return {
        id: sp.id,
        name: sp.name,
        description: sp.desc,
        iconUrl: icon ? `https://wow.zamimg.com/images/wow/icons/medium/${icon}.jpg` : undefined,
        iconName: icon,
      }
    }))

    res.json({ success: true, data: { name: encounter.name, abilities } })
  } catch (err) {
    console.error('[GET /data/encounter/:id/abilities]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch encounter abilities' })
  }
})

/** GET /api/data/dashboard — aggregated dashboard data for a character */
dataRouter.get('/dashboard', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  next()
}, async (req, res) => {
  try {
    const realm = req.query.realm as string | undefined
    const name = req.query.name as string | undefined
    const guild = req.query.guild as string | undefined
    const guildRealm = req.query.guildRealm as string | undefined
    const region = (req.query.region as string | undefined) ?? 'eu'

    const result: any = {}

    // Run all independent fetches in parallel
    const promises: Array<Promise<void>> = []

    // Token price
    if (isBlizzardConfigured()) {
      promises.push(
        import('../services/blizzard-api.js')
          .then(({ blizzardGetDynamic: bget }) => bget('/data/wow/token/index', region))
          .then((d) => { result.token = Math.round(d.price / 10000) })
          .catch(() => {}),
      )
    }

    // M+ dungeon pool removed from dashboard — available via /data/mplus/leaderboard

    // Character data (Raider.io + Blizzard + WCL in parallel)
    let resolvedGuild = guild
    let resolvedGuildRealm = guildRealm

    if (realm && name) {
      // Raider.io character
      const rioPromise = getRioCharacter(region, realm, name)
        .then((rio) => {
          result.rioScore = rio.score
          result.rioRankRealm = rio.ranks.realm
          result.rioRankRegion = rio.ranks.region
          result.rioBestRuns = rio.bestRuns?.slice(0, 8) ?? []
          result.rioRecentRuns = rio.recentRuns?.slice(0, 5) ?? []
          if (!resolvedGuild && rio.guild) {
            resolvedGuild = rio.guild
            resolvedGuildRealm = realm
          }
        })
        .catch(() => {})
      promises.push(rioPromise)

      // Blizzard M+ (vault progress)
      if (isBlizzardConfigured()) {
        promises.push(
          getCharacterMythicPlus(realm, name, region)
            .then((mplus) => {
              const runs = mplus.current_period?.best_runs ?? []
              result.weeklyMplusRuns = runs.length
              result.weeklyHighestKey = runs.length > 0 ? Math.max(...runs.map((r: any) => r.keystone_level)) : 0
              result.vaultSlots = runs.length >= 8 ? 3 : runs.length >= 4 ? 2 : runs.length >= 1 ? 1 : 0
            })
            .catch(() => {}),
        )
      }

      // WCL parses
      if (isWclConfigured()) {
        promises.push(
          getCharacterParses(name, realm, region)
            .then((parses) => { result.wclParses = parses })
            .catch(() => {}),
        )
      }

      // Wait for Raider.io to resolve guild name before fetching guild data
      await rioPromise
    }

    // Guild data (parallel)
    if (resolvedGuild && resolvedGuildRealm) {
      promises.push(
        getRioGuild(region, resolvedGuildRealm, resolvedGuild)
          .then((g) => { result.guildName = g.name; result.guildRankings = g.raidRankings })
          .catch(() => {}),
      )
      promises.push(
        getRioGuildTopMembers(region, resolvedGuildRealm, resolvedGuild, 5)
          .then((m) => { result.guildTopMembers = m })
          .catch(() => {}),
      )
      if (isWclConfigured()) {
        promises.push(
          getGuildRecentReports(resolvedGuild, resolvedGuildRealm, region, 3)
            .then((reports) => {
              result.guildReports = reports.map((r: any) => ({
                code: r.code, title: r.title, zone: r.zone?.name,
                owner: r.owner?.name,
                date: r.startTime ? new Date(r.startTime).toISOString() : null,
                url: `https://www.warcraftlogs.com/reports/${r.code}`,
              }))
            })
            .catch(() => {}),
        )
      }
    }

    await Promise.all(promises)

    res.json({ success: true, data: result })
  } catch (err) {
    console.error('[GET /data/dashboard]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' })
  }
})

