interface BlizzardToken {
  access_token: string
  expires_at: number
}

let cachedToken: BlizzardToken | null = null

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60000) {
    return cachedToken.access_token
  }

  const clientId = process.env.BLIZZARD_CLIENT_ID
  const clientSecret = process.env.BLIZZARD_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Blizzard API credentials not configured')

  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) throw new Error(`Blizzard auth failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.access_token
}

// ─── In-memory response cache ─────────────────────────────────────────────────
const apiCache = new Map<string, { data: any; fetchedAt: number }>()
const API_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h — Blizzard game data is static per patch

// ─── Concurrency limiter ──────────────────────────────────────────────────────
const MAX_CONCURRENT = 10
let activeRequests = 0
const requestQueue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    requestQueue.push(resolve)
  })
}

function releaseSlot(): void {
  activeRequests--
  const next = requestQueue.shift()
  if (next) {
    activeRequests++
    next()
  }
}

async function blizzardGet(path: string, region = 'us'): Promise<any> {
  const cacheKey = `${region}:${path}`

  // Check cache
  const cached = apiCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < API_CACHE_TTL) {
    return cached.data
  }

  await acquireSlot()
  try {
    const token = await getToken()
    const url = `https://${region}.api.blizzard.com${path}`
    const separator = path.includes('?') ? '&' : '?'
    const fullUrl = `${url}${separator}namespace=static-${region}&locale=en_US`

    let res = await fetch(fullUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    // Retry on 429 (rate limited) or 5xx (server error)
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = res.status === 429
        ? parseInt(res.headers.get('retry-after') ?? '1', 10)
        : 2
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      res = await fetch(fullUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }

    if (!res.ok) throw new Error(`Blizzard API error: ${res.status}`)
    const data = await res.json()

    // Cache the response
    apiCache.set(cacheKey, { data, fetchedAt: Date.now() })

    return data
  } finally {
    releaseSlot()
  }
}

// Get journal instance (raid/dungeon) index
export async function getJournalInstances(region?: string): Promise<any> {
  return blizzardGet('/data/wow/journal-instance/index', region)
}

// Get specific journal instance (includes encounters/bosses)
export async function getJournalInstance(instanceId: number, region?: string): Promise<any> {
  return blizzardGet(`/data/wow/journal-instance/${instanceId}`, region)
}

// Get encounter (boss) details including loot
export async function getJournalEncounter(encounterId: number, region?: string, difficultyId?: number): Promise<any> {
  const path = difficultyId
    ? `/data/wow/journal-encounter/${encounterId}?difficulty=${difficultyId}`
    : `/data/wow/journal-encounter/${encounterId}`
  return blizzardGet(path, region)
}

// Get item details
export async function getItem(itemId: number, region?: string): Promise<any> {
  return blizzardGet(`/data/wow/item/${itemId}`, region)
}

// Get item media (icon)
export async function getItemMedia(itemId: number, region?: string): Promise<any> {
  return blizzardGet(`/data/wow/media/item/${itemId}`, region)
}

// Get journal instance media (raid/dungeon image)
export async function getInstanceMedia(instanceId: number, region?: string): Promise<any> {
  return blizzardGet(`/data/wow/media/journal-instance/${instanceId}`, region)
}

// ─── Dynamic namespace endpoints (season-dependent data) ──────────────────────

export async function blizzardGetDynamic(path: string, region = 'us'): Promise<any> {
  const cacheKey = `dynamic:${region}:${path}`

  const cached = apiCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < API_CACHE_TTL) {
    return cached.data
  }

  await acquireSlot()
  try {
    const token = await getToken()
    const url = `https://${region}.api.blizzard.com${path}`
    const separator = path.includes('?') ? '&' : '?'
    const fullUrl = `${url}${separator}namespace=dynamic-${region}&locale=en_US`

    let res = await fetch(fullUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = res.status === 429
        ? parseInt(res.headers.get('retry-after') ?? '1', 10)
        : 2
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      res = await fetch(fullUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }

    if (!res.ok) throw new Error(`Blizzard API error: ${res.status}`)
    const data = await res.json()

    apiCache.set(cacheKey, { data, fetchedAt: Date.now() })
    return data
  } finally {
    releaseSlot()
  }
}

