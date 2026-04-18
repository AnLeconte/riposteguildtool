import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface SimProgressProps {
  progress: number
  status: string
  queuePosition?: number
  simType?: string
}

const SIM_TYPE_LABELS: Record<string, string> = {
  'quick-sim': 'Quick Sim',
  'top-gear': 'Top Gear',
  'stat-weights': 'Stat Weights',
  droptimizer: 'Droptimizer',
  'gear-compare': 'Gear Compare',
  advanced: 'Advanced',
}

const FLAVOR_MESSAGES = [
  'Simulating combat encounters...',
  'Crunching the numbers...',
  'Calculating optimal rotations...',
  'Processing stat interactions...',
  'Evaluating gear combinations...',
  'Running iterations...',
  'Analyzing damage output...',
  'Computing DPS distributions...',
]

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function formatEta(seconds: number): string {
  if (seconds < 5) return 'almost done'
  if (seconds > 600) return '> 10 min'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m === 0) return `~${s}s remaining`
  return `~${m}m ${s.toString().padStart(2, '0')}s remaining`
}

/**
 * Compute a visual progress that never sits still.
 * When real progress is low (0-2%), we show a slow-creeping bar
 * so the user sees something moving. Once real progress kicks in,
 * we follow it directly.
 */
function useVisualProgress(realProgress: number, elapsed: number): number {
  // During setup phase (real ~0-2%), show slow visual progress up to 15%
  // based on elapsed time (reaches ~12% at 30s, ~15% cap)
  const setupProgress = Math.min(15, elapsed * 0.5)

  // Once real progress > setupProgress, follow real progress
  return Math.max(realProgress, setupProgress)
}

export function SimProgress({ progress, status, queuePosition, simType }: SimProgressProps) {
  const [elapsed, setElapsed] = useState(0)
  const [flavorIdx, setFlavorIdx] = useState(() => Math.floor(Math.random() * FLAVOR_MESSAGES.length))
  const startTimeRef = useRef(Date.now())

  // Elapsed timer
  useEffect(() => {
    startTimeRef.current = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Rotate flavor text every 4s
  useEffect(() => {
    if (status !== 'running') return
    const interval = setInterval(() => {
      setFlavorIdx((i) => (i + 1) % FLAVOR_MESSAGES.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [status])

  const visualProgress = useVisualProgress(progress, elapsed)

  // ETA based on real progress (only when real progress is meaningful)
  const eta = useMemo(() => {
    if (status !== 'running' || progress <= 3 || elapsed < 3) return null
    const remaining = ((elapsed / progress) * (100 - progress))
    return Math.round(remaining)
  }, [status, progress, elapsed])

  // Phase label
  const phaseLabel = progress <= 2 && elapsed > 1
    ? 'Setting up simulation...'
    : FLAVOR_MESSAGES[flavorIdx]

  const simLabel = simType ? SIM_TYPE_LABELS[simType] ?? simType : null

  // ── Queued state ──
  if (status === 'queued') {
    return (
      <div className="py-6 space-y-5">
        <div className="text-center space-y-2">
          {simLabel && (
            <span className="inline-block text-xs font-medium text-wow-blue/80 bg-wow-blue/10 border border-wow-blue/20 px-2.5 py-0.5 rounded-full">
              {simLabel}
            </span>
          )}
          <h3 className="text-lg font-semibold text-gray-200">Waiting in queue</h3>
          {typeof queuePosition === 'number' && queuePosition > 0 ? (
            <p className="text-sm text-gray-400">
              Position <span className="text-[color:var(--class-color)] font-bold text-base">{queuePosition}</span>
              {queuePosition === 1 ? ' — you\'re next!' : ` of ${queuePosition}`}
            </p>
          ) : (
            <p className="text-sm text-gray-500">Your simulation will start shortly</p>
          )}
        </div>

        <div className="w-full bg-wow-darker rounded-full h-2 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-wow-accent via-wow-blue/50 to-wow-accent animate-shimmer" />
        </div>

        <p className="text-center text-xs text-gray-600">
          Waiting for {formatElapsed(elapsed)}
        </p>
      </div>
    )
  }

  // ── Running state ──
  return (
    <div className="py-6 space-y-5">
      <div className="text-center space-y-2">
        {simLabel && (
          <span className="inline-block text-xs font-medium text-[color:var(--class-color)]/80 bg-[color:var(--class-color)]/10 border border-[color:var(--class-color)]/20 px-2.5 py-0.5 rounded-full">
            {simLabel}
          </span>
        )}
        <h3 className="text-lg font-semibold text-gray-200">
          Simulating...
        </h3>
        <p className="text-sm text-gray-500 h-5 transition-opacity duration-500" key={flavorIdx}>
          {phaseLabel}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="w-full bg-wow-darker rounded-full h-3 overflow-hidden relative">
          {/* Track glow */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out blur-sm opacity-50 bg-[color:var(--class-color)]"
            style={{ width: `${Math.min(visualProgress, 100)}%` }}
          />
          {/* Main bar */}
          <div
            className={cn(
              'relative h-full rounded-full transition-all duration-1000 ease-out',
              'bg-gradient-to-r from-wow-gold/80 via-wow-gold to-yellow-400',
            )}
            style={{ width: `${Math.min(visualProgress, 100)}%` }}
          >
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Progress details row */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">
            {formatElapsed(elapsed)}
          </span>
          <span className="text-[color:var(--class-color)] font-bold text-sm tabular-nums">
            {Math.round(visualProgress)}%
          </span>
          <span className="text-gray-500 tabular-nums">
            {eta !== null ? formatEta(eta) : elapsed > 2 ? 'estimating...' : '—'}
          </span>
        </div>
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-3">
        <StepDot label="Queued" done />
        <StepLine done />
        <StepDot label="Running" active />
        <StepLine />
        <StepDot label="Complete" />
      </div>
    </div>
  )
}

// ── Sub-components ──

function StepDot({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'w-2.5 h-2.5 rounded-full border-2 transition-colors',
          done && 'bg-[color:var(--class-color)] border-[color:var(--class-color)]',
          active && 'border-[color:var(--class-color)] bg-[color:var(--class-color)]/30 animate-pulse',
          !done && !active && 'border-gray-600 bg-transparent',
        )}
      />
      <span
        className={cn(
          'text-[10px] font-medium',
          done && 'text-[color:var(--class-color)]/70',
          active && 'text-[color:var(--class-color)]',
          !done && !active && 'text-gray-600',
        )}
      >
        {label}
      </span>
    </div>
  )
}

function StepLine({ done }: { done?: boolean }) {
  return (
    <div
      className={cn(
        'w-10 h-0.5 rounded-full mb-4',
        done ? 'bg-[color:var(--class-color)]/50' : 'bg-gray-700',
      )}
    />
  )
}
