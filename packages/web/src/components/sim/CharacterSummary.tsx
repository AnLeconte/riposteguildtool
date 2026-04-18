import { useEffect, useMemo, useState } from 'react'
import { parseSimcString } from '@wow-simc/simc-engine'
import { api } from '@/lib/api'

interface CharacterSummaryProps {
  simcInput: string
}

const CLASS_COLORS: Record<string, string> = {
  warrior: 'text-class-warrior',
  paladin: 'text-class-paladin',
  hunter: 'text-class-hunter',
  rogue: 'text-class-rogue',
  priest: 'text-class-priest',
  death_knight: 'text-class-death-knight',
  shaman: 'text-class-shaman',
  mage: 'text-class-mage',
  warlock: 'text-class-warlock',
  monk: 'text-class-monk',
  druid: 'text-class-druid',
  demon_hunter: 'text-class-demon-hunter',
  evoker: 'text-class-evoker',
}

// Cache icons across component instances to avoid redundant fetches
const iconCache = new Map<string, { class_icon_url?: string; spec_icon_url?: string }>()

export function CharacterSummary({ simcInput }: CharacterSummaryProps) {
  const [icons, setIcons] = useState<{ class_icon_url?: string; spec_icon_url?: string }>({})

  const parsed = useMemo(() => {
    const trimmed = simcInput.trim()
    if (!trimmed) return null

    try {
      return parseSimcString(trimmed)
    } catch {
      return null
    }
  }, [simcInput])

  // Fetch class/spec icons when parsed changes
  useEffect(() => {
    if (!parsed?.class) {
      setIcons({})
      return
    }

    const cacheKey = `${parsed.class}:${parsed.spec ?? ''}`
    const cached = iconCache.get(cacheKey)
    if (cached) {
      setIcons(cached)
      return
    }

    let cancelled = false
    api.getClassIcon(parsed.class, parsed.spec)
      .then((data) => {
        if (cancelled) return
        iconCache.set(cacheKey, data)
        setIcons(data)
      })
      .catch(() => { /* skip */ })

    return () => { cancelled = true }
  }, [parsed?.class, parsed?.spec])

  if (!parsed) return null
  if (!parsed.name && !parsed.class) return null

  const classColor = parsed.class ? (CLASS_COLORS[parsed.class] ?? 'text-wow-blue') : 'text-wow-blue'
  const iconUrl = icons.spec_icon_url ?? icons.class_icon_url

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 rounded-md bg-wow-darker border border-wow-accent/20 animate-fade-in">
      {/* Class/spec icon */}
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={parsed.spec ?? parsed.class ?? ''}
          className="w-8 h-8 rounded border border-wow-accent/30 flex-shrink-0"
        />
      ) : parsed.class ? (
        <div className="w-8 h-8 rounded border border-wow-accent/30 bg-wow-accent/20 flex-shrink-0" />
      ) : null}

      {/* Character info */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {parsed.name && (
          <span className="text-sm font-semibold text-gray-200">
            {parsed.name}
          </span>
        )}
        {parsed.class && (
          <span className={`text-xs font-medium capitalize ${classColor}`}>
            {parsed.spec ? `${parsed.spec} ` : ''}
            {parsed.class.replace(/_/g, ' ')}
          </span>
        )}
        {parsed.race && (
          <span className="text-xs text-gray-500 capitalize">
            {parsed.race.replace(/_/g, ' ')}
          </span>
        )}
        {parsed.realm && (
          <span className="text-xs text-gray-500">
            {parsed.realm}
            {parsed.region ? ` (${parsed.region.toUpperCase()})` : ''}
          </span>
        )}
        {parsed.level != null && (
          <span className="text-xs text-gray-500">
            Level {parsed.level}
          </span>
        )}
        {parsed.item_level != null && parsed.item_level > 0 && (
          <span className="text-xs bg-wow-accent/40 text-[color:var(--class-color)] border border-[color:var(--class-color)]/30 px-2 py-0.5 rounded-full font-medium">
            {parsed.item_level} ilvl
          </span>
        )}
      </div>
    </div>
  )
}
