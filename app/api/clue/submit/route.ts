export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, contentClues } from "@/lib/schema";
import { and, eq, desc } from "drizzle-orm";
import { CONFIG, computeTimeLeft } from "@/lib/time";

const WRONG_PENALTY_SEC = 30;
const WRONG_COOLDOWN_SEC = 3;

type SubmitBody = {
  teamId: string;
  clueId: string;     // används för att slå upp förväntad siffra
  answer?: string;    // kommer från klienten som sträng
  digit?: number;     // fallback om klienten skickar nummer
};

function parseDigit(input?: string | number | null): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return Math.trunc(input);
  if (typeof input === "string") {
    const n = Number.parseInt(input.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubmitBody;
    const { teamId, clueId } = body;

    if (!teamId || !clueId) {
      return NextResponse.json(
        { ok: false, message: "Missing teamId or clueId." },
        { status: 400 }
      );
    }

    const providedDigit = parseDigit(body.digit ?? body.answer ?? null);
    if (providedDigit === null) {
      return NextResponse.json(
        { ok: false, message: "Missing or invalid digit/answer." },
        { status: 400 }
      );
    }

    // Hämta lag
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) {
      return NextResponse.json({ ok: false, message: "Team not found." }, { status: 404 });
    }

    // Hämta gåta (aktiv) för att få expectedDigit
    const [clue] = await db
      .select()
      .from(contentClues)
      .where(and(eq(contentClues.id, clueId), eq(contentClues.active, true)))
      .limit(1);

    if (!clue) {
      return NextResponse.json({ ok: false, message: "Clue not found or inactive." }, { status: 404 });
    }

    // Cooldown mot spam (baserat på senaste submission)
    const lastSub = await db
      .select()
      .from(submissions)
      .where(eq(submissions.teamId, teamId))
      .orderBy(desc(submissions.submittedAt))
      .limit(1)
      .then(rows => rows[0]);

    if (lastSub) {
      const sinceLastMs = Date.now() - (lastSub.submittedAt as Date).getTime();
      if (sinceLastMs < WRONG_COOLDOWN_SEC * 1000) {
        return NextResponse.json({
          ok: true,
          result: "tooSoon",
          cooldownSec: WRONG_COOLDOWN_SEC,
          penaltyAppliedSec: 0,
        });
      }
    }

    // Rätt/fel jämförs mot expectedDigit i schemat
    const isCorrect = providedDigit === (clue.expectedDigit as number);

    const startedAtMs = (team.startedAt as Date | null)?.getTime() ?? Date.now();
    const currentPenalties = Number((team.penaltiesSec as number | null) ?? 0);

    if (!isCorrect) {
      // FEL: öka straff, beräkna ny timeLeft och spara submission
      const newPenalties = currentPenalties + WRONG_PENALTY_SEC;

      await db.transaction(async (tx) => {
        await tx.update(teams).set({ penaltiesSec: newPenalties }).where(eq(teams.id, teamId));

        const timeLeftAfterPenalty = computeTimeLeft(Date.now(), startedAtMs, newPenalties);

        // OBS: submissions-schema har inte clueId, men har digit, correct, timeLeftAtSubmit
        await tx.insert(submissions).values({
          teamId,
          digit: providedDigit,
          correct: false,
          timeLeftAtSubmit: timeLeftAfterPenalty,
          submittedAt: new Date(),
        });
      });

      return NextResponse.json({
        ok: true,
        result: "wrong",
        penaltyAppliedSec: WRONG_PENALTY_SEC,
        cooldownSec: WRONG_COOLDOWN_SEC,
      });
    }

    // RÄTT: snapshot på kvarvarande tid inkl. redan existerande straff
    const timeLeftNow = computeTimeLeft(Date.now(), startedAtMs, currentPenalties);

    // Är detta sista aktiva gåtan?
    const activeClues = await db
      .select({ id: contentClues.id })
      .from(contentClues)
      .where(eq(contentClues.active, true));
    const isLastClue = (team.step ?? 0) + 1 >= activeClues.length;

    await db.transaction(async (tx) => {
      // Spara korrekt submission
      await tx.insert(submissions).values({
        teamId,
        digit: providedDigit,
        correct: true,
        timeLeftAtSubmit: timeLeftNow,
        submittedAt: new Date(),
      });

      const nextStep = (team.step ?? 0) + 1;

      if (isLastClue) {
        // Sätt completedAt så admin och "Klar!" kan räkna rätt
        await tx.update(teams).set({ step: nextStep, completedAt: new Date() }).where(eq(teams.id, teamId));
      } else {
        await tx.update(teams).set({ step: nextStep }).where(eq(teams.id, teamId));
      }
    });

    return NextResponse.json({
      ok: true,
      result: "correct",
      isLastClue,
      timeLeftAtSubmit: timeLeftNow,
    });
  } catch (err: any) {
    console.error("submit POST failed:", err?.message || err);
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
