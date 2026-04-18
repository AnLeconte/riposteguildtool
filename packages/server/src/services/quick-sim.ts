import fs from 'node:fs/promises'
import { buildQuickSimProfile, parseSimcOutput, parseProfilesetResults } from '@wow-simc/simc-engine'
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

export async function executeQuickSim(simId: string): Promise<void> {
  await updateSimulation(simId, { status: 'running', progress: 0 })

  let jsonOutputPath: string | undefined

  try {
    const sim = await getSimulation(simId)
    if (!sim) {
      throw new Error(`Simulation ${simId} not found`)
    }

    const profile = buildQuickSimProfile(sim.simc_input, sim.sim_options)

    jsonOutputPath = await runSimcAsync(profile, async (progress: number) => {
      await updateSimulation(simId, { progress })
      emitSimProgress(simId, progress)
    })

    const rawJson = await fs.readFile(jsonOutputPath, 'utf-8')
    const result = parseSimcOutput(rawJson)

    // Parse profileset results if present (before marking completed)
    try {
      const profilesetResults = parseProfilesetResults(rawJson)
      if (profilesetResults.length > 0) {
        await saveProfilesetResults(simId, profilesetResults)
      }
    } catch {
      // No profileset results for quick sim — that's fine
    }

    await updateSimulation(simId, {
      status: 'completed',
      progress: 100,
      result_json: result,
      completed_at: new Date(),
    })

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
