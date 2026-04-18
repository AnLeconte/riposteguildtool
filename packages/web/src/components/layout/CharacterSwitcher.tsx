import { useEffect, useRef, useState } from 'react'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { cn } from '@/lib/utils'
import { cachedImg } from '@/lib/cached-image'

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569',
  Priest: '#FFFFFF', 'Death Knight': '#C41F3B', Shaman: '#0070DE', Mage: '#69CCF0',
  Warlock: '#9482C9', Monk: '#00FF96', Druid: '#FF7D0A', 'Demon Hunter': '#A330C9',
  Evoker: '#33937F',
}

export function CharacterSwitcher() {
  const { characters, activeId, setActive, removeCharacter, refreshCharacter } = useCharacterStore()
  const [open, setOpen] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const handleRefresh = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setRefreshingId(id)
    await refreshCharacter(id)
    setRefreshingId(null)
  }

  const active = characters.find((c) => c.id === activeId)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (characters.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
        {active && (
          <>
            {active.avatarUrl ? (
              <img src={cachedImg(active.avatarUrl)} alt="" className="w-5 h-5 rounded-full border border-white/[0.15]" />
            ) : (
              <div className="w-5 h-5 rounded-full" style={{ backgroundColor: CLASS_COLORS[active.class] ?? '#666' }} />
            )}
            <span className="text-[12px] font-medium text-gray-300 hidden sm:inline">{active.name}</span>
          </>
        )}
        <svg className={cn('w-3 h-3 text-gray-500 transition-transform', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-56 py-1.5 rounded-xl border border-white/[0.08] bg-wow-panel/95 backdrop-blur-xl shadow-lg shadow-black/30 animate-fade-in-down z-50">
          <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-gray-600">Characters</p>
          {characters.map((char) => (
            <div key={char.id}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors',
                activeId === char.id ? 'bg-[color:var(--class-color)]/[0.06]' : 'hover:bg-white/[0.04]',
              )}
              onClick={() => { setActive(char.id); setOpen(false) }}>
              {char.avatarUrl ? (
                <img src={cachedImg(char.avatarUrl)} alt="" className="w-6 h-6 rounded-full border border-white/[0.1]" />
              ) : (
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: CLASS_COLORS[char.class] ?? '#666' }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-gray-200 truncate">{char.name}</p>
                <p className="text-[9px] text-gray-600">{char.spec} {char.class} — {char.ilvl} ilvl</p>
              </div>
              {activeId === char.id && <span className="text-[color:var(--class-color)] text-[10px]">&#10003;</span>}
              <button onClick={(e) => handleRefresh(e, char.id)}
                disabled={refreshingId === char.id}
                title="Rafraîchir le profil"
                className="text-[10px] text-gray-700 hover:text-wow-blue transition-colors disabled:opacity-50">
                <svg className={cn('w-3 h-3', refreshingId === char.id && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button onClick={(e) => { e.stopPropagation(); removeCharacter(char.id) }}
                className="text-[10px] text-gray-700 hover:text-red-400 transition-colors">&#10005;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
