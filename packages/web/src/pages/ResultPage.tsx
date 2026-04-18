import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SimProgress } from '@/components/sim/SimProgress'
import { DpsResult } from '@/components/sim/DpsResult'
import { ProfilesetResultsTable } from '@/components/sim/ProfilesetResultsTable'
import { StatWeightsResultDisplay } from '@/components/sim/StatWeightsResult'
import { DroptimizerResults } from '@/components/sim/DroptimizerResults'
import { api } from '@/lib/api'
import { subscribeToSim } from '@/lib/socket'

const SIM_TYPE_LABELS: Record<string, string> = {
  'quick-sim': 'Quick Sim',
  'top-gear': 'Top Gear',
  'stat-weights': 'Stat Weights',
  droptimizer: 'Droptimizer',
  'gear-compare': 'Gear Compare',
  advanced: 'Advanced',
}

const SIM_TYPE_BACK: Record<string, string> = {
  'quick-sim': '/quick-sim',
  'top-gear': '/top-gear',
  'stat-weights': '/stat-weights',
  droptimizer: '/droptimizer',
  'gear-compare': '/gear-compare',
  advanced: '/advanced',
}

export function ResultPage() {
  const { id } = useParams<{ id: string }>()
  const [sim, setSim] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [justCompleted, setJustCompleted] = useState(false)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const isActive = (status: string) => status === 'queued' || status === 'running'

  const fetchSim = async (simId: string) => {
    const data = await api.getSimulation(simId)
    setSim(data)
    return data
  }

  const scheduleFallback = (simId: string) => {
    fallbackTimerRef.current = setTimeout(async () => {
      try {
        const data = await fetchSim(simId)
        if (isActive(data.status)) scheduleFallback(simId)
      } catch {
        // Ignore fallback errors
      }
    }, 5000)
  }

  const clearFallback = () => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!id) return

    let cancelled = false

    const init = async () => {
      try {
        const data = await fetchSim(id)
        if (cancelled) return

        if (!isActive(data.status)) return

        // Subscribe via Socket.IO
        unsubscribeRef.current = subscribeToSim(id, {
          onProgress: (progress) => {
            setSim((prev: any) => prev ? { ...prev, progress, status: 'running' } : prev)
          },
          onCompleted: async (_result) => {
            clearFallback()
            setJustCompleted(true)
            // Notification
            useNotificationStore.getState().addNotification({
              type: 'sim_complete',
              title: 'Simulation complete',
              body: `Your simulation has finished.`,
            })
            try {
              const fresh = await api.getSimulation(id)
              if (!cancelled) setSim(fresh)
            } catch {
              setSim((prev: any) => prev ? { ...prev, status: 'completed', progress: 100 } : prev)
            }
            // Clear the "just completed" flash after animation
            setTimeout(() => setJustCompleted(false), 2000)
          },
          onFailed: (socketError) => {
            clearFallback()
            setSim((prev: any) => prev
              ? { ...prev, status: 'failed', error: socketError }
              : prev)
          },
        })

        scheduleFallback(id)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load simulation')
        }
      }
    }

    init()

    return () => {
      cancelled = true
      clearFallback()
      unsubscribeRef.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ── Error state ──
  if (error) {
    return (
      <div className="w-full">
        <Card>
          <div className="text-center space-y-4 py-8">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <span className="text-red-400 text-xl">!</span>
            </div>
            <p className="text-red-400 font-medium">{error}</p>
            <Link to="/quick-sim"><Button variant="secondary">Try Again</Button></Link>
          </div>
        </Card>
      </div>
    )
  }

  // ── Loading skeleton ──
  if (!sim) {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-wow-accent/30 rounded animate-pulse" />
          <div className="h-9 w-32 bg-wow-accent/20 rounded animate-pulse" />
        </div>
        <Card>
          <div className="py-12 space-y-4">
            <div className="h-4 w-40 mx-auto bg-wow-accent/20 rounded animate-pulse" />
            <div className="h-3 w-full bg-wow-darker rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-wow-accent/30 rounded-full animate-pulse" />
            </div>
            <div className="h-3 w-24 mx-auto bg-wow-accent/20 rounded animate-pulse" />
          </div>
        </Card>
      </div>
    )
  }

  const simTypeLabel = SIM_TYPE_LABELS[sim.sim_type] ?? sim.sim_type
  const backLink = SIM_TYPE_BACK[sim.sim_type] ?? '/quick-sim'
  const isTopGear = sim.sim_type === 'top-gear'
  const isStatWeights = sim.sim_type === 'stat-weights'
  const isDroptimizer = sim.sim_type === 'droptimizer'
  const isGearCompare = sim.sim_type === 'gear-compare'
  const hasProfilesets =
    Array.isArray(sim.profileset_results) && sim.profileset_results.length > 0

  const displayOptions = (isTopGear || isDroptimizer || isGearCompare)
    ? (sim.sim_options?.sim_options ?? sim.sim_options)
    : sim.sim_options

  const isInProgress = sim.status === 'queued' || sim.status === 'running'
  const isCompleted = sim.status === 'completed'
  const isFailed = sim.status === 'failed'

  return (
    <div className={`w-full space-y-6`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[color:var(--class-color)]">{simTypeLabel}</h1>
          {isInProgress && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-wow-blue bg-wow-blue/10 border border-wow-blue/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-wow-blue animate-pulse" />
              In Progress
            </span>
          )}
          {isCompleted && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors duration-1000 ${
              justCompleted
                ? 'text-green-400 bg-green-400/10 border border-green-400/30'
                : 'text-gray-400 bg-gray-400/10 border border-gray-400/20'
            }`}>
              Complete
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isCompleted && <CopyLinkButton />}
          <Link to={backLink}>
            <Button variant="secondary" size="sm">New Simulation</Button>
          </Link>
        </div>
      </div>

      {/* Progress card (all sim types while in progress) */}
      {isInProgress && (
        <Card>
          <SimProgress
            progress={sim.progress}
            status={sim.status}
            queuePosition={sim.queuePosition}
            simType={sim.sim_type}
          />
        </Card>
      )}

      {/* DPS result card (not for droptimizer) */}
      {isCompleted && sim.result && !isDroptimizer && (
        <Card>
          <div className={justCompleted ? 'animate-fade-in' : ''}>
            {isStatWeights ? (
              <StatWeightsResultDisplay result={sim.result} />
            ) : (
              <DpsResult
                mean={sim.result.dps.mean}
                min={sim.result.dps.min}
                max={sim.result.dps.max}
                median={sim.result.dps.median}
              />
            )}
          </div>
        </Card>
      )}

      {/* Error card */}
      {isFailed && (
        <Card>
          <div className="text-center space-y-4 py-6">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <span className="text-red-400 text-xl">!</span>
            </div>
            <div>
              <p className="text-red-400 font-medium mb-1">Simulation failed</p>
              {sim.error && (
                <p className="text-gray-500 text-sm font-mono max-w-xl mx-auto break-words">
                  {sim.error}
                </p>
              )}
            </div>
            <Link to={backLink}><Button variant="secondary">Try Again</Button></Link>
          </div>
        </Card>
      )}

      {/* Profileset results for Top Gear */}
      {isCompleted && isTopGear && hasProfilesets && (
        <Card>
          <ProfilesetResultsTable results={sim.profileset_results} title="Gear Rankings" />
        </Card>
      )}

      {/* Profileset results for Gear Compare */}
      {isCompleted && isGearCompare && hasProfilesets && (
        <Card>
          <ProfilesetResultsTable results={sim.profileset_results} title="Set Comparison" />
        </Card>
      )}

      {/* Droptimizer instance banners + results */}
      {isCompleted && isDroptimizer && (
        <>
          {/* Instance banners */}
          {sim.sim_options?.instances?.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {sim.sim_options.instances.map((inst: any) => (
                <div
                  key={inst.id}
                  className="relative flex-shrink-0 w-56 h-24 rounded-xl overflow-hidden border border-white/[0.06]"
                >
                  {inst.image_url ? (
                    <img src={inst.image_url} alt={inst.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-wow-panel" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
                    <p className="text-sm font-semibold text-white drop-shadow-lg">{inst.name}</p>
                    <p className="text-[10px] text-gray-300 uppercase tracking-wide">{inst.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasProfilesets && (
            <Card>
              <DroptimizerResults
                results={sim.profileset_results}
                baseDps={sim.result?.dps?.mean}
                items={sim.sim_options?.items}
              />
            </Card>
          )}
        </>
      )}

      {/* AI Insights */}
      {isCompleted && sim.ai_insights && (
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">AI</span>
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="text-sm font-semibold text-gray-300">AI Analysis</h2>
              <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                {sim.ai_insights}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Sim details */}
      {isCompleted && !isStatWeights && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-200 mb-3">Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Fight Style</p>
              <p className="text-gray-300">{displayOptions?.fight_style || 'Patchwerk'}</p>
            </div>
            <div>
              <p className="text-gray-500">Iterations</p>
              <p className="text-gray-300">{displayOptions?.iterations?.toLocaleString() || '10,000'}</p>
            </div>
            <div>
              <p className="text-gray-500">Fight Length</p>
              <p className="text-gray-300">{displayOptions?.fight_length || 300}s</p>
            </div>
            <div>
              <p className="text-gray-500">Target Error</p>
              <p className="text-gray-300">{displayOptions?.target_error || 0.2}%</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback: ignore */ }
  }, [])

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy Link'}
    </Button>
  )
}
