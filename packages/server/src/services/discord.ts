/**
 * Discord Webhook integration for Raid Signup.
 *
 * Posts an embed to a Discord channel when a raid event is created,
 * and updates it when signups change.
 *
 * Uses Discord Webhook API (no bot needed — just a webhook URL).
 */

import { addReactionsToMessage, trackMessage, untrackMessage } from './discord-bot.js'
import { INSTANCES } from '../data/raids.js'
import { isBlizzardConfigured } from './loot-data.js'
import { getInstanceMedia } from './blizzard-api.js'

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? ''

// Cache raid images so we don't re-fetch every update
const raidImageCache = new Map<string, string>()

export async function getRaidImageUrl(raidName: string, region = 'us'): Promise<string | undefined> {
  const cached = raidImageCache.get(raidName.toLowerCase())
  if (cached) return cached

  try {
    const instance = INSTANCES.find((i) => i.name.toLowerCase() === raidName.toLowerCase())
    if (!instance || !isBlizzardConfigured()) return undefined
    const media = await getInstanceMedia(instance.blizzard_id, region).catch(() => null)
    const url = media?.assets?.find((a: any) => a.key === 'tile')?.value ?? media?.assets?.[0]?.value
    if (url) raidImageCache.set(raidName.toLowerCase(), url)
    return url
  } catch { return undefined }
}

const DIFF_COLORS: Record<string, number> = {
  normal: 0x1eff00,   // green
  heroic: 0xa335ee,   // purple
  mythic: 0xff8000,   // orange
}

const ROLE_EMOJI: Record<string, string> = {
  tank: '🛡️',
  healer: '💚',
  dps: '⚔️',
}

interface SignupInfo {
  character_name: string
  wow_class: string
  spec?: string | null
  role: string
  status: string
  confirmed: string | null
}

interface EventInfo {
  id: string
  title: string
  raid_name: string
  difficulty: string
  starts_at: string | Date
  max_raiders: number | null
  guild_name: string
  guild_realm: string
  image_url?: string | null
}

export function isDiscordConfigured(): boolean {
  return !!DISCORD_WEBHOOK_URL
}

function buildEmbed(event: EventInfo, signups: SignupInfo[]) {
  const date = new Date(event.starts_at)
  const present = signups.filter((s) => s.status === 'present')
  const tentative = signups.filter((s) => s.status === 'tentative')
  const absent = signups.filter((s) => s.status === 'absent')

  const tanks = present.filter((s) => s.role === 'tank')
  const healers = present.filter((s) => s.role === 'healer')
  const dps = present.filter((s) => s.role === 'dps')

  const CONFIRM_ICON: Record<string, string> = {
    confirmed: '✅ Confirmé',
    benched: '🪑 Bench',
    standby: '⏳ Standby',
  }

  const formatList = (list: SignupInfo[]) =>
    list.length > 0
      ? list.map((s) => {
          const specClass = s.spec && s.spec !== '' && s.wow_class !== 'Unknown'
            ? `${s.spec} ${s.wow_class}`
            : s.wow_class !== 'Unknown' ? s.wow_class : ''
          const status = CONFIRM_ICON[s.confirmed ?? ''] ?? '🔸 Waiting'
          const name = specClass ? `**${s.character_name}** — ${specClass}` : `**${s.character_name}**`
          return `${name}\n┗ ${status}`
        }).join('\n')
      : '*None yet*'

  const fields = [
    {
      name: `${ROLE_EMOJI.tank} Tanks (${tanks.length})`,
      value: formatList(tanks),
      inline: true,
    },
    {
      name: `${ROLE_EMOJI.healer} Healers (${healers.length})`,
      value: formatList(healers),
      inline: true,
    },
    {
      name: `${ROLE_EMOJI.dps} DPS (${dps.length})`,
      value: formatList(dps),
      inline: true,
    },
  ]

  if (tentative.length > 0) {
    fields.push({
      name: `❓ Tentative (${tentative.length})`,
      value: tentative.map((s) => s.character_name).join(', '),
      inline: false,
    })
  }

  if (absent.length > 0) {
    fields.push({
      name: `❌ Absent (${absent.length})`,
      value: absent.map((s) => s.character_name).join(', '),
      inline: false,
    })
  }

  const diffLabel = event.difficulty.charAt(0).toUpperCase() + event.difficulty.slice(1)

  const embed: any = {
    title: `📅 ${event.title}`,
    description: `**${event.raid_name}** — ${diffLabel}\n<t:${Math.floor(date.getTime() / 1000)}:F>`,
    color: DIFF_COLORS[event.difficulty] ?? 0xffb100,
    fields,
    footer: {
      text: `${present.length}/${event.max_raiders ?? 25} signed up · <${event.guild_name}> ${event.guild_realm}`,
    },
    timestamp: date.toISOString(),
  }

  if (event.image_url) {
    embed.image = { url: event.image_url }
  }

  return { embeds: [embed] }
}

/**
 * Post a new raid event to Discord. Returns the message ID.
 */
export async function postEventToDiscord(event: EventInfo, signups: SignupInfo[] = []): Promise<{ messageId: string; channelId: string } | null> {
  if (!DISCORD_WEBHOOK_URL) return null

  try {
    // Auto-resolve raid image if not provided
    if (!event.image_url) {
      event = { ...event, image_url: await getRaidImageUrl(event.raid_name) }
    }

    const body = {
      ...buildEmbed(event, signups),
      // wait=true makes Discord return the message object with its ID
    }

    const res = await fetch(`${DISCORD_WEBHOOK_URL}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error('[Discord] Failed to post event:', res.status, await res.text())
      return null
    }

    const data = await res.json() as { id: string; channel_id: string }
    console.log(`[Discord] Posted event "${event.title}" → message ${data.id} in channel ${data.channel_id}`)

    // Track the message and add reaction buttons
    trackMessage(data.id, event.id)
    addReactionsToMessage(data.channel_id, data.id)

    return { messageId: data.id, channelId: data.channel_id }
  } catch (err) {
    console.error('[Discord] Failed to post:', err)
    return null
  }
}

/**
 * Update an existing Discord message with new signup data.
 */
export async function updateEventOnDiscord(messageId: string, event: EventInfo, signups: SignupInfo[]): Promise<void> {
  if (!DISCORD_WEBHOOK_URL || !messageId) return

  try {
    // Auto-resolve raid image if not provided
    if (!event.image_url) {
      event = { ...event, image_url: await getRaidImageUrl(event.raid_name) }
    }

    const res = await fetch(`${DISCORD_WEBHOOK_URL}/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEmbed(event, signups)),
    })

    if (!res.ok) {
      console.error('[Discord] Failed to update message:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[Discord] Update failed:', err)
  }
}

/**
 * Delete a Discord message (when event is cancelled/deleted).
 */
export async function deleteEventFromDiscord(messageId: string): Promise<void> {
  if (!DISCORD_WEBHOOK_URL || !messageId) return

  untrackMessage(messageId)
  try {
    await fetch(`${DISCORD_WEBHOOK_URL}/messages/${messageId}`, { method: 'DELETE' })
  } catch { /* skip */ }
}
