import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ENCOUNTERS } from '@wow-simc/shared'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface Assignment {
  id: string
  mechanic: string
  players: string[]
}

interface AssignmentSheet {
  id: string
  name: string
  encounterId: string
  assignments: Assignment[]
}

const STORAGE_KEY = 'raid-assignments'
const uid = () => Math.random().toString(36).slice(2, 10)
function loadSheets(): AssignmentSheet[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] } }
function saveSheets(s: AssignmentSheet[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

const raidGroups = new Map<string, typeof ENCOUNTERS>()
for (const e of ENCOUNTERS) { raidGroups.set(e.raid, [...(raidGroups.get(e.raid) ?? []), e]) }

export function RaidAssignmentsPage() {
  const [sheets, setSheets] = useState<AssignmentSheet[]>(loadSheets)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newMechanic, setNewMechanic] = useState('')
  const [newPlayer, setNewPlayer] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { saveSheets(sheets) }, [sheets])

  const active = sheets.find((s) => s.id === activeId)
  const encounter = ENCOUNTERS.find((e) => e.id === active?.encounterId)

  const createSheet = () => {
    const sheet: AssignmentSheet = { id: uid(), name: 'New Assignments', encounterId: '', assignments: [] }
    setSheets((p) => [sheet, ...p])
    setActiveId(sheet.id)
  }

  const deleteSheet = (id: string) => {
    setSheets((p) => p.filter((s) => s.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const updateSheet = (data: Partial<AssignmentSheet>) => {
    if (!activeId) return
    setSheets((p) => p.map((s) => s.id === activeId ? { ...s, ...data } : s))
  }

  const addAssignment = () => {
    if (!activeId || !newMechanic.trim()) return
    const assignment: Assignment = { id: uid(), mechanic: newMechanic.trim(), players: [] }
    updateSheet({ assignments: [...(active?.assignments ?? []), assignment] })
    setNewMechanic('')
  }

  const removeAssignment = (assignId: string) => {
    updateSheet({ assignments: (active?.assignments ?? []).filter((a) => a.id !== assignId) })
  }

  const addPlayerToAssignment = (assignId: string) => {
    if (!newPlayer.trim()) return
    updateSheet({
      assignments: (active?.assignments ?? []).map((a) =>
        a.id === assignId ? { ...a, players: [...a.players, newPlayer.trim()] } : a
      ),
    })
    setNewPlayer('')
  }

  const removePlayerFromAssignment = (assignId: string, idx: number) => {
    updateSheet({
      assignments: (active?.assignments ?? []).map((a) =>
        a.id === assignId ? { ...a, players: a.players.filter((_, i) => i !== idx) } : a
      ),
    })
  }

  // Export as text
  const exportText = () => {
    if (!active) return ''
    const lines: string[] = [`=== ${active.name} ===`]
    if (encounter) lines.push(encounter.name + ' — ' + encounter.raid)
    lines.push('')
    for (const a of active.assignments) {
      lines.push(`[${a.mechanic}]`)
      lines.push(a.players.length > 0 ? a.players.join(', ') : '(unassigned)')
      lines.push('')
    }
    return lines.join('\n')
  }

  const copyExport = () => {
    navigator.clipboard.writeText(exportText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Raid <span className="text-[color:var(--class-color)]">Assignments</span></h1>
          <p className="text-gray-500 text-sm mt-1">Assign players to mechanics for each boss</p>
        </div>
        <Button onClick={createSheet} size="sm">New Sheet</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Sheets list */}
        <div className="space-y-1">
          {sheets.length === 0 && <Card className="p-3"><p className="text-gray-600 text-xs text-center">No sheets</p></Card>}
          {sheets.map((sheet) => (
            <button key={sheet.id} onClick={() => setActiveId(sheet.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                activeId === sheet.id ? 'bg-[color:var(--class-color)]/[0.06] border border-[color:var(--class-color)]/30' : 'border border-transparent hover:bg-white/[0.03]'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-200 truncate">{sheet.name}</p>
                <button onClick={(e) => { e.stopPropagation(); deleteSheet(sheet.id) }} className="text-gray-700 hover:text-red-400 text-[10px]">{'\u2715'}</button>
              </div>
              <p className="text-[10px] text-gray-600">{sheet.assignments.length} mechanics</p>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div>
          {!active ? (
            <Card><div className="text-center py-16 space-y-3">
              <p className="text-3xl text-gray-700">{'\uD83D\uDCCB'}</p>
              <p className="text-gray-500">Select or create an assignment sheet</p>
            </div></Card>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <Card className="p-4">
                <div className="flex gap-3 flex-wrap">
                  <input value={active.name} onChange={(e) => updateSheet({ name: e.target.value })}
                    className="flex-1 bg-transparent text-base font-semibold text-gray-200 focus:outline-none border-b border-transparent focus:border-[color:var(--class-color)]/40 pb-1" />
                  <Select value={active.encounterId} onChange={(e) => updateSheet({ encounterId: e.target.value })}
                    >
                    <option value="">No boss</option>
                    {[...raidGroups.entries()].map(([raid, bosses]) => (
                      <optgroup key={raid} label={raid}>
                        {bosses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </optgroup>
                    ))}
                  </Select>
                  <Button variant="ghost" size="sm" onClick={copyExport}>
                    {copied ? 'Copied!' : 'Copy Text'}
                  </Button>
                </div>
              </Card>

              {/* Add mechanic */}
              <div className="flex gap-2">
                <Input value={newMechanic} onChange={(e) => setNewMechanic(e.target.value)}
                  placeholder="Add mechanic (e.g. Interrupts, Soaks, Kicks...)" className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && addAssignment()} />
                <Button onClick={addAssignment} size="sm" variant="secondary">Add</Button>
              </div>

              {/* Assignments */}
              {active.assignments.length === 0 ? (
                <Card><p className="text-gray-600 text-xs text-center py-8">Add mechanics to start assigning players</p></Card>
              ) : (
                <div className="space-y-3">
                  {active.assignments.map((assign) => (
                    <Card key={assign.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-[color:var(--class-color)]">{assign.mechanic}</h4>
                        <button onClick={() => removeAssignment(assign.id)} className="text-[10px] text-gray-600 hover:text-red-400">{'\u2715'}</button>
                      </div>

                      {/* Assigned players */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {assign.players.map((p, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-wow-accent/30 border border-white/[0.08] text-xs font-medium text-gray-200">
                            {p}
                            <button onClick={() => removePlayerFromAssignment(assign.id, i)}
                              className="text-gray-500 hover:text-red-400 text-[8px] ml-0.5">{'\u2715'}</button>
                          </span>
                        ))}
                        {assign.players.length === 0 && <span className="text-[10px] text-gray-600 italic">No players assigned</span>}
                      </div>

                      {/* Add player */}
                      <div className="flex gap-2">
                        <Input value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)}
                          placeholder="Player name" className="w-40 text-xs"
                          onKeyDown={(e) => { if (e.key === 'Enter') { addPlayerToAssignment(assign.id) } }} />
                        <Button variant="ghost" size="sm" onClick={() => addPlayerToAssignment(assign.id)}>Add</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
