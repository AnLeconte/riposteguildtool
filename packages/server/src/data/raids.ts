export interface LootItem {
  id: number
  name: string
  slot: string
  item_level: number
  bonus_ids?: number[]
  icon_url?: string
  /** Blizzard item_subclass name (e.g. "Plate", "Shield", "Cloth", "Dagger", "Sword") */
  item_subclass?: string
  /** Primary stat: 'str', 'agi', or 'int' */
  primary_stat?: string
}

export interface InstanceBoss {
  id: number
  name: string
  loot: LootItem[]
}

export interface Instance {
  id: number
  blizzard_id: number // Blizzard journal instance ID for API fetching
  name: string
  type: 'raid' | 'dungeon'
  dungeon_pool?: 'mythic_plus' | 'mythic_zero' | 'both'
  bosses: InstanceBoss[]
  image_url?: string
}

// Backward-compat type aliases
export type RaidBoss = InstanceBoss
export type Raid = Instance

export const INSTANCES: Instance[] = [
  // ── Raids — Midnight Season 1 ──
  {
    id: 1,
    blizzard_id: 1307,
    name: 'The Voidspire',
    type: 'raid',
    bosses: [],
  },
  {
    id: 2,
    blizzard_id: 1314,
    name: 'The Dreamrift',
    type: 'raid',
    bosses: [],
  },
  {
    id: 3,
    blizzard_id: 1308,
    name: 'March on Quel\'Danas',
    type: 'raid',
    bosses: [],
  },
  // ── Dungeons — Midnight Season 1 ──
  {
    id: 4,
    blizzard_id: 1299,
    name: 'Windrunner Spire',
    type: 'dungeon',
    bosses: [],
  },
  {
    id: 5,
    blizzard_id: 1304,
    name: 'Murder Row',
    type: 'dungeon',
    bosses: [],
  },
  {
    id: 6,
    blizzard_id: 1311,
    name: 'Den of Nalorakk',
    type: 'dungeon',
    bosses: [],
  },
  {
    id: 7,
    blizzard_id: 1315,
    name: 'Maisara Caverns',
    type: 'dungeon',
    bosses: [],
  },
  // ── Legacy Dungeons ──
  {
    id: 8,
    blizzard_id: 1300,
    name: 'Magisters\' Terrace',
    type: 'dungeon',
    bosses: [],
  },
  {
    id: 9,
    blizzard_id: 278,
    name: 'Pit of Saron',
    type: 'dungeon',
    bosses: [],
  },
  {
    id: 10,
    blizzard_id: 945,
    name: 'Seat of the Triumvirate',
    type: 'dungeon',
    bosses: [],
  },
  {
    id: 11,
    blizzard_id: 476,
    name: 'Skyreach',
    type: 'dungeon',
    bosses: [],
  },
]

// Backward-compat export
export const RAIDS = INSTANCES
