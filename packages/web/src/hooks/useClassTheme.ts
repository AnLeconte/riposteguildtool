import { useEffect } from 'react'
import { useCharacterStore } from '@/stores/useCharacterStore'

const CLASS_COLORS: Record<string, string> = {
  'Warrior': '#C79C6E',
  'Paladin': '#F58CBA',
  'Hunter': '#ABD473',
  'Rogue': '#FFF569',
  'Priest': '#FFFFFF',
  'Death Knight': '#C41F3B',
  'Shaman': '#0070DE',
  'Mage': '#69CCF0',
  'Warlock': '#9482C9',
  'Monk': '#00FF96',
  'Druid': '#FF7D0A',
  'Demon Hunter': '#A330C9',
  'Evoker': '#33937F',
}

const DEFAULT_COLOR = '#FFD100' // wow-gold

/**
 * Sets CSS custom property --class-color based on the active character's class.
 * Use with Tailwind: text-[color:var(--class-color)], bg-[color:var(--class-color)], etc.
 */
export function useClassTheme() {
  const active = useCharacterStore((s) => s.getActive())

  useEffect(() => {
    const color = (active?.class ? CLASS_COLORS[active.class] : null) ?? DEFAULT_COLOR
    document.documentElement.style.setProperty('--class-color', color)

    // Also set a low-opacity version for backgrounds
    document.documentElement.style.setProperty('--class-color-10', color + '1a') // 10% opacity
    document.documentElement.style.setProperty('--class-color-20', color + '33') // 20% opacity

    return () => {
      document.documentElement.style.setProperty('--class-color', DEFAULT_COLOR)
      document.documentElement.style.setProperty('--class-color-10', DEFAULT_COLOR + '1a')
      document.documentElement.style.setProperty('--class-color-20', DEFAULT_COLOR + '33')
    }
  }, [active?.class])
}
