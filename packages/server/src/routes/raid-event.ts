import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { validateBody } from '../middleware/validation.js'
import { requireAuth } from '../middleware/auth.js'
import {
  createEvent, listEvents, getEventWithSignups, updateEvent,
  deleteEvent, upsertSignup, removeSignup, confirmSignup, upsertDiscordSignup,
} from '../services/raid-event.js'
import {
  isDiscordConfigured, postEventToDiscord, updateEventOnDiscord, deleteEventFromDiscord,
} from '../services/discord.js'
import { sendDM } from '../services/discord-bot.js'

/** Refresh the Discord embed after a signup change (non-blocking, image auto-resolved) */
async function syncDiscord(eventId: string): Promise<void> {
  if (!isDiscordConfigured()) return
  try {
    const full = await getEventWithSignups(eventId)
    if (!full?.discord_message_id) return
    await updateEventOnDiscord(full.discord_message_id, full, full.signups)
  } catch { /* skip */ }
}

export const raidEventRouter: RouterType = Router({ mergeParams: true })

const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  raid_name: z.string().min(1).max(255),
  difficulty: z.enum(['normal', 'heroic', 'mythic']),
  description: z.string().max(2000).optional(),
  max_raiders: z.number().int().min(1).max(40).default(25),
  starts_at: z.string(),
  ends_at: z.string().optional(),
})

const signupSchema = z.object({
  character_name: z.string().min(1).max(255),
  character_realm: z.string().max(255).optional(),
  wow_class: z.string().min(1).max(50),
  spec: z.string().max(50).optional(),
  role: z.enum(['tank', 'healer', 'dps']),
  status: z.enum(['present', 'absent', 'tentative']).default('present'),
  note: z.string().max(500).optional(),
})

const confirmSchema = z.object({
  confirmed: z.enum(['confirmed', 'benched', 'standby', 'pending']),
})

/**
 * GET /api/guild/:realm/:name/events
 */
raidEventRouter.get('/', async (req: any, res) => {
  try {
    const realm = req.params.realm.toLowerCase()
    const guild = req.params.name.toLowerCase()
    const region = (req.query.region as string) ?? 'eu'

    const events = await listEvents(realm, guild, region)
    res.json({ success: true, data: events })
  } catch (err) {
    console.error('[GET /guild/:realm/:name/events]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch events' })
  }
})

/**
 * POST /api/guild/:realm/:name/events
 */
raidEventRouter.post('/', requireAuth, validateBody(createEventSchema), async (req: any, res) => {
  try {
    const realm = req.params.realm.toLowerCase()
    const guild = req.params.name.toLowerCase()
    const region = (req.query.region as string) ?? 'eu'
    const body = req.body as z.infer<typeof createEventSchema>

    let event = await createEvent({
      guild_name: guild,
      guild_realm: realm,
      region,
      title: body.title,
      raid_name: body.raid_name,
      difficulty: body.difficulty,
      description: body.description,
      max_raiders: body.max_raiders,
      starts_at: new Date(body.starts_at),
      ends_at: body.ends_at ? new Date(body.ends_at) : undefined,
      created_by: req.user!.userId,
    })

    // Post to Discord (image auto-resolved)
    if (isDiscordConfigured()) {
      const discord = await postEventToDiscord(event)
      if (discord) {
        event = await updateEvent(event.id, {
          discord_message_id: discord.messageId,
          discord_channel_id: discord.channelId,
        }) ?? event
      }
    }

    res.status(201).json({ success: true, data: event })
  } catch (err) {
    console.error('[POST /guild/:realm/:name/events]', err)
    res.status(500).json({ success: false, error: 'Failed to create event' })
  }
})

/**
 * GET /api/guild/:realm/:name/events/:eventId
 */
raidEventRouter.get('/:eventId', async (req, res) => {
  try {
    const event = await getEventWithSignups(req.params.eventId)
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' })
      return
    }
    res.json({ success: true, data: event })
  } catch (err) {
    console.error('[GET /events/:eventId]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch event' })
  }
})

