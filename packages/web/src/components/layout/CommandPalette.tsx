import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from '@/hooks/useDebounce'

interface Command {
  label: string
  path: string
  category: string
  keywords: string
}

const COMMANDS: Command[] = [
  // Simulate
  { label: 'Quick Sim', path: '/quick-sim', category: 'Simulate', keywords: 'sim dps quick fast' },
  { label: 'Top Gear', path: '/top-gear', category: 'Simulate', keywords: 'gear bag best combo' },
  { label: 'Droptimizer', path: '/droptimizer', category: 'Simulate', keywords: 'drop loot upgrade raid dungeon' },
  { label: 'Stat Weights', path: '/stat-weights', category: 'Simulate', keywords: 'stats scale factors pawn' },
  { label: 'Gear Compare', path: '/gear-compare', category: 'Simulate', keywords: 'compare sets a b' },
  { label: 'Advanced', path: '/advanced', category: 'Simulate', keywords: 'editor simc profile apl' },
  // Hubs
  { label: 'Raid Hub', path: '/raid', category: 'Hub', keywords: 'raid cd planner notes assignments roster comp loot' },
  { label: 'Gear Hub', path: '/gear', category: 'Hub', keywords: 'gear bis list upgrade vault' },
  { label: 'Character', path: '/character', category: 'Hub', keywords: 'character profile gear enchant compare' },
  { label: 'Guild', path: '/guild', category: 'Hub', keywords: 'guild roster mythic plus progression' },
  { label: 'Logs', path: '/logs', category: 'Hub', keywords: 'logs warcraft wcl report parse compare' },
  { label: 'Mythic+', path: '/mplus', category: 'Hub', keywords: 'mythic plus score goal dungeon notes keystones' },
  { label: 'Weekly Reset', path: '/weekly', category: 'Tools', keywords: 'weekly reset vault checklist' },
  { label: 'Macros', path: '/macros', category: 'Tools', keywords: 'macro library mouseover focus' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery('')
        setSelectedIdx(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Focus input when open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const debouncedQuery = useDebounce(query, 150)
  const filtered = useMemo(() =>
    debouncedQuery.trim()
      ? COMMANDS.filter((c) => {
          const q = debouncedQuery.toLowerCase()
          return c.label.toLowerCase().includes(q) || c.keywords.includes(q) || c.category.toLowerCase().includes(q)
        })
      : COMMANDS,
    [debouncedQuery]
  )

  const handleSelect = (cmd: Command) => {
    navigate(cmd.path)
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[selectedIdx]) { handleSelect(filtered[selectedIdx]) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-wow-panel/95 backdrop-blur-xl shadow-2xl shadow-black/50 animate-fade-in overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none" />
          <kbd className="text-[9px] text-gray-600 bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No results</p>
          ) : (
            filtered.map((cmd, i) => (
              <button key={cmd.path} onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  i === selectedIdx ? 'bg-[color:var(--class-color)]/[0.06] text-[color:var(--class-color)]' : 'text-gray-300 hover:bg-white/[0.03]'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{cmd.label}</span>
                </div>
                <span className="text-[10px] text-gray-600">{cmd.category}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-4">
          <span className="text-[9px] text-gray-600"><kbd className="bg-white/[0.04] border border-white/[0.08] px-1 py-0.5 rounded mr-1">{'\u2191\u2193'}</kbd>Navigate</span>
          <span className="text-[9px] text-gray-600"><kbd className="bg-white/[0.04] border border-white/[0.08] px-1 py-0.5 rounded mr-1">{'\u23CE'}</kbd>Open</span>
          <span className="text-[9px] text-gray-600"><kbd className="bg-white/[0.04] border border-white/[0.08] px-1 py-0.5 rounded mr-1">Esc</kbd>Close</span>
        </div>
      </div>
    </div>
  )
}
