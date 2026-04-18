import { eq, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/index.js'
import { simulations, simulation_profilesets } from '../db/schema.js'
import type { SimType, SimOptions, Simulation, ProfilesetResult } from '@wow-simc/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateSimulationData {
  simc_input: string
  sim_type: SimType
  sim_options: SimOptions
  user_id?: string
  character_id?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToSimulation(row: typeof simulations.$inferSelect): Simulation {
  return {
    id: row.id,
    user_id: row.user_id ?? undefined,
    character_id: row.character_id ?? undefined,
    sim_type: row.sim_type as SimType,
    status: row.status as Simulation['status'],
    progress: row.progress ?? 0,
    simc_input: row.simc_input,
    sim_options: row.sim_options as SimOptions,
    result: (row.result_json as Simulation['result']) ?? undefined,
    error: row.error ?? undefined,
    ai_insights: row.ai_insights ?? undefined,
    created_at: row.created_at ?? new Date(),
    updated_at: row.updated_at ?? new Date(),
    completed_at: row.completed_at ?? undefined,
  } as Simulation & { ai_insights?: string }
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function createSimulation(data: CreateSimulationData): Promise<Simulation> {
  const id = uuidv4()

  const [row] = await db
    .insert(simulations)
    .values({
      id,
      simc_input: data.simc_input,
      sim_type: data.sim_type,
      sim_options: data.sim_options,
      status: 'queued',
      progress: 0,
      user_id: data.user_id ?? null,
      character_id: data.character_id ?? null,
      iterations: data.sim_options.iterations,
      fight_style: data.sim_options.fight_style,
      fight_length: data.sim_options.fight_length,
      target_error: data.sim_options.target_error,
    })
    .returning()

  return rowToSimulation(row)
}

export async function getSimulation(id: string): Promise<Simulation | null> {
  const [row] = await db
    .select()
    .from(simulations)
    .where(eq(simulations.id, id))
    .limit(1)

  if (!row) return null
  return rowToSimulation(row)
}

export async function updateSimulation(
  id: string,
  data: Partial<{
    status: string
    progress: number
    result_json: unknown
    error: string
    completed_at: Date
  }>,
): Promise<void> {
  await db
    .update(simulations)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(eq(simulations.id, id))
}

export async function saveProfilesetResults(
  simId: string,
  results: ProfilesetResult[],
): Promise<void> {
  if (results.length === 0) return

  const rows = results.map((r, index) => ({
    id: uuidv4(),
    simulation_id: simId,
    profileset_name: r.name,
    mean_dps: r.mean,
    median_dps: r.median ?? null,
    min_dps: r.min ?? null,
    max_dps: r.max ?? null,
    dps_delta: r.dps_delta ?? null,
    dps_delta_pct: r.dps_delta_pct ?? null,
    gear_changes: r.gear_changes ?? null,
    rank: r.rank ?? index + 1,
  }))

  await db.insert(simulation_profilesets).values(rows)
}

export async function getSimulationWithResults(
  id: string,
): Promise<(Simulation & { profileset_results: ProfilesetResult[] }) | null> {
  const sim = await getSimulation(id)
  if (!sim) return null

  const profilesets = await db
    .select()
    .from(simulation_profilesets)
    .where(eq(simulation_profilesets.simulation_id, id))
    .orderBy(simulation_profilesets.rank)

  const profileset_results: ProfilesetResult[] = profilesets.map((p) => ({
    name: p.profileset_name,
    mean: p.mean_dps,
    median: p.median_dps ?? p.mean_dps,
    min: p.min_dps ?? p.mean_dps,
    max: p.max_dps ?? p.mean_dps,
    dps_delta: p.dps_delta ?? undefined,
    dps_delta_pct: p.dps_delta_pct ?? undefined,
    gear_changes: (p.gear_changes as ProfilesetResult['gear_changes']) ?? undefined,
    rank: p.rank ?? undefined,
  }))

  return { ...sim, profileset_results }
}

export async function listSimulations(
  userId?: string,
  limit = 20,
): Promise<Simulation[]> {
  const rows = userId
    ? await db
        .select()
        .from(simulations)
        .where(eq(simulations.user_id, userId))
        .orderBy(desc(simulations.created_at))
        .limit(limit)
    : await db
        .select()
        .from(simulations)
        .orderBy(desc(simulations.created_at))
        .limit(limit)

  return rows.map(rowToSimulation)
}
