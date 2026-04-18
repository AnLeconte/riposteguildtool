import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface DungeonNote {
  dungeon: string
  notes: string
  tips: string[]
}

const DUNGEONS = [
  'Windrunner Spire', 'Murder Row', 'Den of Nalorakk', 'Maisara Caverns',
  "Magisters' Terrace", 'Pit of Saron', 'Seat of the Triumvirate', 'Skyreach',
]

const STORAGE_KEY = 'dungeon-notes'
function loadNotes(): Record<string, DungeonNote> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}
function saveNotes(notes: Record<string, DungeonNote>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

export function DungeonNotesPage() {
  const [notes, setNotes] = useState<Record<string, DungeonNote>>(loadNotes)
  const [activeDungeon, setActiveDungeon] = useState<string>(DUNGEONS[0])
  const [newTip, setNewTip] = useState('')

  useEffect(() => { saveNotes(notes) }, [notes])

  const current = notes[activeDungeon] ?? { dungeon: activeDungeon, notes: '', tips: [] }

  const updateNotes = (text: string) => {
    setNotes((prev) => ({ ...prev, [activeDungeon]: { ...current, dungeon: activeDungeon, notes: text } }))
  }

  const addTip = () => {
    if (!newTip.trim()) return
    setNotes((prev) => ({
      ...prev,
      [activeDungeon]: { ...current, dungeon: activeDungeon, tips: [...current.tips, newTip.trim()] },
    }))
    setNewTip('')
  }

  const removeTip = (idx: number) => {
    setNotes((prev) => ({
      ...prev,
      [activeDungeon]: { ...current, tips: current.tips.filter((_, i) => i !== idx) },
    }))
  }

  return (
    <div className="w-full space-y-6">
      <div>
      <PageHeader title="Dungeon" highlight="Notes" description="Personal notes and tips for each M+ dungeon" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Dungeon list */}
        <div className="space-y-1">
          {DUNGEONS.map((d) => {
            const hasNotes = !!(notes[d]?.notes || notes[d]?.tips?.length)
            return (
              <button key={d} onClick={() => setActiveDungeon(d)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center justify-between ${
                  activeDungeon === d ? 'bg-[color:var(--class-color)]/[0.06] border border-[color:var(--class-color)]/30' : 'border border-transparent hover:bg-white/[0.03]'
                }`}>
                <span className="text-sm font-medium text-gray-200 truncate">{d}</span>
                {hasNotes && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--class-color)]/60 flex-shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Notes editor */}
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-base font-semibold text-gray-200 mb-1">{activeDungeon}</h2>
            <p className="text-[10px] text-gray-600 mb-3">Your personal notes for this dungeon</p>
            <Textarea value={current.notes} onChange={(e) => updateNotes(e.target.value)}
              rows={8} placeholder="Route notes, dangerous packs, interrupt priorities, skip strategies..." />
          </Card>

          {/* Quick tips */}
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Quick Tips</h3>

            {current.tips.length > 0 && (
              <div className="space-y-1.5">
                {current.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-wow-darker/60 border border-white/[0.06] group">
                    <span className="text-[color:var(--class-color)] text-xs mt-0.5 flex-shrink-0">{'\u2022'}</span>
                    <span className="text-xs text-gray-300 flex-1">{tip}</span>
                    <button onClick={() => removeTip(i)}
                      className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 text-[10px] flex-shrink-0">{'\u2715'}</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input value={newTip} onChange={(e) => setNewTip(e.target.value)}
                placeholder="Add a quick tip..."
                className="flex-1 rounded-lg bg-wow-darker/80 border border-white/[0.08] px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-wow-gold/30"
                onKeyDown={(e) => e.key === 'Enter' && addTip()} />
              <button onClick={addTip}
                className="text-xs text-[color:var(--class-color)]/70 hover:text-[color:var(--class-color)] px-3 transition-colors">Add</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
