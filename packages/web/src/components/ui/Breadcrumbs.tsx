import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const PATH_NAMES: Record<string, string> = {
  '/': 'Home',
  '/raid': 'Raid Hub',
  '/character': 'Character',
  '/guild': 'Guild',
  '/mplus': 'M+',
  '/logs': 'Logs',
  '/quick-sim': 'Quick Sim',
  '/top-gear': 'Top Gear',
  '/droptimizer': 'Droptimizer',
  '/stat-weights': 'Stat Weights',
  '/gear-compare': 'Gear Compare',
  '/advanced': 'Advanced',
  '/macros': 'Macros',
}

function resolveName(segment: string, fullPath: string): string {
  // Check full path first (handles multi-word routes like /quick-sim)
  if (PATH_NAMES[fullPath]) return PATH_NAMES[fullPath]
  // /sim/:id → "Simulation"
  if (fullPath.startsWith('/sim')) return segment === 'sim' ? 'Simulation' : 'Simulation'
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  if (pathname === '/') return null

  const segments = pathname.split('/').filter(Boolean)
  const crumbs = [{ label: 'Home', path: '/' }]

  let accumulated = ''
  for (const seg of segments) {
    accumulated += '/' + seg
    crumbs.push({ label: resolveName(seg, accumulated), path: accumulated })
  }

  return (
    <nav className="flex items-center gap-1.5 mb-3" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.path} className="flex items-center gap-1.5">
            {i > 0 && (
              <svg className="w-2.5 h-2.5 text-gray-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
            {isLast ? (
              <span className="text-[10px] text-gray-300 font-medium">{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors font-medium">
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
