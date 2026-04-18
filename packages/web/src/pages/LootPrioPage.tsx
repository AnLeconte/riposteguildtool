import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

interface LootPrioItem {
  id: string
  itemName: string
  slot: string
  boss: string
  priorities: { player: string; note: string; priority: 'bis' | 'upgrade' | 'minor' | 'offspec' }[]
}

interface LootPrioList {
  id: string
  name: string
  items: LootPrioItem[]
}

const STORAGE_KEY = 'loot-prio'
const uid = () => Math.random().toString(36).slice(2, 10)
function loadLists(): LootPrioList[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] } }
function saveLists(l: LootPrioList[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(l)) }

const PRIO_LABELS: Record<string, { label: string; color: string }> = {
  bis: { label: 'BiS', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  upgrade: { label: 'Upgrade', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  minor: { label: 'Minor', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  offspec: { label: 'Offspec', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
}

export function LootPrioPage() {
  const [lists, setLists] = useState<LootPrioList[]>(loadLists)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemSlot, setNewItemSlot] = useState('')
  const [newItemBoss, setNewItemBoss] = useState('')

  useEffect(() => { saveLists(lists) }, [lists])

  const active = lists.find((l) => l.id === activeId)

  const createList = () => {
    const list: LootPrioList = { id: uid(), name: 'New Loot Prio', items: [] }
    setLists((p) => [list, ...p])
    setActiveId(list.id)
  }

  const deleteList = (id: string) => {
    setLists((p) => p.filter((l) => l.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const updateList = (data: Partial<LootPrioList>) => {
    if (!activeId) return
    setLists((p) => p.map((l) => l.id === activeId ? { ...l, ...data } : l))
  }

  const addItem = () => {
    if (!activeId || !newItemName.trim()) return
    const item: LootPrioItem = { id: uid(), itemName: newItemName.trim(), slot: newItemSlot.trim(), boss: newItemBoss.trim(), priorities: [] }
    updateList({ items: [...(active?.items ?? []), item] })
    setNewItemName('')
    setNewItemSlot('')
    setNewItemBoss('')
  }

  const removeItem = (itemId: string) => {
    updateList({ items: (active?.items ?? []).filter((i) => i.id !== itemId) })
  }

  const addPrio = (itemId: string, player: string, priority: string) => {
    if (!player.trim()) return
    updateList({
      items: (active?.items ?? []).map((item) =>
        item.id === itemId ? { ...item, priorities: [...item.priorities, { player: player.trim(), note: '', priority: priority as any }] } : item
      ),
    })
  }

  const removePrio = (itemId: string, idx: number) => {
    updateList({
      items: (active?.items ?? []).map((item) =>
        item.id === itemId ? { ...item, priorities: item.priorities.filter((_, i) => i !== idx) } : item
      ),
    })
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Loot <span className="text-[color:var(--class-color)]">Priority</span></h1>
          <p className="text-gray-500 text-sm mt-1">Manage loot council priorities per item</p>
        </div>
        <Button onClick={createList} size="sm">New List</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Lists */}
        <div className="space-y-1">
          {lists.length === 0 && <Card className="p-3"><p className="text-gray-600 text-xs text-center">No lists</p></Card>}
          {lists.map((list) => (
            <button key={list.id} onClick={() => setActiveId(list.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                activeId === list.id ? 'bg-[color:var(--class-color)]/[0.06] border border-[color:var(--class-color)]/30' : 'border border-transparent hover:bg-white/[0.03]'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-200 truncate">{list.name}</p>
                <button onClick={(e) => { e.stopPropagation(); deleteList(list.id) }} className="text-gray-700 hover:text-red-400 text-[10px]">{'\u2715'}</button>
              </div>
              <p className="text-[10px] text-gray-600">{list.items.length} items</p>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div>
          {!active ? (
            <Card><div className="text-center py-16 space-y-3">
              <p className="text-3xl text-gray-700">{'\uD83D\uDC8E'}</p>
              <p className="text-gray-500">Select or create a loot priority list</p>
            </div></Card>
          ) : (
            <div className="space-y-4">
              <Card className="p-4">
                <input value={active.name} onChange={(e) => updateList({ name: e.target.value })}
                  className="w-full bg-transparent text-base font-semibold text-gray-200 focus:outline-none border-b border-transparent focus:border-[color:var(--class-color)]/40 pb-1" />
              </Card>

              {/* Add item */}
              <div className="flex gap-2 flex-wrap">
                <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Item name" className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && addItem()} />
                <Input value={newItemSlot} onChange={(e) => setNewItemSlot(e.target.value)} placeholder="Slot" className="w-24" />
                <Input value={newItemBoss} onChange={(e) => setNewItemBoss(e.target.value)} placeholder="Boss" className="w-32" />
                <Button onClick={addItem} size="sm" variant="secondary">Add Item</Button>
              </div>

              {/* Items */}
              {active.items.length === 0 ? (
                <Card><p className="text-gray-600 text-xs text-center py-8">Add items to assign priorities</p></Card>
              ) : (
                <div className="space-y-3">
                  {active.items.map((item) => (
                    <ItemPrioCard key={item.id} item={item}
                      onRemove={() => removeItem(item.id)}
                      onAddPrio={(player, prio) => addPrio(item.id, player, prio)}
                      onRemovePrio={(idx) => removePrio(item.id, idx)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ItemPrioCard({ item, onRemove, onAddPrio, onRemovePrio }: {
  item: LootPrioItem; onRemove: () => void
  onAddPrio: (player: string, prio: string) => void; onRemovePrio: (idx: number) => void
}) {
  const [player, setPlayer] = useState('')
  const [prio, setPrio] = useState('upgrade')

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-purple-400">{item.itemName}</h4>
          <div className="flex gap-2 mt-0.5">
            {item.slot && <span className="text-[10px] text-gray-500">{item.slot}</span>}
            {item.boss && <span className="text-[10px] text-gray-600">from {item.boss}</span>}
          </div>
        </div>
        <button onClick={onRemove} className="text-[10px] text-gray-600 hover:text-red-400">{'\u2715'}</button>
      </div>

      {/* Priority list */}
      {item.priorities.length > 0 && (
        <div className="space-y-1 mb-3">
          {item.priorities.map((p, i) => {
            const style = PRIO_LABELS[p.priority]
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600 w-4 text-right">{i + 1}.</span>
                <span className="text-xs font-medium text-gray-200">{p.player}</span>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${style?.color ?? ''}`}>
                  {style?.label ?? p.priority}
                </span>
                <button onClick={() => onRemovePrio(i)} className="text-gray-700 hover:text-red-400 text-[9px] ml-auto">{'\u2715'}</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add player prio */}
      <div className="flex gap-2">
        <Input value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="Player" className="w-28 text-xs"
          onKeyDown={(e) => { if (e.key === 'Enter') { onAddPrio(player, prio); setPlayer('') } }} />
        <Select value={prio} onChange={(e) => setPrio(e.target.value)}
          >
          <option value="bis">BiS</option>
          <option value="upgrade">Upgrade</option>
          <option value="minor">Minor</option>
          <option value="offspec">Offspec</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { onAddPrio(player, prio); setPlayer('') }}>Add</Button>
      </div>
    </Card>
  )
}
