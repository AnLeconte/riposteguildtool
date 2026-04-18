import type { HealerSpecDef } from '../types/cooldown-planner.js'

export const HEALER_SPECS: HealerSpecDef[] = [
  {
    spec: 'holy_paladin',
    label: 'Holy Paladin',
    className: 'Paladin',
    classColor: '#F58CBA',
    cooldowns: [
      { id: 'aura_mastery', name: 'Aura Mastery', spellId: 31821, iconName: 'spell_holy_auramastery', spec: 'holy_paladin', cooldownDuration: 180, effectDuration: 8, color: '#F58CBA' },
      { id: 'divine_toll', name: 'Divine Toll', spellId: 375576, iconName: 'ability_bastion_paladin', spec: 'holy_paladin', cooldownDuration: 60, effectDuration: 1, color: '#E8A0C8' },
      { id: 'daybreak', name: 'Daybreak', spellId: 414170, iconName: 'spell_holy_aspiration', spec: 'holy_paladin', cooldownDuration: 60, effectDuration: 6, color: '#FFD700' },
    ],
  },
  {
    spec: 'holy_priest',
    label: 'Holy Priest',
    className: 'Priest',
    classColor: '#FFFFFF',
    cooldowns: [
      { id: 'divine_hymn', name: 'Divine Hymn', spellId: 64843, iconName: 'spell_holy_divinehymn', spec: 'holy_priest', cooldownDuration: 180, effectDuration: 8, color: '#FFFFFF' },
      { id: 'holy_word_salvation', name: 'Holy Word: Salvation', spellId: 265202, iconName: 'ability_priest_archangel', spec: 'holy_priest', cooldownDuration: 720, effectDuration: 1, color: '#FFE680' },
      { id: 'apotheosis', name: 'Apotheosis', spellId: 200183, iconName: 'ability_priest_ascension', spec: 'holy_priest', cooldownDuration: 120, effectDuration: 20, color: '#DDDDDD' },
    ],
  },
  {
    spec: 'discipline_priest',
    label: 'Discipline Priest',
    className: 'Priest',
    classColor: '#FFFFFF',
    cooldowns: [
      { id: 'power_word_barrier', name: 'Power Word: Barrier', spellId: 62618, iconName: 'spell_holy_powerwordbarrier', spec: 'discipline_priest', cooldownDuration: 180, effectDuration: 10, color: '#FFFFFF' },
      { id: 'evangelism', name: 'Evangelism', spellId: 246287, iconName: 'spell_holy_divineillumination', spec: 'discipline_priest', cooldownDuration: 90, effectDuration: 6, color: '#CCCCCC' },
      { id: 'rapture', name: 'Rapture', spellId: 47536, iconName: 'spell_holy_rapture', spec: 'discipline_priest', cooldownDuration: 90, effectDuration: 9, color: '#BBBBBB' },
    ],
  },
  {
    spec: 'restoration_druid',
    label: 'Restoration Druid',
    className: 'Druid',
    classColor: '#FF7D0A',
    cooldowns: [
      { id: 'tranquility', name: 'Tranquility', spellId: 740, iconName: 'spell_nature_tranquility', spec: 'restoration_druid', cooldownDuration: 180, effectDuration: 8, color: '#FF7D0A' },
      { id: 'incarnation_tree', name: 'Incarnation: Tree of Life', spellId: 33891, iconName: 'ability_druid_treeoflife', spec: 'restoration_druid', cooldownDuration: 180, effectDuration: 30, color: '#66CC33' },
      { id: 'flourish', name: 'Flourish', spellId: 197721, iconName: 'spell_druid_wildburst', spec: 'restoration_druid', cooldownDuration: 60, effectDuration: 6, color: '#88DD44' },
    ],
  },
  {
    spec: 'restoration_shaman',
    label: 'Restoration Shaman',
    className: 'Shaman',
    classColor: '#0070DE',
    cooldowns: [
      { id: 'spirit_link_totem', name: 'Spirit Link Totem', spellId: 98008, iconName: 'spell_shaman_spiritlink', spec: 'restoration_shaman', cooldownDuration: 180, effectDuration: 6, color: '#0070DE' },
      { id: 'healing_tide_totem', name: 'Healing Tide Totem', spellId: 108280, iconName: 'ability_shaman_healingtide', spec: 'restoration_shaman', cooldownDuration: 180, effectDuration: 10, color: '#3399FF' },
      { id: 'ascendance', name: 'Ascendance', spellId: 114052, iconName: 'spell_fire_elementaldevastation', spec: 'restoration_shaman', cooldownDuration: 180, effectDuration: 15, color: '#66BBFF' },
    ],
  },
  {
    spec: 'mistweaver_monk',
    label: 'Mistweaver Monk',
    className: 'Monk',
    classColor: '#00FF96',
    cooldowns: [
      { id: 'revival', name: 'Revival', spellId: 115310, iconName: 'spell_monk_revival', spec: 'mistweaver_monk', cooldownDuration: 180, effectDuration: 1, color: '#00FF96' },
      { id: 'invoke_yulon', name: 'Invoke Yu\'lon', spellId: 322118, iconName: 'ability_monk_celestialconduit', spec: 'mistweaver_monk', cooldownDuration: 180, effectDuration: 25, color: '#33CC77' },
      { id: 'life_cocoon', name: 'Life Cocoon', spellId: 116849, iconName: 'ability_monk_chicocoon', spec: 'mistweaver_monk', cooldownDuration: 120, effectDuration: 12, color: '#66FFAA' },
    ],
  },
  {
    spec: 'preservation_evoker',
    label: 'Preservation Evoker',
    className: 'Evoker',
    classColor: '#33937F',
    cooldowns: [
      { id: 'rewind', name: 'Rewind', spellId: 363534, iconName: 'ability_evoker_rewind', spec: 'preservation_evoker', cooldownDuration: 240, effectDuration: 1, color: '#33937F' },
      { id: 'dream_flight', name: 'Dream Flight', spellId: 359816, iconName: 'ability_evoker_dreamflight', spec: 'preservation_evoker', cooldownDuration: 120, effectDuration: 5, color: '#55BB99' },
      { id: 'stasis', name: 'Stasis', spellId: 370537, iconName: 'ability_evoker_stasis', spec: 'preservation_evoker', cooldownDuration: 90, effectDuration: 1, color: '#44AA88' },
    ],
  },
]

export function getSpecDef(spec: string): HealerSpecDef | undefined {
  return HEALER_SPECS.find((s) => s.spec === spec)
}

export function getCooldownDef(cooldownId: string): HealerSpecDef['cooldowns'][number] | undefined {
  for (const spec of HEALER_SPECS) {
    const cd = spec.cooldowns.find((c) => c.id === cooldownId)
    if (cd) return cd
  }
  return undefined
}
