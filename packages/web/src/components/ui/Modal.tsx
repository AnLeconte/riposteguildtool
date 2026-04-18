import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  variant?: 'danger' | 'default'
}

export function Modal({ open, onClose, title, description, children, confirmLabel, cancelLabel, onConfirm, variant = 'default' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-wow-panel border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 w-full max-w-sm mx-4 animate-scale-in">
        <div className="p-5 space-y-3">
          <h2 className="text-base font-bold text-white">{title}</h2>
          {description && <p className="text-sm text-gray-400">{description}</p>}
          {children}
        </div>

        {(onConfirm || cancelLabel) && (
          <div className="flex gap-2 px-5 pb-5">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              {cancelLabel ?? 'Cancel'}
            </Button>
            {onConfirm && (
              <Button
                onClick={() => { onConfirm(); onClose() }}
                className={`flex-1 ${variant === 'danger' ? 'bg-red-500 hover:bg-red-600 border-red-500/30' : ''}`}
              >
                {confirmLabel ?? 'Confirm'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
