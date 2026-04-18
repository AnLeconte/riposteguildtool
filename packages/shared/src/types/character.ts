export const WowClass = {
  DeathKnight: 'death_knight',
  DemonHunter: 'demon_hunter',
  Druid: 'druid',
  Evoker: 'evoker',
  Hunter: 'hunter',
  Mage: 'mage',
  Monk: 'monk',
  Paladin: 'paladin',
  Priest: 'priest',
  Rogue: 'rogue',
  Shaman: 'shaman',
  Warlock: 'warlock',
  Warrior: 'warrior',
} as const;

export type WowClass = (typeof WowClass)[keyof typeof WowClass];

export type WowSpec = string;

export const Region = {
  US: 'us',
  EU: 'eu',
  KR: 'kr',
  TW: 'tw',
  CN: 'cn',
} as const;

export type Region = (typeof Region)[keyof typeof Region];

export const GearSlot = {
  Head: 'head',
  Neck: 'neck',
  Shoulders: 'shoulders',
  Back: 'back',
  Chest: 'chest',
  Wrists: 'wrists',
  Hands: 'hands',
  Waist: 'waist',
  Legs: 'legs',
  Feet: 'feet',
  Finger1: 'finger1',
  Finger2: 'finger2',
  Trinket1: 'trinket1',
  Trinket2: 'trinket2',
  MainHand: 'main_hand',
  OffHand: 'off_hand',
} as const;

export type GearSlot = (typeof GearSlot)[keyof typeof GearSlot];

export interface GearItem {
  id: number;
  name: string;
  item_level: number;
  enchant_id?: number;
  gem_ids?: number[];
  bonus_ids?: number[];
  slot: GearSlot;
}

export interface BagItem {
  slot: string;
  id: number;
  name: string;
  item_level: number;
  bonus_ids?: number[];
  gem_ids?: number[];
  enchant_id?: number;
  encoded_line: string;
}

export interface Character {
  name: string;
  realm: string;
  region: Region;
  class: WowClass;
  spec: string;
  level: number;
  item_level: number;
  race: string;
  gear: Record<GearSlot, GearItem | null>;
  talents: string;
  simc_string: string;
}
