// app/api/clue/submit/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, submissions, contentClues } from "@/lib/schema";

const WRONG_PENALTY_SEC = 30;
const COOLDOWN_MS = 3000;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const teamId: string | undefined = body?.teamId;
    const answer: string | undefined =
      typeof body?.answer === "string"
        ? body.answer
        : typeof body?.digit === "number"
        ? String(body.digit)
        : undefined;

    if (!teamId) return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });
    if (answer == null) return NextResponse.json({ ok: false, error: "Missing answer" }, { status: 400 });

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });

    // Hämta nuvarande gåta
    const all = await db
      .select()
      .from(contentClues)
      .where(eq(contentClues.active, true))
      .orderBy(contentClues.orderIdx);

    const total = all.length;
    const step = Math.max(0, Math.min(Number(team.step ?? 0), Math.max(total - 1, 0)));
    const current = all[step];

    if (!current) {
      return NextResponse.json({ ok: false, error: "No current clue" }, { status: 400 });
    }

    const expected =
      current.type === "digit"
        ? String(current.expectedDigit ?? "")
        : String(current.expectedCode ?? "");

    const normalized = answer.replace(/\s+/g, "");
    const isCorrect = normalized === expected;

    const now = new Date();

    // Spara submission
    const [saved] = await db
      .insert(submissions)
      .values({
        teamId,
        clueId: current.id,
        submittedAt: now,
        answer: normalized,
        isCorrect,
      })
      .returning();

    if (isCorrect) {
      // Rätt svar -> bumpa step och nollställ ev. cooldown-flagga
      const [updated] = await db
        .update(teams)
        .set({
          step: Number(team.step ?? 0) + 1,
          lastWrongAt: null,
        })
        .where(eq(teams.id, teamId))
        .returning();

      return NextResponse.json({
        ok: true,
        result: "correct",
        team: { id: updated.id, step: updated.step, total },
      });
    }

    // Fel svar -> cooldown och straff
    const lastWrongAt = team.lastWrongAt ? new Date(team.lastWrongAt) : null;
    const tooSoon =
      lastWrongAt && now.getTime() - lastWrongAt.getTime() < COOLDOWN_MS;

    // uppdatera strafftid endast om inte "tooSoon" (annars kan man få flera straff på sekunden)
    const newDeadline = new Date(
      (team.deadline ? new Date(team.deadline).getTime() : Date.now()) + WRONG_PENALTY_SEC * 1000
    );

    const upd: any = { lastWrongAt: now };
    if (!tooSoon) {
      upd.penaltiesSec = Number(team.penaltiesSec ?? 0) + WRONG_PENALTY_SEC;
      upd.deadline = newDeadline;
    }

    await db.update(teams).set(upd).where(eq(teams.id, teamId));

    return NextResponse.json({
      ok: true,
      result: "wrong",
      penaltyAppliedSec: tooSoon ? 0 : WRONG_PENALTY_SEC,
      cooldownSec: Math.ceil(COOLDOWN_MS / 1000),
    });
  } catch (err) {
    console.error("submit error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
