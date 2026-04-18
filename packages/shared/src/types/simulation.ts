import type { GearItem } from './character.js';

export type SimType =
  | 'quick-sim'
  | 'top-gear'
  | 'droptimizer'
  | 'stat-weights'
  | 'gear-compare'
  | 'advanced';

export type SimStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type FightStyle =
  | 'Patchwerk'
  | 'HecticAddCleave'
  | 'DungeonSlice'
  | 'CastingPatchwerk';

export interface SimOptions {
  iterations: number;
  fight_style: FightStyle;
  fight_length: number;
  target_error: number;
  threads: number;
  targets: number;
}

export interface SimResult {
  dps: {
    mean: number;
    min: number;
    max: number;
    median: number;
  };
  simulation_length: {
    mean: number;
  };
  executed_foreground_actions: number;
}

export interface ProfilesetResult {
  name: string;
  mean: number;
  median: number;
  min: number;
  max: number;
  dps_delta?: number;
  dps_delta_pct?: number;
  gear_changes?: Record<string, GearItem>;
  rank?: number;
}

export interface StatWeightsResult {
  dps: SimResult['dps']
  scale_factors: Record<string, number>
  pawn_string: string
}

export interface Simulation {
  id: string;
  user_id?: string;
  character_id?: string;
  sim_type: SimType;
  status: SimStatus;
  progress: number;
  simc_input: string;
  sim_options: SimOptions;
  result?: SimResult;
  profileset_results?: ProfilesetResult[];
  error?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}
