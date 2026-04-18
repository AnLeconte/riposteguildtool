import type { SimResult } from '@wow-simc/shared';

/**
 * Shape of the SimulationCraft json2 output that we care about.
 * Only the fields we actually read are typed here.
 */
interface SimcJson2Output {
  sim: {
    players: Array<{
      collected_data: {
        dps: {
          mean: number;
          min: number;
          max: number;
          median: number;
        };
        dmg?: {
          mean?: number;
        };
        fight_length?: {
          mean?: number;
        };
        executed_foreground_actions?: {
          mean?: number;
        };
      };
    }>;
    statistics?: {
      elapsed_cpu_seconds?: number;
      total_time?: number;
    };
    sim_length?: {
      mean?: number;
    };
  };
}

/**
 * Parse SimulationCraft json2 output into a SimResult.
 *
 * The json2 output structure relevant to us:
 * ```json
 * {
 *   "sim": {
 *     "players": [{
 *       "collected_data": {
 *         "dps": { "mean": 0, "min": 0, "max": 0, "median": 0 },
 *         "fight_length": { "mean": 0 },
 *         "executed_foreground_actions": { "mean": 0 }
 *       }
 *     }],
 *     "statistics": {
 *       "elapsed_cpu_seconds": 0
 *     }
 *   }
 * }
 * ```
 */
export function parseSimcOutput(jsonOutput: string | Record<string, unknown>): SimResult {
  let parsed: SimcJson2Output;

  if (typeof jsonOutput === 'string') {
    try {
      parsed = JSON.parse(jsonOutput) as SimcJson2Output;
    } catch {
      throw new Error('Failed to parse SimC json2 output: invalid JSON');
    }
  } else {
    parsed = jsonOutput as unknown as SimcJson2Output;
  }

  const sim = parsed?.sim;
  if (!sim) {
    throw new Error('SimC json2 output missing top-level "sim" key');
  }

  const players = sim.players;
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error('SimC json2 output has no players');
  }

  const player = players[0];
  const collectedData = player?.collected_data;
  if (!collectedData) {
    throw new Error('SimC json2 output missing collected_data for first player');
  }

  const dpsData = collectedData.dps;
  if (!dpsData) {
    throw new Error('SimC json2 output missing dps data for first player');
  }

  // Fight length: prefer player-level fight_length, fall back to sim-level
  const simulationLengthMean =
    collectedData.fight_length?.mean ??
    sim.sim_length?.mean ??
    0;

  const executedForegroundActions =
    collectedData.executed_foreground_actions?.mean ?? 0;

  return {
    dps: {
      mean: dpsData.mean ?? 0,
      min: dpsData.min ?? 0,
      max: dpsData.max ?? 0,
      median: dpsData.median ?? 0,
    },
    simulation_length: {
      mean: simulationLengthMean,
    },
    executed_foreground_actions: executedForegroundActions,
  };
}
