/**
 * Warcraft Logs API client.
 * Supports v1 (API key) and v2 (OAuth2 client credentials).
 * Set WCL_API_KEY for v1, or WCL_CLIENT_ID + WCL_CLIENT_SECRET for v2.
 */

// ─── v2 OAuth token cache ─────────────────────────────────────────────────────
let v2Token: { access_token: string; expires_at: number } | null = null

async function getV2Token(): Promise<string> {
  if (v2Token && v2Token.expires_at > Date.now() + 60000) {
    return v2Token.access_token
  }

  const clientId = process.env.WCL_CLIENT_ID
  const clientSecret = process.env.WCL_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('WCL v2 credentials not configured')

  const res = await fetch('https://www.warcraftlogs.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) throw new Error(`WCL OAuth failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  v2Token = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
  return v2Token.access_token
}

// ─── API mode detection ───────────────────────────────────────────────────────

function getMode(): 'v1' | 'v2' | null {
  if (process.env.WCL_CLIENT_ID && process.env.WCL_CLIENT_SECRET) return 'v2'
  if (process.env.WCL_API_KEY) return 'v1'
  return null
}

export function isWclConfigured(): boolean {
  return getMode() !== null
}

// ─── v1 API ───────────────────────────────────────────────────────────────────

async function v1Get(path: string): Promise<any> {
  const apiKey = process.env.WCL_API_KEY
  const res = await fetch(`https://www.warcraftlogs.com/v1${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey}`)
  if (!res.ok) throw new Error(`WCL v1 error: ${res.status} ${await res.text()}`)
  return res.json()
}

// ─── v2 GraphQL ───────────────────────────────────────────────────────────────

async function v2Query(query: string, variables?: Record<string, any>): Promise<any> {
  const token = await getV2Token()
  const res = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`WCL v2 error: ${res.status}`)
  const data = await res.json()
  if (data.errors?.length) throw new Error(data.errors[0].message)
  return data.data
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface WclFight {
  id: number
  name: string
  kill: boolean
  difficulty: number
  bossPercentage?: number
  fightPercentage?: number
  startTime: number
  endTime: number
}

export interface WclPlayer {
  name: string
  type: string   // class
  spec: string
  itemLevel: number
  total: number  // dps or hps
}

export interface WclReportSummary {
  title: string
  owner: string
  start: number
  end: number
  zone: string
  fights: WclFight[]
}

export interface WclFightDetails {
  dps: WclPlayer[]
  hps: WclPlayer[]
}

/**
 * Get report summary (fights list).
 */
export async function getReportFights(reportId: string): Promise<WclReportSummary> {
  const mode = getMode()

  if (mode === 'v1') {
    const data = await v1Get(`/report/fights/${reportId}`)
    return {
      title: data.title ?? reportId,
      owner: data.owner ?? '',
      start: data.start ?? 0,
      end: data.end ?? 0,
      zone: data.zone?.name ?? '',
      fights: (data.fights ?? [])
        .filter((f: any) => f.boss > 0)
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          kill: f.kill ?? false,
          difficulty: f.difficulty ?? 0,
          bossPercentage: f.bossPercentage,
          fightPercentage: f.fightPercentage,
          startTime: f.start_time,
          endTime: f.end_time,
        })),
    }
  }

  if (mode === 'v2') {
    const data = await v2Query(`
      query ($code: String!) {
        reportData {
          report(code: $code) {
            title
            owner { name }
            startTime
            endTime
            zone { name }
            fights(killType: Encounters) {
              id
              name
              kill
              difficulty
              bossPercentage
              fightPercentage
              startTime
              endTime
            }
          }
        }
      }
    `, { code: reportId })

    const report = data.reportData.report
    return {
      title: report.title,
      owner: report.owner?.name ?? '',
      start: report.startTime,
      end: report.endTime,
      zone: report.zone?.name ?? '',
      fights: (report.fights ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        kill: f.kill,
        difficulty: f.difficulty,
        bossPercentage: f.bossPercentage,
        fightPercentage: f.fightPercentage,
        startTime: f.startTime,
        endTime: f.endTime,
      })),
    }
  }

  throw new Error('Warcraft Logs API not configured')
}

/**
 * Get DPS and HPS tables for a specific fight.
 */
