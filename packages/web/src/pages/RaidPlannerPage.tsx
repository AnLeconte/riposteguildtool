import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { api } from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import { joinPlanRoom, type PlanCursor } from '@/lib/socket'
import { cn } from '@/lib/utils'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useAuthStore } from '@/stores/useAuthStore'


// ── Raid / Boss data ─────────────────────────────────────────────────────────

const CDN = 'https://cdn.raidplan.io/raid'

interface BossMap { name: string; slug: string }
interface Boss { id: string; name: string; nickname: string; encounterId: number; maps: BossMap[] }
interface Raid { id: string; name: string; bosses: Boss[] }
interface Ability { id: number; name: string; description: string; iconUrl?: string; iconName?: string }

const RAIDS: Raid[] = [
  {
    id: 'wow.voidspire', name: 'The Voidspire',
    bosses: [
      { id: '01.averzian', name: 'Imperator Averzian', nickname: 'Averzian', encounterId: 2733, maps: [{ name: 'Arena', slug: 'main' }, { name: 'Alt', slug: 'alt' }] },
      { id: '02.vorasius', name: 'Vorasius', nickname: 'Vorasius', encounterId: 2734, maps: [{ name: 'Arena', slug: 'main' }, { name: 'Alt', slug: 'alt' }] },
      { id: '03.salhadaar', name: 'Fallen-King Salhadaar', nickname: 'Salhadaar', encounterId: 2736, maps: [{ name: 'Arena', slug: 'main' }, { name: 'Alt', slug: 'alt' }] },
      { id: '04.dragons', name: 'Vaelgor & Ezzorak', nickname: 'Dragons', encounterId: 2735, maps: [{ name: 'Arena', slug: 'main' }, { name: 'Alt', slug: 'alt' }] },
      { id: '05.vanguard', name: 'Lightblinded Vanguard', nickname: 'Vanguard', encounterId: 2737, maps: [{ name: 'Arena', slug: 'main' }, { name: 'Alt', slug: 'alt' }] },
      { id: '06.crown', name: 'Crown of the Cosmos', nickname: 'Crown', encounterId: 2738, maps: [{ name: 'Arena', slug: 'main' }] },
    ],
  },
  {
    id: 'wow.marchonqueldanas', name: "March on Quel'Danas",
    bosses: [
      { id: '01.beloren', name: "Belo'ren, Child of Al'ar", nickname: "Belo'ren", encounterId: 2739, maps: [{ name: 'Full Room', slug: 'full' }, { name: 'Center', slug: 'center' }, { name: 'Top', slug: 'top' }] },
      { id: '02.midnightfalls', name: 'Midnight Falls', nickname: 'Midnight Falls', encounterId: 2740, maps: [{ name: 'Arena', slug: 'main' }] },
    ],
  },
  {
    id: 'wow.dreamrift', name: 'The Dreamrift',
    bosses: [
      { id: '01.chimaerus', name: 'Chimaerus the Undreamt God', nickname: 'Chimaerus', encounterId: 2795, maps: [{ name: 'Platform', slug: 'main' }] },
    ],
  },
]

function getMapUrl(raidId: string, bossId: string, mapSlug: string) {
  return `${CDN}/${raidId}/map/${bossId}-${mapSlug}.jpg`
}
function getBossIconUrl(raidId: string, bossId: string) {
  return `${CDN}/${raidId}/icon/${bossId}.jpg`
}

// ── Tools & types ────────────────────────────────────────────────────────────

type ToolType = 'select' | 'tank' | 'healer' | 'melee' | 'ranged' | 'boss' | 'text' | 'arrow' | 'circle' | 'ability'

const ROLE_COLORS: Record<string, string> = {
  tank: '#3B82F6', healer: '#22C55E', melee: '#EF4444', ranged: '#F59E0B',
  boss: '#DC2626', text: '#E5E7EB', arrow: '#E5E7EB', circle: '#E5E7EB',
}

interface PlanItem {
  id: string
  type: 'marker' | 'boss' | 'text' | 'arrow' | 'circle' | 'ability'
  x: number; y: number
  x2?: number; y2?: number // end point for arrow
  radius?: number // for circle
  label: string
  color: string
  role?: string
  iconUrl?: string // for ability items
  iconName?: string
  spellId?: number
}

let _id = 1
const uid = () => `p${_id++}`

// ── Icons ────────────────────────────────────────────────────────────────────

function RoleIcon({ role, size = 14 }: { role: string; size?: number }) {
  switch (role) {
    case 'tank':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>)
    case 'healer':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" /></svg>)
    case 'melee':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /></svg>)
    case 'ranged':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v18" /><path d="M6 3c6 0 10 4 10 9s-4 9-10 9" /><path d="M10 12h12" /><path d="M18 8l4 4-4 4" /></svg>)
    case 'boss':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a4 4 0 0 0-4 4c0 1.1.45 2.1 1.17 2.83L6 12l-4 2 3 1-3 1 3 1-3 1 5-2 4 4 4-4 5 2-3-1 3-1-3-1 3-1-4-2-3.17-3.17A4 4 0 0 0 16 6a4 4 0 0 0-4-4zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" /></svg>)
    default: return null
  }
}

const TOOLS: { id: ToolType; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'tank', label: 'Tank', icon: '' },
  { id: 'healer', label: 'Heal', icon: '' },
  { id: 'melee', label: 'Melee', icon: '' },
  { id: 'ranged', label: 'Range', icon: '' },
  { id: 'boss', label: 'Boss', icon: '' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'arrow', label: 'Arrow', icon: '→' },
  { id: 'circle', label: 'Zone', icon: '◯' },
]

// ── Component ────────────────────────────────────────────────────────────────

