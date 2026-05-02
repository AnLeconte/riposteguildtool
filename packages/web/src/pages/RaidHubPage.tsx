import { useState, useEffect, lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { CooldownPlannerPage } from '@/pages/CooldownPlannerPage'
import { RaidAssignmentsPage } from '@/pages/RaidAssignmentsPage'
import { RaidNotesPage } from '@/pages/RaidNotesPage'
import { RosterPlannerPage } from '@/pages/RosterPlannerPage'
import { CompAnalyzerPage } from '@/pages/CompAnalyzerPage'
import { LootPrioPage } from '@/pages/LootPrioPage'
import { RaidSignupPage } from '@/pages/RaidSignupPage'
import { RaidPlannerPage } from '@/pages/RaidPlannerPage'

const RaidCalendarPage = lazy(() => import('./RaidCalendarPage').then(m => ({ default: m.RaidCalendarPage })))

const TABS = [
  { id: 'signup', label: 'Signups' },
  { id: 'calendar', label: 'Calendrier' },
  { id: 'planner', label: 'Planner' },
  { id: 'cd-planner', label: 'CD Planner' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'notes', label: 'Notes' },
  { id: 'roster', label: 'Roster' },
  { id: 'comp', label: 'Comp' },
  { id: 'loot', label: 'Loot Prio' },
]

export function RaidHubPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'signup')

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && t !== tab) setTab(t)
  }, [searchParams])

  return (
    <div className="w-full space-y-4">
      <PageHeader title="Raid" highlight="Hub" description="All your raid planning tools in one place" />
      <div className="border-b border-white/[0.06]">
        <div className="flex gap-0.5 -mb-px overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all',
                tab === t.id ? 'text-[color:var(--class-color)] border-[color:var(--class-color)]' : 'text-gray-500 border-transparent hover:text-gray-300')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div key={tab} className="animate-fade-in">
        {tab === 'signup' && <RaidSignupPage />}
        {tab === 'calendar' && (
          <Suspense fallback={
            <Card>
              <div className="text-center py-12 space-y-2">
                <div className="w-6 h-6 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" />
                <p className="text-gray-500 text-sm">Loading...</p>
              </div>
            </Card>
          }>
            <RaidCalendarPage />
          </Suspense>
        )}
        {tab === 'planner' && <RaidPlannerPage />}
        {tab === 'cd-planner' && <CooldownPlannerPage />}
        {tab === 'assignments' && <RaidAssignmentsPage />}
        {tab === 'notes' && <RaidNotesPage />}
        {tab === 'roster' && <RosterPlannerPage />}
        {tab === 'comp' && <CompAnalyzerPage />}
        {tab === 'loot' && <LootPrioPage />}
      </div>
    </div>
  )
}
