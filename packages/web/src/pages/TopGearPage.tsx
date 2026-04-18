import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SimcInput } from '@/components/sim/SimcInput'
import { ItemLink } from '@/components/ui/ItemLink'
import { api } from '@/lib/api'
import { useSimStore } from '@/stores/useSimStore'
import { parseBagItems } from '@wow-simc/simc-engine'
import type { BagItem } from '@wow-simc/shared'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Display-friendly slot label */
function slotLabel(slot: string): string {
  return slot
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Canonical slot order for display */
const SLOT_ORDER: string[] = [
  'head', 'neck', 'shoulders', 'back', 'chest',
  'wrists', 'hands', 'waist', 'legs', 'feet',
  'finger1', 'finger2', 'trinket1', 'trinket2',
  'main_hand', 'off_hand',
]

function sortedSlots(slots: string[]): string[] {
  return [...slots].sort((a, b) => {
    const ia = SLOT_ORDER.indexOf(a)
    const ib = SLOT_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopGearPage() {
  const [simcInput, setSimcInput] = useState('')
  /** Set of encoded_line values that are checked */
  const [checkedBagItems, setCheckedBagItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setSimId } = useSimStore()

  // Item metadata cache: itemId → { name, icon_url }
  const [itemMeta, setItemMeta] = useState<Map<number, { name?: string; icon_url?: string }>>(new Map())

  // Parse bag items whenever the simc input changes
  const bagItems: BagItem[] = useMemo(() => {
    if (!simcInput.trim()) return []
    try {
      return parseBagItems(simcInput)
    } catch {
      return []
    }
  }, [simcInput])

  // Fetch item names + icons via batch API
  useEffect(() => {
    if (bagItems.length === 0) return
    const uniqueIds = [...new Set(bagItems.map((i) => i.id).filter((id) => id > 0 && !itemMeta.has(id)))]
    if (uniqueIds.length === 0) return

    let cancelled = false
    const fetchMeta = async () => {
      try {
        const data = await api.getItemsBatch(uniqueIds)
        if (cancelled) return
        setItemMeta((prev) => {
          const next = new Map(prev)
          for (const [idStr, meta] of Object.entries(data)) {
            next.set(Number(idStr), meta)
          }
          return next
        })
      } catch {
        // Batch fetch failed, skip
      }
    }
    fetchMeta()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagItems])

  // When bag items are (re-)parsed, default-check all of them
  const prevBagItemKeys = useMemo(
    () => new Set(bagItems.map((i) => i.encoded_line)),
    [bagItems],
  )
  // Initialise new bag items as checked; drop removed ones
  useMemo(() => {
    setCheckedBagItems((prev) => {
      const next = new Set<string>()
      for (const item of bagItems) {
        if (!prev.has(item.encoded_line) || prev.has(item.encoded_line)) {
          next.add(item.encoded_line)
        }
      }
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevBagItemKeys])

  // Group bag items by slot
  const bagItemsBySlot: Map<string, BagItem[]> = useMemo(() => {
    const map = new Map<string, BagItem[]>()
    for (const item of bagItems) {
      const list = map.get(item.slot) ?? []
      list.push(item)
      map.set(item.slot, list)
    }
    return map
  }, [bagItems])

  const toggleBagItem = (encodedLine: string) => {
    setCheckedBagItems((prev) => {
      const next = new Set(prev)
      if (next.has(encodedLine)) next.delete(encodedLine)
      else next.add(encodedLine)
      return next
    })
  }

  const toggleSlot = (slot: string) => {
    const items = bagItemsBySlot.get(slot) ?? []
    const allChecked = items.every((i) => checkedBagItems.has(i.encoded_line))
    setCheckedBagItems((prev) => {
      const next = new Set(prev)
      if (allChecked) {
        items.forEach((i) => next.delete(i.encoded_line))
      } else {
        items.forEach((i) => next.add(i.encoded_line))
      }
      return next
    })
  }

  /** Selected bag item lines as a block of simc text */
  const allCandidates = bagItems
    .filter((i) => checkedBagItems.has(i.encoded_line))
    .map((i) => i.encoded_line)
    .join('\n')

  const selectedBagCount = bagItems.filter((i) =>
    checkedBagItems.has(i.encoded_line),
  ).length

  // Number of unique slots covered by selected bag items
  const selectedSlotCount = new Set(
    bagItems
      .filter((i) => checkedBagItems.has(i.encoded_line))
      .map((i) => i.slot),
  ).size

  const handleSimulate = async () => {
    if (!simcInput.trim()) {
      setError('Please paste your /simc string')
      return
    }
    if (!allCandidates.trim()) {
      setError('Please select at least one candidate item')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await api.topGear(simcInput, allCandidates)
      setSimId(result.id)
      navigate(`/sim/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start simulation')
    } finally {
      setLoading(false)
    }
  }

  const slots = sortedSlots(Array.from(bagItemsBySlot.keys()))

  return (
    <div className="w-full space-y-6">
      <div>
      <PageHeader title="Top" highlight="Gear" description="Find the best gear combination from your bag items." />
      </div>

      {/* Character input */}
      <Card>
        <SimcInput value={simcInput} onChange={setSimcInput} rows={8} />
      </Card>

      {/* Detected Bag Items */}
      {bagItems.length > 0 && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Detected Bag Items
              </label>
              <span className="text-xs bg-wow-accent/40 text-[color:var(--class-color)] border border-[color:var(--class-color)]/30 px-2.5 py-1 rounded-full font-medium">
                {selectedBagCount} / {bagItems.length} selected
              </span>
            </div>

            <div className="space-y-4">
              {slots.map((slot) => {
                const items = bagItemsBySlot.get(slot)!
                const allChecked = items.every((i) =>
                  checkedBagItems.has(i.encoded_line),
                )
                const someChecked = items.some((i) =>
                  checkedBagItems.has(i.encoded_line),
                )
                return (
                  <div key={slot}>
                    {/* Slot header row */}
                    <button
                      type="button"
                      onClick={() => toggleSlot(slot)}
                      className="flex items-center gap-2 mb-1.5 group w-full text-left"
                    >
                      <span
                        className={[
                          'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                          allChecked
                            ? 'border-[color:var(--class-color)] bg-[color:var(--class-color)]/20'
                            : someChecked
                            ? 'border-[color:var(--class-color)]/60 bg-[color:var(--class-color)]/10'
                            : 'border-wow-accent/40',
                        ].join(' ')}
                      >
                        {allChecked && (
                          <span className="text-[color:var(--class-color)] text-[10px] leading-none">✓</span>
                        )}
                        {someChecked && !allChecked && (
                          <span className="text-[color:var(--class-color)]/60 text-[10px] leading-none">–</span>
                        )}
                      </span>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                        {slotLabel(slot)}
                      </span>
                      <span className="text-xs text-gray-600">
                        ({items.length})
                      </span>
                    </button>

                    {/* Items */}
                    <div className="space-y-1 pl-5">
                      {items.map((item) => {
                        const checked = checkedBagItems.has(item.encoded_line)
                        return (
                          <label
                            key={item.encoded_line}
                            className={[
                              'flex items-center gap-2.5 px-2.5 py-1.5 rounded cursor-pointer transition-colors',
                              checked
                                ? 'bg-[color:var(--class-color)]/5 border border-[color:var(--class-color)]/20'
                                : 'border border-transparent hover:border-wow-accent/20',
                            ].join(' ')}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleBagItem(item.encoded_line)}
                              className="accent-wow-gold flex-shrink-0"
                            />
                            <ItemLink
                              itemId={item.id}
                              name={itemMeta.get(item.id)?.name || item.name}
                              ilvl={item.item_level}
                              bonusIds={item.bonus_ids}
                              iconUrl={itemMeta.get(item.id)?.icon_url}
                              className={`text-sm flex-1 truncate ${checked ? 'text-gray-200 hover:text-[color:var(--class-color)]' : 'text-gray-400 hover:text-gray-200'} transition-colors`}
                            />
                            {item.item_level > 0 && (
                              <span className="text-xs text-gray-500 flex-shrink-0">
                                ilvl {item.item_level}
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            {selectedBagCount > 0 && (
              <p className="text-xs text-gray-500 pt-1 border-t border-wow-accent/20">
                {selectedBagCount} item{selectedBagCount !== 1 ? 's' : ''} selected
                across {selectedSlotCount} slot{selectedSlotCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Error + submit */}
      <Card>
        <div className="space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-sm">
              {selectedBagCount > 0
                ? `${selectedBagCount} profileset${selectedBagCount !== 1 ? 's' : ''} will be simulated`
                : 'Paste your /simc string to detect bag items'}
            </p>
            <Button
              onClick={handleSimulate}
              disabled={loading || !simcInput.trim() || !allCandidates.trim()}
              size="lg"
            >
              {loading ? 'Starting...' : 'Run Top Gear'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
