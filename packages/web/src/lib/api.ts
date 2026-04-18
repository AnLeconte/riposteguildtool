import type { ApiResponse, SimOptions } from '@wow-simc/shared'
import { useAuthStore } from '@/stores/useAuthStore'
import { apiCache, invalidateCache } from '@/lib/api-cache'

const BASE_URL = '/api'

// Cache TTLs
const SHORT = 30_000     // 30s — fast-changing data
const MEDIUM = 120_000   // 2min — guild/character data
const LONG = 600_000     // 10min — static-ish data (raids, affixes)

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    ...options,
  })
  const json = await res.json()
  if (!res.ok) {
    if (res.status === 401) {
      // Token expired or invalid — auto logout
      const { useAuthStore } = await import('@/stores/useAuthStore')
      useAuthStore.getState().logout()
    }
    throw new Error(json.error || 'Request failed')
  }
  // Unwrap { success, data } envelope if present
  if (json.success !== undefined && json.data !== undefined) {
    return json.data as T
  }
  return json as T
}

export { invalidateCache }

export const api = {
  quickSim: (simc_input: string, sim_options?: Partial<SimOptions>) =>
    request<{ id: string; status: string }>('/sim/quick-sim', {
      method: 'POST',
      body: JSON.stringify({ simc_input, sim_options }),
    }),

  topGear: (simc_input: string, candidates: string, sim_options?: Partial<SimOptions>) =>
    request<{ id: string; status: string }>('/sim/top-gear', {
      method: 'POST',
      body: JSON.stringify({ simc_input, candidates, sim_options }),
    }),

  statWeights: (simc_input: string, sim_options?: Partial<SimOptions>) =>
    request<{ id: string; status: string }>('/sim/stat-weights', {
      method: 'POST',
      body: JSON.stringify({ simc_input, sim_options }),
    }),

  advanced: (simc_input: string, sim_options?: Partial<SimOptions>) =>
    request<{ id: string; status: string }>('/sim/advanced', {
      method: 'POST',
      body: JSON.stringify({ simc_input, sim_options }),
    }),

  getSimulation: (id: string) =>
    request<any>(`/sim/${id}`),

  cancelSimulation: (id: string) =>
    request<{ id: string; status: string }>(`/sim/${id}`, { method: 'DELETE' }),

  importSimcString: (simc_string: string) =>
    request<any>('/character/import-simc', {
      method: 'POST',
      body: JSON.stringify({ simc_string }),
    }),

  getHistory: (limit = 20, mine = false) =>
    request<any[]>(`/sim/history?limit=${limit}${mine ? '&mine=true' : ''}`),

  droptimizer: (simc_input: string, raid_ids: number[], boss_ids?: number[], difficulty?: string, sim_options?: Partial<SimOptions>) =>
    request<{ id: string; status: string }>('/sim/droptimizer', {
      method: 'POST',
      body: JSON.stringify({ simc_input, raid_ids, boss_ids, difficulty, sim_options }),
    }),

  gearCompare: (simc_input_a: string, simc_input_b: string, name_a?: string, name_b?: string, sim_options?: Partial<SimOptions>) =>
    request<{ id: string; status: string }>('/sim/gear-compare', {
      method: 'POST',
      body: JSON.stringify({ simc_input_a, simc_input_b, name_a, name_b, sim_options }),
    }),

  getRaids: (type?: 'raid' | 'dungeon') =>
    apiCache(`raids:${type ?? 'all'}`, () =>
      request<Array<{ id: number; blizzard_id: number; name: string; type: 'raid' | 'dungeon'; boss_count: number }>>(
        `/data/raids${type ? `?type=${type}` : ''}`,
      ), LONG),

  getRaid: (id: number, region?: string) =>
    apiCache(`raid:${id}:${region ?? 'us'}`, () =>
      request<any>(
        `/data/raid/${id}${region ? `?region=${region}` : ''}`,
      ), LONG),

  getNews: () =>
    apiCache('news', () =>
      request<Array<{ title: string; link: string; description: string; category: string; date: string; image?: string }>>('/data/news'),
    LONG),

  getAffixes: () =>
    apiCache('affixes', () =>
      request<{ title: string; affixes: Array<{ id: number; name: string; description: string; iconUrl: string; wowheadUrl: string }> }>('/data/affixes'),
    LONG),

  getItemMedia: (itemId: number, region?: string) =>
    apiCache(`item-media:${itemId}:${region ?? 'us'}`, () =>
      request<{ icon_url?: string }>(
        `/data/item/${itemId}/media${region ? `?region=${region}` : ''}`,
      ), LONG),

  getItemsBatch: (ids: number[], region?: string) =>
    apiCache(`items-batch:${ids.join(',')}:${region ?? 'us'}`, () =>
      request<Record<number, { name?: string; icon_url?: string }>>(
        `/data/items/batch?ids=${ids.join(',')}${region ? `&region=${region}` : ''}`,
      ), LONG),

  getSpellIcons: (spellIds: number[]) =>
    apiCache(`spell-icons:${spellIds.join(',')}`, () =>
      request<Record<number, string>>(
        `/data/spells/icons?ids=${spellIds.join(',')}`,
      ), LONG),

  getClassIcon: (wowClass: string, spec?: string) =>
    apiCache(`class-icon:${wowClass}:${spec ?? ''}`, () =>
      request<{ class_icon_url?: string; spec_icon_url?: string }>(
        `/data/class-icon?class=${encodeURIComponent(wowClass)}${spec ? `&spec=${encodeURIComponent(spec)}` : ''}`,
      ), LONG),

  getBnetAuthUrl: () =>
    request<{ url: string; state: string }>('/auth/bnet'),

  bnetCallback: (code: string, state: string) =>
    request<{ user: any; token: string; characters: any[] }>('/auth/bnet/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    }),

  getMe: () => request<any>('/auth/me'),

  getDiscordAuthUrl: () =>
    request<{ url: string }>('/auth/discord'),

  unlinkDiscord: () =>
    request<any>('/auth/link-discord', { method: 'DELETE' }),

  setMainCharacter: (char: { name: string; realm: string; region: string; class: string; spec: string }) =>
    request<any>('/auth/main-character', {
      method: 'PUT',
      body: JSON.stringify(char),
    }),

  getCharacterProfile: (realm: string, name: string, region = 'eu') =>
    apiCache(`char:${realm}:${name}:${region}`, () =>
      request<any>(`/character/profile/${encodeURIComponent(realm)}/${encodeURIComponent(name)}?region=${region}`),
    MEDIUM),

  getIlvlHistory: (realm: string, name: string, region = 'eu') =>
    apiCache(`ilvl:${realm}:${name}:${region}`, () =>
      request<Array<{ ilvl: number; recorded_at: string }>>(`/character/ilvl-history/${encodeURIComponent(realm)}/${encodeURIComponent(name)}?region=${region}`),
    MEDIUM),

  // Guild
  getGuildMythicPlus: (realm: string, guild: string, region = 'eu', limit = 50) =>
    apiCache(`guild-mplus:${realm}:${guild}:${region}:${limit}`, () =>
      request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/mythic-plus?region=${region}&limit=${limit}`),
    MEDIUM),

  getGuildRoster: (realm: string, guild: string, region = 'eu') =>
    apiCache(`guild-roster:${realm}:${guild}:${region}`, () =>
      request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/roster?region=${region}`),
    MEDIUM),

  getGuildProgression: (realm: string, guild: string, region = 'eu') =>
    apiCache(`guild-prog:${realm}:${guild}:${region}`, () =>
      request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/progression?region=${region}`),
    MEDIUM),

  getGuildTimeline: (realm: string, guild: string, region = 'eu') =>
    apiCache(`guild-timeline:${realm}:${guild}:${region}`, () =>
      request<any[]>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/timeline?region=${region}`),
    MEDIUM),

  getGuildBossPulls: (realm: string, guild: string, boss: string, region = 'eu') =>
    request<{ boss: string; pulls: Array<{ pull: number; percent: number; kill: boolean; duration: number; date: string; reportCode: string }> }>(
      `/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/boss-pulls?boss=${encodeURIComponent(boss)}&region=${region}`,
    ),

  getGuildAttendance: (realm: string, guild: string, region = 'eu') =>
    request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/attendance?region=${region}`),

  getGuildPerformance: (realm: string, guild: string, region = 'eu') =>
    apiCache(`guild-perf:${realm}:${guild}:${region}`, () =>
      request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/performance?region=${region}`),
    MEDIUM),

  getGuildAudit: (realm: string, guild: string, region = 'eu') =>
    apiCache(`guild-audit:${realm}:${guild}:${region}`, () =>
      request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/audit?region=${region}`),
    MEDIUM),

  getGuildRaiderio: (realm: string, guild: string, region = 'eu') =>
    apiCache(`guild-rio:${realm}:${guild}:${region}`, () =>
      request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/raiderio?region=${region}`),
    MEDIUM),

  // Raid Events
  getGuildEvents: (realm: string, guild: string, region = 'eu') =>
    apiCache(`guild-events:${realm}:${guild}:${region}`, () =>
      request<any[]>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/events?region=${region}`),
    SHORT),

  getGuildEvent: (realm: string, guild: string, eventId: string, region = 'eu') =>
    apiCache(`guild-event:${realm}:${guild}:${eventId}:${region}`, () =>
      request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/events/${eventId}?region=${region}`),
    SHORT),

  createGuildEvent: (realm: string, guild: string, data: any, region = 'eu') =>
    request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/events?region=${region}`, {
      method: 'POST', body: JSON.stringify(data),
    }).then((r) => { invalidateCache('guild-events'); return r }),

  signupForEvent: (realm: string, guild: string, eventId: string, data: any, region = 'eu') =>
    request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/events/${eventId}/signup?region=${region}`, {
      method: 'POST', body: JSON.stringify(data),
    }).then((r) => { invalidateCache('guild-event'); invalidateCache('guild-events'); return r }),

  removeEventSignup: (realm: string, guild: string, eventId: string, region = 'eu') =>
    request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/events/${eventId}/signup?region=${region}`, {
      method: 'DELETE',
    }).then((r) => { invalidateCache('guild-event'); invalidateCache('guild-events'); return r }),

  deleteGuildEvent: (realm: string, guild: string, eventId: string, region = 'eu') =>
    request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/events/${eventId}?region=${region}`, {
      method: 'DELETE',
    }).then((r) => { invalidateCache('guild-events'); return r }),

  confirmEventSignup: (realm: string, guild: string, eventId: string, signupId: string, confirmed: string, region = 'eu') =>
    request<any>(`/guild/${encodeURIComponent(realm)}/${encodeURIComponent(guild)}/events/${eventId}/signups/${signupId}?region=${region}`, {
      method: 'PATCH', body: JSON.stringify({ confirmed }),
    }).then((r) => { invalidateCache('guild-event'); invalidateCache('guild-events'); return r }),

  // Warcraft Logs
  getWclReport: (code: string) =>
    apiCache(`wcl:${code}`, () =>
      request<any>(`/wcl/report/${code}`),
    MEDIUM),

  getWclFight: (code: string, fightId: number) =>
    apiCache(`wcl-fight:${code}:${fightId}`, () =>
      request<any>(`/wcl/report/${code}/fight/${fightId}`),
    MEDIUM),

  // Dashboard
  getDashboard: (params: { realm?: string; name?: string; guild?: string; guildRealm?: string; region?: string }) => {
    const qs = new URLSearchParams()
    if (params.realm) qs.set('realm', params.realm)
    if (params.name) qs.set('name', params.name)
    if (params.guild) qs.set('guild', params.guild)
    if (params.guildRealm) qs.set('guildRealm', params.guildRealm)
    if (params.region) qs.set('region', params.region)
    return apiCache(`dashboard:${qs.toString()}`, () =>
      request<any>(`/data/dashboard?${qs.toString()}`),
    SHORT)
  },

  getTokenPrice: (region = 'eu') =>
    apiCache(`token:${region}`, () =>
      request<{ price: number; raw: number }>(`/data/token?region=${region}`),
    LONG),

  getEncounterAbilities: (encounterId: number, region = 'eu') =>
    apiCache(`enc-abil:${encounterId}:${region}`, () =>
      request<{ name: string; abilities: Array<{ id: number; name: string; description: string; iconUrl?: string; iconName?: string }> }>(
        `/data/encounter/${encounterId}/abilities?region=${region}`,
      ), LONG),

  // Raid Plans
  getRaidPlans: (raidId: string, bossId: string) =>
    request<any[]>(`/raid-plans?raid_id=${encodeURIComponent(raidId)}&boss_id=${encodeURIComponent(bossId)}`),

  getRaidPlan: (id: string) =>
    request<any>(`/raid-plans/${id}`),

  createRaidPlan: (data: { raid_id: string; boss_id: string; map_slug: string; title: string; items_json: any; phases?: string[] }) =>
    request<any>('/raid-plans', { method: 'POST', body: JSON.stringify(data) }),

  updateRaidPlan: (id: string, data: { title?: string; items_json?: any; map_slug?: string; phases?: string[] }) =>
    request<any>(`/raid-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteRaidPlan: (id: string) =>
    request<any>(`/raid-plans/${id}`, { method: 'DELETE' }),
}
