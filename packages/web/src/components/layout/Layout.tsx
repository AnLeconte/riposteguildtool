import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { api } from '@/lib/api'
import { CharacterSwitcher } from '@/components/layout/CharacterSwitcher'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Ctrl + K', desc: 'Recherche' },
  { keys: 'Ctrl + 1..9', desc: 'Changer de personnage' },
  { keys: 'Ctrl + Z', desc: 'Annuler (Planner)' },
  { keys: 'Ctrl + Y', desc: 'Refaire (Planner)' },
  { keys: 'Del', desc: "Supprimer l'élément sélectionné" },
  { keys: 'Esc', desc: "Annuler l'action" },
  { keys: '?', desc: 'Raccourcis clavier' },
]

// Route → lazy module mapping for prefetch on hover
const ROUTE_MODULES: Record<string, () => Promise<unknown>> = {
  '/quick-sim': () => import('@/pages/QuickSimPage'),
  '/top-gear': () => import('@/pages/TopGearPage'),
  '/droptimizer': () => import('@/pages/DroptimizerPage'),
  '/gear-compare': () => import('@/pages/GearComparePage'),
  '/raid': () => import('@/pages/RaidHubPage'),
  '/logs': () => import('@/pages/LogsHubPage'),
  '/character': () => import('@/pages/CharacterHubPage'),
  '/mplus': () => import('@/pages/MplusHubPage'),
  '/guild': () => import('@/pages/GuildHubPage'),
  '/macros': () => import('@/pages/MacroLibraryPage'),
  '/gm': () => import('@/pages/GmDashboardPage'),
  '/sim': () => import('@/pages/ResultPage'),
}
const prefetched = new Set<string>()

interface NavItem { label: string; path: string; desc?: string }
interface NavGroup { label: string; items: NavItem[] }

const DROPDOWNS: NavGroup[] = [
  {
    label: 'Simulate',
    items: [
      { label: 'Quick Sim', path: '/quick-sim', desc: 'DPS check' },
      { label: 'Top Gear', path: '/top-gear', desc: 'Best bag combo' },
      { label: 'Droptimizer', path: '/droptimizer', desc: 'Upgrade finder' },
      { label: 'Gear Compare', path: '/gear-compare', desc: 'A vs B' },
    ],
  },
  {
    label: 'Raid',
    items: [
      { label: 'Planner', path: '/raid?tab=planner', desc: 'Maps & phases' },
      { label: 'Signups', path: '/raid?tab=signup', desc: 'Inscriptions' },
      { label: 'Notes', path: '/raid?tab=notes', desc: 'Notes de raid' },
      { label: 'CD Planner', path: '/raid?tab=cd-planner', desc: 'Cooldowns healers' },
      { label: 'Comp Analyzer', path: '/raid?tab=comp', desc: 'Buffs & utilities' },
    ],
  },
  {
    label: 'Guild',
    items: [
      { label: 'Roster', path: '/guild', desc: 'Membres' },
      { label: 'Leaderboard', path: '/guild?tab=leaderboard', desc: 'Classements' },
      { label: 'Logs', path: '/logs', desc: 'WCL reports' },
      { label: 'Calendar', path: '/raid?tab=calendar', desc: 'Vue mensuelle' },
    ],
  },
]

const NAV_LINKS: NavItem[] = [
  { label: 'Perso', path: '/character' },
  { label: 'GM', path: '/gm' },
]

