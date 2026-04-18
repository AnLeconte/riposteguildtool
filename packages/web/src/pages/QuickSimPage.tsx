import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SimcInput } from '@/components/sim/SimcInput'
import { api } from '@/lib/api'
import { useSimStore } from '@/stores/useSimStore'

export function QuickSimPage() {
  const [simcInput, setSimcInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setSimId } = useSimStore()

  const handleSimulate = async () => {
    if (!simcInput.trim()) { setError('Please paste your /simc string'); return }
    setLoading(true); setError(null)
    try {
      const result = await api.quickSim(simcInput)
      setSimId(result.id)
      navigate(`/sim/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start simulation')
    } finally { setLoading(false) }
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Quick" highlight="Sim" description="Paste your /simc string and get instant DPS results." />
      <Card>
        <div className="space-y-4">
          <SimcInput value={simcInput} onChange={setSimcInput} rows={12} />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={handleSimulate} disabled={loading || !simcInput.trim()} size="lg">
              {loading ? 'Starting...' : 'Simulate'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
