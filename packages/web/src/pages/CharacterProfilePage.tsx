import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ItemLink } from '@/components/ui/ItemLink'
import { api } from '@/lib/api'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { cachedImg } from '@/lib/cached-image'

const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569',
  Priest: '#FFFFFF', 'Death Knight': '#C41F3B', Shaman: '#0070DE', Mage: '#69CCF0',
  Warlock: '#9482C9', Monk: '#00FF96', Druid: '#FF7D0A', 'Demon Hunter': '#A330C9',
  Evoker: '#33937F',
}

const SLOT_ORDER = [
  'HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'WRIST',
  'HANDS', 'WAIST', 'LEGS', 'FEET', 'FINGER_1', 'FINGER_2',
  'TRINKET_1', 'TRINKET_2', 'MAIN_HAND', 'OFF_HAND',
]

const SLOT_LABELS: Record<string, string> = {
  HEAD: 'Head', NECK: 'Neck', SHOULDER: 'Shoulders', BACK: 'Back',
  CHEST: 'Chest', WRIST: 'Wrists', HANDS: 'Hands', WAIST: 'Waist',
  LEGS: 'Legs', FEET: 'Feet', FINGER_1: 'Ring 1', FINGER_2: 'Ring 2',
  TRINKET_1: 'Trinket 1', TRINKET_2: 'Trinket 2', MAIN_HAND: 'Main Hand',
  OFF_HAND: 'Off Hand', SHIRT: 'Shirt', TABARD: 'Tabard',
}

const QUALITY_COLORS: Record<string, string> = {
  POOR: 'text-gray-500', COMMON: 'text-gray-300', UNCOMMON: 'text-green-400',
  RARE: 'text-blue-400', EPIC: 'text-purple-400', LEGENDARY: 'text-orange-400',
  ARTIFACT: 'text-[color:var(--class-color)]', HEIRLOOM: 'text-cyan-400',
}

