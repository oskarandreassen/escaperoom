// lib/schema.ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  smallint,
  boolean,
  char,
  integer,
  check, // <<— viktigt: check() kommer härifrån
} from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamName: text("team_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  step: smallint("step").notNull().default(0),
  orderIds: smallint("order_ids").array().notNull().default(sql`ARRAY[]::SMALLINT[]`),
  penaltiesSec: integer("penalties_sec").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastWrongAt: timestamp("last_wrong_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  finalCode: char("final_code", { length: 6 }),
  fraudSuspected: boolean("fraud_suspected").notNull().default(false),
});

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    digit: smallint("digit").notNull(),
    correct: boolean("correct").notNull(),
    timeLeftAtSubmit: integer("time_left_at_submit").notNull(),
  },
  (t) => ({
    // CHECK (digit BETWEEN 0 AND 9)
    digitBetween: check("submissions_digit_between", sql`${t.digit} BETWEEN 0 AND 9`),
  })
);

export const contentClues = pgTable(
  "content_clues",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    icon: text("icon").notNull(),
    riddle: text("riddle").notNull(),
    locationHint: text("location_hint"),
    safetyHint: text("safety_hint"),
    expectedDigit: smallint("expected_digit").notNull(),
    verification: text("verification"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
  },
  (t) => ({
    // CHECK (expected_digit BETWEEN 0 AND 9)
    expectedBetween: check(
      "content_clues_expected_digit_between",
      sql`${t.expectedDigit} BETWEEN 0 AND 9`
    ),
  })
);
