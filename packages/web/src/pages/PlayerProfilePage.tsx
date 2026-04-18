import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { api } from '@/lib/api'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { cachedImg } from '@/lib/cached-image'

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569',
  Priest: '#FFFFFF', 'Death Knight': '#C41F3B', Shaman: '#0070DE', Mage: '#69CCF0',
  Warlock: '#9482C9', Monk: '#00FF96', Druid: '#FF7D0A', 'Demon Hunter': '#A330C9',
  Evoker: '#33937F',
}

function getParseColor(percentile: number): string {
  if (percentile === 100) return 'text-[#e5cc80]'     // gold
  if (percentile >= 99) return 'text-[#ff8000]'       // orange
  if (percentile >= 95) return 'text-[#a335ee]'       // purple
  if (percentile >= 75) return 'text-[#0070dd]'       // blue
  if (percentile >= 50) return 'text-[#1eff00]'       // green
  if (percentile >= 25) return 'text-gray-400'        // grey
  return 'text-gray-500'
}

function getParseBarColor(percentile: number): string {
  if (percentile === 100) return 'bg-[#e5cc80]'
  if (percentile >= 99) return 'bg-[#ff8000]'
  if (percentile >= 95) return 'bg-[#a335ee]'
  if (percentile >= 75) return 'bg-[#0070dd]'
  if (percentile >= 50) return 'bg-[#1eff00]'
  if (percentile >= 25) return 'bg-gray-400'
  return 'bg-gray-600'
}

