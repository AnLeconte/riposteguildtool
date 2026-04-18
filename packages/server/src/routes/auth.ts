import { Router, type Router as RouterType } from 'express'
import crypto from 'crypto'
import { requireAuth } from '../middleware/auth.js'
import {
  getBnetAuthorizeUrl,
  exchangeBnetCode,
  getBnetUserInfo,
  getBnetWowCharacters,
  loginOrCreateFromBnet,
  getUserById,
} from '../services/auth.js'
import { linkDiscord, unlinkDiscord } from '../services/discord-link.js'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export const authRouter: RouterType = Router()

// In-memory state store for CSRF protection (short-lived)
const pendingStates = new Map<string, number>()

setInterval(() => {
  const now = Date.now()
  for (const [state, ts] of pendingStates) {
    if (now - ts > 10 * 60 * 1000) pendingStates.delete(state)
  }
}, 5 * 60 * 1000)

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

/**
 * GET /api/auth/bnet
 * Redirects to Battle.net OAuth authorize page.
 */
authRouter.get('/bnet', (_req, res) => {
  const state = crypto.randomBytes(16).toString('hex')
  pendingStates.set(state, Date.now())
  const url = getBnetAuthorizeUrl(state)
  res.json({ success: true, data: { url, state } })
})

/**
 * GET /api/auth/bnet/callback
 * Blizzard redirects here directly. Server exchanges code, then redirects browser to frontend.
 */
authRouter.get('/bnet/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined
    const state = req.query.state as string | undefined
    const errorParam = req.query.error as string | undefined

    if (errorParam) {
      res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(errorParam)}`)
      return
    }

    if (!code) {
      res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent('No authorization code')}`)
      return
    }

    // Validate state
    if (state && pendingStates.size > 0 && !pendingStates.has(state)) {
      res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent('Invalid state')}`)
      return
    }
    if (state) pendingStates.delete(state)

    // Exchange code for access token (immediately — no frontend roundtrip delay)
    const tokenData = await exchangeBnetCode(code)

    const userInfo = await getBnetUserInfo(tokenData.access_token)

    // Fetch WoW characters
    const region = (req.query.region as string) ?? 'eu'
    let wowCharacters: any[] = []
    try {
      wowCharacters = await getBnetWowCharacters(tokenData.access_token, region)
    } catch { /* skip */ }

    // Create or update user in DB
    const result = await loginOrCreateFromBnet(
      userInfo.sub ?? String(userInfo.id),
      userInfo.battletag,
    )

    // Store characters temporarily for the frontend to pick up
    const charData = encodeURIComponent(JSON.stringify(wowCharacters.slice(0, 30)))

    // Redirect to frontend with JWT token
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${result.token}&user=${encodeURIComponent(JSON.stringify(result.user))}&characters=${charData}`)
  } catch (err) {
    console.error('[GET /auth/bnet/callback]', err)
    const message = err instanceof Error ? err.message : 'Authentication failed'
    res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(message)}`)
  }
})

/**
 * POST /api/auth/bnet/callback (legacy — kept for compatibility)
 */
authRouter.post('/bnet/callback', async (req, res) => {
  try {
    const { code, state } = req.body as { code?: string; state?: string }
    if (!code) {
      res.status(400).json({ success: false, error: 'Authorization code required' })
      return
    }

    if (state && pendingStates.size > 0 && !pendingStates.has(state)) {
      res.status(400).json({ success: false, error: 'Invalid state parameter' })
      return
    }
    if (state) pendingStates.delete(state)

    const tokenData = await exchangeBnetCode(code)
    const userInfo = await getBnetUserInfo(tokenData.access_token)

    const region = (req.body.region as string) ?? 'eu'
    let wowCharacters: any[] = []
    try {
      wowCharacters = await getBnetWowCharacters(tokenData.access_token, region)
    } catch { /* skip */ }

    const result = await loginOrCreateFromBnet(
      userInfo.sub ?? String(userInfo.id),
      userInfo.battletag,
    )

    res.json({ success: true, data: { ...result, characters: wowCharacters } })
  } catch (err) {
    console.error('[POST /auth/bnet/callback]', err)
    const message = err instanceof Error ? err.message : 'Authentication failed'
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * GET /api/auth/me
 */
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.user!.userId)
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }
    res.json({ success: true, data: user })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * GET /api/auth/discord
 * Redirects to Discord OAuth2 to link account.
 */
authRouter.get('/discord', requireAuth, (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    res.status(503).json({ success: false, error: 'Discord OAuth not configured' })
    return
  }

  const state = `${req.user!.userId}:${crypto.randomBytes(8).toString('hex')}`
  pendingStates.set(state, Date.now())

  const redirectUri = process.env.DISCORD_REDIRECT_URI ?? 'http://localhost:3001/api/auth/discord/callback'
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
  })

  res.json({ success: true, data: { url: `https://discord.com/oauth2/authorize?${params}` } })
})

