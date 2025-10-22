export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, submissions } from "@/lib/schema";

const WRONG_PENALTY_SEC = 30;
const COOLDOWN_MS = 3000;
const DEFAULT_CLUE_SECONDS = 5 * 60;
const QUESTIONS_PER_TEAM = 4;

// Robust laddning av data/clues.ts oavsett exportformat
async function getClues(): Promise<any[]> {
  const mod: any = await import("../../../../data/clues");
  return mod?.CLUES ?? mod?.default ?? mod?.clues ?? [];
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const teamId: string | undefined = body?.teamId;
    const rawAnswer: string | number | undefined = body?.answer ?? body?.digit;

    if (!teamId) return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });
    if (rawAnswer == null)
      return NextResponse.json({ ok: false, error: "Missing answer" }, { status: 400 });

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });

    const ALL = await getClues();
    const active = ALL.filter((c) => !!c?.active);

    // Säkerställ orderIds
    let orderIds: number[] = Array.isArray(team.orderIds) ? (team.orderIds as number[]) : [];
    if (orderIds.length !== QUESTIONS_PER_TEAM || orderIds.some((x) => typeof x !== "number")) {
      // fallback – current/route.ts kommer att re-seeda vid nästa GET
      orderIds = Array.from({ length: Math.min(QUESTIONS_PER_TEAM, active.length) }, (_, i) => i);
      await db.update(teams).set({ orderIds }).where(eq(teams.id, teamId));
    }

    const total: number = orderIds.length;
    const step: number = Math.max(0, Math.min(Number(team.step ?? 0), Math.max(total - 1, 0)));
    const clueIdx: number = orderIds[step] ?? -1;
    const current = clueIdx >= 0 && clueIdx < active.length ? active[clueIdx] : undefined;

    if (!current) {
      return NextResponse.json({ ok: false, error: "No current clue" }, { status: 400 });
    }

    const expectedDigit = current?.expectedDigit ?? null;
    const expectedCode = (current?.verification as string | null) ?? null;

    const normalized =
      typeof rawAnswer === "number" ? String(rawAnswer) : String(rawAnswer || "").trim();
    const isDigitAttempt = /^\d+$/.test(normalized);

    let isCorrect = false;
    if (expectedCode && expectedCode.length > 0) {
      isCorrect = normalized === expectedCode;
    } else {
      isCorrect = isDigitAttempt && Number(normalized) === Number(expectedDigit ?? NaN);
    }

    const now = new Date();

    // kvarvarande tid för logg/admin
    const startedAtMs = (team.startedAt as Date | null)?.getTime() ?? Date.now();
    const penalties = Number((team.penaltiesSec as number | null) ?? 0);
    const deadline = new Date(startedAtMs + (DEFAULT_CLUE_SECONDS + penalties) * 1000);
    const timeLeftSec = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));

    // logga submission (din schema)
    const digitValue = isDigitAttempt ? Number(normalized) : -1;
    await db.insert(submissions).values({
      teamId,
      digit: digitValue,
      correct: isCorrect,
      timeLeftAtSubmit: timeLeftSec,
      submittedAt: now as any,
    });

    if (isCorrect) {
      const isLast = step + 1 >= total;
      const update: any = {
        step: Number(team.step ?? 0) + 1,
        lastWrongAt: null,
        lockedUntil: null,
      };
      if (isLast) update.completedAt = now;

      const ret = await db.update(teams).set(update).where(eq(teams.id, teamId)).returning();
      const updated = ret?.[0] ?? { id: teamId, step: (team.step ?? 0) + 1 };

      return NextResponse.json({
        ok: true,
        result: "correct",
        correct: true,
        team: { id: updated.id, step: updated.step, total },
        finished: isLast,
      });
    }

    // fel svar → cooldown + straff
    const lastWrongAt = team.lastWrongAt ? new Date(team.lastWrongAt) : null;
    const tooSoon = lastWrongAt && now.getTime() - lastWrongAt.getTime() < COOLDOWN_MS;

    const upd: any = { lastWrongAt: now };
    if (!tooSoon) {
      upd.penaltiesSec = Number(team.penaltiesSec ?? 0) + WRONG_PENALTY_SEC;
      upd.lockedUntil = new Date(now.getTime() + COOLDOWN_MS);
    }

    await db.update(teams).set(upd).where(eq(teams.id, teamId));

    return NextResponse.json({
      ok: true,
      result: "wrong",
      correct: false,
      penaltyAppliedSec: tooSoon ? 0 : WRONG_PENALTY_SEC,
      cooldownSec: Math.ceil(COOLDOWN_MS / 1000),
    });
  } catch (err) {
    console.error("submit error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
