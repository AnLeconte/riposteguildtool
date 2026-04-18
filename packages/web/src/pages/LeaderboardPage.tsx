import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useClassIcons } from '@/hooks/useClassIcons'

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569',
  Priest: '#FFFFFF', 'Death Knight': '#C41F3B', Shaman: '#0070DE', Mage: '#69CCF0',
  Warlock: '#9482C9', Monk: '#00FF96', Druid: '#FF7D0A', 'Demon Hunter': '#A330C9',
  Evoker: '#33937F',
}

type LeaderboardTab = 'mythic-plus' | 'raid'

interface MplusMember {
  name: string; realm: string; class: string; classId: number
  rank: number; level: number; totalRuns: number; highestKey: number
  runs: Array<{ dungeon: string; level: number; timed: boolean; duration: number }>
}

interface PerfMember {
  name: string; class: string; spec: string
  avgDps: number; avgHps: number; fights: number
}

export function LeaderboardPage() {
  const active = useCharacterStore((s) => s.getActive())
  const { getClassIcon } = useClassIcons()

  const realm = active?.guildRealm ?? active?.realm ?? ''
  const guild = active?.guild ?? ''
  const region = active?.region ?? 'eu'

  const [tab, setTab] = useState<LeaderboardTab>('mythic-plus')
  const [mplusData, setMplusData] = useState<MplusMember[] | null>(null)
  const [mplusLoading, setMplusLoading] = useState(false)
  const [perfData, setPerfData] = useState<{ performance: PerfMember[]; reportsAnalyzed: number } | null>(null)
  const [perfLoading, setPerfLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMplus = async () => {
    if (!realm || !guild) return
    setMplusLoading(true)
    setError(null)
    try {
      const data = await api.getGuildMythicPlus(realm, guild, region)
      setMplusData(data.results ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load M+ data')
    } finally { setMplusLoading(false) }
  }

  const loadPerf = async () => {
    if (!realm || !guild) return
    setPerfLoading(true)
    setError(null)
    try {
      setPerfData(await api.getGuildPerformance(realm, guild, region))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load raid parses')
    } finally { setPerfLoading(false) }
  }

  // Auto-load on mount
  useEffect(() => {
    if (realm && guild) loadMplus()
  }, [realm, guild]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (t: LeaderboardTab) => {
    setTab(t)
    if (t === 'mythic-plus' && !mplusData) loadMplus()
    if (t === 'raid' && !perfData) loadPerf()
  }

  // M+ leaderboard sorted by highest key desc, then total runs desc
  const mplusRanked = useMemo(() =>
    [...(mplusData ?? [])].filter(m => m.totalRuns > 0)
      .sort((a, b) => b.highestKey - a.highestKey || b.totalRuns - a.totalRuns),
    [mplusData])

  // Raid DPS leaderboard sorted by avgDps desc
  const raidDpsRanked = useMemo(() =>
    [...(perfData?.performance ?? [])].filter(m => m.avgDps > 0)
      .sort((a, b) => b.avgDps - a.avgDps),
    [perfData])

  // Raid HPS leaderboard sorted by avgHps desc
  const raidHpsRanked = useMemo(() =>
    [...(perfData?.performance ?? [])].filter(m => m.avgHps > 0)
      .sort((a, b) => b.avgHps - a.avgHps),
    [perfData])

  const loading = mplusLoading || perfLoading

  if (!guild) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-500">Select a character with a guild to view the leaderboard</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex gap-1 bg-wow-darker/60 rounded-lg p-1">
        {([
          { id: 'mythic-plus' as const, label: 'M+ Ranking' },
          { id: 'raid' as const, label: 'Raid Parses' },
        ]).map((t) => (
          <button key={t.id} onClick={() => handleTabChange(t.id)}
            className={cn('flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all whitespace-nowrap',
              tab === t.id
                ? 'bg-[color:var(--class-color)]/10 text-[color:var(--class-color)] border border-[color:var(--class-color)]/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent')}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs px-1">{error}</p>}

      {loading && (
        <Card>
          <div className="text-center py-12 space-y-2">
            <div className="w-6 h-6 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 text-sm">Loading leaderboard...</p>
          </div>
        </Card>
      )}

      {/* ═══ M+ RANKING ═══ */}
      {tab === 'mythic-plus' && mplusData && !mplusLoading && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{mplusRanked.length} active members</p>
              <div className="flex gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-[color:var(--class-color)]">
                    {mplusRanked.length > 0 ? `+${mplusRanked[0].highestKey}` : '--'}
                  </p>
                  <p className="text-[10px] text-gray-600">Highest Key</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-center px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600 w-12">#</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Player</th>
                  <th className="text-center px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Highest Key</th>
                  <th className="text-center px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Total Runs</th>
                  <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Realm</th>
                </tr>
              </thead>
              <tbody>
                {mplusRanked.map((m, i) => (
                  <tr key={m.name + m.realm} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('text-xs font-bold tabular-nums',
                        i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600')}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {getClassIcon(m.class) ? (
                          <img src={getClassIcon(m.class)} alt="" className="w-5 h-5 rounded border border-white/[0.1] flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: CLASS_COLORS[m.class] ?? '#888' }} />
                        )}
                        <span className="font-medium" style={{ color: CLASS_COLORS[m.class] ?? '#ccc' }}>{m.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-sm font-bold text-[color:var(--class-color)] tabular-nums">+{m.highestKey}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400 tabular-nums">{m.totalRuns}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{m.realm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mplusRanked.length === 0 && (
              <p className="text-gray-600 text-xs text-center py-8">No M+ data available</p>
            )}
          </Card>
        </div>
      )}

      {/* ═══ RAID PARSES ═══ */}
      {tab === 'raid' && perfData && !perfLoading && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs text-gray-500">{perfData.reportsAnalyzed} reports analyzed</p>
          </Card>

          {/* DPS Rankings */}
          {raidDpsRanked.length > 0 && (
            <Card className="p-0 overflow-hidden overflow-x-auto">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-gray-300">Top DPS</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 w-12">#</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Player</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Spec</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Avg DPS</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Fights</th>
                  </tr>
                </thead>
                <tbody>
                  {raidDpsRanked.map((m, i) => (
                    <tr key={m.name} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn('text-xs font-bold tabular-nums',
                          i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600')}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {getClassIcon(m.class) ? (
                            <img src={getClassIcon(m.class)} alt="" className="w-5 h-5 rounded border border-white/[0.1] flex-shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: CLASS_COLORS[m.class] ?? '#888' }} />
                          )}
                          <span className="font-medium" style={{ color: CLASS_COLORS[m.class] ?? '#ccc' }}>{m.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-400">{m.spec}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-[color:var(--class-color)] tabular-nums">
                        {m.avgDps.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-500 tabular-nums">{m.fights}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* HPS Rankings */}
          {raidHpsRanked.length > 0 && (
            <Card className="p-0 overflow-hidden overflow-x-auto">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-gray-300">Top HPS</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 w-12">#</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Player</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Spec</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Avg HPS</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Fights</th>
                  </tr>
                </thead>
                <tbody>
                  {raidHpsRanked.map((m, i) => (
                    <tr key={m.name} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn('text-xs font-bold tabular-nums',
                          i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600')}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {getClassIcon(m.class) ? (
                            <img src={getClassIcon(m.class)} alt="" className="w-5 h-5 rounded border border-white/[0.1] flex-shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: CLASS_COLORS[m.class] ?? '#888' }} />
                          )}
                          <span className="font-medium" style={{ color: CLASS_COLORS[m.class] ?? '#ccc' }}>{m.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-400">{m.spec}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-green-400 tabular-nums">
                        {m.avgHps.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-500 tabular-nums">{m.fights}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {raidDpsRanked.length === 0 && raidHpsRanked.length === 0 && (
            <Card className="p-6 text-center">
              <p className="text-gray-500">No raid parse data available</p>
              <p className="text-gray-600 text-xs mt-1">Performance data comes from Warcraft Logs reports</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
