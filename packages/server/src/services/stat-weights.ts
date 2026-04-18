import fs from 'node:fs/promises'
import {
  buildStatWeightsProfile,
  parseSimcOutput,
  parseStatWeights,
} from '@wow-simc/simc-engine'
import { getSimulation, updateSimulation } from './simulation.js'
import {
  emitSimProgress,
  emitSimCompleted,
  emitSimFailed,
} from '../websocket/socket.js'
import { runSimcAsync } from './run-simc.js'
import type { StatWeightsResult } from '@wow-simc/shared'

export async function executeStatWeights(simId: string): Promise<void> {
  await updateSimulation(simId, { status: 'running', progress: 0 })

  let jsonOutputPath: string | undefined

  try {
    const sim = await getSimulation(simId)
    if (!sim) throw new Error(`Simulation ${simId} not found`)

    const profile = buildStatWeightsProfile(sim.simc_input, sim.sim_options)

    jsonOutputPath = await runSimcAsync(profile, async (progress: number) => {
      await updateSimulation(simId, { progress })
      emitSimProgress(simId, progress)
    })

    const rawJson = await fs.readFile(jsonOutputPath, 'utf-8')

    // Parse base DPS result
    const baseResult = parseSimcOutput(rawJson)

    // Parse scale factors + pawn string
    const { scale_factors, pawn_string } = parseStatWeights(rawJson)

    const statWeightsResult: StatWeightsResult = {
      dps: baseResult.dps,
      scale_factors,
      pawn_string,
    }

    await updateSimulation(simId, {
      status: 'completed',
      progress: 100,
      result_json: statWeightsResult,
      completed_at: new Date(),
    })

    emitSimCompleted(simId, statWeightsResult)
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
