import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  highlight?: string
  description?: string
  actions?: ReactNode
}

/**
 * Consistent page header used across all pages.
 */
export function PageHeader({ title, highlight, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {title}{highlight && <> <span className="text-[color:var(--class-color)]">{highlight}</span></>}
        </h1>
        {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
