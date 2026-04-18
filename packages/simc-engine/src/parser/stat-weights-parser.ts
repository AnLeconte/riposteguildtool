/**
 * Mapping from SimC internal stat key to Pawn string key.
 */
const PAWN_KEY_MAP: Record<string, string> = {
  Strength: 'Strength',
  Agility: 'Agility',
  Intellect: 'Intellect',
  Stamina: 'Stamina',
  CritRating: 'CritRating',
  HasteRating: 'HasteRating',
  MasteryRating: 'MasteryRating',
  Versatility: 'Versatility',
  // SimC sometimes outputs with different capitalisation
  crit_rating: 'CritRating',
  haste_rating: 'HasteRating',
  mastery_rating: 'MasteryRating',
  versatility_rating: 'Versatility',
  strength: 'Strength',
  agility: 'Agility',
  intellect: 'Intellect',
  stamina: 'Stamina',
}

export interface ParsedStatWeights {
  scale_factors: Record<string, number>
  pawn_string: string
}

interface SimcJson2WithScaleFactors {
  sim: {
    players?: Array<{
      name?: string
      scale_factors?: Record<string, number>
    }>
  }
}

/**
 * Parse stat weight scale factors from a SimulationCraft json2 output.
 *
 * The relevant path in json2 output:
 *   sim.players[0].scale_factors  →  { Agility: 1.0, CritRating: 0.85, … }
 *
 * A Pawn string is generated using the standard format:
 *   ( Pawn: v1: "Name": Key=Value, … )
 *
 * @param jsonOutput  Raw json2 string or pre-parsed object.
 * @param playerName  Optional override for the Pawn string character name.
 */
export function parseStatWeights(
  jsonOutput: string | Record<string, unknown>,
  playerName?: string,
): ParsedStatWeights {
  let parsed: SimcJson2WithScaleFactors

  if (typeof jsonOutput === 'string') {
    try {
      parsed = JSON.parse(jsonOutput) as SimcJson2WithScaleFactors
    } catch {
      throw new Error('Failed to parse SimC json2 output for stat weights: invalid JSON')
    }
  } else {
    parsed = jsonOutput as unknown as SimcJson2WithScaleFactors
  }

  const sim = parsed?.sim
  if (!sim) {
    throw new Error('SimC json2 output missing top-level "sim" key')
  }

  const player = sim.players?.[0]
  if (!player) {
    throw new Error('SimC json2 output has no players')
  }

  const rawFactors = player.scale_factors
  if (!rawFactors || typeof rawFactors !== 'object') {
    throw new Error('SimC json2 output missing scale_factors for first player')
  }

  // Normalise to human-readable keys, filtering near-zero values
  const scale_factors: Record<string, number> = {}
  for (const [key, value] of Object.entries(rawFactors)) {
    if (typeof value === 'number' && Math.abs(value) > 0.001) {
      scale_factors[key] = Math.round(value * 10000) / 10000
    }
  }

  // Determine primary stat to use as normaliser (highest value)
  const sortedEntries = Object.entries(scale_factors).sort((a, b) => b[1] - a[1])
  const name = playerName ?? player.name ?? 'Character'

  // Build Pawn string entries
  const pawnEntries = sortedEntries
    .map(([key, value]) => {
      const pawnKey = PAWN_KEY_MAP[key] ?? key
      return `${pawnKey}=${value.toFixed(2)}`
    })
    .join(', ')

  const pawn_string = `( Pawn: v1: "${name}": ${pawnEntries} )`

  return { scale_factors, pawn_string }
}
