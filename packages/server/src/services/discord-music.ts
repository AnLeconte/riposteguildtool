import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  type VoiceConnection,
  type AudioPlayer,
} from '@discordjs/voice'
import type { Message, GuildMember, VoiceBasedChannel } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { Readable } from 'stream'
import { spawn, execFile } from 'child_process'

const PREFIX = 'r!'

interface QueueItem {
  url: string
  title: string
  duration: string
  requestedBy: string
}

interface GuildPlayer {
  connection: VoiceConnection
  player: AudioPlayer
  queue: QueueItem[]
  current: QueueItem | null
  volume: number
}

const players = new Map<string, GuildPlayer>()

function cleanUrl(url: string): string {
  // Remove playlist params to avoid yt-dlp scanning entire playlists
  try {
    const u = new URL(url)
    u.searchParams.delete('list')
    u.searchParams.delete('index')
    u.searchParams.delete('start_radio')
    return u.toString()
  } catch {
    return url
  }
}

function getVideoInfo(url: string): Promise<{ title: string; duration: string }> {
  const cleanedUrl = cleanUrl(url)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill()
      reject(new Error('yt-dlp timeout (15s)'))
    }, 15_000)

    const proc = execFile('yt-dlp', [
      '--dump-single-json',
      '--no-check-certificates',
      '--no-warnings',
      '--no-playlist',
      '--skip-download',
      cleanedUrl,
    ], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      clearTimeout(timeout)
      if (err) {
        console.error('[music] yt-dlp error:', stderr || err.message)
        return reject(err)
      }
      try {
        const info = JSON.parse(stdout)
        const dur = info.duration ?? 0
        const mins = Math.floor(dur / 60)
        const secs = Math.floor(dur % 60)
        resolve({
          title: info.title ?? 'Unknown',
          duration: `${mins}:${secs.toString().padStart(2, '0')}`,
        })
      } catch (e) {
        reject(e)
      }
    })
  })
}

function createYtdlpStream(url: string): Readable {
  const cleanedUrl = cleanUrl(url)

  // First get the direct audio URL from yt-dlp, then let ffmpeg stream it
  const ytdlpProc = spawn('yt-dlp', [
    '-f', 'bestaudio',
    '--no-check-certificates',
    '--no-warnings',
    '--no-playlist',
    '--get-url',
    cleanedUrl,
  ], { stdio: ['ignore', 'pipe', 'pipe'] })

  let directUrl = ''
  ytdlpProc.stdout.on('data', (chunk: Buffer) => { directUrl += chunk.toString() })
  ytdlpProc.stderr.on('data', (chunk: Buffer) => {
    console.error('[music] yt-dlp stderr:', chunk.toString().trim())
  })

  const passthrough = new Readable({ read() {} })

  ytdlpProc.on('close', (code) => {
    directUrl = directUrl.trim()
    if (!directUrl || code !== 0) {
      console.error('[music] yt-dlp failed, exit code:', code)
      passthrough.destroy()
      return
    }
    console.log('[music] Got direct URL, starting ffmpeg...')

    const ffmpegProc = spawn('ffmpeg', [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', directUrl,
      '-analyzeduration', '0',
      '-loglevel', 'warning',
      '-c:a', 'libopus',
      '-f', 'ogg',
      '-ar', '48000',
      '-ac', '2',
      '-b:a', '96k',
      'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    ffmpegProc.stdout.on('data', (chunk: Buffer) => {
      passthrough.push(chunk)
    })
    ffmpegProc.stdout.on('end', () => {
      passthrough.push(null)
    })
    ffmpegProc.stderr.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim()
      if (msg) console.error('[music] ffmpeg:', msg)
    })
    ffmpegProc.on('error', (err) => {
      console.error('[music] ffmpeg error:', err.message)
      passthrough.destroy()
    })
  })

  ytdlpProc.on('error', (err) => {
    console.error('[music] yt-dlp error:', err.message)
    passthrough.destroy()
  })

  return passthrough
}

async function playNext(guildId: string): Promise<void> {
  const gp = players.get(guildId)
  if (!gp) return

  if (gp.queue.length === 0) {
    gp.current = null
    setTimeout(() => {
      const g = players.get(guildId)
      if (g && !g.current && g.queue.length === 0) {
        g.connection.destroy()
        players.delete(guildId)
      }
    }, 120_000)
    return
  }

  const item = gp.queue.shift()!
  gp.current = item

  try {
    const stream = createYtdlpStream(item.url)
    const resource = createAudioResource(stream, {
      inputType: StreamType.OggOpus,
      inlineVolume: false,
    })
    gp.player.play(resource)
  } catch (err) {
    console.error('[music] Failed to play:', err)
    playNext(guildId)
  }
}

function getOrCreatePlayer(channel: VoiceBasedChannel): GuildPlayer {
  const guildId = channel.guild.id
  const existing = players.get(guildId)
  if (existing) return existing

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  })

  const player = createAudioPlayer()
  connection.subscribe(player)

  player.on(AudioPlayerStatus.Idle, () => {
    playNext(guildId)
  })

  player.on('error', (err) => {
    console.error('[music] Player error:', err.message)
    playNext(guildId)
  })

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ])
    } catch {
      connection.destroy()
      players.delete(guildId)
    }
  })

  const gp: GuildPlayer = { connection, player, queue: [], current: null, volume: 50 }
  players.set(guildId, gp)
  return gp
}

// ─── Prefix command handler ─────────────────────────────────────────────────

