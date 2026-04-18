/**
 * Addon Sync API — allows the WoW addon to fetch raid notes & CD plans.
 *
 * Data is synced from the web frontend (localStorage) to the server,
 * then the addon can pull it via API key.
 */

import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { validateBody } from '../middleware/validation.js'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { eq } from 'drizzle-orm'

// In-memory store for synced data (per guild)
// In production, this would be a DB table
const syncStore = new Map<string, { notes: any[]; cdPlans: any[]; updatedAt: Date }>()

export const addonSyncRouter: RouterType = Router()

const syncSchema = z.object({
  guild_key: z.string().min(1), // "realm-guildname"
  notes: z.array(z.object({
    id: z.string(),
    encounter: z.string().optional(),
    title: z.string(),
    content: z.string(),
  })),
  cd_plans: z.array(z.object({
    id: z.string(),
    name: z.string(),
    encounter_id: z.string(),
    roster: z.array(z.any()),
    placements: z.array(z.any()),
  })),
})

/**
 * POST /api/addon-sync — push data from web frontend
 */
addonSyncRouter.post('/', requireAuth, validateBody(syncSchema), async (req: any, res) => {
  try {
    const body = req.body as z.infer<typeof syncSchema>
    syncStore.set(body.guild_key, {
      notes: body.notes,
      cdPlans: body.cd_plans,
      updatedAt: new Date(),
    })
    res.json({ success: true })
  } catch (err) {
    console.error('[POST /addon-sync]', err)
    res.status(500).json({ success: false, error: 'Failed to sync' })
  }
})

/**
 * GET /api/addon-sync/:guildKey — addon fetches data
 * No auth required — addon uses the guild key as identifier
 */
addonSyncRouter.get('/:guildKey', async (req, res) => {
  try {
    const data = syncStore.get(req.params.guildKey)
    if (!data) {
      res.json({ success: true, data: { notes: [], cd_plans: [], updated_at: null } })
      return
    }
    res.json({
      success: true,
      data: {
        notes: data.notes,
        cd_plans: data.cdPlans,
        updated_at: data.updatedAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[GET /addon-sync/:guildKey]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch sync data' })
  }
})