export function RaidPlannerPage() {
  const active = useCharacterStore(s => s.getActive())
  const [searchParams, setSearchParams] = useSearchParams()
  const [raidIdx, setRaidIdx] = useState(0)
  const [bossIdx, setBossIdx] = useState(0)
  const [mapIdx, setMapIdx] = useState(0)
  const [phaseItems, setPhaseItems] = useState<Record<number, PlanItem[]>>({ 0: [] })
  const [activePhase, setActivePhase] = useState(0)
  const [phases, setPhases] = useState<string[]>(['P1'])
  const [tool, setTool] = useState<ToolType>('tank')
  const [dragging, setDragging] = useState<string | null>(null)
  const [drawing, setDrawing] = useState<{ startX: number; startY: number } | null>(null)
  const [previewEnd, setPreviewEnd] = useState<{ x: number; y: number } | null>(null)
  const [labelInput, setLabelInput] = useState('')
  const [pendingTextPos, setPendingTextPos] = useState<{ x: number; y: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawColor, setDrawColor] = useState('#E5E7EB')
  const [selectedAbility, setSelectedAbility] = useState<Ability | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)

  const raid = RAIDS[raidIdx]
  const boss = raid.bosses[bossIdx]
  const mapDef = boss.maps[mapIdx]
  const mapUrl = getMapUrl(raid.id, boss.id, mapDef.slug)

  // Derived items for the active phase
  const items = phaseItems[activePhase] ?? []
  const setItems = useCallback((updater: PlanItem[] | ((prev: PlanItem[]) => PlanItem[])) => {
    setPhaseItems(prev => {
      const current = prev[activePhase] ?? []
      const next = typeof updater === 'function' ? updater(current) : updater
      return { ...prev, [activePhase]: next }
    })
  }, [activePhase])

  // ── Undo/Redo history (per-phase) ──────────────────────────────────────────
  const historyRef = useRef<Record<number, PlanItem[][]>>({ 0: [[]] })
  const historyIndexRef = useRef<Record<number, number>>({ 0: 0 })

  const pushHistory = useCallback((newItems: PlanItem[]) => {
    const phase = activePhase
    const h = historyRef.current[phase] ?? [[]]
    const idx = historyIndexRef.current[phase] ?? 0
    // Discard any future entries after current index
    const trimmed = h.slice(0, idx + 1)
    trimmed.push(JSON.parse(JSON.stringify(newItems)))
    // Cap at 50 entries
    if (trimmed.length > 50) {
      historyRef.current[phase] = trimmed.slice(trimmed.length - 50)
    } else {
      historyRef.current[phase] = trimmed
    }
    historyIndexRef.current[phase] = historyRef.current[phase].length - 1
  }, [activePhase])

  /** Wrapper around setItems that also records history */
  const updateItems = useCallback((updater: PlanItem[] | ((prev: PlanItem[]) => PlanItem[])) => {
    setPhaseItems(prev => {
      const current = prev[activePhase] ?? []
      const next = typeof updater === 'function' ? updater(current) : updater
      pushHistory(next)
      return { ...prev, [activePhase]: next }
    })
  }, [pushHistory, activePhase])

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const refreshUndoRedo = useCallback(() => {
    const idx = historyIndexRef.current[activePhase] ?? 0
    const h = historyRef.current[activePhase] ?? [[]]
    setCanUndo(idx > 0)
    setCanRedo(idx < h.length - 1)
  }, [activePhase])

  const undo = useCallback(() => {
    const phase = activePhase
    const idx = historyIndexRef.current[phase] ?? 0
    if (idx <= 0) return
    historyIndexRef.current[phase] = idx - 1
    const snapshot = JSON.parse(JSON.stringify(historyRef.current[phase][idx - 1]))
    setPhaseItems(prev => ({ ...prev, [phase]: snapshot }))
    refreshUndoRedo()
  }, [activePhase, refreshUndoRedo])

  const redo = useCallback(() => {
    const phase = activePhase
    const idx = historyIndexRef.current[phase] ?? 0
    const h = historyRef.current[phase] ?? [[]]
    if (idx >= h.length - 1) return
    historyIndexRef.current[phase] = idx + 1
    const snapshot = JSON.parse(JSON.stringify(h[idx + 1]))
    setPhaseItems(prev => ({ ...prev, [phase]: snapshot }))
    refreshUndoRedo()
  }, [activePhase, refreshUndoRedo])

  // Keep undo/redo button state in sync after every updateItems call or phase switch
  useEffect(() => { refreshUndoRedo() }, [items, activePhase, refreshUndoRedo])

  // ── Export as image ─────────────────────────────────────────────────────────
  const exportAsImage = useCallback(() => {
    const mapEl = mapRef.current
    if (!mapEl) return
    const imgEl = mapEl.querySelector('img') as HTMLImageElement | null
    if (!imgEl) return

    const canvas = document.createElement('canvas')
    const naturalW = imgEl.naturalWidth || imgEl.width
    const naturalH = imgEl.naturalHeight || imgEl.height
    canvas.width = naturalW
    canvas.height = naturalH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw the map background
    ctx.drawImage(imgEl, 0, 0, naturalW, naturalH)

    // Draw circles
    items.filter(i => i.type === 'circle').forEach(item => {
      const cx = (item.x / 100) * naturalW
      const cy = (item.y / 100) * naturalH
      const rx = ((item.radius ?? 5) / 100) * naturalW
      const ry = ((item.radius ?? 5) / 100) * naturalH
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = item.color + '30'
      ctx.fill()
      ctx.strokeStyle = item.color
      ctx.lineWidth = 2
      ctx.stroke()
    })

    // Draw arrows
    items.filter(i => i.type === 'arrow').forEach(item => {
      const x1 = (item.x / 100) * naturalW
      const y1 = (item.y / 100) * naturalH
      const x2 = ((item.x2 ?? item.x) / 100) * naturalW
      const y2 = ((item.y2 ?? item.y) / 100) * naturalH
      ctx.strokeStyle = item.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      // Arrowhead
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const headLen = 14
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
      ctx.closePath()
      ctx.fillStyle = item.color
      ctx.fill()
    })

    // Draw text items
    items.filter(i => i.type === 'text').forEach(item => {
      const x = (item.x / 100) * naturalW
      const y = (item.y / 100) * naturalH
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 4
      ctx.fillStyle = item.color
      ctx.fillText(item.label, x, y)
      ctx.shadowBlur = 0
    })

    // Draw markers (roles + boss)
    items.filter(i => i.type === 'marker' || i.type === 'boss').forEach(item => {
      const x = (item.x / 100) * naturalW
      const y = (item.y / 100) * naturalH
      const r = item.type === 'boss' ? 18 : 14
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = item.color
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
      // Label below
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 3
      ctx.fillStyle = '#ffffff'
      ctx.fillText(item.label, x, y + r + 3)
      ctx.shadowBlur = 0
    })

    // Draw ability items
    items.filter(i => i.type === 'ability').forEach(item => {
      const x = (item.x / 100) * naturalW
      const y = (item.y / 100) * naturalH
      const r = 16
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = '#7C3AED'
      ctx.fill()
      ctx.strokeStyle = 'rgba(168,85,247,0.6)'
      ctx.lineWidth = 2
      ctx.stroke()
      // Label below
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 3
      ctx.fillStyle = '#C4B5FD'
      ctx.fillText(item.label.slice(0, 12), x, y + r + 2)
      ctx.shadowBlur = 0
    })

    // Download
    const link = document.createElement('a')
    link.download = `plan-${boss.nickname}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [items, boss.nickname])

  const [abilities, setAbilities] = useState<Ability[]>([])
  const [abilitiesLoading, setAbilitiesLoading] = useState(false)

  // ── Real-time collaboration ──────────────────────────────────────────────────
  const [collabUsers, setCollabUsers] = useState(0)
  const [remoteCursors, setRemoteCursors] = useState<Map<string, PlanCursor>>(new Map())
  const collabRef = useRef<ReturnType<typeof joinPlanRoom> | null>(null)
  const isRemoteUpdate = useRef(false)
  const user = useAuthStore((s) => s.user)
  const userName = user?.battle_tag ?? active?.name ?? 'Unknown'

  // Random color for this user's cursor
  const myColorRef = useRef('#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0'))

  // ── Save / Load plans ────────────────────────────────────────────────────────
  const [savedPlans, setSavedPlans] = useState<Array<{ id: string; title: string }>>([])
  const [activePlanId, setActivePlanId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadPlanList = useCallback(() => {
    api.getRaidPlans(raid.id, boss.id)
      .then(plans => setSavedPlans(plans.map((p: any) => ({ id: p.id, title: p.title }))))
      .catch(() => {})
  }, [raid.id, boss.id])

  const savePlan = useCallback(async () => {
    setSaving(true)
    try {
      const saveData = { items_json: phaseItems, map_slug: mapDef.slug, phases }
      if (activePlanId) {
        await api.updateRaidPlan(activePlanId, saveData)
        toast.success('Plan sauvegardé')
      } else {
        const title = `${boss.nickname} — ${new Date().toLocaleDateString('fr-FR')}`
        const plan = await api.createRaidPlan({ raid_id: raid.id, boss_id: boss.id, map_slug: mapDef.slug, title, items_json: phaseItems, phases })
        setActivePlanId(plan.id)
        toast.success('Plan créé')
        loadPlanList()
      }
    } catch {
      toast.error('Échec de la sauvegarde')
    } finally { setSaving(false) }
  }, [activePlanId, phaseItems, phases, mapDef.slug, boss.id, boss.nickname, raid.id, loadPlanList])

  const loadPlan = useCallback(async (planId: string, silent = false) => {
    try {
      const plan = await api.getRaidPlan(planId)

      // Switch to the correct raid/boss if needed
      const ri = RAIDS.findIndex(r => r.id === plan.raid_id)
      if (ri >= 0 && ri !== raidIdx) setRaidIdx(ri)
      const bi = (ri >= 0 ? RAIDS[ri] : raid).bosses.findIndex(b => b.id === plan.boss_id)
      if (bi >= 0 && bi !== bossIdx) setBossIdx(bi)

      // Support both old format (PlanItem[]) and new format (Record<number, PlanItem[]>)
      const loadedItems: Record<number, PlanItem[]> = Array.isArray(plan.items_json)
        ? { 0: plan.items_json }
        : (plan.items_json ?? { 0: [] })
      const loadedPhases: string[] = plan.phases ?? ['P1']
      setPhaseItems(loadedItems)
      setPhases(loadedPhases)
      setActivePhase(0)
      setActivePlanId(planId)
      const targetBoss = (ri >= 0 ? RAIDS[ri] : raid).bosses[bi >= 0 ? bi : 0]
      setMapIdx(targetBoss?.maps.findIndex(m => m.slug === plan.map_slug) ?? 0)
      // Reset history for all phases
      const newHistory: Record<number, PlanItem[][]> = {}
      const newHistoryIdx: Record<number, number> = {}
      loadedPhases.forEach((_, i) => {
        newHistory[i] = [loadedItems[i] ?? []]
        newHistoryIdx[i] = 0
      })
      historyRef.current = newHistory
      historyIndexRef.current = newHistoryIdx
      if (!silent) toast.info(`Plan "${plan.title}" chargé`)
    } catch { if (!silent) toast.error('Échec du chargement') }
  }, [boss.maps, raid, raidIdx, bossIdx])

  // Auto-load plan from URL ?plan=xxx
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (initialLoadDone.current) return
    const planId = searchParams.get('plan')
    if (planId) {
      initialLoadDone.current = true
      loadPlan(planId)
      // Clean up URL
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, loadPlan, setSearchParams])

  const copyPlanLink = useCallback(() => {
    if (!activePlanId) return
    const url = `${window.location.origin}/raid?tab=planner&plan=${activePlanId}`
    navigator.clipboard.writeText(url).then(
      () => toast.success('Lien copié !'),
      () => toast.error('Impossible de copier'),
    )
  }, [activePlanId])

  const deletePlan = useCallback(async (planId: string) => {
    try {
      await api.deleteRaidPlan(planId)
      if (activePlanId === planId) setActivePlanId(null)
      loadPlanList()
      toast.success('Plan supprimé')
    } catch { toast.error('Échec de la suppression') }
  }, [activePlanId, loadPlanList])

  // ── Import Roster from Raid Events ─────────────────────────────────────────
  const [rosterDropdownOpen, setRosterDropdownOpen] = useState(false)
  const [rosterEvents, setRosterEvents] = useState<any[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const rosterRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!rosterDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (rosterRef.current && !rosterRef.current.contains(e.target as Node)) setRosterDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [rosterDropdownOpen])

  const openRosterDropdown = useCallback(async () => {
    if (!active?.guild || !active?.guildRealm) {
      toast.error('Aucune guilde associée au personnage actif')
      return
    }
    setRosterDropdownOpen(prev => !prev)
    if (rosterEvents.length > 0) return // already loaded
    setRosterLoading(true)
    try {
      const events = await api.getGuildEvents(active.guildRealm, active.guild, active.region)
      setRosterEvents(events)
    } catch {
      toast.error('Impossible de charger les événements')
    } finally { setRosterLoading(false) }
  }, [active, rosterEvents.length])

  const importRoster = useCallback(async (eventId: string) => {
    if (!active?.guild || !active?.guildRealm) return
    setRosterDropdownOpen(false)
    try {
      const event = await api.getGuildEvent(active.guildRealm, active.guild, eventId, active.region)
      const signups: any[] = event.signups ?? event.roster ?? []
      const present = signups.filter((s: any) => s.status === 'present')
      if (present.length === 0) {
        toast.info('Aucun joueur avec le statut "present"')
        return
      }

      const tanks = present.filter((s: any) => s.role === 'tank')
      const healers = present.filter((s: any) => s.role === 'healer')
      const dps = present.filter((s: any) => s.role === 'dps')

      const newItems: PlanItem[] = []

      // Tanks: row near top-center (y=20%)
      tanks.forEach((s: any, i: number) => {
        const spacing = 80 / Math.max(tanks.length, 1)
        const x = 10 + spacing * i + spacing / 2
        newItems.push({
          id: uid(), type: 'marker', x, y: 20,
          label: s.character_name, color: ROLE_COLORS.tank, role: 'tank',
        })
      })

      // Healers: row in the middle-back (y=35%)
      healers.forEach((s: any, i: number) => {
        const spacing = 60 / Math.max(healers.length, 1)
        const x = 20 + spacing * i + spacing / 2
        newItems.push({
          id: uid(), type: 'marker', x, y: 35,
          label: s.character_name, color: ROLE_COLORS.healer, role: 'healer',
        })
      })

      // DPS: semi-circle in front of boss (y=55-70%)
      dps.forEach((s: any, i: number) => {
        const angle = Math.PI * (i / Math.max(dps.length - 1, 1))
        const cx = 50
        const cy = 62
        const rx = 25
        const ry = 12
        const x = dps.length === 1 ? cx : cx - rx * Math.cos(angle)
        const y = dps.length === 1 ? cy : cy + ry * Math.sin(angle)
        const role = 'melee' // default dps to melee
        newItems.push({
          id: uid(), type: 'marker', x, y,
          label: s.character_name, color: ROLE_COLORS[role], role,
        })
      })

      updateItems(prev => [...prev, ...newItems])
      toast.success(`${present.length} joueurs importés`)
    } catch {
      toast.error("Échec de l'import du roster")
    }
  }, [active, updateItems])

  useEffect(() => {
    setPhaseItems({ 0: [] }); setPhases(['P1']); setActivePhase(0); setMapIdx(0); setSelectedId(null); setActivePlanId(null)
    historyRef.current = { 0: [[]] }; historyIndexRef.current = { 0: 0 }; loadPlanList()
    // Disconnect collab on boss change
    if (collabRef.current) { collabRef.current.leave(); collabRef.current = null; setCollabUsers(0); setRemoteCursors(new Map()) }
  }, [raidIdx, bossIdx, loadPlanList])

  // Join/leave collab room when activePlanId changes
  useEffect(() => {
    if (collabRef.current) { collabRef.current.leave(); collabRef.current = null; setCollabUsers(0); setRemoteCursors(new Map()) }
    if (!activePlanId) return

    const collab = joinPlanRoom(activePlanId, userName, {
      onUpdate: (phase, remoteItems) => {
        isRemoteUpdate.current = true
        setPhaseItems(prev => ({ ...prev, [phase]: remoteItems }))
        setTimeout(() => { isRemoteUpdate.current = false }, 50)
      },
      onCursor: (cursor) => {
        setRemoteCursors(prev => { const next = new Map(prev); next.set(cursor.userName, cursor); return next })
      },
      onUserJoined: (name, count) => {
        setCollabUsers(count)
        toast.info(`${name} a rejoint le plan`)
      },
      onUserLeft: (name, count) => {
        setCollabUsers(count)
        setRemoteCursors(prev => { const next = new Map(prev); next.delete(name); return next })
      },
    })
    collabRef.current = collab

    return () => { collab.leave(); collabRef.current = null }
  }, [activePlanId, userName])

  // Broadcast local changes to collab (skip if change came from remote)
  useEffect(() => {
    if (!collabRef.current || isRemoteUpdate.current) return
    collabRef.current.sendUpdate(activePhase, items)
  }, [items, activePhase])

  // Send cursor position on mouse move over map
  const handleCollabCursor = useCallback((e: React.MouseEvent) => {
    if (!collabRef.current || !mapRef.current) return
    const rect = mapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    collabRef.current.sendCursor(x, y, myColorRef.current)
  }, [])

  // Refresh wowhead tooltips when dynamic content changes
  const refreshWowhead = useCallback(() => {
    setTimeout(() => {
      if (typeof (window as any).$WowheadPower !== 'undefined') {
        (window as any).$WowheadPower.refreshLinks()
      }
    }, 100)
  }, [])

  // Fetch boss abilities
  useEffect(() => {
    setAbilities([])
    setAbilitiesLoading(true)
    api.getEncounterAbilities(boss.encounterId)
      .then(data => { setAbilities(data.abilities); refreshWowhead() })
      .catch(() => {})
      .finally(() => setAbilitiesLoading(false))
  }, [boss.encounterId, refreshWowhead])

  // Refresh tooltips when items change (ability placed on map)
  useEffect(() => {
    if (items.some(i => i.type === 'ability')) refreshWowhead()
  }, [items, refreshWowhead])

  // ── Phase management ──────────────────────────────────────────────────────
  const addPhase = useCallback((copyFromCurrent = false) => {
    if (phases.length >= 5) return
    const newIdx = phases.length
    const newPhaseName = `P${newIdx + 1}`
    const newPhaseItems = copyFromCurrent
      ? JSON.parse(JSON.stringify(phaseItems[activePhase] ?? []))
      : []
    setPhases(prev => [...prev, newPhaseName])
    setPhaseItems(prev => ({ ...prev, [newIdx]: newPhaseItems }))
    historyRef.current[newIdx] = [JSON.parse(JSON.stringify(newPhaseItems))]
    historyIndexRef.current[newIdx] = 0
    setActivePhase(newIdx)
    setSelectedId(null)
  }, [phases, phaseItems, activePhase])

  const removePhase = useCallback((phaseIdx: number) => {
    if (phases.length <= 1) return
    const newPhases = phases.filter((_, i) => i !== phaseIdx)
    // Rebuild phaseItems with re-indexed keys
    const newPhaseItems: Record<number, PlanItem[]> = {}
    const newHistory: Record<number, PlanItem[][]> = {}
    const newHistoryIdx: Record<number, number> = {}
    let j = 0
    for (let i = 0; i < phases.length; i++) {
      if (i === phaseIdx) continue
      newPhaseItems[j] = phaseItems[i] ?? []
      newHistory[j] = historyRef.current[i] ?? [[]]
      newHistoryIdx[j] = historyIndexRef.current[i] ?? 0
      j++
    }
    setPhases(newPhases)
    setPhaseItems(newPhaseItems)
    historyRef.current = newHistory
    historyIndexRef.current = newHistoryIdx
    const switchTo = phaseIdx > 0 ? phaseIdx - 1 : 0
    setActivePhase(switchTo)
    setSelectedId(null)
  }, [phases, phaseItems])

  // ── Position helpers ───────────────────────────────────────────────────────

  const getPos = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!mapRef.current) return null
    const rect = mapRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }, [])

  // ── Map click ──────────────────────────────────────────────────────────────

  const handleMapClick = useCallback((e: React.MouseEvent) => {
    if (dragging) return
    const pos = getPos(e)
    if (!pos) return

    if (tool === 'select') {
      setSelectedId(null)
      return
    }

    // Ability tool
    if (tool === 'ability' && selectedAbility) {
      updateItems(prev => [...prev, {
        id: uid(), type: 'ability',
        x: pos.x, y: pos.y,
        label: selectedAbility.name,
        color: '#A855F7',
        iconUrl: selectedAbility.iconUrl,
        iconName: selectedAbility.iconName,
        spellId: selectedAbility.id,
      }])
      return
    }

    // Marker tools (roles + boss)
    if (['tank', 'healer', 'melee', 'ranged', 'boss'].includes(tool)) {
      const role = tool
      const count = items.filter(i => i.role === role).length + 1
      const defaultLabel = tool === 'boss' ? boss.nickname : `${tool.charAt(0).toUpperCase() + tool.slice(1)} ${count}`
      updateItems(prev => [...prev, {
        id: uid(), type: tool === 'boss' ? 'boss' : 'marker',
        x: pos.x, y: pos.y,
        label: labelInput.trim() || defaultLabel,
        color: ROLE_COLORS[role], role,
      }])
      setLabelInput('')
      return
    }

    // Text tool
    if (tool === 'text') {
      setPendingTextPos(pos)
      setTimeout(() => textInputRef.current?.focus(), 50)
      return
    }

    // Arrow / Circle — start drawing
    if (tool === 'arrow' || tool === 'circle') {
      if (!drawing) {
        setDrawing({ startX: pos.x, startY: pos.y })
        setPreviewEnd(pos)
      } else {
        // Finish
        if (tool === 'arrow') {
          updateItems(prev => [...prev, {
            id: uid(), type: 'arrow',
            x: drawing.startX, y: drawing.startY,
            x2: pos.x, y2: pos.y,
            label: '', color: drawColor,
          }])
        } else {
          const dx = pos.x - drawing.startX
          const dy = pos.y - drawing.startY
          const radius = Math.sqrt(dx * dx + dy * dy)
          updateItems(prev => [...prev, {
            id: uid(), type: 'circle',
            x: drawing.startX, y: drawing.startY,
            radius, label: '', color: drawColor,
          }])
        }
        setDrawing(null)
        setPreviewEnd(null)
      }
    }
  }, [dragging, tool, items, boss.nickname, drawing, labelInput, getPos, drawColor, updateItems])

  // ── Text submit ────────────────────────────────────────────────────────────

  const submitText = () => {
    if (!pendingTextPos || !labelInput.trim()) { setPendingTextPos(null); return }
    updateItems(prev => [...prev, {
      id: uid(), type: 'text',
      x: pendingTextPos.x, y: pendingTextPos.y,
      label: labelInput.trim(), color: drawColor,
    }])
    setPendingTextPos(null)
    setLabelInput('')
  }

  // ── Drag (DOM-direct for performance) ───────────────────────────────────────

  const dragRef = useRef<{ id: string; x: number; y: number; el: HTMLElement | null; raf: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation()
    if (tool === 'select' || ['tank', 'healer', 'melee', 'ranged', 'boss', 'text', 'ability'].includes(tool)) {
      const el = (e.currentTarget as HTMLElement)
      const pos = getPos(e)
      dragRef.current = { id, x: pos?.x ?? 0, y: pos?.y ?? 0, el, raf: 0 }
      el.style.transition = 'none'
      setDragging(id)
      setSelectedId(id)
    }
  }, [tool, getPos])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d || !mapRef.current) return
      const rect = mapRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
      d.x = x; d.y = y
      if (d.raf) return
      d.raf = requestAnimationFrame(() => {
        if (d.el) { d.el.style.left = `${d.x}%`; d.el.style.top = `${d.y}%` }
        d.raf = 0
      })
    }
    const onUp = () => {
      const d = dragRef.current
      if (d) {
        if (d.raf) cancelAnimationFrame(d.raf)
        if (d.el) d.el.style.transition = ''
        updateItems(prev => prev.map(m => m.id === d.id ? { ...m, x: d.x, y: d.y } : m))
        dragRef.current = null
      }
      setDragging(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  // Preview for arrow/circle while drawing (RAF-throttled)
  const previewRaf = useRef(0)
  useEffect(() => {
    if (!drawing) return
    const onMove = (e: MouseEvent) => {
      if (previewRaf.current) return
      previewRaf.current = requestAnimationFrame(() => {
        const pos = getPos(e)
        if (pos) setPreviewEnd(pos)
        previewRaf.current = 0
      })
    }
    window.addEventListener('mousemove', onMove)
    return () => { window.removeEventListener('mousemove', onMove); if (previewRaf.current) cancelAnimationFrame(previewRaf.current) }
  }, [drawing, getPos])

  // Escape / Delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawing(null); setPreviewEnd(null); setPendingTextPos(null); setSelectedId(null) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !pendingTextPos) {
        updateItems(prev => prev.filter(i => i.id !== selectedId))
        setSelectedId(null)
      }
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'Z' && e.shiftKey) || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, pendingTextPos, undo, redo, updateItems])

  const removeItem = (id: string) => {
    updateItems(prev => prev.filter(i => i.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // ── Cursor ─────────────────────────────────────────────────────────────────

  const cursor = tool === 'select' ? (dragging ? 'grabbing' : 'default')
    : drawing ? 'crosshair'
    : 'crosshair'

  // ── Group items for sidebar ────────────────────────────────────────────────

  const markerItems = items.filter(i => i.type === 'marker' || i.type === 'boss')
  const drawItems = items.filter(i => i.type === 'arrow' || i.type === 'circle' || i.type === 'text')

  return (
    <div className="flex flex-col lg:flex-row gap-3 lg:min-h-0" style={{ height: 'auto', minHeight: '400px' }}>
      {/* ── Left: toolbar + map ── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Top bar: boss select + tools */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Select value={raidIdx} onChange={(e) => { setRaidIdx(Number(e.target.value)); setBossIdx(0) }}
            className="!py-1 !text-xs !w-auto">
            {RAIDS.map((r, i) => <option key={r.id} value={i}>{r.name}</option>)}
          </Select>
          <Select value={bossIdx} onChange={(e) => setBossIdx(Number(e.target.value))}
            className="!py-1 !text-xs !w-auto">
            {raid.bosses.map((b, i) => <option key={b.id} value={i}>{b.nickname}</option>)}
          </Select>
          {boss.maps.length > 1 && (
            <Select value={mapIdx} onChange={(e) => setMapIdx(Number(e.target.value))}
              className="!py-1 !text-xs !w-auto">
              {boss.maps.map((m, i) => <option key={m.slug} value={i}>{m.name}</option>)}
            </Select>
          )}

          <div className="h-5 w-px bg-white/[0.08] mx-1" />

          {/* Tool buttons */}
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTool(t.id); setDrawing(null); setPreviewEnd(null) }}
              title={t.label}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all',
                tool === t.id
                  ? 'border-[color:var(--class-color)]/40 bg-[color:var(--class-color)]/10 text-white'
                  : 'border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/[0.12]',
              )}
            >
              {['tank', 'healer', 'melee', 'ranged', 'boss'].includes(t.id) ? (
                <span style={{ color: ROLE_COLORS[t.id] }}><RoleIcon role={t.id} size={12} /></span>
              ) : (
                <span className="text-xs leading-none">{t.icon}</span>
              )}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}

          <div className="h-5 w-px bg-white/[0.08] mx-1" />

          {/* Undo / Redo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all',
              canUndo
                ? 'border-white/[0.06] text-gray-400 hover:text-gray-200 hover:border-white/[0.12]'
                : 'border-white/[0.04] text-gray-700 cursor-not-allowed',
            )}
          >
            <span className="text-xs leading-none">↩</span>
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all',
              canRedo
                ? 'border-white/[0.06] text-gray-400 hover:text-gray-200 hover:border-white/[0.12]'
                : 'border-white/[0.04] text-gray-700 cursor-not-allowed',
            )}
          >
            <span className="text-xs leading-none">↪</span>
            <span className="hidden sm:inline">Redo</span>
          </button>

          {/* Export */}
          <button
            onClick={exportAsImage}
            title="Export as PNG"
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all border-white/[0.06] text-gray-400 hover:text-gray-200 hover:border-white/[0.12]"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Save */}
          <button
            onClick={savePlan}
            disabled={saving || Object.values(phaseItems).every(p => p.length === 0)}
            title={activePlanId ? 'Sauvegarder' : 'Créer un plan'}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all border-white/[0.06] text-gray-400 hover:text-green-400 hover:border-green-400/20 disabled:opacity-40 disabled:pointer-events-none"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span className="hidden sm:inline">{saving ? '...' : 'Save'}</span>
          </button>

          {/* Share link */}
          {activePlanId && (
            <button
              onClick={copyPlanLink}
              title="Copier le lien du plan"
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all border-white/[0.06] text-gray-400 hover:text-[color:var(--class-color)] hover:border-[color:var(--class-color)]/20"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              <span className="hidden sm:inline">Partager</span>
            </button>
          )}

          {/* Import Roster */}
          <div className="relative" ref={rosterRef}>
            <button
              onClick={openRosterDropdown}
              title="Importer un roster depuis un événement"
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all border-white/[0.06] text-gray-400 hover:text-purple-400 hover:border-purple-400/20"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span className="hidden sm:inline">Import Roster</span>
            </button>
            {rosterDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-60 overflow-y-auto rounded-lg border border-white/[0.08] bg-[#1a1a2e] shadow-xl">
                {rosterLoading ? (
                  <div className="p-3 text-xs text-gray-500 text-center">Chargement...</div>
                ) : rosterEvents.length === 0 ? (
                  <div className="p-3 text-xs text-gray-500 text-center">Aucun événement trouvé</div>
                ) : (
                  rosterEvents.map((ev: any) => (
                    <button
                      key={ev.id}
                      onClick={() => importRoster(ev.id)}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-b-0"
                    >
                      <div className="font-medium truncate">{ev.title || ev.name || `Event ${ev.id}`}</div>
                      {ev.date && <div className="text-[10px] text-gray-500 mt-0.5">{new Date(ev.date).toLocaleDateString('fr-FR')}</div>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Shortcuts hint */}
          <div className="hidden lg:flex items-center gap-2 ml-auto text-[9px] text-gray-700">
            <span><kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">Click</kbd> place</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">Drag</kbd> move</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">Del</kbd> suppr</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">Esc</kbd> annuler</span>
          </div>

          {/* Draw color picker for arrow/circle/text */}
          {(tool === 'arrow' || tool === 'circle' || tool === 'text') && (
            <>
              <div className="h-5 w-px bg-white/[0.08] mx-1" />
              {['#E5E7EB', '#EF4444', '#22C55E', '#3B82F6', '#F59E0B', '#A855F7', '#EC4899'].map(c => (
                <button key={c} onClick={() => setDrawColor(c)}
                  className={cn('w-5 h-5 rounded-full border-2 transition-all', drawColor === c ? 'border-white scale-110' : 'border-white/20')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </>
          )}
        </div>

        {/* Text input — only when text tool active or pending */}
        {(tool === 'text' || pendingTextPos) && (
          <div className="flex items-center gap-2 mb-2">
            <input
              ref={textInputRef}
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && pendingTextPos) submitText() }}
              placeholder={pendingTextPos ? 'Type text and press Enter...' : 'Click map to place text'}
              className="flex-1 px-2.5 py-1 text-xs bg-wow-darker border border-white/[0.08] rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[color:var(--class-color)]/40"
            />
            {pendingTextPos && (
              <button onClick={submitText} className="px-3 py-1 text-xs rounded bg-[color:var(--class-color)]/20 text-[color:var(--class-color)] border border-[color:var(--class-color)]/30 hover:bg-[color:var(--class-color)]/30">
                Place
              </button>
            )}
          </div>
        )}
        {/* Clear all */}
        {items.length > 0 && !(tool === 'text' || pendingTextPos) && (
          <div className="flex justify-end mb-1">
            <button onClick={() => { updateItems([]); setSelectedId(null) }}
              className="px-2 py-0.5 text-[10px] text-gray-600 hover:text-red-400 transition-colors">
              Clear all
            </button>
          </div>
        )}

        {/* Map */}
        <Card className="p-0 overflow-hidden flex-1 min-h-0 relative flex flex-col">
          <div className="flex items-center gap-2.5 px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
            <img src={getBossIconUrl(raid.id, boss.id)} alt="" className="w-7 h-7 rounded border border-white/[0.1]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{boss.name}</p>
              <p className="text-[9px] text-gray-500">{raid.name} — {mapDef.name}</p>
            </div>
            {collabUsers > 1 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] text-green-400 font-medium">{collabUsers} en ligne</span>
              </div>
            )}
          </div>
          {/* Phase tabs */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.06] flex-shrink-0">
            {phases.map((phaseName, idx) => (
              <div key={idx} className="flex items-center">
                <button
                  onClick={() => { setActivePhase(idx); setSelectedId(null) }}
                  className={cn(
                    'px-2.5 py-1 rounded text-[10px] font-semibold border transition-all',
                    activePhase === idx
                      ? 'border-[color:var(--class-color)]/40 bg-[color:var(--class-color)]/15 text-[color:var(--class-color)]'
                      : 'border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/[0.12]',
                  )}
                >
                  {phaseName}
                </button>
                {phases.length > 1 && activePhase === idx && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removePhase(idx) }}
                    title={`Remove ${phaseName}`}
                    className="ml-0.5 px-1 py-1 text-[9px] text-gray-600 hover:text-red-400 transition-colors"
                  >
                    &#10005;
                  </button>
                )}
              </div>
            ))}
            {phases.length < 5 && (
              <>
                <button
                  onClick={() => addPhase(false)}
                  title="Add empty phase"
                  className="px-1.5 py-1 rounded text-[10px] font-medium border border-dashed border-white/[0.1] text-gray-600 hover:text-gray-300 hover:border-white/[0.2] transition-all"
                >
                  +
                </button>
                <button
                  onClick={() => addPhase(true)}
                  title={`Copy from ${phases[activePhase]}`}
                  className="px-2 py-1 rounded text-[9px] font-medium border border-dashed border-white/[0.1] text-gray-600 hover:text-gray-300 hover:border-white/[0.2] transition-all"
                >
                  + Copy {phases[activePhase]}
                </button>
              </>
            )}
          </div>
          <div
            ref={mapRef}
            className="relative w-full flex-1 min-h-0 select-none overflow-hidden"
            style={{ cursor }}
            onClick={handleMapClick}
            onMouseMove={handleCollabCursor}
          >
            <img
              src={mapUrl}
              alt={`${boss.name} map`}
              className="w-full h-full object-contain block"
              draggable={false}
            />

            {/* SVG overlay for arrows, circles */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
                </marker>
              </defs>
              {/* Circles */}
              {items.filter(i => i.type === 'circle').map(item => (
                <ellipse
                  key={item.id}
                  cx={`${item.x}%`} cy={`${item.y}%`}
                  rx={`${item.radius ?? 5}%`} ry={`${item.radius ?? 5}%`}
                  fill={item.color + '20'}
                  stroke={item.color}
                  strokeWidth={2}
                  strokeDasharray={selectedId === item.id ? '6 3' : 'none'}
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setSelectedId(item.id) }}
                />
              ))}
              {/* Arrows */}
              {items.filter(i => i.type === 'arrow').map(item => (
                <line
                  key={item.id}
                  x1={`${item.x}%`} y1={`${item.y}%`}
                  x2={`${item.x2}%`} y2={`${item.y2}%`}
                  stroke={item.color}
                  strokeWidth={selectedId === item.id ? 3 : 2.5}
                  markerEnd="url(#arrowhead)"
                  style={{ color: item.color }}
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setSelectedId(item.id) }}
                />
              ))}
              {/* Preview while drawing */}
              {drawing && previewEnd && tool === 'arrow' && (
                <line
                  x1={`${drawing.startX}%`} y1={`${drawing.startY}%`}
                  x2={`${previewEnd.x}%`} y2={`${previewEnd.y}%`}
                  stroke={drawColor} strokeWidth={2} strokeDasharray="6 3" opacity={0.6}
                  markerEnd="url(#arrowhead)" style={{ color: drawColor }}
                />
              )}
              {drawing && previewEnd && tool === 'circle' && (() => {
                const dx = previewEnd.x - drawing.startX
                const dy = previewEnd.y - drawing.startY
                const r = Math.sqrt(dx * dx + dy * dy)
                return (
                  <ellipse
                    cx={`${drawing.startX}%`} cy={`${drawing.startY}%`}
                    rx={`${r}%`} ry={`${r}%`}
                    fill={drawColor + '15'} stroke={drawColor} strokeWidth={2} strokeDasharray="6 3" opacity={0.6}
                  />
                )
              })()}
            </svg>

            {/* Text items */}
            {items.filter(i => i.type === 'text').map(item => (
              <div
                key={item.id}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 z-10 px-2 py-0.5 rounded cursor-grab whitespace-nowrap',
                  selectedId === item.id && !dragging ? 'ring-1 ring-white/50' : '',
                )}
                style={{ left: `${item.x}%`, top: `${item.y}%`, color: item.color, willChange: dragging === item.id ? 'left, top' : undefined }}
                onMouseDown={(e) => handleMouseDown(e, item.id)}
                onClick={(e) => { e.stopPropagation(); setSelectedId(item.id) }}
              >
                <span className="text-sm font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{item.label}</span>
              </div>
            ))}

            {/* Marker / Boss items */}
            {items.filter(i => i.type === 'marker' || i.type === 'boss').map(item => (
              <div
                key={item.id}
                className={cn(
                  'absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 z-10',
                  !dragging && 'hover:scale-105 transition-transform duration-75',
                  selectedId === item.id && !dragging ? 'scale-110' : '',
                )}
                style={{ left: `${item.x}%`, top: `${item.y}%`, willChange: dragging === item.id ? 'left, top' : undefined }}
                onMouseDown={(e) => handleMouseDown(e, item.id)}
                onClick={(e) => { e.stopPropagation(); setSelectedId(item.id) }}
              >
                <div
                  className={cn(
                    'rounded-full border-2 shadow-lg shadow-black/50 flex items-center justify-center text-white cursor-grab active:cursor-grabbing',
                    item.type === 'boss' ? 'w-9 h-9 border-red-400/80' : 'w-7 h-7 border-white/80',
                    selectedId === item.id && 'ring-2 ring-white/40',
                  )}
                  style={{ backgroundColor: item.color }}
                >
                  <RoleIcon role={item.role ?? 'boss'} size={item.type === 'boss' ? 18 : 14} />
                </div>
                <span className="text-[9px] font-medium text-white bg-black/70 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap pointer-events-none max-w-[80px] truncate">
                  {item.label}
                </span>
              </div>
            ))}

            {/* Ability items */}
            {items.filter(i => i.type === 'ability').map(item => (
              <div
                key={item.id}
                className={cn(
                  'absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 z-10',
                  !dragging && 'hover:scale-110 transition-transform duration-75',
                  selectedId === item.id && !dragging ? 'scale-110' : '',
                )}
                style={{ left: `${item.x}%`, top: `${item.y}%`, willChange: dragging === item.id ? 'left, top' : undefined }}
                onMouseDown={(e) => handleMouseDown(e, item.id)}
                onClick={(e) => { e.stopPropagation(); setSelectedId(item.id) }}
              >
                <a
                  href={item.spellId ? `https://www.wowhead.com/spell=${item.spellId}` : undefined}
                  data-wowhead={item.spellId ? `spell=${item.spellId}` : undefined}
                  onClick={(e) => e.preventDefault()}
                  className={cn(
                    'w-8 h-8 rounded border-2 shadow-lg shadow-black/50 overflow-hidden cursor-grab active:cursor-grabbing block',
                    selectedId === item.id ? 'border-purple-400 ring-2 ring-purple-400/30' : 'border-purple-500/60',
                  )}
                >
                  {item.iconUrl ? (
                    <img src={item.iconUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                  ) : (
                    <div className="w-full h-full bg-purple-900/50 flex items-center justify-center text-[8px] text-purple-300 font-bold">
                      {item.label.charAt(0)}
                    </div>
                  )}
                </a>
                <span className="text-[8px] font-medium text-purple-300 bg-black/70 px-1 py-0.5 rounded mt-0.5 whitespace-nowrap pointer-events-none max-w-[70px] truncate">
                  {item.label}
                </span>
              </div>
            ))}

            {/* Remote cursors */}
            {[...remoteCursors.values()].map(c => (
              <div
                key={c.userName}
                className="absolute z-30 pointer-events-none -translate-x-1 -translate-y-1 transition-all duration-100"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill={c.color}>
                  <path d="M0 0l5 14 2.5-5.5L14 6z" />
                </svg>
                <span className="text-[8px] font-medium px-1 py-0.5 rounded ml-2 whitespace-nowrap" style={{ backgroundColor: c.color, color: '#000' }}>
                  {c.userName}
                </span>
              </div>
            ))}

            {/* Pending text placement indicator */}
            {pendingTextPos && (
              <div className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 border-2 rounded-full animate-pulse z-20"
                style={{ left: `${pendingTextPos.x}%`, top: `${pendingTextPos.y}%`, borderColor: drawColor }}
              />
            )}
          </div>
        </Card>
      </div>

      {/* ── Right sidebar ── */}
      <div className="w-full lg:w-56 flex-shrink-0 flex flex-col gap-2" style={{ maxHeight: 'calc(100vh - 160px)' }}>
        {/* Markers list */}
        {markerItems.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-white/[0.06]">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">Players & Boss</p>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {markerItems.map(item => (
                <div key={item.id}
                  className={cn('flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors',
                    selectedId === item.id ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]')}
                  onClick={() => setSelectedId(item.id)}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: item.color }}>
                    <RoleIcon role={item.role ?? 'boss'} size={10} />
                  </div>
                  <span className="text-[11px] text-gray-300 truncate flex-1">{item.label}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
                    className="text-[9px] text-gray-700 hover:text-red-400 transition-colors flex-shrink-0">&#10005;</button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Draw items list */}
        {drawItems.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-white/[0.06]">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">Annotations</p>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {drawItems.map(item => (
                <div key={item.id}
                  className={cn('flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors',
                    selectedId === item.id ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]')}
                  onClick={() => setSelectedId(item.id)}>
                  <span className="text-[10px] w-4 text-center flex-shrink-0" style={{ color: item.color }}>
                    {item.type === 'arrow' ? '→' : item.type === 'circle' ? '◯' : 'T'}
                  </span>
                  <span className="text-[11px] text-gray-300 truncate flex-1">
                    {item.label || (item.type === 'arrow' ? 'Arrow' : item.type === 'circle' ? 'Zone' : 'Text')}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
                    className="text-[9px] text-gray-700 hover:text-red-400 transition-colors flex-shrink-0">&#10005;</button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Saved plans */}
        {savedPlans.length > 0 && (
          <Card className="p-0 flex-shrink-0">
            <div className="px-3 py-1.5 border-b border-white/[0.06]">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">Plans sauvegardés</p>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {savedPlans.map(plan => (
                <div key={plan.id}
                  className={cn('flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors',
                    activePlanId === plan.id ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]')}
                  onClick={() => loadPlan(plan.id)}>
                  <span className="text-[10px] text-gray-300 truncate flex-1">{plan.title}</span>
                  <button onClick={(e) => { e.stopPropagation(); deletePlan(plan.id) }}
                    className="text-[9px] text-gray-700 hover:text-red-400 transition-colors flex-shrink-0">&#10005;</button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Boss abilities — fills remaining space */}
        <Card className="p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="px-3 py-1.5 border-b border-white/[0.06]">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">Boss Abilities</p>
          </div>
          {abilitiesLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
            </div>
          ) : abilities.length === 0 ? (
            <p className="text-[9px] text-gray-600 text-center py-3">No abilities found</p>
          ) : (
            <div className="overflow-y-auto flex-1 min-h-0 divide-y divide-white/[0.03]">
              {abilities.map(ab => (
                <div
                  key={ab.id}
                  onClick={(e) => { e.preventDefault(); setTool('ability'); setSelectedAbility(ab) }}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-1.5 w-full text-left transition-colors cursor-pointer',
                    tool === 'ability' && selectedAbility?.id === ab.id
                      ? 'bg-purple-500/10'
                      : 'hover:bg-white/[0.03]',
                  )}
                >
                  <a
                    href={`https://www.wowhead.com/spell=${ab.id}`}
                    data-wowhead={`spell=${ab.id}`}
                    onClick={(e) => e.preventDefault()}
                    className="flex items-center gap-2 min-w-0"
                  >
                    {ab.iconUrl ? (
                      <img src={ab.iconUrl} alt="" className="w-5 h-5 rounded border border-white/[0.1] flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-purple-900/30 border border-white/[0.1] flex-shrink-0" />
                    )}
                    <span className={cn('text-[10px] truncate', tool === 'ability' && selectedAbility?.id === ab.id ? 'text-purple-300' : 'text-gray-400')}>
                      {ab.name}
                    </span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}
