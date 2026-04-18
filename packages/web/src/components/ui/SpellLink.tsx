import { useEffect } from 'react'

interface SpellLinkProps {
  spellId?: number
  name: string
  iconName?: string
  className?: string
  showIcon?: boolean
  iconSize?: 'tiny' | 'small' | 'medium' | 'large'
}

const ICON_SIZES = { tiny: 15, small: 18, medium: 36, large: 56 }

/**
 * Renders a spell name with Wowhead tooltip on hover.
 * Shows the spell icon inline via Wowhead CDN if iconName is provided.
 */
export function SpellLink({ spellId, name, iconName, className, showIcon = true, iconSize = 'small' }: SpellLinkProps) {
  useEffect(() => {
    if (spellId && typeof (window as any).$WowheadPower !== 'undefined') {
      (window as any).$WowheadPower.refreshLinks()
    }
  }, [spellId])

  const px = ICON_SIZES[iconSize]
  const iconUrl = iconName
    ? `https://wow.zamimg.com/images/wow/icons/${iconSize}/${iconName}.jpg`
    : undefined

  const icon = showIcon && iconUrl ? (
    <img
      src={iconUrl}
      alt=""
      className="inline-block mr-1.5 align-text-bottom rounded-sm border border-white/[0.1]"
      style={{ width: px, height: px }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  ) : null

  if (!spellId) {
    return <span className={className}>{icon}{name}</span>
  }

  return (
    <a
      href={`https://www.wowhead.com/spell=${spellId}`}
      target="_blank"
      rel="noopener noreferrer"
      data-wowhead={`spell=${spellId}`}
      className={className ?? 'text-gray-200 hover:text-[color:var(--class-color)] transition-colors'}
    >
      {icon}
      {name}
    </a>
  )
}
