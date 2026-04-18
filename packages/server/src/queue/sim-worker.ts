import { Worker } from 'bullmq'
import { redisConnection } from './connection.js'
import { executeQuickSim } from '../services/quick-sim.js'
import { executeTopGear } from '../services/top-gear.js'
import { executeStatWeights } from '../services/stat-weights.js'
import { executeDroptimizer } from '../services/droptimizer.js'
import { executeGearCompare } from '../services/gear-compare.js'
import { executeAdvanced } from '../services/advanced.js'
import type { SimType } from '@wow-simc/shared'

const concurrency = parseInt(process.env.SIM_CONCURRENCY || '2', 10)

let worker: Worker | null = null

export function startWorker(): void {
  worker = new Worker(
    'simulations',
    async (job) => {
      const { simId, simType } = job.data as { simId: string; simType?: SimType }
      await job.updateProgress(0)

      switch (simType) {
        case 'top-gear':
          await executeTopGear(simId)
          break
        case 'stat-weights':
          await executeStatWeights(simId)
          break
        case 'droptimizer':
          await executeDroptimizer(simId)
          break
        case 'gear-compare':
          await executeGearCompare(simId)
          break
        case 'advanced':
          await executeAdvanced(simId)
          break
        default:
          await executeQuickSim(simId)
      }

      await job.updateProgress(100)
    },
    {
      connection: redisConnection,
      concurrency,
    },
  )

  worker.on('completed', (job) => {
    console.log(`[worker] Job ${job.id} completed (simId: ${job.data.simId})`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.id} failed (simId: ${job?.data?.simId}):`, err.message)
  })

  console.log(`[worker] Started with concurrency=${concurrency}`)
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close()
    worker = null
    console.log('[worker] Stopped')
  }
}
