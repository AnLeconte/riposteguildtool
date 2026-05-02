/**
 * Lightweight Discord bot that:
 * 1. Adds reaction emojis (✅ ❓ ❌) to raid event messages
 * 2. Listens for reaction add/remove and maps them to signups
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { upsertDiscordSignup, getEventWithSignups } from './raid-event.js'
import { getLinkedCharacter } from './discord-link.js'
import { updateEventOnDiscord } from './discord.js'
import { db } from '../db/index.js'
import { raid_events, raid_signups } from '../db/schema.js'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getGuildRoster } from './blizzard-api.js'
import { getGuildRecentReports, getReportFights, isWclConfigured } from './warcraftlogs-api.js'
import { handleMusicMessage } from './discord-music.js'

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? ''
const DISCORD_ABSENCE_CHANNEL_ID = process.env.DISCORD_ABSENCE_CHANNEL_ID ?? ''
const DISCORD_APPLY_CHANNEL_ID = process.env.DISCORD_APPLY_CHANNEL_ID ?? ''

// Guild config for slash commands
const GUILD_NAME = process.env.GUILD_NAME ?? 'Riposte'
const GUILD_REALM = process.env.GUILD_REALM ?? 'hyjal'
const GUILD_REGION = process.env.GUILD_REGION ?? 'eu'

const ACCENT_COLOR = 0x00FF96 // guild accent green

// Reaction → signup status mapping
const REACTION_MAP: Record<string, string> = {
  '✅': 'present',
  '❓': 'tentative',
  '❌': 'absent',
}

let client: Client | null = null

// Track which messages are raid events (discord_message_id → event_id)
const trackedMessages = new Map<string, string>()

async function loadTrackedMessages() {
  try {
    const events = await db.select({
      id: raid_events.id,
      discord_message_id: raid_events.discord_message_id,
    }).from(raid_events)
      .where(eq(raid_events.status, 'open'))

    for (const e of events) {
      if (e.discord_message_id) {
        trackedMessages.set(e.discord_message_id, e.id)
      }
    }
    console.log(`[discord-bot] Tracking ${trackedMessages.size} event messages`)
  } catch (err) {
    console.error('[discord-bot] Failed to load tracked messages:', err)
  }
}

/**
 * Send a DM to a Discord user.
 */
export async function sendDM(discordUserId: string, message: string): Promise<void> {
  if (!client) return
  try {
    const user = await client.users.fetch(discordUserId)
    await user.send(message)
  } catch (err) {
    console.error(`[discord-bot] Failed to DM ${discordUserId}:`, (err as Error).message)
  }
}

const ROLE_EMOJI: Record<string, string> = {
  tank: '🛡️', healer: '💚', dps: '⚔️',
}

const DIFF_LABELS: Record<string, string> = {
  normal: 'Normal', heroic: 'Héroïque', mythic: 'Mythique',
}

const CLASS_COLORS: Record<string, number> = {
  Warrior: 0xC69B6D, Paladin: 0xF48CBA, Hunter: 0xAAD372, Rogue: 0xFFF468,
  Priest: 0xFFFFFF, 'Death Knight': 0xC41E3A, Shaman: 0x0070DD, Mage: 0x3FC7EB,
  Warlock: 0x8788EE, Monk: 0x00FF96, Druid: 0xFF7D0A, 'Demon Hunter': 0xA330C9,
  Evoker: 0x33937F,
}

/** Post an absence notification to the dedicated Discord channel */
async function postAbsence(
  displayName: string,
  discordUserId: string,
  wowClass: string,
  role: string,
  spec: string,
  event: { title: string; raid_name: string; difficulty: string; starts_at: string | Date },
) {
  if (!client || !DISCORD_ABSENCE_CHANNEL_ID) return
  try {
    const channel = await client.channels.fetch(DISCORD_ABSENCE_CHANNEL_ID)
    if (!channel?.isTextBased()) return

    const date = new Date(event.starts_at)
    const timestamp = Math.floor(date.getTime() / 1000)
    const diff = DIFF_LABELS[event.difficulty] ?? event.difficulty
    const roleIcon = ROLE_EMOJI[role] ?? '⚔️'
    const classColor = CLASS_COLORS[wowClass] ?? 0xED4245
    const specClass = spec && wowClass !== 'Unknown' ? `${spec} ${wowClass}` : wowClass !== 'Unknown' ? wowClass : 'Classe inconnue'

    // Fetch Discord user for avatar
    let avatarUrl: string | undefined
    try {
      const discordUser = await client!.users.fetch(discordUserId)
      avatarUrl = discordUser.displayAvatarURL({ size: 64 })
    } catch { /* skip */ }

    await (channel as any).send({
      embeds: [{
        author: {
          name: `${displayName} — Absent`,
          icon_url: avatarUrl,
        },
        color: classColor,
        fields: [
          {
            name: '🎮 Personnage',
            value: `${roleIcon} ${specClass}\n<@${discordUserId}>`,
            inline: true,
          },
          {
            name: '📅 Raid',
            value: `**${event.title}**\n${event.raid_name} (${diff})`,
            inline: true,
          },
          {
            name: '🕐 Date',
            value: `<t:${timestamp}:F>\n<t:${timestamp}:R>`,
            inline: true,
          },
        ],
        footer: {
          text: 'Riposte Guild Tool — Absences',
        },
        timestamp: new Date().toISOString(),
      }],
    })
  } catch (err) {
    console.error('[discord-bot] Failed to post absence:', (err as Error).message)
  }
}