export function CharacterProfilePage() {
  const active = useCharacterStore((s) => s.getActive())
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-load active character
  useEffect(() => {
    if (!active) return
    setLoading(true)
    setError(null)
    api.getCharacterProfile(active.realm, active.name, active.region ?? 'eu')
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : 'Character not found'))
      .finally(() => setLoading(false))
  }, [active?.realm, active?.name, active?.region])

  const classColor = profile ? CLASS_COLORS[profile.class] ?? '#888' : '#888'

  // Sort gear by slot order
  const sortedGear = profile?.gear
    ?.filter((g: any) => SLOT_ORDER.includes(g.slot))
    ?.sort((a: any, b: any) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
    ?? []

  // Find missing enchants/gems
  const enchantableSlots = new Set(['HEAD', 'BACK', 'CHEST', 'WRIST', 'LEGS', 'FEET', 'FINGER_1', 'FINGER_2', 'MAIN_HAND'])
  const missingEnchants = sortedGear.filter((g: any) => enchantableSlots.has(g.slot) && (!g.enchantments || g.enchantments.length === 0))
  const emptyGems = sortedGear.filter((g: any) => g.sockets?.some((s: any) => !s.item))

  if (!active) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-500">Select a character from the character switcher to view their profile</p>
      </Card>
    )
  }

  return (
    <div className="w-full space-y-6">
      {error && <p className="text-red-400 text-xs">{error}</p>}

      {loading && (
        <Card><div className="text-center py-12"><div className="w-6 h-6 border-2 border-[color:var(--class-color)]/40 border-t-wow-gold rounded-full animate-spin mx-auto" /><p className="text-gray-500 text-sm mt-3">Loading character...</p></div></Card>
      )}

      {profile && !loading && (
        <div className="space-y-4">
          {/* Character header with avatar */}
          <Card className="p-0 overflow-hidden">
            <div className="relative h-40">
              {profile.renderUrl ? (
                <img src={cachedImg(profile.renderUrl)} alt="" className="absolute inset-0 w-full h-full object-cover object-top brightness-50" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-wow-accent/40 to-wow-panel" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-wow-panel via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex items-end gap-4">
                {profile.avatarUrl && (
                  <img src={cachedImg(profile.avatarUrl)} alt="" className="w-16 h-16 rounded-xl border-2 border-white/[0.15] shadow-lg" />
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white drop-shadow-lg">{profile.name}</h2>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-sm font-medium" style={{ color: classColor }}>
                      {profile.spec} {profile.class}
                    </span>
                    <span className="text-xs text-gray-400">{profile.race}</span>
                    <span className="text-xs text-gray-500">{profile.realm} ({profile.region.toUpperCase()})</span>
                    <span className="text-xs text-gray-600">Level {profile.level}</span>
                  </div>
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-[color:var(--class-color)]">{profile.equippedIlvl}</p>
                    <p className="text-[9px] text-gray-500 uppercase">ilvl</p>
                  </div>
                  {(profile.raiderio?.score ?? profile.mythicPlus?.score ?? 0) > 0 && (
                    <div>
                      <p className="text-lg font-bold text-orange-400">{Math.round(profile.raiderio?.score ?? profile.mythicPlus?.score ?? 0)}</p>
                      <p className="text-[9px] text-gray-500 uppercase">M+ Score</p>
                    </div>
                  )}
                  {profile.raiderio?.ranks?.realm > 0 && (
                    <div>
                      <p className="text-lg font-bold text-wow-blue">#{profile.raiderio.ranks.realm}</p>
                      <p className="text-[9px] text-gray-500 uppercase">Realm</p>
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-bold text-gray-400">{profile.achievementPoints?.toLocaleString()}</p>
                    <p className="text-[9px] text-gray-500 uppercase">Achiev.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Save character button */}
          <SaveCharacterButton profile={profile} />

          {/* Warnings */}
          {(missingEnchants.length > 0 || emptyGems.length > 0) && (
            <Card className="p-4">
              <div className="space-y-2">
                {missingEnchants.length > 0 && (
                  <div className="flex items-center gap-2 text-yellow-400/80">
                    <span className="text-sm">&#9888;</span>
                    <span className="text-xs font-medium">
                      Missing enchants: {missingEnchants.map((g: any) => SLOT_LABELS[g.slot] ?? g.slot).join(', ')}
                    </span>
                  </div>
                )}
                {emptyGems.length > 0 && (
                  <div className="flex items-center gap-2 text-blue-400/80">
                    <span className="text-sm">&#128302;</span>
                    <span className="text-xs font-medium">
                      Empty gem sockets: {emptyGems.map((g: any) => SLOT_LABELS[g.slot] ?? g.slot).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Gear grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sortedGear.map((item: any) => {
              const qualityColor = QUALITY_COLORS[item.quality] ?? 'text-gray-300'
              const hasEnchant = item.enchantments?.length > 0
              const needsEnchant = enchantableSlots.has(item.slot)
              const emptySocket = item.sockets?.some((s: any) => !s.item)

              return (
                <Card key={item.slot} className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Item icon */}
                    <a href={item.id ? `https://www.wowhead.com/item=${item.id}` : undefined}
                      target="_blank" rel="noopener noreferrer"
                      data-wowhead={item.id ? `item=${item.id}${item.level ? `&ilvl=${item.level}` : ''}` : undefined}
                      className="flex-shrink-0">
                      <GearIcon itemId={item.id} />
                    </a>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.id ? (
                          <ItemLink itemId={item.id} name={item.name} ilvl={item.level}
                            className={`text-sm font-medium truncate ${qualityColor} hover:brightness-125 transition-colors`} />
                        ) : (
                          <span className={`text-sm font-medium truncate ${qualityColor}`}>{item.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {hasEnchant && (
                          <span className="text-[9px] text-green-400/70 truncate">{item.enchantments[0].name}</span>
                        )}
                        {needsEnchant && !hasEnchant && (
                          <span className="text-[9px] text-yellow-400/60">No enchant</span>
                        )}
                        {emptySocket && (
                          <span className="text-[9px] text-blue-400/60">Empty socket</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-400 tabular-nums flex-shrink-0">{item.level}</span>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* M+ runs this week */}
          {profile.mythicPlus?.runs?.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-gray-300">M+ This Week</h3>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {profile.mythicPlus.runs.sort((a: any, b: any) => b.level - a.level).map((run: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`text-xs font-bold tabular-nums w-8 ${run.timed ? 'text-[color:var(--class-color)]' : 'text-gray-500'}`}>+{run.level}</span>
                    <span className="text-xs text-gray-300 flex-1">{run.dungeon}</span>
                    <span className={`text-[10px] font-medium ${run.timed ? 'text-green-400' : 'text-red-400/70'}`}>{run.timed ? 'Timed' : 'Depleted'}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Raider.io best runs (season) */}
          {profile.raiderio?.bestRuns?.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">Season Best Runs</h3>
                {profile.raiderio.profileUrl && (
                  <a href={profile.raiderio.profileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-orange-400/70 hover:text-orange-400 transition-colors">Raider.io {'\u2197'}</a>
                )}
              </div>
              <div className="divide-y divide-white/[0.03]">
                {profile.raiderio.bestRuns.sort((a: any, b: any) => b.score - a.score).map((run: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                    <span className={`text-xs font-bold tabular-nums w-8 ${run.timed ? 'text-[color:var(--class-color)]' : 'text-gray-500'}`}>+{run.level}</span>
                    <span className="text-xs text-gray-300 flex-1">{run.dungeon}</span>
                    <span className={`text-[10px] font-medium ${run.timed ? 'text-green-400' : 'text-red-400/70'}`}>{run.timed ? 'Timed' : 'Depleted'}</span>
                    <span className="text-[10px] text-orange-400/70 tabular-nums">{run.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Raider.io rankings */}
          {profile.raiderio && (profile.raiderio.ranks?.realm > 0 || profile.raiderio.classRanks?.realm > 0) && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">M+ Rankings</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {profile.raiderio.ranks?.realm > 0 && (
                  <>
                    <div className="text-center p-2 rounded-lg bg-wow-darker/40">
                      <p className="text-lg font-bold text-[color:var(--class-color)]">#{profile.raiderio.ranks.realm}</p>
                      <p className="text-[9px] text-gray-500 uppercase">Realm</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-wow-darker/40">
                      <p className="text-lg font-bold text-gray-300">#{profile.raiderio.ranks.region.toLocaleString()}</p>
                      <p className="text-[9px] text-gray-500 uppercase">Region</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-wow-darker/40">
                      <p className="text-lg font-bold text-gray-400">#{profile.raiderio.ranks.world.toLocaleString()}</p>
                      <p className="text-[9px] text-gray-500 uppercase">World</p>
                    </div>
                  </>
                )}
                {profile.raiderio.classRanks?.realm > 0 && (
                  <>
                    <div className="text-center p-2 rounded-lg bg-wow-darker/40">
                      <p className="text-lg font-bold text-wow-blue">#{profile.raiderio.classRanks.realm}</p>
                      <p className="text-[9px] text-gray-500 uppercase">Class Realm</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-wow-darker/40">
                      <p className="text-lg font-bold text-gray-300">#{profile.raiderio.classRanks.region.toLocaleString()}</p>
                      <p className="text-[9px] text-gray-500 uppercase">Class Region</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-wow-darker/40">
                      <p className="text-lg font-bold text-gray-400">#{profile.raiderio.classRanks.world.toLocaleString()}</p>
                      <p className="text-[9px] text-gray-500 uppercase">Class World</p>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

        </div>
      )}

    </div>
  )
}

// Gear icon fetched from Wowhead tooltip API
const gearIconCache = new Map<number, string>()

function GearIcon({ itemId }: { itemId?: number }) {
  const [iconUrl, setIconUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!itemId) return
    if (gearIconCache.has(itemId)) { setIconUrl(gearIconCache.get(itemId)!); return }
    fetch(`https://nether.wowhead.com/tooltip/item/${itemId}?dataEnv=1&locale=0`)
      .then((r) => r.json())
      .then((d: any) => {
        if (d.icon) {
          const url = `https://wow.zamimg.com/images/wow/icons/large/${d.icon}.jpg`
          gearIconCache.set(itemId, url)
          setIconUrl(url)
        }
      })
      .catch(() => {})
  }, [itemId])

  if (iconUrl) {
    return <img src={cachedImg(iconUrl)} alt="" className="w-10 h-10 rounded-lg border border-white/[0.12]" />
  }
  return <div  />
}

function SaveCharacterButton({ profile }: { profile: any }) {
  const { characters, addCharacter } = useCharacterStore()
  const alreadySaved = characters.some((c) => c.name === profile.name && c.realm === profile.realmSlug)

  if (alreadySaved) {
    return (
      <p className="text-[11px] text-gray-600 flex items-center gap-1">
        <span className="text-green-400">&#10003;</span> Saved to your characters
      </p>
    )
  }

  return (
    <Button variant="secondary" size="sm" onClick={() => addCharacter({
      name: profile.name,
      realm: profile.realmSlug,
      region: profile.region,
      class: profile.class,
      spec: profile.spec,
      ilvl: profile.equippedIlvl,
      avatarUrl: profile.avatarUrl,
    })}>
      Save to my characters
    </Button>
  )
}
