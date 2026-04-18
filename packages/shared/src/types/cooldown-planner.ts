// ─── Boss Encounter Data ──────────────────────────────────────────────────────

export interface BossAbility {
  id: string
  name: string
  spellId?: number
  iconName?: string
  timestamp: number       // seconds into the fight
  duration: number        // how long the dangerous period lasts (seconds)
  color: string
  description?: string
}

export interface BossEncounter {
  id: string
  name: string
  raid: string
  fightDuration: number   // total fight length in seconds
  abilities: BossAbility[]
}

// ─── Healer Spec Definitions ──────────────────────────────────────────────────

export type HealerSpec =
  | 'holy_paladin'
  | 'holy_priest'
  | 'discipline_priest'
  | 'restoration_druid'
  | 'restoration_shaman'
  | 'mistweaver_monk'
  | 'preservation_evoker'

export interface HealerCooldownDef {
  id: string
  name: string
  spellId?: number
  iconName?: string
  spec: HealerSpec
  cooldownDuration: number // CD length in seconds
  effectDuration: number   // how long the effect lasts (seconds)
  color: string
}

export interface HealerSpecDef {
  spec: HealerSpec
  label: string
  className: string
  classColor: string
  cooldowns: HealerCooldownDef[]
}

// ─── Plan (user-created) ──────────────────────────────────────────────────────

export interface RosterHealer {
  id: string
  spec: HealerSpec
  name: string
}

export interface PlacedCooldown {
  id: string
  healerId: string
  cooldownDefId: string
  startTime: number       // seconds on timeline
}

export interface CooldownPlan {
  id: string
  name: string
  encounterId: string
  roster: RosterHealer[]
  placements: PlacedCooldown[]
}
