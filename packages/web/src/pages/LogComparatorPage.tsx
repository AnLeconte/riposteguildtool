import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface Fight { id: number; name: string; kill: boolean; difficulty: number }
interface Player { name: string; type: string; total: number }
interface CompareData { fightsA: Fight[]; fightsB: Fight[]; detailsA: { dps: Player[]; hps: Player[] } | null; detailsB: { dps: Player[]; hps: Player[] } | null }

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569',
  Priest: '#FFFFFF', DeathKnight: '#C41F3B', Shaman: '#0070DE', Mage: '#69CCF0',
  Warlock: '#9482C9', Monk: '#00FF96', Druid: '#FF7D0A', DemonHunter: '#A330C9', Evoker: '#33937F',
}

function formatNum(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString() }
function extractCode(url: string): string { return url.match(/reports\/([a-zA-Z0-9]+)/)?.[1] ?? url.trim() }

export function LogComparatorPage() {
  const [urlA, setUrlA] = useState('')
  const [urlB, setUrlB] = useState('')
  const [fightsA, setFightsA] = useState<Fight[]>([])
  const [fightsB, setFightsB] = useState<Fight[]>([])
  const [fightIdA, setFightIdA] = useState<number | null>(null)
  const [fightIdB, setFightIdB] = useState<number | null>(null)
  const [detailsA, setDetailsA] = useState<{ dps: Player[]; hps: Player[] } | null>(null)
  const [detailsB, setDetailsB] = useState<{ dps: Player[]; hps: Player[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFights = async (url: string, side: 'A' | 'B') => {
    const code = extractCode(url)
    if (!code) return
    try {
      const data = await api.getWclReport(code)
      if (side === 'A') setFightsA(data.fights)
      else setFightsB(data.fights)
    } catch (err) {
      setError(`Failed to load report ${side}`)
    }
  }

  const compare = async () => {
    const codeA = extractCode(urlA)
    const codeB = extractCode(urlB)
    if (!codeA || !codeB || !fightIdA || !fightIdB) { setError('Select fights from both logs'); return }
    setLoading(true); setError(null); setDetailsA(null); setDetailsB(null)
    try {
      const [dA, dB] = await Promise.all([
        api.getWclFight(codeA, fightIdA),
        api.getWclFight(codeB, fightIdB),
      ])
      setDetailsA(dA); setDetailsB(dB)
    } catch { setError('Failed to compare fights') }
    finally { setLoading(false) }
  }

  // Merge players for comparison
  const mergedDps = (() => {
    if (!detailsA || !detailsB) return []
    const map = new Map<string, { name: string; type: string; a: number; b: number }>()
    for (const p of detailsA.dps) map.set(p.name, { name: p.name, type: p.type, a: p.total, b: 0 })
    for (const p of detailsB.dps) {
      const e = map.get(p.name)
      if (e) e.b = p.total
      else map.set(p.name, { name: p.name, type: p.type, a: 0, b: p.total })
    }
    return [...map.values()].sort((a, b) => Math.max(b.a, b.b) - Math.max(a.a, a.b))
  })()

  const mergedHps = (() => {
    if (!detailsA || !detailsB) return []
    const map = new Map<string, { name: string; type: string; a: number; b: number }>()
    for (const p of detailsA.hps) map.set(p.name, { name: p.name, type: p.type, a: p.total, b: 0 })
    for (const p of detailsB.hps) {
      const e = map.get(p.name)
      if (e) e.b = p.total
      else map.set(p.name, { name: p.name, type: p.type, a: 0, b: p.total })
    }
    return [...map.values()].sort((a, b) => Math.max(b.a, b.b) - Math.max(a.a, a.b))
  })()

  return (
    <div className="w-full space-y-6">
      <div>
      <PageHeader title="Log" highlight="Comparator" description="Compare two kills to track progression" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Log A */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-wow-blue/20 border border-wow-blue/40 flex items-center justify-center text-wow-blue text-xs font-bold">A</span>
            <span className="text-sm font-medium text-gray-300">Log A</span>
          </div>
          <Input value={urlA} onChange={(e) => setUrlA(e.target.value)} placeholder="WCL URL or report code"
            onBlur={() => urlA && loadFights(urlA, 'A')} onKeyDown={(e) => e.key === 'Enter' && loadFights(urlA, 'A')} />
          {fightsA.length > 0 && (
            <Select value={fightIdA ?? ''} onChange={(e) => setFightIdA(Number(e.target.value) || null)}
              >
              <option value="">Select fight...</option>
              {fightsA.map((f) => <option key={f.id} value={f.id}>{f.name} {f.kill ? '(Kill)' : '(Wipe)'}</option>)}
            </Select>
          )}
        </Card>

        {/* Log B */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[color:var(--class-color)]/20 border border-[color:var(--class-color)]/40 flex items-center justify-center text-[color:var(--class-color)] text-xs font-bold">B</span>
            <span className="text-sm font-medium text-gray-300">Log B</span>
          </div>
          <Input value={urlB} onChange={(e) => setUrlB(e.target.value)} placeholder="WCL URL or report code"
            onBlur={() => urlB && loadFights(urlB, 'B')} onKeyDown={(e) => e.key === 'Enter' && loadFights(urlB, 'B')} />
          {fightsB.length > 0 && (
            <Select value={fightIdB ?? ''} onChange={(e) => setFightIdB(Number(e.target.value) || null)}
              >
              <option value="">Select fight...</option>
              {fightsB.map((f) => <option key={f.id} value={f.id}>{f.name} {f.kill ? '(Kill)' : '(Wipe)'}</option>)}
            </Select>
          )}
        </Card>
      </div>

      <div className="flex justify-center">
        <Button onClick={compare} disabled={loading || !fightIdA || !fightIdB} size="lg">
          {loading ? 'Comparing...' : 'Compare'}
        </Button>
      </div>
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      {/* Results */}
      {detailsA && detailsB && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* DPS comparison */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]"><h3 className="text-sm font-semibold text-gray-300">DPS Comparison</h3></div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-white/[0.06]">
                <th className="text-left px-3 py-2 text-gray-600">Player</th>
                <th className="text-right px-2 py-2 text-wow-blue/60">A</th>
                <th className="text-right px-2 py-2 text-[color:var(--class-color)]/60">B</th>
                <th className="text-right px-3 py-2 text-gray-600">Delta</th>
              </tr></thead>
              <tbody>
                {mergedDps.slice(0, 20).map((p) => {
                  const delta = p.b - p.a; const color = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-600'
                  return (
                    <tr key={p.name} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-3 py-2"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: CLASS_COLORS[p.type] ?? '#888' }} />{p.name}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-400">{p.a > 0 ? formatNum(p.a) : '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-400">{p.b > 0 ? formatNum(p.b) : '—'}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${color}`}>{delta > 0 ? '+' : ''}{delta !== 0 ? formatNum(delta) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>

          {/* HPS comparison */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]"><h3 className="text-sm font-semibold text-green-400/80">HPS Comparison</h3></div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-white/[0.06]">
                <th className="text-left px-3 py-2 text-gray-600">Player</th>
                <th className="text-right px-2 py-2 text-wow-blue/60">A</th>
                <th className="text-right px-2 py-2 text-[color:var(--class-color)]/60">B</th>
                <th className="text-right px-3 py-2 text-gray-600">Delta</th>
              </tr></thead>
              <tbody>
                {mergedHps.slice(0, 20).map((p) => {
                  const delta = p.b - p.a; const color = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-600'
                  return (
                    <tr key={p.name} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-3 py-2"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: CLASS_COLORS[p.type] ?? '#888' }} />{p.name}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-400">{p.a > 0 ? formatNum(p.a) : '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-400">{p.b > 0 ? formatNum(p.b) : '—'}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${color}`}>{delta > 0 ? '+' : ''}{delta !== 0 ? formatNum(delta) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  )
}
