/**
 * Raider.io API client — free, no auth required.
 */

const BASE_URL = 'https://raider.io/api/v1'

const cache = new Map<string, { data: any; fetchedAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 min — Raider.io data updates frequently

async function rioGet(path: string): Promise<any> {
  const cached = cache.get(path)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data

  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`Raider.io error: ${res.status}`)
  const data = await res.json()
  cache.set(path, { data, fetchedAt: Date.now() })
  return data
}

export async function getRioMythicPlusDungeons(): Promise<Array<{ id: number; name: string; shortName: string; iconUrl?: string }>> {
  const data = await rioGet('/mythic-plus/static-data?expansion_id=11')
  const seasons = data.seasons ?? []
  const currentSeason = seasons[seasons.length - 1]
  return (currentSeason?.dungeons ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    shortName: d.short_name ?? d.name,
    iconUrl: d.icon_url,
  }))
}

/** Returns a map of dungeon name → icon URL for the current M+ season */
let dungeonIconCache: Map<string, string> | null = null
let dungeonIconCacheAt = 0

async function getDungeonIconMap(): Promise<Map<string, string>> {
  if (dungeonIconCache && Date.now() - dungeonIconCacheAt < 24 * 60 * 60 * 1000) return dungeonIconCache
  const dungeons = await getRioMythicPlusDungeons()
  dungeonIconCache = new Map()
  for (const d of dungeons) {
    if (d.iconUrl) {
      dungeonIconCache.set(d.name, d.iconUrl)
      dungeonIconCache.set(d.shortName, d.iconUrl)
    }
  }
  dungeonIconCacheAt = Date.now()
  return dungeonIconCache
}

export interface RioCharacter {
  name: string
  class: string
  spec: string
  realm: string
  region: string
  profileUrl: string
  thumbnailUrl?: string
  score: number
  ranks: { world: number; region: number; realm: number }
  classRanks: { world: number; region: number; realm: number }
  bestRuns: Array<{
    dungeon: string
    iconUrl?: string
    level: number
    timed: boolean
    duration: number
    score: number
    affixes: string[]
    url: string
  }>
  recentRuns: Array<{
    dungeon: string
    iconUrl?: string
    level: number
    timed: boolean
    duration: number
    score: number
    completedAt: string
  }>
  guild?: string
}

export async function getRioCharacter(region: string, realm: string, name: string): Promise<RioCharacter> {
  const data = await rioGet(
    `/characters/profile?region=${region}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=mythic_plus_scores_by_season:current,mythic_plus_best_runs,mythic_plus_recent_runs,mythic_plus_ranks,guild`,
  )

  const season = data.mythic_plus_scores_by_season?.[0]
  const icons = await getDungeonIconMap().catch(() => new Map<string, string>())
  return {
    name: data.name,
    class: data.class,
    spec: data.active_spec_name ?? '',
    realm: data.realm,
    region: data.region,
    profileUrl: data.profile_url ?? '',
    thumbnailUrl: data.thumbnail_url,
    score: season?.scores?.all ?? 0,
    ranks: {
      world: data.mythic_plus_ranks?.overall?.world ?? 0,
      region: data.mythic_plus_ranks?.overall?.region ?? 0,
      realm: data.mythic_plus_ranks?.overall?.realm ?? 0,
    },
    classRanks: {
      world: data.mythic_plus_ranks?.class?.world ?? 0,
      region: data.mythic_plus_ranks?.class?.region ?? 0,
      realm: data.mythic_plus_ranks?.class?.realm ?? 0,
    },
    bestRuns: (data.mythic_plus_best_runs ?? []).map((r: any) => {
      const name = typeof r.dungeon === 'string' ? r.dungeon : (r.dungeon?.short_name ?? r.dungeon?.name ?? 'Unknown')
      return {
        dungeon: name,
        iconUrl: icons.get(name),
        level: r.mythic_level,
        timed: r.num_keystone_upgrades > 0,
        duration: r.clear_time_ms,
        score: r.score,
        affixes: (r.affixes ?? []).map((a: any) => a.name),
        url: r.url ?? '',
      }
    }),
    recentRuns: (data.mythic_plus_recent_runs ?? []).map((r: any) => {
      const name = typeof r.dungeon === 'string' ? r.dungeon : (r.dungeon?.short_name ?? r.dungeon?.name ?? 'Unknown')
      return {
        dungeon: name,
        iconUrl: icons.get(name),
        level: r.mythic_level,
        timed: r.num_keystone_upgrades > 0,
        duration: r.clear_time_ms,
        score: r.score,
        completedAt: r.completed_at ?? '',
      }
    }),
    guild: data.guild?.name,
  }
}

