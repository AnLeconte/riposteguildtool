import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ItemLink } from '@/components/ui/ItemLink'
import { api } from '@/lib/api'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface BisItem {
  slot: string
  itemId: number
  name: string
  ilvl: number
  dpsGain: number
  dpsPct: number
  source: string
  iconUrl?: string
}

interface SavedBisList {
  characterId: string | null
  characterName: string
  items: BisItem[]
  generatedAt: string
}

const SLOT_ORDER = [
  'head', 'neck', 'shoulders', 'back', 'chest', 'wrists',
  'hands', 'waist', 'legs', 'feet', 'finger1', 'finger2',
  'trinket1', 'trinket2', 'main_hand', 'off_hand',
]

const SLOT_LABELS: Record<string, string> = {
  head: 'Head', neck: 'Neck', shoulders: 'Shoulders', back: 'Back', chest: 'Chest',
  wrists: 'Wrists', hands: 'Hands', waist: 'Waist', legs: 'Legs', feet: 'Feet',
  finger1: 'Ring 1', finger2: 'Ring 2', trinket1: 'Trinket 1', trinket2: 'Trinket 2',
  main_hand: 'Main Hand', off_hand: 'Off Hand',
}

const STORAGE_KEY = 'bis-lists'

function loadSavedLists(): SavedBisList[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveLists(lists: SavedBisList[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists))
}

export function BisListPage() {
  const [savedLists, setSavedLists] = useState<SavedBisList[]>(loadSavedLists)
  const [activeList, setActiveList] = useState<SavedBisList | null>(null)
  const [sims, setSims] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const active = useCharacterStore((s) => s.getActive())

  useEffect(() => { saveLists(savedLists) }, [savedLists])

  // Auto-load the list for the active character
  useEffect(() => {
    if (active && !activeList) {
      const existing = savedLists.find((l) => l.characterId === active.id)
      if (existing) setActiveList(existing)
    }
  }, [active, savedLists])

  useEffect(() => {
    setLoading(true)
    api.getHistory(50).then((data) => {
      setSims(data.filter((s: any) => s.sim_type === 'droptimizer' && s.status === 'completed'))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const generateFromSim = async (simId: string) => {
    setGenerating(true)
    try {
      const sim = await api.getSimulation(simId)
      if (!sim.profileset_results || !sim.sim_options?.items) return

      const items = sim.sim_options.items as any[]
      const results = sim.profileset_results as any[]
      const resultMap = new Map<string, any>()
      for (const r of results) resultMap.set(r.name, r)

      const bestPerSlot = new Map<string, BisItem>()
      for (const item of items) {
        const key = `${item.boss_name} - ${item.name} (${item.item_level})`
        const result = resultMap.get(key)
        if (!result || (result.dps_delta ?? 0) <= 0) continue
        const existing = bestPerSlot.get(item.slot)
        if (!existing || (result.dps_delta ?? 0) > existing.dpsGain) {
          bestPerSlot.set(item.slot, {
            slot: item.slot, itemId: item.id, name: item.name, ilvl: item.item_level,
            dpsGain: result.dps_delta ?? 0, dpsPct: result.dps_delta_pct ?? 0,
            source: item.boss_name, iconUrl: item.icon_url,
          })
        }
      }

      const bisList = SLOT_ORDER.map((slot) => bestPerSlot.get(slot)).filter((i): i is BisItem => !!i)
      const newList: SavedBisList = {
        characterId: active?.id ?? null,
        characterName: active?.name ?? 'Unknown',
        items: bisList,
        generatedAt: new Date().toISOString(),
      }

      setActiveList(newList)
      setSavedLists((prev) => {
        const filtered = prev.filter((l) => l.characterId !== newList.characterId)
        return [newList, ...filtered]
      })
    } catch { /* skip */ }
    finally { setGenerating(false) }
  }

  const totalDpsGain = activeList?.items.reduce((s, i) => s + i.dpsGain, 0) ?? 0

  return (
    <div className="w-full space-y-6">
      <PageHeader title="BiS" highlight="List"
        description={active ? `Best in Slot for ${active.name} — ${active.spec} ${active.class}` : 'Best in Slot from your droptimizer results'} />

      {/* Generate from sim */}
      <Card className="p-4">
        <label className="text-xs font-medium text-gray-400 block mb-2">Generate from droptimizer</label>
        {loading ? (
          <p className="text-gray-500 text-sm animate-pulse">Loading simulations...</p>
        ) : sims.length === 0 ? (
          <p className="text-gray-600 text-sm">No droptimizer sims found. Run a droptimizer first.</p>
        ) : (
          <div className="space-y-1">
            {sims.slice(0, 5).map((sim) => (
              <button key={sim.id} onClick={() => generateFromSim(sim.id)} disabled={generating}
                className="w-full text-left px-3 py-2 rounded-lg border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.02] transition-all flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-200">
                    {sim.sim_options?.instances?.map((i: any) => i.name).join(', ') || 'Droptimizer'}
                  </span>
                  <span className="text-[10px] text-gray-600 ml-2">
                    {new Date(sim.created_at).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-[10px] text-[color:var(--class-color)]/70">{generating ? 'Generating...' : 'Generate'}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Saved lists for other characters */}
      {savedLists.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {savedLists.map((list, i) => (
            <button key={i} onClick={() => setActiveList(list)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                activeList === list ? 'border-[color:var(--class-color)]/30 text-[color:var(--class-color)] bg-[color:var(--class-color)]/[0.06]' : 'border-white/[0.06] text-gray-500 hover:text-gray-300'
              }`}>
              {list.characterName}
            </button>
          ))}
        </div>
      )}

      {/* BiS items */}
      {activeList && activeList.items.length > 0 ? (
        <div className="space-y-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-300">{activeList.characterName}'s BiS Upgrades</h2>
              <p className="text-[10px] text-gray-600">Generated {new Date(activeList.generatedAt).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-green-400">+{Math.round(totalDpsGain).toLocaleString()}</p>
              <p className="text-[10px] text-gray-600">Total DPS gain</p>
            </div>
          </Card>

          <div className="space-y-1.5">
            {activeList.items.map((item) => (
              <div key={item.slot} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/[0.04] bg-wow-panel/30 hover:border-white/[0.08] transition-all">
                <div className="w-16 flex-shrink-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">{SLOT_LABELS[item.slot] ?? item.slot}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <ItemLink itemId={item.itemId} name={item.name} ilvl={item.ilvl} iconUrl={item.iconUrl}
                    className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors" />
                  <p className="text-[10px] text-gray-600 mt-0.5">{item.source} — ilvl {item.ilvl}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-green-400 tabular-nums">+{Math.round(item.dpsGain).toLocaleString()}</p>
                  <p className="text-[10px] text-green-600 tabular-nums">+{item.dpsPct.toFixed(2)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !activeList && (
        <Card><div className="text-center py-16 space-y-3">
          <p className="text-3xl text-gray-700">{'\uD83C\uDFC6'}</p>
          <p className="text-gray-500">Generate a BiS list from your droptimizer results</p>
        </div></Card>
      )}
    </div>
  )
}
