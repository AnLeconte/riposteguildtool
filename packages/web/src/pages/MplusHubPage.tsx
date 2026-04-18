import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import { MplusGoalPage } from '@/pages/MplusGoalPage'
import { DungeonNotesPage } from '@/pages/DungeonNotesPage'
import { KeystoneTrackerPage } from '@/pages/KeystoneTrackerPage'

const TABS = [
  { id: 'goal', label: 'Score Goal' },
  { id: 'dungeons', label: 'Dungeon Notes' },
  { id: 'keystones', label: 'Keystones' },
]

export function MplusHubPage() {
  const [tab, setTab] = useState('goal')

  return (
    <div className="w-full space-y-4">
      <PageHeader title="Mythic" highlight="+" description="Track your M+ score, keys, and dungeon strategies" />
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
        {tab === 'goal' && <MplusGoalPage />}
        {tab === 'dungeons' && <DungeonNotesPage />}
        {tab === 'keystones' && <KeystoneTrackerPage />}
      </div>
    </div>
  )
}
