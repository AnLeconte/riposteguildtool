import { Router, type Router as RouterType } from 'express'
import { getGuildRoster } from '../services/blizzard-api.js'
import { getCharacterEquipment } from '../services/blizzard-api.js'
import { isBlizzardConfigured } from '../services/loot-data.js'

export const guildAuditRouter: RouterType = Router()

const CLASS_NAMES: Record<number, string> = {
  1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue', 5: 'Priest',
  6: 'Death Knight', 7: 'Shaman', 8: 'Mage', 9: 'Warlock', 10: 'Monk',
  11: 'Druid', 12: 'Demon Hunter', 13: 'Evoker',
}

const ENCHANTABLE_SLOTS = ['BACK', 'CHEST', 'WRIST', 'LEGS', 'FEET', 'FINGER_1', 'FINGER_2', 'MAIN_HAND', 'OFF_HAND']
const SOCKETABLE_SLOTS = ['HEAD', 'NECK', 'WRIST', 'WAIST', 'FINGER_1', 'FINGER_2']

interface AuditResult {
  name: string
  realm: string
  class: string
  classId: number
  ilvl: number
  missingEnchants: string[]
  missingGems: string[]
  issues: number
}

/**
 * GET /api/guild/:realm/:name/audit?region=eu
 * Gear audit — checks enchants and gems for all max-level guild members.
 */
guildAuditRouter.get('/:realm/:name/audit', async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }

  try {
    const realm = req.params.realm.toLowerCase()
    const guild = req.params.name.toLowerCase()
    const region = (req.query.region as string) ?? 'eu'
    const limit = parseInt((req.query.limit as string) ?? '30', 10)

    const roster = await getGuildRoster(realm, guild, region)
    const members = (roster.members ?? []) as Array<{
      character: { name: string; realm: { slug: string }; level: number; playable_class: { id: number } }
      rank: number
    }>

    const maxLevel = members.reduce((max, m) => Math.max(max, m.character?.level ?? 0), 0)
    const eligible = members
      .filter((m) => m.character?.level >= maxLevel)
      .slice(0, limit)

    const results: AuditResult[] = await Promise.all(
      eligible.map(async (m) => {
        const char = m.character
        const result: AuditResult = {
          name: char.name,
          realm: char.realm.slug,
          class: CLASS_NAMES[char.playable_class?.id] ?? 'Unknown',
          classId: char.playable_class?.id,
          ilvl: 0,
          missingEnchants: [],
          missingGems: [],
          issues: 0,
        }

        try {
          const equipment = await getCharacterEquipment(char.realm.slug, char.name, region)
          const items = equipment?.equipped_items ?? []

          // Calculate avg ilvl
          const ilvls = items.map((i: any) => i.level?.value ?? 0).filter((v: number) => v > 0)
          result.ilvl = ilvls.length > 0 ? Math.round(ilvls.reduce((a: number, b: number) => a + b, 0) / ilvls.length) : 0

          // Check enchants
          for (const item of items) {
            const slotType = item.slot?.type as string
            if (ENCHANTABLE_SLOTS.includes(slotType)) {
              const hasEnchant = item.enchantments && item.enchantments.length > 0
              if (!hasEnchant) {
                result.missingEnchants.push(slotType.toLowerCase().replace(/_/g, ' '))
              }
            }
          }

          // Check gems (items with sockets)
          for (const item of items) {
            if (item.sockets && item.sockets.length > 0) {
              for (const socket of item.sockets) {
                if (!socket.item) {
                  const slotType = (item.slot?.type as string) ?? 'unknown'
                  result.missingGems.push(slotType.toLowerCase().replace(/_/g, ' '))
                }
              }
            }
          }

          result.issues = result.missingEnchants.length + result.missingGems.length
        } catch { /* skip — character might be private */ }

        return result
      }),
    )

    // Sort by issues descending (worst first)
    results.sort((a, b) => b.issues - a.issues)

    res.json({
      success: true,
      data: {
        guild: roster.guild?.name ?? guild,
        memberCount: results.length,
        results,
      },
    })
  } catch (err) {
    console.error('[GET /guild/:realm/:name/audit]', err)
    res.status(500).json({ success: false, error: 'Failed to audit guild gear' })
  }
})
