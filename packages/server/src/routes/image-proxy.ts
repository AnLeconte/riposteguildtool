import { Router, type Router as RouterType } from 'express'

export const imageProxyRouter: RouterType = Router()

// In-memory image cache (survives requests, cleared on server restart)
const imageCache = new Map<string, { buffer: Buffer; contentType: string; fetchedAt: number }>()
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days — game images rarely change

/**
 * GET /api/img?url=https://render.worldofwarcraft.com/...
 * Proxies and caches external images (Blizzard renders, Raider.io icons, etc.)
 * Returns the image with aggressive cache headers.
 */
imageProxyRouter.get('/', async (req, res) => {
  const url = req.query.url as string | undefined
  if (!url) {
    res.status(400).json({ error: 'url query param required' })
    return
  }

  // Only allow known image domains
  const allowed = [
    'render.worldofwarcraft.com',
    'render-eu.worldofwarcraft.com',
    'render-us.worldofwarcraft.com',
    'wow.zamimg.com',
    'cdnassets.raider.io',
    'raider.io',
  ]
  try {
    const parsed = new URL(url)
    if (!allowed.some((d) => parsed.hostname.endsWith(d))) {
      res.status(403).json({ error: 'Domain not allowed' })
      return
    }
  } catch {
    res.status(400).json({ error: 'Invalid URL' })
    return
  }

  // Check cache
  const cached = imageCache.get(url)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    res.set('Content-Type', cached.contentType)
    res.set('Cache-Control', 'public, max-age=604800, immutable') // 7 days
    res.send(cached.buffer)
    return
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      res.status(response.status).json({ error: `Upstream error: ${response.status}` })
      return
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const buffer = Buffer.from(await response.arrayBuffer())

    // Cache in memory (limit to ~100MB total)
    if (imageCache.size < 5000) {
      imageCache.set(url, { buffer, contentType, fetchedAt: Date.now() })
    }

    res.set('Content-Type', contentType)
    res.set('Cache-Control', 'public, max-age=604800, immutable')
    res.send(buffer)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch image' })
  }
})

// Cleanup old entries every hour
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of imageCache) {
    if (now - val.fetchedAt > CACHE_TTL) imageCache.delete(key)
  }
}, 60 * 60 * 1000)
