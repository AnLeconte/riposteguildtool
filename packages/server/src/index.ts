import 'dotenv/config'
import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { simRouter } from './routes/sim.js'
import { characterRouter } from './routes/character.js'
import { dataRouter } from './routes/data.js'
import { authRouter } from './routes/auth.js'
import { wclRouter } from './routes/wcl.js'
import { guildRouter } from './routes/guild.js'
import { raidEventRouter } from './routes/raid-event.js'
import { imageProxyRouter } from './routes/image-proxy.js'
import { guildAuditRouter } from './routes/guild-audit.js'
import { guildAnalyticsRouter } from './routes/guild-analytics.js'
import { raidPlanRouter } from './routes/raid-plan.js'
import { addonSyncRouter } from './routes/addon-sync.js'
import { startDiscordBot, stopDiscordBot } from './services/discord-bot.js'
import { initSocketIO } from './websocket/socket.js'
import { startWorker, stopWorker } from './queue/index.js'

const app = express()
const port = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use('/api/sim', simRouter)
app.use('/api/character', characterRouter)
app.use('/api/data', dataRouter)
app.use('/api/auth', authRouter)
app.use('/api/wcl', wclRouter)
app.use('/api/guild', guildRouter)
app.use('/api/guild', guildAuditRouter)
app.use('/api/guild', guildAnalyticsRouter)
app.use('/api/guild/:realm/:name/events', raidEventRouter)
app.use('/api/raid-plans', raidPlanRouter)
app.use('/api/img', imageProxyRouter)
app.use('/api/addon-sync', addonSyncRouter)

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' })
})

// Guild application endpoint (no auth required)
app.post('/api/apply', express.json(), async (req, res) => {
  try {
    const { postApplication } = await import('./services/discord-bot.js')
    await postApplication(req.body)
    res.json({ success: true })
  } catch (err) {
    console.error('[POST /api/apply]', err)
    res.status(500).json({ success: false, error: 'Failed to submit application' })
  }
})

const httpServer = http.createServer(app)

initSocketIO(httpServer)
startWorker()
startDiscordBot()

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

async function shutdown() {
  console.log('Shutting down...')
  stopDiscordBot()
  await stopWorker()
  httpServer.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
