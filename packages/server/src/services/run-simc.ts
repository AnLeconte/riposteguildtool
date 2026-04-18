import { runSimc } from '@wow-simc/simc-engine'

/**
 * Shared async wrapper around the SimC process runner.
 * Used by all executor services (quick-sim, top-gear, droptimizer, etc.)
 */
export function runSimcAsync(
  profile: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    runSimc(
      profile,
      {
        onProgress,
        onComplete: (jsonPath) => resolve(jsonPath),
        onError: (error) => reject(new Error(error)),
      },
      process.env.SIMC_PATH,
    )
  })
}
