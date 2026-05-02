import { Router } from 'express'
import { getGuildRoster, getCharacterEquipment } from '../services/blizzard-api.js'
import { getRioGuildTopMembers } from '../services/raiderio-api.js'
import { db } from '../db/index.js'
import { raid_events, raid_signups, ilvl_history } from '../db/schema.js'
import { eq, and, gte, desc, sql } from 'drizzle-orm'

const router = Router()

const ENCHANTABLE_SLOTS = new Set([
  'HEAD', 'BACK', 'CHEST', 'WRIST', 'LEGS', 'FEET',
  'FINGER_1', 'FINGER_2', 'MAIN_HAND',
])

interface AuditIssue {
  player: string
  class: string
  issues: string[]
}

// GET /api/gm/dashboard?realm=xxx&guild=xxx&region=eu
router.get('/dashboard', async (req, res) => {
  const realm = (req.query.realm as string) ?? ''
  const guild = (req.query.guild as string) ?? ''
  const region = (req.query.region as string) ?? 'eu'

  if (!realm || !guild) {
    return res.json({ success: true, data: { error: 'Missing realm or guild' } })
  }

  try {
    const results: Record<string, any> = {}

    // 1. Roster with gear audit
    try {
      const rosterData = await getGuildRoster(realm, guild, region)
      const members = (rosterData.members ?? [])
        .filter((m: any) => m.character?.level >= 80)
        .map((m: any) => ({
          name: m.character?.name,
          class: m.character?.playable_class?.name,
          classId: m.character?.playable_class?.id,
          level: m.character?.level,
          rank: m.rank,
          realm: m.character?.realm?.slug,
        }))
        .sort((a: any, b: any) => a.rank - b.rank)

      results.roster = members
      results.rosterCount = members.length

      // Gear audit — check first 30 members for enchants/gems
      const auditPromises = members.slice(0, 30).map(async (m: any) => {
        try {
          const equip = await getCharacterEquipment(m.realm ?? realm, m.name.toLowerCase(), region)
          const items = equip?.equipped_items ?? []
          const issues: string[] = []

          // Check enchants
          const missingEnchants: string[] = []
          for (const item of items) {
            const slotType = item?.slot?.type
            if (!slotType || !ENCHANTABLE_SLOTS.has(slotType)) continue
            if (!item.enchantments || item.enchantments.length === 0) {
              missingEnchants.push(slotType.toLowerCase().replace(/_/g, ' '))
            }
          }
          if (missingEnchants.length > 0) {
            issues.push(`Missing enchants: ${missingEnchants.join(', ')}`)
          }

          // Check empty gem sockets
          const emptyGems: string[] = []
          for (const item of items) {
            if (item.sockets) {
              const empty = item.sockets.filter((s: any) => !s.item)
              if (empty.length > 0) {
                emptyGems.push(item.slot?.type?.toLowerCase().replace(/_/g, ' ') ?? 'unknown')
              }
            }
          }
          if (emptyGems.length > 0) {
            issues.push(`Empty gem sockets: ${emptyGems.join(', ')}`)
          }

          // Check ilvl
          const avgIlvl = items.length > 0
            ? Math.round(items.reduce((sum: number, i: any) => sum + (i.level?.value ?? 0), 0) / items.length)
            : 0

          return {
            player: m.name,
            class: m.class,
            ilvl: avgIlvl,
            issues,
          }
        } catch {
          return null
        }
      })

      const auditResults = (await Promise.all(auditPromises)).filter(Boolean)
      results.gearAudit = auditResults.filter((a: any) => a.issues.length > 0)
      results.ilvlRanking = auditResults
        .filter((a: any) => a.ilvl > 0)
        .sort((a: any, b: any) => b.ilvl - a.ilvl)
    } catch (err) {
      results.rosterError = 'Failed to load roster'
    }

    // 2. Raid attendance (last 30 days)
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
      const events = await db
        .select()
        .from(raid_events)
        .where(
          and(
            eq(raid_events.guild_realm, realm),
            gte(raid_events.starts_at, thirtyDaysAgo),
          )
        )
        .orderBy(desc(raid_events.starts_at))

      const attendance: Record<string, { present: number; absent: number; total: number }> = {}

      for (const event of events) {
        const signups = await db
          .select()
          .from(raid_signups)
          .where(eq(raid_signups.event_id, event.id))

        for (const signup of signups) {
          const name = signup.character_name
          if (!attendance[name]) attendance[name] = { present: 0, absent: 0, total: 0 }
          attendance[name].total++
          if (signup.status === 'present') attendance[name].present++
          else if (signup.status === 'absent') attendance[name].absent++
        }
      }

      results.attendance = Object.entries(attendance)
        .map(([name, data]) => ({
          name,
          ...data,
          rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
        }))
        .sort((a, b) => b.rate - a.rate)
      results.totalEvents = events.length
    } catch {
      results.attendance = []
      results.totalEvents = 0
    }

    // 3. Ilvl progression (stagnation detection)
    try {
      const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000)
      const history = await db
        .select({
          name: ilvl_history.character_name,
          realm: ilvl_history.realm,
          ilvl: ilvl_history.ilvl,
          recorded_at: ilvl_history.recorded_at,
        })
        .from(ilvl_history)
        .where(gte(ilvl_history.recorded_at, twoWeeksAgo))
        .orderBy(desc(ilvl_history.recorded_at))

      // Group by character and compute progression
      const charProgress: Record<string, { first: number; last: number; diff: number }> = {}
      for (const entry of history) {
        const key = entry.name
        if (!charProgress[key]) {
          charProgress[key] = { first: entry.ilvl, last: entry.ilvl, diff: 0 }
        } else {
          charProgress[key].first = entry.ilvl // older entries come later since sorted desc
        }
      }
      for (const key of Object.keys(charProgress)) {
        charProgress[key].diff = +(charProgress[key].last - charProgress[key].first).toFixed(1)
      }

      results.ilvlProgress = Object.entries(charProgress)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => a.diff - b.diff) // stagnating first
    } catch {
      results.ilvlProgress = []
    }

    res.json({ success: true, data: results })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
