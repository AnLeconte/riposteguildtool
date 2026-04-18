import type { PlacedCooldown, HealerCooldownDef } from '@wow-simc/shared'
import { getCooldownDef } from '@wow-simc/shared'

export interface CooldownConflict {
  placementId: string
  reason: string
}

/**
 * Detect conflicts: same healer using the same CD before it's off cooldown.
 */
export function getConflicts(placements: PlacedCooldown[]): CooldownConflict[] {
  const conflicts: CooldownConflict[] = []

  for (let i = 0; i < placements.length; i++) {
    const a = placements[i]
    const cdA = getCooldownDef(a.cooldownDefId)
    if (!cdA) continue

    for (let j = i + 1; j < placements.length; j++) {
      const b = placements[j]
      if (a.healerId !== b.healerId || a.cooldownDefId !== b.cooldownDefId) continue

      const [first, second] = a.startTime <= b.startTime ? [a, b] : [b, a]
      if (second.startTime < first.startTime + cdA.cooldownDuration) {
        conflicts.push({
          placementId: second.id,
          reason: `${cdA.name} not ready (${Math.ceil(first.startTime + cdA.cooldownDuration - second.startTime)}s remaining)`,
        })
      }
    }
  }

  return conflicts
}

/** Convert seconds to MM:SS format */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Pixels per second at a given zoom level */
export function pxPerSec(zoom: number): number {
  return 3 + zoom * 2 // zoom 0 = 3px/s, zoom 1 = 5px/s, zoom 2 = 7px/s
}

/** Snap time to grid (5-second intervals) */
export function snapToGrid(seconds: number): number {
  return Math.round(seconds / 5) * 5
}

/** Encode plan to shareable URL hash */
export function encodePlan(plan: object): string {
  return btoa(JSON.stringify(plan))
}

/** Decode plan from URL hash */
export function decodePlan(hash: string): object | null {
  try {
    return JSON.parse(atob(hash))
  } catch {
    return null
  }
}
