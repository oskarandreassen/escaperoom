export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, contentClues } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    // Hämta alla lag
    const teamRows = await db.select().from(teams);

    // Felgissningar per lag (correct = false)
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
    const lastCorrectByTeam = new Map<string, { submittedAt: Date; timeLeftAtSubmit: number | null }>();

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

    // Antal aktiva gåtor för referens
    const activeClues = await db
      .select()
      .from(contentClues)
      .where(eq(contentClues.active, true));
    const totalClues = activeClues.length;

    const teamsOut = teamRows.map((t) => {
      const last = lastCorrectByTeam.get(t.id);
      return {
        id: t.id,
        teamName: t.teamName,
        participants: t.participants ?? null,
        createdAt: (t.createdAt as Date | undefined)?.toISOString?.() ?? null,
        startedAt: (t.startedAt as Date | null)?.toISOString?.() ?? null,
        completedAt: (t.completedAt as Date | null)?.toISOString?.() ?? null,
        finalCode: t.finalCode ?? null,
        step: t.step ?? 0,
        totalClues,
        wrongGuesses: wrongByTeam.get(t.id) || 0,
        timeLeftAtFinishSec: t.completedAt ? (last?.timeLeftAtSubmit ?? 0) : null,
      };
    });

    // Sortera stabilt (t.ex. på createdAt fallande)
    teamsOut.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return NextResponse.json({ ok: true, teams: teamsOut });
  } catch (err: any) {
    console.error("overview GET failed:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: "DB error: " + (err?.message || "unknown") },
      { status: 500 }
    );
  }
}
