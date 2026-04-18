import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from '@/components/ui/Toast'
import { Link, useSearchParams } from 'react-router-dom'

const CLASSES = [
  'Death Knight', 'Demon Hunter', 'Druid', 'Evoker', 'Hunter',
  'Mage', 'Monk', 'Paladin', 'Priest', 'Rogue',
  'Shaman', 'Warlock', 'Warrior',
]

const SPECS: Record<string, string[]> = {
  'Death Knight': ['Blood', 'Frost', 'Unholy'],
  'Demon Hunter': ['Havoc', 'Vengeance'],
  'Druid': ['Balance', 'Feral', 'Guardian', 'Restoration'],
  'Evoker': ['Devastation', 'Preservation', 'Augmentation'],
  'Hunter': ['Beast Mastery', 'Marksmanship', 'Survival'],
  'Mage': ['Arcane', 'Fire', 'Frost'],
  'Monk': ['Brewmaster', 'Mistweaver', 'Windwalker'],
  'Paladin': ['Holy', 'Protection', 'Retribution'],
  'Priest': ['Discipline', 'Holy', 'Shadow'],
  'Rogue': ['Assassination', 'Outlaw', 'Subtlety'],
  'Shaman': ['Elemental', 'Enhancement', 'Restoration'],
  'Warlock': ['Affliction', 'Demonology', 'Destruction'],
  'Warrior': ['Arms', 'Fury', 'Protection'],
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export function ApplyPage() {
  const [searchParams] = useSearchParams()
  const [discordUser, setDiscordUser] = useState<{ id: string; username: string; avatar?: string } | null>(null)
  const [discordLoading, setDiscordLoading] = useState(false)

  // Check if returning from Discord OAuth
  useEffect(() => {
    const discordData = searchParams.get('discord_user')
    if (discordData) {
      try {
        const parsed = JSON.parse(atob(discordData))
        setDiscordUser(parsed)
      } catch { /* ignore */ }
      window.history.replaceState({}, '', '/apply')
    }
    // Check localStorage for saved discord info
    const saved = localStorage.getItem('apply_discord')
    if (saved) {
      try { setDiscordUser(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [searchParams])

  // Save discord info when received
  useEffect(() => {
    if (discordUser) {
      localStorage.setItem('apply_discord', JSON.stringify(discordUser))
    }
  }, [discordUser])

  const handleDiscordLogin = () => {
    setDiscordLoading(true)
    window.location.href = '/api/auth/discord-apply'
  }

  const [charName, setCharName] = useState('')
  const [realm, setRealm] = useState('')
  const [mainClass, setMainClass] = useState('')
  const [mainSpec, setMainSpec] = useState('')
  const [offSpec, setOffSpec] = useState('')
  const [alts, setAlts] = useState<Array<{ name: string; class: string; spec: string }>>([])

  const addAlt = () => setAlts(prev => [...prev, { name: '', class: '', spec: '' }])
  const removeAlt = (i: number) => setAlts(prev => prev.filter((_, idx) => idx !== i))
  const updateAlt = (i: number, field: string, value: string) => {
    setAlts(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value, ...(field === 'class' ? { spec: '' } : {}) } : a))
  }
  const [ilvl, setIlvl] = useState('')
  const [raidExp, setRaidExp] = useState('')
  const [logsUrl, setLogsUrl] = useState('')
  const [rioUrl, setRioUrl] = useState('')
  const [availability, setAvailability] = useState<Record<string, boolean>>({})
  const [timeSlot, setTimeSlot] = useState('20h-23h')
  const [about, setAbout] = useState('')
  const [discord, setDiscord] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const toggleDay = (day: string) => {
    setAvailability(prev => ({ ...prev, [day]: !prev[day] }))
  }

  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!charName || !mainClass || !mainSpec) {
      toast.error('Remplissez le nom, la classe et la spé')
      return
    }
    if (!logsUrl) {
      toast.error('Le lien Warcraft Logs est obligatoire')
      return
    }
    if (!rioUrl) {
      toast.error('Le lien Raider.io est obligatoire')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charName,
          realm,
          mainClass,
          mainSpec,
          offSpec: offSpec || undefined,
          alts: alts.filter(a => a.name || a.class),
          ilvl,
          raidExp,
          logsUrl: logsUrl || undefined,
          rioUrl: rioUrl || undefined,
          discord: discordUser?.username || discord,
          discordId: discordUser?.id,
          availability: DAYS.filter(d => availability[d]).join(', '),
          timeSlot,
          about: about || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Candidature transmise aux officiers !')
        setSubmitted(true)
      } else {
        toast.error('Erreur lors de l\'envoi')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 1: Discord login required
  if (!discordUser) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-8 animate-fade-in-up">
          <img src="/riposte-logo.jpg" alt="Riposte" className="w-20 h-20 rounded-2xl mx-auto border border-white/[0.1]" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">
              Rejoindre <span className="text-[color:var(--class-color)]">Riposte</span>
            </h1>
            <p className="text-gray-500 text-sm">Connectez-vous avec Discord pour commencer votre candidature</p>
          </div>
          <Button onClick={handleDiscordLogin} size="lg" disabled={discordLoading} className="w-full max-w-xs mx-auto">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            {discordLoading ? 'Redirection...' : 'Se connecter avec Discord'}
          </Button>
          <Link to="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors block">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <span className="text-green-400 text-2xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Candidature envoyée !</h1>
          <p className="text-gray-400 text-sm">
            Votre candidature a été transmise aux officiers de la guilde.
          </p>
          <p className="text-gray-500 text-xs">
            Un officier vous contactera pour planifier un entretien vocal.
          </p>
          <a
            href="https://discord.gg/PSSbA68wjX"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            Rejoindre le Discord
          </a>
          <Link to="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors block mt-2">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-4">
      <div className="max-w-3xl w-full animate-fade-in-up">

        {/* Header compact */}
        <div className="text-center mb-4 flex items-center justify-center gap-3">
          <img src="/riposte-logo.jpg" alt="Riposte" className="w-10 h-10 rounded-lg border border-white/[0.1]" />
          <h1 className="text-xl font-bold text-white">
            Rejoindre <span className="text-[color:var(--class-color)]">Riposte</span>
          </h1>
        </div>

        {/* Form — 2 columns */}
        <Card className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* LEFT COLUMN */}
            <div className="space-y-3">
              {/* Main character */}
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">Personnage principal</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={charName} onChange={e => setCharName(e.target.value)} placeholder="Nom" />
                <Input value={realm} onChange={e => setRealm(e.target.value)} placeholder="Serveur" />
                <Select value={mainClass} onChange={e => { setMainClass(e.target.value); setMainSpec('') }}>
                  <option value="">Classe...</option>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Select value={mainSpec} onChange={e => setMainSpec(e.target.value)}>
                  <option value="">Spé...</option>
                  {(SPECS[mainClass] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" value={ilvl} onChange={e => setIlvl(e.target.value)} placeholder="ilvl" />
                <Select value={offSpec} onChange={e => setOffSpec(e.target.value)}>
                  <option value="">Spé secondaire...</option>
                  {(SPECS[mainClass] || []).filter(s => s !== mainSpec).map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>

              {/* Alts */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">Alts (optionnel)</p>
                <button onClick={addAlt} className="text-[10px] text-[color:var(--class-color)] hover:underline">+ Ajouter</button>
              </div>
              {alts.map((alt, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center">
                  <Input value={alt.name} onChange={e => updateAlt(i, 'name', e.target.value)} placeholder="Nom" />
                  <Select value={alt.class} onChange={e => updateAlt(i, 'class', e.target.value)}>
                    <option value="">Classe</option>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Select value={alt.spec} onChange={e => updateAlt(i, 'spec', e.target.value)}>
                    <option value="">Spé</option>
                    {(SPECS[alt.class] || []).map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                  <button onClick={() => removeAlt(i)} className="text-gray-600 hover:text-red-400 text-xs transition-colors">✕</button>
                </div>
              ))}

              {/* Links */}
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600 pt-1">Liens</p>
              <Input value={logsUrl} onChange={e => setLogsUrl(e.target.value)} placeholder="Warcraft Logs *" />
              <Input value={rioUrl} onChange={e => setRioUrl(e.target.value)} placeholder="Raider.io *" />

              {/* Discord badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-wow-darker">
                <svg className="w-3.5 h-3.5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                <span className="text-xs text-indigo-400 font-medium">{discordUser?.username || discord}</span>
                <span className="text-[9px] text-green-400 ml-auto">Connecté</span>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-3">
              {/* Raid exp */}
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">Experience raid</p>
              <Textarea value={raidExp} onChange={e => setRaidExp(e.target.value)} rows={2}
                placeholder="CE Voidspire, 8/8 HM, 3200 M+..." />

              {/* Availability */}
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600 pt-1">Disponibilités entretien vocal</p>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map(day => (
                  <button key={day} onClick={() => toggleDay(day)}
                    className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                      availability[day]
                        ? 'border-[color:var(--class-color)]/40 bg-[color:var(--class-color)]/10 text-[color:var(--class-color)]'
                        : 'border-white/[0.06] text-gray-500 hover:text-gray-300'
                    }`}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
              <Select value={timeSlot} onChange={e => setTimeSlot(e.target.value)}>
                <option value="14h-17h">14h - 17h</option>
                <option value="17h-20h">17h - 20h</option>
                <option value="20h-23h">20h - 23h</option>
                <option value="flexible">Flexible</option>
              </Select>

              {/* About */}
              <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600 pt-1">Un mot sur vous (optionnel)</p>
              <Textarea value={about} onChange={e => setAbout(e.target.value)} rows={2}
                placeholder="Motivation, ce que vous recherchez..." />

              {/* Submit */}
              <Button onClick={handleSubmit} disabled={submitting} className="w-full mt-2">
                {submitting ? 'Envoi en cours...' : 'Envoyer la candidature'}
              </Button>
            </div>
          </div>
        </Card>

        <div className="text-center mt-3">
          <Link to="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">← Retour</Link>
        </div>
      </div>
    </div>
  )
}