export function trackMessage(messageId: string, eventId: string) {
  trackedMessages.set(messageId, eventId)
}

export function untrackMessage(messageId: string) {
  trackedMessages.delete(messageId)
}

/**
 * Add reaction emojis to a Discord message.
 * Call this after posting the webhook embed.
 */
export async function addReactionsToMessage(channelId: string, messageId: string) {
  if (!client) return

  try {
    const channel = await client.channels.fetch(channelId)
    if (!channel?.isTextBased()) return

    const message = await (channel as any).messages.fetch(messageId)
    if (!message) return

    await message.react('✅')
    await message.react('❓')
    await message.react('❌')
  } catch (err) {
    console.error('[discord-bot] Failed to add reactions:', err)
  }
}

// ─── Slash Commands ──────────────────────────────────────────────────────────

const slashCommands = [
  new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Affiche le roster de la guilde avec la distribution des classes'),
  new SlashCommandBuilder()
    .setName('nextraid')
    .setDescription('Affiche le prochain raid event planifie'),
  new SlashCommandBuilder()
    .setName('progress')
    .setDescription('Affiche la progression raid actuelle de la guilde'),
]

async function registerSlashCommands(): Promise<void> {
  if (!client?.application) return
  try {
    // Guild-scoped registration = instant availability
    const guildId = process.env.DISCORD_GUILD_ID
    if (guildId) {
      const guild = await client.guilds.fetch(guildId)
      await guild.commands.set(slashCommands)
      console.log(`[discord-bot] Slash commands registered (guild: ${guildId})`)
    } else {
      await client.application.commands.set(slashCommands)
      console.log('[discord-bot] Slash commands registered (global — may take up to 1h)')
    }
  } catch (err) {
    console.error('[discord-bot] Failed to register slash commands:', err)
  }
}

// ─── Slash Command Handlers ──────────────────────────────────────────────────

async function handleRoster(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()
  try {
    const data = await getGuildRoster(GUILD_REALM, GUILD_NAME.toLowerCase(), GUILD_REGION)
    const members = data.members ?? []

    // Count per class
    const classCounts = new Map<string, number>()
    for (const m of members) {
      const className = m.character?.playable_class?.name ?? 'Unknown'
      classCounts.set(className, (classCounts.get(className) ?? 0) + 1)
    }

    const sorted = [...classCounts.entries()].sort((a, b) => b[1] - a[1])
    const lines = sorted.map(([cls, count]) => `**${cls}** — ${count}`)

    const embed = new EmbedBuilder()
      .setTitle(`<${GUILD_NAME}> Roster`)
      .setDescription(`${members.length} membres\n\n${lines.join('\n')}`)
      .setColor(ACCENT_COLOR)
      .setFooter({ text: 'Riposte Guild Tool' })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    await interaction.editReply(`Erreur lors de la recuperation du roster: ${(err as Error).message}`)
  }
}

async function handleNextRaid(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()
  try {
    const now = new Date()
    const events = await db
      .select()
      .from(raid_events)
      .where(
        and(
          eq(raid_events.guild_name, GUILD_NAME.toLowerCase()),
          eq(raid_events.guild_realm, GUILD_REALM),
          eq(raid_events.status, 'open'),
          gte(raid_events.starts_at, now),
        ),
      )
      .orderBy(raid_events.starts_at)
      .limit(1)

    if (events.length === 0) {
      await interaction.editReply('Aucun raid planifie prochainement.')
      return
    }

    const event = events[0]
    const timestamp = Math.floor(new Date(event.starts_at).getTime() / 1000)

    const DIFF_LABELS: Record<string, string> = {
      normal: 'Normal', heroic: 'Heroique', mythic: 'Mythique',
    }

    const embed = new EmbedBuilder()
      .setTitle(`${event.title}`)
      .setDescription(
        `**${event.raid_name}** (${DIFF_LABELS[event.difficulty] ?? event.difficulty})\n\n` +
        `📅 <t:${timestamp}:F> (<t:${timestamp}:R>)\n` +
        `👥 ${event.max_raiders ?? 25} places\n` +
        (event.description ? `\n${event.description}` : ''),
      )
      .setColor(ACCENT_COLOR)
      .setFooter({ text: 'Riposte Guild Tool' })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    await interaction.editReply(`Erreur: ${(err as Error).message}`)
  }
}

