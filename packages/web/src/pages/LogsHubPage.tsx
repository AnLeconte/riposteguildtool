import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import { WarcraftLogsPage } from '@/pages/WarcraftLogsPage'
import { LogComparatorPage } from '@/pages/LogComparatorPage'

const TABS = [
  { id: 'logs', label: 'Logs' },
  { id: 'compare', label: 'Compare' },
]

export function LogsHubPage() {
  const [tab, setTab] = useState('logs')

  return (
    <div className="w-full space-y-4">
      <PageHeader title="Warcraft" highlight="Logs" description="Browse, analyze, and compare your raid logs" />
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
        {tab === 'logs' && <WarcraftLogsPage />}
        {tab === 'compare' && <LogComparatorPage />}
      </div>
    </div>
  )
}
