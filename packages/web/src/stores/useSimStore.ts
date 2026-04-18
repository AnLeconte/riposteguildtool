import { create } from 'zustand'
import type { SimStatus } from '@wow-simc/shared'

interface SimState {
  currentSimId: string | null
  status: SimStatus | null
  progress: number
  result: any | null
  error: string | null
  setSimId: (id: string) => void
  setStatus: (status: SimStatus) => void
  setProgress: (progress: number) => void
  setResult: (result: any) => void
  setError: (error: string) => void
  reset: () => void
}

export const useSimStore = create<SimState>((set) => ({
  currentSimId: null,
  status: null,
  progress: 0,
  result: null,
  error: null,
  setSimId: (id) => set({ currentSimId: id, status: 'queued', progress: 0, result: null, error: null }),
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setResult: (result) => set({ result, status: 'completed', progress: 100 }),
  setError: (error) => set({ error, status: 'failed' }),
  reset: () => set({ currentSimId: null, status: null, progress: 0, result: null, error: null }),
}))
