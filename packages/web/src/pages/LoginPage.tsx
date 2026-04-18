import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

export function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setError(null)
    setLoading(true)
    try {
      const { url, state } = await api.getBnetAuthUrl()
      // Store state for CSRF validation on callback
      sessionStorage.setItem('bnet_oauth_state', state)
      // Redirect to Battle.net
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start authentication')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 animate-fade-in-up">
      <div className="text-center mb-8 space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-wow-gold to-amber-600 flex items-center justify-center mx-auto shadow-gold-md">
          <span className="text-wow-darker font-black text-xl">R</span>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Riposte<span className="text-[color:var(--class-color)]">Guild</span><span className="text-gray-500 font-normal">Tool</span>
        </h1>
        <p className="text-gray-500 text-sm">
          Sign in with your Battle.net account to access all features
        </p>
      </div>

      <Card className="p-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <Button
          onClick={handleLogin}
          className="w-full"
          size="lg"
          disabled={loading}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 64 64" fill="currentColor">
            <path d="M32 0C14.327 0 0 14.327 0 32s14.327 32 32 32 32-14.327 32-32S49.673 0 32 0zm0 5.818c14.46 0 26.182 11.722 26.182 26.182S46.46 58.182 32 58.182 5.818 46.46 5.818 32 17.54 5.818 32 5.818zm-6.4 13.091l-4.364 12.8h5.237l-2.618 11.2 9.6-14.4h-5.818l3.636-9.6H25.6z"/>
          </svg>
          {loading ? 'Redirecting...' : 'Login with Battle.net'}
        </Button>

        <p className="text-[10px] text-gray-600 text-center mt-4">
          You will be redirected to Battle.net to authenticate.
          We only access your BattleTag and WoW profile.
        </p>
      </Card>
    </div>
  )
}
