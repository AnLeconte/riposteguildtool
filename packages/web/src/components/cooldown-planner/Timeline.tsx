import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HEALER_SPECS, getCooldownDef } from '@wow-simc/shared'
import { useCooldownPlannerStore } from '@/stores/useCooldownPlannerStore'
import { formatTime, snapToGrid, getConflicts } from '@/lib/cooldown-planner-utils'
import { useSpellIcons } from '@/lib/useSpellIcons'

const TIME_COL_WIDTH = 56
const ABILITY_COL_WIDTH = 220
const HEALER_COL_MIN_WIDTH = 120

export function Timeline() {
  const { encounter, plan, zoom, selectedCdId, selectedHealerId, setSelectedCd, placeCooldown, moveCooldown, removeCooldown } = useCooldownPlannerStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverCol, setHoverCol] = useState<string | null>(null)

  // Spell icons
  const allSpellIds = useMemo(() => {
    if (!encounter) return []
    const ids = encounter.abilities.map((a) => a.spellId).filter((id): id is number => !!id)
    for (const healer of plan.roster) {
      const spec = HEALER_SPECS.find((s) => s.spec === healer.spec)
      if (spec) for (const cd of spec.cooldowns) { if (cd.spellId) ids.push(cd.spellId) }
    }
    return [...new Set(ids)]
  }, [encounter, plan.roster])
  const spellIcons = useSpellIcons(allSpellIds)

  if (!encounter) return null

  const pxPerSec = 2.2 + zoom * 0.8
  const totalHeight = encounter.fightDuration * pxPerSec
  const conflicts = getConflicts(plan.placements)
  const conflictIds = new Set(conflicts.map((c) => c.placementId))

  // Ticks — major every 30s, minor every 10s
  const majorTicks: number[] = []
  const minorTicks: number[] = []
  for (let t = 0; t <= encounter.fightDuration; t += 10) {
    if (t % 30 === 0) majorTicks.push(t)
    else minorTicks.push(t)
  }

  // Click-to-place on healer column
  const handleColumnClick = (e: React.MouseEvent, healerId: string) => {
    if (!selectedCdId || !selectedHealerId) return
    // Only place on the correct healer's column
    if (selectedHealerId !== healerId) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const time = snapToGrid(y / pxPerSec)
    placeCooldown(healerId, selectedCdId, Math.max(0, Math.min(time, encounter.fightDuration)))
  }

  // Drag & drop
  const handleDrop = useCallback(
    (e: React.DragEvent, healerId: string) => {
      e.preventDefault()
      const data = e.dataTransfer.getData('application/json')
      if (!data) return
      const parsed = JSON.parse(data) as { cooldownDefId: string; healerId?: string; placementId?: string }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const y = e.clientY - rect.top
      const time = snapToGrid(y / pxPerSec)
      if (parsed.placementId) {
        moveCooldown(parsed.placementId, Math.max(0, time))
      } else {
        placeCooldown(parsed.healerId ?? healerId, parsed.cooldownDefId, Math.max(0, time))
      }
      setHoverTime(null)
      setHoverCol(null)
    },
    [pxPerSec, placeCooldown, moveCooldown, encounter?.fightDuration],
  )

  const handleDragOver = (e: React.DragEvent, healerId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    setHoverTime(snapToGrid(y / pxPerSec))
    setHoverCol(healerId)
  }

  const handleDragLeave = () => {
    setHoverTime(null)
    setHoverCol(null)
  }

  // Icon helper
  const getIcon = (spellId?: number, iconName?: string) => {
    if (spellId && spellIcons.has(spellId)) return spellIcons.get(spellId)
    if (iconName) return `https://wow.zamimg.com/images/wow/icons/medium/${iconName}.jpg`
    return undefined
  }

  return (
    <div ref={containerRef} className="rounded-xl border border-white/[0.06] overflow-hidden bg-wow-darker/30 shadow-inner-glow">
      {/* Selected CD indicator */}
      {selectedCdId && (
        <div className="px-4 py-2 bg-[color:var(--class-color)]/[0.06] border-b border-[color:var(--class-color)]/20 flex items-center justify-between">
          <span className="text-xs text-[color:var(--class-color)]">
            Click on a healer column to place: <span className="font-semibold">{getCooldownDef(selectedCdId)?.name}</span>
          </span>
          <button onClick={() => setSelectedCd(null)} className="text-xs text-gray-500 hover:text-gray-300">{'\u2715'} Cancel</button>
        </div>
      )}

      {/* Column headers — sticky */}
      <div className="flex border-b border-white/[0.08] bg-wow-darker/80 sticky top-0 z-10">
        <div className="flex-shrink-0 flex items-center justify-center border-r border-white/[0.06] py-3" style={{ width: TIME_COL_WIDTH }}>
          <span className="text-[9px] font-semibold text-gray-600 uppercase">Time</span>
        </div>
        <div className="flex-shrink-0 flex items-center px-3 border-r border-white/[0.06] py-3" style={{ width: ABILITY_COL_WIDTH }}>
          <span className="text-[10px] font-semibold text-red-400/60 uppercase">Boss Abilities</span>
        </div>
        {plan.roster.map((healer) => {
          const spec = HEALER_SPECS.find((s) => s.spec === healer.spec)
          return (
            <div key={healer.id} className="flex-1 flex items-center gap-2 px-3 border-r border-white/[0.04] py-3" style={{ minWidth: HEALER_COL_MIN_WIDTH }}>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: spec?.classColor ?? '#666' }} />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-300 truncate">{healer.name}</p>
                <p className="text-[8px] text-gray-600">{spec?.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <div className="relative flex" style={{ height: totalHeight }}>

          {/* Time column */}
          <div className="flex-shrink-0 relative border-r border-white/[0.06]" style={{ width: TIME_COL_WIDTH }}>
            {majorTicks.map((t) => (
              <div key={t} className="absolute right-0 left-0 flex items-center justify-end pr-2" style={{ top: t * pxPerSec - 6 }}>
                <span className="text-[10px] font-mono text-gray-400 tabular-nums">{formatTime(t)}</span>
              </div>
            ))}
            {minorTicks.map((t) => (
              <div key={t} className="absolute right-0 left-0 flex items-center justify-end pr-2" style={{ top: t * pxPerSec - 4 }}>
                <span className="text-[8px] font-mono text-gray-700 tabular-nums">{formatTime(t)}</span>
              </div>
            ))}
          </div>

          {/* Boss ability column */}
          <div className="flex-shrink-0 relative border-r border-white/[0.06]" style={{ width: ABILITY_COL_WIDTH }}>
            {/* Grid lines */}
            {majorTicks.map((t) => (
              <div key={t} className="absolute left-0 right-0 h-px bg-white/[0.06]" style={{ top: t * pxPerSec }} />
            ))}
            {minorTicks.map((t) => (
              <div key={t} className="absolute left-0 right-0 h-px bg-white/[0.03]" style={{ top: t * pxPerSec }} />
            ))}
            {/* Abilities */}
            {encounter.abilities.map((ability) => {
              const iconSrc = getIcon(ability.spellId, ability.iconName)
              return (
                <a key={ability.id}
                  href={ability.spellId ? `https://www.wowhead.com/spell=${ability.spellId}` : undefined}
                  target="_blank" rel="noopener noreferrer"
                  data-wowhead={ability.spellId ? `spell=${ability.spellId}` : undefined}
                  className="absolute left-2 right-2 flex items-center gap-2 px-2 py-1 rounded-lg hover:brightness-125 transition-all"
                  style={{ top: ability.timestamp * pxPerSec, backgroundColor: ability.color + '10' }}
                  title={`${ability.name} @ ${formatTime(ability.timestamp)}${ability.description ? ` — ${ability.description}` : ''}`}
                >
                  {iconSrc && <img src={iconSrc} alt="" className="w-6 h-6 rounded border border-white/[0.15] flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold truncate" style={{ color: ability.color }}>{ability.name}</p>
                    {ability.description && <p className="text-[8px] text-gray-600 truncate">{ability.description}</p>}
                  </div>
                  <span className="text-[8px] text-gray-600 tabular-nums flex-shrink-0 ml-auto">{formatTime(ability.timestamp)}</span>
                </a>
              )
            })}
          </div>

          {/* Healer columns */}
          {plan.roster.map((healer, idx) => {
            const healerPlacements = plan.placements.filter((p) => p.healerId === healer.id)
            const isEven = idx % 2 === 0
            const isHoverTarget = hoverCol === healer.id

            return (
              <div key={healer.id}
                className={`flex-1 relative border-r border-white/[0.04] transition-colors ${isEven ? 'bg-white/[0.01]' : ''} ${
                  selectedCdId ? 'cursor-crosshair' : ''
                }`}
                style={{ minWidth: HEALER_COL_MIN_WIDTH, minHeight: totalHeight }}
                onClick={(e) => handleColumnClick(e, healer.id)}
                onDrop={(e) => handleDrop(e, healer.id)}
                onDragOver={(e) => handleDragOver(e, healer.id)}
                onDragLeave={handleDragLeave}
              >
                {/* Major grid lines */}
                {majorTicks.map((t) => (
                  <div key={t} className="absolute left-0 right-0 h-px bg-white/[0.06]" style={{ top: t * pxPerSec }} />
                ))}
                {/* Minor grid lines */}
                {minorTicks.map((t) => (
                  <div key={t} className="absolute left-0 right-0 h-px bg-white/[0.025]" style={{ top: t * pxPerSec }} />
                ))}

                {/* Drop preview indicator */}
                {isHoverTarget && hoverTime !== null && (
                  <div className="absolute left-2 right-2 h-8 rounded-lg border-2 border-dashed border-[color:var(--class-color)]/40 bg-[color:var(--class-color)]/[0.06] flex items-center justify-center pointer-events-none z-10"
                    style={{ top: hoverTime * pxPerSec }}>
                    <span className="text-[9px] text-[color:var(--class-color)]/60 font-mono">{formatTime(hoverTime)}</span>
                  </div>
                )}

                {/* Placed CDs */}
                {healerPlacements.map((placement) => {
                  const cdDef = getCooldownDef(placement.cooldownDefId)
                  if (!cdDef) return null
                  const hasConflict = conflictIds.has(placement.id)
                  const blockHeight = Math.max(cdDef.effectDuration * pxPerSec, 32)
                  const iconSrc = getIcon(cdDef.spellId, cdDef.iconName)

                  return (
                    <div key={placement.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        e.dataTransfer.setData('application/json', JSON.stringify({ cooldownDefId: placement.cooldownDefId, placementId: placement.id }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute left-2 right-2 rounded-lg flex items-center gap-1.5 px-2 cursor-grab active:cursor-grabbing overflow-hidden group/cd transition-all hover:brightness-125 z-[5] ${
                        hasConflict ? 'ring-2 ring-red-500/60' : ''
                      }`}
                      style={{
                        top: placement.startTime * pxPerSec,
                        height: blockHeight,
                        backgroundColor: cdDef.color + '18',
                        borderLeft: `3px solid ${cdDef.color}`,
                        boxShadow: `0 0 8px ${cdDef.color}15`,
                      }}
                      title={`${cdDef.name} @ ${formatTime(placement.startTime)} (${cdDef.effectDuration}s)${hasConflict ? ' — CD NOT READY' : ''}`}
                    >
                      {iconSrc && <img src={iconSrc} alt="" className="w-5 h-5 rounded-sm border border-white/[0.15] flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-semibold truncate" style={{ color: cdDef.color }}>{cdDef.name}</p>
                        <p className="text-[7px] text-gray-600 tabular-nums">{formatTime(placement.startTime)}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeCooldown(placement.id) }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-wow-darker border border-white/[0.1] flex items-center justify-center text-[7px] text-gray-500 hover:text-red-400 opacity-0 group-hover/cd:opacity-100 transition-all z-10">{'\u2715'}</button>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Empty state */}
          {plan.roster.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600 text-sm">Add healers to start planning</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
