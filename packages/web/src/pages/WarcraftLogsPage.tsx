import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string
  url: string
  label: string
  reportCode: string
  badges: string[]
  createdAt: string
}

interface WclFight {
  id: number
  name: string
  kill: boolean
  difficulty: number
  bossPercentage?: number
  startTime: number
  endTime: number
}

interface WclReport {
  title: string
  owner: string
  zone: string
  fights: WclFight[]
}

interface WclPlayer {
  name: string
  type: string
  spec: string
  itemLevel: number
  total: number
}

interface WclFightDetails {
  dps: WclPlayer[]
  hps: WclPlayer[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'warcraftlogs-links'
const uid = () => Math.random().toString(36).slice(2, 10)

function loadLinks(): LogEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveLinks(links: LogEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links))
}
function extractReportCode(url: string): string | null {
  const match = url.match(/reports\/([a-zA-Z0-9]+)/)
  return match?.[1] ?? null
}
function isValidWclUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(classic\.)?warcraftlogs\.com\/reports\//.test(url.trim())
}
function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString()
}

const DIFFICULTY_LABELS: Record<number, string> = { 3: 'Normal', 4: 'Heroic', 5: 'Mythic' }

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569',
  Priest: '#FFFFFF', DeathKnight: '#C41F3B', Shaman: '#0070DE', Mage: '#69CCF0',
  Warlock: '#9482C9', Monk: '#00FF96', Druid: '#FF7D0A', DemonHunter: '#A330C9',
  Evoker: '#33937F',
}

// ─── Component ────────────────────────────────────────────────────────────────

