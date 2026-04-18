import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { validateBody } from '../middleware/validation.js'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { raid_plans } from '../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'

export const raidPlanRouter: RouterType = Router()

const createPlanSchema = z.object({
  guild_name: z.string().max(255).optional(),
  guild_realm: z.string().max(255).optional(),
  raid_id: z.string().min(1).max(100),
  boss_id: z.string().min(1).max(100),
  map_slug: z.string().max(50).default('main'),
  title: z.string().min(1).max(255),
  items_json: z.any(), // Record<number, PlanItem[]> or PlanItem[]
  phases: z.array(z.string()).optional(),
})

const updatePlanSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  map_slug: z.string().max(50).optional(),
  items_json: z.any().optional(),
  phases: z.array(z.string()).optional(),
})

/**
 * GET /api/raid-plans?raid_id=X&boss_id=Y&guild_name=Z&guild_realm=W
 */
raidPlanRouter.get('/', async (req, res) => {
  try {
    const { raid_id, boss_id, guild_name, guild_realm } = req.query as Record<string, string | undefined>
    if (!raid_id || !boss_id) {
      res.status(400).json({ success: false, error: 'raid_id and boss_id are required' })
      return
    }

    const conditions = [
      eq(raid_plans.raid_id, raid_id),
      eq(raid_plans.boss_id, boss_id),
    ]
    if (guild_name) conditions.push(eq(raid_plans.guild_name, guild_name))
    if (guild_realm) conditions.push(eq(raid_plans.guild_realm, guild_realm))

    const plans = await db.select()
      .from(raid_plans)
      .where(and(...conditions))
      .orderBy(desc(raid_plans.updated_at))
      .limit(50)

    res.json({ success: true, data: plans })
  } catch (err) {
    console.error('[GET /raid-plans]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch raid plans' })
  }
})

/**
 * GET /api/raid-plans/:id
 */
raidPlanRouter.get('/:id', async (req, res) => {
  try {
    const [plan] = await db.select()
      .from(raid_plans)
      .where(eq(raid_plans.id, req.params.id))
      .limit(1)

    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' })
      return
    }
    res.json({ success: true, data: plan })
  } catch (err) {
    console.error('[GET /raid-plans/:id]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch raid plan' })
  }
})

/**
 * POST /api/raid-plans
 */
raidPlanRouter.post('/', requireAuth, validateBody(createPlanSchema), async (req: any, res) => {
  try {
    const body = req.body as z.infer<typeof createPlanSchema>
    const [plan] = await db.insert(raid_plans).values({
      user_id: req.user!.userId,
      guild_name: body.guild_name,
      guild_realm: body.guild_realm,
      raid_id: body.raid_id,
      boss_id: body.boss_id,
      map_slug: body.map_slug,
      title: body.title,
      items_json: body.items_json,
      phases: body.phases,
    }).returning()

    res.status(201).json({ success: true, data: plan })
  } catch (err) {
    console.error('[POST /raid-plans]', err)
    res.status(500).json({ success: false, error: 'Failed to create raid plan' })
  }
})

/**
 * PUT /api/raid-plans/:id
 */
raidPlanRouter.put('/:id', requireAuth, validateBody(updatePlanSchema), async (req: any, res) => {
  try {
    const [existing] = await db.select()
      .from(raid_plans)
      .where(eq(raid_plans.id, req.params.id))
      .limit(1)

    if (!existing) {
      res.status(404).json({ success: false, error: 'Plan not found' })
      return
    }
    if (existing.user_id !== req.user!.userId) {
      res.status(403).json({ success: false, error: 'Not authorized to update this plan' })
      return
    }

    const body = req.body as z.infer<typeof updatePlanSchema>
    const [plan] = await db.update(raid_plans)
      .set({ ...body, updated_at: new Date() })
      .where(eq(raid_plans.id, req.params.id))
      .returning()

    res.json({ success: true, data: plan })
  } catch (err) {
    console.error('[PUT /raid-plans/:id]', err)
    res.status(500).json({ success: false, error: 'Failed to update raid plan' })
  }
})

/**
 * DELETE /api/raid-plans/:id
 */
raidPlanRouter.delete('/:id', requireAuth, async (req: any, res) => {
  try {
    const [existing] = await db.select()
      .from(raid_plans)
      .where(eq(raid_plans.id, req.params.id))
      .limit(1)

    if (!existing) {
      res.status(404).json({ success: false, error: 'Plan not found' })
      return
    }
    if (existing.user_id !== req.user!.userId) {
      res.status(403).json({ success: false, error: 'Not authorized to delete this plan' })
      return
    }

    await db.delete(raid_plans).where(eq(raid_plans.id, req.params.id))
    res.json({ success: true })
  } catch (err) {
    console.error('[DELETE /raid-plans/:id]', err)
    res.status(500).json({ success: false, error: 'Failed to delete raid plan' })
  }
})
