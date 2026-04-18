import { useCallback, useRef, useState } from 'react'
import { Textarea } from '@/components/ui/Textarea'
import { CharacterSummary } from '@/components/sim/CharacterSummary'

interface SimcInputProps {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  label?: string
  className?: string
}

/**
 * Shared SimC string input with paste detection flash and character summary.
 * Used across all sim pages.
 */
export function SimcInput({ value, onChange, rows = 10, placeholder, label, className }: SimcInputProps) {
  const [justPasted, setJustPasted] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const handlePaste = useCallback(() => {
    setJustPasted(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setJustPasted(false), 1200)
  }, [])

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {label !== undefined && (
        <label className="text-sm font-medium text-gray-300 block">
          {label || (
            <>
              Character Profile{' '}
              <span className="text-gray-500 font-normal">
                (paste your{' '}
                <code className="text-wow-blue bg-wow-darker/80 px-1 py-0.5 rounded text-xs">/simc</code>{' '}
                string)
              </span>
            </>
          )}
        </label>
      )}

      <div className="relative">
        <Textarea
          placeholder={placeholder ?? 'Paste your /simc output here...\n\nExample:\ndeathknight="CharName"\nlevel=90\nrace=human\nspec=unholy\n...'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          rows={rows}
        />

        {/* Paste flash overlay */}
        {justPasted && (
          <div className="absolute inset-0 rounded-lg border-2 border-[color:var(--class-color)]/50 pointer-events-none animate-fade-in" />
        )}

        {/* Paste indicator badge */}
        {justPasted && (
          <div className="absolute top-2 right-2 text-[11px] font-medium text-[color:var(--class-color)] bg-[color:var(--class-color)]/10 border border-[color:var(--class-color)]/30 px-2 py-0.5 rounded-md animate-fade-in">
            Pasted
          </div>
        )}
      </div>

      <CharacterSummary simcInput={value} />
    </div>
  )
}
