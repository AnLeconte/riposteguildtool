import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useClassIcons } from '@/hooks/useClassIcons'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface Player { name: string; class: string; spec: string; role: 'tank' | 'healer' | 'dps' }
interface GuildMember { name: string; class: string; classId: number; level: number; rank: number }

const CLASS_SPECS: Record<string, { specs: string[]; color: string }> = {
  'Death Knight': { specs: ['Blood|tank', 'Frost|dps', 'Unholy|dps'], color: '#C41F3B' },
  'Demon Hunter': { specs: ['Havoc|dps', 'Vengeance|tank'], color: '#A330C9' },
  Druid: { specs: ['Balance|dps', 'Feral|dps', 'Guardian|tank', 'Restoration|healer'], color: '#FF7D0A' },
  Evoker: { specs: ['Devastation|dps', 'Preservation|healer', 'Augmentation|dps'], color: '#33937F' },
  Hunter: { specs: ['Beast Mastery|dps', 'Marksmanship|dps', 'Survival|dps'], color: '#ABD473' },
  Mage: { specs: ['Arcane|dps', 'Fire|dps', 'Frost|dps'], color: '#69CCF0' },
  Monk: { specs: ['Brewmaster|tank', 'Mistweaver|healer', 'Windwalker|dps'], color: '#00FF96' },
  Paladin: { specs: ['Holy|healer', 'Protection|tank', 'Retribution|dps'], color: '#F58CBA' },
  Priest: { specs: ['Discipline|healer', 'Holy|healer', 'Shadow|dps'], color: '#FFFFFF' },
  Rogue: { specs: ['Assassination|dps', 'Outlaw|dps', 'Subtlety|dps'], color: '#FFF569' },
  Shaman: { specs: ['Elemental|dps', 'Enhancement|dps', 'Restoration|healer'], color: '#0070DE' },
  Warlock: { specs: ['Affliction|dps', 'Demonology|dps', 'Destruction|dps'], color: '#9482C9' },
  Warrior: { specs: ['Arms|dps', 'Fury|dps', 'Protection|tank'], color: '#C79C6E' },
}

// Raid utility by class
const UTILITIES: Record<string, string[]> = {
  'Death Knight': ['Battle Rez', 'Anti-Magic Zone', 'Grip'],
  'Demon Hunter': ['Darkness', '5% magic debuff'],
  Druid: ['Battle Rez', 'Innervate', 'Roar', 'Tranquility'],
  Evoker: ['Rescue', 'Time Spiral', 'Blessing/Zephyr'],
  Hunter: ['Lust (pet)', 'Misdirect', 'Binding Shot'],
  Mage: ['Lust', 'Intellect buff', 'Decurse'],
  Monk: ['Mystic Touch (5% phys)', 'Ring of Peace'],
  Paladin: ['Blessing of Protection', 'Devotion Aura', 'Lay on Hands'],
  Priest: ['Mass Dispel', 'Power Infusion', 'Leap of Faith'],
  Rogue: ['Shroud', 'Tricks', 'Cloak skip'],
  Shaman: ['Lust', 'Spirit Link', 'Wind Rush', 'Tremor'],
  Warlock: ['Gateway', 'Healthstones', 'Battle Rez (soul stone)'],
  Warrior: ['Battle Shout (AP)', 'Rallying Cry'],
}

// Map Blizzard class IDs to names
const CLASS_ID_MAP: Record<number, string> = {
  1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue', 5: 'Priest',
  6: 'Death Knight', 7: 'Shaman', 8: 'Mage', 9: 'Warlock', 10: 'Monk',
  11: 'Druid', 12: 'Demon Hunter', 13: 'Evoker',
}

