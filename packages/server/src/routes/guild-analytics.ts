import { Router, type Router as RouterType } from 'express'
import { isWclConfigured } from '../services/warcraftlogs-api.js'
import { getRioGuild } from '../services/raiderio-api.js'

export const guildAnalyticsRouter: RouterType = Router()

/**
 * GET /api/guild/:realm/:name/attendance?region=eu
 * Auto-calculates attendance from WarcraftLogs reports.
 */
guildAnalyticsRouter.get('/:realm/:name/attendance', async (req, res) => {
  if (!isWclConfigured()) {
    res.status(503).json({ success: false, error: 'WarcraftLogs not configured' })
    return
  }

  try {
    const guild = req.params.name
    const realm = req.params.realm.toLowerCase()
    const region = (req.query.region as string) ?? 'eu'

    // Import dynamically to avoid circular deps
    const { getGuildRecentReports, getFightDetails } = await import('../services/warcraftlogs-api.js')

    // Get last 10 reports
    const reports = await getGuildRecentReports(guild, realm, region, 10)

    const playerCounts = new Map<string, { raids: number; class?: string; spec?: string }>()

    for (const report of reports) {
      if (!report.code) continue
      try {
        // Get the first boss fight to extract roster
        const { getReportFights } = await import('../services/warcraftlogs-api.js')
        const reportData = await getReportFights(report.code)
        const firstKill = reportData.fights?.find((f: any) => f.kill)
        if (!firstKill) continue

        const details = await getFightDetails(report.code, firstKill.id)
        const allPlayers = [...(details.dps ?? []), ...(details.hps ?? [])]

        const seen = new Set<string>()
        for (const p of allPlayers) {
          if (seen.has(p.name)) continue
          seen.add(p.name)
          const existing = playerCounts.get(p.name) ?? { raids: 0 }
          existing.raids++
          existing.class = p.type
          existing.spec = p.spec
          playerCounts.set(p.name, existing)
        }
      } catch { /* skip broken report */ }
    }

    const totalRaids = reports.length
    const attendance = [...playerCounts.entries()]
      .map(([name, data]) => ({
        name,
        class: data.class ?? 'Unknown',
        spec: data.spec ?? '',
        raids: data.raids,
        total: totalRaids,
        pct: totalRaids > 0 ? Math.round((data.raids / totalRaids) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct || b.raids - a.raids)

    res.json({
      success: true,
      data: { totalRaids, attendance },
    })
  } catch (err) {
    console.error('[GET /guild/:realm/:name/attendance]', err)
    res.status(500).json({ success: false, error: 'Failed to calculate attendance' })
  }
})

/**
 * GET /api/guild/:realm/:name/performance?region=eu
 * Average DPS/HPS per player from recent WCL reports.
 */
guildAnalyticsRouter.get('/:realm/:name/performance', async (req, res) => {
  if (!isWclConfigured()) {
    res.status(503).json({ success: false, error: 'WarcraftLogs not configured' })
    return
  }

  try {
    const guild = req.params.name
    const realm = req.params.realm.toLowerCase()
    const region = (req.query.region as string) ?? 'eu'

    const { getGuildRecentReports, getReportFights, getFightDetails } = await import('../services/warcraftlogs-api.js')

    const reports = await getGuildRecentReports(guild, realm, region, 5)

    const playerStats = new Map<string, { totalDps: number; totalHps: number; fights: number; class?: string; spec?: string }>()

    for (const report of reports) {
      if (!report.code) continue
      try {
        const reportData = await getReportFights(report.code)
        const kills = (reportData.fights ?? []).filter((f: any) => f.kill).slice(0, 5)

        for (const fight of kills) {
          try {
            const details = await getFightDetails(report.code, fight.id)
            for (const p of details.dps ?? []) {
              const existing = playerStats.get(p.name) ?? { totalDps: 0, totalHps: 0, fights: 0 }
              existing.totalDps += p.total
              existing.fights++
              existing.class = p.type
              existing.spec = p.spec
              playerStats.set(p.name, existing)
            }
            for (const p of details.hps ?? []) {
              const existing = playerStats.get(p.name) ?? { totalDps: 0, totalHps: 0, fights: 0 }
              existing.totalHps += p.total
              playerStats.set(p.name, existing)
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    const performance = [...playerStats.entries()]
      .map(([name, data]) => ({
        name,
        class: data.class ?? 'Unknown',
        spec: data.spec ?? '',
        avgDps: data.fights > 0 ? Math.round(data.totalDps / data.fights) : 0,
        avgHps: data.fights > 0 ? Math.round(data.totalHps / data.fights) : 0,
        fights: data.fights,
      }))
      .sort((a, b) => b.avgDps - a.avgDps)

    res.json({
      success: true,
      data: { reportsAnalyzed: reports.length, performance },
    })
  } catch (err) {
    console.error('[GET /guild/:realm/:name/performance]', err)
    res.status(500).json({ success: false, error: 'Failed to calculate performance' })
  }
})

/**
 * GET /api/guild/:realm/:name/timeline?region=eu
 * Progression timeline — first kills from WCL reports.
 */
guildAnalyticsRouter.get('/:realm/:name/timeline', async (req, res) => {
  if (!isWclConfigured()) {
    res.status(503).json({ success: false, error: 'WarcraftLogs not configured' })
    return
  }

  try {
    const guild = req.params.name
    const realm = req.params.realm.toLowerCase()
    const region = (req.query.region as string) ?? 'eu'

    const { getGuildRecentReports, getReportFights } = await import('../services/warcraftlogs-api.js')

    const reports = await getGuildRecentReports(guild, realm, region, 20)

    const bosses = new Map<string, { boss: string; zone: string; firstKill: string | null; reportCode: string; pulls: number; kills: number; wipes: number; bestPull: number }>()

    for (const report of reports) {
      if (!report.code) continue
      try {
        const data = await getReportFights(report.code)
        const zone = data.zone ?? report.zone?.name ?? ''

        for (const fight of data.fights ?? []) {
          if (!fight.name || fight.name === 'Trash') continue
          const key = `${fight.name}_${zone}`
          let entry = bosses.get(key)
          if (!entry) {
            entry = { boss: fight.name, zone, firstKill: null, reportCode: report.code, pulls: 0, kills: 0, wipes: 0, bestPull: 100 }
            bosses.set(key, entry)
          }
          entry.pulls++
          if (fight.kill) {
            entry.kills++
            if (!entry.firstKill) {
              entry.firstKill = new Date(report.startTime + fight.startTime).toISOString()
              entry.reportCode = report.code
            }
          } else {
            entry.wipes++
            // Track best wipe % (boss HP remaining)
            const bossPercent = fight.bossPercentage ?? fight.fightPercentage ?? 100
            if (bossPercent < entry.bestPull) entry.bestPull = bossPercent
          }
        }
      } catch { /* skip */ }
    }

    const timeline = [...bosses.values()]
      .sort((a, b) => {
        if (a.firstKill && b.firstKill) return new Date(a.firstKill).getTime() - new Date(b.firstKill).getTime()
        if (a.firstKill) return -1
        if (b.firstKill) return 1
        return b.pulls - a.pulls
      })

    res.json({ success: true, data: timeline })
  } catch (err) {
    console.error('[GET /guild/:realm/:name/timeline]', err)
    res.status(500).json({ success: false, error: 'Failed to build timeline' })
  }
})

/**
 * GET /api/guild/:realm/:name/boss-pulls?boss=BossName&region=eu
 * Pull-by-pull progression for a specific boss.
 * Returns array of { pull, percent, kill, duration, date, reportCode }
 */
guildAnalyticsRouter.get('/:realm/:name/boss-pulls', async (req, res) => {
  if (!isWclConfigured()) {
    res.status(503).json({ success: false, error: 'WarcraftLogs not configured' })
    return
  }

  try {
    const guild = req.params.name
    const realm = req.params.realm.toLowerCase()
    const region = (req.query.region as string) ?? 'eu'
    const bossName = req.query.boss as string
    if (!bossName) {
      res.status(400).json({ success: false, error: 'boss query param required' })
      return
    }

    const { getGuildRecentReports, getReportFights } = await import('../services/warcraftlogs-api.js')
    const reports = await getGuildRecentReports(guild, realm, region, 20)

    const pulls: Array<{ pull: number; percent: number; kill: boolean; duration: number; date: string; reportCode: string }> = []
    let pullNum = 0

    // Sort reports by start time (oldest first)
    const sorted = [...reports].sort((a, b) => (a.startTime || 0) - (b.startTime || 0))

    for (const report of sorted) {
      if (!report.code) continue
      try {
        const data = await getReportFights(report.code)
        const fights = (data.fights ?? [])
          .filter((f: any) => f.name === bossName)
          .sort((a: any, b: any) => (a.startTime || 0) - (b.startTime || 0))

        for (const fight of fights) {
          pullNum++
          const percent = fight.kill ? 0 : (fight.bossPercentage ?? fight.fightPercentage ?? 100)
          pulls.push({
            pull: pullNum,
            percent: Math.round(percent * 100) / 100,
            kill: !!fight.kill,
            duration: Math.round(((fight.endTime || 0) - (fight.startTime || 0)) / 1000),
            date: new Date((report.startTime || 0) + (fight.startTime || 0)).toISOString(),
            reportCode: report.code,
          })
        }
      } catch { /* skip */ }
    }

    res.json({ success: true, data: { boss: bossName, pulls } })
  } catch (err) {
    console.error('[GET /guild/:realm/:name/boss-pulls]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch boss pulls' })
  }
})
