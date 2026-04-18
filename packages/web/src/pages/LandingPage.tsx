import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

interface DiscordMember {
  id: string
  username: string
  status: string
  avatar_url?: string
}

function DiscordWidget() {
  const [members, setMembers] = useState<DiscordMember[]>([])
  const [count, setCount] = useState(0)
  const [guildName, setGuildName] = useState('')

  useEffect(() => {
    fetch('https://discord.com/api/guilds/1485623160219893811/widget.json')
      .then(r => r.json())
      .then(data => {
        setMembers((data.members || []).filter((m: any) => !m.bot))
        setCount(data.presence_count || 0)
        setGuildName(data.name || 'Discord')
      })
      .catch(() => {})
  }, [])

  const statusColor: Record<string, string> = {
    online: 'bg-green-400',
    idle: 'bg-yellow-400',
    dnd: 'bg-red-400',
    offline: 'bg-gray-600',
  }

  if (members.length === 0) return null

  return (
    <div className="w-56 rounded-xl border border-white/[0.06] bg-wow-panel/80 backdrop-blur-sm shadow-lg shadow-black/30 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
        <svg className="w-4 h-4 text-[#5865F2] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
        </svg>
        <div>
          <p className="text-xs font-semibold text-white">{guildName}</p>
          <p className="text-[10px] text-gray-500">{count} en ligne</p>
        </div>
      </div>
      <div className="px-2 py-2 space-y-0.5 max-h-48 overflow-y-auto">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/[0.03] transition-colors">
            <div className="relative flex-shrink-0">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#5865F2]/30 flex items-center justify-center">
                  <span className="text-[8px] text-[#5865F2] font-bold">{m.username.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-wow-panel ${statusColor[m.status] || statusColor.offline}`} />
            </div>
            <span className="text-[11px] text-gray-300 truncate">{m.username}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LandingPage() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    try {
      const { url, state } = await api.getBnetAuthUrl()
      sessionStorage.setItem('bnet_oauth_state', state)
      window.location.href = url
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 relative">
      <div className="max-w-sm w-full text-center space-y-8 animate-fade-in-up">

        {/* Guild logo */}
        <img
          src="/riposte-logo.jpg"
          alt="Riposte"
          className="w-24 h-24 rounded-2xl mx-auto border-2 border-white/[0.1] shadow-lg shadow-black/30"
        />

        {/* Title */}
        <h1 className="text-3xl font-bold text-white">
          Riposte<span className="text-[color:var(--class-color)]">Guild</span><span className="text-gray-500 font-normal">Tool</span>
        </h1>

        {/* Login Button */}
        <Button onClick={handleLogin} size="lg" disabled={loading} className="w-full max-w-xs mx-auto">
          {loading ? 'Redirection...' : 'Se connecter avec Battle.net'}
        </Button>

        <p className="text-[10px] text-gray-600">
          Connexion via Battle.net. Seuls votre BattleTag et vos personnages WoW sont accessibles.
        </p>

        <div className="pt-4 border-t border-white/[0.06]">
          <p className="text-xs text-gray-600 mb-3">Pas encore membre ?</p>
          <Link
            to="/apply"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[color:var(--class-color)]/30 bg-[color:var(--class-color)]/5 text-[color:var(--class-color)] font-medium text-sm hover:bg-[color:var(--class-color)]/10 hover:border-[color:var(--class-color)]/50 transition-all"
          >
            Postuler pour rejoindre la guilde →
          </Link>
        </div>
      </div>

      {/* Discord widget */}
      <div className="fixed bottom-4 left-4 hidden lg:block animate-fade-in">
        <DiscordWidget />
      </div>
    </div>
  )
}
