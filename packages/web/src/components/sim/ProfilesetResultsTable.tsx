import { memo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ProfilesetResult } from '@wow-simc/shared'

interface ProfilesetResultsTableProps {
  results: ProfilesetResult[]
  title?: string
}

function formatDps(n: number) {
  return Math.round(n).toLocaleString()
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
  head: 'Head', neck: 'Neck', shoulders: 'Shoulders', back: 'Back', chest: 'Chest',
  wrists: 'Wrists', hands: 'Hands', waist: 'Waist', legs: 'Legs', feet: 'Feet',
  finger1: 'Ring 1', finger2: 'Ring 2', trinket1: 'Trinket 1', trinket2: 'Trinket 2',
  main_hand: 'Main Hand', off_hand: 'Off Hand',
}

/** Parse profileset name like "waist_Riphook_Defender_263" → { slot, item, ilvl } */
function parseProfilesetName(name: string): { slot: string; item: string; ilvl: string } | null {
  const slots = Object.keys(SLOT_LABELS)
  for (const slot of slots) {
    if (name.startsWith(slot + '_')) {
      const rest = name.slice(slot.length + 1)
      const lastUnderscore = rest.lastIndexOf('_')
      if (lastUnderscore > 0) {
        const maybeIlvl = rest.slice(lastUnderscore + 1)
        if (/^\d+$/.test(maybeIlvl)) {
          const itemName = rest.slice(0, lastUnderscore).replace(/_/g, ' ')
          return { slot, item: itemName, ilvl: maybeIlvl }
        }
      }
      return { slot, item: rest.replace(/_/g, ' '), ilvl: '' }
    }
  }
  return null
}

export const ProfilesetResultsTable = memo(function ProfilesetResultsTable({ results, title = 'Profileset Results' }: ProfilesetResultsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const useVirtual = results.length > 50

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
    enabled: useVirtual,
  })

  if (results.length === 0) return null

  const renderRow = (r: ProfilesetResult) => {
    const isTop = r.rank === 1
    const deltaPositive = (r.dps_delta ?? 0) >= 0
    const parsed = parseProfilesetName(r.name)

    return (
      <tr
        key={r.name}
        className={[
          'border-b border-wow-accent/10 transition-colors hover:bg-wow-accent/10',
          isTop ? 'bg-[color:var(--class-color)]/5' : '',
        ].join(' ')}
      >
        <td className="px-4 py-2.5 text-gray-400">
          {isTop ? <span className="text-[color:var(--class-color)] font-bold">1</span> : r.rank}
        </td>
        <td className="px-4 py-2.5">
          {parsed ? (
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              {SLOT_LABELS[parsed.slot] ?? parsed.slot}
            </span>
          ) : (
            <span className="text-gray-500 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <span className={isTop ? 'text-[color:var(--class-color)] font-medium' : 'text-gray-200'}>
            {parsed?.item ?? r.name}
          </span>
        </td>
        <td className="px-3 py-2.5 text-center text-xs text-gray-400 tabular-nums">
          {parsed?.ilvl || '—'}
        </td>
        <td className="px-4 py-2.5 text-right text-gray-200 font-mono tabular-nums">
          {formatDps(r.mean)}
        </td>
        <td className={[
          'px-4 py-2.5 text-right font-mono tabular-nums',
          r.dps_delta === undefined ? 'text-gray-500'
            : deltaPositive ? 'text-green-400' : 'text-red-400',
        ].join(' ')}>
          {r.dps_delta !== undefined ? formatDelta(r.dps_delta) : '—'}
        </td>
        <td className={[
          'px-4 py-2.5 text-right font-mono tabular-nums',
          r.dps_delta_pct === undefined ? 'text-gray-500'
            : deltaPositive ? 'text-green-400' : 'text-red-400',
        ].join(' ')}>
          {r.dps_delta_pct !== undefined ? formatDeltaPct(r.dps_delta_pct) : '—'}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
      <div ref={parentRef} className="overflow-x-auto rounded-md border border-wow-accent/30" style={useVirtual ? { maxHeight: 600, overflow: 'auto' } : undefined}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-wow-darker border-b border-wow-accent/30">
              <th className="text-left px-4 py-3 text-gray-400 font-medium w-12">#</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Slot</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Item</th>
              <th className="text-center px-3 py-3 text-gray-400 font-medium">ilvl</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">DPS</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Delta</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {useVirtual ? (
              <>
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr><td colSpan={7} style={{ height: virtualizer.getVirtualItems()[0].start, padding: 0 }} /></tr>
                )}
                {virtualizer.getVirtualItems().map((vItem) => renderRow(results[vItem.index]))}
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr><td colSpan={7} style={{ height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? 0), padding: 0 }} /></tr>
                )}
              </>
            ) : (
              results.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
})
