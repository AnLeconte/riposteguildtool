import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  index,
  serial,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  blizzard_id: varchar('blizzard_id', { length: 255 }).unique().notNull(),
  battle_tag: varchar('battle_tag', { length: 255 }),
  discord_id: varchar('discord_id', { length: 64 }),
  main_character: jsonb('main_character'), // { name, realm, region, class, spec }
  created_at: timestamp('created_at').defaultNow(),
})

export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  realm: varchar('realm', { length: 255 }),
  region: varchar('region', { length: 10 }),
  wow_class: varchar('wow_class', { length: 50 }).notNull(),
  spec: varchar('spec', { length: 50 }),
  level: integer('level').default(80),
  item_level: real('item_level'),
  simc_string: text('simc_string').notNull(),
  gear_json: jsonb('gear_json'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
})

export const simulations = pgTable('simulations', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id),
  character_id: uuid('character_id').references(() => characters.id),
  sim_type: varchar('sim_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('queued'),
  progress: real('progress').default(0),
  simc_input: text('simc_input').notNull(),
  sim_options: jsonb('sim_options').notNull(),
  result_json: jsonb('result_json'),
  error: text('error'),
  ai_insights: text('ai_insights'),
  iterations: integer('iterations'),
  fight_style: varchar('fight_style', { length: 50 }),
  fight_length: integer('fight_length'),
  target_error: real('target_error'),
  job_id: varchar('job_id', { length: 255 }),
  priority: integer('priority').default(0),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  completed_at: timestamp('completed_at'),
})

export const precomputed_rankings = pgTable('precomputed_rankings', {
  id: uuid('id').primaryKey().defaultRandom(),
  spec_key: varchar('spec_key', { length: 100 }).notNull(), // e.g. "death_knight_unholy"
  ranking_type: varchar('ranking_type', { length: 50 }).notNull(), // "trinkets", "races", etc.
  difficulty: varchar('difficulty', { length: 20 }).notNull().default('heroic'),
  fight_style: varchar('fight_style', { length: 50 }).notNull().default('Patchwerk'),
  base_dps: real('base_dps'),
  results: jsonb('results').notNull(), // Array of { name, dps, dps_delta, dps_delta_pct, item_id?, item_level? }
  profile_name: varchar('profile_name', { length: 255 }),
  computed_at: timestamp('computed_at').defaultNow(),
}, (table) => [
  index('idx_precomputed_spec_type').on(table.spec_key, table.ranking_type),
])

// ─── Raid Events & Signups ────────────────────────────────────────────────────

export const raid_events = pgTable('raid_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  guild_name: varchar('guild_name', { length: 255 }).notNull(),
  guild_realm: varchar('guild_realm', { length: 255 }).notNull(),
  region: varchar('region', { length: 10 }).notNull().default('eu'),
  title: varchar('title', { length: 255 }).notNull(),
  raid_name: varchar('raid_name', { length: 255 }).notNull(),
  difficulty: varchar('difficulty', { length: 20 }).notNull(),
  description: text('description'),
  max_raiders: integer('max_raiders').default(25),
  starts_at: timestamp('starts_at').notNull(),
  ends_at: timestamp('ends_at'),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  created_by: uuid('created_by').references(() => users.id).notNull(),
  discord_message_id: varchar('discord_message_id', { length: 64 }),
  discord_channel_id: varchar('discord_channel_id', { length: 64 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_raid_events_guild').on(table.guild_realm, table.guild_name),
  index('idx_raid_events_starts_at').on(table.starts_at),
])

export const raid_signups = pgTable('raid_signups', {
  id: uuid('id').primaryKey().defaultRandom(),
  event_id: uuid('event_id').references(() => raid_events.id, { onDelete: 'cascade' }).notNull(),
  user_id: uuid('user_id').references(() => users.id),
  discord_user_id: varchar('discord_user_id', { length: 64 }),
  character_name: varchar('character_name', { length: 255 }).notNull(),
  character_realm: varchar('character_realm', { length: 255 }),
  wow_class: varchar('wow_class', { length: 50 }).notNull(),
  spec: varchar('spec', { length: 50 }),
  role: varchar('role', { length: 10 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('present'),
  note: text('note'),
  confirmed: varchar('confirmed', { length: 20 }).default('pending'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_raid_signups_event').on(table.event_id),
  index('idx_raid_signups_user').on(table.user_id),
])

// ─── Raid Plans ──────────────────────────────────────────────────────────────

export const raid_plans = pgTable('raid_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id),
  guild_name: varchar('guild_name', { length: 255 }),
  guild_realm: varchar('guild_realm', { length: 255 }),
  raid_id: varchar('raid_id', { length: 100 }).notNull(),
  boss_id: varchar('boss_id', { length: 100 }).notNull(),
  map_slug: varchar('map_slug', { length: 50 }).default('main'),
  title: varchar('title', { length: 255 }).notNull(),
  items_json: jsonb('items_json').notNull(),
  phases: jsonb('phases'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_raid_plans_boss').on(table.raid_id, table.boss_id),
  index('idx_raid_plans_user').on(table.user_id),
])

// ─── Ilvl History ───────────────────────────────────────────────────────────

export const ilvl_history = pgTable('ilvl_history', {
  id: serial('id').primaryKey(),
  user_id: uuid('user_id').references(() => users.id),
  character_name: varchar('character_name', { length: 255 }).notNull(),
  realm: varchar('realm', { length: 255 }).notNull(),
  region: varchar('region', { length: 10 }).default('eu'),
  ilvl: real('ilvl').notNull(),
  recorded_at: timestamp('recorded_at').defaultNow(),
}, (table) => [
  index('idx_ilvl_history_character').on(table.character_name, table.realm, table.region),
  index('idx_ilvl_history_user').on(table.user_id),
])

export const simulation_profilesets = pgTable('simulation_profilesets', {
  id: uuid('id').primaryKey().defaultRandom(),
  simulation_id: uuid('simulation_id')
    .references(() => simulations.id)
    .notNull(),
  profileset_name: varchar('profileset_name', { length: 255 }).notNull(),
  mean_dps: real('mean_dps').notNull(),
  median_dps: real('median_dps'),
  min_dps: real('min_dps'),
  max_dps: real('max_dps'),
  dps_delta: real('dps_delta'),
  dps_delta_pct: real('dps_delta_pct'),
  gear_changes: jsonb('gear_changes'),
  rank: integer('rank'),
}, (table) => [
  index('idx_profilesets_simulation_id').on(table.simulation_id),
])
