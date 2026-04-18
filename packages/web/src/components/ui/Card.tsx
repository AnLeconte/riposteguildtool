import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-white/[0.06] bg-wow-panel/80 backdrop-blur-sm p-6 shadow-inner-glow',
        className,
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'
