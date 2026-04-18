import type { BossEncounter } from '../types/cooldown-planner.js'

/**
 * Boss encounter data for the Cooldown Planner.
 * Spell IDs are real Blizzard spell IDs — Wowhead tooltips will show icons automatically.
 * Timestamps are approximate based on typical heroic kill times.
 */
export const ENCOUNTERS: BossEncounter[] = [
  // ══════════════════════════════════════════════════════════════════
  // THE VOIDSPIRE
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'imperator_averzian',
    name: 'Imperator Averzian',
    raid: 'The Voidspire',
    fightDuration: 300,
    abilities: [
      { id: 'ia1', name: 'Void Rupture', spellId: 1262036, timestamp: 25, duration: 4, color: '#9B59B6', description: 'Raid-wide AoE' },
      { id: 'ia2', name: 'Gathering Darkness', spellId: 1255749, timestamp: 50, duration: 6, color: '#6C3483', description: 'Stacking raid damage' },
      { id: 'ia3', name: 'Void Rupture', spellId: 1262036, timestamp: 75, duration: 4, color: '#9B59B6' },
      { id: 'ia4', name: "Oblivion's Wrath", spellId: 1260712, timestamp: 100, duration: 5, color: '#8E44AD', description: 'Heavy AoE' },
      { id: 'ia5', name: 'Dark Barrage', spellId: 1274846, timestamp: 130, duration: 4, color: '#5B2C6F' },
      { id: 'ia6', name: 'Void Rupture', spellId: 1262036, timestamp: 155, duration: 4, color: '#9B59B6' },
      { id: 'ia7', name: 'Umbral Collapse', spellId: 1249262, timestamp: 180, duration: 6, color: '#1A252F', description: 'Phase transition — heavy damage' },
      { id: 'ia8', name: 'Gathering Darkness', spellId: 1255749, timestamp: 210, duration: 6, color: '#6C3483' },
      { id: 'ia9', name: 'Void Rupture', spellId: 1262036, timestamp: 240, duration: 4, color: '#9B59B6' },
      { id: 'ia10', name: "Oblivion's Wrath", spellId: 1260712, timestamp: 270, duration: 5, color: '#8E44AD' },
    ],
  },
  {
    id: 'vorasius',
    name: 'Vorasius',
    raid: 'The Voidspire',
    fightDuration: 330,
    abilities: [
      { id: 'vo1', name: 'Void Breath', spellId: 1256855, timestamp: 25, duration: 5, color: '#2C3E50', description: 'Frontal cone AoE' },
      { id: 'vo2', name: 'Primordial Roar', spellId: 1260052, timestamp: 55, duration: 4, color: '#1A252F', description: 'Raid-wide fear + damage' },
      { id: 'vo3', name: 'Parasite Expulsion', spellId: 1254199, timestamp: 85, duration: 3, color: '#34495E' },
      { id: 'vo4', name: 'Void Breath', spellId: 1256855, timestamp: 115, duration: 5, color: '#2C3E50' },
      { id: 'vo5', name: 'Overpowering Pulse', spellId: 1244419, timestamp: 145, duration: 6, color: '#6C3483', description: 'Heavy raid AoE' },
      { id: 'vo6', name: 'Primordial Roar', spellId: 1260052, timestamp: 180, duration: 4, color: '#1A252F' },
      { id: 'vo7', name: 'Void Breath', spellId: 1256855, timestamp: 215, duration: 5, color: '#2C3E50' },
      { id: 'vo8', name: 'Overpowering Pulse', spellId: 1244419, timestamp: 250, duration: 6, color: '#6C3483' },
      { id: 'vo9', name: 'Primordial Roar', spellId: 1260052, timestamp: 290, duration: 4, color: '#1A252F' },
    ],
  },
  {
    id: 'fallen_king_salhadaar',
    name: 'Fallen-King Salhadaar',
    raid: 'The Voidspire',
    fightDuration: 360,
    abilities: [
      { id: 'fks1', name: 'Void Convergence', spellId: 1247738, timestamp: 20, duration: 5, color: '#D4AC0D', description: 'Raid-wide burst' },
      { id: 'fks2', name: 'Shattering Twilight', spellId: 1253032, timestamp: 55, duration: 4, color: '#B7950B' },
      { id: 'fks3', name: 'Entropic Unraveling', spellId: 1246175, timestamp: 85, duration: 6, color: '#7D6608', description: 'Heavy sustained damage' },
      { id: 'fks4', name: 'Void Convergence', spellId: 1247738, timestamp: 120, duration: 5, color: '#D4AC0D' },
      { id: 'fks5', name: 'Despotic Command', spellId: 1248697, timestamp: 155, duration: 4, color: '#B7950B', description: 'Forced movement + damage' },
      { id: 'fks6', name: 'Shattering Twilight', spellId: 1253032, timestamp: 190, duration: 4, color: '#B7950B' },
      { id: 'fks7', name: 'Void Convergence', spellId: 1247738, timestamp: 225, duration: 5, color: '#D4AC0D' },
      { id: 'fks8', name: 'Entropic Unraveling', spellId: 1246175, timestamp: 260, duration: 6, color: '#7D6608' },
      { id: 'fks9', name: 'Despotic Command', spellId: 1248697, timestamp: 300, duration: 4, color: '#B7950B' },
      { id: 'fks10', name: 'Void Convergence', spellId: 1247738, timestamp: 335, duration: 5, color: '#D4AC0D' },
    ],
  },
  {
    id: 'vaelgor_ezzorak',
    name: 'Vaelgor & Ezzorak',
    raid: 'The Voidspire',
    fightDuration: 390,
    abilities: [
      { id: 've1', name: 'Void Howl', spellId: 1244917, timestamp: 20, duration: 4, color: '#E74C3C', description: 'Raid-wide howl' },
      { id: 've2', name: 'Nullbeam', spellId: 1262623, timestamp: 50, duration: 3, color: '#8E44AD' },
      { id: 've3', name: 'Dread Breath', spellId: 1244221, timestamp: 80, duration: 5, color: '#6C3483', description: 'Frontal cone AoE' },
      { id: 've4', name: 'Void Howl', spellId: 1244917, timestamp: 115, duration: 4, color: '#E74C3C' },
      { id: 've5', name: 'Twilight Bond', spellId: 1270189, timestamp: 145, duration: 6, color: '#5B2C6F', description: 'Tethered damage' },
      { id: 've6', name: 'Cosmosis', spellId: 1263623, timestamp: 185, duration: 8, color: '#1A1A2E', description: 'Phase transition — heavy damage' },
      { id: 've7', name: 'Void Howl', spellId: 1244917, timestamp: 220, duration: 4, color: '#E74C3C' },
      { id: 've8', name: 'Dread Breath', spellId: 1244221, timestamp: 255, duration: 5, color: '#6C3483' },
      { id: 've9', name: 'Twilight Fury', spellId: 1270250, timestamp: 290, duration: 4, color: '#5B2C6F' },
      { id: 've10', name: 'Void Howl', spellId: 1244917, timestamp: 330, duration: 4, color: '#E74C3C' },
      { id: 've11', name: 'Unbound Shadow', spellId: 1251686, timestamp: 365, duration: 8, color: '#C0392B', description: 'Soft enrage' },
    ],
  },
  {
    id: 'lightblinded_vanguard',
    name: 'Lightblinded Vanguard',
    raid: 'The Voidspire',
    fightDuration: 350,
    abilities: [
      { id: 'lv1', name: 'Aura of Wrath', spellId: 1248449, timestamp: 20, duration: 6, color: '#F1C40F', description: 'Pulsing holy damage' },
      { id: 'lv2', name: 'Divine Storm', spellId: 1246765, timestamp: 55, duration: 3, color: '#F39C12' },
      { id: 'lv3', name: 'Execution Sentence', spellId: 1280159, timestamp: 85, duration: 5, color: '#E67E22', description: 'Lethal debuff — need CDs' },
      { id: 'lv4', name: 'Sacred Toll', spellId: 1246749, timestamp: 115, duration: 3, color: '#F1C40F' },
      { id: 'lv5', name: 'Aura of Wrath', spellId: 1248449, timestamp: 145, duration: 6, color: '#F1C40F' },
      { id: 'lv6', name: 'Searing Radiance', spellId: 1255738, timestamp: 180, duration: 4, color: '#E67E22', description: 'Heavy AoE' },
      { id: 'lv7', name: 'Execution Sentence', spellId: 1280159, timestamp: 215, duration: 5, color: '#E67E22' },
      { id: 'lv8', name: 'Retribution', spellId: 1256133, timestamp: 250, duration: 6, color: '#D35400', description: 'Final phase — increasing damage' },
      { id: 'lv9', name: 'Aura of Wrath', spellId: 1248449, timestamp: 290, duration: 6, color: '#F1C40F' },
      { id: 'lv10', name: 'Searing Radiance', spellId: 1255738, timestamp: 325, duration: 4, color: '#E67E22' },
    ],
  },
  {
    id: 'crown_of_the_cosmos',
    name: 'Crown of the Cosmos',
    raid: 'The Voidspire',
    fightDuration: 420,
    abilities: [
      { id: 'cc1', name: 'Stellar Emission', spellId: 1234569, timestamp: 20, duration: 4, color: '#F39C12', description: 'Raid-wide burst' },
      { id: 'cc2', name: 'Singularity Eruption', spellId: 1235622, timestamp: 55, duration: 5, color: '#E67E22' },
      { id: 'cc3', name: 'Null Corona', spellId: 1233865, timestamp: 85, duration: 3, color: '#9B59B6' },
      { id: 'cc4', name: 'Devouring Cosmos', spellId: 1238843, timestamp: 115, duration: 6, color: '#E74C3C', description: 'Lethal — must use CDs' },
      { id: 'cc5', name: 'Stellar Emission', spellId: 1234569, timestamp: 150, duration: 4, color: '#F39C12' },
      { id: 'cc6', name: 'Gravity Collapse', spellId: 1239089, timestamp: 185, duration: 5, color: '#8E44AD', description: 'Pull-in + AoE' },
      { id: 'cc7', name: 'Singularity Eruption', spellId: 1235622, timestamp: 220, duration: 5, color: '#E67E22' },
      { id: 'cc8', name: 'Devouring Cosmos', spellId: 1238843, timestamp: 255, duration: 6, color: '#E74C3C' },
      { id: 'cc9', name: 'Stellar Emission', spellId: 1234569, timestamp: 290, duration: 4, color: '#F39C12' },
      { id: 'cc10', name: 'Aspect of the End', spellId: 1239080, timestamp: 325, duration: 8, color: '#C0392B', description: 'Phase transition — massive damage' },
      { id: 'cc11', name: 'Devouring Cosmos', spellId: 1238843, timestamp: 370, duration: 6, color: '#E74C3C' },
      { id: 'cc12', name: 'Gravity Collapse', spellId: 1239089, timestamp: 400, duration: 5, color: '#8E44AD' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // THE DREAMRIFT
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'chimaerus',
    name: 'Chimaerus the Undreamt God',
    raid: 'The Dreamrift',
    fightDuration: 480,
    abilities: [
      { id: 'ch1', name: 'Discordant Roar', spellId: 1249207, timestamp: 25, duration: 4, color: '#27AE60', description: 'Raid-wide AoE' },
      { id: 'ch2', name: 'Consuming Miasma', spellId: 1257087, timestamp: 60, duration: 5, color: '#1E8449', description: 'Spreading AoE' },
      { id: 'ch3', name: 'Colossal Strikes', spellId: 1262020, timestamp: 90, duration: 3, color: '#145A32' },
      { id: 'ch4', name: 'Rift Emergence', spellId: 1258610, timestamp: 120, duration: 8, color: '#0E6655', description: 'Phase transition — heavy damage' },
      { id: 'ch5', name: 'Discordant Roar', spellId: 1249207, timestamp: 160, duration: 4, color: '#27AE60' },
      { id: 'ch6', name: 'Corrupted Devastation', spellId: 1245486, timestamp: 195, duration: 6, color: '#145A32', description: 'Lethal AoE' },
      { id: 'ch7', name: 'Fearsome Cry', spellId: 1249017, timestamp: 230, duration: 3, color: '#1E8449' },
      { id: 'ch8', name: 'Consuming Miasma', spellId: 1257087, timestamp: 265, duration: 5, color: '#1E8449' },
      { id: 'ch9', name: 'Rift Emergence', spellId: 1258610, timestamp: 305, duration: 8, color: '#0E6655' },
      { id: 'ch10', name: 'Discordant Roar', spellId: 1249207, timestamp: 345, duration: 4, color: '#27AE60' },
      { id: 'ch11', name: 'Corrupted Devastation', spellId: 1245486, timestamp: 385, duration: 6, color: '#145A32' },
      { id: 'ch12', name: 'Ravenous Dive', spellId: 1245406, timestamp: 425, duration: 5, color: '#0E6655', description: 'Tank + raid damage' },
      { id: 'ch13', name: 'Consuming Miasma', spellId: 1257087, timestamp: 460, duration: 5, color: '#1E8449' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // MARCH ON QUEL'DANAS
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'beloren',
    name: "Belo'ren, Child of Al'ar",
    raid: "March on Quel'Danas",
    fightDuration: 360,
    abilities: [
      { id: 'bl1', name: 'Voidlight Convergence', spellId: 1242515, timestamp: 20, duration: 5, color: '#E74C3C', description: 'Dual-energy burst' },
      { id: 'bl2', name: 'Light Eruption', spellId: 1243852, timestamp: 55, duration: 4, color: '#F1C40F' },
      { id: 'bl3', name: 'Void Eruption', spellId: 1243854, timestamp: 85, duration: 4, color: '#9B59B6' },
      { id: 'bl4', name: 'Rebirth', spellId: 1263412, timestamp: 115, duration: 8, color: '#F39C12', description: 'Phase change — massive damage' },
      { id: 'bl5', name: 'Voidlight Rupture', spellId: 1243866, timestamp: 150, duration: 5, color: '#E74C3C' },
      { id: 'bl6', name: 'Infused Quills', spellId: 1242260, timestamp: 180, duration: 3, color: '#C0392B' },
      { id: 'bl7', name: 'Voidlight Convergence', spellId: 1242515, timestamp: 215, duration: 5, color: '#E74C3C' },
      { id: 'bl8', name: 'Rebirth', spellId: 1263412, timestamp: 255, duration: 8, color: '#F39C12' },
      { id: 'bl9', name: 'Death Drop', spellId: 1246709, timestamp: 290, duration: 4, color: '#D35400', description: 'Lethal dive' },
      { id: 'bl10', name: 'Voidlight Rupture', spellId: 1243866, timestamp: 325, duration: 5, color: '#E74C3C' },
    ],
  },
  {
    id: 'midnight_falls',
    name: 'Midnight Falls',
    raid: "March on Quel'Danas",
    fightDuration: 400,
    abilities: [
      { id: 'mf1', name: "Death's Dirge", spellId: 1244412, timestamp: 20, duration: 4, color: '#5B2C6F', description: 'Raid-wide shadow damage' },
      { id: 'mf2', name: "Heaven's Glaives", spellId: 1253915, timestamp: 55, duration: 3, color: '#4A235A' },
      { id: 'mf3', name: 'Dark Quasar', spellId: 1279420, timestamp: 85, duration: 5, color: '#2C3E50', description: 'Massive AoE' },
      { id: 'mf4', name: "Death's Dirge", spellId: 1244412, timestamp: 120, duration: 4, color: '#5B2C6F' },
      { id: 'mf5', name: 'Total Eclipse', spellId: 1260261, timestamp: 155, duration: 8, color: '#1C1C2E', description: 'Darkness phase — need major CDs' },
      { id: 'mf6', name: "Death's Requiem", spellId: 1273158, timestamp: 195, duration: 5, color: '#17202A', description: 'Lethal raidwide' },
      { id: 'mf7', name: "Heaven's Glaives", spellId: 1253915, timestamp: 230, duration: 3, color: '#4A235A' },
      { id: 'mf8', name: 'Dark Quasar', spellId: 1279420, timestamp: 265, duration: 5, color: '#2C3E50' },
      { id: 'mf9', name: 'Total Eclipse', spellId: 1260261, timestamp: 305, duration: 8, color: '#1C1C2E' },
      { id: 'mf10', name: "Death's Requiem", spellId: 1273158, timestamp: 345, duration: 5, color: '#17202A' },
      { id: 'mf11', name: 'Dark Meltdown', spellId: 1281194, timestamp: 380, duration: 8, color: '#C0392B', description: 'Soft enrage' },
    ],
  },
]

export function getEncounter(id: string): BossEncounter | undefined {
  return ENCOUNTERS.find((e) => e.id === id)
}
