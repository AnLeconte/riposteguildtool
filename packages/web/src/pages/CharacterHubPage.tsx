import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import { CharacterProfilePage } from '@/pages/CharacterProfilePage'
import { CharacterComparePage } from '@/pages/CharacterComparePage'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'compare', label: 'Compare' },
]

export function CharacterHubPage() {
  const [tab, setTab] = useState('profile')

  return (
    <div className="w-full space-y-4">
      <PageHeader title="Character" highlight="Hub" description="Inspect and compare characters" />
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
        {tab === 'profile' && <CharacterProfilePage />}
        {tab === 'compare' && <CharacterComparePage />}
      </div>
    </div>
  )
}