async function handleProgress(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()
  try {
    if (!isWclConfigured()) {
      await interaction.editReply('Warcraft Logs API non configuree.')
      return
    }

    const reports = await getGuildRecentReports(GUILD_NAME, GUILD_REALM, GUILD_REGION, 10)
    if (reports.length === 0) {
      await interaction.editReply('Aucun rapport de raid trouve.')
      return
    }

    // Aggregate kills per boss across recent reports
    const bossKills = new Map<string, { kills: number; zone: string }>()
    for (const report of reports) {
      try {
        const summary = await getReportFights(report.code)
        for (const fight of summary.fights) {
          if (fight.kill) {
            const existing = bossKills.get(fight.name)
            if (existing) {
              existing.kills++
            } else {
              bossKills.set(fight.name, { kills: 1, zone: summary.zone })
            }
          }
        }
      } catch { /* skip failed reports */ }
    }

    if (bossKills.size === 0) {
      await interaction.editReply('Aucun kill de boss trouve dans les rapports recents.')
      return
    }

    // Group by zone
    const zones = new Map<string, string[]>()
    for (const [boss, data] of bossKills) {
      const zone = data.zone || 'Unknown'
      const list = zones.get(zone) ?? []
      list.push(`✅ **${boss}** — ${data.kills} kill${data.kills > 1 ? 's' : ''}`)
      zones.set(zone, list)
    }

    const description = [...zones.entries()]
      .map(([zone, bosses]) => `__${zone}__\n${bosses.join('\n')}`)
      .join('\n\n')

    const embed = new EmbedBuilder()
      .setTitle(`<${GUILD_NAME}> Progression`)
      .setDescription(description)
      .setColor(ACCENT_COLOR)
      .setFooter({ text: `Base sur les ${reports.length} derniers rapports WCL` })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    await interaction.editReply(`Erreur: ${(err as Error).message}`)
  }
}

// ─── Bot startup ─────────────────────────────────────────────────────────────