export async function handleMusicMessage(message: Message): Promise<boolean> {
  if (!message.content.startsWith(PREFIX)) return false
  if (message.author.bot || !message.guild) return false

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/)
  const cmd = args.shift()?.toLowerCase()
  if (!cmd) return false

  switch (cmd) {
    case 'play':
    case 'p':
      await cmdPlay(message, args)
      return true
    case 'skip':
    case 's':
      await cmdSkip(message)
      return true
    case 'stop':
    case 'leave':
    case 'dc':
      await cmdStop(message)
      return true
    case 'queue':
    case 'q':
      await cmdQueue(message)
      return true
    case 'np':
    case 'nowplaying':
      await cmdNowPlaying(message)
      return true
    case 'volume':
    case 'vol':
    case 'v':
      await cmdVolume(message, args)
      return true
    case 'help':
    case 'music':
      await cmdHelp(message)
      return true
    default:
      return false
  }
}

async function cmdPlay(message: Message, args: string[]): Promise<void> {
  const url = args[0]
  if (!url) {
    await message.reply('Usage: `r!play <lien YouTube>`')
    return
  }

  const member = message.member as GuildMember
  if (!member.voice.channel) {
    await message.reply('Rejoins un salon vocal d\'abord.')
    return
  }

  const loading = await message.reply('Chargement...')

  try {
    console.log('[music] Fetching info for:', url)
    const info = await getVideoInfo(url)
    console.log('[music] Got info:', info.title, info.duration)

    console.log('[music] Joining voice channel:', member.voice.channel.name)
    const gp = getOrCreatePlayer(member.voice.channel)
    console.log('[music] Player ready')

    const item: QueueItem = {
      url,
      title: info.title,
      duration: info.duration,
      requestedBy: member.displayName,
    }

    if (gp.current) {
      gp.queue.push(item)
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Ajouté à la file')
        .setDescription(`**${info.title}** (${info.duration})`)
        .setFooter({ text: `Position #${gp.queue.length} · Demandé par ${member.displayName}` })
      await loading.edit({ content: '', embeds: [embed] })
    } else {
      gp.queue.push(item)
      console.log('[music] Starting playback...')
      await playNext(message.guildId!)
      console.log('[music] Playback started')
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('En lecture')
        .setDescription(`**${info.title}** (${info.duration})`)
        .setFooter({ text: `Demandé par ${member.displayName}` })
      await loading.edit({ content: '', embeds: [embed] })
    }
  } catch (err: any) {
    console.error('[music] Play error:', err?.message ?? err)
    await loading.edit('Impossible de lire cette URL.').catch(() => {})
  }
}

async function cmdSkip(message: Message): Promise<void> {
  const gp = players.get(message.guildId!)
  if (!gp || !gp.current) {
    await message.reply('Rien en lecture.')
    return
  }

  const skipped = gp.current.title
  gp.player.stop()
  await message.reply(`Skipped **${skipped}**`)
}

async function cmdStop(message: Message): Promise<void> {
  const gp = players.get(message.guildId!)
  if (!gp) {
    await message.reply('Pas connecté.')
    return
  }

  gp.queue.length = 0
  gp.current = null
  gp.player.stop()
  gp.connection.destroy()
  players.delete(message.guildId!)
  await message.reply('Musique arrêtée, à plus.')
}

async function cmdQueue(message: Message): Promise<void> {
  const gp = players.get(message.guildId!)
  if (!gp || (!gp.current && gp.queue.length === 0)) {
    await message.reply('La file est vide.')
    return
  }

  const lines: string[] = []
  if (gp.current) {
    lines.push(`▶ **${gp.current.title}** (${gp.current.duration})`)
  }
  gp.queue.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.title} (${item.duration}) — *${item.requestedBy}*`)
  })

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('File d\'attente')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${gp.queue.length} titre${gp.queue.length !== 1 ? 's' : ''} en attente` })

  await message.reply({ embeds: [embed] })
}

async function cmdNowPlaying(message: Message): Promise<void> {
  const gp = players.get(message.guildId!)
  if (!gp || !gp.current) {
    await message.reply('Rien en lecture.')
    return
  }

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('En lecture')
    .setDescription(`**${gp.current.title}** (${gp.current.duration})`)
    .setFooter({ text: `Demandé par ${gp.current.requestedBy} · Volume: ${gp.volume}%` })

  await message.reply({ embeds: [embed] })
}

async function cmdVolume(message: Message, args: string[]): Promise<void> {
  const gp = players.get(message.guildId!)
  if (!gp) {
    await message.reply('Pas connecté.')
    return
  }

  const vol = parseInt(args[0], 10)
  if (isNaN(vol) || vol < 0 || vol > 100) {
    await message.reply('Usage: `r!volume <0-100>`')
    return
  }

  gp.volume = vol
  const resource = (gp.player as any)._state?.resource
  if (resource?.volume) {
    resource.volume.setVolume(gp.volume / 100)
  }

  await message.reply(`Volume réglé à **${gp.volume}%**`)
}

async function cmdHelp(message: Message): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Riposte Music')
    .setDescription([
      '`r!play <url>` — Joue une musique YouTube',
      '`r!skip` — Passe au suivant',
      '`r!stop` — Arrête et quitte le vocal',
      '`r!queue` — Affiche la file d\'attente',
      '`r!np` — Musique en cours',
      '`r!volume <0-100>` — Règle le volume',
      '`r!help` — Cette aide',
    ].join('\n'))

  await message.reply({ embeds: [embed] })
}
