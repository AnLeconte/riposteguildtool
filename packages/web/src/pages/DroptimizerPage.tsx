import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { SimcInput } from '@/components/sim/SimcInput'
import { ItemLink } from '@/components/ui/ItemLink'
import { PageHeader } from '@/components/ui/PageHeader'
import { api } from '@/lib/api'
import { useSimStore } from '@/stores/useSimStore'

interface LootItem {
  id: number
  name: string
  slot: string
  item_level: number
  icon_url?: string
  bonus_ids?: number[]
}

interface InstanceBoss {
  id: number
  name: string
  loot: LootItem[]
}

interface Instance {
  id: number
  blizzard_id: number
  name: string
  type: 'raid' | 'dungeon'
  bosses: InstanceBoss[]
  image_url?: string
}

interface InstanceSummary {
  id: number
  blizzard_id: number
  name: string
  type: 'raid' | 'dungeon'
  dungeon_pool?: 'mythic_plus' | 'mythic_zero' | 'both'
  boss_count: number
}

export function DroptimizerPage() {
  const [simcInput, setSimcInput] = useState('')
  const [instances, setInstances] = useState<InstanceSummary[]>([])
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<number>>(new Set())
  const [instanceData, setInstanceData] = useState<Map<number, Instance>>(new Map())
  const [loadingInstanceIds, setLoadingInstanceIds] = useState<Set<number>>(new Set())
  const [mode, setMode] = useState<'raid' | 'dungeon'>('raid')
  const [difficulty, setDifficulty] = useState<string>('heroic')
  const [loadingInstances, setLoadingInstances] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setSimId } = useSimStore()

  const raids = instances.filter((i) => i.type === 'raid')
  const dungeons = instances.filter((i) => i.type === 'dungeon')

  // Filter dungeons by pool based on selected difficulty
  // M0: all dungeons are playable in M0
  // M+: only dungeons in the current seasonal M+ rotation
  const isMythicPlus = difficulty.startsWith('m+')
  const filteredDungeons = isMythicPlus
    ? dungeons.filter((d) => !d.dungeon_pool || d.dungeon_pool === 'mythic_plus')
    : dungeons // M0 = all dungeons
  const visibleInstances = mode === 'raid' ? raids : filteredDungeons

  // Load instance list on mount
  useEffect(() => {
    api.getRaids()
      .then((data) => setInstances(data))
      .catch(() => setError('Failed to load instances'))
      .finally(() => setLoadingInstances(false))
  }, [])

  // Pre-fetch instances for the visible list (banners + loot data)
  useEffect(() => {
    if (instances.length === 0) return
    for (const inst of visibleInstances) {
      if (instanceData.has(inst.id) || loadingInstanceIds.has(inst.id)) continue
      setLoadingInstanceIds((prev) => new Set(prev).add(inst.id))
      api.getRaid(inst.id)
        .then((data: Instance) => {
          setInstanceData((prev) => new Map(prev).set(inst.id, data))
        })
        .catch(() => { /* skip */ })
        .finally(() => {
          setLoadingInstanceIds((prev) => {
            const next = new Set(prev)
            next.delete(inst.id)
            return next
          })
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, mode, difficulty])

  // Deselect instances that are no longer visible when difficulty changes
  useEffect(() => {
    if (mode !== 'dungeon') return
    const visibleIds = new Set(filteredDungeons.map((d) => d.id))
    setSelectedInstanceIds((prev) => {
      const next = new Set<number>()
      for (const id of prev) {
        if (visibleIds.has(id)) next.add(id)
      }
      if (next.size === prev.size) return prev
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty])

  // When switching mode, clear selection
  const switchMode = (newMode: 'raid' | 'dungeon') => {
    if (newMode === mode) return
    setMode(newMode)
    setSelectedInstanceIds(new Set())
    setDifficulty(newMode === 'raid' ? 'heroic' : 'mythic0')
  }

  const toggleInstance = (id: number) => {
    setSelectedInstanceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedInstanceIds(new Set(visibleInstances.map((i) => i.id)))
  }

  const deselectAll = () => {
    setSelectedInstanceIds(new Set())
  }

  const allSelected = visibleInstances.length > 0 && visibleInstances.every((i) => selectedInstanceIds.has(i.id))

  // Total items across all selected instances
  const totalItems = [...selectedInstanceIds].reduce((sum, id) => {
    const inst = instanceData.get(id)
    if (!inst) return sum
    return sum + inst.bosses.reduce((s, b) => s + b.loot.length, 0)
  }, 0)

  // Any selected still loading?
  const anySelectedLoading = [...selectedInstanceIds].some((id) => loadingInstanceIds.has(id))

  const handleSimulate = async () => {
    if (!simcInput.trim()) {
      setError('Please paste your /simc string')
      return
    }
    if (selectedInstanceIds.size === 0) {
      setError(`Please select at least one ${mode}`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await api.droptimizer(
        simcInput,
        Array.from(selectedInstanceIds),
        undefined,
        difficulty,
      )
      setSimId(result.id)
      navigate(`/sim/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start simulation')
    } finally {
      setLoading(false)
    }
  }

  const isDungeon = mode === 'dungeon'

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Drop" highlight="timizer" description={`Select ${mode === 'raid' ? 'raids' : 'dungeons'} to find your best potential upgrades.`} />

      {/* Character input */}
      <Card>
        <SimcInput value={simcInput} onChange={setSimcInput} rows={8} />
      </Card>

      {/* Mode toggle: Raids / Dungeons */}
      <div className="flex items-center gap-1 bg-wow-darker rounded-lg p-1 border border-wow-accent/30">
        <button
          onClick={() => switchMode('raid')}
          className={[
            'flex-1 py-2.5 rounded-md text-sm font-semibold transition-all',
            mode === 'raid'
              ? 'bg-[color:var(--class-color)]/15 text-[color:var(--class-color)] border border-[color:var(--class-color)]/40'
              : 'text-gray-400 hover:text-gray-300 border border-transparent',
          ].join(' ')}
        >
          Raids
          {raids.length > 0 && (
            <span className="ml-1.5 text-xs opacity-60">({raids.length})</span>
          )}
        </button>
        <button
          onClick={() => switchMode('dungeon')}
          className={[
            'flex-1 py-2.5 rounded-md text-sm font-semibold transition-all',
            mode === 'dungeon'
              ? 'bg-[color:var(--class-color)]/15 text-[color:var(--class-color)] border border-[color:var(--class-color)]/40'
              : 'text-gray-400 hover:text-gray-300 border border-transparent',
          ].join(' ')}
        >
          Dungeons
          {dungeons.length > 0 && (
            <span className="ml-1.5 text-xs opacity-60">({dungeons.length})</span>
          )}
        </button>
      </div>

      {/* Difficulty selector */}
      <Card>
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-300">Difficulty</label>
          {!isDungeon ? (
            <>
              <div className="flex gap-2">
                {(['normal', 'heroic', 'mythic'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={[
                      'px-4 py-2 rounded-md text-sm font-medium border transition-colors capitalize',
                      difficulty === d
                        ? 'border-[color:var(--class-color)]/60 bg-[color:var(--class-color)]/10 text-[color:var(--class-color)]'
                        : 'border-wow-accent/30 text-gray-400 hover:border-wow-accent/50 hover:text-gray-300',
                    ].join(' ')}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500">
                ilvl {({ normal: 250, heroic: 263, mythic: 276 } as Record<string, number>)[difficulty] ?? '—'}
              </span>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setDifficulty('mythic0')}
                  className={[
                    'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                    difficulty === 'mythic0'
                      ? 'border-[color:var(--class-color)]/60 bg-[color:var(--class-color)]/10 text-[color:var(--class-color)]'
                      : 'border-wow-accent/30 text-gray-400 hover:border-wow-accent/50 hover:text-gray-300',
                  ].join(' ')}
                >
                  Mythic 0
                </button>
                <button
                  onClick={() => setDifficulty(difficulty.startsWith('m+') ? difficulty : 'm+2')}
                  className={[
                    'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                    difficulty.startsWith('m+')
                      ? 'border-[color:var(--class-color)]/60 bg-[color:var(--class-color)]/10 text-[color:var(--class-color)]'
                      : 'border-wow-accent/30 text-gray-400 hover:border-wow-accent/50 hover:text-gray-300',
                  ].join(' ')}
                >
                  Mythic+
                </button>
              </div>
              {difficulty.startsWith('m+') && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400">Key Level:</label>
                  <Select
                    
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    {Array.from({ length: 14 }, (_, i) => i + 2).map((level) => (
                      <option key={level} value={`m+${level}`}>+{level}</option>
                    ))}
                  </Select>
                  <span className="text-xs text-gray-500">
                    ilvl {(() => {
                      const lvl = parseInt(difficulty.replace('m+', ''), 10)
                      const table: Record<number, number> = { 2: 250, 3: 250, 4: 253, 5: 256, 6: 259, 7: 259, 8: 263, 9: 263, 10: 266 }
                      return table[Math.min(lvl, 10)] ?? 266
                    })()}
                  </span>
                </div>
              )}
              {difficulty === 'mythic0' && (
                <span className="text-xs text-gray-500">ilvl 246</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Instance grid */}
      {loadingInstances ? (
        <Card>
          <p className="text-gray-500 text-sm animate-pulse">Loading instances...</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-200">
              {mode === 'raid' ? 'Raids' : 'Dungeons'}
            </h2>
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className="text-xs text-wow-blue hover:text-blue-300 transition-colors"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className={[
            'grid gap-3',
            mode === 'raid' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
          ].join(' ')}>
            {visibleInstances.map((inst) => (
              <InstanceCard
                key={inst.id}
                summary={inst}
                selected={selectedInstanceIds.has(inst.id)}
                instance={instanceData.get(inst.id)}
                loading={loadingInstanceIds.has(inst.id)}
                onToggle={() => toggleInstance(inst.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Selected instances loot detail */}
      {selectedInstanceIds.size > 0 && (
        <div className="space-y-4">
          {[...selectedInstanceIds].map((id) => {
            const inst = instanceData.get(id)
            const summary = instances.find((i) => i.id === id)
            if (!inst || !summary) return null

            return (
              <Card key={id} className="p-0 overflow-hidden">
                {/* Instance header */}
                <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {inst.image_url && (
                      <img src={inst.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-200">{inst.name}</h3>
                      <span className="text-[11px] text-gray-500">
                        {inst.bosses.length} boss{inst.bosses.length !== 1 ? 'es' : ''} — {inst.bosses.reduce((s, b) => s + b.loot.length, 0)} items
                      </span>
                    </div>
                  </div>
                </div>

                {/* Boss list with loot */}
                <div className="divide-y divide-white/[0.04]">
                  {inst.bosses.map((boss) => (
                    <div key={boss.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">{boss.name}</span>
                        <span className="text-[11px] text-gray-600">{boss.loot.length} items</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {boss.loot.map((item) => (
                          <ItemLink
                            key={item.id}
                            itemId={item.id}
                            name={item.name}
                            ilvl={item.item_level}
                            bonusIds={item.bonus_ids}
                            iconUrl={item.icon_url}
                            className="text-xs text-gray-400 hover:text-[color:var(--class-color)] transition-colors"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Submit */}
      <Card>
        <div className="space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex items-center justify-between">
            <div className="text-gray-500 text-sm space-y-0.5">
              {selectedInstanceIds.size > 0 ? (
                <>
                  <p>
                    {selectedInstanceIds.size} {mode}{selectedInstanceIds.size !== 1 ? 's' : ''} selected
                  </p>
                  {totalItems > 0 && !anySelectedLoading && (
                    <p className="text-[color:var(--class-color)]/70">
                      {totalItems} profileset{totalItems !== 1 ? 's' : ''} will be simulated
                    </p>
                  )}
                  {anySelectedLoading && (
                    <p className="text-gray-500 animate-pulse">Loading loot data...</p>
                  )}
                </>
              ) : (
                <p>Select {mode === 'raid' ? 'raids' : 'dungeons'} to begin</p>
              )}
            </div>
            <Button
              onClick={handleSimulate}
              disabled={loading || !simcInput.trim() || selectedInstanceIds.size === 0 || anySelectedLoading}
              size="lg"
            >
              {loading ? 'Starting...' : 'Run Droptimizer'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── Instance Card ────────────────────────────────────────────────────────────

interface InstanceCardProps {
  summary: InstanceSummary
  selected: boolean
  instance?: Instance
  loading: boolean
  onToggle: () => void
}

function InstanceCard({ summary, selected, instance, loading, onToggle }: InstanceCardProps) {
  const imageUrl = instance?.image_url
  const bossCount = instance?.bosses.length ?? summary.boss_count
  const itemCount = instance?.bosses.reduce((s, b) => s + b.loot.length, 0) ?? 0

  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'relative overflow-hidden rounded-lg border-2 transition-all text-left group',
        selected
          ? 'border-[color:var(--class-color)]/70 ring-1 ring-wow-gold/30'
          : 'border-wow-accent/30 hover:border-wow-accent/60',
      ].join(' ')}
    >
      <div className="relative h-28 bg-wow-darker overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={summary.name}
            className={[
              'w-full h-full object-cover object-center transition-all duration-300',
              selected ? 'brightness-100' : 'brightness-50 group-hover:brightness-75',
            ].join(' ')}
          />
        ) : (
          <div className={[
            'w-full h-full flex items-center justify-center transition-colors',
            selected ? 'bg-wow-accent/30' : 'bg-wow-darker',
          ].join(' ')}>
            {loading ? (
              <div className="w-5 h-5 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin" />
            ) : (
              <span className="text-3xl text-gray-700">
                {summary.type === 'raid' ? '\u2694' : '\u26E8'}
              </span>
            )}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[color:var(--class-color)] flex items-center justify-center">
            <span className="text-black text-xs font-bold">✓</span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-6">
          <h3 className={[
            'font-bold text-sm leading-tight drop-shadow-lg transition-colors',
            selected ? 'text-[color:var(--class-color)]' : 'text-gray-200 group-hover:text-white',
          ].join(' ')}>
            {summary.name}
          </h3>
          {(bossCount > 0 || itemCount > 0) && (
            <span className="text-[10px] text-gray-400 mt-0.5 block">
              {bossCount > 0 && `${bossCount} boss${bossCount !== 1 ? 'es' : ''}`}
              {bossCount > 0 && itemCount > 0 && ' · '}
              {itemCount > 0 && `${itemCount} items`}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