export async function getFightDetails(reportId: string, fightId: number): Promise<WclFightDetails> {
  const mode = getMode()

  if (mode === 'v1') {
    const [dpsData, hpsData] = await Promise.all([
      v1Get(`/report/tables/damage-done/${reportId}?start=0&end=999999999&fight=${fightId}`),
      v1Get(`/report/tables/healing/${reportId}?start=0&end=999999999&fight=${fightId}`),
    ])

    return {
      dps: (dpsData.entries ?? [])
        .filter((e: any) => e.type !== 'Pet')
        .map((e: any) => ({
          name: e.name,
          type: e.type,
          spec: e.spec ?? '',
          itemLevel: e.itemLevel ?? 0,
          total: Math.round(e.total / ((dpsData.totalTime ?? 1) / 1000)),
        }))
        .sort((a: WclPlayer, b: WclPlayer) => b.total - a.total),
      hps: (hpsData.entries ?? [])
        .filter((e: any) => e.type !== 'Pet')
        .map((e: any) => ({
          name: e.name,
          type: e.type,
          spec: e.spec ?? '',
          itemLevel: e.itemLevel ?? 0,
          total: Math.round(e.total / ((hpsData.totalTime ?? 1) / 1000)),
        }))
        .sort((a: WclPlayer, b: WclPlayer) => b.total - a.total),
    }
  }

  if (mode === 'v2') {
    const data = await v2Query(`
      query ($code: String!, $fightIDs: [Int!]) {
        reportData {
          report(code: $code) {
            dps: table(dataType: DamageDone, fightIDs: $fightIDs)
            hps: table(dataType: Healing, fightIDs: $fightIDs)
          }
        }
      }
    `, { code: reportId, fightIDs: [fightId] })

    const report = data.reportData.report
    const parsePlayers = (table: any): WclPlayer[] =>
      (table?.data?.entries ?? [])
        .filter((e: any) => e.type !== 'Pet')
        .map((e: any) => ({
          name: e.name,
          type: e.type,
          spec: e.spec ?? '',
          itemLevel: e.itemLevel ?? 0,
          total: Math.round(e.total / ((table?.data?.totalTime ?? 1) / 1000)),
        }))
        .sort((a: WclPlayer, b: WclPlayer) => b.total - a.total)

    return {
      dps: parsePlayers(report.dps),
      hps: parsePlayers(report.hps),
    }
  }

  throw new Error('Warcraft Logs API not configured')
}

/**
 * Get character best parses (percentile rankings) for the latest raid zone.
 */
export async function getCharacterParses(
  name: string,
  serverSlug: string,
  serverRegion: string,
): Promise<any> {
  const mode = getMode()
  if (mode !== 'v2') throw new Error('WCL v2 required for character parses')

  const data = await v2Query(`
    query ($name: String!, $serverSlug: String!, $serverRegion: String!) {
      characterData {
        character(name: $name, serverSlug: $serverSlug, serverRegion: $serverRegion) {
          zoneRankings(byBracket: false)
        }
      }
    }
  `, { name, serverSlug, serverRegion })

  return data.characterData?.character?.zoneRankings
}

/**
 * Get latest guild reports from WCL v2.
 */
export async function getGuildRecentReports(
  guildName: string,
  serverSlug: string,
  serverRegion: string,
  limit = 3,
): Promise<any[]> {
  const mode = getMode()
  if (mode !== 'v2') throw new Error('WCL v2 required for guild reports')

  const data = await v2Query(`
    query ($guildName: String!, $guildServerSlug: String!, $guildServerRegion: String!, $limit: Int) {
      reportData {
        reports(guildName: $guildName, guildServerSlug: $guildServerSlug, guildServerRegion: $guildServerRegion, limit: $limit) {
          data {
            code
            title
            startTime
            endTime
            zone { name }
            owner { name }
          }
        }
      }
    }
  `, { guildName, guildServerSlug: serverSlug, guildServerRegion: serverRegion, limit })

  return data.reportData?.reports?.data ?? []
}

/**
 * Get guild raid progression from WCL v2.
 */
export async function getGuildProgression(
  guildName: string,
  serverSlug: string,
  serverRegion: string,
): Promise<any> {
  const mode = getMode()
  if (mode !== 'v2') throw new Error('WCL v2 required for guild progression')

  // Fetch progression for multiple difficulties
  const data = await v2Query(`
    query ($name: String!, $serverSlug: String!, $serverRegion: String!) {
      guildData {
        guild(name: $name, serverSlug: $serverSlug, serverRegion: $serverRegion) {
          name
          server { name region { slug } }
          zoneRanking {
            progress { worldRank { number } regionRank { number } serverRank { number } }
          }
        }
      }
    }
  `, { name: guildName, serverSlug, serverRegion })

  return data.guildData?.guild
}
