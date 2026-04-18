/**
 * Convert an external image URL to use our caching proxy.
 * Images from Blizzard/Raider.io will be served via /api/img with 7-day cache.
 */
export function cachedImg(url: string | undefined | null): string | undefined {
  if (!url) return undefined

  // Only proxy known external domains
  const proxyDomains = [
    'render.worldofwarcraft.com',
    'render-eu.worldofwarcraft.com',
    'render-us.worldofwarcraft.com',
    'wow.zamimg.com',
    'cdnassets.raider.io',
  ]

  try {
    const parsed = new URL(url)
    if (proxyDomains.some((d) => parsed.hostname.endsWith(d))) {
      return `/api/img?url=${encodeURIComponent(url)}`
    }
  } catch {
    // Not a valid URL, return as-is
  }

  return url
}
