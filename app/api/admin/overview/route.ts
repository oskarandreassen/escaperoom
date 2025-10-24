export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, contentClues } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { CONFIG } from "@/lib/time";

export async function GET() {
  try {
    const teamRows = await db.select().from(teams).orderBy(desc(teams.createdAt));

    const allSubs = await db
      .select({
        id: submissions.id,
        teamId: submissions.teamId,
        correct: submissions.correct,
        submittedAt: submissions.submittedAt,
        timeLeftAtSubmit: submissions.timeLeftAtSubmit,
      })
      .from(submissions);

    const wrongByTeam = new Map<string, number>();
    const lastCorrectByTeam = new Map<
      string,
      { submittedAt: Date; timeLeftAtSubmit: number | null }
    >();

    for (const s of allSubs) {
      if (!s.correct) {
        wrongByTeam.set(s.teamId, (wrongByTeam.get(s.teamId) || 0) + 1);
      } else {
        const prev = lastCorrectByTeam.get(s.teamId);
        if (!prev || (s.submittedAt as Date) > prev.submittedAt) {
          lastCorrectByTeam.set(s.teamId, {
            submittedAt: s.submittedAt as Date,
            timeLeftAtSubmit: (s.timeLeftAtSubmit as number | null) ?? null,
          });
        }
      }
    }

    const activeClues = await db
      .select()
      .from(contentClues)
      .where(eq(contentClues.active, true));
    const totalClues = activeClues.length;

    const teamsOut = teamRows.map((t) => {
      const startedAt = t.startedAt as Date | null;
      const completedAt = t.completedAt as Date | null;
      const penalties = Number((t.penaltiesSec as number | null) ?? 0);

      const last = lastCorrectByTeam.get(t.id);

      let timeLeftAtFinishSec: number | null = null;
      let actualDurationSec: number | null = null;

      if (startedAt && completedAt) {
        const elapsedSec = Math.max(
          0,
          Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
        );
        const usedSec = elapsedSec + penalties;

        actualDurationSec = Math.min(CONFIG.ROUND_DURATION_SEC, Math.max(0, usedSec));
        timeLeftAtFinishSec = Math.max(0, CONFIG.ROUND_DURATION_SEC - usedSec);
      } else if (t.completedAt && last) {
        // Fallback om start saknas: approx utifrån snapshot minus straff
        const approxLeft = Math.max(0, Math.floor((last.timeLeftAtSubmit ?? 0) - penalties));
        timeLeftAtFinishSec = approxLeft;
        actualDurationSec = Math.min(
          CONFIG.ROUND_DURATION_SEC,
          CONFIG.ROUND_DURATION_SEC - approxLeft
        );
      }

      return {
        id: t.id,
        teamName: t.teamName,
        participants: t.participants ?? null,
        createdAt: (t.createdAt as Date | undefined)?.toISOString?.() ?? null,
        startedAt: startedAt?.toISOString?.() ?? null,
        completedAt: completedAt?.toISOString?.() ?? null,
        finalCode: t.finalCode ?? null,
        step: t.step ?? 0,
        totalClues,
        wrongGuesses: wrongByTeam.get(t.id) || 0,
        timeLeftAtFinishSec, // behålls tills UI byter
        actualDurationSec,   // ✅ ny: “hur lång tid det tog”
      };
    });

    return NextResponse.json({ ok: true, teams: teamsOut });
  } catch (err: any) {
    console.error("overview GET failed:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: "DB error: " + (err?.message || "unknown") },
      { status: 500 }
    );
  }
}
