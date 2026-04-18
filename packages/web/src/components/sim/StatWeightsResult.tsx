import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { StatWeightsResult } from '@wow-simc/shared'

interface StatWeightsResultProps {
  result: StatWeightsResult
}

/** Display label overrides for known SimC stat keys */
const STAT_LABELS: Record<string, string> = {
  Agility: 'Agility',
  Strength: 'Strength',
  Intellect: 'Intellect',
  CritRating: 'Crit',
  HasteRating: 'Haste',
  MasteryRating: 'Mastery',
  Versatility: 'Versatility',
  // SimC lowercase variants
  agility: 'Agility',
  strength: 'Strength',
  intellect: 'Intellect',
  crit_rating: 'Crit',
  haste_rating: 'Haste',
  mastery_rating: 'Mastery',
  versatility_rating: 'Versatility',
}

/** WoW-themed bar colours per stat */
const STAT_COLORS: Record<string, string> = {
  Agility: '#ABD473',     // hunter green
  Strength: '#C79C6E',    // warrior tan
  Intellect: '#69CCF0',   // mage blue
  CritRating: '#FF7D0A',  // orange
  HasteRating: '#FFD100', // wow-gold
  MasteryRating: '#9482C9', // purple
  Versatility: '#33937F', // evoker teal
  crit_rating: '#FF7D0A',
  haste_rating: '#FFD100',
  mastery_rating: '#9482C9',
  versatility_rating: '#33937F',
  agility: '#ABD473',
  strength: '#C79C6E',
  intellect: '#69CCF0',
}

const DEFAULT_COLOR = '#4a9eff'

function getLabel(key: string): string {
  return STAT_LABELS[key] ?? key
}

function getColor(key: string): string {
  return STAT_COLORS[key] ?? DEFAULT_COLOR
}

export function StatWeightsResultDisplay({ result }: StatWeightsResultProps) {
  const [copied, setCopied] = useState(false)

  const chartData = Object.entries(result.scale_factors)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({
      key,
      label: getLabel(key),
      value,
      color: getColor(key),
    }))

  const handleCopy = () => {
    navigator.clipboard.writeText(result.pawn_string).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      {/* Base DPS */}
      <div className="text-center space-y-1">
        <p className="text-gray-400 text-sm">Base DPS</p>
        <p className="text-4xl font-bold text-[color:var(--class-color)]">
          {Math.round(result.dps.mean).toLocaleString()}
        </p>
      </div>

      {/* Bar chart */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Scale Factors</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#0f3460' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#0f3460' }}
              tickLine={false}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#16213e',
                border: '1px solid #0f3460',
                borderRadius: '6px',
                color: '#e5e7eb',
              }}
              labelStyle={{ color: '#FFD100' }}
              formatter={(value: number) => [value.toFixed(4), 'Weight']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scale factors table */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">Exact Values</h3>
        <div className="rounded-md border border-wow-accent/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-wow-darker border-b border-wow-accent/30">
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Stat</th>
                <th className="text-right px-4 py-2 text-gray-400 font-medium">Weight</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-wow-accent/10 hover:bg-wow-accent/10 transition-colors"
                >
                  <td className="px-4 py-2.5 text-gray-200">{row.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-200">
                    {row.value.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pawn string */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-400">Pawn String</h3>
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-1 rounded bg-wow-accent hover:bg-wow-accent/80 text-gray-200 transition-colors border border-wow-accent/50"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <code className="block w-full rounded-md bg-wow-darker border border-wow-accent/30 px-4 py-3 text-xs text-wow-blue font-mono break-all whitespace-pre-wrap">
          {result.pawn_string}
        </code>
      </div>
    </div>
  )
}
