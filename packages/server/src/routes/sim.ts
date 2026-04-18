import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import os from 'os'
import { DEFAULT_SIM_OPTIONS } from '@wow-simc/shared'
import { parseSimcString } from '@wow-simc/simc-engine'
import { validateBody } from '../middleware/validation.js'
import { optionalAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rate-limiter.js'
import {
  createSimulation,
  getSimulationWithResults,
  updateSimulation,
  listSimulations,
} from '../services/simulation.js'
import { addSimJob, getQueueStatus } from '../queue/index.js'
import { simQueue } from '../queue/sim-queue.js'
import { INSTANCES } from '../data/raids.js'
import { fetchRaidLoot, isBlizzardConfigured } from '../services/loot-data.js'
import { getItem } from '../services/blizzard-api.js'

export const simRouter: RouterType = Router()

// 10 sim requests per minute per IP
const simRateLimit = rateLimit(10, 60 * 1000)

// ─── Schemas ──────────────────────────────────────────────────────────────────

const simOptionsShape = z.object({
  iterations: z.number().int().positive().optional(),
  fight_style: z
    .enum(['Patchwerk', 'HecticAddCleave', 'DungeonSlice', 'CastingPatchwerk'])
    .optional(),
  fight_length: z.number().positive().optional(),
  target_error: z.number().positive().optional(),
  threads: z.number().int().positive().optional(),
  targets: z.number().int().positive().optional(),
})

const quickSimBodySchema = z.object({
  simc_input: z.string().min(1, 'simc_input is required'),
  sim_options: simOptionsShape.optional(),
})

const topGearBodySchema = z.object({
  simc_input: z.string().min(1, 'simc_input is required'),
  // candidates: raw simc gear lines (one per line) for alternate items
  // e.g.: "head=,id=12345,bonus_id=1/2,ilevel=639"
  candidates: z.string().min(1, 'candidates is required'),
  sim_options: simOptionsShape.optional(),
})

const statWeightsBodySchema = z.object({
  simc_input: z.string().min(1, 'simc_input is required'),
  sim_options: simOptionsShape.optional(),
})

const advancedBodySchema = z.object({
  simc_input: z.string().min(1, 'simc_input is required'),
  sim_options: simOptionsShape.optional(),
})

const droptimzerBodySchema = z.object({
  simc_input: z.string().min(1, 'simc_input is required'),
  // Support single raid_id (backward compat) or multiple raid_ids
  raid_id: z.number().int().positive().optional(),
  raid_ids: z.array(z.number().int().positive()).optional(),
  boss_ids: z.array(z.number().int().positive()).optional(),
  difficulty: z.string().optional(), // 'normal'|'heroic'|'mythic' for raids, 'mythic0'|'m+2'..'m+15' for dungeons
  sim_options: simOptionsShape.optional(),
})

// ── Midnight Season 1 ilvl tables ──────────────────────────────────────────
// Raid ilvl is an average (bosses 1-6 have different ilvls, we use the mid-range)
const RAID_ILVL: Record<string, number> = {
  normal: 250,
  heroic: 263,
  mythic: 276,
}

// M+ end-of-dungeon loot ilvl by key level
const MYTHIC_PLUS_ILVL: Record<number, number> = {
  0: 246,
  2: 250,
  3: 250,
  4: 253,
  5: 256,
  6: 259,
  7: 259,
  8: 263,
  9: 263,
  10: 266,
  11: 266,
  12: 266,
  13: 266,
  14: 266,
  15: 266,
}

function getIlvlForDifficulty(instanceType: 'raid' | 'dungeon', difficulty?: string): number | null {
  if (!difficulty) return null
  if (instanceType === 'raid') {
    return RAID_ILVL[difficulty] ?? null
  }
  // Dungeon: 'mythic0' or 'm+N'
  if (difficulty === 'mythic0') return MYTHIC_PLUS_ILVL[0]
  const match = difficulty.match(/^m\+(\d+)$/)
  if (match) {
    const level = parseInt(match[1], 10)
    // Find the closest defined key level (cap at 12)
    const capped = Math.min(level, 12)
    // Walk down to find the closest defined entry
    for (let l = capped; l >= 0; l--) {
      if (MYTHIC_PLUS_ILVL[l] !== undefined) return MYTHIC_PLUS_ILVL[l]
    }
  }
  return null
}

// ─── Class-based item filtering ───────────────────────────────────────────────

/** Armor types each class can wear (for armor slots: head, shoulders, chest, wrists, hands, waist, legs, feet) */
const CLASS_ARMOR: Record<string, Set<string>> = {
  warrior: new Set(['Plate']),
  paladin: new Set(['Plate']),
  death_knight: new Set(['Plate']),
  hunter: new Set(['Mail']),
  shaman: new Set(['Mail']),
  evoker: new Set(['Mail']),
  rogue: new Set(['Leather']),
  monk: new Set(['Leather']),
  druid: new Set(['Leather']),
  demon_hunter: new Set(['Leather']),
  mage: new Set(['Cloth']),
  warlock: new Set(['Cloth']),
  priest: new Set(['Cloth']),
}

/** Weapon/offhand subclasses each class can NOT use */
const CLASS_BLOCKED_SUBCLASS: Record<string, Set<string>> = {
  death_knight: new Set(['Shield', 'Held In Off-hand']),
  demon_hunter: new Set(['Shield', 'Held In Off-hand']),
  hunter: new Set(['Shield', 'Held In Off-hand']),
  monk: new Set(['Shield', 'Held In Off-hand']),
  rogue: new Set(['Shield', 'Held In Off-hand']),
  druid: new Set(['Shield']),
  mage: new Set(['Shield']),
  warlock: new Set(['Shield']),
  priest: new Set(['Shield']),
  evoker: new Set(['Shield']),
}

const ARMOR_SLOTS = new Set(['head', 'shoulders', 'chest', 'wrists', 'hands', 'waist', 'legs', 'feet'])

/** Classes that use STR / AGI / INT as primary stat */
const CLASS_PRIMARY_STAT: Record<string, 'str' | 'agi' | 'int'> = {
  warrior: 'str', paladin: 'str', death_knight: 'str',
  hunter: 'agi', shaman: 'agi', rogue: 'agi', monk: 'agi', druid: 'agi', demon_hunter: 'agi', evoker: 'int',
  mage: 'int', warlock: 'int', priest: 'int',
}

/** Item subclass names that indicate a specific primary stat (trinkets, necks, rings, weapons) */
const INT_KEYWORDS = ['intellect', 'spell power', 'spirit', 'mana']
const STR_KEYWORDS = ['strength']
const AGI_KEYWORDS = ['agility']

/** Detect primary stat from item name/subclass for trinkets and jewelry */
function getItemPrimaryStat(itemName: string, itemSubclass?: string): 'str' | 'agi' | 'int' | null {
  const lower = (itemName + ' ' + (itemSubclass || '')).toLowerCase()
  if (INT_KEYWORDS.some(k => lower.includes(k))) return 'int'
  if (STR_KEYWORDS.some(k => lower.includes(k))) return 'str'
  if (AGI_KEYWORDS.some(k => lower.includes(k))) return 'agi'
  return null
}

/** Subclasses that indicate healer/caster items */
const CASTER_WEAPON_SUBCLASSES = new Set(['Wand', 'Held In Off-hand'])

/**
 * Filter items by class. Returns true if the item is usable by the class.
 */
function isItemUsableByClass(
  slot: string,
  itemSubclass: string | undefined,
  wowClass: string | undefined,
  primaryStat?: string,
): boolean {
  if (!wowClass) return true

  // Filter armor type for armor slots
  if (ARMOR_SLOTS.has(slot) && itemSubclass) {
    const allowed = CLASS_ARMOR[wowClass]
    if (allowed && !allowed.has(itemSubclass)) return false
  }

  // Filter weapon/offhand subclass
  if (itemSubclass) {
    const blocked = CLASS_BLOCKED_SUBCLASS[wowClass]
    if (blocked && blocked.has(itemSubclass)) return false
  }

  // Filter by primary stat (trinkets, weapons, and any item with a known primary stat)
  if (primaryStat) {
    const classStat = CLASS_PRIMARY_STAT[wowClass]
    if (classStat && primaryStat !== classStat) return false
  }

  // Filter caster weapons for non-caster classes
  if (itemSubclass && CASTER_WEAPON_SUBCLASSES.has(itemSubclass)) {
    const classStat = CLASS_PRIMARY_STAT[wowClass]
    if (classStat && classStat !== 'int') return false
  }

  return true
}

const gearCompareBodySchema = z.object({
  simc_input_a: z.string().min(1, 'simc_input_a is required'),
  simc_input_b: z.string().min(1, 'simc_input_b is required'),
  name_a: z.string().optional(),
  name_b: z.string().optional(),
  sim_options: simOptionsShape.optional(),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET /api/sim/history */
simRouter.get('/history', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || '20', 10)
    const mine = req.query.mine === 'true'
    // If ?mine=true and user is authenticated, filter by their user_id
    const userId = mine && req.user ? req.user.userId : undefined
    const sims = await listSimulations(userId, limit)
    res.json({ success: true, data: sims })
  } catch (err) {
    console.error('[GET /history]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** GET /api/sim/queue/status */
simRouter.get('/queue/status', async (_req, res) => {
  try {
    const status = await getQueueStatus()
    res.json({ success: true, data: status })
  } catch (err) {
    console.error('[GET /queue/status]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** POST /api/sim/quick-sim */
simRouter.post('/quick-sim', simRateLimit, optionalAuth, validateBody(quickSimBodySchema), async (req, res) => {
  try {
    const { simc_input, sim_options } = req.body as z.infer<typeof quickSimBodySchema>

    const mergedOptions = {
      ...DEFAULT_SIM_OPTIONS,
      ...sim_options,
    }

    const sim = await createSimulation({
      simc_input,
      sim_type: 'quick-sim',
      sim_options: mergedOptions,
      user_id: req.user?.userId,
    })

    await addSimJob(sim.id, 'quick-sim')

    res.status(202).json({ id: sim.id, status: 'queued' })
  } catch (err) {
    console.error('[POST /quick-sim]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** POST /api/sim/top-gear */
simRouter.post('/top-gear', simRateLimit, optionalAuth, validateBody(topGearBodySchema), async (req, res) => {
  try {
    const { simc_input, candidates: candidatesRaw, sim_options } = req.body as z.infer<
      typeof topGearBodySchema
    >

    const mergedOptions = { ...DEFAULT_SIM_OPTIONS, ...sim_options }

    // Parse base character from simc_input
    const partialChar = parseSimcString(simc_input)
    const character = {
      name: partialChar.name ?? 'Unknown',
      realm: partialChar.realm ?? '',
      region: partialChar.region ?? 'us',
      class: partialChar.class ?? 'warrior',
      spec: partialChar.spec ?? '',
      level: partialChar.level ?? 80,
      item_level: partialChar.item_level ?? 0,
      race: partialChar.race ?? 'human',
      gear: partialChar.gear ?? ({} as any),
      talents: partialChar.talents ?? '',
      simc_string: simc_input,
    }

    // Parse candidate gear lines into Record<slot, GearItem[]>
    // Each line looks like: head=,id=12345,bonus_id=1/2,ilevel=639
    const candidates: Record<string, any[]> = {}
    const candidateLines = candidatesRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))

    for (const line of candidateLines) {
      const eqIdx = line.indexOf('=')
      if (eqIdx === -1) continue
      const slot = line.slice(0, eqIdx).trim().toLowerCase()
      const rest = line.slice(eqIdx + 1)
      // re-parse item using the same logic as simc-input-parser
      const paramStr = rest.startsWith(',') ? rest.slice(1) : rest
      const params = new Map<string, string>()
      for (const part of paramStr.split(',')) {
        const pEq = part.indexOf('=')
        if (pEq === -1) continue
        params.set(part.slice(0, pEq).trim(), part.slice(pEq + 1).trim())
      }
      const id = parseInt(params.get('id') ?? '0', 10)
      let ilevel = parseInt(params.get('ilevel') ?? '0', 10)
      // If no ilevel but has drop_level, estimate it (SimC sometimes needs explicit ilevel)
      if (ilevel <= 0 && params.has('drop_level')) {
        const dropLevel = parseInt(params.get('drop_level')!, 10)
        if (dropLevel > 0) ilevel = Math.round(dropLevel * 2.2)
      }
      const bonus_ids = params.has('bonus_id')
        ? params.get('bonus_id')!.split('/').map(Number).filter((n) => !isNaN(n))
        : undefined
      const gem_ids = params.has('gem_id')
        ? params.get('gem_id')!.split('/').map(Number).filter((n) => !isNaN(n) && n > 0)
        : undefined
      const enchant_id = params.has('enchant_id')
        ? parseInt(params.get('enchant_id')!, 10)
        : undefined

      const item: any = {
        id,
        name: `${slot}_${id}`,
        item_level: ilevel,
        slot,
        ...(bonus_ids && bonus_ids.length > 0 ? { bonus_ids } : {}),
        ...(gem_ids && gem_ids.length > 0 ? { gem_ids } : {}),
        ...(enchant_id && enchant_id > 0 ? { enchant_id } : {}),
      }

      if (!candidates[slot]) candidates[slot] = []
      candidates[slot].push(item)
    }

    // Resolve real item names from Blizzard API for items with placeholder names
    if (isBlizzardConfigured()) {
      const resolvePromises: Promise<void>[] = []
      for (const slot of Object.keys(candidates)) {
        for (const item of candidates[slot]) {
          if (item.name === `${item.slot}_${item.id}` && item.id > 0) {
            resolvePromises.push(
              getItem(item.id).then((blzItem) => {
                if (blzItem?.name) item.name = blzItem.name as string
              }).catch(() => { /* keep fallback name */ })
            )
          }
        }
      }
      await Promise.all(resolvePromises)
    }

    // Store everything in sim_options (cast as any since we're overloading the field)
    const sim = await createSimulation({
      simc_input,
      sim_type: 'top-gear',
      sim_options: { character, candidates, sim_options: mergedOptions } as any,
      user_id: req.user?.userId,
    })

    await addSimJob(sim.id, 'top-gear')

    res.status(202).json({ id: sim.id, status: 'queued' })
  } catch (err) {
    console.error('[POST /top-gear]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** POST /api/sim/stat-weights */
simRouter.post('/stat-weights', simRateLimit, optionalAuth, validateBody(statWeightsBodySchema), async (req, res) => {
  try {
    const { simc_input, sim_options } = req.body as z.infer<typeof statWeightsBodySchema>

    const mergedOptions = { ...DEFAULT_SIM_OPTIONS, ...sim_options }

    const sim = await createSimulation({
      simc_input,
      sim_type: 'stat-weights',
      sim_options: mergedOptions,
      user_id: req.user?.userId,
    })

    await addSimJob(sim.id, 'stat-weights')

    res.status(202).json({ id: sim.id, status: 'queued' })
  } catch (err) {
    console.error('[POST /stat-weights]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** POST /api/sim/advanced */
simRouter.post('/advanced', simRateLimit, optionalAuth, validateBody(advancedBodySchema), async (req, res) => {
  try {
    const { simc_input, sim_options } = req.body as z.infer<typeof advancedBodySchema>

    const mergedOptions = { ...DEFAULT_SIM_OPTIONS, ...sim_options }

    const sim = await createSimulation({
      simc_input,
      sim_type: 'advanced',
      sim_options: mergedOptions,
      user_id: req.user?.userId,
    })

    await addSimJob(sim.id, 'advanced')

    res.status(202).json({ id: sim.id, status: 'queued' })
  } catch (err) {
    console.error('[POST /advanced]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** POST /api/sim/droptimizer */
simRouter.post('/droptimizer', validateBody(droptimzerBodySchema), async (req, res) => {
  try {
    const { simc_input, raid_id, raid_ids, boss_ids, difficulty, sim_options } = req.body as z.infer<
      typeof droptimzerBodySchema
    >

    const mergedOptions = { ...DEFAULT_SIM_OPTIONS, ...sim_options }

    // Parse character class from simc input for slot filtering
    let characterClass: string | undefined
    try {
      const parsed = parseSimcString(simc_input)
      characterClass = parsed.class
    } catch { /* skip */ }

    // Resolve instance IDs (support both single and multi)
    const resolvedIds = raid_ids ?? (raid_id ? [raid_id] : [])
    if (resolvedIds.length === 0) {
      res.status(400).json({ success: false, error: 'At least one raid_id or raid_ids is required' })
      return
    }

    const allItems: Array<{
      id: number; name: string; slot: string; item_level: number;
      bonus_ids?: number[]; icon_url?: string; boss_name: string
    }> = []

    // Fetch all instances in parallel
    const instanceResults = await Promise.all(
      resolvedIds.map(async (instId) => {
        const instance = INSTANCES.find((r) => r.id === instId)
        if (!instance) {
          console.warn(`[droptimizer] Instance id=${instId} not found in INSTANCES`)
          return null
        }

        let instanceBosses = instance.bosses
        let image_url: string | undefined
        if (instanceBosses.length === 0 && isBlizzardConfigured()) {
          try {
            const fetched = await fetchRaidLoot(instance.blizzard_id, 'us', instance.type)
            instanceBosses = fetched.bosses
            image_url = fetched.image_url
          } catch (err) {
            console.error(`[droptimizer] fetchRaidLoot failed for ${instance.name} (blizzard_id=${instance.blizzard_id}):`, err)
          }
        }

        return { instance, bosses: instanceBosses, image_url }
      })
    )

    for (const entry of instanceResults) {
      if (!entry) continue
      const { instance, bosses: instanceBosses } = entry

      const bosses = boss_ids
        ? instanceBosses.filter((b) => boss_ids.includes(b.id))
        : instanceBosses

      const ilvlOverride = getIlvlForDifficulty(instance.type, difficulty)

      for (const boss of bosses) {
        for (const item of boss.loot) {
          // Skip items the character's class can't equip
          if (!isItemUsableByClass(item.slot, item.item_subclass, characterClass, item.primary_stat)) continue

          const finalIlvl = ilvlOverride ?? item.item_level
          // Skip items with no valid item level (SimC rejects ilvl 0)
          if (!finalIlvl || finalIlvl <= 0) continue

          allItems.push({
            id: item.id,
            name: item.name,
            slot: item.slot,
            item_level: finalIlvl,
            ...(item.bonus_ids ? { bonus_ids: item.bonus_ids } : {}),
            ...(item.icon_url ? { icon_url: item.icon_url } : {}),
            boss_name: boss.name,
          })
        }
      }
    }

    if (allItems.length === 0) {
      res.status(400).json({ success: false, error: 'No loot items found for selected instances' })
      return
    }

    // Auto-tune sim options for large droptimizer runs (many profilesets = screening mode)
    if (allItems.length > 50 && !sim_options?.target_error) {
      mergedOptions.target_error = 0.5
    } else if (allItems.length > 20 && !sim_options?.target_error) {
      mergedOptions.target_error = 0.3
    }

    // Use more threads for droptimizer (heavy profileset workload)
    if (!sim_options?.threads) {
      mergedOptions.threads = Math.max(2, Math.min(os.cpus().length - 2, 8))
    }

    // Collect instance metadata for display on results page
    const instancesMeta = instanceResults
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((e) => ({
        id: e.instance.id,
        name: e.instance.name,
        type: e.instance.type,
        image_url: e.image_url,
      }))

    const sim = await createSimulation({
      simc_input,
      sim_type: 'droptimizer',
      sim_options: { items: allItems, instances: instancesMeta, sim_options: mergedOptions } as any,
    })

    await addSimJob(sim.id, 'droptimizer')

    res.status(202).json({ id: sim.id, status: 'queued' })
  } catch (err) {
    console.error('[POST /droptimizer]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** POST /api/sim/gear-compare */
simRouter.post('/gear-compare', validateBody(gearCompareBodySchema), async (req, res) => {
  try {
    const { simc_input_a, simc_input_b, name_a, name_b, sim_options } = req.body as z.infer<
      typeof gearCompareBodySchema
    >

    const mergedOptions = { ...DEFAULT_SIM_OPTIONS, ...sim_options }
    const resolvedNameA = name_a || 'Set A'
    const resolvedNameB = name_b || 'Set B'

    const sim = await createSimulation({
      simc_input: simc_input_a,
      sim_type: 'gear-compare',
      sim_options: {
        simc_input_a,
        simc_input_b,
        name_a: resolvedNameA,
        name_b: resolvedNameB,
        sim_options: mergedOptions,
      } as any,
    })

    await addSimJob(sim.id, 'gear-compare')

    res.status(202).json({ id: sim.id, status: 'queued' })
  } catch (err) {
    console.error('[POST /gear-compare]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** GET /api/sim/:id */
simRouter.get('/:id', async (req, res) => {
  try {
    const sim = await getSimulationWithResults(req.params.id)

    if (!sim) {
      res.status(404).json({ success: false, error: 'Simulation not found' })
      return
    }

    let queuePosition: number | undefined
    if (sim.status === 'queued') {
      try {
        const waitingJobs = await simQueue.getWaiting()
        const idx = waitingJobs.findIndex((j) => j.data.simId === req.params.id)
        if (idx !== -1) queuePosition = idx + 1
      } catch {
        // Queue position not critical — skip on error
      }
    }

    res.json({ success: true, data: { ...sim, queuePosition } })
  } catch (err) {
    console.error('[GET /sim/:id]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** DELETE /api/sim/:id */
simRouter.delete('/:id', async (req, res) => {
  try {
    const sim = await getSimulationWithResults(req.params.id)

    if (!sim) {
      res.status(404).json({ success: false, error: 'Simulation not found' })
      return
    }

    await updateSimulation(req.params.id, { status: 'cancelled' })

    res.json({ success: true, data: { id: req.params.id, status: 'cancelled' } })
  } catch (err) {
    console.error('[DELETE /sim/:id]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})
