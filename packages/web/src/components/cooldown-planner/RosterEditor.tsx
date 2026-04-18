import { useState } from 'react'
import { HEALER_SPECS } from '@wow-simc/shared'
import type { HealerSpec } from '@wow-simc/shared'
import { useCooldownPlannerStore } from '@/stores/useCooldownPlannerStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

export function RosterEditor() {
  const { plan, addHealer, removeHealer, renameHealer } = useCooldownPlannerStore()
  const [selectedSpec, setSelectedSpec] = useState<HealerSpec>('holy_paladin')
  const [playerName, setPlayerName] = useState('')

  const handleAdd = () => {
    const spec = HEALER_SPECS.find((s) => s.spec === selectedSpec)
    addHealer(selectedSpec, playerName.trim() || spec?.label || 'Healer')
    setPlayerName('')
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-400">Healer Roster</label>

      {/* Current roster */}
      {plan.roster.length > 0 && (
        <div className="space-y-1">
          {plan.roster.map((healer) => {
            const spec = HEALER_SPECS.find((s) => s.spec === healer.spec)
            return (
              <div key={healer.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-wow-darker/60 border border-white/[0.06]">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: spec?.classColor ?? '#666' }} />
                <input value={healer.name} onChange={(e) => renameHealer(healer.id, e.target.value)}
                  className="flex-1 bg-transparent text-xs text-gray-200 focus:outline-none min-w-0" />
                <span className="text-[9px] text-gray-600 flex-shrink-0 hidden sm:inline">{spec?.className}</span>
                <button onClick={() => removeHealer(healer.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-[10px] flex-shrink-0">{'\u2715'}</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add healer */}
      <div className="space-y-1.5">
        <Select value={selectedSpec} onChange={(e) => setSelectedSpec(e.target.value as HealerSpec)}>
          {HEALER_SPECS.map((s) => (
            <option key={s.spec} value={s.spec}>{s.label}</option>
          ))}
        </Select>
        <div className="flex gap-1.5">
          <Input value={playerName} onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Player name"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
          <Button variant="secondary" size="sm" onClick={handleAdd}>Add</Button>
        </div>
      </div>
    </div>
  )
}
