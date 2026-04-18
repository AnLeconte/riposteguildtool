import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface RosterMember {
  id: string
  name: string
  class: string
  spec: string
  role: 'tank' | 'healer' | 'dps'
  group: number // 1-4
  note: string
}

interface RosterPlan {
  id: string
  name: string
  members: RosterMember[]
  createdAt: string
}

const STORAGE_KEY = 'roster-plans'
const uid = () => Math.random().toString(36).slice(2, 10)
function loadPlans(): RosterPlan[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] } }
function savePlans(p: RosterPlan[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) }

const CLASS_COLORS: Record<string, string> = {
  'Death Knight': '#C41F3B', 'Demon Hunter': '#A330C9', Druid: '#FF7D0A', Evoker: '#33937F',
  Hunter: '#ABD473', Mage: '#69CCF0', Monk: '#00FF96', Paladin: '#F58CBA',
  Priest: '#FFFFFF', Rogue: '#FFF569', Shaman: '#0070DE', Warlock: '#9482C9', Warrior: '#C79C6E',
}

const CLASSES = Object.keys(CLASS_COLORS)

const ROLE_SPECS: Record<string, string[]> = {
  tank: ['Blood', 'Vengeance', 'Guardian', 'Brewmaster', 'Protection'],
  healer: ['Restoration', 'Holy', 'Discipline', 'Mistweaver', 'Preservation'],
  dps: ['Frost', 'Unholy', 'Havoc', 'Balance', 'Feral', 'Devastation', 'Augmentation', 'Beast Mastery', 'Marksmanship', 'Survival', 'Arcane', 'Fire', 'Windwalker', 'Retribution', 'Shadow', 'Assassination', 'Outlaw', 'Subtlety', 'Elemental', 'Enhancement', 'Affliction', 'Demonology', 'Destruction', 'Arms', 'Fury'],
}

