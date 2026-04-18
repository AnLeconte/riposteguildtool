import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface Macro {
  id: string
  name: string
  class: string
  spec: string
  category: string
  content: string
  description: string
  createdAt: string
}

const STORAGE_KEY = 'macro-library'
const uid = () => Math.random().toString(36).slice(2, 10)
function loadMacros(): Macro[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] } }
function saveMacros(m: Macro[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)) }

const CLASSES = ['All', 'Death Knight', 'Demon Hunter', 'Druid', 'Evoker', 'Hunter', 'Mage', 'Monk', 'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior']
const CATEGORIES = ['All', 'DPS', 'Healing', 'Tank', 'PvP', 'Utility', 'Mouseover', 'Focus', 'Cancelaura', 'Other']

export function MacroLibraryPage() {
  const [macros, setMacros] = useState<Macro[]>(loadMacros)
  const [filter, setFilter] = useState({ class: 'All', category: 'All', search: '' })
  const [editing, setEditing] = useState<Macro | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // New macro form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', class: 'All', spec: '', category: 'DPS', content: '', description: '' })

  useEffect(() => { saveMacros(macros) }, [macros])

  const filtered = macros.filter((m) => {
    if (filter.class !== 'All' && m.class !== filter.class && m.class !== 'All') return false
    if (filter.category !== 'All' && m.category !== filter.category) return false
    if (filter.search && !m.name.toLowerCase().includes(filter.search.toLowerCase()) && !m.content.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })

  const addMacro = () => {
    if (!form.name.trim() || !form.content.trim()) return
    const macro: Macro = { id: uid(), ...form, createdAt: new Date().toISOString() }
    setMacros((prev) => [macro, ...prev])
    setForm({ name: '', class: 'All', spec: '', category: 'DPS', content: '', description: '' })
    setShowForm(false)
  }

  const deleteMacro = (id: string) => setMacros((prev) => prev.filter((m) => m.id !== id))

  const copyMacro = (macro: Macro) => {
    navigator.clipboard.writeText(macro.content)
    setCopied(macro.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const startEdit = (macro: Macro) => {
    setEditing(macro)
    setForm({ name: macro.name, class: macro.class, spec: macro.spec, category: macro.category, content: macro.content, description: macro.description })
    setShowForm(true)
  }

  const saveEdit = () => {
    if (!editing || !form.name.trim() || !form.content.trim()) return
    setMacros((prev) => prev.map((m) => m.id === editing.id ? { ...m, ...form } : m))
    setEditing(null)
    setForm({ name: '', class: 'All', spec: '', category: 'DPS', content: '', description: '' })
    setShowForm(false)
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Macro" highlight="Library" description="Save, organize, and share your WoW macros"
        actions={<Button onClick={() => { setEditing(null); setForm({ name: '', class: 'All', spec: '', category: 'DPS', content: '', description: '' }); setShowForm(!showForm) }} size="sm">{showForm ? 'Cancel' : 'New Macro'}</Button>} />

      {/* Create/Edit form */}
      {showForm && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">{editing ? 'Edit Macro' : 'New Macro'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Macro name" />
            <Select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}
              >
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} placeholder="Spec (optional)" />
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
              {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description (optional)" />
          <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5}
            placeholder={'#showtooltip\n/cast [@mouseover,help,nodead][@player] Spell Name'} className="font-mono text-xs" />
          <Button onClick={editing ? saveEdit : addMacro} disabled={!form.name.trim() || !form.content.trim()} size="sm">
            {editing ? 'Save Changes' : 'Add Macro'}
          </Button>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Input value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          placeholder="Search macros..." className="w-48" />
        <Select value={filter.class} onChange={(e) => setFilter({ ...filter, class: e.target.value })}
          >
          {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <span className="text-[11px] text-gray-600 self-center ml-auto">{filtered.length} macros</span>
      </div>

      {/* Macro list */}
      {filtered.length === 0 ? (
        <Card><div className="text-center py-16 space-y-3">
          <p className="text-3xl text-gray-700">&#9000;</p>
          <p className="text-gray-500">{macros.length === 0 ? 'No macros saved yet' : 'No macros match your filters'}</p>
        </div></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((macro) => (
            <Card key={macro.id} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">{macro.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {macro.class !== 'All' && (
                      <span className="text-[10px] font-medium text-wow-blue bg-wow-blue/10 border border-wow-blue/20 px-1.5 py-0.5 rounded">{macro.class}</span>
                    )}
                    {macro.spec && <span className="text-[10px] text-gray-500">{macro.spec}</span>}
                    <span className="text-[10px] font-medium text-gray-500 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">{macro.category}</span>
                  </div>
                  {macro.description && <p className="text-xs text-gray-500 mt-1.5">{macro.description}</p>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => copyMacro(macro)}>
                    {copied === macro.id ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(macro)}>Edit</Button>
                  <button onClick={() => deleteMacro(macro.id)} className="text-[10px] text-gray-600 hover:text-red-400 transition-colors px-2">&#10005;</button>
                </div>
              </div>
              <pre className="text-xs font-mono text-gray-300 bg-wow-darker/60 border border-white/[0.06] rounded-lg px-4 py-3 overflow-x-auto whitespace-pre-wrap">
                {macro.content}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
