import type { SimOptions } from './types/simulation.js';

export const DEFAULT_SIM_OPTIONS: SimOptions = {
  iterations: 10000,
  fight_style: 'Patchwerk',
  fight_length: 300,
  target_error: 0.2,
  threads: 2,
  targets: 1,
};

export const MAX_PROFILESETS = 800;

export const SIM_TIMEOUT_MS = 600_000;

export const MAX_ITERATIONS = 100_000;
