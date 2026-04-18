import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

const SIM_TYPE_LABELS: Record<string, string> = {
  'quick-sim': 'Quick Sim',
  'top-gear': 'Top Gear',
  'stat-weights': 'Stat Weights',
  droptimizer: 'Droptimizer',
  'gear-compare': 'Gear Compare',
  advanced: 'Advanced',
}

const SIM_TYPE_COLORS: Record<string, string> = {
  'quick-sim': 'text-wow-blue',
  'top-gear': 'text-amber-400',
  'stat-weights': 'text-purple-400',
  droptimizer: 'text-green-400',
  'gear-compare': 'text-cyan-400',
  advanced: 'text-gray-400',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    queued: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium capitalize border ${styles[status] ?? styles.cancelled}`}>
      {(status === 'running' || status === 'queued') && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {status}
    </span>
  )
}

function getFightStyle(sim: any): string {
  const opts = sim.sim_options
  return opts?.fight_style || opts?.sim_options?.fight_style || 'Patchwerk'
}

const PAGE_SIZE = 20

export function HistoryPage() {
  const [sims, setSims] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [hasMore, setHasMore] = useState(true)
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const autoRefreshRef = useRef<ReturnType<typeof setInterval>>()

  const load = useCallback(async (fetchLimit = limit) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getHistory(fetchLimit)
      setSims(data)
      setHasMore(data.length >= fetchLimit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    load()
  }, [load])

  // Auto-refresh while there are running/queued sims
  useEffect(() => {
    const hasActive = sims.some((s) => s.status === 'running' || s.status === 'queued')
    if (hasActive) {
      autoRefreshRef.current = setInterval(() => load(), 5000)
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    }
  }, [sims, load])

  const loadMore = () => {
    const newLimit = limit + PAGE_SIZE
    setLimit(newLimit)
    load(newLimit)
  }

  const cancelSim = async (id: string) => {
    setCancellingIds((prev) => new Set(prev).add(id))
    try {
      await api.cancelSimulation(id)
      setSims((prev) => prev.map((s) => s.id === id ? { ...s, status: 'cancelled' } : s))
    } catch { /* ignore */ }
    finally {
      setCancellingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const deleteSim = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await api.cancelSimulation(id) // reuse DELETE endpoint
      setSims((prev) => prev.filter((s) => s.id !== id))
    } catch { /* ignore */ }
    finally {
      setDeletingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">History</h1>
          <p className="text-gray-500 text-sm mt-1">Your recent simulations</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => load()}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {error && (
          <p className="text-red-400 text-center py-8">{error}</p>
        )}

        {!error && loading && sims.length === 0 && (
          <div className="py-12 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6">
                <div className="h-4 w-20 bg-white/[0.04] rounded animate-pulse" />
                <div className="h-4 w-16 bg-white/[0.04] rounded animate-pulse" />
                <div className="h-4 w-24 bg-white/[0.04] rounded animate-pulse flex-1" />
                <div className="h-4 w-12 bg-white/[0.04] rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!error && !loading && sims.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl text-gray-700 mb-2">&#9881;</p>
            <p className="text-gray-500">No simulations yet</p>
            <Link to="/quick-sim">
              <Button variant="secondary" size="sm">Run your first sim</Button>
            </Link>
          </div>
        )}

        {sims.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-gray-600">Status</th>
                    <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-gray-600">DPS</th>
                    <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-gray-600">Fight Style</th>
                    <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-gray-600">Date</th>
                    <th className="px-6 py-3 w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {sims.map((sim, i) => {
                    const dps = sim.result?.dps?.mean
                    const typeColor = SIM_TYPE_COLORS[sim.sim_type] ?? 'text-gray-400'
                    const isActive = sim.status === 'queued' || sim.status === 'running'
                    return (
                      <tr
                        key={sim.id}
                        className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${
                          i === sims.length - 1 ? 'border-b-0' : ''
                        } ${deletingIds.has(sim.id) ? 'opacity-40' : ''}`}
                      >
                        <td className={`px-6 py-3.5 font-medium ${typeColor}`}>
                          {SIM_TYPE_LABELS[sim.sim_type] ?? sim.sim_type}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={sim.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-gray-200">
                          {dps != null ? Math.round(dps).toLocaleString() : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500">
                          {getFightStyle(sim)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-gray-600 tabular-nums">
                          {sim.created_at ? formatDate(sim.created_at) : '—'}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {isActive && (
                              <button
                                onClick={() => cancelSim(sim.id)}
                                disabled={cancellingIds.has(sim.id)}
                                className="text-[11px] font-medium text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40"
                              >
                                Stop
                              </button>
                            )}
                            {!isActive && (
                              <button
                                onClick={() => deleteSim(sim.id)}
                                disabled={deletingIds.has(sim.id)}
                                className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <Link
                              to={`/sim/${sim.id}`}
                              className="text-[11px] font-medium text-gray-500 hover:text-[color:var(--class-color)] transition-colors"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="border-t border-white/[0.06] px-6 py-3 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="text-xs font-medium text-gray-500 hover:text-[color:var(--class-color)] transition-colors disabled:opacity-40"
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
