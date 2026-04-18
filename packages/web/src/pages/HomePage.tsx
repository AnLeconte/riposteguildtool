import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { cachedImg } from '@/lib/cached-image'

function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000)
  if (diff < 60) return "Mis \u00e0 jour \u00e0 l'instant"
  const minutes = Math.floor(diff / 60)
  if (minutes < 60) return `Mis \u00e0 jour il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Mis \u00e0 jour il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `Mis \u00e0 jour il y a ${days}j`
}

function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white/[0.04] animate-pulse rounded-xl p-4 ${className}`}>
      <div className="h-2.5 w-20 bg-white/[0.06] rounded mb-3" />
      <div className="h-5 w-16 bg-white/[0.06] rounded mb-2" />
      <div className="h-2 w-24 bg-white/[0.06] rounded" />
    </div>
  )
}

function SkeletonContentBlock() {
  return (
    <div className="space-y-2">
      <div className="h-2.5 w-28 bg-white/[0.06] rounded animate-pulse" />
      <div className="bg-white/[0.04] animate-pulse rounded-xl p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white/[0.06] rounded" />
              <div className="h-3 w-24 bg-white/[0.06] rounded" />
            </div>
            <div className="h-3 w-12 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

interface Affix { id: number; name: string; description: string; iconUrl: string; wowheadUrl: string }

interface MplusRun {
  dungeon: string
  iconUrl?: string
  level: number
  timed: boolean
  duration: number
  score: number
  affixes?: string[]
  url?: string
  completedAt?: string
}

interface GuildMember {
  name: string
  class: string
  realm: string
  score: number
  profileUrl: string
}

interface GuildReport {
  code: string
  title: string
  zone: string
  owner: string
  date: string
  url: string
}

interface DashboardData {
  token?: number
  rioScore?: number
  rioRankRealm?: number
  rioRankRegion?: number
  rioBestRuns?: MplusRun[]
  rioRecentRuns?: MplusRun[]
  weeklyMplusRuns?: number
  weeklyHighestKey?: number
  vaultSlots?: number
  guildName?: string
  guildRankings?: any
  guildTopMembers?: GuildMember[]
  guildReports?: GuildReport[]
  dungeonPool?: Array<{ id: number; name: string }>
  wclParses?: any
}

const CLASS_COLORS: Record<string, string> = {
  'Death Knight': 'text-[#C41E3A]', 'Demon Hunter': 'text-[#A330C9]', 'Druid': 'text-[#FF7C0A]',
  'Evoker': 'text-[#33937F]', 'Hunter': 'text-[#AAD372]', 'Mage': 'text-[#3FC7EB]',
  'Monk': 'text-[#00FF98]', 'Paladin': 'text-[#F48CBA]', 'Priest': 'text-[#FFFFFF]',
  'Rogue': 'text-[#FFF468]', 'Shaman': 'text-[#0070DD]', 'Warlock': 'text-[#8788EE]',
  'Warrior': 'text-[#C69B6D]',
}

const CLASS_COLORS_HEX: Record<string, string> = {
  'Death Knight': '#C41E3A', 'Demon Hunter': '#A330C9', 'Druid': '#FF7C0A',
  'Evoker': '#33937F', 'Hunter': '#AAD372', 'Mage': '#3FC7EB',
  'Monk': '#00FF98', 'Paladin': '#F48CBA', 'Priest': '#FFFFFF',
  'Rogue': '#FFF468', 'Shaman': '#0070DD', 'Warlock': '#8788EE',
  'Warrior': '#C69B6D',
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function parsePercentile(val: number) {
  if (val >= 95) return 'text-[#E268A8]' // pink (legendary)
  if (val >= 75) return 'text-[#FF8000]' // orange
  if (val >= 50) return 'text-[#A335EE]' // purple
  if (val >= 25) return 'text-[#0070DD]' // blue
  return 'text-[#1EFF00]' // green
}

function useResetCountdown() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  return useMemo(() => {
    const d = new Date(now)
    const resetHour = 7
    const dayOfWeek = d.getUTCDay()
    const hour = d.getUTCHours()

    let daysUntil = (3 - dayOfWeek + 7) % 7
    if (daysUntil === 0 && hour >= resetHour) daysUntil = 7

    const nextReset = new Date(d)
    nextReset.setUTCDate(d.getUTCDate() + daysUntil)
    nextReset.setUTCHours(resetHour, 0, 0, 0)

    const diff = nextReset.getTime() - now
    const days = Math.floor(diff / 86_400_000)
    const hours = Math.floor((diff % 86_400_000) / 3_600_000)
    const minutes = Math.floor((diff % 3_600_000) / 60_000)

    return { days, hours, minutes, label: `${days}j ${hours}h ${minutes}m` }
  }, [now])
}

export function HomePage() {
  const [affixes, setAffixes] = useState<Affix[]>([])
  const [news, setNews] = useState<Array<{ title: string; link: string; description: string; category: string; date: string; image?: string }>>([])
  const [dashboard, setDashboard] = useState<DashboardData>({})
  const [loading, setLoading] = useState(true)
  const [lastFetched, setLastFetched] = useState<number | null>(null)
  const [, setTick] = useState(0)
  const [discordMsg, setDiscordMsg] = useState<string | null>(null)
  const [ilvlHistory, setIlvlHistory] = useState<Array<{ ilvl: number; recorded_at: string }>>([])
  const active = useCharacterStore((s) => s.getActive())
  const reset = useResetCountdown()

  // Re-render every 30s to keep relative time label fresh
  useEffect(() => {
    if (!lastFetched) return
    const t = setInterval(() => setTick((v) => v + 1), 30_000)
    return () => clearInterval(t)
  }, [lastFetched])

  // Handle Discord link callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linked = params.get('discord_linked')
    const error = params.get('discord_error')
    if (linked) {
      setDiscordMsg(`Discord linked: ${linked}`)
      // Update auth store
      const u = useAuthStore.getState().user
      if (u) useAuthStore.getState().setAuth({ ...u, discord_id: 'linked' }, useAuthStore.getState().token!)
      window.history.replaceState({}, '', '/')
    } else if (error) {
      setDiscordMsg(`Discord link failed: ${error}`)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  useEffect(() => {
    api.getAffixes().then((d) => setAffixes(d.affixes)).catch(() => {})
  }, [])

  const fetchDashboard = useCallback(() => {
    setLoading(true)
    const params: any = { region: active?.region ?? 'eu' }
    if (active) {
      params.realm = active.realm
      params.name = active.name
    }
    api.getDashboard(params)
      .then((d) => {
        setDashboard(d)
        setLastFetched(Date.now())
      })
      .catch((e) => console.error('[Dashboard error]', e))
      .finally(() => setLoading(false))
  }, [active?.realm, active?.name, active?.region])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Fetch ilvl history for active character
  useEffect(() => {
    if (!active?.realm || !active?.name) {
      setIlvlHistory([])
      return
    }
    api.getIlvlHistory(active.realm, active.name, active.region ?? 'eu')
      .then(setIlvlHistory)
      .catch(() => setIlvlHistory([]))
  }, [active?.realm, active?.name, active?.region])

  // Prepare ilvl chart data (last 30 days)
  const ilvlChartData = useMemo(() => {
    if (!ilvlHistory.length) return []
    const thirtyDaysAgo = Date.now() - 30 * 86_400_000
    return ilvlHistory
      .filter((d) => new Date(d.recorded_at).getTime() >= thirtyDaysAgo)
      .map((d) => ({
        date: new Date(d.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        ilvl: d.ilvl,
      }))
  }, [ilvlHistory])

  const classColor = active?.class ? CLASS_COLORS_HEX[active.class] ?? '#888' : '#888'

  const vaultThresholds = [1, 4, 8]
  const vaultProgress = dashboard.weeklyMplusRuns ?? 0

  // Parse WCL zone rankings
  const wclEncounters = useMemo(() => {
    if (!dashboard.wclParses?.rankings) return []
    return (dashboard.wclParses.rankings as any[])
      .filter((r: any) => r.rankPercent != null)
      .map((r: any) => ({
        encounter: r.encounter?.name ?? 'Unknown',
        percentile: Math.round(r.rankPercent ?? 0),
        spec: r.spec,
        bestAmount: Math.round(r.bestAmount ?? 0),
      }))
  }, [dashboard.wclParses])

  return (
    <div className="w-full py-6 space-y-8">

      {/* ── Discord link toast ── */}
      {discordMsg && (
        <div className={`px-4 py-3 rounded-lg border text-sm ${discordMsg.includes('failed') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'}`}>
          {discordMsg}
          <button onClick={() => setDiscordMsg(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">&#10005;</button>
        </div>
      )}

      {/* ── Welcome + Character ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {active ? (
              <>Welcome back, <span className="text-[color:var(--class-color)]">{active.name}</span></>
            ) : (
              <>Riposte<span className="text-[color:var(--class-color)]">Guild</span><span className="text-gray-500 font-normal">Tool</span></>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {active ? `${active.spec} ${active.class} — ${active.ilvl} ilvl` : 'Your WoW toolkit'}
          </p>
        </div>
        {active?.avatarUrl && (
          <Link to="/character" className="relative">
            <div
              className="absolute inset-0 rounded-xl blur-lg opacity-40 -z-10 scale-150"
              style={{ background: 'radial-gradient(circle, var(--class-color) 0%, transparent 70%)' }}
            />
            <img src={cachedImg(active.avatarUrl)} alt="" className="w-12 h-12 rounded-xl border-2 border-white/[0.1] hover:border-[color:var(--class-color)]/40 transition-colors" />
          </Link>
        )}
      </div>

      {/* ── Affixes ── */}
      {affixes.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">This Week's Affixes</p>
          <div className="flex gap-2 flex-wrap">
            {affixes.map((affix) => (
              <a key={affix.id} href={affix.wowheadUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-wow-panel/40 hover:border-[color:var(--class-color)]/20 transition-all group">
                <img src={cachedImg(affix.iconUrl)} alt="" className="w-5 h-5 rounded" loading="lazy" />
                <span className="text-[11px] font-medium text-gray-300 group-hover:text-[color:var(--class-color)] transition-colors">{affix.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Stats Row ── */}
      {loading ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <SkeletonContentBlock />
          <SkeletonContentBlock />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
            <Card className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Weekly Reset</p>
              <p className="text-lg font-bold text-white">{reset.label}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Mercredi 08:00 CET</p>
            </Card>

            {active && (
              <Card className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Score M+</p>
                <p className="text-lg font-bold text-[color:var(--class-color)]">{dashboard.rioScore ? dashboard.rioScore.toFixed(0) : '—'}</p>
                {dashboard.rioRankRealm != null && dashboard.rioRankRealm > 0 && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    #{dashboard.rioRankRealm} realm · #{dashboard.rioRankRegion} region
                  </p>
                )}
              </Card>
            )}

            {active && (
              <Card className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Great Vault</p>
                <div className="flex items-center gap-2 mt-1">
                  {vaultThresholds.map((threshold, idx) => {
                    const filled = vaultProgress >= threshold
                    return (
                      <div key={threshold} className="flex-1">
                        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[color:var(--class-color)] transition-all duration-700 ease-out"
                            style={{
                              width: filled ? '100%' : '0%',
                              transitionDelay: `${idx * 200}ms`,
                            }}
                          />
                        </div>
                        <p className={`text-[9px] mt-1 text-center ${filled ? 'text-[color:var(--class-color)]' : 'text-gray-600'}`}>
                          {threshold}/{threshold}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  {vaultProgress} run{vaultProgress !== 1 ? 's' : ''} cette semaine
                  {dashboard.weeklyHighestKey ? ` · +${dashboard.weeklyHighestKey} max` : ''}
                </p>
              </Card>
            )}

            <Card className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">WoW Token</p>
              <p className="text-lg font-bold text-white">
                {dashboard.token ? `${dashboard.token.toLocaleString()}g` : '—'}
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">EU</p>
            </Card>
          </div>

          {/* ── Last Sync Indicator ── */}
          {lastFetched && (
            <div className="flex items-center gap-2 -mt-4">
              <p className="text-[10px] text-gray-600">{formatRelativeTime(lastFetched)}</p>
              <button
                onClick={fetchDashboard}
                disabled={loading}
                className="text-gray-600 hover:text-[color:var(--class-color)] transition-colors disabled:opacity-40"
                title="Rafra\u00eechir"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.84v1.836a.75.75 0 0 1-1.5 0v-3.182a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.681.75.75 0 0 1 1.025-.274Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          {/* ── Ilvl Progression Chart ── */}
          {active && ilvlChartData.length > 1 && (
            <Card className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Progression ilvl</p>
              <div style={{ width: '100%', height: 120 }}>
                <ResponsiveContainer>
                  <AreaChart data={ilvlChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="ilvlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={classColor} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={classColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: '#555' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={['dataMin - 2', 'dataMax + 2']}
                      tick={{ fontSize: 9, fill: '#555' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: '#888' }}
                      formatter={(value: number) => [`${value.toFixed(1)} ilvl`, '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="ilvl"
                      stroke={classColor}
                      strokeWidth={2}
                      fill="url(#ilvlGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Best M+ Runs (Season) ── */}
      {dashboard.rioBestRuns && dashboard.rioBestRuns.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Best M+ Runs</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 stagger-children">
            {dashboard.rioBestRuns.slice(0, 8).map((run, i) => (
              <a key={i} href={run.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/[0.06] bg-wow-panel/40 hover:border-[color:var(--class-color)]/20 transition-all group">
                <div className="flex items-center gap-2 min-w-0">
                  {run.iconUrl && (
                    <img src={run.iconUrl} alt="" className="w-6 h-6 rounded border border-white/[0.1] flex-shrink-0" />
                  )}
                  <span className={`text-sm font-bold ${run.timed ? 'text-[color:var(--class-color)]' : 'text-gray-500'}`}>+{run.level}</span>
                  <span className="text-xs text-gray-300 group-hover:text-[color:var(--class-color)] transition-colors truncate">{run.dungeon}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-gray-500">{formatDuration(run.duration)}</span>
                  {run.timed && <span className="text-[10px] text-green-400">timed</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Runs ── */}
      {dashboard.rioRecentRuns && dashboard.rioRecentRuns.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Recent Runs</p>
          <Card className="divide-y divide-white/[0.04]">
            {dashboard.rioRecentRuns.slice(0, 5).map((run, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  {run.iconUrl && (
                    <img src={run.iconUrl} alt="" className="w-5 h-5 rounded border border-white/[0.1] flex-shrink-0" />
                  )}
                  <span className={`text-sm font-bold ${run.timed ? 'text-[color:var(--class-color)]' : 'text-gray-500'}`}>+{run.level}</span>
                  <span className="text-xs text-gray-300">{run.dungeon}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500">{formatDuration(run.duration)}</span>
                  {run.timed
                    ? <span className="text-[10px] text-green-400 font-medium">timed</span>
                    : <span className="text-[10px] text-red-400/70 font-medium">depleted</span>
                  }
                  {run.completedAt && (
                    <span className="text-[10px] text-gray-600">
                      {new Date(run.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── WCL Best Parses ── */}
      {wclEncounters.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Best Parses</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {wclEncounters.map((e, i) => (
              <Card key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-gray-200">{e.encounter}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{e.spec} · {e.bestAmount.toLocaleString()} DPS</p>
                </div>
                <span className={`text-lg font-bold ${parsePercentile(e.percentile)}`}>
                  {e.percentile}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Guild Progression ── */}
      {dashboard.guildRankings && dashboard.guildName && Object.keys(dashboard.guildRankings).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">
            {dashboard.guildName} — Raid Progression
          </p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(dashboard.guildRankings as Record<string, any>).map(([key, ranks]: [string, any]) => {
              const diffColor = key.includes('mythic') ? 'text-purple-400'
                : key.includes('heroic') ? 'text-orange-400'
                : 'text-green-400'
              const label = key.replace(/^tier-\w+-\d+\s*/, '').replace(/^(\w)/, (c: string) => c.toUpperCase()) || key
              return (
                <Card key={key} className="px-3 py-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
                  <div className="flex gap-3 text-xs">
                    <span className={`${diffColor} font-medium`}>
                      #{ranks.world} world
                    </span>
                    <span className="text-gray-500">
                      #{ranks.realm} realm
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Guild Top M+ ── */}
      {dashboard.guildTopMembers && dashboard.guildTopMembers.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">
            {dashboard.guildName ?? 'Guild'} — Top M+
          </p>
          <Card className="divide-y divide-white/[0.04]">
            {dashboard.guildTopMembers.map((m, i) => (
              <a key={i} href={m.profileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 w-4">{i + 1}</span>
                  <span className={`text-xs font-medium ${CLASS_COLORS[m.class] ?? 'text-gray-300'}`}>{m.name}</span>
                </div>
                <span className="text-xs font-bold text-[color:var(--class-color)]">{m.score.toFixed(0)}</span>
              </a>
            ))}
          </Card>
        </div>
      )}

      {/* ── Guild WCL Reports ── */}
      {dashboard.guildReports && dashboard.guildReports.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">
            Latest Raid Logs
          </p>
          <div className="flex gap-2 flex-wrap">
            {dashboard.guildReports.map((r) => (
              <a key={r.code} href={r.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 min-w-[200px] px-4 py-3 rounded-lg border border-white/[0.06] bg-wow-panel/40 hover:border-[color:var(--class-color)]/20 transition-all group">
                <p className="text-xs font-medium text-gray-200 group-hover:text-[color:var(--class-color)] transition-colors truncate">{r.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  {r.zone && <span className="text-[10px] text-gray-500">{r.zone}</span>}
                  {r.owner && <span className="text-[10px] text-gray-600">by {r.owner}</span>}
                  {r.date && (
                    <span className="text-[10px] text-gray-600">
                      {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Affixes moved to top */}

      {/* News removed */}

      {/* ── No character hint ── */}
      {!active && (
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[color:var(--class-color)]/10 border border-[color:var(--class-color)]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">{'\uD83D\uDC64'}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-200">Add your character</p>
              <p className="text-xs text-gray-500">Search your character in the <Link to="/character" className="text-[color:var(--class-color)] hover:underline">Character</Link> page and save it to personalize your dashboard.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
