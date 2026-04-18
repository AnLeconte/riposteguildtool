import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-wow-darker disabled:pointer-events-none disabled:opacity-40',
          {
            'text-wow-darker active:scale-[0.98]':
              variant === 'primary',
            'bg-white/[0.06] text-gray-200 hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/[0.15]':
              variant === 'secondary',
            'text-gray-400 hover:text-white hover:bg-white/[0.06]':
              variant === 'ghost',
          },
          {
            'h-8 px-3 text-xs gap-1.5': size === 'sm',
            'h-10 px-5 text-sm gap-2': size === 'md',
            'h-12 px-7 text-sm gap-2': size === 'lg',
          },
          className,
        )}
        style={variant === 'primary' ? {
          backgroundColor: 'var(--class-color)',
          boxShadow: '0 0 10px var(--class-color-20)',
          ...style,
        } : style}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
