import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { cachedImg } from '@/lib/cached-image'

// Map WoW class names to API-compatible keys
const CLASS_KEYS: Record<string, string> = {
  'Death Knight': 'death_knight',
  'Demon Hunter': 'demon_hunter',
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
}

interface IconEntry {
  classIcon?: string
  specIcon?: string
}

// Module-level cache so it persists across component mounts
const iconCache = new Map<string, IconEntry>()
let fetchPromise: Promise<void> | null = null

async function fetchAllIcons() {
  const classes = Object.entries(CLASS_KEYS)
  const specs: Array<{ cls: string; spec: string }> = [
    // Death Knight
    { cls: 'death_knight', spec: 'blood' }, { cls: 'death_knight', spec: 'frost' }, { cls: 'death_knight', spec: 'unholy' },
    // Demon Hunter
    { cls: 'demon_hunter', spec: 'havoc' }, { cls: 'demon_hunter', spec: 'vengeance' },
    // Druid
    { cls: 'druid', spec: 'balance' }, { cls: 'druid', spec: 'feral' }, { cls: 'druid', spec: 'guardian' }, { cls: 'druid', spec: 'restoration' },
    // Evoker
    { cls: 'evoker', spec: 'devastation' }, { cls: 'evoker', spec: 'preservation' }, { cls: 'evoker', spec: 'augmentation' },
    // Hunter
    { cls: 'hunter', spec: 'beast_mastery' }, { cls: 'hunter', spec: 'marksmanship' }, { cls: 'hunter', spec: 'survival' },
    // Mage
    { cls: 'mage', spec: 'arcane' }, { cls: 'mage', spec: 'fire' }, { cls: 'mage', spec: 'frost' },
    // Monk
    { cls: 'monk', spec: 'brewmaster' }, { cls: 'monk', spec: 'mistweaver' }, { cls: 'monk', spec: 'windwalker' },
    // Paladin
    { cls: 'paladin', spec: 'holy' }, { cls: 'paladin', spec: 'protection' }, { cls: 'paladin', spec: 'retribution' },
    // Priest
    { cls: 'priest', spec: 'discipline' }, { cls: 'priest', spec: 'holy' }, { cls: 'priest', spec: 'shadow' },
    // Rogue
    { cls: 'rogue', spec: 'assassination' }, { cls: 'rogue', spec: 'outlaw' }, { cls: 'rogue', spec: 'subtlety' },
    // Shaman
    { cls: 'shaman', spec: 'elemental' }, { cls: 'shaman', spec: 'enhancement' }, { cls: 'shaman', spec: 'restoration' },
    // Warlock
    { cls: 'warlock', spec: 'affliction' }, { cls: 'warlock', spec: 'demonology' }, { cls: 'warlock', spec: 'destruction' },
    // Warrior
    { cls: 'warrior', spec: 'arms' }, { cls: 'warrior', spec: 'fury' }, { cls: 'warrior', spec: 'protection' },
  ]

  // Fetch all spec icons in parallel (class icon comes for free)
  await Promise.all(
    specs.map(async ({ cls, spec }) => {
      try {
        const data = await api.getClassIcon(cls, spec)
        const key = `${cls}:${spec}`
        iconCache.set(key, {
          classIcon: cachedImg(data.class_icon_url),
          specIcon: cachedImg(data.spec_icon_url),
        })
        // Also cache class-only
        if (data.class_icon_url && !iconCache.has(cls)) {
          iconCache.set(cls, { classIcon: cachedImg(data.class_icon_url) })
        }
      } catch { /* skip */ }
    }),
  )
}

/**
 * Returns a function to get class/spec icons.
 * Icons are fetched once and cached permanently in memory.
 */
export function useClassIcons() {
  const [ready, setReady] = useState(iconCache.size > 0)

  useEffect(() => {
    if (iconCache.size > 0) { setReady(true); return }
    if (!fetchPromise) {
      fetchPromise = fetchAllIcons().finally(() => setReady(true))
    } else {
      fetchPromise.finally(() => setReady(true))
    }
  }, [])

  const getSpecIcon = (className: string, specName: string): string | undefined => {
    const cls = CLASS_KEYS[className] ?? className.toLowerCase().replace(/ /g, '_')
    const spec = specName.toLowerCase().replace(/ /g, '_')
    return iconCache.get(`${cls}:${spec}`)?.specIcon
  }

  const getClassIcon = (className: string): string | undefined => {
    const cls = CLASS_KEYS[className] ?? className.toLowerCase().replace(/ /g, '_')
    return iconCache.get(cls)?.classIcon
  }

  return { getSpecIcon, getClassIcon, ready }
}