/**
 * GET /api/auth/discord/callback
 * Discord redirects here after OAuth. Exchanges code for user info and links the account.
 */
authRouter.get('/discord/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined
    const state = req.query.state as string | undefined
    const error = req.query.error as string | undefined

    if (error) {
      res.redirect(`${FRONTEND_URL}/?discord_error=${encodeURIComponent(error)}`)
      return
    }

    if (!code || !state) {
      res.redirect(`${FRONTEND_URL}/?discord_error=missing_params`)
      return
    }

    // Extract userId from state
    const userId = state.split(':')[0]
    if (!userId) {
      res.redirect(`${FRONTEND_URL}/?discord_error=invalid_state`)
      return
    }

    // Exchange code for token
    const redirectUri = process.env.DISCORD_REDIRECT_URI ?? 'http://localhost:3001/api/auth/discord/callback'
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      res.redirect(`${FRONTEND_URL}/?discord_error=token_exchange_failed`)
      return
    }

    const tokenData = await tokenRes.json() as { access_token: string }

    // Get Discord user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userRes.ok) {
      res.redirect(`${FRONTEND_URL}/?discord_error=user_fetch_failed`)
      return
    }

    const discordUser = await userRes.json() as { id: string; username: string; global_name?: string }

    // Link Discord to user
    await linkDiscord(userId, discordUser.id)

    res.redirect(`${FRONTEND_URL}/?discord_linked=${encodeURIComponent(discordUser.global_name ?? discordUser.username)}`)
  } catch (err) {
    console.error('[GET /auth/discord/callback]', err)
    res.redirect(`${FRONTEND_URL}/?discord_error=internal_error`)
  }
})

/**
 * GET /api/auth/discord-apply
 * Discord OAuth for guild application (no auth required)
 */
authRouter.get('/discord-apply', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    res.status(503).json({ success: false, error: 'Discord OAuth not configured' })
    return
  }
  const redirectUri = process.env.DISCORD_APPLY_REDIRECT_URI ?? `${FRONTEND_URL.replace('5173', '3001')}/api/auth/discord-apply/callback`
  const state = `apply:${crypto.randomBytes(8).toString('hex')}`
  pendingStates.set(state, Date.now())
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
  })
  res.redirect(`https://discord.com/oauth2/authorize?${params}`)
})

/**
 * GET /api/auth/discord-apply/callback
 */
authRouter.get('/discord-apply/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined
    const error = req.query.error as string | undefined

    if (error || !code) {
      res.redirect(`${FRONTEND_URL}/apply?discord_error=true`)
      return
    }

    const redirectUri = process.env.DISCORD_APPLY_REDIRECT_URI ?? `${FRONTEND_URL.replace('5173', '3001')}/api/auth/discord-apply/callback`
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      res.redirect(`${FRONTEND_URL}/apply?discord_error=token_failed`)
      return
    }

    const tokenData = await tokenRes.json() as { access_token: string }
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userRes.ok) {
      res.redirect(`${FRONTEND_URL}/apply?discord_error=user_failed`)
      return
    }

    const discordUser = await userRes.json() as { id: string; username: string; global_name?: string; avatar?: string }
    const userData = Buffer.from(JSON.stringify({
      id: discordUser.id,
      username: discordUser.global_name ?? discordUser.username,
      avatar: discordUser.avatar,
    })).toString('base64')

    res.redirect(`${FRONTEND_URL}/apply?discord_user=${userData}`)
  } catch (err) {
    console.error('[GET /auth/discord-apply/callback]', err)
    res.redirect(`${FRONTEND_URL}/apply?discord_error=internal`)
  }
})

/**
 * PUT /api/auth/main-character
 * Save the active character to the user profile.
 */
authRouter.put('/main-character', requireAuth, async (req, res) => {
  try {
    const { name, realm, region, class: wowClass, spec } = req.body
    if (!name || !wowClass) {
      res.status(400).json({ success: false, error: 'name and class required' })
      return
    }
    await db.update(users)
      .set({ main_character: { name, realm, region, class: wowClass, spec } })
      .where(eq(users.id, req.user!.userId))
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save character' })
  }
})

/**
 * DELETE /api/auth/link-discord
 * Unlink Discord from the current user.
 */
authRouter.delete('/link-discord', requireAuth, async (req, res) => {
  try {
    await unlinkDiscord(req.user!.userId)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to unlink Discord' })
  }
})
