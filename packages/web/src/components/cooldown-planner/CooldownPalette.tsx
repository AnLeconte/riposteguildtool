import { useMemo } from 'react'
import { HEALER_SPECS } from '@wow-simc/shared'
import { useCooldownPlannerStore } from '@/stores/useCooldownPlannerStore'
import { useSpellIcons } from '@/lib/useSpellIcons'

export function CooldownPalette() {
  const { plan, selectedCdId, selectedHealerId, setSelectedCd } = useCooldownPlannerStore()

  if (plan.roster.length === 0) return null

  const healerCds = plan.roster.map((healer) => {
    const spec = HEALER_SPECS.find((s) => s.spec === healer.spec)
    return { healer, spec, cooldowns: spec?.cooldowns ?? [] }
  })

  const allSpellIds = useMemo(() => {
    const ids: number[] = []
    for (const { cooldowns } of healerCds) {
      for (const cd of cooldowns) { if (cd.spellId) ids.push(cd.spellId) }
    }
    return ids
  }, [healerCds])
  const spellIcons = useSpellIcons(allSpellIds)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-400">Cooldowns</label>
        {selectedCdId && (
          <button onClick={() => setSelectedCd(null)} className="text-[9px] text-gray-500 hover:text-gray-300">{'\u2715'} Cancel</button>
        )}
      </div>
      <p className="text-[10px] text-gray-600">Drag or click to place on timeline</p>

      <div className="space-y-2.5">
        {healerCds.map(({ healer, spec, cooldowns }) => (
          <div key={healer.id} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: spec?.classColor ?? '#666' }} />
              <span className="text-[10px] font-medium text-gray-400">{healer.name}</span>
            </div>

            <div className="space-y-0.5">
              {cooldowns.map((cd) => {
                const iconUrl = cd.spellId ? spellIcons.get(cd.spellId) : undefined
                const iconSrc = iconUrl ?? (cd.iconName ? `https://wow.zamimg.com/images/wow/icons/small/${cd.iconName}.jpg` : undefined)
                const isSelected = selectedCdId === cd.id && selectedHealerId === healer.id

                return (
                  <div key={`${healer.id}-${cd.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({ cooldownDefId: cd.id, healerId: healer.id }))
                      e.dataTransfer.effectAllowed = 'copyMove'
                    }}
                    onClick={() => setSelectedCd(isSelected ? null : cd.id, isSelected ? null : healer.id)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[color:var(--class-color)]/40 bg-[color:var(--class-color)]/[0.08]'
                        : 'border-white/[0.06] bg-wow-darker/60 hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {iconSrc ? (
                        <img src={iconSrc} alt="" className="w-4 h-4 rounded-sm border border-white/[0.1] flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ) : (
                        <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: cd.color + '40' }} />
                      )}
                      <span className="text-[11px] text-gray-300 truncate">{cd.name}</span>
                    </div>
                    <span className="text-[9px] text-gray-600 flex-shrink-0 ml-1 tabular-nums">
                      {cd.cooldownDuration >= 60 ? `${cd.cooldownDuration / 60}m` : `${cd.cooldownDuration}s`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
