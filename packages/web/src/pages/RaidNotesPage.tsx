import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { ENCOUNTERS } from '@wow-simc/shared'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface RaidNote { id: string; encounterId: string; title: string; content: string; createdAt: string }

const STORAGE_KEY = 'raid-notes'
const uid = () => Math.random().toString(36).slice(2, 10)
function loadNotes(): RaidNote[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] } }
function saveNotes(notes: RaidNote[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)) }

const raidGroups = new Map<string, typeof ENCOUNTERS>()
for (const e of ENCOUNTERS) { raidGroups.set(e.raid, [...(raidGroups.get(e.raid) ?? []), e]) }

export function RaidNotesPage() {
  const [notes, setNotes] = useState<RaidNote[]>(loadNotes)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [encounterId, setEncounterId] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { saveNotes(notes) }, [notes])

  const activeNote = notes.find((n) => n.id === activeId)

  const createNote = () => {
    const note: RaidNote = { id: uid(), encounterId: '', title: 'New Note', content: '', createdAt: new Date().toISOString() }
    setNotes((prev) => [note, ...prev])
    selectNote(note)
  }

  const selectNote = (note: RaidNote) => {
    setActiveId(note.id)
    setTitle(note.title)
    setContent(note.content)
    setEncounterId(note.encounterId)
  }

  const saveCurrentNote = useCallback(() => {
    if (!activeId) return
    setNotes((prev) => prev.map((n) => n.id === activeId ? { ...n, title, content, encounterId } : n))
  }, [activeId, title, content, encounterId])

  // Auto-save on change
  useEffect(() => { saveCurrentNote() }, [title, content, encounterId, saveCurrentNote])

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (activeId === id) { setActiveId(null); setTitle(''); setContent(''); setEncounterId('') }
  }

  const exportForAddon = () => {
    if (!activeNote) return
    const payload = [activeNote.id, activeNote.title, activeNote.encounterId, activeNote.content].join('|')
    const encoded = btoa(unescape(encodeURIComponent(payload)))
    const code = `RRT:v1:notes:${encoded}`
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const encounter = ENCOUNTERS.find((e) => e.id === encounterId)

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Raid <span className="text-[color:var(--class-color)]">Notes</span></h1>
          <p className="text-gray-500 text-sm mt-1">Create raid notes and export to Riposte Guild Tool addon</p>
        </div>
        <Button onClick={createNote} size="sm">New Note</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Notes list */}
        <div className="space-y-1">
          {notes.length === 0 && (
            <Card><p className="text-gray-600 text-xs text-center py-6">No notes yet</p></Card>
          )}
          {notes.map((note) => {
            const enc = ENCOUNTERS.find((e) => e.id === note.encounterId)
            return (
              <button key={note.id} onClick={() => selectNote(note)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                  activeId === note.id ? 'bg-[color:var(--class-color)]/[0.06] border border-[color:var(--class-color)]/30' : 'border border-transparent hover:bg-white/[0.03]'
                }`}>
                <p className="text-sm font-medium text-gray-200 truncate">{note.title}</p>
                <p className="text-[10px] text-gray-600 truncate">{enc?.name ?? 'No boss assigned'}</p>
              </button>
            )
          })}
        </div>

        {/* Editor */}
        <div>
          {!activeId ? (
            <Card><div className="text-center py-16 space-y-3">
              <p className="text-3xl text-gray-700">&#128221;</p>
              <p className="text-gray-500">Select or create a note</p>
            </div></Card>
          ) : (
            <div className="space-y-4">
              <Card className="p-4 space-y-3">
                <div className="flex gap-3">
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    className="flex-1 bg-transparent text-base font-semibold text-gray-200 focus:outline-none border-b border-transparent focus:border-[color:var(--class-color)]/40 pb-1"
                    placeholder="Note title..." />
                  <Select value={encounterId} onChange={(e) => setEncounterId(e.target.value)}
                    >
                    <option value="">No boss</option>
                    {[...raidGroups.entries()].map(([raid, bosses]) => (
                      <optgroup key={raid} label={raid}>
                        {bosses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </optgroup>
                    ))}
                  </Select>
                </div>
                {encounter && (
                  <p className="text-[10px] text-gray-600">{encounter.raid} — {encounter.abilities.length} abilities</p>
                )}
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-400">Note Content (MRT format)</label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={exportForAddon}>
                      {copied ? 'Copied!' : 'Export RRT'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteNote(activeId)}
                      className="text-red-400/70 hover:text-red-400">Delete</Button>
                  </div>
                </div>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)}
                  rows={20} placeholder={'{time:0:25} Use Aura Mastery - Paladin\n{time:0:55} Spirit Link Totem - Shaman\n{time:1:30} Tranquility - Druid\n\nFormat:\n{time:M:SS} Assignment text\n{spell:12345} Spell reference'} />
                <p className="text-[10px] text-gray-600">
                  Use <code className="text-wow-blue">{'{spell:ID}'}</code> for spells, <code className="text-wow-blue">{'{tank}'}</code> <code className="text-wow-blue">{'{heal}'}</code> <code className="text-wow-blue">{'{dps}'}</code> for roles. Click "Export RRT" to copy the code for the addon.
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