// Get current M+ dungeon pool
export async function getMythicKeystoneDungeons(region?: string): Promise<any> {
  return blizzardGetDynamic('/data/wow/mythic-keystone/dungeon/index', region)
}

// ─── Profile namespace endpoints ──────────────────────────────────────────────

async function blizzardGetProfile(path: string, region = 'us'): Promise<any> {
  const cacheKey = `profile:${region}:${path}`
  const cached = apiCache.get(cacheKey)
  // Short TTL for profile data (10 min) — changes frequently
  if (cached && Date.now() - cached.fetchedAt < 10 * 60 * 1000) {
    return cached.data
  }

  await acquireSlot()
  try {
    const token = await getToken()
    const url = `https://${region}.api.blizzard.com${path}`
    const separator = path.includes('?') ? '&' : '?'
    const fullUrl = `${url}${separator}namespace=profile-${region}&locale=en_US`

    let res = await fetch(fullUrl, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = res.status === 429 ? parseInt(res.headers.get('retry-after') ?? '1', 10) : 2
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      res = await fetch(fullUrl, { headers: { Authorization: `Bearer ${token}` } })
    }

    if (!res.ok) throw new Error(`Blizzard API error: ${res.status}`)
    const data = await res.json()
    apiCache.set(cacheKey, { data, fetchedAt: Date.now() })
    return data
  } finally {
    releaseSlot()
  }
}

// Get guild roster
export async function getGuildRoster(realm: string, guild: string, region?: string): Promise<any> {
  return blizzardGetProfile(`/data/wow/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/roster`, region)
}

// Get character M+ profile (current period best runs)
export async function getCharacterMythicPlus(realm: string, name: string, region?: string): Promise<any> {
  return blizzardGetProfile(`/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(name.toLowerCase())}/mythic-keystone-profile`, region)
}

// Get character M+ season details
export async function getCharacterMythicPlusSeason(realm: string, name: string, seasonId: number, region?: string): Promise<any> {
  return blizzardGetProfile(`/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(name.toLowerCase())}/mythic-keystone-profile/season/${seasonId}`, region)
}

// Get character profile summary (name, race, class, spec, ilvl, achievement points)
export async function getCharacterProfile(realm: string, name: string, region?: string): Promise<any> {
  return blizzardGetProfile(`/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(name.toLowerCase())}`, region)
}

// Get character equipment (gear by slot with enchants, gems, ilvl)
export async function getCharacterEquipment(realm: string, name: string, region?: string): Promise<any> {
  return blizzardGetProfile(`/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(name.toLowerCase())}/equipment`, region)
}

// Get character specializations (active spec + talents)
export async function getCharacterSpecializations(realm: string, name: string, region?: string): Promise<any> {
  return blizzardGetProfile(`/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(name.toLowerCase())}/specializations`, region)
}

// Get character media (avatar/render)
export async function getCharacterMedia(realm: string, name: string, region?: string): Promise<any> {
  return blizzardGetProfile(`/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(name.toLowerCase())}/character-media`, region)
}

// Get guild achievements
export async function getGuildAchievements(realm: string, guild: string, region?: string): Promise<any> {
  return blizzardGetProfile(`/data/wow/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/achievements`, region)
}

// Get current M+ affixes
export async function getCurrentAffixes(region?: string): Promise<any> {
  return blizzardGetDynamic('/data/wow/mythic-keystone/period/index', region)
}

// Get specific M+ period
export async function getMythicKeystonePeriod(periodId: number, region?: string): Promise<any> {
  return blizzardGetDynamic(`/data/wow/mythic-keystone/period/${periodId}`, region)
}

// Get spell media (icon)
export async function getSpellMedia(spellId: number, region?: string): Promise<any> {
  return blizzardGet(`/data/wow/media/spell/${spellId}`, region)
}

// Get playable class media (icon)
export async function getClassMedia(classId: number, region?: string): Promise<any> {
  return blizzardGet(`/data/wow/media/playable-class/${classId}`, region)
}

// Get playable specialization media (icon)
export async function getSpecMedia(specId: number, region?: string): Promise<any> {
  return blizzardGet(`/data/wow/media/playable-specialization/${specId}`, region)
}

