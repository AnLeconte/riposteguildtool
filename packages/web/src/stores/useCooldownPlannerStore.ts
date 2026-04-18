import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CooldownPlan, RosterHealer, PlacedCooldown, BossEncounter, HealerSpec } from '@wow-simc/shared'
import { ENCOUNTERS } from '@wow-simc/shared'

interface CooldownPlannerState {
  plan: CooldownPlan
  encounter: BossEncounter | null
  zoom: number
  selectedCdId: string | null // cooldownDefId selected for click-to-place
  selectedHealerId: string | null // which healer the selected CD belongs to

  // Actions
  setSelectedCd: (cdId: string | null, healerId?: string | null) => void
  setEncounter: (encounterId: string) => void
  setPlanName: (name: string) => void
  addHealer: (spec: HealerSpec, name: string) => void
  removeHealer: (healerId: string) => void
  renameHealer: (healerId: string, name: string) => void
  placeCooldown: (healerId: string, cooldownDefId: string, startTime: number) => void
  moveCooldown: (placementId: string, newStartTime: number) => void
  removeCooldown: (placementId: string) => void
  setZoom: (zoom: number) => void
  newPlan: () => void
  loadPlan: (plan: CooldownPlan) => void
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

const EMPTY_PLAN: CooldownPlan = {
  id: uid(),
  name: 'New Plan',
  encounterId: '',
  roster: [],
  placements: [],
}

export const useCooldownPlannerStore = create<CooldownPlannerState>()(
  persist(
    (set) => ({
      plan: { ...EMPTY_PLAN },
      encounter: null,
      zoom: 1,
      selectedCdId: null,
      selectedHealerId: null,

      setSelectedCd: (cdId, healerId = null) => set({ selectedCdId: cdId, selectedHealerId: healerId }),

      setEncounter: (encounterId) => set((s) => {
        const encounter = ENCOUNTERS.find((e) => e.id === encounterId) ?? null
        return {
          encounter,
          plan: { ...s.plan, encounterId, placements: [] },
        }
      }),

      setPlanName: (name) => set((s) => ({
        plan: { ...s.plan, name },
      })),

      addHealer: (spec, name) => set((s) => ({
        plan: {
          ...s.plan,
          roster: [...s.plan.roster, { id: uid(), spec, name }],
        },
      })),

      removeHealer: (healerId) => set((s) => ({
        plan: {
          ...s.plan,
          roster: s.plan.roster.filter((h) => h.id !== healerId),
          placements: s.plan.placements.filter((p) => p.healerId !== healerId),
        },
      })),

      renameHealer: (healerId, name) => set((s) => ({
        plan: {
          ...s.plan,
          roster: s.plan.roster.map((h) => h.id === healerId ? { ...h, name } : h),
        },
      })),

      placeCooldown: (healerId, cooldownDefId, startTime) => set((s) => ({
        plan: {
          ...s.plan,
          placements: [
            ...s.plan.placements,
            { id: uid(), healerId, cooldownDefId, startTime },
          ],
        },
      })),

      moveCooldown: (placementId, newStartTime) => set((s) => ({
        plan: {
          ...s.plan,
          placements: s.plan.placements.map((p) =>
            p.id === placementId ? { ...p, startTime: newStartTime } : p,
          ),
        },
      })),

      removeCooldown: (placementId) => set((s) => ({
        plan: {
          ...s.plan,
          placements: s.plan.placements.filter((p) => p.id !== placementId),
        },
      })),

      setZoom: (zoom) => set({ zoom }),

      newPlan: () => set({
        plan: { ...EMPTY_PLAN, id: uid() },
        encounter: null,
      }),

      loadPlan: (plan) => set({
        plan,
        encounter: ENCOUNTERS.find((e) => e.id === plan.encounterId) ?? null,
      }),
    }),
    {
      name: 'cooldown-planner',
    },
  ),
)
