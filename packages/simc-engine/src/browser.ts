/**
 * Browser-safe entry point for @wow-simc/simc-engine.
 * Only exports pure-JS modules (no Node.js APIs).
 */
export { parseSimcString, parseBagItems } from './parser/simc-input-parser.js'
export { parseSimcOutput } from './parser/simc-output-parser.js'
export { parseProfilesetResults } from './parser/profileset-result-parser.js'
export { parseStatWeights } from './parser/stat-weights-parser.js'
export type { ParsedStatWeights } from './parser/stat-weights-parser.js'
export { buildQuickSimProfile } from './profile-builder/quick-sim.js'
export { buildTopGearProfile } from './profile-builder/top-gear.js'
export { buildStatWeightsProfile } from './profile-builder/stat-weights.js'
export { buildDroptimizerProfile } from './profile-builder/droptimizer.js'
export type { DroptimzerItem } from './profile-builder/droptimizer.js'
export { buildGearCompareProfile } from './profile-builder/gear-compare.js'
