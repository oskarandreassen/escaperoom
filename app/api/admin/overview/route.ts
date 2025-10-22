export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, contentClues } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    // Hämta alla lag (nyast först från DB för stabilitet)
    const teamRows = await db.select().from(teams).orderBy(desc(teams.createdAt));

    // Hämta alla submissions en gång
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

    // Antal aktiva gåtor (används bara som referens i admin)
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

    // Behåll “nyast först” även i svaret
    return NextResponse.json({ ok: true, teams: teamsOut });
  } catch (err: any) {
    console.error("overview GET failed:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: "DB error: " + (err?.message || "unknown") },
      { status: 500 }
    );
  }
}