export function startDiscordBot(): void {
  if (!DISCORD_BOT_TOKEN) {
    console.log('[discord-bot] No DISCORD_BOT_TOKEN set, skipping')
    return
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [
      Partials.Message,
      Partials.Reaction,
      Partials.User,
    ],
  })

  client.on('ready', async () => {
    console.log(`[discord-bot] Logged in as ${client!.user?.tag}`)
    await loadTrackedMessages()

    // Register slash commands
    await registerSlashCommands()
  })

  // Handle slash command interactions
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return

    switch (interaction.commandName) {
      case 'roster':
        await handleRoster(interaction)
        break
      case 'nextraid':
        await handleNextRaid(interaction)
        break
      case 'progress':
        await handleProgress(interaction)
        break
    }
  })

  // Handle r! prefix commands (music)
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return
    try {
      await handleMusicMessage(message)
    } catch (err) {
      console.error('[music] Command error:', err)
    }
  })

  // Handle reaction add
  client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return

    // Resolve partial
    if (reaction.partial) {
      try { await reaction.fetch() } catch { return }
    }

    const messageId = reaction.message.id
    const eventId = trackedMessages.get(messageId)
    if (!eventId) return

    const emoji = reaction.emoji.name ?? ''
    const status = REACTION_MAP[emoji]
    if (!status) return

    const discordUserId = user.id
    const displayName = (user as any).globalName ?? (user as any).username ?? `User${user.id.slice(-4)}`

    // Remove other reactions from this user on this message (only one status allowed)
    try {
      const msg = reaction.message
      for (const [emojiKey, otherReaction] of msg.reactions.cache) {
        if (emojiKey !== emoji && REACTION_MAP[otherReaction.emoji.name ?? '']) {
          await otherReaction.users.remove(user.id).catch(() => {})
        }
      }
    } catch { /* skip */ }

    // Try to resolve linked WoW character
    try {
      const linked = await getLinkedCharacter(discordUserId)

      if (linked) {
        // User has linked their account — use their real character
        await upsertDiscordSignup(eventId, discordUserId, {
          character_name: linked.name,
          character_realm: linked.realm,
          wow_class: linked.class,
          spec: linked.spec,
          role: linked.role,
          status,
        })
        console.log(`[discord-bot] ${linked.name} (${linked.spec} ${linked.class}) → ${status}`)
      } else {
        // No link — use Discord display name
        await upsertDiscordSignup(eventId, discordUserId, {
          character_name: displayName,
          wow_class: 'Unknown',
          role: 'dps',
          status,
        })
        console.log(`[discord-bot] ${displayName} (unlinked) → ${status}`)
      }

      // Update the Discord embed with new signup list
      try {
        const full = await getEventWithSignups(eventId)
        if (full?.discord_message_id) {
          await updateEventOnDiscord(full.discord_message_id, full, full.signups)
        }

        // Post absence to dedicated channel
        if (status === 'absent' && full) {
          postAbsence(
            linked?.name ?? displayName,
            discordUserId,
            linked?.class ?? 'Unknown',
            linked?.role ?? 'dps',
            linked?.spec ?? '',
            full,
          )
        }
      } catch { /* skip */ }
    } catch (err) {
      console.error('[discord-bot] Signup failed:', err)
    }
  })

  // Handle reaction remove
  client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return

    if (reaction.partial) {
      try { await reaction.fetch() } catch { return }
    }

    const messageId = reaction.message.id
    const eventId = trackedMessages.get(messageId)
    if (!eventId) return

    const emoji = reaction.emoji.name ?? ''
    if (!REACTION_MAP[emoji]) return

    const discordUserId = user.id

    // Check if user still has another reaction on this message
    try {
      const msg = reaction.message
      let hasOther = false
      for (const [, otherReaction] of msg.reactions.cache) {
        if (REACTION_MAP[otherReaction.emoji.name ?? '']) {
          const users = await otherReaction.users.fetch()
          if (users.has(discordUserId)) {
            hasOther = true
            break
          }
        }
      }

      // If no more reactions, remove signup
      if (!hasOther) {
        await db.delete(raid_signups).where(
          and(
            eq(raid_signups.event_id, eventId),
            eq(raid_signups.discord_user_id, discordUserId),
          ),
        )
        console.log(`[discord-bot] ${user.id} removed signup for event ${eventId}`)
      }

      // Update the Discord embed
      try {
        const full = await getEventWithSignups(eventId)
        if (full?.discord_message_id) {
          await updateEventOnDiscord(full.discord_message_id, full, full.signups)
        }
      } catch { /* skip */ }
    } catch (err) {
      console.error('[discord-bot] Remove signup failed:', err)
    }
  })

  client.login(DISCORD_BOT_TOKEN).catch((err) => {
    console.error('[discord-bot] Login failed:', err.message)
  })
}

