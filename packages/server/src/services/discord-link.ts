/**
 * Discord ↔ WoW character linking.
 * Resolves a Discord user ID to their main WoW character.
 */

import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export interface LinkedCharacter {
  name: string
  realm: string
  region: string
  class: string
  spec: string
  role: string
}

const CLASS_ROLES: Record<string, string> = {
  Warrior: 'dps', Paladin: 'dps', Hunter: 'dps', Rogue: 'dps',
  Priest: 'healer', 'Death Knight': 'dps', Shaman: 'dps', Mage: 'dps',
  Warlock: 'dps', Monk: 'dps', Druid: 'dps', 'Demon Hunter': 'dps',
  Evoker: 'dps',
}

// Specs that are tanks/healers
const TANK_SPECS = ['Protection', 'Blood', 'Vengeance', 'Guardian', 'Brewmaster']
const HEALER_SPECS = ['Holy', 'Discipline', 'Restoration', 'Mistweaver', 'Preservation']

function guessRole(wowClass: string, spec?: string): string {
  if (spec && TANK_SPECS.includes(spec)) return 'tank'
  if (spec && HEALER_SPECS.includes(spec)) return 'healer'
  return CLASS_ROLES[wowClass] ?? 'dps'
}

/**
 * Find the main WoW character for a Discord user.
 * Returns null if no link exists.
 */
export async function getLinkedCharacter(discordId: string): Promise<LinkedCharacter | null> {
  const [user] = await db.select()
    .from(users)
    .where(eq(users.discord_id, discordId))
    .limit(1)

  if (!user) return null

  const char = user.main_character as any
  if (!char?.name || !char?.class) return null

  return {
    name: char.name,
    realm: char.realm ?? '',
    region: char.region ?? 'eu',
    class: char.class,
    spec: char.spec ?? '',
    role: guessRole(char.class, char.spec ?? undefined),
  }
}

/**
 * Link a Discord ID to a user account.
 */
export async function linkDiscord(userId: string, discordId: string): Promise<void> {
  await db.update(users)
    .set({ discord_id: discordId })
    .where(eq(users.id, userId))
}

/**
 * Unlink Discord from a user account.
 */
export async function unlinkDiscord(userId: string): Promise<void> {
  await db.update(users)
    .set({ discord_id: null })
    .where(eq(users.id, userId))
}