const BADGE_PRESETS = ['Progress', 'Reclear', 'Farm', 'Tryhard', 'Chill', 'Parse Run', 'Alt Run', 'PUG']
const BADGE_COLORS: Record<string, string> = {
  Progress: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Reclear: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Farm: 'bg-green-500/20 text-green-400 border-green-500/30',
  Tryhard: 'bg-red-500/20 text-red-400 border-red-500/30',
  Chill: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'Parse Run': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Alt Run': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  PUG: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

function getBadgeClass(badge: string): string {
  return BADGE_COLORS[badge] ?? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
}

export function WarcraftLogsPage() {
  const [links, setLinks] = useState<LogEntry[]>(loadLinks)
  const [newUrl, setNewUrl] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [newBadgeText, setNewBadgeText] = useState('')
  const [badgeMenuId, setBadgeMenuId] = useState<string | null>(null)

  // Report state
  const [activeCode, setActiveCode] = useState<string | null>(null)
  const [report, setReport] = useState<WclReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  // Fight state
  const [activeFightId, setActiveFightId] = useState<number | null>(null)
  const [fightDetails, setFightDetails] = useState<WclFightDetails | null>(null)
  const [fightLoading, setFightLoading] = useState(false)

  useEffect(() => { saveLinks(links) }, [links])

  // ── Log actions ──
  const renameLog = (id: string, label: string) => {
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, label } : l))
    setEditingId(null)
  }

  const addBadge = (id: string, badge: string) => {
    setLinks((prev) => prev.map((l) => {
      if (l.id !== id) return l
      if (l.badges.includes(badge)) return l
      return { ...l, badges: [...l.badges, badge] }
    }))
    setBadgeMenuId(null)
    setNewBadgeText('')
  }

  const removeBadge = (id: string, badge: string) => {
    setLinks((prev) => prev.map((l) =>
      l.id === id ? { ...l, badges: l.badges.filter((b) => b !== badge) } : l
    ))
  }

  // ── Add log ──
  const handleAdd = useCallback(async () => {
    setError(null)
    const url = newUrl.trim()
    if (!url) { setError('Paste a Warcraft Logs URL'); return }
    if (!isValidWclUrl(url)) { setError('Invalid URL — must be warcraftlogs.com/reports/...'); return }
    const code = extractReportCode(url)
    if (!code) { setError('Could not extract report code'); return }
    if (links.some((l) => l.reportCode === code)) {
      openReport(code)
      setNewUrl('')
      setNewLabel('')
      return
    }

    setReportLoading(true)
    setActiveCode(code)
    setReport(null)
    setReportError(null)
    setActiveFightId(null)
    setFightDetails(null)

    try {
      const data = await api.getWclReport(code)
      setReport(data)
      setLinks((prev) => [{
        id: uid(), url, reportCode: code,
        label: newLabel.trim() || data.title || `Log ${code}`,
        badges: [],
        createdAt: new Date().toISOString(),
      }, ...prev])
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setReportLoading(false)
      setNewUrl('')
      setNewLabel('')
    }
  }, [newUrl, newLabel, links])

  // ── Open report ──
  const openReport = async (code: string) => {
    if (activeCode === code && report) return // already loaded
    setActiveCode(code)
    setReport(null)
    setReportError(null)
    setActiveFightId(null)
    setFightDetails(null)
    setReportLoading(true)
    try {
      const data = await api.getWclReport(code)
      setReport(data)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setReportLoading(false)
    }
  }

  // ── Open fight ──
  const openFight = async (fightId: number) => {
    if (!activeCode) return
    setActiveFightId(fightId)
    setFightDetails(null)
    setFightLoading(true)
    try {
      const data = await api.getWclFight(activeCode, fightId)
      setFightDetails(data)
    } catch { /* skip */ }
    finally { setFightLoading(false) }
  }

  const handleDelete = (id: string, code: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id))
    if (activeCode === code) {
      setActiveCode(null)
      setReport(null)
    }
  }

  const activeFight = report?.fights.find((f) => f.id === activeFightId)

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Warcraft <span className="text-[color:var(--class-color)]">Logs</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">Browse and analyze your raid logs</p>
      </div>

      {/* Add URL */}
      <Card className="p-4">
        <div className="flex gap-2">
          <Input value={newUrl} onChange={(e) => { setNewUrl(e.target.value); setError(null) }}
            placeholder="https://www.warcraftlogs.com/reports/..." className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Name (optional)" className="w-48"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
          <Button onClick={handleAdd} disabled={reportLoading} size="md">
            {reportLoading ? 'Loading...' : 'Load'}
          </Button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </Card>

      {/* Saved logs */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((entry) => {
            const isActive = activeCode === entry.reportCode
            const isEditing = editingId === entry.id
            const showBadgeMenu = badgeMenuId === entry.id

            return (
              <Card key={entry.id} className={`p-3 transition-all cursor-pointer ${
                isActive ? 'border-[color:var(--class-color)]/30 bg-[color:var(--class-color)]/[0.03]' : 'hover:border-white/[0.1]'
              }`}>
                <div className="flex items-start gap-3" onClick={() => openReport(entry.reportCode)}>
                  {/* WCL icon */}
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-orange-400 font-bold text-[9px]">WCL</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {/* Label — editable */}
                    {isEditing ? (
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') renameLog(entry.id, editLabel); if (e.key === 'Escape') setEditingId(null) }}
                        onBlur={() => renameLog(entry.id, editLabel)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="bg-transparent text-sm font-medium text-gray-200 focus:outline-none border-b border-[color:var(--class-color)]/40 pb-0.5 w-full"
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-200 truncate"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingId(entry.id); setEditLabel(entry.label) }}
                        title="Double-click to rename">
                        {entry.label}
                      </p>
                    )}

                    {/* Report code + date */}
                    <p className="text-[10px] text-gray-600 font-mono mt-0.5">{entry.reportCode}</p>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {(entry.badges ?? []).map((badge) => (
                        <span key={badge} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${getBadgeClass(badge)}`}>
                          {badge}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeBadge(entry.id, badge) }}
                            className="hover:text-red-400 transition-colors text-[8px] ml-0.5"
                          >
                            ✕
                          </button>
                        </span>
                      ))}

                      {/* Add badge button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setBadgeMenuId(showBadgeMenu ? null : entry.id) }}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] text-gray-600 hover:text-gray-400 border border-dashed border-white/[0.08] hover:border-white/[0.15] transition-colors"
                      >
                        + badge
                      </button>
                    </div>

                    {/* Badge dropdown */}
                    {showBadgeMenu && (
                      <div className="mt-2 p-2 rounded-lg border border-white/[0.08] bg-wow-panel/95 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          {BADGE_PRESETS.filter((b) => !(entry.badges ?? []).includes(b)).map((badge) => (
                            <button
                              key={badge}
                              onClick={() => addBadge(entry.id, badge)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors hover:brightness-125 ${getBadgeClass(badge)}`}
                            >
                              {badge}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            value={newBadgeText}
                            onChange={(e) => setNewBadgeText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && newBadgeText.trim()) { addBadge(entry.id, newBadgeText.trim()); setNewBadgeText('') } }}
                            placeholder="Custom badge..."
                            className="flex-1 bg-wow-darker/80 border border-white/[0.08] rounded-md px-2 py-1 text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[color:var(--class-color)]/30"
                          />
                          <button
                            onClick={() => { if (newBadgeText.trim()) { addBadge(entry.id, newBadgeText.trim()); setNewBadgeText('') } }}
                            className="text-[10px] text-[color:var(--class-color)]/70 hover:text-[color:var(--class-color)] px-2 transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a href={entry.url} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-gray-600 hover:text-[color:var(--class-color)] transition-colors p-1">
                      &#8599;
                    </a>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(entry.id, entry.reportCode) }}
                      className="text-[10px] text-gray-700 hover:text-red-400 transition-colors p-1">
                      &#10005;
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Report loading */}
      {reportLoading && (
        <Card><p className="text-gray-500 text-sm animate-pulse text-center py-10">Loading report...</p></Card>
      )}

      {/* Report error */}
      {reportError && (
        <Card>
          <div className="text-center py-8 space-y-2">
            <p className="text-red-400 text-sm">{reportError}</p>
            <p className="text-gray-600 text-xs">Check the URL and WarcraftLogs API credentials</p>
          </div>
        </Card>
      )}

      {/* Report loaded — fights + details */}
      {report && !reportLoading && (
        <div className="space-y-4">
          {/* Report header */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-200">{report.title}</h2>
                <div className="flex items-center gap-3 mt-0.5">
                  {report.zone && <span className="text-xs text-gray-500">{report.zone}</span>}
                  {report.owner && <span className="text-xs text-gray-600">by {report.owner}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600">{report.fights.length} fights</span>
                {activeCode && (
                  <a href={`https://www.warcraftlogs.com/reports/${activeCode}`} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-[color:var(--class-color)]/70 hover:text-[color:var(--class-color)] transition-colors">
                    Open on WCL &#8599;
                  </a>
                )}
              </div>
            </div>
          </Card>

          {/* Fights grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {report.fights.map((fight) => (
              <button
                key={fight.id}
                onClick={() => openFight(fight.id)}
                className={`text-left px-4 py-3 rounded-xl border transition-all ${
                  activeFightId === fight.id
                    ? 'border-[color:var(--class-color)]/30 bg-[color:var(--class-color)]/[0.04]'
                    : 'border-white/[0.04] hover:border-white/[0.08] bg-wow-panel/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${fight.kill ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-sm font-medium text-gray-200">{fight.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-600 tabular-nums">
                    {formatDuration(fight.endTime - fight.startTime)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 ml-[18px]">
                  {fight.difficulty > 0 && (
                    <span className="text-[10px] text-gray-600">{DIFFICULTY_LABELS[fight.difficulty] ?? ''}</span>
                  )}
                  {!fight.kill && fight.bossPercentage != null && (
                    <span className="text-[10px] text-red-400/70">Wipe {(fight.bossPercentage / 100).toFixed(1)}%</span>
                  )}
                  {fight.kill && <span className="text-[10px] text-green-400/70">Kill</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Fight details */}
          {activeFightId && fightLoading && (
            <Card><p className="text-gray-500 text-sm animate-pulse text-center py-8">Loading fight data...</p></Card>
          )}

          {activeFightId && fightDetails && (
            <div className="space-y-3">
              {/* Fight header */}
              {activeFight && (
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${activeFight.kill ? 'bg-green-400' : 'bg-red-400'}`} />
                  <h3 className="text-lg font-semibold text-gray-200">{activeFight.name}</h3>
                  {activeFight.difficulty > 0 && (
                    <span className="text-xs text-gray-500">{DIFFICULTY_LABELS[activeFight.difficulty]}</span>
                  )}
                  <span className="text-xs text-gray-600 tabular-nums">
                    {formatDuration(activeFight.endTime - activeFight.startTime)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* DPS */}
                <Card className="p-0 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-300">DPS</h4>
                    <span className="text-[10px] text-gray-600">{fightDetails.dps.length} players</span>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {fightDetails.dps.slice(0, 25).map((p, i) => (
                      <PlayerRow key={`${p.name}-${i}`} player={p} rank={i + 1} maxTotal={fightDetails.dps[0]?.total ?? 1} />
                    ))}
                    {fightDetails.dps.length === 0 && (
                      <p className="text-gray-600 text-xs text-center py-6">No DPS data</p>
                    )}
                  </div>
                </Card>

                {/* HPS */}
                <Card className="p-0 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-green-400/80">HPS</h4>
                    <span className="text-[10px] text-gray-600">{fightDetails.hps.length} players</span>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {fightDetails.hps.slice(0, 25).map((p, i) => (
                      <PlayerRow key={`${p.name}-${i}`} player={p} rank={i + 1} maxTotal={fightDetails.hps[0]?.total ?? 1} isHealing />
                    ))}
                    {fightDetails.hps.length === 0 && (
                      <p className="text-gray-600 text-xs text-center py-6">No HPS data</p>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* No fight selected hint */}
          {!activeFightId && !fightLoading && (
            <p className="text-center text-gray-600 text-sm py-4">Select a fight above to view DPS and HPS details</p>
          )}
        </div>
      )}

      {/* Empty state — no logs and no report loading */}
      {links.length === 0 && !report && !reportLoading && !reportError && (
        <Card>
          <div className="text-center py-16 space-y-3">
            <p className="text-3xl text-gray-700">&#128200;</p>
            <p className="text-gray-500">Paste a Warcraft Logs URL to get started</p>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Player Row ───────────────────────────────────────────────────────────────

function PlayerRow({ player, rank, maxTotal, isHealing }: { player: WclPlayer; rank: number; maxTotal: number; isHealing?: boolean }) {
  const barPct = Math.round((player.total / maxTotal) * 100)
  const classColor = CLASS_COLORS[player.type] ?? '#888'
  const barColor = isHealing ? '#22c55e' : classColor

  return (
    <div className="relative px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
      <div className="absolute inset-y-0 left-0 opacity-[0.06]" style={{ width: `${barPct}%`, backgroundColor: barColor }} />
      <div className="relative flex items-center gap-3">
        <span className="text-[10px] text-gray-600 w-4 text-right tabular-nums">{rank}</span>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: classColor }} />
        <span className="text-xs font-medium text-gray-200 flex-1 truncate">{player.name}</span>
        {player.spec && <span className="text-[9px] text-gray-600 flex-shrink-0">{player.spec}</span>}
        <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color: barColor }}>
          {formatNumber(player.total)}
        </span>
      </div>
    </div>
  )
}