function prefetchRoute(path: string) {
  const base = path.split('?')[0]
  if (prefetched.has(base)) return
  const loader = ROUTE_MODULES[base]
  if (loader) {
    prefetched.add(base)
    loader()
  }
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => { logout(); navigate('/') }
  const isActive = (path: string) => {
    const [p, qs] = path.split('?')
    if (location.pathname !== p && !location.pathname.startsWith(p + '/')) return false
    if (!qs) return true
    // Check query params match
    const params = new URLSearchParams(qs)
    const current = new URLSearchParams(location.search)
    for (const [key, val] of params) {
      if (current.get(key) !== val) return false
    }
    return true
  }
  const isGroupActive = (group: NavGroup) => group.items.some((i) => {
    const [p] = i.path.split('?')
    return location.pathname === p || location.pathname.startsWith(p + '/')
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setOpenMenu(null); setMobileOpen(false) }, [location.pathname])

  // Ctrl+1..9 to switch characters
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return
      const num = parseInt(e.key, 10)
      if (num < 1 || num > 9 || isNaN(num)) return

      const { characters, setActive } = useCharacterStore.getState()
      const target = characters[num - 1]
      if (!target) return

      e.preventDefault()
      setActive(target.id)
      toast.info(`Switched to ${target.name}`)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // "?" key opens shortcuts modal (when not in an input/textarea)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        setShortcutsOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const authed = isAuthenticated()

  // Minimal layout for unauthenticated users
  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 px-6 lg:px-10">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
        <div className="px-4 lg:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/riposte-logo.jpg" alt="Riposte" className="w-8 h-8 rounded-lg border border-white/[0.1] group-hover:border-[color:var(--class-color)]/40 transition-all" />
            <span className="text-white font-bold text-base tracking-tight hidden sm:inline">
              Riposte<span className="text-[color:var(--class-color)]">Guild</span>Tool
            </span>
          </Link>

          {/* Desktop */}
          <nav ref={navRef} className="hidden lg:flex items-center gap-1 ml-8">
            {DROPDOWNS.map((group) => {
              const active = isGroupActive(group)
              const open = openMenu === group.label
              return (
                <div key={group.label} className="relative">
                  <button onClick={() => setOpenMenu(open ? null : group.label)}
                    className={cn('px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-1.5',
                      active ? 'text-[color:var(--class-color)]' : 'text-gray-500 hover:text-gray-300')}>
                    {group.label}
                    <svg className={cn('w-2.5 h-2.5 transition-transform', open && 'rotate-180')}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {open && (
                    <div className="absolute top-full left-0 mt-2 w-52 py-1 rounded-xl border border-white/[0.08] bg-wow-panel/95 backdrop-blur-xl shadow-xl shadow-black/40 animate-fade-in-down z-50">
                      {group.items.map((item) => (
                        <Link key={item.path} to={item.path}
                          onMouseEnter={() => prefetchRoute(item.path)}
                          className={cn('flex items-center justify-between px-4 py-2 transition-colors',
                            isActive(item.path) ? 'text-[color:var(--class-color)] bg-[color:var(--class-color-10)]' : 'text-gray-300 hover:text-white hover:bg-white/[0.04]')}>
                          <span className="text-[13px] font-medium">{item.label}</span>
                          {item.desc && <span className="text-[10px] text-gray-600">{item.desc}</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Direct hub links */}
            {NAV_LINKS.map((item) => (
              <Link key={item.path} to={item.path}
                onMouseEnter={() => prefetchRoute(item.path)}
                className={cn('px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all',
                  isActive(item.path) ? 'text-[color:var(--class-color)]' : 'text-gray-500 hover:text-gray-300')}>
                {item.label}
              </Link>
            ))}

            <div className="flex-1" />

            {/* Ctrl+K hint */}
            <button onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-white/[0.12] transition-colors mr-2">
              <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-[11px] text-gray-600">Search</span>
              <kbd className="text-[9px] text-gray-700 bg-white/[0.04] border border-white/[0.08] px-1 py-0.5 rounded">Ctrl K</kbd>
            </button>

            {/* Shortcuts hint */}
            <button
              onClick={() => setShortcutsOpen(true)}
              className="w-7 h-7 rounded-lg border border-white/[0.06] hover:border-white/[0.12] transition-colors flex items-center justify-center mr-1"
              title="Raccourcis clavier"
            >
              <span className="text-[11px] font-bold text-gray-600">?</span>
            </button>

            <CharacterSwitcher />
            <NotificationBell />

            <div className="w-px h-4 bg-white/[0.06] mx-2" />

            {isAuthenticated() ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-gray-500">{user?.battle_tag ?? 'Connected'}</span>
                {user?.discord_id ? (
                  <span className="text-[10px] text-indigo-400" title="Discord linked">Discord linked</span>
                ) : (
                  <button
                    onClick={() => {
                      api.getDiscordAuthUrl().then(({ url }) => {
                        window.location.href = url
                      }).catch(() => {})
                    }}
                    className="text-[10px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                    title="Link your Discord account"
                  >Link Discord</button>
                )}
                <button onClick={handleLogout} className="text-[12px] text-gray-600 hover:text-red-400 transition-colors">Logout</button>
              </div>
            ) : (
              <Link to="/login" className="text-[12px] text-[color:var(--class-color)]/80 hover:text-[color:var(--class-color)] transition-colors font-medium">Sign In</Link>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button className="lg:hidden flex flex-col gap-1.5 p-3 min-w-[44px] min-h-[44px] items-center justify-center" onClick={() => setMobileOpen(!mobileOpen)}>
            <span className={cn('block w-5 h-0.5 bg-gray-400 transition-all', mobileOpen && 'rotate-45 translate-y-[4px]')} />
            <span className={cn('block w-5 h-0.5 bg-gray-400 transition-all', mobileOpen && 'opacity-0')} />
            <span className={cn('block w-5 h-0.5 bg-gray-400 transition-all', mobileOpen && '-rotate-45 -translate-y-[4px]')} />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-white/[0.06] animate-fade-in-down">
            <nav className="px-4 py-3 flex flex-col gap-1">
              {DROPDOWNS.map((group, gi) => (
                <div key={group.label}>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">{group.label}</p>
                  {group.items.map((item) => (
                    <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                      className={cn('px-3 py-2.5 rounded-lg text-sm font-medium transition-colors block',
                        isActive(item.path) ? 'text-[color:var(--class-color)] bg-[color:var(--class-color-10)]' : 'text-gray-400 hover:text-gray-200')}>
                      {item.label}
                    </Link>
                  ))}
                  {gi < DROPDOWNS.length - 1 && <div className="h-px bg-white/[0.06] my-2" />}
                </div>
              ))}
              <div className="h-px bg-white/[0.06] my-2" />
              {NAV_LINKS.map((item) => (
                <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                  className={cn('px-3 py-2.5 rounded-lg text-sm font-medium transition-colors block',
                    isActive(item.path) ? 'text-[color:var(--class-color)] bg-[color:var(--class-color-10)]' : 'text-gray-400 hover:text-gray-200')}>
                  {item.label}
                </Link>
              ))}
              <div className="h-px bg-white/[0.06] my-2" />
              {isAuthenticated() ? (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-500">{user?.battle_tag ?? 'Connected'}</span>
                  <button onClick={() => { handleLogout(); setMobileOpen(false) }} className="text-sm text-red-400">Logout</button>
                </div>
              ) : (
                <Link to="/login" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 text-sm text-[color:var(--class-color)] font-medium">Sign In</Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 w-full px-6 lg:px-10 py-8">
        <Breadcrumbs />
        {children}
      </main>

      <footer className="border-t border-white/[0.04] py-6">
        <div className="px-6 lg:px-10 flex items-center justify-between">
          <span className="text-gray-600 text-xs">Riposte Guild Tool — Not affiliated with Blizzard Entertainment</span>
          <span className="text-gray-700 text-xs">Powered by SimulationCraft</span>
        </div>
      </footer>

      {/* Keyboard shortcuts modal */}
      <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="Raccourcis clavier">
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 pt-1">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="contents">
              <kbd className="text-xs text-gray-300 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-0.5 font-mono whitespace-nowrap text-center">
                {s.keys}
              </kbd>
              <span className="text-xs text-gray-400 self-center">{s.desc}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
