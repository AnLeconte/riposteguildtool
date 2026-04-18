import { useEffect, useState } from 'react'
import { ENCOUNTERS } from '@wow-simc/shared'
import { useCooldownPlannerStore } from '@/stores/useCooldownPlannerStore'
import { api } from '@/lib/api'
import { formatTime } from '@/lib/cooldown-planner-utils'

interface RaidMeta {
  id: number
  name: string
  image_url?: string
}

export function EncounterSelector() {
  const { plan, setEncounter } = useCooldownPlannerStore()
  const [raidImages, setRaidImages] = useState<Map<string, string>>(new Map())

  // Fetch raid images
  useEffect(() => {
    api.getRaids('raid')
      .then(async (raids) => {
        const images = new Map<string, string>()
        await Promise.all(
          raids.map(async (r) => {
            try {
              const data = await api.getRaid(r.id)
              if (data.image_url) images.set(r.name, data.image_url)
            } catch { /* skip */ }
          }),
        )
        setRaidImages(images)
      })
      .catch(() => { /* skip */ })
  }, [])

  // Group encounters by raid
  const raidGroups = new Map<string, typeof ENCOUNTERS>()
  for (const enc of ENCOUNTERS) {
    const list = raidGroups.get(enc.raid) ?? []
    list.push(enc)
    raidGroups.set(enc.raid, list)
  }

  return (
    <div className="space-y-4">
      {[...raidGroups.entries()].map(([raidName, bosses]) => {
        const imageUrl = raidImages.get(raidName)

        return (
          <div key={raidName} className="space-y-2">
            {/* Raid banner */}
            <div className="relative h-16 rounded-lg overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt={raidName} className="w-full h-full object-cover brightness-50" />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-wow-accent/40 to-wow-panel" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-2 left-3">
                <p className="text-xs font-bold text-white drop-shadow-lg">{raidName}</p>
                <p className="text-[9px] text-gray-300">{bosses.length} boss{bosses.length > 1 ? 'es' : ''}</p>
              </div>
            </div>

            {/* Boss list */}
            <div className="space-y-0.5">
              {bosses.map((enc) => {
                const isSelected = plan.encounterId === enc.id
                return (
                  <button
                    key={enc.id}
                    onClick={() => setEncounter(enc.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all ${
                      isSelected
                        ? 'bg-[color:var(--class-color)]/10 text-[color:var(--class-color)] border border-[color:var(--class-color)]/30'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{enc.name}</span>
                      <span className="text-[10px] text-gray-600 tabular-nums">
                        {formatTime(enc.fightDuration)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
