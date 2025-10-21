// app/api/clue/submit/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, contentClues, submissions } from "@/lib/schema";

const CLUE_TIME_SECONDS = 5 * 60; // 5 minuter
const WRONG_PENALTY_SEC = 30;     // -30 sekunder
const COOLDOWN_MS = 3000;         // 3 sekunder cooldown

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const teamId: unknown = body?.teamId;
    const digit: unknown = body?.digit;

    if (typeof teamId !== "string" || !teamId) {
      return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });
    }
    if (typeof digit !== "number" || !Number.isInteger(digit) || digit < 0 || digit > 9) {
      return NextResponse.json({ ok: false, error: "Digit must be 0-9" }, { status: 400 });
    }

    // Hämta team + ledtrådar
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });

    const clues = await db
      .select({
        id: contentClues.id,
        expectedDigit: contentClues.expectedDigit,
      })
      .from(contentClues)
      .where(eq(contentClues.active, true))
      .orderBy(asc(contentClues.id));

    const total = clues.length;
    if (total === 0) {
      return NextResponse.json({ ok: false, error: "No active clues" }, { status: 500 });
    }

    const step = Math.min(Math.max(typeof team.step === "number" ? team.step : 0, 0), total - 1);
    const clue = clues[step];
    if (!clue) return NextResponse.json({ ok: false, error: "Clue not found" }, { status: 404 });

    const now = new Date();

    // Cooldown: förhindra spam (3 sekunder efter fel)
    if (team.lastWrongAt) {
      const last = new Date(team.lastWrongAt);
      const diff = now.getTime() - last.getTime();
      if (diff < COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((COOLDOWN_MS - diff) / 1000);
        return NextResponse.json(
          { ok: false, error: "cooldown", retryAfterSec },
          { status: 429 }
        );
      }
    }

    // Beräkna aktuell deadline (om den saknas, starta om fönster)
    let deadline = team.lockedUntil ? new Date(team.lockedUntil) : null;
    if (!deadline || deadline <= now) {
      deadline = new Date(now.getTime() + CLUE_TIME_SECONDS * 1000);
      await db.update(teams).set({ lockedUntil: deadline }).where(eq(teams.id, teamId));
    }

    const timeLeftAtSubmit = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));

    // Spara submissionen
    await db.insert(submissions).values({
      teamId: team.id,
      digit,
      correct: digit === clue.expectedDigit,
      submittedAt: now,
      timeLeftAtSubmit,
    });

    // Rätt svar
    if (digit === clue.expectedDigit) {
      const isLast = step >= total - 1;

      await db
        .update(teams)
        .set({
          step: isLast ? step : step + 1,
          lockedUntil: null, // nästa /current sätter ny 5-minutersdeadline
          completedAt: isLast ? now : team.completedAt,
        })
        .where(eq(teams.id, teamId));

      return NextResponse.json({
        ok: true,
        result: "correct",
        finished: isLast,
        nextStep: isLast ? step : step + 1,
      });
    }

    // Fel svar → −30 sek + sätt cooldown
    const newDeadlineMs = Math.max(now.getTime(), deadline.getTime() - WRONG_PENALTY_SEC * 1000);
    const newDeadline = new Date(newDeadlineMs);

    await db
      .update(teams)
      .set({
        lockedUntil: newDeadline,
        lastWrongAt: now,
        penaltiesSec: (team.penaltiesSec ?? 0) + WRONG_PENALTY_SEC,
      })
      .where(eq(teams.id, teamId));

    return NextResponse.json({
      ok: true,
      result: "wrong",
      penaltyAppliedSec: WRONG_PENALTY_SEC,
      timeLeftSec: Math.max(0, Math.floor((newDeadline.getTime() - now.getTime()) / 1000)),
      cooldownSec: Math.ceil(COOLDOWN_MS / 1000),
    });
  } catch (err) {
    console.error("submit error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
