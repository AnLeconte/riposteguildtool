import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

export interface SavedCharacter {
  id: string
  name: string
  realm: string
  region: string
  class: string
  spec: string
  ilvl: number
  avatarUrl?: string
  guild?: string
  guildRealm?: string
}

interface CharacterState {
  characters: SavedCharacter[]
  activeId: string | null
  addCharacter: (char: Omit<SavedCharacter, 'id'>) => void
  removeCharacter: (id: string) => void
  setActive: (id: string) => void
  getActive: () => SavedCharacter | null
  updateCharacter: (id: string, data: Partial<SavedCharacter>) => void
  refreshCharacter: (id: string) => Promise<void>
}

const uid = () => Math.random().toString(36).slice(2, 10)

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set, get) => ({
      characters: [],
      activeId: null,

      addCharacter: (char) => {
        const id = uid()
        const isFirst = get().characters.length === 0
        set((s) => ({
          characters: [...s.characters, { ...char, id }],
          activeId: isFirst ? id : s.activeId,
        }))
        // If this is the first character, sync it as main
        if (isFirst) {
          api.setMainCharacter({
            name: char.name, realm: char.realm, region: char.region,
            class: char.class, spec: char.spec,
          }).catch(() => {})
        }
      },

      removeCharacter: (id) => set((s) => ({
        characters: s.characters.filter((c) => c.id !== id),
        activeId: s.activeId === id ? (s.characters.find((c) => c.id !== id)?.id ?? null) : s.activeId,
      })),

      setActive: (id) => {
        set({ activeId: id })
        // Sync main character to server for Discord bot integration
        const char = get().characters.find((c) => c.id === id)
        if (char) {
          api.setMainCharacter({
            name: char.name, realm: char.realm, region: char.region,
            class: char.class, spec: char.spec,
          }).catch(() => {})
        }
      },

      getActive: () => {
        const s = get()
        return s.characters.find((c) => c.id === s.activeId) ?? null
      },

      updateCharacter: (id, data) => set((s) => ({
        characters: s.characters.map((c) => c.id === id ? { ...c, ...data } : c),
      })),

      refreshCharacter: async (id) => {
        const char = get().characters.find((c) => c.id === id)
        if (!char) return
        try {
          const profile = await api.getCharacterProfile(char.realm, char.name, char.region)
          set((s) => ({
            characters: s.characters.map((c) =>
              c.id === id
                ? {
                    ...c,
                    ilvl: profile.equippedIlvl ?? c.ilvl,
                    spec: profile.spec ?? c.spec,
                    avatarUrl: profile.avatarUrl ?? c.avatarUrl,
                  }
                : c,
            ),
          }))
        } catch {
          // silently fail — profile endpoint may be unavailable
        }
      },
    }),
    { name: 'wow-characters' },
  ),
)
