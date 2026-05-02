CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blizzard_id" varchar(255) NOT NULL,
	"battle_tag" varchar(255),
	"discord_id" varchar(64),
	"main_character" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_blizzard_id_unique" UNIQUE("blizzard_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid REFERENCES "users"("id"),
	"name" varchar(255) NOT NULL,
	"realm" varchar(255),
	"region" varchar(10),
	"wow_class" varchar(50) NOT NULL,
	"spec" varchar(50),
	"level" integer DEFAULT 80,
	"item_level" real,
	"simc_string" text NOT NULL,
	"gear_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid REFERENCES "users"("id"),
	"character_id" uuid REFERENCES "characters"("id"),
	"sim_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"progress" real DEFAULT 0,
	"simc_input" text NOT NULL,
	"sim_options" jsonb NOT NULL,
	"result_json" jsonb,
	"error" text,
	"ai_insights" text,
	"iterations" integer,
	"fight_style" varchar(50),
	"fight_length" integer,
	"target_error" real,
	"job_id" varchar(255),
	"priority" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "precomputed_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spec_key" varchar(100) NOT NULL,
	"ranking_type" varchar(50) NOT NULL,
	"difficulty" varchar(20) DEFAULT 'heroic' NOT NULL,
	"fight_style" varchar(50) DEFAULT 'Patchwerk' NOT NULL,
	"base_dps" real,
	"results" jsonb NOT NULL,
	"profile_name" varchar(255),
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_precomputed_spec_type" ON "precomputed_rankings" ("spec_key","ranking_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raid_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_name" varchar(255) NOT NULL,
	"guild_realm" varchar(255) NOT NULL,
	"region" varchar(10) DEFAULT 'eu' NOT NULL,
	"title" varchar(255) NOT NULL,
	"raid_name" varchar(255) NOT NULL,
	"difficulty" varchar(20) NOT NULL,
	"description" text,
	"max_raiders" integer DEFAULT 25,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_by" uuid NOT NULL REFERENCES "users"("id"),
	"discord_message_id" varchar(64),
	"discord_channel_id" varchar(64),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raid_events_guild" ON "raid_events" ("guild_realm","guild_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raid_events_starts_at" ON "raid_events" ("starts_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raid_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL REFERENCES "raid_events"("id") ON DELETE CASCADE,
	"user_id" uuid REFERENCES "users"("id"),
	"discord_user_id" varchar(64),
	"character_name" varchar(255) NOT NULL,
	"character_realm" varchar(255),
	"wow_class" varchar(50) NOT NULL,
	"spec" varchar(50),
	"role" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'present' NOT NULL,
	"note" text,
	"confirmed" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raid_signups_event" ON "raid_signups" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raid_signups_user" ON "raid_signups" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raid_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid REFERENCES "users"("id"),
	"guild_name" varchar(255),
	"guild_realm" varchar(255),
	"raid_id" varchar(100) NOT NULL,
	"boss_id" varchar(100) NOT NULL,
	"map_slug" varchar(50) DEFAULT 'main',
	"title" varchar(255) NOT NULL,
	"items_json" jsonb NOT NULL,
	"phases" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raid_plans_boss" ON "raid_plans" ("raid_id","boss_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raid_plans_user" ON "raid_plans" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ilvl_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid REFERENCES "users"("id"),
	"character_name" varchar(255) NOT NULL,
	"realm" varchar(255) NOT NULL,
	"region" varchar(10) DEFAULT 'eu',
	"ilvl" real NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ilvl_history_character" ON "ilvl_history" ("character_name","realm","region");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ilvl_history_user" ON "ilvl_history" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "simulation_profilesets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulation_id" uuid NOT NULL REFERENCES "simulations"("id"),
	"profileset_name" varchar(255) NOT NULL,
	"mean_dps" real NOT NULL,
	"median_dps" real,
	"min_dps" real,
	"max_dps" real,
	"dps_delta" real,
	"dps_delta_pct" real,
	"gear_changes" jsonb,
	"rank" integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_profilesets_simulation_id" ON "simulation_profilesets" ("simulation_id");
