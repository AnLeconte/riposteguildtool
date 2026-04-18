import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { api } from '@/lib/api'

const CLASS_COLORS: Record<string, string> = {
  'Death Knight': '#C41E3A', 'Demon Hunter': '#A330C9', 'Druid': '#FF7C0A',
  'Evoker': '#33937F', 'Hunter': '#AAD372', 'Mage': '#3FC7EB',
  'Monk': '#00FF98', 'Paladin': '#F48CBA', 'Priest': '#FFFFFF',
  'Rogue': '#FFF468', 'Shaman': '#0070DD', 'Warlock': '#8788EE',
  'Warrior': '#C69B6D',
}

interface WowChar {
  name: string
  realm: string
  realmName: string
  class: string
  classId: number
  level: number
  faction: string
}

type Step = 'loading' | 'character' | 'discord' | 'done'

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth, user } = useAuthStore()
  const { addCharacter, setActive, characters } = useCharacterStore()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('loading')
  const [wowCharacters, setWowCharacters] = useState<WowChar[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
      return
    }

    const token = searchParams.get('token')
    const userStr = searchParams.get('user')
    const charsStr = searchParams.get('characters')

    if (!token || !userStr) {
      setError('Missing authentication data')
      return
    }

    try {
      const parsedUser = JSON.parse(decodeURIComponent(userStr))
      setAuth(parsedUser, token)

      // If user already has discord linked, skip to character selection
      const hasDiscord = !!parsedUser.discord_id

      if (charsStr) {
        try {
          const chars = JSON.parse(decodeURIComponent(charsStr)) as WowChar[]
          if (chars.length > 0) {
            const maxLevel = chars.reduce((max, c) => Math.max(max, c.level ?? 0), 0)
            setWowCharacters(chars.filter((c) => c.level >= maxLevel - 1))
            setStep('character')
            return
          }
        } catch { /* skip */ }
      }

      // No characters — go to discord link or home
      setStep(hasDiscord ? 'done' : 'discord')
    } catch {
      setError('Failed to parse authentication data')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCharacterConfirm = () => {
    if (selectedIndex === null) return
    const char = wowCharacters[selectedIndex]

    const existing = characters.find(
      (saved) => saved.name.toLowerCase() === char.name.toLowerCase() && saved.realm === char.realm,
    )

    if (existing) {
      setActive(existing.id)
    } else {
      addCharacter({
        name: char.name,
        realm: char.realm,
        region: 'eu',
        class: char.class,
        spec: '',
        ilvl: 0,
      })
    }

    // Next step: link Discord if not already linked
    const hasDiscord = !!useAuthStore.getState().user?.discord_id
    if (hasDiscord) {
      navigate('/', { replace: true })
    } else {
      setStep('discord')
    }
  }

  const handleLinkDiscord = async () => {
    try {
      const { url } = await api.getDiscordAuthUrl()
      window.location.href = url
    } catch { /* skip */ }
  }

  // After Discord link, we come back to / with ?discord_linked=...
  // So "done" step just redirects
  useEffect(() => {
    if (step === 'done') navigate('/', { replace: true })
  }, [step, navigate])

  if (error) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center space-y-4 animate-fade-in-up">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <h1 className="text-lg font-bold text-white">Authentication Failed</h1>
        <p className="text-sm text-gray-400">{error}</p>
        <button onClick={() => navigate('/login', { replace: true })} className="text-sm text-[color:var(--class-color)] hover:underline">
          Try again
        </button>
      </div>
    )
  }

  if (step === 'loading') {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center space-y-4 animate-fade-in-up">
        <div className="w-8 h-8 border-2 border-[color:var(--class-color)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-400">Signing in with Battle.net...</p>
      </div>
    )
  }

  // ── Step 1: Character Selection ──
  if (step === 'character') {
    return (
      <div className="max-w-lg mx-auto mt-12 animate-fade-in-up">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[color:var(--class-color)] text-wow-darker text-xs font-bold flex items-center justify-center">1</div>
            <span className="text-xs font-medium text-[color:var(--class-color)]">Character</span>
          </div>
          <div className="w-8 h-px bg-white/[0.1]" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/[0.06] text-gray-600 text-xs font-bold flex items-center justify-center">2</div>
            <span className="text-xs text-gray-600">Discord</span>
          </div>
        </div>

        <div className="text-center mb-6 space-y-2">
          <h1 className="text-xl font-bold text-white">Choose your character</h1>
          <p className="text-sm text-gray-500">Select the character you want to track</p>
        </div>

        <Card className="p-2 max-h-[50vh] overflow-y-auto">
          {wowCharacters.map((char, i) => {
            const color = CLASS_COLORS[char.class] ?? '#999'
            const isSelected = selectedIndex === i
            return (
              <button
                key={`${char.name}-${char.realm}`}
                onClick={() => setSelectedIndex(i)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all text-left ${
                  isSelected
                    ? 'bg-[color:var(--class-color)]/10 border border-[color:var(--class-color)]/30'
                    : 'border border-transparent hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div>
                    <span className="text-sm font-medium" style={{ color }}>{char.name}</span>
                    <span className="text-xs text-gray-600 ml-2">{char.realmName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500">{char.class}</span>
                  <span className="text-[10px] text-gray-600">Lv.{char.level}</span>
                </div>
              </button>
            )
          })}
        </Card>

        <div className="flex gap-3 mt-4">
          <Button onClick={() => setStep('discord')} variant="secondary" className="flex-1">
            Skip
          </Button>
          <Button onClick={handleCharacterConfirm} className="flex-1" disabled={selectedIndex === null}>
            Next
          </Button>
        </div>
      </div>
    )
  }

  // ── Step 2: Link Discord ──
  if (step === 'discord') {
    return (
      <div className="max-w-md mx-auto mt-12 animate-fade-in-up">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center">✓</div>
            <span className="text-xs text-gray-500">Character</span>
          </div>
          <div className="w-8 h-px bg-white/[0.1]" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">2</div>
            <span className="text-xs font-medium text-indigo-400">Discord</span>
          </div>
        </div>

        <div className="text-center mb-6 space-y-2">
          <h1 className="text-xl font-bold text-white">Link your Discord</h1>
          <p className="text-sm text-gray-500">
            Connect your Discord account so the raid bot can identify you when you sign up via reactions
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#5865F2]/20 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
            </div>
            <p className="text-xs text-gray-400">
              This allows the raid signup bot to automatically use your WoW character when you react to raid events on Discord.
            </p>
          </div>

          <Button onClick={handleLinkDiscord} size="lg" className="w-full bg-[#5865F2] hover:bg-[#4752C4]">
            Link Discord Account
          </Button>

          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors py-2"
          >
            I'll do this later
          </button>
        </Card>
      </div>
    )
  }

  return null
}
