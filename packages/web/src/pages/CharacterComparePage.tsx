import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

const SLOT_ORDER = [
  'HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'WRIST',
  'HANDS', 'WAIST', 'LEGS', 'FEET', 'FINGER_1', 'FINGER_2',
  'TRINKET_1', 'TRINKET_2', 'MAIN_HAND', 'OFF_HAND',
]
const SLOT_LABELS: Record<string, string> = {
  HEAD: 'Head', NECK: 'Neck', SHOULDER: 'Shoulders', BACK: 'Back', CHEST: 'Chest',
  WRIST: 'Wrists', HANDS: 'Hands', WAIST: 'Waist', LEGS: 'Legs', FEET: 'Feet',
  FINGER_1: 'Ring 1', FINGER_2: 'Ring 2', TRINKET_1: 'Trinket 1', TRINKET_2: 'Trinket 2',
  MAIN_HAND: 'Main Hand', OFF_HAND: 'Off Hand',
}

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569',
  Priest: '#FFFFFF', 'Death Knight': '#C41F3B', Shaman: '#0070DE', Mage: '#69CCF0',
  Warlock: '#9482C9', Monk: '#00FF96', Druid: '#FF7D0A', 'Demon Hunter': '#A330C9', Evoker: '#33937F',
}

export function CharacterComparePage() {
  const active = useCharacterStore((s) => s.getActive())

  const [realmA, setRealmA] = useState(active?.realm ?? '')
  const [nameA, setNameA] = useState(active?.name ?? '')
  const [realmB, setRealmB] = useState('')
  const [nameB, setNameB] = useState('')
  const [profileA, setProfileA] = useState<any>(null)
  const [profileB, setProfileB] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCompare = async () => {
    if (!realmA || !nameA || !realmB || !nameB) { setError('Fill both characters'); return }
    setLoading(true); setError(null)
    try {
      const [a, b] = await Promise.all([
        api.getCharacterProfile(realmA, nameA, 'eu'),
        api.getCharacterProfile(realmB, nameB, 'eu'),
      ])
      setProfileA(a); setProfileB(b)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally { setLoading(false) }
  }

  const getGearBySlot = (profile: any) => {
    const map = new Map<string, any>()
    for (const item of profile?.gear ?? []) map.set(item.slot, item)
    return map
  }

  const gearA = getGearBySlot(profileA)
  const gearB = getGearBySlot(profileB)

  return (
    <div className="w-full space-y-6">
      <div>
      <PageHeader title="Character" highlight="Compare" description="Compare two characters' gear side by side" />
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-5 h-5 rounded-full bg-wow-blue/20 border border-wow-blue/40 flex items-center justify-center text-wow-blue text-[10px] font-bold">A</span>
            <span className="text-xs font-medium text-gray-300">Character A</span>
          </div>
          <div className="flex gap-2">
            <Input value={realmA} onChange={(e) => setRealmA(e.target.value)} placeholder="Realm" className="w-28" />
            <Input value={nameA} onChange={(e) => setNameA(e.target.value)} placeholder="Name" className="flex-1" />
          </div>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-5 h-5 rounded-full bg-[color:var(--class-color)]/20 border border-[color:var(--class-color)]/40 flex items-center justify-center text-[color:var(--class-color)] text-[10px] font-bold">B</span>
            <span className="text-xs font-medium text-gray-300">Character B</span>
          </div>
          <div className="flex gap-2">
            <Input value={realmB} onChange={(e) => setRealmB(e.target.value)} placeholder="Realm" className="w-28" />
            <Input value={nameB} onChange={(e) => setNameB(e.target.value)} placeholder="Name" className="flex-1" />
          </div>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button onClick={handleCompare} disabled={loading} size="lg">
          {loading ? 'Loading...' : 'Compare'}
        </Button>
      </div>
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      {/* Results */}
      {profileA && profileB && (
        <div className="space-y-4">
          {/* Header comparison */}
          <div className="grid grid-cols-2 gap-4">
            <CharHeader profile={profileA} badge="A" badgeColor="text-wow-blue bg-wow-blue/20 border-wow-blue/40" />
            <CharHeader profile={profileB} badge="B" badgeColor="text-amber-400 bg-amber-500/20 border-amber-500/40" />
          </div>

          {/* Gear comparison */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-gray-300">Gear Comparison</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-2 text-gray-600 w-20">Slot</th>
                  <th className="text-left px-3 py-2 text-wow-blue/60">Character A</th>
                  <th className="text-center px-2 py-2 text-gray-600 w-12">ilvl</th>
                  <th className="text-center px-2 py-2 text-gray-600 w-8">vs</th>
                  <th className="text-center px-2 py-2 text-gray-600 w-12">ilvl</th>
                  <th className="text-left px-3 py-2 text-[color:var(--class-color)]/60">Character B</th>
                </tr>
              </thead>
              <tbody>
                {SLOT_ORDER.map((slot) => {
                  const itemA = gearA.get(slot)
                  const itemB = gearB.get(slot)
                  const lvlA = itemA?.level ?? 0
                  const lvlB = itemB?.level ?? 0
                  const diff = lvlB - lvlA
                  return (
                    <tr key={slot} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-gray-500 font-medium">{SLOT_LABELS[slot]}</td>
                      <td className="px-3 py-2 text-gray-300 truncate max-w-[200px]">{itemA?.name ?? '—'}</td>
                      <td className="px-2 py-2 text-center tabular-nums text-gray-400">{lvlA || '—'}</td>
                      <td className="px-2 py-2 text-center">
                        {diff !== 0 && (
                          <span className={`text-[10px] font-bold ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums text-gray-400">{lvlB || '—'}</td>
                      <td className="px-3 py-2 text-gray-300 truncate max-w-[200px]">{itemB?.name ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {!profileA && !profileB && !loading && (
        <Card><div className="text-center py-16 space-y-3">
          <p className="text-3xl text-gray-700">{'\uD83D\uDD04'}</p>
          <p className="text-gray-500">Enter two characters to compare their gear</p>
        </div></Card>
      )}
    </div>
  )
}

function CharHeader({ profile, badge, badgeColor }: { profile: any; badge: string; badgeColor: string }) {
  const color = CLASS_COLORS[profile.class] ?? '#888'
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold ${badgeColor}`}>{badge}</span>
        {profile.avatarUrl && <img src={profile.avatarUrl} alt="" className="w-10 h-10 rounded-lg border border-white/[0.1]" />}
        <div>
          <p className="text-sm font-semibold text-gray-200">{profile.name}</p>
          <p className="text-[10px]" style={{ color }}>{profile.spec} {profile.class}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-lg font-bold text-[color:var(--class-color)]">{profile.equippedIlvl}</p>
          <p className="text-[9px] text-gray-600">ilvl</p>
        </div>
      </div>
    </Card>
  )
}
