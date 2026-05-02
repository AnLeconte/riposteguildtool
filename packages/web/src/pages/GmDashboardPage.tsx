import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { cn } from '@/lib/utils'

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569',
  Priest: '#FFFFFF', 'Death Knight': '#C41F3B', Shaman: '#0070DE', Mage: '#69CCF0',
  Warlock: '#9482C9', Monk: '#00FF96', Druid: '#FF7D0A', 'Demon Hunter': '#A330C9',
  Evoker: '#33937F',
}

interface AuditEntry {
  player: string
  class: string
  ilvl: number
  issues: string[]
}

interface AttendanceEntry {
  name: string
  present: number
  absent: number
  total: number
  rate: number
}

interface IlvlProgress {
  name: string
  first: number
  last: number
  diff: number
}

export function GmDashboardPage() {
  const active = useCharacterStore((s) => s.getActive())
  const realm = active?.guildRealm ?? active?.realm ?? ''
  const guild = active?.guild ?? ''
  const region = active?.region ?? 'eu'

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!realm || !guild) return
    setLoading(true)
    setError(null)
    api.getGmDashboard(realm, guild, region)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [realm, guild, region])

  const gearAudit: AuditEntry[] = data?.gearAudit ?? []
  const ilvlRanking: AuditEntry[] = data?.ilvlRanking ?? []
  const attendance: AttendanceEntry[] = data?.attendance ?? []
  const ilvlProgress: IlvlProgress[] = data?.ilvlProgress ?? []
  const totalEvents = data?.totalEvents ?? 0
  const rosterCount = data?.rosterCount ?? 0

  // Stats
  const avgIlvl = useMemo(() => {
    if (ilvlRanking.length === 0) return 0
    return Math.round(ilvlRanking.reduce((s, e) => s + e.ilvl, 0) / ilvlRanking.length)
  }, [ilvlRanking])

  const playersWithIssues = gearAudit.length
  const stagnating = ilvlProgress.filter((p) => p.diff <= 0).length

  if (!guild) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-500">Sélectionne un personnage avec une guilde pour accéder au Dashboard GM</p>
      </Card>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Dashboard <span className="text-[color:var(--class-color)]">GM</span>
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Vue d'ensemble de la guilde pour les officiers</p>
      </div>

      {loading && (
        <Card>
          <div className="text-center py-12 space-y-2">
            <div className="w-6 h-6 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 text-sm">Chargement du dashboard...</p>
            <p className="text-gray-600 text-xs">L'audit gear peut prendre 30-60 secondes</p>
          </div>
        </Card>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {data && !loading && (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-[color:var(--class-color)]">{rosterCount}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Membres</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-white">{avgIlvl}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">ilvl moyen</p>
            </Card>
            <Card className="p-4 text-center">
              <p className={cn('text-2xl font-bold', playersWithIssues > 0 ? 'text-yellow-400' : 'text-green-400')}>
                {playersWithIssues}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Gear incomplet</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-400">{totalEvents}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Raids (30j)</p>
            </Card>
          </div>

          {/* Gear Audit — players with issues */}
          {gearAudit.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">Gear Audit — Problèmes détectés</h3>
                <span className="text-[10px] text-yellow-400">{gearAudit.length} joueur{gearAudit.length > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {gearAudit.map((entry) => (
                  <div key={entry.player} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium" style={{ color: CLASS_COLORS[entry.class] ?? '#ccc' }}>
                        {entry.player}
                      </span>
                      <span className="text-[10px] text-gray-500">{entry.ilvl} ilvl</span>
                    </div>
                    {entry.issues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-yellow-400/70">
                        <span className="text-[10px]">&#9888;</span>
                        <span className="text-[11px]">{issue}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {gearAudit.length === 0 && data.ilvlRanking && (
            <Card className="p-4 text-center">
              <span className="text-green-400 text-sm">&#10003;</span>
              <span className="text-sm text-gray-300 ml-2">Tous les joueurs ont leur gear enchant et gemme</span>
            </Card>
          )}

          {/* Ilvl Ranking */}
          {ilvlRanking.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-gray-300">Classement ilvl</h3>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {ilvlRanking.slice(0, 20).map((entry, i) => {
                  const maxIlvl = ilvlRanking[0]?.ilvl ?? 1
                  const pct = (entry.ilvl / maxIlvl) * 100
                  return (
                    <div key={entry.player} className="flex items-center gap-3 px-4 py-2 relative">
                      <div
                        className="absolute inset-0 bg-[color:var(--class-color)]/[0.03]"
                        style={{ width: `${pct}%` }}
                      />
                      <span className={cn('text-xs font-bold tabular-nums w-5 relative z-10',
                        i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600')}>
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium flex-1 relative z-10" style={{ color: CLASS_COLORS[entry.class] ?? '#ccc' }}>
                        {entry.player}
                      </span>
                      <span className="text-xs font-bold text-[color:var(--class-color)] tabular-nums relative z-10">
                        {entry.ilvl}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Attendance */}
          {attendance.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">Présence aux raids</h3>
                <span className="text-[10px] text-gray-600">{totalEvents} événement{totalEvents > 1 ? 's' : ''} sur 30 jours</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {attendance.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xs font-medium text-gray-200 flex-1">{entry.name}</span>
                    <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', entry.rate >= 80 ? 'bg-green-400' : entry.rate >= 50 ? 'bg-yellow-400' : 'bg-red-400')}
                        style={{ width: `${entry.rate}%` }}
                      />
                    </div>
                    <span className={cn('text-xs font-bold tabular-nums w-10 text-right',
                      entry.rate >= 80 ? 'text-green-400' : entry.rate >= 50 ? 'text-yellow-400' : 'text-red-400')}>
                      {entry.rate}%
                    </span>
                    <span className="text-[10px] text-gray-600 tabular-nums w-12 text-right">
                      {entry.present}/{entry.total}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Ilvl Progression / Stagnation */}
          {ilvlProgress.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">Progression ilvl (14 derniers jours)</h3>
                {stagnating > 0 && (
                  <span className="text-[10px] text-yellow-400">{stagnating} en stagnation</span>
                )}
              </div>
              <div className="divide-y divide-white/[0.03]">
                {ilvlProgress.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xs font-medium text-gray-200 flex-1">{entry.name}</span>
                    <span className="text-[10px] text-gray-500 tabular-nums">{entry.first.toFixed(1)} → {entry.last.toFixed(1)}</span>
                    <span className={cn('text-xs font-bold tabular-nums w-14 text-right',
                      entry.diff > 0 ? 'text-green-400' : entry.diff === 0 ? 'text-gray-500' : 'text-red-400')}>
                      {entry.diff > 0 ? '+' : ''}{entry.diff}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
