export { addSimJob } from './sim-queue.js'
export { startWorker, stopWorker } from './sim-worker.js'
import { simQueue } from './sim-queue.js'

export async function getQueueStatus() {
  const counts = await simQueue.getJobCounts(
    'wait',
    'active',
    'completed',
    'failed',
  )
  return {
    total: counts.wait + counts.active + counts.completed + counts.failed,
    active: counts.active,
    waiting: counts.wait,
    completed: counts.completed,
    failed: counts.failed,
  }
}