export function RosterPlannerPage() {
  const [plans, setPlans] = useState<RosterPlan[]>(loadPlans)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addName, setAddName] = useState('')
  const [addClass, setAddClass] = useState('Warrior')
  const [addRole, setAddRole] = useState<'tank' | 'healer' | 'dps'>('dps')
  const [addSpec, setAddSpec] = useState('')

  useEffect(() => { savePlans(plans) }, [plans])

  const activePlan = plans.find((p) => p.id === activeId)

  const createPlan = () => {
    const plan: RosterPlan = { id: uid(), name: 'New Roster', members: [], createdAt: new Date().toISOString() }
    setPlans((prev) => [plan, ...prev])
    setActiveId(plan.id)
  }

  const deletePlan = (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const renamePlan = (name: string) => {
    if (!activeId) return
    setPlans((prev) => prev.map((p) => p.id === activeId ? { ...p, name } : p))
  }

  const addMember = () => {
    if (!activeId || !addName.trim()) return
    const member: RosterMember = { id: uid(), name: addName.trim(), class: addClass, spec: addSpec, role: addRole, group: 1, note: '' }
    setPlans((prev) => prev.map((p) => p.id === activeId ? { ...p, members: [...p.members, member] } : p))
    setAddName('')
  }

  const removeMember = (memberId: string) => {
    if (!activeId) return
    setPlans((prev) => prev.map((p) => p.id === activeId ? { ...p, members: p.members.filter((m) => m.id !== memberId) } : p))
  }

  const setGroup = (memberId: string, group: number) => {
    if (!activeId) return
    setPlans((prev) => prev.map((p) => p.id === activeId ? { ...p, members: p.members.map((m) => m.id === memberId ? { ...m, group } : m) } : p))
  }

  const groups = [1, 2, 3, 4]

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roster <span className="text-[color:var(--class-color)]">Planner</span></h1>
          <p className="text-gray-500 text-sm mt-1">Build and organize your raid groups</p>
        </div>
        <Button onClick={createPlan} size="sm">New Roster</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Plans list */}
        <div className="space-y-1">
          {plans.length === 0 && <Card className="p-3"><p className="text-gray-600 text-xs text-center">No rosters</p></Card>}
          {plans.map((plan) => (
            <button key={plan.id} onClick={() => setActiveId(plan.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                activeId === plan.id ? 'bg-[color:var(--class-color)]/[0.06] border border-[color:var(--class-color)]/30' : 'border border-transparent hover:bg-white/[0.03]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-200">{plan.name}</p>
                  <p className="text-[10px] text-gray-600">{plan.members.length} players</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deletePlan(plan.id) }} className="text-gray-700 hover:text-red-400 text-[10px]">&#10005;</button>
              </div>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div>
          {!activePlan ? (
            <Card><div className="text-center py-16 space-y-3">
              <p className="text-3xl text-gray-700">&#128101;</p>
              <p className="text-gray-500">Select or create a roster</p>
            </div></Card>
          ) : (
            <div className="space-y-4">
              {/* Roster name */}
              <Card className="p-4">
                <input value={activePlan.name} onChange={(e) => renamePlan(e.target.value)}
                  className="w-full bg-transparent text-base font-semibold text-gray-200 focus:outline-none border-b border-transparent focus:border-[color:var(--class-color)]/40 pb-1" />
              </Card>

              {/* Add member */}
              <Card className="p-4">
                <div className="flex gap-2 flex-wrap">
                  <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Player name" className="w-32"
                    onKeyDown={(e) => e.key === 'Enter' && addMember()} />
                  <Select value={addClass} onChange={(e) => setAddClass(e.target.value)}
                    >
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Select value={addRole} onChange={(e) => setAddRole(e.target.value as any)}
                    >
                    <option value="tank">Tank</option>
                    <option value="healer">Healer</option>
                    <option value="dps">DPS</option>
                  </Select>
                  <Input value={addSpec} onChange={(e) => setAddSpec(e.target.value)} placeholder="Spec" className="w-28" />
                  <Button onClick={addMember} size="sm" disabled={!addName.trim()}>Add</Button>
                </div>
              </Card>

              {/* Groups */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {groups.map((g) => {
                  const members = activePlan.members.filter((m) => m.group === g)
                  return (
                    <Card key={g} className="p-0 overflow-hidden">
                      <div className="px-3 py-2 border-b border-white/[0.06] bg-wow-darker/40">
                        <span className="text-xs font-semibold text-gray-400">Group {g}</span>
                        <span className="text-[10px] text-gray-600 ml-2">{members.length}/5</span>
                      </div>
                      <div className="p-2 space-y-1 min-h-[120px]">
                        {members.map((m) => (
                          <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] group">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CLASS_COLORS[m.class] ?? '#888' }} />
                            <span className="text-xs font-medium text-gray-200 flex-1 truncate">{m.name}</span>
                            <span className={`text-[8px] font-medium px-1 py-0.5 rounded ${
                              m.role === 'tank' ? 'text-blue-400 bg-blue-500/10' :
                              m.role === 'healer' ? 'text-green-400 bg-green-500/10' :
                              'text-red-400 bg-red-500/10'}`}>{m.role[0].toUpperCase()}</span>
                            <Select value={m.group} onChange={(e) => setGroup(m.id, Number(e.target.value))}
                              >
                              {groups.map((gg) => <option key={gg} value={gg}>{gg}</option>)}
                            </Select>
                            <button onClick={() => removeMember(m.id)} className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 text-[9px]">&#10005;</button>
                          </div>
                        ))}
                        {members.length === 0 && <p className="text-gray-700 text-[10px] text-center py-4">Empty</p>}
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* Summary */}
              <div className="flex gap-4 text-xs text-gray-500">
                <span>{activePlan.members.filter((m) => m.role === 'tank').length} tanks</span>
                <span>{activePlan.members.filter((m) => m.role === 'healer').length} healers</span>
                <span>{activePlan.members.filter((m) => m.role === 'dps').length} dps</span>
                <span className="text-gray-600">= {activePlan.members.length} total</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
