import fs from 'node:fs/promises'
import {
  buildDroptimizerProfile,
  parseSimcOutput,
  parseProfilesetResults,
} from '@wow-simc/simc-engine'
import type { DroptimzerItem } from '@wow-simc/simc-engine'
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
import { parseSimcString } from '@wow-simc/simc-engine'
import type { SimOptions } from '@wow-simc/shared'

export interface DroptimzerSimOptions {
  items: DroptimzerItem[]
  instances?: Array<{ id: number; name: string; type: string; image_url?: string }>
  sim_options: SimOptions
}

export async function executeDroptimizer(simId: string): Promise<void> {
  await updateSimulation(simId, { status: 'running', progress: 0 })

  let jsonOutputPath: string | undefined

  try {
    const sim = await getSimulation(simId)
    if (!sim) throw new Error(`Simulation ${simId} not found`)

    const droptimzerData = sim.sim_options as unknown as DroptimzerSimOptions
    const items: DroptimzerItem[] = droptimzerData.items
    const simOptions: SimOptions = droptimzerData.sim_options

    const profile = buildDroptimizerProfile(sim.simc_input, items, simOptions)

    jsonOutputPath = await runSimcAsync(profile, async (progress: number) => {
      await updateSimulation(simId, { progress })
      emitSimProgress(simId, progress)
    })

    const rawJson = await fs.readFile(jsonOutputPath, 'utf-8')
    const result = parseSimcOutput(rawJson)
    const profilesetResults = parseProfilesetResults(rawJson)

    // Save profileset results BEFORE marking as completed
    if (profilesetResults.length > 0) {
      await saveProfilesetResults(simId, profilesetResults)
    }

    // Generate AI insights (non-blocking, best-effort)
    let ai_insights: string | null = null
    try {
      const droptimzerMeta = sim.sim_options as any
      const character = parseSimcString(sim.simc_input)
      ai_insights = await generateInsights({
        simType: 'droptimizer',
        baseDps: result.dps?.mean,
        profilesetResults: profilesetResults,
        characterName: character.name,
        characterClass: character.class,
        characterSpec: character.spec,
        instanceNames: droptimzerMeta.instances?.map((i: any) => i.name),
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