export function CompAnalyzerPage() {
  const { getSpecIcon, getClassIcon } = useClassIcons()
  const [players, setPlayers] = useState<Player[]>([])
  const [addClass, setAddClass] = useState('Warrior')
  const [addSpec, setAddSpec] = useState('Arms|dps')
  const [addName, setAddName] = useState('')

  // Guild import state
  const [guildRealm, setGuildRealm] = useState('hyjal')
  const [guildName, setGuildName] = useState('inertial')
  const [guildMembers, setGuildMembers] = useState<GuildMember[]>([])
  const [guildLoading, setGuildLoading] = useState(false)
  const [showGuild, setShowGuild] = useState(false)
  const [guildSearch, setGuildSearch] = useState('')

  const addPlayer = () => {
    const [spec, role] = addSpec.split('|') as [string, Player['role']]
    setPlayers((p) => [...p, { name: addName.trim() || `${spec} ${addClass}`, class: addClass, spec, role }])
    setAddName('')
  }

  const addFromGuild = (member: GuildMember) => {
    if (players.some((p) => p.name === member.name)) return
    // Default to first DPS spec of the class
    const classData = CLASS_SPECS[member.class]
    const firstSpec = classData?.specs[0] ?? 'Unknown|dps'
    const [spec, role] = firstSpec.split('|') as [string, Player['role']]
    setPlayers((p) => [...p, { name: member.name, class: member.class, spec, role }])
  }

  const loadGuild = async () => {
    if (!guildRealm.trim() || !guildName.trim()) return
    setGuildLoading(true)
    try {
      const data = await api.getGuildRoster(guildRealm.trim(), guildName.trim(), 'eu')
      const members: GuildMember[] = (data.members ?? []).map((m: any) => ({
        name: m.name,
        class: CLASS_ID_MAP[m.classId] ?? m.class ?? 'Unknown',
        classId: m.classId,
        level: m.level,
        rank: m.rank,
      }))
      // Sort by rank, filter max level
      const maxLevel = Math.max(...members.map((m) => m.level))
      setGuildMembers(members.filter((m) => m.level >= maxLevel - 1).sort((a, b) => a.rank - b.rank))
    } catch { /* skip */ }
    finally { setGuildLoading(false) }
  }

  const removePlayer = (idx: number) => setPlayers((p) => p.filter((_, i) => i !== idx))

  const changeSpec = (idx: number, specRole: string) => {
    const [spec, role] = specRole.split('|') as [string, Player['role']]
    setPlayers((p) => p.map((player, i) => i === idx ? { ...player, spec, role } : player))
  }

  const filteredGuildMembers = guildMembers.filter((m) => {
    if (guildSearch && !m.name.toLowerCase().includes(guildSearch.toLowerCase())) return false
    return true
  })

  const tanks = players.filter((p) => p.role === 'tank')
  const healers = players.filter((p) => p.role === 'healer')
  const dps = players.filter((p) => p.role === 'dps')
  const uniqueClasses = [...new Set(players.map((p) => p.class))]

  // ── Analyze buffs/debuffs ──
  const buffs = [
    { label: 'Bloodlust / Heroism', has: players.some((p) => ['Mage', 'Shaman', 'Hunter', 'Evoker'].includes(p.class)), source: 'Mage, Shaman, Hunter, Evoker' },
    { label: 'Battle Rez', has: players.some((p) => ['Death Knight', 'Druid', 'Warlock'].includes(p.class)), source: 'DK, Druid, Warlock' },
    { label: 'Arcane Intellect (+3% Int)', has: players.some((p) => p.class === 'Mage'), source: 'Mage' },
    { label: 'Battle Shout (+5% AP)', has: players.some((p) => p.class === 'Warrior'), source: 'Warrior' },
    { label: 'Power Word: Fortitude (+5% Stam)', has: players.some((p) => p.class === 'Priest'), source: 'Priest' },
    { label: 'Mark of the Wild (+3% Vers)', has: players.some((p) => p.class === 'Druid'), source: 'Druid' },
    { label: 'Skyfury (+2% Mastery)', has: players.some((p) => p.class === 'Shaman'), source: 'Shaman' },
    { label: 'Mystic Touch (+5% Phys taken)', has: players.some((p) => p.class === 'Monk'), source: 'Monk' },
    { label: 'Chaos Brand (+3% Magic taken)', has: players.some((p) => p.class === 'Demon Hunter'), source: 'DH' },
    { label: "Hunter's Mark (+3% dmg taken)", has: players.some((p) => p.class === 'Hunter'), source: 'Hunter' },
    { label: 'Devotion Aura (-3% dmg taken)', has: players.some((p) => p.class === 'Paladin'), source: 'Paladin' },
    { label: 'Atrophic Poison (-3% enemy dmg)', has: players.some((p) => p.class === 'Rogue'), source: 'Rogue' },
    { label: 'Blessing of the Bronze (-15% move CD)', has: players.some((p) => p.class === 'Evoker'), source: 'Evoker' },
    { label: 'Healthstones', has: players.some((p) => p.class === 'Warlock'), source: 'Warlock' },
  ]

  const warnings: string[] = []
  if (tanks.length < 2) warnings.push(`Only ${tanks.length} tank(s) — need 2`)
  if (healers.length < 3) warnings.push(`Only ${healers.length} healer(s) — recommend 3-5`)
  if (healers.length > 6) warnings.push(`${healers.length} healers may be too many`)
  if (!buffs[0].has) warnings.push('No Bloodlust/Heroism (need Mage, Shaman, Hunter, or Evoker)')
  if (!buffs[1].has) warnings.push('No Battle Rez (need DK, Druid, or Warlock)')
  if (!buffs[13].has) warnings.push('No Healthstones (no Warlock)')
  if (players.length > 0 && players.length < 10) warnings.push(`Only ${players.length} players — raids need 10-20`)

  const allUtilities = uniqueClasses.flatMap((c) => (UTILITIES[c] ?? []).map((u) => ({ class: c, utility: u })))

  const specs = CLASS_SPECS[addClass]?.specs ?? []

  return (
    <div className="w-full space-y-6">
      <div>
      <PageHeader title="Comp" highlight="Analyzer" description="Analyze your raid composition — buffs, utilities, warnings" />
      </div>

      {/* Add player — manual or from guild */}
      <Card className="p-4 space-y-4">
        {/* Manual add */}
        <div>
          <label className="text-xs font-medium text-gray-400 mb-2 block">Add manually</label>
          <div className="flex gap-2 flex-wrap">
            <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Player name" className="w-36"
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()} />
            <Select value={addClass} onChange={(e) => { setAddClass(e.target.value); setAddSpec(CLASS_SPECS[e.target.value]?.specs[0] ?? '') }}
              >
              {Object.keys(CLASS_SPECS).map((c) => <option key={c} value={c} data-icon={getClassIcon(c)}>{c}</option>)}
            </Select>
            <Select value={addSpec} onChange={(e) => setAddSpec(e.target.value)}
              >
              {specs.map((s) => { const [name] = s.split('|'); return <option key={s} value={s} data-icon={getSpecIcon(addClass, name)}>{name}</option> })}
            </Select>
            <Button onClick={addPlayer} size="sm">Add</Button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[10px] text-gray-600 uppercase">or import from guild</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Guild import */}
        <div>
          <div className="flex gap-2 flex-wrap">
            <Input value={guildRealm} onChange={(e) => setGuildRealm(e.target.value)} placeholder="Realm" className="w-32" />
            <Input value={guildName} onChange={(e) => setGuildName(e.target.value)} placeholder="Guild name" className="flex-1" />
            <Button onClick={loadGuild} disabled={guildLoading} variant="secondary" size="sm">
              {guildLoading ? 'Loading...' : 'Load Guild'}
            </Button>
          </div>

          {guildMembers.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <Input value={guildSearch} onChange={(e) => setGuildSearch(e.target.value)}
                  placeholder="Search members..." className="w-48 text-xs" />
                <span className="text-[10px] text-gray-600">{filteredGuildMembers.length} members</span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-white/[0.06] divide-y divide-white/[0.03]">
                {filteredGuildMembers.map((member) => {
                  const alreadyAdded = players.some((p) => p.name === member.name)
                  const classColor = CLASS_SPECS[member.class]?.color ?? '#888'
                  return (
                    <button
                      key={member.name}
                      onClick={() => !alreadyAdded && addFromGuild(member)}
                      disabled={alreadyAdded}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        alreadyAdded ? 'opacity-40' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      {getClassIcon(member.class) ? (
                        <img src={getClassIcon(member.class)} alt="" className="w-5 h-5 rounded border border-white/[0.1] flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: classColor }} />
                      )}
                      <span className="text-xs font-medium flex-1" style={{ color: classColor }}>{member.name}</span>
                      <span className="text-[10px]" style={{ color: classColor }}>{member.class}</span>
                      {alreadyAdded && <span className="text-[9px] text-green-400">&#10003;</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {players.length > 0 && (
        <>
          {/* Roster overview */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{tanks.length}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tanks</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{healers.length}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Healers</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{dps.length}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">DPS</p>
            </Card>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <Card className="p-4 space-y-1.5">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-yellow-400/80">
                  <span className="text-sm">&#9888;</span>
                  <span className="text-xs font-medium">{w}</span>
                </div>
              ))}
            </Card>
          )}

          {/* Buffs/Debuffs check */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Raid Buffs & Debuffs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {buffs.map((b) => (
                <div key={b.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                  b.has ? 'border-green-500/20 bg-green-500/[0.04]' : 'border-red-500/15 bg-red-500/[0.03]'
                }`}>
                  <span className={`text-sm flex-shrink-0 ${b.has ? 'text-green-400' : 'text-red-400/60'}`}>{b.has ? '\u2713' : '\u2717'}</span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs ${b.has ? 'text-gray-200' : 'text-gray-500'}`}>{b.label}</span>
                  </div>
                  <span className="text-[9px] text-gray-600 flex-shrink-0">{b.source}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">{buffs.filter((b) => b.has).length}/{buffs.length} buffs covered</span>
              {buffs.every((b) => b.has) && <span className="text-[10px] text-green-400 font-medium">All buffs covered!</span>}
            </div>
          </Card>

          {/* Utilities */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Available Utilities</h3>
            <div className="flex flex-wrap gap-1.5">
              {allUtilities.map((u, i) => (
                <span key={i} className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-gray-300">
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: CLASS_SPECS[u.class]?.color ?? '#888' }} />
                  {u.utility}
                </span>
              ))}
            </div>
          </Card>

          {/* Player list */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-gray-300">Roster ({players.length})</h3>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {players.map((p, i) => {
                const classSpecs = CLASS_SPECS[p.class]?.specs ?? []
                const currentSpecRole = `${p.spec}|${p.role}`
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors group">
                    {getSpecIcon(p.class, p.spec) ? (
                      <img src={getSpecIcon(p.class, p.spec)} alt="" className="w-6 h-6 rounded border border-white/[0.1] flex-shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: CLASS_SPECS[p.class]?.color ?? '#888' }} />
                    )}
                    <span className="text-sm font-medium text-gray-200 flex-1 truncate" style={{ color: CLASS_SPECS[p.class]?.color }}>{p.name}</span>
                    <Select
                      value={currentSpecRole}
                      onChange={(e) => changeSpec(i, e.target.value)}
                      
                    >
                      {classSpecs.map((s) => {
                        const [name] = s.split('|')
                        return <option key={s} value={s} data-icon={getSpecIcon(p.class, name)}>{name}</option>
                      })}
                    </Select>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                      p.role === 'tank' ? 'text-blue-400 bg-blue-500/10' :
                      p.role === 'healer' ? 'text-green-400 bg-green-500/10' :
                      'text-red-400 bg-red-500/10'
                    }`}>{p.role}</span>
                    <button onClick={() => removePlayer(i)} className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-[10px] flex-shrink-0">&#10005;</button>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}

      {players.length === 0 && (
        <Card><div className="text-center py-16 space-y-3">
          <p className="text-3xl text-gray-700">&#9876;</p>
          <p className="text-gray-500">Add players to analyze your raid comp</p>
        </div></Card>
      )}
    </div>
  )
}
