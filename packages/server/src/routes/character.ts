import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { eq, and, gte } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { parseSimcString, parseBagItems } from '@wow-simc/simc-engine'
import { validateBody } from '../middleware/validation.js'
import { optionalAuth } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { characters, ilvl_history } from '../db/schema.js'
import {
  getCharacterProfile,
  getCharacterEquipment,
  getCharacterSpecializations,
  getCharacterMedia,
  getCharacterMythicPlus,
} from '../services/blizzard-api.js'
import { isBlizzardConfigured } from '../services/loot-data.js'
import { getRioCharacter } from '../services/raiderio-api.js'

export const characterRouter: RouterType = Router()

// ─── Schemas ──────────────────────────────────────────────────────────────────

const importSimcBodySchema = z.object({
  simc_string: z.string().min(1, 'simc_string is required'),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

/** POST /api/character/import-simc */
characterRouter.post(
  '/import-simc',
  validateBody(importSimcBodySchema),
  async (req, res) => {
    try {
      const { simc_string } = req.body as z.infer<typeof importSimcBodySchema>

      const parsed = parseSimcString(simc_string)

      if (!parsed.class) {
        res.status(400).json({ success: false, error: 'Could not parse character class from simc string' })
        return
      }

      const id = uuidv4()

      const [row] = await db
        .insert(characters)
        .values({
          id,
          name: parsed.name ?? 'Unknown',
          realm: parsed.realm ?? null,
          region: parsed.region ?? null,
          wow_class: parsed.class,
          spec: parsed.spec ?? null,
          level: parsed.level ?? 80,
          item_level: parsed.item_level ?? null,
          simc_string: simc_string.trim(),
          gear_json: parsed.gear ?? null,
        })
        .returning()

      res.status(201).json({ success: true, data: row })
    } catch (err) {
      console.error('[POST /character/import-simc]', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  },
)

/** POST /api/character/parse-simc */
characterRouter.post(
  '/parse-simc',
  validateBody(importSimcBodySchema),
  (req, res) => {
    try {
      const { simc_string } = req.body as z.infer<typeof importSimcBodySchema>

      const character = parseSimcString(simc_string)
      const bag_items = parseBagItems(simc_string)

      res.json({ success: true, data: { character, bag_items } })
    } catch (err) {
      console.error('[POST /character/parse-simc]', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  },
)

/**
 * GET /api/character/profile/:realm/:name?region=eu
 * Aggregates character profile, equipment, specs, media, and M+ score from Blizzard API.
 */
characterRouter.get('/profile/:realm/:name', optionalAuth, async (req, res) => {
  if (!isBlizzardConfigured()) {
    res.status(503).json({ success: false, error: 'Blizzard API not configured' })
    return
  }
  try {
    const realm = req.params.realm.toLowerCase()
    const name = req.params.name.toLowerCase()
    const region = (req.query.region as string | undefined) ?? 'eu'

    // Fetch all data in parallel (Blizzard + Raider.io)
    const [profile, equipment, specs, media, mplus, rioData] = await Promise.all([
      getCharacterProfile(realm, name, region).catch(() => null),
      getCharacterEquipment(realm, name, region).catch(() => null),
      getCharacterSpecializations(realm, name, region).catch(() => null),
      getCharacterMedia(realm, name, region).catch(() => null),
      getCharacterMythicPlus(realm, name, region).catch(() => null),
      getRioCharacter(region, realm, name).catch(() => null),
    ])

    if (!profile) {
      res.status(404).json({ success: false, error: 'Character not found' })
      return
    }

    // Extract avatar/render URLs
    const avatarUrl = media?.assets?.find((a: any) => a.key === 'avatar')?.value
    const renderUrl = media?.assets?.find((a: any) => a.key === 'main')?.value
    const insetUrl = media?.assets?.find((a: any) => a.key === 'inset')?.value

    // Extract active spec
    const activeSpec = specs?.active_specialization?.name ?? profile.active_spec?.name
    const activeSpecId = specs?.active_specialization?.id ?? profile.active_spec?.id

    // Extract gear items
    const gearItems = (equipment?.equipped_items ?? []).map((item: any) => ({
      slot: item.slot?.type,
      name: item.name,
      id: item.item?.id,
      level: item.level?.value,
      quality: item.quality?.type,
      enchantments: item.enchantments?.map((e: any) => ({
        id: e.enchantment_id,
        name: e.display_string,
        slot: e.enchantment_slot?.type,
      })),
      sockets: item.sockets?.map((s: any) => ({
        type: s.socket_type?.type,
        item: s.item ? { id: s.item.id, name: s.item.name } : null,
      })),
      stats: item.stats?.map((s: any) => ({
        type: s.type?.type,
        value: s.value,
      })),
      setInfo: item.set ? { name: item.set.item_set?.name, items: item.set.items?.length, display: item.set.display_string } : undefined,
    }))

    // Average ilvl
    const equippedIlvl = profile.equipped_item_level ?? (
      gearItems.length > 0
        ? Math.round(gearItems.reduce((s: number, i: any) => s + (i.level ?? 0), 0) / gearItems.length)
        : 0
    )

    // Record ilvl history (only for authenticated users, once per day)
    if (req.user && equippedIlvl > 0) {
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      try {
        const [existing] = await db
          .select({ id: ilvl_history.id })
          .from(ilvl_history)
          .where(
            and(
              eq(ilvl_history.user_id, req.user.userId),
              eq(ilvl_history.character_name, name),
              eq(ilvl_history.realm, realm),
              eq(ilvl_history.region, region),
              gte(ilvl_history.recorded_at, today),
            ),
          )
          .limit(1)

        if (!existing) {
          await db.insert(ilvl_history).values({
            user_id: req.user.userId,
            character_name: name,
            realm,
            region,
            ilvl: equippedIlvl,
          })
        }
      } catch (err) {
        console.error('[ilvl_history] Failed to record:', err)
      }
    }

    // M+ rating
    const mplusRating = mplus?.current_period?.best_runs
      ? {
          runs: (mplus.current_period.best_runs ?? []).map((r: any) => ({
            dungeon: r.dungeon?.name,
            level: r.keystone_level,
            timed: r.is_completed_within_time,
            duration: r.duration,
          })),
          thisWeekRuns: mplus.current_period.best_runs.length,
        }
      : { runs: [], thisWeekRuns: 0 }

    // M+ score from seasons
    const mplusScore = profile.mythic_keystone_profile?.current_mythic_rating?.rating ?? 0

    res.json({
      success: true,
      data: {
        name: profile.name,
        realm: profile.realm?.name,
        realmSlug: realm,
        region,
        class: profile.character_class?.name,
        classId: profile.character_class?.id,
        race: profile.race?.name,
        gender: profile.gender?.name,
        level: profile.level,
        spec: activeSpec,
        specId: activeSpecId,
        faction: profile.faction?.name,
        achievementPoints: profile.achievement_points,
        equippedIlvl,
        averageIlvl: profile.average_item_level,
        avatarUrl,
        renderUrl,
        insetUrl,
        gear: gearItems,
        mythicPlus: {
          score: mplusScore,
          ...mplusRating,
        },
        talents: specs?.specializations?.find((s: any) => s.specialization?.name === activeSpec)?.loadouts?.[0]?.talent_loadout ?? null,
        // Raider.io data
        raiderio: rioData ? {
          score: rioData.score,
          ranks: rioData.ranks,
          classRanks: rioData.classRanks,
          bestRuns: rioData.bestRuns,
          recentRuns: rioData.recentRuns,
          profileUrl: rioData.profileUrl,
        } : null,
      },
    })
  } catch (err) {
    console.error('[GET /character/profile/:realm/:name]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch character profile' })
  }
})

/** GET /api/character/ilvl-history/:realm/:name?region=eu */
characterRouter.get('/ilvl-history/:realm/:name', async (req, res) => {
  try {
    const realm = req.params.realm.toLowerCase()
    const name = req.params.name.toLowerCase()
    const region = (req.query.region as string | undefined) ?? 'eu'

    const since = new Date()
    since.setUTCDate(since.getUTCDate() - 90)

    const rows = await db
      .select({
        ilvl: ilvl_history.ilvl,
        recorded_at: ilvl_history.recorded_at,
      })
      .from(ilvl_history)
      .where(
        and(
          eq(ilvl_history.character_name, name),
          eq(ilvl_history.realm, realm),
          eq(ilvl_history.region, region),
          gte(ilvl_history.recorded_at, since),
        ),
      )
      .orderBy(ilvl_history.recorded_at)

    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('[GET /character/ilvl-history/:realm/:name]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch ilvl history' })
  }
})

/** GET /api/character/:id */
characterRouter.get('/:id', async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, req.params.id))
      .limit(1)

    if (!row) {
      res.status(404).json({ success: false, error: 'Character not found' })
      return
    }

    res.json({ success: true, data: row })
  } catch (err) {
    console.error('[GET /character/:id]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})
