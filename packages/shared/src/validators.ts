import { DEFAULT_SIM_OPTIONS, MAX_ITERATIONS } from './constants.js';
import type { SimOptions } from './types/simulation.js';

/**
 * Checks if a string looks like a valid SimC input.
 * A valid SimC string either starts with `class=` (profile block)
 * or contains at least one `key=value` pair.
 */
export function validateSimcString(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  const trimmed = input.trim();
  if (trimmed.length === 0) return false;

  // Profile block: starts with a class declaration
  if (/^(death_knight|demon_hunter|druid|evoker|hunter|mage|monk|paladin|priest|rogue|shaman|warlock|warrior)=/im.test(trimmed)) {
    return true;
  }

  // Loose check: at least one key=value pair on its own line
  const keyValueLine = /^\s*\w[\w_]*\s*=\s*.+/m;
  return keyValueLine.test(trimmed);
}

/**
 * Merges provided options with defaults and clamps values to safe ranges.
 */
export function validateSimOptions(options: Partial<SimOptions>): SimOptions {
  const merged: SimOptions = {
    ...DEFAULT_SIM_OPTIONS,
    ...options,
  };

  // Clamp iterations
  merged.iterations = Math.max(1, Math.min(merged.iterations, MAX_ITERATIONS));

  // Clamp fight_length: 1s – 3600s
  merged.fight_length = Math.max(1, Math.min(merged.fight_length, 3600));

  // Clamp target_error: 0.01 – 5.0
  merged.target_error = Math.max(0.01, Math.min(merged.target_error, 5.0));

  // Clamp threads: 1 – 64
  merged.threads = Math.max(1, Math.min(merged.threads, 64));

  // Clamp targets: 1 – 30
  merged.targets = Math.max(1, Math.min(merged.targets, 30));

  return merged;
}
