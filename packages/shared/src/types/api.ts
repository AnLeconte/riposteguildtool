import type { Character, GearItem, GearSlot } from './character.js';
import type { SimOptions, SimStatus } from './simulation.js';

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface SimCreateRequest {
  simc_input: string;
  sim_options?: Partial<SimOptions>;
}

export interface TopGearRequest {
  character: Character;
  candidates: Record<GearSlot, GearItem[]>;
  sim_options?: Partial<SimOptions>;
}

export interface SimStatusResponse {
  id: string;
  status: SimStatus;
  progress: number;
  queue_position?: number;
}

export interface QueueStatus {
  total: number;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
}
