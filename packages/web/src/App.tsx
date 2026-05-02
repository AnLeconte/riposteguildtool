import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CommandPalette } from './components/layout/CommandPalette'
import { ToastContainer } from './components/ui/Toast'
import { Onboarding } from './components/ui/Onboarding'
import { useAuthStore } from './stores/useAuthStore'
import { useClassTheme } from './hooks/useClassTheme'

// Eager — needed immediately
import { LandingPage } from './pages/LandingPage'
import { ApplyPage } from './pages/ApplyPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { NotFoundPage } from './pages/NotFoundPage'

// Lazy — loaded on demand
const QuickSimPage = lazy(() => import('./pages/QuickSimPage').then(m => ({ default: m.QuickSimPage })))
const TopGearPage = lazy(() => import('./pages/TopGearPage').then(m => ({ default: m.TopGearPage })))
const StatWeightsPage = lazy(() => import('./pages/StatWeightsPage').then(m => ({ default: m.StatWeightsPage })))
const DroptimizerPage = lazy(() => import('./pages/DroptimizerPage').then(m => ({ default: m.DroptimizerPage })))
const GearComparePage = lazy(() => import('./pages/GearComparePage').then(m => ({ default: m.GearComparePage })))
const AdvancedPage = lazy(() => import('./pages/AdvancedPage').then(m => ({ default: m.AdvancedPage })))
const ResultPage = lazy(() => import('./pages/ResultPage').then(m => ({ default: m.ResultPage })))
const RaidHubPage = lazy(() => import('./pages/RaidHubPage').then(m => ({ default: m.RaidHubPage })))
const LogsHubPage = lazy(() => import('./pages/LogsHubPage').then(m => ({ default: m.LogsHubPage })))
const CharacterHubPage = lazy(() => import('./pages/CharacterHubPage').then(m => ({ default: m.CharacterHubPage })))
const MplusHubPage = lazy(() => import('./pages/MplusHubPage').then(m => ({ default: m.MplusHubPage })))
const GuildHubPage = lazy(() => import('./pages/GuildHubPage').then(m => ({ default: m.GuildHubPage })))
const MacroLibraryPage = lazy(() => import('./pages/MacroLibraryPage').then(m => ({ default: m.MacroLibraryPage })))
const PlayerProfilePage = lazy(() => import('./pages/PlayerProfilePage').then(m => ({ default: m.PlayerProfilePage })))
const GmDashboardPage = lazy(() => import('./pages/GmDashboardPage').then(m => ({ default: m.GmDashboardPage })))

function PageSkeleton() {
  return (
    <div className="w-full py-6 space-y-4 animate-fade-in">
      <div className="h-8 w-48 rounded-lg bg-white/[0.04] animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" style={{ animationDelay: `${i * 75}ms` }} />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-white/[0.03] animate-pulse" style={{ animationDelay: '150ms' }} />
    </div>
  )
}

function AuthenticatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-fade-in">
      <Suspense fallback={<PageSkeleton />}>
      <Routes location={location}>
        <Route path="/" element={<HomePage />} />
        {/* Simulations */}
        <Route path="/quick-sim" element={<QuickSimPage />} />
        <Route path="/top-gear" element={<TopGearPage />} />
        <Route path="/stat-weights" element={<StatWeightsPage />} />
        <Route path="/droptimizer" element={<DroptimizerPage />} />
        <Route path="/gear-compare" element={<GearComparePage />} />
        <Route path="/advanced" element={<AdvancedPage />} />
        <Route path="/sim/:id" element={<ResultPage />} />
        {/* Hubs */}
        <Route path="/raid" element={<RaidHubPage />} />
        <Route path="/logs" element={<LogsHubPage />} />
        <Route path="/character" element={<CharacterHubPage />} />
        <Route path="/mplus" element={<MplusHubPage />} />
        <Route path="/guild" element={<GuildHubPage />} />
        {/* Standalone */}
        <Route path="/gm" element={<GmDashboardPage />} />
        <Route path="/macros" element={<MacroLibraryPage />} />
        <Route path="/player/:name" element={<PlayerProfilePage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        {/* Redirects from old routes to hubs */}
        <Route path="/cooldown-planner" element={<Navigate to="/raid" replace />} />
        <Route path="/assignments" element={<Navigate to="/raid" replace />} />
        <Route path="/raid-notes" element={<Navigate to="/raid" replace />} />
        <Route path="/roster" element={<Navigate to="/raid" replace />} />
        <Route path="/comp-analyzer" element={<Navigate to="/raid" replace />} />
        <Route path="/loot-prio" element={<Navigate to="/raid" replace />} />
        <Route path="/warcraft-logs" element={<Navigate to="/logs" replace />} />
        <Route path="/log-compare" element={<Navigate to="/logs" replace />} />
        <Route path="/char-compare" element={<Navigate to="/character" replace />} />
        <Route path="/mplus-goal" element={<Navigate to="/mplus" replace />} />
        <Route path="/dungeon-notes" element={<Navigate to="/mplus" replace />} />
        <Route path="/keystones" element={<Navigate to="/mplus" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </div>
  )
}

function PublicRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-fade-in">
      <Routes location={location}>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </div>
  )
}

function NeedsDiscordRoutes() {
  const location = useLocation()
  // Allow callback routes to work
  if (location.pathname === '/auth/callback' || location.search.includes('discord_linked')) {
    return (
      <div key={location.pathname} className="animate-fade-in">
        <Routes location={location}>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </div>
    )
  }
  return <DiscordRequiredPage />
}

function DiscordRequiredPage() {
  return (
    <div className="max-w-md mx-auto mt-16 text-center space-y-6 animate-fade-in-up">
      <div className="w-14 h-14 rounded-2xl bg-[#5865F2]/20 flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-white">Link your Discord</h1>
      <p className="text-sm text-gray-400">You need to link your Discord account to use Riposte Guild Tool.</p>
      <button
        onClick={() => {
          import('@/lib/api').then(({ api }) => {
            api.getDiscordAuthUrl().then(({ url }) => { window.location.href = url }).catch(() => {})
          })
        }}
        className="px-6 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm transition-colors"
      >
        Link Discord Account
      </button>
    </div>
  )
}

export function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const user = useAuthStore((s) => s.user)
  useClassTheme()
  const needsDiscord = isAuthenticated && !user?.discord_id

  return (
    <ErrorBoundary>
      <Layout>
        {!isAuthenticated ? (
          <PublicRoutes />
        ) : needsDiscord ? (
          <NeedsDiscordRoutes />
        ) : (
          <AuthenticatedRoutes />
        )}
      </Layout>
      {isAuthenticated && !needsDiscord && <CommandPalette />}
      {isAuthenticated && !needsDiscord && <Onboarding />}
      <ToastContainer />
    </ErrorBoundary>
  )
}
