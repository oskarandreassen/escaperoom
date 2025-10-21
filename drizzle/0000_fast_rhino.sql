CREATE TABLE "content_clues" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"icon" text NOT NULL,
	"riddle" text NOT NULL,
	"location_hint" text,
	"safety_hint" text,
	"expected_digit" smallint NOT NULL,
	"verification" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "content_clues_expected_digit_between" CHECK ("content_clues"."expected_digit" BETWEEN 0 AND 9)
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"digit" smallint NOT NULL,
	"correct" boolean NOT NULL,
	"time_left_at_submit" integer NOT NULL,
	CONSTRAINT "submissions_digit_between" CHECK ("submissions"."digit" BETWEEN 0 AND 9)
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"step" smallint DEFAULT 0 NOT NULL,
	"order_ids" smallint[] DEFAULT ARRAY[]::SMALLINT[] NOT NULL,
	"penalties_sec" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_wrong_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"final_code" char(6),
	"fraud_suspected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;