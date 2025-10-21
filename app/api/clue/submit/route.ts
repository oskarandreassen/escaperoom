// app/api/clue/submit/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, submissions } from "@/lib/schema";
import { CLUES, DEFAULT_CLUE_SECONDS } from "@/data/clues";

const WRONG_PENALTY_SEC = 30;
const COOLDOWN_MS = 3000;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const teamId: unknown = body?.teamId;
    const answer: unknown = body?.answer; // numerisk sträng, t.ex. "3" eller "7214"

    if (typeof teamId !== "string" || !teamId) {
      return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });
    }
    if (typeof answer !== "string" || answer.length === 0 || !/^\d+$/.test(answer)) {
      return NextResponse.json({ ok: false, error: "Answer must be a non-empty numeric string" }, { status: 400 });
    }

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });

    const activeClues = CLUES.filter((c) => c.active !== false);
    const total = activeClues.length;
    const step = Math.min(Math.max(typeof team.step === "number" ? team.step : 0, 0), Math.max(total - 1, 0));
    if (team.completedAt || step >= total) {
      return NextResponse.json({ ok: true, result: "finished" });
    }

    const clue = activeClues[step];
    if (!clue) return NextResponse.json({ ok: false, error: "Clue not found" }, { status: 404 });

    // Cooldown
    const now = new Date();
    if (team.lastWrongAt) {
      const diff = now.getTime() - new Date(team.lastWrongAt).getTime();
      if (diff < COOLDOWN_MS) {
        return NextResponse.json(
          { ok: false, error: "cooldown", retryAfterSec: Math.ceil((COOLDOWN_MS - diff) / 1000) },
          { status: 429 }
        );
      }
    }

    // Deadline (per-ledtråd)
    const clueSeconds = typeof clue.durationSec === "number" ? clue.durationSec : DEFAULT_CLUE_SECONDS;
    let deadline = team.lockedUntil ? new Date(team.lockedUntil) : null;
    if (!deadline || deadline <= now) {
      deadline = new Date(now.getTime() + clueSeconds * 1000);
      await db.update(teams).set({ lockedUntil: deadline }).where(eq(teams.id, teamId));
    }
    const timeLeftAtSubmit = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));

    // Spara submission (legacy-kolumn digit fylls med första siffran)
    await db.insert(submissions).values({
      teamId: team.id,
      digit: parseInt((answer as string).charAt(0), 10), // <-- fix: .charAt(0) är alltid string
      correct: (answer as string) === clue.expected,
      submittedAt: now,
      timeLeftAtSubmit,
    });

    if ((answer as string) === clue.expected) {
      const isLast = step >= total - 1;
      await db
        .update(teams)
        .set({
          step: isLast ? step : step + 1,
          lockedUntil: null,
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

    // Fel svar → -30s + cooldown
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
