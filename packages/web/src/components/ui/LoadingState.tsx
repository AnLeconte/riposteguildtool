import { Card } from '@/components/ui/Card'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <Card>
      <div className="text-center py-12 space-y-3">
        <div className="w-6 h-6 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">{message}</p>
      </div>
    </Card>
  )
}