/**
 * PATCH /api/guild/:realm/:name/events/:eventId
 */
raidEventRouter.patch('/:eventId', requireAuth, async (req, res) => {
  try {
    const event = await updateEvent(req.params.eventId, req.body)
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' })
      return
    }
    res.json({ success: true, data: event })
  } catch (err) {
    console.error('[PATCH /events/:eventId]', err)
    res.status(500).json({ success: false, error: 'Failed to update event' })
  }
})

/**
 * DELETE /api/guild/:realm/:name/events/:eventId
 */
raidEventRouter.delete('/:eventId', requireAuth, async (req, res) => {
  try {
    // Delete Discord message if exists
    const evt = await getEventWithSignups(req.params.eventId)
    if (evt?.discord_message_id) {
      deleteEventFromDiscord(evt.discord_message_id)
    }
    await deleteEvent(req.params.eventId)
    res.json({ success: true })
  } catch (err) {
    console.error('[DELETE /events/:eventId]', err)
    res.status(500).json({ success: false, error: 'Failed to delete event' })
  }
})

/**
 * POST /api/guild/:realm/:name/events/:eventId/signup
 */
raidEventRouter.post('/:eventId/signup', requireAuth, validateBody(signupSchema), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof signupSchema>
    const signup = await upsertSignup(req.params.eventId, req.user!.userId, body)
    syncDiscord(req.params.eventId)
    res.json({ success: true, data: signup })
  } catch (err) {
    console.error('[POST /events/:eventId/signup]', err)
    res.status(500).json({ success: false, error: 'Failed to sign up' })
  }
})

/**
 * DELETE /api/guild/:realm/:name/events/:eventId/signup
 */
raidEventRouter.delete('/:eventId/signup', requireAuth, async (req, res) => {
  try {
    await removeSignup(req.params.eventId, req.user!.userId)
    syncDiscord(req.params.eventId)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to remove signup' })
  }
})

/**
 * PATCH /api/guild/:realm/:name/events/:eventId/signups/:signupId
 */
raidEventRouter.patch('/:eventId/signups/:signupId', requireAuth, validateBody(confirmSchema), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof confirmSchema>
    const signup = await confirmSignup(req.params.signupId, body.confirmed)
    if (!signup) {
      res.status(404).json({ success: false, error: 'Signup not found' })
      return
    }
    syncDiscord(req.params.eventId)

    // DM the player on Discord
    if (signup.discord_user_id) {
      const event = await getEventWithSignups(req.params.eventId)
      const raidLabel = `**${event?.title ?? 'un raid'}** (${event?.raid_name})`
      const statusMsg = body.confirmed === 'confirmed'
        ? `✅ Tu as été **confirmé** pour ${raidLabel}`
        : body.confirmed === 'benched'
        ? `🪑 Tu as été **bench** pour ${raidLabel}`
        : body.confirmed === 'standby'
        ? `⏳ Tu es en **standby** pour ${raidLabel}`
        : null
      if (statusMsg) sendDM(signup.discord_user_id, statusMsg)
    }

    res.json({ success: true, data: signup })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to confirm signup' })
  }
})

/**
 * POST /api/guild/:realm/:name/events/:eventId/discord-signup
 * For future Discord bot integration — uses API key auth instead of JWT.
 */
raidEventRouter.post('/:eventId/discord-signup', async (req, res) => {
  const apiKey = req.headers['x-api-key']
  if (!apiKey || apiKey !== process.env.DISCORD_BOT_API_KEY) {
    res.status(401).json({ success: false, error: 'Invalid API key' })
    return
  }

  try {
    const { discord_user_id, ...data } = req.body
    if (!discord_user_id) {
      res.status(400).json({ success: false, error: 'discord_user_id required' })
      return
    }
    const signup = await upsertDiscordSignup(req.params.eventId, discord_user_id, data)
    syncDiscord(req.params.eventId)
    res.json({ success: true, data: signup })
  } catch (err) {
    console.error('[POST /events/:eventId/discord-signup]', err)
    res.status(500).json({ success: false, error: 'Failed to process Discord signup' })
  }
})
