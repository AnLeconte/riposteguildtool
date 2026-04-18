import { db } from '../db/index.js'
import { raid_events, raid_signups } from '../db/schema.js'
import { eq, and, gte, desc, asc } from 'drizzle-orm'

export async function createEvent(data: {
  guild_name: string; guild_realm: string; region: string
  title: string; raid_name: string; difficulty: string
  description?: string; max_raiders?: number
  starts_at: Date; ends_at?: Date
  created_by: string
}) {
  const [event] = await db.insert(raid_events).values(data).returning()
  return event
}

export async function listEvents(guildRealm: string, guildName: string, region: string) {
  return db.select()
    .from(raid_events)
    .where(
      and(
        eq(raid_events.guild_realm, guildRealm),
        eq(raid_events.guild_name, guildName.toLowerCase()),
        eq(raid_events.region, region),
      ),
    )
    .orderBy(desc(raid_events.starts_at))
    .limit(20)
}

export async function getEvent(eventId: string) {
  const [event] = await db.select().from(raid_events).where(eq(raid_events.id, eventId)).limit(1)
  return event ?? null
}

export async function getEventWithSignups(eventId: string) {
  const event = await getEvent(eventId)
  if (!event) return null

  const signups = await db.select()
    .from(raid_signups)
    .where(eq(raid_signups.event_id, eventId))
    .orderBy(asc(raid_signups.created_at))

  // Group by role
  const tanks = signups.filter((s) => s.role === 'tank')
  const healers = signups.filter((s) => s.role === 'healer')
  const dps = signups.filter((s) => s.role === 'dps')
  const absent = signups.filter((s) => s.status === 'absent')
  const tentative = signups.filter((s) => s.status === 'tentative')
  const present = signups.filter((s) => s.status === 'present')

  return {
    ...event,
    signups,
    grouped: { tanks, healers, dps },
    counts: {
      total: signups.length,
      present: present.length,
      absent: absent.length,
      tentative: tentative.length,
      confirmed: signups.filter((s) => s.confirmed === 'confirmed').length,
      benched: signups.filter((s) => s.confirmed === 'benched').length,
    },
  }
}

export async function updateEvent(eventId: string, patch: Partial<{
  title: string; raid_name: string; difficulty: string; description: string
  max_raiders: number; starts_at: Date; ends_at: Date; status: string
  discord_message_id: string; discord_channel_id: string
}>) {
  const [updated] = await db.update(raid_events)
    .set({ ...patch, updated_at: new Date() })
    .where(eq(raid_events.id, eventId))
    .returning()
  return updated
}

export async function deleteEvent(eventId: string) {
  await db.delete(raid_events).where(eq(raid_events.id, eventId))
}

export async function upsertSignup(eventId: string, userId: string, data: {
  character_name: string; character_realm?: string
  wow_class: string; spec?: string; role: string
  status: string; note?: string
}) {
  // Check if signup already exists for this user+event
  const [existing] = await db.select()
    .from(raid_signups)
    .where(and(eq(raid_signups.event_id, eventId), eq(raid_signups.user_id, userId)))
    .limit(1)

  if (existing) {
    const [updated] = await db.update(raid_signups)
      .set({ ...data, updated_at: new Date() })
      .where(eq(raid_signups.id, existing.id))
      .returning()
    return updated
  }

  const [signup] = await db.insert(raid_signups)
    .values({ event_id: eventId, user_id: userId, ...data })
    .returning()
  return signup
}

export async function upsertDiscordSignup(eventId: string, discordUserId: string, data: {
  character_name: string; character_realm?: string
  wow_class: string; spec?: string; role: string
  status: string; note?: string
}) {
  const [existing] = await db.select()
    .from(raid_signups)
    .where(and(eq(raid_signups.event_id, eventId), eq(raid_signups.discord_user_id, discordUserId)))
    .limit(1)

  if (existing) {
    const [updated] = await db.update(raid_signups)
      .set({ ...data, updated_at: new Date() })
      .where(eq(raid_signups.id, existing.id))
      .returning()
    return updated
  }

  const [signup] = await db.insert(raid_signups)
    .values({ event_id: eventId, discord_user_id: discordUserId, ...data })
    .returning()
  return signup
}

export async function removeSignup(eventId: string, userId: string) {
  await db.delete(raid_signups)
    .where(and(eq(raid_signups.event_id, eventId), eq(raid_signups.user_id, userId)))
}

export async function confirmSignup(signupId: string, confirmed: string) {
  const [updated] = await db.update(raid_signups)
    .set({ confirmed, updated_at: new Date() })
    .where(eq(raid_signups.id, signupId))
    .returning()
  return updated
}
