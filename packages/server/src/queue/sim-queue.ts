import { Queue } from 'bullmq'
import { redisConnection } from './connection.js'
import type { SimType } from '@wow-simc/shared'

export const simQueue = new Queue('simulations', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

export async function addSimJob(
  simId: string,
  simType: SimType = 'quick-sim',
  priority?: number,
): Promise<void> {
  await simQueue.add(
    'simulate',
    { simId, simType },
    { priority },
  )
}