export function PlayerProfilePage() {
  const { name } = useParams<{ name: string }>()
  const active = useCharacterStore((s) => s.getActive())

  // Resolve character from URL param or active character
  const character = useMemo(() => {
    const chars = useCharacterStore.getState().characters
    if (name) {
      const found = chars.find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (found) return found
    }
    return active
  }, [name, active])

  const [profile, setProfile] = useState<any>(null)
  const [ilvlHistory, setIlvlHistory] = useState<Array<{ ilvl: number; recorded_at: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!character) {
      setLoading(false)
      setError('Character not found')
      return
    }
    setLoading(true)
    setError(null)

    const fetchData = async () => {
      try {
        const [profileData, historyData] = await Promise.all([
          api.getCharacterProfile(character.realm, character.name, character.region),
          api.getIlvlHistory(character.realm, character.name, character.region).catch(() => []),
        ])
        setProfile(profileData)
        setIlvlHistory(historyData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load player profile')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [character?.name, character?.realm, character?.region])

  const classColor = profile ? CLASS_COLORS[profile.class] ?? '#888' : '#888'

  // Prepare ilvl chart data (last 90 days for the bigger view)
  const ilvlChartData = useMemo(() => {
    if (!ilvlHistory.length) return []
    const ninetyDaysAgo = Date.now() - 90 * 86_400_000
    return ilvlHistory
      .filter((d) => new Date(d.recorded_at).getTime() >= ninetyDaysAgo)
      .map((d) => ({
        date: new Date(d.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        ilvl: d.ilvl,
      }))
  }, [ilvlHistory])

  const wclParses: any[] = profile?.wclParses ?? []
  const bestRuns: any[] = profile?.mythicPlus?.bestRuns ?? profile?.raiderio?.bestRuns ?? []

  if (loading) return <LoadingState message="Loading player profile..." />
  if (error && !profile) return <EmptyState icon="&#128100;" title={error} />

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      {profile && (
        <Card className="p-0 overflow-hidden">
          <div className="relative h-48">
            {profile.renderUrl ? (
              <img src={cachedImg(profile.renderUrl)} alt="" className="absolute inset-0 w-full h-full object-cover object-top brightness-50" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-wow-accent/40 to-wow-panel" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-wow-panel via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 flex items-end gap-4">
              {profile.avatarUrl && (
                <img src={cachedImg(profile.avatarUrl)} alt="" className="w-20 h-20 rounded-xl border-2 border-white/[0.15] shadow-lg" />
              )}
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">{profile.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-semibold" style={{ color: classColor }}>
                    {profile.spec} {profile.class}
                  </span>
                  <span className="text-xs text-gray-400">{profile.realm} ({profile.region?.toUpperCase()})</span>
                </div>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold" style={{ color: classColor }}>{profile.equippedIlvl}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Item Level</p>
                </div>
                {(profile.raiderio?.score ?? profile.mythicPlus?.score ?? 0) > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-orange-400">{Math.round(profile.raiderio?.score ?? profile.mythicPlus?.score ?? 0)}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">M+ Score</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ilvl History Chart */}
      {ilvlChartData.length > 1 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Item Level Progression</h2>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={ilvlChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="playerIlvlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={classColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={classColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fontSize: 10, fill: '#555' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#888' }}
                  itemStyle={{ color: classColor }}
                />
                <Area
                  type="monotone"
                  dataKey="ilvl"
                  stroke={classColor}
                  strokeWidth={2}
                  fill="url(#playerIlvlGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* WCL Parses */}
      {wclParses.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-gray-300">Warcraft Logs Parses</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left px-5 py-2.5 text-[10px] uppercase tracking-wider text-gray-600 font-medium">Boss</th>
                  <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-600 font-medium">Difficulty</th>
                  <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-600 font-medium">Spec</th>
                  <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-wider text-gray-600 font-medium">DPS</th>
                  <th className="text-right px-5 py-2.5 text-[10px] uppercase tracking-wider text-gray-600 font-medium w-48">Percentile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {wclParses.map((parse: any, i: number) => {
                  const pct = Math.round(parse.percentile ?? parse.rankPercent ?? 0)
                  return (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-2.5 text-gray-300 font-medium">{parse.encounterName ?? parse.boss ?? 'Unknown'}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{parse.difficulty ?? '-'}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{parse.spec ?? profile?.spec ?? '-'}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-right tabular-nums">{parse.total ? Math.round(parse.total).toLocaleString() : '-'}</td>
                      <td className="px-5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getParseBarColor(pct)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold tabular-nums w-8 text-right ${getParseColor(pct)}`}>{pct}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* M+ Best Runs */}
      {bestRuns.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-gray-300">Mythic+ Best Runs</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.03]">
            {bestRuns.sort((a: any, b: any) => (b.score ?? b.level) - (a.score ?? a.level)).map((run: any, i: number) => (
              <div key={i} className="bg-wow-panel px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                {run.dungeonIcon && (
                  <img src={cachedImg(run.dungeonIcon)} alt="" className="w-9 h-9 rounded-lg border border-white/[0.08]" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 font-medium truncate">{run.dungeon}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-bold tabular-nums ${run.timed ? 'text-[color:var(--class-color)]' : 'text-gray-500'}`}>
                      +{run.level}
                    </span>
                    <span className={`text-[10px] font-medium ${run.timed ? 'text-green-400' : 'text-red-400/70'}`}>
                      {run.timed ? 'Timed' : 'Depleted'}
                    </span>
                  </div>
                </div>
                {run.score != null && (
                  <span className="text-[10px] text-orange-400/70 tabular-nums font-medium">{run.score.toFixed(1)}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Raid Attendance */}
      {profile?.attendance != null && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Raid Attendance</h2>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke={classColor}
                  strokeWidth="3"
                  strokeDasharray={`${(profile.attendance / 100) * 97.4} 97.4`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{Math.round(profile.attendance)}%</span>
              </div>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{Math.round(profile.attendance)}% Attendance</p>
              <p className="text-xs text-gray-500 mt-0.5">Based on tracked raid events</p>
            </div>
          </div>
        </Card>
      )}

      {/* Empty states */}
      {!profile && !loading && (
        <EmptyState icon="&#128100;" title="No player data available" />
      )}
    </div>
  )
}
