import { useEffect, useRef, useState } from 'react'

// Global cache persists across all component instances and rerenders
const iconCache = new Map<number, string>()
const failedIds = new Set<number>()

async function fetchSpellIcon(spellId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}?dataEnv=1&locale=0`)
    if (!res.ok) return null
    const data = await res.json() as { icon?: string }
    if (data.icon) {
      return `https://wow.zamimg.com/images/wow/icons/medium/${data.icon}.jpg`
    }
    return null
  } catch {
    return null
  }
}

/**
 * Hook that resolves spell icon URLs from Wowhead's tooltip API.
 * Fetches sequentially (3 at a time) to avoid rate limiting.
 * Results are cached globally.
 */
export function useSpellIcons(spellIds: number[]): Map<number, string> {
  const [version, setVersion] = useState(0)
  const fetchingRef = useRef(false)

  useEffect(() => {
    const missing = spellIds.filter((id) => id > 0 && !iconCache.has(id) && !failedIds.has(id))
    if (missing.length === 0 || fetchingRef.current) return

    fetchingRef.current = true

    const fetchBatch = async () => {
      // Fetch 3 at a time to avoid overwhelming Wowhead
      for (let i = 0; i < missing.length; i += 3) {
        const batch = missing.slice(i, i + 3)
        const results = await Promise.all(batch.map(fetchSpellIcon))
        for (let j = 0; j < batch.length; j++) {
          if (results[j]) {
            iconCache.set(batch[j], results[j]!)
          } else {
            failedIds.add(batch[j])
          }
        }
        // Trigger rerender after each batch so icons appear progressively
        setVersion((v) => v + 1)
      }
      fetchingRef.current = false
    }

    fetchBatch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spellIds.join(',')])

  const result = new Map<number, string>()
  for (const id of spellIds) {
    const url = iconCache.get(id)
    if (url) result.set(id, url)
  }
  return result
}
