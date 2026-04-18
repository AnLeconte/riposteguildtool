import { useCallback, useEffect, useState, useMemo, lazy, Suspense } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useClassIcons } from '@/hooks/useClassIcons'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const LeaderboardPage = lazy(() => import('./LeaderboardPage').then(m => ({ default: m.LeaderboardPage })))

// ─── Boss Phase Presets ──────────────────────────────────────────────────────
const BOSS_PHASES: Record<string, Array<{ label: string; percent: number }>> = {
  // The Voidspire
  'Imperator Averzian': [{ label: 'P2', percent: 50 }],
  'Vorasius': [{ label: 'P2', percent: 60 }, { label: 'P3', percent: 30 }],
  'Fallen-King Salhadaar': [{ label: 'P2', percent: 50 }],
  'Vaelgor & Ezzorak': [{ label: 'P2', percent: 50 }],
  'Lightblinded Vanguard': [{ label: 'P2', percent: 40 }],
  'Crown of the Cosmos': [{ label: 'P2', percent: 60 }, { label: 'P3', percent: 25 }],
  // March on Quel'Danas
  "Belo'ren, Child of Al'ar": [{ label: 'P2', percent: 50 }],
  'Midnight Falls': [{ label: 'P2', percent: 50 }],
  // The Dreamrift
  'Chimaerus the Undreamt God': [{ label: 'P2', percent: 50 }],
}

function parsePhaseString(str: string): Array<{ label: string; percent: number }> {
  // Format: "P2:60,P3:30" or "60,30"
  return str.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const parts = s.split(':')
    if (parts.length === 2) return { label: parts[0].trim(), percent: parseInt(parts[1]) }
    const num = parseInt(s)
    return isNaN(num) ? null : { label: `P${num > 50 ? '2' : '3'}`, percent: num }
  }).filter((p): p is { label: string; percent: number } => p !== null && !isNaN(p.percent))
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MythicRun { dungeon: string; level: number; timed: boolean; duration: number }
interface MplusMember { name: string; realm: string; class: string; classId: number; rank: number; level: number; runs: MythicRun[]; totalRuns: number; highestKey: number }
interface MplusData { guild: string; realm: string; region: string; memberCount: number; results: MplusMember[] }
interface RosterMember { name: string; realm: string; realmName: string; level: number; class: string; classId: number; rank: number; rankLabel: string }
interface RosterData { guild: string; realm: string; region: string; memberCount: number; members: RosterMember[] }
interface ProgressData { guild: string; server: string; region: string; ranking: { worldRank: number | null; regionRank: number | null; serverRank: number | null } }

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569',
  Priest: '#FFFFFF', 'Death Knight': '#C41F3B', Shaman: '#0070DE', Mage: '#69CCF0',
  Warlock: '#9482C9', Monk: '#00FF96', Druid: '#FF7D0A', 'Demon Hunter': '#A330C9',
  Evoker: '#33937F',
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

type Tab = 'roster' | 'mythic-plus' | 'progression' | 'audit' | 'attendance' | 'performance' | 'timeline' | 'leaderboard'

