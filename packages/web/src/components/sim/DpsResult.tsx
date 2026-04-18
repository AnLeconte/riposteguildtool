interface DpsResultProps {
  mean: number
  min: number
  max: number
  median: number
}

export function DpsResult({ mean, min, max, median }: DpsResultProps) {
  const formatDps = (n: number) => Math.round(n).toLocaleString()

  return (
    <div className="text-center py-4 space-y-6">
      {/* Main DPS */}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-500">
          Average DPS
        </p>
        <p className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-wow-gold to-amber-500 bg-clip-text text-transparent">
          {formatDps(mean)}
        </p>
      </div>

      {/* Stats row */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-0 rounded-xl bg-wow-darker/60 border border-white/[0.06] divide-x divide-white/[0.06]">
          <StatCell label="Min" value={formatDps(min)} />
          <StatCell label="Median" value={formatDps(median)} />
          <StatCell label="Max" value={formatDps(max)} />
        </div>
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-600 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-300 tabular-nums">{value}</p>
    </div>
  )
}
