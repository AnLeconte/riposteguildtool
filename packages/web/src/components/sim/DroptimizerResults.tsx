import { useMemo, useState } from 'react'
import type { ProfilesetResult } from '@wow-simc/shared'
import { ItemLink } from '@/components/ui/ItemLink'
import { Card } from '@/components/ui/Card'

interface DroptimzerItemData {
  id: number
  name: string
  icon_url?: string
  boss_name: string
  item_level: number
  bonus_ids?: number[]
  slot?: string
}

interface DroptimizerResultsProps {
  results: ProfilesetResult[]
  baseDps?: number
  items?: DroptimzerItemData[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseName(name: string): { bossName: string; itemLabel: string } {
  const dashIdx = name.indexOf(' - ')
  if (dashIdx === -1) return { bossName: 'Unknown', itemLabel: name }
  return {
    bossName: name.slice(0, dashIdx),
    itemLabel: name.slice(dashIdx + 3),
  }
}

function formatDelta(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${Math.round(n).toLocaleString()}`
}

function formatDeltaPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

const SLOT_LABELS: Record<string, string> = {
  head: 'Head', neck: 'Neck', shoulders: 'Shoulders', back: 'Back',
  chest: 'Chest', wrists: 'Wrists', hands: 'Hands', waist: 'Waist',
  legs: 'Legs', feet: 'Feet', finger1: 'Ring', finger2: 'Ring',
  trinket1: 'Trinket', trinket2: 'Trinket', main_hand: 'Weapon', off_hand: 'Off Hand',
}

const SLOT_ORDER = [
  'main_hand', 'off_hand', 'head', 'neck', 'shoulders', 'back', 'chest',
  'wrists', 'hands', 'waist', 'legs', 'feet', 'finger1', 'finger2',
  'trinket1', 'trinket2',
]

// ─── Component ────────────────────────────────────────────────────────────────

export function DroptimizerResults({ results, baseDps, items }: DroptimizerResultsProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [slotFilter, setSlotFilter] = useState<string | null>(null)

  // Build lookup: profileset name → full item data
  const itemDataMap = useMemo(() => {
    const map = new Map<string, DroptimzerItemData>()
    if (!items) return map
    for (const item of items) {
      const key = `${item.boss_name} - ${item.name} (${item.item_level})`
      map.set(key, item)
    }
    return map
  }, [items])

  if (results.length === 0) return null

  // Sort all results by delta
  const allSorted = [...results].sort((a, b) => (b.dps_delta ?? 0) - (a.dps_delta ?? 0))
  const bestUpgrade = allSorted[0]
  const bestData = bestUpgrade ? itemDataMap.get(bestUpgrade.name) : undefined
  const upgradeCount = allSorted.filter((r) => (r.dps_delta ?? 0) > 0).length

  // Available slots for filter
  const availableSlots = useMemo(() => {
    const slots = new Set<string>()
    for (const r of results) {
      const data = itemDataMap.get(r.name)
      if (data?.slot) slots.add(data.slot)
    }
    return SLOT_ORDER.filter((s) => slots.has(s))
  }, [results, itemDataMap])

  // Filter results by slot
  const filteredResults = slotFilter
    ? results.filter((r) => {
        const data = itemDataMap.get(r.name)
        return data?.slot === slotFilter
      })
    : results

  // Group filtered results by boss
  const groupMap = new Map<string, ProfilesetResult[]>()
  for (const r of filteredResults) {
    const { bossName } = parseName(r.name)
    if (!groupMap.has(bossName)) groupMap.set(bossName, [])
    groupMap.get(bossName)!.push(r)
  }

  const groups = Array.from(groupMap.entries())
    .map(([bossName, bossItems]) => ({
      bossName,
      items: [...bossItems].sort((a, b) => (b.dps_delta ?? 0) - (a.dps_delta ?? 0)),
    }))
    .sort((a, b) => (b.items[0]?.dps_delta ?? 0) - (a.items[0]?.dps_delta ?? 0))

  // Max absolute delta for bar scaling
  const maxAbsDelta = Math.max(
    ...filteredResults.map((r) => Math.abs(r.dps_delta ?? 0)),
    1,
  )

  const toggleBoss = (bossName: string) => {
    setCollapsed((prev) => ({ ...prev, [bossName]: !prev[bossName] }))
  }

  return (
    <div className="space-y-5">
      {/* ── Summary header ── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-600">Items Simulated</p>
          <p className="text-xl font-bold text-gray-200">{results.length}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-600">Upgrades Found</p>
          <p className="text-xl font-bold text-green-400">{upgradeCount}</p>
        </div>
        {baseDps !== undefined && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-600">Base DPS</p>
            <p className="text-xl font-bold text-gray-400">{Math.round(baseDps).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* ── Best upgrade card ── */}
      {bestUpgrade && (bestUpgrade.dps_delta ?? 0) > 0 && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/[0.05] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-green-500 mb-3">
            Best Upgrade
          </p>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {bestData ? (
                <ItemLink
                  itemId={bestData.id}
                  name={bestData.name}
                  ilvl={bestData.item_level}
                  bonusIds={bestData.bonus_ids}
                  iconUrl={bestData.icon_url}
                  className="text-base font-semibold text-green-300 hover:text-green-200 transition-colors truncate"
                />
              ) : (
                <span className="text-base font-semibold text-green-300 truncate">
                  {parseName(bestUpgrade.name).itemLabel}
                </span>
              )}
              {bestData?.slot && (
                <span className="text-[10px] text-green-600 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                  {SLOT_LABELS[bestData.slot] ?? bestData.slot}
                </span>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-extrabold text-green-400 tabular-nums">
                {formatDelta(bestUpgrade.dps_delta ?? 0)}
              </p>
              <p className="text-xs text-green-600 font-mono">
                {formatDeltaPct(bestUpgrade.dps_delta_pct ?? 0)}
              </p>
            </div>
          </div>
          <p className="text-xs text-green-700 mt-2">
            Drops from <span className="text-green-500 font-medium">{parseName(bestUpgrade.name).bossName}</span>
          </p>
        </div>
      )}

      {/* ── Slot filters ── */}
      {availableSlots.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSlotFilter(null)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              slotFilter === null
                ? 'bg-[color:var(--class-color)]/15 text-[color:var(--class-color)] border border-[color:var(--class-color)]/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-white/[0.08]'
            }`}
          >
            All ({results.length})
          </button>
          {availableSlots.map((slot) => {
            const count = results.filter((r) => itemDataMap.get(r.name)?.slot === slot).length
            return (
              <button
                key={slot}
                onClick={() => setSlotFilter(slotFilter === slot ? null : slot)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  slotFilter === slot
                    ? 'bg-[color:var(--class-color)]/15 text-[color:var(--class-color)] border border-[color:var(--class-color)]/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-white/[0.08]'
                }`}
              >
                {SLOT_LABELS[slot] ?? slot} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* ── Boss sections ── */}
      {groups.map(({ bossName, items: bossItems }) => {
        const isOpen = !collapsed[bossName]
        const topItem = bossItems[0]
        const hasBossUpgrade = (topItem?.dps_delta ?? 0) > 0

        return (
          <div key={bossName} className="rounded-xl border border-white/[0.06] overflow-hidden">
            {/* Boss header */}
            <button
              onClick={() => toggleBoss(bossName)}
              className="w-full flex items-center justify-between px-4 py-3 bg-wow-darker/50 hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {/* Upgrade indicator dot */}
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  hasBossUpgrade ? 'bg-green-400' : 'bg-gray-600'
                }`} />
                <span className={`text-xs transition-transform duration-200 text-gray-600 ${isOpen ? 'rotate-90' : ''}`}>
                  &#9654;
                </span>
                <span className="text-sm font-medium text-gray-200">{bossName}</span>
                <span className="text-[11px] text-gray-600">
                  {bossItems.length} {bossItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              {hasBossUpgrade && (
                <span className="text-green-400 font-mono text-xs font-semibold tabular-nums">
                  {formatDelta(topItem.dps_delta ?? 0)}
                </span>
              )}
            </button>

            {/* Items */}
            {isOpen && (
              <div className="divide-y divide-white/[0.04]">
                {bossItems.map((r) => {
                  const itemData = itemDataMap.get(r.name)
                  const delta = r.dps_delta ?? 0
                  const isUpgrade = delta > 0
                  const isDowngrade = delta < 0
                  const barWidth = Math.min(Math.abs(delta) / maxAbsDelta * 100, 100)

                  return (
                    <div
                      key={r.name}
                      className="relative px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Background bar */}
                      <div
                        className={`absolute top-0 bottom-0 left-0 transition-all ${
                          isUpgrade ? 'bg-green-500/[0.06]' : isDowngrade ? 'bg-red-500/[0.04]' : ''
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />

                      {/* Content */}
                      <div className="relative flex items-center gap-3">
                        {/* Slot badge */}
                        {itemData?.slot && (
                          <span className="text-[9px] font-medium text-gray-600 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded w-14 text-center flex-shrink-0">
                            {SLOT_LABELS[itemData.slot] ?? itemData.slot}
                          </span>
                        )}

                        {/* Item name with wowhead tooltip */}
                        <div className="flex-1 min-w-0">
                          {itemData ? (
                            <ItemLink
                              itemId={itemData.id}
                              name={itemData.name}
                              ilvl={itemData.item_level}
                              bonusIds={itemData.bonus_ids}
                              iconUrl={itemData.icon_url}
                              className={`text-sm truncate ${
                                isUpgrade ? 'text-gray-200 hover:text-green-300' : 'text-gray-400 hover:text-gray-200'
                              } transition-colors`}
                            />
                          ) : (
                            <span className="text-sm text-gray-400 truncate">
                              {parseName(r.name).itemLabel}
                            </span>
                          )}
                        </div>

                        {/* Delta */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`text-sm font-semibold font-mono tabular-nums ${
                            isUpgrade ? 'text-green-400' : isDowngrade ? 'text-red-400/70' : 'text-gray-600'
                          }`}>
                            {r.dps_delta !== undefined ? formatDelta(delta) : '—'}
                          </span>
                          <span className={`text-[11px] font-mono tabular-nums w-16 text-right ${
                            isUpgrade ? 'text-green-600' : isDowngrade ? 'text-red-500/50' : 'text-gray-700'
                          }`}>
                            {r.dps_delta_pct !== undefined ? formatDeltaPct(r.dps_delta_pct) : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
