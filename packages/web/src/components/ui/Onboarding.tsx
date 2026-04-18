import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Card } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { api } from '@/lib/api'
import { useCharacterStore, type SavedCharacter } from '@/stores/useCharacterStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { cachedImg } from '@/lib/cached-image'

const STORAGE_KEY = 'onboarding-complete'

const CLASS_COLORS_HEX: Record<string, string> = {
  'Death Knight': '#C41E3A', 'Demon Hunter': '#A330C9', 'Druid': '#FF7C0A',
  'Evoker': '#33937F', 'Hunter': '#AAD372', 'Mage': '#3FC7EB',
  'Monk': '#00FF98', 'Paladin': '#F48CBA', 'Priest': '#FFFFFF',
  'Rogue': '#FFF468', 'Shaman': '#0070DD', 'Warlock': '#8788EE',
  'Warrior': '#C69B6D',
}

interface AddedCharacter {
  name: string
  realm: string
  realmSlug: string
  region: string
  class: string
  spec: string
  equippedIlvl: number
  avatarUrl?: string
}

export function Onboarding() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const characters = useCharacterStore((s) => s.characters)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [step, setStep] = useState(0)
  const [realm, setRealm] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addedChar, setAddedChar] = useState<AddedCharacter | null>(null)

  // Close if conditions no longer met
  const shouldShow = isAuthenticated && characters.length === 0 && !dismissed

  useEffect(() => {
    if (characters.length > 0 && !addedChar) {
      // Character was added outside the onboarding, mark as done
      complete()
    }
  }, [characters.length])

  if (!shouldShow) return null

  function complete() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  function skip() {
    complete()
  }

  async function handleSearch() {
    if (!realm.trim() || !name.trim()) {
      setError('Entre le royaume et le nom du personnage')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const profile = await api.getCharacterProfile(realm.trim(), name.trim(), 'eu')
      useCharacterStore.getState().addCharacter({
        name: profile.name,
        realm: profile.realmSlug ?? profile.realm,
        region: profile.region ?? 'eu',
        class: profile.class,
        spec: profile.spec,
        ilvl: profile.equippedIlvl,
        avatarUrl: profile.avatarUrl,
      })
      setAddedChar(profile)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Personnage introuvable')
    } finally {
      setLoading(false)
    }
  }

  const classColor = addedChar ? CLASS_COLORS_HEX[addedChar.class] ?? '#888' : 'var(--class-color)'
  const progressWidth = `${((step + 1) / 3) * 100}%`

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-backdrop-in" />

      {/* Card */}
      <Card className="relative w-full max-w-md mx-4 p-0 animate-scale-in overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-white/[0.04]">
          <div
            className="h-full transition-all duration-500 ease-out rounded-r-full"
            style={{ width: progressWidth, backgroundColor: classColor }}
          />
        </div>

        <div className="p-6 space-y-5">
          {/* Step counter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: i <= step ? classColor : 'rgba(255,255,255,0.08)',
                    boxShadow: i === step ? `0 0 8px ${classColor}` : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-600 font-medium">{step + 1}/3</span>
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" style={{ color: classColor }}>
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Bienvenue !</h2>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  Cet outil est concu pour la guilde. Il te permet de suivre tes performances,
                  simuler ton stuff et collaborer avec les autres membres.
                </p>
              </div>
              <Button onClick={() => setStep(1)} className="w-full">
                Commencer
              </Button>
            </div>
          )}

          {/* Step 1: Add character */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white">Ajoute ton personnage</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Recherche ton personnage pour personnaliser ton experience.
                </p>
              </div>

              <div className="space-y-3">
                <Input
                  placeholder="Royaume (ex: Hyjal)"
                  value={realm}
                  onChange={(e) => setRealm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Input
                  placeholder="Nom du personnage"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />

                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button onClick={handleSearch} disabled={loading} className="w-full">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                        <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Recherche...
                    </span>
                  ) : (
                    'Rechercher'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Success */}
          {step === 2 && addedChar && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl border-2 border-white/[0.1] overflow-hidden mx-auto" style={{ boxShadow: `0 0 20px ${classColor}33` }}>
                {addedChar.avatarUrl ? (
                  <img src={cachedImg(addedChar.avatarUrl)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/[0.04]">
                    <span className="text-2xl font-bold" style={{ color: classColor }}>
                      {addedChar.name[0]}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">C'est pret !</h2>
                <p className="text-sm text-gray-400 mt-1">Ton personnage a ete ajoute avec succes.</p>
              </div>

              <Card className="p-4 text-left">
                <div className="flex items-center gap-3">
                  {addedChar.avatarUrl && (
                    <img src={cachedImg(addedChar.avatarUrl)} alt="" className="w-10 h-10 rounded-lg border border-white/[0.1]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: classColor }}>{addedChar.name}</p>
                    <p className="text-xs text-gray-500">{addedChar.spec} {addedChar.class}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{addedChar.equippedIlvl}</p>
                    <p className="text-[10px] text-gray-600">ilvl</p>
                  </div>
                </div>
              </Card>

              <Button onClick={complete} className="w-full">
                Acceder au dashboard
              </Button>
            </div>
          )}

          {/* Skip link */}
          {step < 2 && (
            <button
              onClick={skip}
              className="w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors py-1"
            >
              Passer
            </button>
          )}
        </div>
      </Card>
    </div>,
    document.body,
  )
}
