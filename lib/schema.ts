// lib/schema.ts
import {
  pgTable,
  uuid,
  text,
  smallint,
  integer,
  boolean,
  timestamp,
  char,
  varchar,
} from "drizzle-orm/pg-core";

// TEAMS
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamName: text("team_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  step: smallint("step").notNull().default(0),
  orderIds: smallint("order_ids").array().notNull().default([]),
  penaltiesSec: integer("penalties_sec").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastWrongAt: timestamp("last_wrong_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  finalCode: char("final_code", { length: 4 }),
  fraudSuspected: boolean("fraud_suspected").notNull().default(false),
});

// SUBMISSIONS
export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  digit: smallint("digit").notNull(), // 1–4 / alt. 0–9 beroende på din logik
  correct: boolean("correct").notNull().default(false),
  timeLeftAtSubmit: integer("time_left_at_submit").notNull(),
});

// CONTENT_CLUES
export const contentClues = pgTable("content_clues", {
  id: varchar("id", { length: 64 }).primaryKey(), // t.ex. "clue-1"
  title: text("title").notNull(),
  icon: text("icon").notNull(),
  riddle: text("riddle").notNull(),
  locationHint: text("location_hint"),
  safetyHint: text("safety_hint"),
  expectedDigit: smallint("expected_digit").notNull(),
  verification: text("verification"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
});
