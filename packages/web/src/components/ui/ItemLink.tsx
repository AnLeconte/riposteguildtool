import { useEffect, useRef } from 'react'

interface ItemLinkProps {
  itemId: number
  name: string
  ilvl?: number
  bonusIds?: number[]
  iconUrl?: string
  className?: string
}

/**
 * Renders an item name as a Wowhead-powered link with tooltip on hover.
 * Wowhead's tooltip script auto-attaches to <a> tags pointing to wowhead.com/item=X.
 */
export function ItemLink({ itemId, name, ilvl, bonusIds, iconUrl, className }: ItemLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null)

  // Tell Wowhead to rescan after React renders this link
  useEffect(() => {
    if (typeof (window as any).$WowheadPower !== 'undefined') {
      (window as any).$WowheadPower.refreshLinks()
    }
  }, [itemId])

  // Build wowhead URL with optional ilvl and bonus params
  let href = `https://www.wowhead.com/item=${itemId}`
  const params: string[] = []
  if (ilvl && ilvl > 0) params.push(`ilvl=${ilvl}`)
  if (bonusIds && bonusIds.length > 0) params.push(`bonus=${bonusIds.join(':')}`)
  if (params.length > 0) href += `&${params.join('&')}`

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-wowhead={`item=${itemId}${ilvl ? `&ilvl=${ilvl}` : ''}${bonusIds?.length ? `&bonus=${bonusIds.join(':')}` : ''}`}
      className={className ?? 'text-gray-200 hover:text-[color:var(--class-color)] transition-colors'}
    >
      {iconUrl && (
        <img
          src={iconUrl}
          alt=""
          className="w-5 h-5 rounded border border-white/[0.08] inline-block mr-1.5 align-text-bottom"
        />
      )}
      {name}
    </a>
  )
}