/** Post a guild application to the applications channel */
export async function postApplication(data: {
  charName: string; realm: string;
  mainClass: string; mainSpec: string;
  offSpec?: string;
  alts?: Array<{ name: string; class: string; spec: string }>;
  ilvl: string;
  raidExp: string;
  logsUrl?: string; rioUrl?: string;
  discord: string; discordId?: string;
  availability: string; timeSlot: string;
  about?: string;
}): Promise<void> {
  if (!client || !DISCORD_APPLY_CHANNEL_ID) return
  try {
    const channel = await client.channels.fetch(DISCORD_APPLY_CHANNEL_ID)
    if (!channel?.isTextBased()) return

    const CLASS_COLORS: Record<string, number> = {
      'Death Knight': 0xC41E3A, 'Demon Hunter': 0xA330C9, Druid: 0xFF7D0A,
      Evoker: 0x33937F, Hunter: 0xAAD372, Mage: 0x3FC7EB, Monk: 0x00FF96,
      Paladin: 0xF48CBA, Priest: 0xFFFFFF, Rogue: 0xFFF468, Shaman: 0x0070DD,
      Warlock: 0x8788EE, Warrior: 0xC69B6D,
    }

    const color = CLASS_COLORS[data.mainClass] ?? 0x00FF96
    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: '🎮 Personnage', value: `**${data.charName}** - ${data.realm}`, inline: true },
      { name: '⚔️ Classe / Spé', value: `${data.mainSpec} ${data.mainClass}${data.offSpec ? ` (OS: ${data.offSpec})` : ''}`, inline: true },
      { name: '📊 ilvl', value: data.ilvl || '?', inline: true },
    ]

    if (data.alts && data.alts.length > 0) {
      const altList = data.alts.map(a => `${a.name || '?'} — ${a.spec || '?'} ${a.class || '?'}`).join('\n')
      fields.push({ name: '🔄 Alts', value: altList, inline: false })
    }

    fields.push({ name: '🏰 Experience Raid', value: data.raidExp || 'Non précisé', inline: false })

    if (data.logsUrl) {
      fields.push({ name: '📜 Warcraft Logs', value: `[Voir les logs](${data.logsUrl})`, inline: true })
    }
    if (data.rioUrl) {
      fields.push({ name: '🔑 Raider.io', value: `[Voir le profil](${data.rioUrl})`, inline: true })
    }

    fields.push({ name: '💬 Discord', value: data.discordId ? `<@${data.discordId}> (${data.discord})` : data.discord, inline: true })
    fields.push({ name: '📅 Disponibilités vocal', value: `${data.availability || 'Non précisé'}\nCréneau: ${data.timeSlot}`, inline: false })

    if (data.about) {
      fields.push({ name: '💭 A propos', value: data.about, inline: false })
    }

    const deadline = Math.floor((Date.now() + 48 * 60 * 60 * 1000) / 1000)

    const message = await (channel as any).send({
      embeds: [{
        title: '📋 Nouvelle candidature',
        description: `**${data.charName}** (${data.mainSpec} ${data.mainClass}) postule pour rejoindre la guilde !\n\n🟩 Accepter — 🟧 En attente — 🟥 Refuser\n⏰ Votes ouverts jusqu'au <t:${deadline}:F> (<t:${deadline}:R>)`,
        color,
        fields,
        footer: { text: 'Riposte Guild Tool — Candidatures' },
        timestamp: new Date().toISOString(),
      }],
    })

    // Add vote reactions
    try {
      await message.react('🟩')
      await message.react('🟧')
      await message.react('🟥')
    } catch (reactErr) {
      console.error('[discord-bot] Failed to add reactions to application:', (reactErr as Error).message)
    }

    // Watch for reactions — only allow one per user, remove extras
    const filter = (reaction: any, user: any) => {
      return ['🟩', '🟧', '🟥'].includes(reaction.emoji.name) && !user.bot
    }

    const TIMEOUT_48H = 48 * 60 * 60 * 1000

    const collector = message.createReactionCollector({ filter, dispose: true, time: TIMEOUT_48H })

    collector.on('collect', async (reaction: any, user: any) => {
      // Remove other reactions from this user
      for (const [, otherReaction] of message.reactions.cache) {
        if (otherReaction.emoji.name !== reaction.emoji.name && ['🟩', '🟧', '🟥'].includes(otherReaction.emoji.name ?? '')) {
          try { await otherReaction.users.remove(user.id) } catch { /* skip */ }
        }
      }
    })

    collector.on('end', async () => {
      // Timer expired — lock the votes
      try {
        // Count votes
        const updated = await message.fetch()
        const green = (updated.reactions.cache.get('🟩')?.count ?? 1) - 1
        const orange = (updated.reactions.cache.get('🟧')?.count ?? 1) - 1
        const red = (updated.reactions.cache.get('🟥')?.count ?? 1) - 1

        let result = '⏰ Votes clotures'
        if (green > red && green > orange) result = '✅ Accepte'
        else if (red > green && red > orange) result = '❌ Refuse'
        else if (orange > green && orange > red) result = '🟧 En attente'
        else result = '⏰ Pas de majorite'

        // Edit the embed to show result and lock status
        const embed = updated.embeds[0]
        if (embed) {
          const newEmbed = { ...embed.data }
          newEmbed.description = (newEmbed.description ?? '').replace(
            '🟩 Accepter — 🟧 En attente — 🟥 Refuser',
            `**${result}** (🟩 ${green} — 🟧 ${orange} — 🟥 ${red})\n⏰ Votes clotures apres 48h`
          )
          newEmbed.color = green > red ? 0x22C55E : red > green ? 0xEF4444 : 0xF59E0B
          await message.edit({ embeds: [newEmbed] })
        }

        // Remove all reactions to lock
        try { await message.reactions.removeAll() } catch { /* skip */ }
      } catch (endErr) {
        console.error('[discord-bot] Failed to close application vote:', (endErr as Error).message)
      }
    })

    console.log(`[discord-bot] Application posted for ${data.charName} (votes close in 48h)`)
  } catch (err) {
    console.error('[discord-bot] Failed to post application:', (err as Error).message)
  }
}

export function stopDiscordBot(): void {
  if (client) {
    client.destroy()
    client = null
  }
}
