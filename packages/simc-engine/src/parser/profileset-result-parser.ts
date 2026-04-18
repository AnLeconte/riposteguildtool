import type { ProfilesetResult } from '@wow-simc/shared';

/**
 * Shape of a single profileset result entry in SimC json2 output.
 */
interface RawProfilesetResult {
  name: string;
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev?: number;
}

/**
 * Minimal shape of the SimC json2 output relevant to profilesets.
 */
interface SimcJson2WithProfilesets {
  sim: {
    players?: Array<{
      collected_data?: {
        dps?: {
          mean?: number;
        };
      };
    }>;
    profilesets?: {
      results?: RawProfilesetResult[];
    };
  };
}

/**
 * Parse profileset results from a SimulationCraft json2 output string.
 *
 * Profilesets are located at `sim.profilesets.results[]` with fields:
 *   `{ name, mean, median, min, max }`
 *
 * The base DPS is taken from the first player's collected_data.dps.mean.
 * Results are sorted by mean DPS descending and ranked starting at 1.
 * `dps_delta` and `dps_delta_pct` are calculated relative to base DPS.
 */
export function parseProfilesetResults(jsonOutput: string | Record<string, unknown>): ProfilesetResult[] {
  let parsed: SimcJson2WithProfilesets;

  if (typeof jsonOutput === 'string') {
    try {
      parsed = JSON.parse(jsonOutput) as SimcJson2WithProfilesets;
    } catch {
      throw new Error(
        'Failed to parse SimC json2 output for profilesets: invalid JSON',
      );
    }
  } else {
    parsed = jsonOutput as unknown as SimcJson2WithProfilesets;
  }

  const sim = parsed?.sim;
  if (!sim) {
    throw new Error('SimC json2 output missing top-level "sim" key');
  }

  // Base DPS comes from the first (base) player
  const baseDps = sim.players?.[0]?.collected_data?.dps?.mean ?? 0;

  const rawResults = sim.profilesets?.results;
  if (!Array.isArray(rawResults) || rawResults.length === 0) {
    return [];
  }

  // Map raw results, compute deltas relative to base DPS
  const results: ProfilesetResult[] = rawResults.map((r) => {
    const dpsDelta = r.mean - baseDps;
    const dpsDeltaPct = baseDps !== 0 ? (dpsDelta / baseDps) * 100 : 0;

    return {
      name: r.name,
      mean: r.mean,
      median: r.median,
      min: r.min,
      max: r.max,
      dps_delta: dpsDelta,
      dps_delta_pct: dpsDeltaPct,
    };
  });

  // Sort descending by mean DPS
  results.sort((a, b) => b.mean - a.mean);

  // Assign ranks (1-based)
  results.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return results;
}
