import fs from 'node:fs/promises'
import {
  buildTopGearProfile,
  parseSimcOutput,
  parseProfilesetResults,
} from '@wow-simc/simc-engine'
import {
  getSimulation,
  updateSimulation,
  saveProfilesetResults,
} from './simulation.js'
import {
  emitSimProgress,
  emitSimCompleted,
  emitSimFailed,
} from '../websocket/socket.js'
import { runSimcAsync } from './run-simc.js'
import { generateInsights } from './ai-insights.js'
import type { Character, GearItem, SimOptions } from '@wow-simc/shared'

export interface TopGearSimOptions {
  character: Character
  candidates: Record<string, GearItem[]>
  sim_options: SimOptions
}

export async function executeTopGear(simId: string): Promise<void> {
  await updateSimulation(simId, { status: 'running', progress: 0 })

  let jsonOutputPath: string | undefined

  try {
    const sim = await getSimulation(simId)
    if (!sim) throw new Error(`Simulation ${simId} not found`)

    // sim_options is overloaded to carry character + candidates for top gear
    const topGearData = sim.sim_options as unknown as TopGearSimOptions

    const character: Character = topGearData.character
    const candidates: Record<string, GearItem[]> = topGearData.candidates
    const simOptions: SimOptions = topGearData.sim_options

    const profile = buildTopGearProfile(character, candidates, simOptions)

    jsonOutputPath = await runSimcAsync(profile, async (progress: number) => {
      await updateSimulation(simId, { progress })
      emitSimProgress(simId, progress)
    })

    const rawJson = await fs.readFile(jsonOutputPath, 'utf-8')
    const result = parseSimcOutput(rawJson)
    const profilesetResults = parseProfilesetResults(rawJson)

    if (profilesetResults.length > 0) {
      await saveProfilesetResults(simId, profilesetResults)
    }

    // Generate AI insights (non-blocking, best-effort)
    let ai_insights: string | null = null
    try {
      ai_insights = await generateInsights({
        simType: 'top-gear',
        baseDps: result.dps?.mean,
        profilesetResults: profilesetResults,
        characterName: character.name,
        characterClass: character.class,
        characterSpec: character.spec,
      })
    } catch { /* skip */ }

    await updateSimulation(simId, {
      status: 'completed',
      progress: 100,
      result_json: result,
      completed_at: new Date(),
      ...(ai_insights ? { ai_insights } : {}),
    } as any)

    emitSimCompleted(simId, result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await updateSimulation(simId, {
      status: 'failed',
      error: message,
      completed_at: new Date(),
    })
    emitSimFailed(simId, message)
  } finally {
    if (jsonOutputPath) {
      await fs.unlink(jsonOutputPath).catch(() => {})
    }
  }
}