export function GuildHubPage() {
  const active = useCharacterStore((s) => s.getActive())
  const updateCharacter = useCharacterStore((s) => s.updateCharacter)
  const { getClassIcon } = useClassIcons()

  // Guild search fields — pre-filled from active character's guild
  const [realm, setRealm] = useState(active?.guildRealm ?? active?.realm ?? '')
  const [guild, setGuild] = useState(active?.guild ?? '')
  const [region, setRegion] = useState(active?.region ?? 'eu')
  const [tab, setTab] = useState<Tab>('roster')

  const [rosterData, setRosterData] = useState<RosterData | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [mplusData, setMplusData] = useState<MplusData | null>(null)
  const [mplusLoading, setMplusLoading] = useState(false)
  const [progData, setProgData] = useState<ProgressData | null>(null)
  const [progLoading, setProgLoading] = useState(false)
  const [auditData, setAuditData] = useState<any>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [perfData, setPerfData] = useState<any>(null)
  const [perfLoading, setPerfLoading] = useState(false)
  const [timelineData, setTimelineData] = useState<any[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineZone, setTimelineZone] = useState<string | null>(null)
  const [selectedBoss, setSelectedBoss] = useState<string | null>(null)
  const [bossPulls, setBossPulls] = useState<Array<{ pull: number; percent: number; kill: boolean; duration: number }>>([])
  const [bossPullsLoading, setBossPullsLoading] = useState(false)
  const [customPhases, setCustomPhases] = useState<Record<string, string>>({}) // boss -> "P2:60,P3:30"
  const [editingPhases, setEditingPhases] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [classFilter, setClassFilter] = useState<string | null>(null)
  const [searchName, setSearchName] = useState('')
  const [autoLoaded, setAutoLoaded] = useState(false)

  // Auto-detect guild from Raider.io if character has no guild saved
  useEffect(() => {
    if (!active || autoLoaded) return
    if (active.guild) {
      setGuild(active.guild)
      setRealm(active.guildRealm ?? active.realm)
      setRegion(active.region)
      return
    }

    // Try to detect guild from character profile
    api.getCharacterProfile(active.realm, active.name, active.region)
      .then((profile: any) => {
        if (profile?.raiderio?.guild) {
          // Raider.io doesn't have guild directly on profile, try from dashboard
        }
      })
      .catch(() => {})

    // Detect from dashboard data
    api.getDashboard({ realm: active.realm, name: active.name, region: active.region })
      .then((data: any) => {
        if (data.guildName) {
          setGuild(data.guildName)
          setRealm(active.realm)
          if (active.id) {
            updateCharacter(active.id, { guild: data.guildName, guildRealm: active.realm })
          }
        }
      })
      .catch(() => {})
      .finally(() => setAutoLoaded(true))
  }, [active?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load roster when guild is set
  useEffect(() => {
    if (guild && realm && !rosterData && !rosterLoading && autoLoaded) {
      loadTab('roster')
    }
  }, [guild, realm, autoLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadTab = async (t: Tab) => {
    if (!realm.trim() || !guild.trim()) { setError('Enter realm and guild name'); return }
    setError(null)

    if (t === 'roster') {
      setRosterLoading(true)
      try {
        setRosterData(await api.getGuildRoster(realm.trim(), guild.trim(), region))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load roster')
      } finally { setRosterLoading(false) }
    } else if (t === 'mythic-plus') {
      setMplusLoading(true)
      try {
        setMplusData(await api.getGuildMythicPlus(realm.trim(), guild.trim(), region))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load M+ data')
      } finally { setMplusLoading(false) }
    } else if (t === 'progression') {
      setProgLoading(true)
      try {
        setProgData(await api.getGuildProgression(realm.trim(), guild.trim(), region))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load progression')
      } finally { setProgLoading(false) }
    } else if (t === 'audit') {
      setAuditLoading(true)
      try {
        setAuditData(await api.getGuildAudit(realm.trim(), guild.trim(), region))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load gear audit')
      } finally { setAuditLoading(false) }
    } else if (t === 'attendance') {
      setAttendanceLoading(true)
      try {
        setAttendanceData(await api.getGuildAttendance(realm.trim(), guild.trim(), region))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load attendance')
      } finally { setAttendanceLoading(false) }
    } else if (t === 'performance') {
      setPerfLoading(true)
      try {
        setPerfData(await api.getGuildPerformance(realm.trim(), guild.trim(), region))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load performance')
      } finally { setPerfLoading(false) }
    } else if (t === 'timeline') {
      setTimelineLoading(true)
      try {
        setTimelineData(await api.getGuildTimeline(realm.trim(), guild.trim(), region))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load timeline')
      } finally { setTimelineLoading(false) }
    }
  }

  const handleTabChange = (t: Tab) => {
    setTab(t)
    // Auto-load tab data if guild is set and not already loaded
    const dataMap: Record<Tab, any> = { roster: rosterData, 'mythic-plus': mplusData, progression: progData, audit: auditData, attendance: attendanceData, performance: perfData, timeline: timelineData, leaderboard: true }
    const hasData = dataMap[t]
    if (!hasData && guild && realm) loadTab(t)
  }

  const loadBossPulls = useCallback(async (bossName: string) => {
    if (!realm || !guild) return
    if (selectedBoss === bossName) { setSelectedBoss(null); return }
    setSelectedBoss(bossName)
    setBossPullsLoading(true)
    try {
      const data = await api.getGuildBossPulls(realm.trim(), guild.trim(), bossName, region)
      setBossPulls(data.pulls)
    } catch { setBossPulls([]) }
    finally { setBossPullsLoading(false) }
  }, [realm, guild, region, selectedBoss])

  const loading = rosterLoading || mplusLoading || progLoading || auditLoading || attendanceLoading || perfLoading || timelineLoading
  const guildName = rosterData?.guild ?? mplusData?.guild ?? guild

  const filteredRoster = useMemo(() =>
    (rosterData?.members ?? []).filter((m) => {
      if (classFilter && m.class !== classFilter) return false
      if (searchName && !m.name.toLowerCase().includes(searchName.toLowerCase())) return false
      return true
    }), [rosterData, classFilter, searchName])

  const rosterClasses = useMemo(() =>
    [...new Set((rosterData?.members ?? []).map((m) => m.class))].sort(),
    [rosterData])

  const mplusWithRuns = mplusData?.results.filter((m) => m.totalRuns > 0) ?? []
  const mplusWithout = mplusData?.results.filter((m) => m.totalRuns === 0) ?? []

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {guildName ? (
            <><span className="text-[color:var(--class-color)]">&lt;{guildName}&gt;</span></>
          ) : (
            <>Guild <span className="text-[color:var(--class-color)]">Explorer</span></>
          )}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {guildName
            ? `${rosterData?.realm ?? realm} (${region.toUpperCase()}) — ${rosterData?.memberCount ?? ''} members`
            : active ? 'Loading guild...' : 'Select a character first'}
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-wow-darker/60 rounded-lg p-1 overflow-x-auto">
        {(['roster', 'mythic-plus', 'progression', 'audit', 'attendance', 'performance', 'timeline', 'leaderboard'] as Tab[]).map((t) => (
          <button key={t} onClick={() => handleTabChange(t)}
            className={cn('flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all whitespace-nowrap',
              tab === t ? 'bg-[color:var(--class-color)]/10 text-[color:var(--class-color)] border border-[color:var(--class-color)]/30' : 'text-gray-500 hover:text-gray-300 border border-transparent')}>
            {{ roster: 'Roster', 'mythic-plus': 'Mythic+', progression: 'Progression', audit: 'Gear Audit', attendance: 'Attendance', performance: 'Performance', timeline: 'Timeline', leaderboard: 'Leaderboard' }[t]}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs px-1">{error}</p>}

      {/* Loading */}
      {loading && (
        <Card>
          <div className="text-center py-12 space-y-2">
            <div className="w-6 h-6 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 text-sm">
              {tab === 'mythic-plus' ? 'Fetching M+ data for each member...' : 'Loading...'}
            </p>
          </div>
        </Card>
      )}

      {/* ═══ ROSTER ═══ */}
      {tab === 'roster' && rosterData && !rosterLoading && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-center">
            <Input value={searchName} onChange={(e) => setSearchName(e.target.value)}
              placeholder="Search by name..." className="w-48" />
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setClassFilter(null)}
                className={cn('px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border',
                  !classFilter ? 'bg-[color:var(--class-color)]/10 text-[color:var(--class-color)] border-[color:var(--class-color)]/30' : 'text-gray-500 border-transparent hover:text-gray-300')}>
                All
              </button>
              {rosterClasses.map((cls) => (
                <button key={cls} onClick={() => setClassFilter(classFilter === cls ? null : cls)}
                  className={cn('px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border',
                    classFilter === cls ? 'border-white/[0.2]' : 'border-transparent hover:border-white/[0.08]')}
                  style={{ color: CLASS_COLORS[cls] ?? '#888' }}>
                  {cls}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-gray-600 ml-auto">{filteredRoster.length} shown</span>
          </div>

          <Card className="p-0 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Name</th>
                  <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Class</th>
                  <th className="text-center px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Level</th>
                  <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Rank</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map((m) => (
                  <tr key={m.name} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {getClassIcon(m.class) ? (
                          <img src={getClassIcon(m.class)} alt="" className="w-5 h-5 rounded border border-white/[0.1] flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: CLASS_COLORS[m.class] ?? '#888' }} />
                        )}
                        <span className="font-medium text-gray-200">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: CLASS_COLORS[m.class] ?? '#888' }}>
                      <span className="text-xs">{m.class}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400 tabular-nums">{m.level}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-md border',
                        m.rank === 0 ? 'bg-[color:var(--class-color)]/10 text-[color:var(--class-color)] border-[color:var(--class-color)]/30' :
                        m.rank <= 2 ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        m.rank <= 4 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-white/[0.04] text-gray-500 border-white/[0.06]')}>
                        {m.rankLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRoster.length === 0 && (
              <p className="text-gray-600 text-xs text-center py-8">No members match the filters</p>
            )}
          </Card>
        </div>
      )}

      {/* ═══ MYTHIC+ ═══ */}
      {tab === 'mythic-plus' && mplusData && !mplusLoading && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{mplusData.memberCount} members scanned</p>
              <div className="flex gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-[color:var(--class-color)]">{mplusWithRuns.length}</p>
                  <p className="text-[10px] text-gray-600">Active</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-400">
                    {mplusWithRuns.length > 0 ? `+${Math.max(...mplusWithRuns.map((m) => m.highestKey))}` : '—'}
                  </p>
                  <p className="text-[10px] text-gray-600">Highest</p>
                </div>
              </div>
            </div>
          </Card>

          {mplusWithRuns.length > 0 ? (
            <Card className="p-0 overflow-hidden overflow-x-auto">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">This Week's Runs</h3>
                <span className="text-[10px] text-gray-600">{mplusWithRuns.reduce((s, m) => s + m.totalRuns, 0)} total runs</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {mplusWithRuns.map((member) => {
                  const color = CLASS_COLORS[member.class] ?? '#888'
                  const expanded = expandedMember === member.name
                  return (
                    <div key={member.name}>
                      <button onClick={() => setExpandedMember(expanded ? null : member.name)}
                        className="w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                          {getClassIcon(member.class) ? (
                            <img src={getClassIcon(member.class)} alt="" className="w-5 h-5 rounded border border-white/[0.1] flex-shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          )}
                          <span className="text-sm font-medium text-gray-200 flex-1">{member.name}</span>
                          <span className="text-[10px] text-gray-600">{member.class}</span>
                          <span className="text-xs font-semibold text-[color:var(--class-color)] tabular-nums">+{member.highestKey}</span>
                          <span className="text-[10px] text-gray-600 tabular-nums w-12 text-right">{member.totalRuns} run{member.totalRuns !== 1 ? 's' : ''}</span>
                          <span className={`text-[10px] text-gray-600 transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9654;</span>
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3 ml-5 space-y-1">
                          {member.runs.sort((a, b) => b.level - a.level).map((run, i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/[0.02]">
                              <span className={`text-xs font-bold tabular-nums w-8 ${run.timed ? 'text-[color:var(--class-color)]' : 'text-gray-500'}`}>+{run.level}</span>
                              <span className="text-xs text-gray-300 flex-1">{run.dungeon}</span>
                              <span className={`text-[10px] font-medium ${run.timed ? 'text-green-400' : 'text-red-400/70'}`}>{run.timed ? 'Timed' : 'Depleted'}</span>
                              <span className="text-[10px] text-gray-600 tabular-nums">{formatDuration(run.duration)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-10 space-y-2">
                <p className="text-gray-500">No M+ runs this week</p>
              </div>
            </Card>
          )}

          {mplusWithout.length > 0 && (
            <details className="group">
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 transition-colors">
                {mplusWithout.length} members with no runs this week
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {mplusWithout.map((m) => (
                  <span key={m.name} className="text-[11px] text-gray-600 px-2 py-1 rounded-md bg-white/[0.02] border border-white/[0.04] inline-flex items-center gap-1.5">
                    {getClassIcon(m.class) ? (
                      <img src={getClassIcon(m.class)} alt="" className="w-3.5 h-3.5 rounded" />
                    ) : (
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CLASS_COLORS[m.class] ?? '#888' }} />
                    )}
                    {m.name}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ═══ PROGRESSION ═══ */}
      {tab === 'progression' && progData && !progLoading && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Raid Progression — WarcraftLogs</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">World</p>
                <p className="text-xl font-bold text-[color:var(--class-color)]">
                  {progData.ranking.worldRank ? `#${progData.ranking.worldRank.toLocaleString()}` : '—'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Region</p>
                <p className="text-xl font-bold text-purple-400">
                  {progData.ranking.regionRank ? `#${progData.ranking.regionRank.toLocaleString()}` : '—'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Server</p>
                <p className="text-xl font-bold text-green-400">
                  {progData.ranking.serverRank ? `#${progData.ranking.serverRank.toLocaleString()}` : '—'}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 text-center mt-3">
              {progData.guild} — {progData.server} ({progData.region})
            </p>
          </Card>
        </div>
      )}

      {/* ═══ GEAR AUDIT ═══ */}
      {tab === 'audit' && auditData && !auditLoading && (
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden overflow-x-auto">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">Gear Audit</h3>
              <span className="text-[10px] text-gray-600">{auditData.memberCount} members scanned</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Player</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">ilvl</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Missing Enchants</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Missing Gems</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Issues</th>
                </tr>
              </thead>
              <tbody>
                {(auditData.results ?? []).map((m: any) => (
                  <tr key={m.name} className={cn('border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors',
                    m.issues === 0 && 'opacity-50')}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {getClassIcon(m.class) ? (
                          <img src={getClassIcon(m.class)} alt="" className="w-5 h-5 rounded border border-white/[0.1]" />
                        ) : (
                          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: CLASS_COLORS[m.class] ?? '#888' }} />
                        )}
                        <span className="font-medium text-gray-200">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400 tabular-nums">{m.ilvl}</td>
                    <td className="px-3 py-2.5">
                      {m.missingEnchants.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {m.missingEnchants.map((s: string) => (
                            <span key={s} className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">{s}</span>
                          ))}
                        </div>
                      ) : <span className="text-[10px] text-green-400">All good</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {m.missingGems.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {m.missingGems.map((s: string, i: number) => (
                            <span key={i} className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">{s}</span>
                          ))}
                        </div>
                      ) : <span className="text-[10px] text-green-400">All good</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {m.issues > 0 ? (
                        <span className="text-xs font-bold text-red-400">{m.issues}</span>
                      ) : (
                        <span className="text-xs text-green-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ═══ ATTENDANCE ═══ */}
      {tab === 'attendance' && attendanceData && !attendanceLoading && (
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden overflow-x-auto">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">Raid Attendance</h3>
              <span className="text-[10px] text-gray-600">Based on {attendanceData.totalRaids} recent logs</span>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {(attendanceData.attendance ?? []).map((m: any) => {
                const barWidth = Math.min(100, m.pct)
                const barColor = m.pct >= 80 ? '#22c55e' : m.pct >= 50 ? '#eab308' : '#ef4444'
                return (
                  <div key={m.name} className="flex items-center gap-3 px-4 py-2.5">
                    {getClassIcon(m.class) ? (
                      <img src={getClassIcon(m.class)} alt="" className="w-5 h-5 rounded border border-white/[0.1]" />
                    ) : (
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: CLASS_COLORS[m.class] ?? '#888' }} />
                    )}
                    <span className="text-xs font-medium text-gray-200 w-28 truncate">{m.name}</span>
                    <div className="flex-1 h-4 relative rounded overflow-hidden bg-white/[0.03]">
                      <div className="absolute inset-y-0 left-0 rounded transition-all" style={{ width: `${barWidth}%`, backgroundColor: barColor, opacity: 0.5 }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-12 text-right" style={{ color: barColor }}>{m.pct}%</span>
                    <span className="text-[10px] text-gray-600 tabular-nums w-12 text-right">{m.raids}/{m.total}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ PERFORMANCE ═══ */}
      {tab === 'performance' && perfData && !perfLoading && (
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden overflow-x-auto">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">DPS/HPS Performance</h3>
              <span className="text-[10px] text-gray-600">{perfData.reportsAnalyzed} reports analyzed</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Player</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Spec</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Avg DPS</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Avg HPS</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Fights</th>
                </tr>
              </thead>
              <tbody>
                {(perfData.performance ?? []).map((m: any) => (
                  <tr key={m.name} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {getClassIcon(m.class) ? (
                          <img src={getClassIcon(m.class)} alt="" className="w-5 h-5 rounded border border-white/[0.1]" />
                        ) : (
                          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: CLASS_COLORS[m.class] ?? '#888' }} />
                        )}
                        <span className="font-medium text-gray-200">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{m.spec}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-medium text-[color:var(--class-color)] tabular-nums">
                      {m.avgDps > 0 ? m.avgDps.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-medium text-green-400 tabular-nums">
                      {m.avgHps > 0 ? m.avgHps.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-500 tabular-nums">{m.fights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ═══ TIMELINE ═══ */}
      {tab === 'timeline' && timelineData && !timelineLoading && (() => {
        const hideZones = ['Mythic+ Season 1', 'Mythic+ Season 2', 'Mythic+ Season 3']
        const cleanData = timelineData.filter((k: any) => !hideZones.includes(k.zone))
        const zones = [...new Set(cleanData.map((k: any) => k.zone).filter(Boolean))]
        const filtered = timelineZone ? cleanData.filter((k: any) => k.zone === timelineZone) : cleanData

        return (
        <div className="space-y-4">
          {/* Zone filter */}
          {zones.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setTimelineZone(null)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  !timelineZone ? 'text-[color:var(--class-color)] bg-[color:var(--class-color-10)] border-[color:var(--class-color-20)]' : 'text-gray-500 border-transparent hover:text-gray-300')}>
                All
              </button>
              {zones.map((zone: string) => (
                <button key={zone} onClick={() => setTimelineZone(zone === timelineZone ? null : zone)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    timelineZone === zone ? 'text-[color:var(--class-color)] bg-[color:var(--class-color-10)] border-[color:var(--class-color-20)]' : 'text-gray-500 border-transparent hover:text-gray-300')}>
                  {zone}
                </button>
              ))}
            </div>
          )}

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">
              Progression Timeline
              {timelineZone && <span className="text-gray-500 font-normal"> — {timelineZone}</span>}
            </h3>
            {filtered.length === 0 ? (
              <p className="text-gray-500 text-xs">No kills found</p>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-white/[0.08]" />

                <div className="space-y-4">
                  {filtered.map((kill: any, i: number) => {
                    const date = new Date(kill.date)
                    const prevDate = i > 0 ? new Date(filtered[i - 1].date) : null
                    const showDate = !prevDate || date.toDateString() !== prevDate.toDateString()

                    return (
                      <div key={`${kill.boss}-${kill.zone}-${i}`}>
                        {showDate && (
                          <div className="flex items-center gap-2 mb-2 -ml-6">
                            <div className="w-4 h-4 rounded-full bg-wow-panel border-2 border-white/[0.15] flex-shrink-0" />
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                              {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 relative">
                          <div className={cn('absolute -left-6 w-2.5 h-2.5 rounded-full border-2 border-wow-panel',
                            kill.firstKill || kill.kills > 0 ? 'bg-[color:var(--class-color)]' : 'bg-gray-600')} />
                          <div className="flex-1">
                            <button
                              onClick={() => loadBossPulls(kill.boss)}
                              className={cn('text-sm font-medium transition-colors text-left',
                                selectedBoss === kill.boss ? 'text-[color:var(--class-color)]' : 'text-gray-200 hover:text-[color:var(--class-color)]')}>
                              {kill.boss}
                              {kill.pulls > 1 && <span className="text-[9px] text-gray-600 ml-1">▼</span>}
                            </button>
                            <div className="flex items-center gap-2 mt-0.5">
                              {!timelineZone && <span className="text-[10px] text-gray-500">{kill.zone}</span>}
                              {kill.pulls != null && (
                                <span className="text-[10px] text-gray-400">
                                  {kill.pulls} pull{kill.pulls > 1 ? 's' : ''}
                                </span>
                              )}
                              {kill.kills > 0 && (
                                <span className="text-[10px] text-green-400">{kill.kills} kill{kill.kills > 1 ? 's' : ''}</span>
                              )}
                              {kill.wipes > 0 && (
                                <span className="text-[10px] text-red-400/70">{kill.wipes} wipe{kill.wipes > 1 ? 's' : ''}</span>
                              )}
                              {kill.wipes > 0 && kill.bestPull != null && kill.bestPull < 100 && !kill.kills && (
                                <span className="text-[10px] text-yellow-400">best: {(kill.bestPull / 100).toFixed(1)}%</span>
                              )}
                              {kill.firstKill && (
                                <span className="text-[10px] text-gray-600">
                                  {new Date(kill.firstKill).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Pull progression chart */}
                        {selectedBoss === kill.boss && (
                          <div className="mt-3 ml-0 animate-fade-in">
                            {bossPullsLoading ? (
                              <div className="flex justify-center py-4">
                                <div className="w-4 h-4 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin" />
                              </div>
                            ) : bossPulls.length === 0 ? (
                              <p className="text-[10px] text-gray-600 py-2">Aucune donnée de pull</p>
                            ) : (
                              <Card className="p-3">
                                {(() => {
                                  const presetPhases = BOSS_PHASES[kill.boss] || []
                                  const customStr = customPhases[kill.boss]
                                  const phases = customStr ? parsePhaseString(customStr) : presetPhases
                                  const phaseColors = ['#F59E0B', '#A855F7', '#EC4899', '#3B82F6']

                                  return <>
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                        Progression — {kill.boss} ({bossPulls.length} pulls)
                                      </p>
                                      <button
                                        onClick={() => setEditingPhases(!editingPhases)}
                                        className="text-[9px] text-gray-600 hover:text-[color:var(--class-color)] transition-colors"
                                      >
                                        {editingPhases ? 'Fermer' : 'Phases'}
                                      </button>
                                    </div>

                                    {editingPhases && (
                                      <div className="flex items-center gap-2 mb-2 animate-fade-in">
                                        <input
                                          type="text"
                                          value={customPhases[kill.boss] ?? presetPhases.map(p => `${p.label}:${p.percent}`).join(',')}
                                          onChange={e => setCustomPhases(prev => ({ ...prev, [kill.boss]: e.target.value }))}
                                          placeholder="P2:60,P3:30"
                                          className="flex-1 px-2 py-1 text-[10px] bg-wow-darker border border-white/[0.08] rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[color:var(--class-color)]/40"
                                        />
                                        <span className="text-[8px] text-gray-600">Format: P2:60,P3:30</span>
                                      </div>
                                    )}

                                    <ResponsiveContainer width="100%" height={200}>
                                      <LineChart data={bossPulls} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                        <XAxis
                                          dataKey="pull"
                                          tick={{ fontSize: 9, fill: '#555' }}
                                          axisLine={{ stroke: '#222' }}
                                          tickLine={false}
                                          label={{ value: 'Pull #', position: 'insideBottom', offset: -2, fontSize: 9, fill: '#444' }}
                                        />
                                        <YAxis
                                          domain={[0, 100]}
                                          tick={{ fontSize: 9, fill: '#555' }}
                                          axisLine={{ stroke: '#222' }}
                                          tickLine={false}
                                          tickFormatter={(v: number) => `${v}%`}
                                        />
                                        <Tooltip
                                          contentStyle={{ background: '#141425', border: '1px solid #333', borderRadius: 6, fontSize: 11 }}
                                          formatter={(value: number, _: string, props: any) => {
                                            const p = props.payload
                                            let phaseLabel = 'P1'
                                            for (const ph of [...phases].sort((a, b) => b.percent - a.percent)) {
                                              if (value <= ph.percent) phaseLabel = ph.label
                                            }
                                            return [
                                              `${value}%${p.kill ? ' — KILL!' : ''} (${phaseLabel})`,
                                              `Pull #${p.pull} — ${p.duration}s`
                                            ]
                                          }}
                                          labelFormatter={() => ''}
                                        />
                                        {/* Phase lines */}
                                        {phases.map((phase, idx) => (
                                          <ReferenceLine
                                            key={phase.label}
                                            y={phase.percent}
                                            stroke={phaseColors[idx % phaseColors.length]}
                                            strokeDasharray="6 3"
                                            strokeOpacity={0.5}
                                            label={{
                                              value: `${phase.label} (${phase.percent}%)`,
                                              position: 'right',
                                              fontSize: 9,
                                              fill: phaseColors[idx % phaseColors.length],
                                            }}
                                          />
                                        ))}
                                        {/* Kill line at 0% */}
                                        <ReferenceLine y={0} stroke="#22C55E" strokeDasharray="3 3" strokeOpacity={0.3} />
                                        <Line
                                          type="monotone"
                                          dataKey="percent"
                                          stroke="var(--class-color)"
                                          strokeWidth={2}
                                          dot={(props: any) => {
                                            const { cx, cy, payload } = props
                                            if (payload.kill) {
                                              return <circle cx={cx} cy={cy} r={5} fill="#22C55E" stroke="#fff" strokeWidth={1.5} />
                                            }
                                            return <circle cx={cx} cy={cy} r={2.5} fill="var(--class-color)" fillOpacity={0.7} />
                                          }}
                                          activeDot={{ r: 4, stroke: '#fff', strokeWidth: 1 }}
                                        />
                                      </LineChart>
                                    </ResponsiveContainer>

                                    {/* Legend */}
                                    <div className="flex items-center gap-3 mt-1 text-[9px] text-gray-600 flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--class-color)' }} /> Wipe
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-400" /> Kill
                                      </span>
                                      {phases.map((phase, idx) => (
                                        <span key={phase.label} className="flex items-center gap-1">
                                          <span className="w-3 h-px" style={{ backgroundColor: phaseColors[idx % phaseColors.length] }} />
                                          {phase.label} ({phase.percent}%)
                                        </span>
                                      ))}
                                    </div>
                                  </>
                                })()}
                              </Card>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
        )
      })()}

      {/* ═══ LEADERBOARD ═══ */}
      {tab === 'leaderboard' && (
        <Suspense fallback={
          <Card>
            <div className="text-center py-12 space-y-2">
              <div className="w-6 h-6 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 text-sm">Loading...</p>
            </div>
          </Card>
        }>
          <LeaderboardPage />
        </Suspense>
      )}

      {/* Empty state */}
      {!rosterData && !mplusData && !progData && !auditData && !attendanceData && !perfData && !timelineData && !loading && !error && tab !== 'leaderboard' && (
        <Card>
          <div className="text-center py-16 space-y-3">
            {!active ? (
              <p className="text-gray-500">Select a character to see your guild</p>
            ) : !guild ? (
              <>
                <p className="text-gray-500">Detecting your guild...</p>
                <div className="w-5 h-5 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" />
              </>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  )
}
