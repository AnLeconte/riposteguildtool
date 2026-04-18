import { getJournalInstance, getJournalEncounter, getItem, getItemMedia, getInstanceMedia } from './blizzard-api.js'
import type { Instance, InstanceBoss, LootItem } from '../data/raids.js'

// Re-export Raid/RaidBoss aliases for backward compat
export type { Instance as Raid, InstanceBoss as RaidBoss, LootItem }

// In-memory cache for fetched instance data (keyed by blizzard_id:type)
const instanceCache = new Map<string, { data: Instance; fetchedAt: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// Map Blizzard inventory_type numeric ID to simc slot names
const INVENTORY_TYPE_TO_SLOT: Record<number, string> = {
  1: 'head',
  2: 'neck',
  3: 'shoulders',
  4: 'shirt',      // skip
  5: 'chest',
  6: 'waist',
  7: 'legs',
  8: 'feet',
  9: 'wrists',
  10: 'hands',
  11: 'finger1',   // ring
  12: 'trinket1',  // trinket
  13: 'main_hand', // one-hand
  14: 'off_hand',  // shield
  15: 'back',      // cloak
  16: 'main_hand', // two-hand
  17: 'off_hand',
  21: 'main_hand', // main hand
  22: 'off_hand',
  23: 'off_hand',  // held in off-hand
  25: 'main_hand', // ranged (thrown)
  26: 'main_hand', // ranged (gun/bow/crossbow)
}

// Slots to skip (non-equippable or cosmetic only)
const SKIP_SLOTS = new Set(['shirt'])

// Map Blizzard inventory type string to numeric ID
function getInvTypeId(invType: string): number {
  const map: Record<string, number> = {
    HEAD: 1, NECK: 2, SHOULDER: 3, SHIRT: 4, CHEST: 5, ROBE: 5,
    WAIST: 6, LEGS: 7, FEET: 8, WRIST: 9, HAND: 10, HANDS: 10,
    FINGER: 11, TRINKET: 12, ONEHAND: 13, SHIELD: 14, CLOAK: 15, BACK: 15,
    TWOHANDS: 16, TWOHAND: 16, OFFHAND: 17, HOLDABLE: 23,
    MAIN_HAND: 21, OFF_HAND: 22, RANGED: 26, THROWN: 25, RANGEDRIGHT: 26,
    NON_EQUIP: 0, BAG: 0,
  }
  return map[invType.toUpperCase()] ?? 0
}

/**
 * Resolve a single item from Blizzard API: details + icon (in parallel).
 */
async function resolveItem(itemId: number, region: string): Promise<LootItem | null> {
  try {
    // Fetch item details and media in parallel
    const [fullItem, media] = await Promise.all([
      getItem(itemId, region),
      getItemMedia(itemId, region).catch(() => null),
    ])

    const invTypeStr: string | undefined = fullItem?.inventory_type?.type
    if (!invTypeStr) return null

    const invTypeId = getInvTypeId(invTypeStr)
    const slot = invTypeId ? INVENTORY_TYPE_TO_SLOT[invTypeId] : undefined
    if (!slot || SKIP_SLOTS.has(slot)) return null

    const icon_url = media?.assets?.find((a: any) => a.key === 'icon')?.value

    const item_subclass: string | undefined = fullItem?.item_subclass?.name

    // Detect primary stat from preview_item stats
    let primary_stat: string | undefined
    const stats = fullItem?.preview_item?.stats
    if (stats && Array.isArray(stats)) {
      for (const stat of stats) {
        const type = stat?.type?.type
        if (type === 'INTELLECT') { primary_stat = 'int'; break }
        if (type === 'STRENGTH') { primary_stat = 'str'; break }
        if (type === 'AGILITY') { primary_stat = 'agi'; break }
      }
    }

    return {
      id: itemId,
      name: (fullItem.name as string | undefined) ?? `Item ${itemId}`,
      slot,
      item_level: (fullItem.level as number | undefined) ?? 0,
      icon_url,
      item_subclass,
      primary_stat,
    }
  } catch {
    return null
  }
}

/**
 * Fetch loot data for a given Blizzard journal instance ID.
 * Results are cached for CACHE_TTL duration.
 */
export async function fetchRaidLoot(blizzardId: number, region = 'us', instanceType: 'raid' | 'dungeon' = 'raid'): Promise<Instance> {
  // Check cache (keyed by id + type to separate raid vs dungeon-mythic loot)
  const cacheKey = `${blizzardId}:${instanceType}`
  const cached = instanceCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data
  }

  // Fetch instance + instance media in parallel
  const [instance, instanceMedia] = await Promise.all([
    getJournalInstance(blizzardId, region),
    getInstanceMedia(blizzardId, region).catch(() => null),
  ])

  const image_url = instanceMedia?.assets?.find((a: any) => a.key === 'tile')?.value
    ?? instanceMedia?.assets?.[0]?.value

  // Fetch all encounters in parallel
  // For dungeons, request Mythic difficulty (23) to get only Mythic-level loot
  const encounters = (instance.encounters ?? []) as Array<{ id: number; name: string }>
  // For dungeons, use Mythic difficulty (23) to get only Mythic-level loot
  const difficultyId = instanceType === 'dungeon' ? 23 : undefined
  const encounterDetails = await Promise.all(
    encounters.map((enc) =>
      getJournalEncounter(enc.id, region, difficultyId)
        .catch(() => getJournalEncounter(enc.id, region)) // Fallback without difficulty filter
    )
  )

  // Resolve all items across all bosses in parallel
  const bossItemEntries: Array<{ bossIdx: number; itemId: number; itemName?: string }> = []
  for (let i = 0; i < encounterDetails.length; i++) {
    const items = (encounterDetails[i].items ?? []) as Array<{ item?: { id?: number; name?: string } }>
    for (const item of items) {
      if (item.item?.id) {
        bossItemEntries.push({ bossIdx: i, itemId: item.item.id, itemName: item.item.name })
      }
    }
  }

  const resolvedItems = await Promise.all(
    bossItemEntries.map((entry) => resolveItem(entry.itemId, region))
  )

  // Group resolved items by boss — deduplicate by item ID and by slot
  const bosses: InstanceBoss[] = encounters.map((enc, i) => ({
    id: enc.id,
    name: enc.name,
    loot: [] as LootItem[],
  }))

  for (let i = 0; i < bossItemEntries.length; i++) {
    const resolved = resolvedItems[i]
    if (!resolved) continue
    // Use the Blizzard encounter name as fallback if item name is generic
    if (!resolved.name || resolved.name.startsWith('Item ')) {
      resolved.name = bossItemEntries[i].itemName ?? resolved.name
    }

    const boss = bosses[bossItemEntries[i].bossIdx]

    // Skip duplicate item IDs
    if (boss.loot.some((l) => l.id === resolved.id)) continue

    // For dungeons: deduplicate by slot (Blizzard returns spec-specific variants)
    // Keep only one item per slot per boss to avoid 80+ items
    if (instanceType === 'dungeon') {
      if (boss.loot.some((l) => l.slot === resolved.slot)) continue
    }

    boss.loot.push(resolved)
  }

  const result: Instance = {
    id: blizzardId,
    blizzard_id: blizzardId,
    name: instance.name as string,
    type: 'raid', // will be overridden by caller if needed
    bosses,
    image_url,
  }

  instanceCache.set(cacheKey, { data: result, fetchedAt: Date.now() })
  return result
}

// Known current instance IDs (Blizzard journal instance IDs)
export const KNOWN_RAIDS = {
  LIBERATION_OF_UNDERMINE: 1296,
}

export function isBlizzardConfigured(): boolean {
  return !!(process.env.BLIZZARD_CLIENT_ID && process.env.BLIZZARD_CLIENT_SECRET)
}
