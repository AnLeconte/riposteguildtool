import { Router, type Router as RouterType } from 'express'
import {
  isWclConfigured,
  getReportFights,
  getFightDetails,
} from '../services/warcraftlogs-api.js'

export const wclRouter: RouterType = Router()

/** GET /api/wcl/report/:code — get report summary with fights */
wclRouter.get('/report/:code', async (req, res) => {
  if (!isWclConfigured()) {
    res.status(503).json({ success: false, error: 'Warcraft Logs API not configured' })
    return
  }
  try {
    const data = await getReportFights(req.params.code)
    res.json({ success: true, data })
  } catch (err) {
    console.error('[GET /wcl/report]', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch report'
    res.status(500).json({ success: false, error: message })
  }
})

/** GET /api/wcl/report/:code/fight/:fightId — get DPS/HPS for a fight */
wclRouter.get('/report/:code/fight/:fightId', async (req, res) => {
  if (!isWclConfigured()) {
    res.status(503).json({ success: false, error: 'Warcraft Logs API not configured' })
    return
  }
  try {
    const fightId = parseInt(req.params.fightId, 10)
    const data = await getFightDetails(req.params.code, fightId)
    res.json({ success: true, data })
  } catch (err) {
    console.error('[GET /wcl/report/fight]', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch fight details'
    res.status(500).json({ success: false, error: message })
  }
})
