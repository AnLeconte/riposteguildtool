import jwt from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

const BNET_CLIENT_ID = process.env.BLIZZARD_CLIENT_ID ?? ''
const BNET_CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET ?? ''
const BNET_REDIRECT_URI = process.env.BNET_REDIRECT_URI ?? 'http://localhost:3001/api/auth/bnet/callback'

export interface JwtPayload {
  userId: string
  battleTag: string
}

// ─── Battle.net OAuth ──────────────────────────────────────────────────────────

export function getBnetAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: BNET_CLIENT_ID,
    redirect_uri: BNET_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid wow.profile',
    state,
  })
  return `https://oauth.battle.net/authorize?${params.toString()}`
}

export async function exchangeBnetCode(code: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: BNET_REDIRECT_URI,
    client_id: BNET_CLIENT_ID,
    client_secret: BNET_CLIENT_SECRET,
  })
  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[BNet exchange] FAILED:', res.status, text)
    throw new Error(`Battle.net token exchange failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<{ access_token: string; expires_in: number; token_type: string }>
}

export async function getBnetUserInfo(accessToken: string) {
  const res = await fetch('https://oauth.battle.net/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error(`Battle.net userinfo failed: ${res.status}`)

  return res.json() as Promise<{ sub: string; id: number; battletag: string }>
}

export async function getBnetWowCharacters(accessToken: string, region = 'eu') {
  const res = await fetch(`https://${region}.api.blizzard.com/profile/user/wow?namespace=profile-${region}&locale=en_US`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return []

  const data = await res.json() as {
    wow_accounts?: Array<{
      characters?: Array<{
        name: string
        id: number
        realm: { slug: string; name: string }
        playable_class: { id: number; name: string }
        playable_race: { id: number; name: string }
        level: number
        faction: { type: string }
      }>
    }>
  }

  const CLASS_NAMES: Record<number, string> = {
    1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue', 5: 'Priest',
    6: 'Death Knight', 7: 'Shaman', 8: 'Mage', 9: 'Warlock', 10: 'Monk',
    11: 'Druid', 12: 'Demon Hunter', 13: 'Evoker',
  }

  const characters: Array<{
    name: string
    realm: string
    realmName: string
    class: string
    classId: number
    level: number
    faction: string
  }> = []

  for (const account of data.wow_accounts ?? []) {
    for (const char of account.characters ?? []) {
      characters.push({
        name: char.name,
        realm: char.realm.slug,
        realmName: char.realm.name,
        class: CLASS_NAMES[char.playable_class?.id] ?? char.playable_class?.name ?? 'Unknown',
        classId: char.playable_class?.id,
        level: char.level,
        faction: char.faction?.type ?? 'NEUTRAL',
      })
    }
  }

  // Sort by level desc, then name
  characters.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name))

  return characters
}

// ─── User management ─────────────────────────────────────────────────────────

export async function loginOrCreateFromBnet(bnetId: string, battleTag: string) {
  // Try to find existing user by blizzard_id
  const [existing] = await db.select().from(users).where(eq(users.blizzard_id, bnetId)).limit(1)

  if (existing) {
    // Update battle_tag if changed
    if (existing.battle_tag !== battleTag) {
      await db.update(users).set({ battle_tag: battleTag }).where(eq(users.id, existing.id))
    }
    const token = generateToken(existing.id, battleTag)
    return { user: { id: existing.id, battle_tag: battleTag, blizzard_id: bnetId }, token }
  }

  // Create new user
  const id = uuidv4()
  const [user] = await db.insert(users).values({
    id,
    blizzard_id: bnetId,
    battle_tag: battleTag,
  }).returning()

  const token = generateToken(user.id, battleTag)
  return { user: { id: user.id, battle_tag: user.battle_tag, blizzard_id: user.blizzard_id }, token }
}

export async function getUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) return null
  return { id: user.id, battle_tag: user.battle_tag, blizzard_id: user.blizzard_id, discord_id: user.discord_id }
}

function generateToken(userId: string, battleTag: string): string {
  return jwt.sign({ userId, battleTag } as JwtPayload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}
