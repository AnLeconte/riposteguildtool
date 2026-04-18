import { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <div className="text-center py-16 space-y-4">
        <p className="text-4xl text-gray-700">{icon}</p>
        <div>
          <p className="text-gray-400 font-medium">{title}</p>
          {description && <p className="text-gray-600 text-sm mt-1">{description}</p>}
        </div>
        {action}
      </div>
    </Card>
  )
}
