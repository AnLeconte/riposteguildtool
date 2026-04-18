import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SimcInput } from '@/components/sim/SimcInput'
import { api } from '@/lib/api'
import { useSimStore } from '@/stores/useSimStore'

export function GearComparePage() {
  const [simcInputA, setSimcInputA] = useState('')
  const [simcInputB, setSimcInputB] = useState('')
  const [nameA, setNameA] = useState('')
  const [nameB, setNameB] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setSimId } = useSimStore()

  const handleSimulate = async () => {
    if (!simcInputA.trim()) {
      setError('Please paste your /simc string for Set A')
      return
    }
    if (!simcInputB.trim()) {
      setError('Please paste your /simc string for Set B')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await api.gearCompare(
        simcInputA, simcInputB,
        nameA.trim() || undefined, nameB.trim() || undefined,
      )
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
      <div>
      <PageHeader title="Gear" highlight="Compare" description="Compare two gear sets side by side." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-wow-blue/20 border border-wow-blue/40 flex items-center justify-center text-wow-blue text-xs font-bold">A</span>
              <h2 className="text-sm font-medium text-gray-300">Set A (Base)</h2>
            </div>
            <input
              type="text"
              placeholder="Name (e.g. Current Gear)"
              value={nameA}
              onChange={(e) => setNameA(e.target.value)}
              className="w-full bg-wow-darker/80 border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-wow-gold/30 focus:border-[color:var(--class-color)]/40"
            />
            <SimcInput value={simcInputA} onChange={setSimcInputA} rows={12} label="" />
          </div>
        </Card>

        <Card>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[color:var(--class-color)]/20 border border-[color:var(--class-color)]/40 flex items-center justify-center text-[color:var(--class-color)] text-xs font-bold">B</span>
              <h2 className="text-sm font-medium text-gray-300">Set B (Alternate)</h2>
            </div>
            <input
              type="text"
              placeholder="Name (e.g. Upgrade Set)"
              value={nameB}
              onChange={(e) => setNameB(e.target.value)}
              className="w-full bg-wow-darker/80 border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-wow-gold/30 focus:border-[color:var(--class-color)]/40"
            />
            <SimcInput value={simcInputB} onChange={setSimcInputB} rows={12} label="" />
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-sm">
              Set A will be used as the base profile. Set B gear will be applied as a profileset.
            </p>
            <Button onClick={handleSimulate} disabled={loading || !simcInputA.trim() || !simcInputB.trim()} size="lg">
              {loading ? 'Starting...' : 'Compare Gear'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
