import { TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg bg-wow-darker/80 border border-white/[0.08] px-3.5 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-wow-gold/30 focus:border-[color:var(--class-color)]/40 hover:border-white/[0.12] font-mono resize-y',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
