import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EncounterSelector } from '@/components/cooldown-planner/EncounterSelector'
import { RosterEditor } from '@/components/cooldown-planner/RosterEditor'
import { CooldownPalette } from '@/components/cooldown-planner/CooldownPalette'
import { Timeline } from '@/components/cooldown-planner/Timeline'
import { useCooldownPlannerStore } from '@/stores/useCooldownPlannerStore'
import { encodePlan, decodePlan, formatTime } from '@/lib/cooldown-planner-utils'
import { api } from '@/lib/api'
import type { CooldownPlan } from '@wow-simc/shared'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

export function CooldownPlannerPage() {
  const { plan, encounter, zoom, setZoom, newPlan, loadPlan, setPlanName } = useCooldownPlannerStore()
  const location = useLocation()
  const [copied, setCopied] = useState(false)
  const [raidImage, setRaidImage] = useState<string | null>(null)

  // Load shared plan from URL hash on mount
  useEffect(() => {
    const hash = location.hash.replace('#data=', '')
    if (hash) {
      const decoded = decodePlan(hash)
      if (decoded && (decoded as CooldownPlan).encounterId) {
        loadPlan(decoded as CooldownPlan)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch raid image for the selected encounter
  useEffect(() => {
    if (!encounter) { setRaidImage(null); return }
    api.getRaids('raid')
      .then(async (raids) => {
        const raid = raids.find((r) => r.name === encounter.raid)
        if (!raid) return
        const data = await api.getRaid(raid.id)
        if (data.image_url) setRaidImage(data.image_url)
      })
      .catch(() => { /* skip */ })
  }, [encounter?.raid])

  const handleShare = useCallback(async () => {
    const encoded = encodePlan(plan)
    const url = `${window.location.origin}/cooldown-planner#data=${encoded}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [plan])

  const handleExportAddon = useCallback(async () => {
    const rosterJson = JSON.stringify(plan.roster.map(h => ({ id: h.id, name: h.name, spec: h.spec, class: (h as any).class || '' })))
    const placementsJson = JSON.stringify(plan.placements.map(p => ({ healerId: p.healerId, cooldownDefId: p.cooldownDefId, startTime: p.startTime, spellId: (p as any).spellId })))
    const payload = [plan.id, plan.name, plan.encounterId, rosterJson, placementsJson].join('|')
    const encoded = btoa(unescape(encodeURIComponent(payload)))
    const code = `RRT:v1:cdplan:${encoded}`
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [plan])

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${plan.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [plan])

  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text) as CooldownPlan
        if (data.encounterId && data.roster) loadPlan(data)
      } catch { /* ignore */ }
    }
    input.click()
  }, [loadPlan])

  const upgradeCount = plan.roster.length
  const cdCount = plan.placements.length

  return (
    <div className="w-full space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Cooldown <span className="text-[color:var(--class-color)]">Planner</span>
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Plan healing cooldowns for raid encounters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleImport}>Import</Button>
          <Button variant="ghost" size="sm" onClick={handleExport}>Export</Button>
          <Button variant="ghost" size="sm" onClick={handleShare}>
            {copied ? 'Copied!' : 'Share'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportAddon}>
            {copied ? 'Copied!' : 'Export Addon'}
          </Button>
          <Button variant="secondary" size="sm" onClick={newPlan}>New Plan</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_300px] gap-4">
        {/* ── Left sidebar: Encounter + Plan ── */}
        <div className="space-y-3">
          <Card className="p-3">
            <input
              value={plan.name}
              onChange={(e) => setPlanName(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-gray-200 focus:outline-none border-b border-transparent focus:border-[color:var(--class-color)]/40 pb-1 transition-colors"
              placeholder="Plan name..."
            />
          </Card>

          <Card className="p-3">
            <EncounterSelector />
          </Card>

          {/* Zoom */}
          {encounter && (
            <Card className="p-3">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-medium text-gray-500">Zoom</span>
                <button onClick={() => setZoom(Math.max(0, zoom - 1))}
                  className="w-6 h-6 rounded-lg border border-white/[0.08] text-gray-400 hover:text-white text-xs">−</button>
                <div className="flex-1 h-1 rounded-full bg-wow-darker/80 overflow-hidden">
                  <div className="h-full bg-[color:var(--class-color)]/40 rounded-full transition-all" style={{ width: `${(zoom / 4) * 100}%` }} />
                </div>
                <button onClick={() => setZoom(Math.min(4, zoom + 1))}
                  className="w-6 h-6 rounded-lg border border-white/[0.08] text-gray-400 hover:text-white text-xs">+</button>
              </div>
            </Card>
          )}
        </div>

        {/* ── Center: Timeline ── */}
        <div className="space-y-4">
          {!encounter ? (
            /* Empty state */
            <Card>
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-wow-gold/10 to-amber-500/10 border border-[color:var(--class-color)]/20 flex items-center justify-center">
                  <span className="text-3xl">&#9200;</span>
                </div>
                <div>
                  <p className="text-gray-300 font-medium">Select a boss encounter</p>
                  <p className="text-gray-600 text-sm mt-1">Choose a raid and boss from the sidebar to start planning cooldowns</p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* Encounter banner */}
              <div className="relative h-28 rounded-xl overflow-hidden border border-white/[0.06]">
                {raidImage ? (
                  <img src={raidImage} alt={encounter.raid} className="w-full h-full object-cover brightness-[0.4]" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-wow-accent/40 via-wow-panel to-wow-accent/20" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 pt-8 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--class-color)]/80">{encounter.raid}</p>
                    <h2 className="text-xl font-bold text-white drop-shadow-lg">{encounter.name}</h2>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <p className="text-gray-400">{formatTime(encounter.fightDuration)}</p>
                      <p className="text-[9px] text-gray-600">Duration</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">{encounter.abilities.length}</p>
                      <p className="text-[9px] text-gray-600">Abilities</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">{upgradeCount}</p>
                      <p className="text-[9px] text-gray-600">Healers</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[color:var(--class-color)] font-semibold">{cdCount}</p>
                      <p className="text-[9px] text-gray-600">CDs</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <Timeline />
            </>
          )}
        </div>

        {/* ── Right sidebar: Roster + Cooldowns ── */}
        <div className="space-y-3">
          <Card className="p-3">
            <RosterEditor />
          </Card>

          {encounter && plan.roster.length > 0 && (
            <Card className="p-3">
              <CooldownPalette />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
