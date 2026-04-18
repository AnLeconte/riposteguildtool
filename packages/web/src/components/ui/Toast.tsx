import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
  exiting?: boolean
}

interface ToastStore {
  toasts: Toast[]
  add: (type: ToastType, message: string) => void
  markExiting: (id: string) => void
  remove: (id: string) => void
}

// ── Store ────────────────────────────────────────────────────────────

let counter = 0

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = `toast-${++counter}`
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
  },
  markExiting: (id) =>
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    })),
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// ── Public API ───────────────────────────────────────────────────────

export const toast = {
  success: (message: string) => useToastStore.getState().add('success', message),
  error: (message: string) => useToastStore.getState().add('error', message),
  info: (message: string) => useToastStore.getState().add('info', message),
  warning: (message: string) => useToastStore.getState().add('warning', message),
}

// ── Styling helpers ──────────────────────────────────────────────────

const typeStyles: Record<ToastType, string> = {
  success: 'border-emerald-500/30 text-emerald-400',
  error: 'border-red-500/30 text-red-400',
  info: 'border-blue-500/30 text-wow-blue',
  warning: 'border-yellow-500/30 text-yellow-400',
}

const typeIcons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

const iconBg: Record<ToastType, string> = {
  success: 'bg-emerald-500/15',
  error: 'bg-red-500/15',
  info: 'bg-blue-500/15',
  warning: 'bg-yellow-500/15',
}

// ── Single Toast ─────────────────────────────────────────────────────

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { markExiting, remove } = useToastStore()

  const startExit = useCallback(() => {
    markExiting(t.id)
    setTimeout(() => remove(t.id), 250)
  }, [t.id, markExiting, remove])

  useEffect(() => {
    const timer = setTimeout(startExit, 4000)
    return () => clearTimeout(timer)
  }, [startExit])

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-2.5 w-80 px-3.5 py-3',
        'bg-wow-panel/95 border backdrop-blur-md rounded-xl shadow-lg shadow-black/40',
        'text-xs text-gray-200',
        typeStyles[t.type],
        t.exiting ? 'animate-fade-out' : 'animate-fade-in-up',
      )}
      role="alert"
    >
      <span
        className={cn(
          'flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold',
          iconBg[t.type],
        )}
      >
        {typeIcons[t.type]}
      </span>
      <span className="flex-1 leading-relaxed">{t.message}</span>
      <button
        onClick={() => onDismiss(t.id)}
        className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors ml-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

// ── Container (portal) ───────────────────────────────────────────────

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const { markExiting, remove } = useToastStore()

  const dismiss = useCallback(
    (id: string) => {
      markExiting(id)
      setTimeout(() => remove(id), 250)
    },
    [markExiting, remove],
  )

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>,
    document.body,
  )
}