export interface RioGuild {
  name: string
  realm: string
  region: string
  profileUrl: string
  raidRankings: Record<string, { world: number; region: number; realm: number }>
  memberCount: number
}

export interface RioGuildMember {
  name: string
  class: string
  realm: string
  score: number
  profileUrl: string
}

export async function getRioGuildTopMembers(region: string, realm: string, name: string, limit = 5): Promise<RioGuildMember[]> {
  const data = await rioGet(
    `/guilds/profile?region=${region}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=members`,
  )

  const members: RioGuildMember[] = (data.members ?? [])
    .filter((m: any) => m.character?.mythic_plus_scores_by_season?.[0]?.scores?.all > 0)
    .map((m: any) => ({
      name: m.character.name,
      class: m.character.class,
      realm: m.character.realm,
      score: m.character.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0,
      profileUrl: m.character.profile_url ?? '',
    }))
    .sort((a: RioGuildMember, b: RioGuildMember) => b.score - a.score)
    .slice(0, limit)

  return members
}

// ─── M+ Leaderboards ─────────────────────────────────────────────────────────

export interface MplusTopRun {
  rank: number
  score: number
  dungeon: string
  dungeonShort: string
  level: number
  clearTimeMs: number
  keystoneTimeMs: number
  timed: boolean
  completedAt: string
  roster: Array<{ name: string; class: string; spec: string; role: string; realm: string; region: string }>
}

export async function getRioMplusLeaderboard(
  region = 'world',
  dungeon = 'all',
  page = 0,
): Promise<MplusTopRun[]> {
  const data = await rioGet(
    `/mythic-plus/runs?season=season-mn-1&region=${region}&dungeon=${dungeon}&affixes=all&page=${page}`,
  )

  return (data.rankings ?? []).map((r: any) => ({
    rank: r.rank,
    score: r.score,
    dungeon: r.run?.dungeon?.name ?? 'Unknown',
    dungeonShort: r.run?.dungeon?.short_name ?? '',
    level: r.run?.mythic_level ?? 0,
    clearTimeMs: r.run?.clear_time_ms ?? 0,
    keystoneTimeMs: r.run?.keystone_time_ms ?? 0,
    timed: (r.run?.num_chests ?? 0) > 0,
    completedAt: r.run?.completed_at ?? '',
    roster: (r.run?.roster ?? []).map((m: any) => ({
      name: m.character?.name ?? '',
      class: m.character?.class?.name ?? '',
      spec: m.character?.spec?.name ?? '',
      role: m.role ?? 'dps',
      realm: m.character?.realm?.name ?? '',
      region: m.character?.region?.short_name ?? '',
    })),
  }))
}

// ─── M+ Spec Meta (derived from top runs) ────────────────────────────────────

export interface SpecPopularity {
  spec: string
  class: string
  role: string
  count: number
  pct: number
}

export async function getRioSpecMeta(region = 'world', pages = 5): Promise<SpecPopularity[]> {
  const specCounts = new Map<string, { class: string; role: string; count: number }>()
  let total = 0

  for (let page = 0; page < pages; page++) {
    try {
      const data = await rioGet(
        `/mythic-plus/runs?season=season-mn-1&region=${region}&dungeon=all&affixes=all&page=${page}`,
      )
      for (const ranking of data.rankings ?? []) {
        for (const member of ranking.run?.roster ?? []) {
          const specName = member.character?.spec?.name
          const className = member.character?.class?.name
          const role = member.role ?? 'dps'
          if (!specName || !className) continue

          const key = `${className}_${specName}`
          const existing = specCounts.get(key)
          if (existing) {
            existing.count++
          } else {
            specCounts.set(key, { class: className, role, count: 1 })
          }
          total++
        }
      }
    } catch { break }
  }

  return [...specCounts.entries()]
    .map(([key, val]) => ({
      spec: key.split('_')[1],
      class: val.class,
      role: val.role,
      count: val.count,
      pct: total > 0 ? (val.count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

export async function getRioGuild(region: string, realm: string, name: string): Promise<RioGuild> {
  const data = await rioGet(
    `/guilds/profile?region=${region}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=raid_rankings`,
  )

  const rankings: Record<string, { world: number; region: number; realm: number }> = {}
  if (data.raid_rankings) {
    for (const [tier, diffs] of Object.entries(data.raid_rankings as Record<string, any>)) {
      for (const [diff, rank] of Object.entries(diffs as Record<string, any>)) {
        if (rank.world > 0) {
          rankings[`${tier} ${diff}`] = { world: rank.world, region: rank.region, realm: rank.realm }
        }
      }
    }
  }

  return {
    name: data.name,
    realm: data.realm,
    region: data.region,
    profileUrl: data.profile_url ?? '',
    raidRankings: rankings,
    memberCount: data.members?.length ?? 0,
  }
}
