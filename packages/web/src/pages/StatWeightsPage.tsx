import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SimcInput } from '@/components/sim/SimcInput'
import { api } from '@/lib/api'
import { useSimStore } from '@/stores/useSimStore'

const FIGHT_STYLES = [
  { value: 'Patchwerk', label: 'Patchwerk (Single Target)' },
  { value: 'HecticAddCleave', label: 'Hectic Add Cleave' },
  { value: 'DungeonSlice', label: 'Dungeon Slice' },
  { value: 'CastingPatchwerk', label: 'Casting Patchwerk' },
] as const

export function StatWeightsPage() {
  const [simcInput, setSimcInput] = useState('')
  const [fightStyle, setFightStyle] = useState<'Patchwerk' | 'HecticAddCleave' | 'DungeonSlice' | 'CastingPatchwerk'>('Patchwerk')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setSimId } = useSimStore()

  const handleSimulate = async () => {
    if (!simcInput.trim()) {
      setError('Please paste your /simc string')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await api.statWeights(simcInput, { fight_style: fightStyle })
      setSimId(result.id)
      navigate(`/sim/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start simulation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Stat" highlight="Weights" description="Calculate scale factors and generate a Pawn string." />

      <Card>
        <SimcInput value={simcInput} onChange={setSimcInput} rows={12} />
      </Card>

      <Card>
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-gray-300">Simulation Options</h2>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Fight Style</label>
            <div className="grid grid-cols-2 gap-2">
              {FIGHT_STYLES.map((fs) => (
                <button
                  key={fs.value}
                  type="button"
                  onClick={() => setFightStyle(fs.value)}
                  className={[
                    'px-3 py-2 rounded-lg text-sm border transition-colors text-left',
                    fightStyle === fs.value
                      ? 'bg-[color:var(--class-color)]/10 border-[color:var(--class-color)]/40 text-[color:var(--class-color)]'
                      : 'bg-wow-darker/80 border-white/[0.08] text-gray-300 hover:border-white/[0.15]',
                  ].join(' ')}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-wow-darker/60 border border-white/[0.06] px-4 py-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              Stat weights are calculated using SimC's{' '}
              <code className="text-wow-blue">calculate_scale_factors</code> option. The result
              includes a Pawn string you can paste directly into the Pawn addon.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={handleSimulate} disabled={loading || !simcInput.trim()} size="lg">
              {loading ? 'Starting...' : 'Calculate Stat Weights'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
