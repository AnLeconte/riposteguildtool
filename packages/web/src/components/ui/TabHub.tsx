import { ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface TabHubProps {
  tabs: Tab[]
  defaultTab?: string
  rightContent?: ReactNode
}

export function TabHub({ tabs, defaultTab, rightContent }: TabHubProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '')
  const active = tabs.find((t) => t.id === activeTab)

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06]">
        <div className="flex gap-0.5 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all',
                activeTab === tab.id
                  ? 'text-[color:var(--class-color)] border-[color:var(--class-color)]'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-white/[0.1]',
              )}>
              {tab.label}
            </button>
          ))}
        </div>
        {rightContent}
      </div>

      {/* Content */}
      <div className="animate-fade-in" key={activeTab}>
        {active?.content}
      </div>
    </div>
  )
}
