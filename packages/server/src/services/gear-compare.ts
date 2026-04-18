import fs from 'node:fs/promises'
import {
  buildGearCompareProfile,
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
import type { SimOptions } from '@wow-simc/shared'

export interface GearCompareSimOptions {
  simc_input_a: string
  simc_input_b: string
  name_a: string
  name_b: string
  sim_options: SimOptions
}

export async function executeGearCompare(simId: string): Promise<void> {
  await updateSimulation(simId, { status: 'running', progress: 0 })

  let jsonOutputPath: string | undefined

  try {
    const sim = await getSimulation(simId)
    if (!sim) throw new Error(`Simulation ${simId} not found`)

    const data = sim.sim_options as unknown as GearCompareSimOptions
    const { simc_input_a, simc_input_b, name_a, name_b, sim_options } = data

    const profile = buildGearCompareProfile(
      simc_input_a,
      simc_input_b,
      name_a,
      name_b,
      sim_options,
    )

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
