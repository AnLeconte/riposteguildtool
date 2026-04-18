import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SimcInput } from '@/components/sim/SimcInput'
import { api } from '@/lib/api'
import { useSimStore } from '@/stores/useSimStore'
import type { SimOptions } from '@wow-simc/shared'

const FIGHT_STYLES = ['Patchwerk', 'HecticAddCleave', 'DungeonSlice', 'CastingPatchwerk'] as const

const selectClass = 'w-full rounded-lg bg-wow-darker/80 border border-white/[0.08] px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-wow-gold/30 focus:border-[color:var(--class-color)]/40'

export function AdvancedPage() {
  const [simcInput, setSimcInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setSimId } = useSimStore()

  const [iterations, setIterations] = useState<string>('10000')
  const [fightStyle, setFightStyle] = useState<string>('Patchwerk')
  const [fightLength, setFightLength] = useState<string>('300')
  const [targetError, setTargetError] = useState<string>('0.2')

  const handleSimulate = async () => {
    if (!simcInput.trim()) { setError('Please enter a SimC profile'); return }
    setLoading(true); setError(null)
    try {
      const sim_options: Partial<SimOptions> = {
        iterations: parseInt(iterations, 10) || 10000,
        fight_style: fightStyle as SimOptions['fight_style'],
        fight_length: parseFloat(fightLength) || 300,
        target_error: parseFloat(targetError) || 0.2,
      }
      const result = await api.advanced(simcInput, sim_options)
      setSimId(result.id)
      navigate(`/sim/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start simulation')
    } finally { setLoading(false) }
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Advanced" highlight="Mode" description="Full SimC editor with all options." />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <SimcInput value={simcInput} onChange={setSimcInput} rows={28} label=""
              placeholder={'# Advanced SimC profile\ndeathknight="MyDK"\nlevel=90\nrace=human\nspec=unholy'} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Sim Options</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">Fight Style</label>
                <Select value={fightStyle} onChange={(e) => setFightStyle(e.target.value)} >
                  {FIGHT_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">Iterations</label>
                <Select value={iterations} onChange={(e) => setIterations(e.target.value)} >
                  <option value="1000">1,000 (fast)</option>
                  <option value="5000">5,000</option>
                  <option value="10000">10,000 (default)</option>
                  <option value="25000">25,000</option>
                  <option value="50000">50,000 (slow)</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">Fight Length</label>
                <Select value={fightLength} onChange={(e) => setFightLength(e.target.value)} >
                  <option value="180">180s</option>
                  <option value="240">240s</option>
                  <option value="300">300s</option>
                  <option value="360">360s</option>
                  <option value="480">480s</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">Target Error</label>
                <Select value={targetError} onChange={(e) => setTargetError(e.target.value)} >
                  <option value="0.5">0.5%</option>
                  <option value="0.2">0.2%</option>
                  <option value="0.1">0.1%</option>
                  <option value="0.05">0.05%</option>
                </Select>
              </div>
            </div>
          </Card>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-red-400 text-sm">{error}</div>
          )}

          <Button onClick={handleSimulate} disabled={loading} size="lg" className="w-full">
            {loading ? 'Starting...' : 'Simulate'}
          </Button>
        </div>
      </div>
    </div>
  )
}
