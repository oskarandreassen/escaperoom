export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, contentClues } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  // Teams
  const teamRows = await db.select().from(teams);

  // Läs submissions och räkna fel (correct = false)
  const subs = await db
    .select({
      teamId: submissions.teamId,
      correct: submissions.correct,
    })
    .from(submissions);

  const wrongByTeam = new Map<string, number>();
  for (const s of subs) {
    if (!s.correct) {
      wrongByTeam.set(s.teamId, (wrongByTeam.get(s.teamId) || 0) + 1);
    }
  }

  // Aktiva gåtor
  const activeClues = await db
    .select()
    .from(contentClues)
    .where(eq(contentClues.active, true));

  const totalClues = activeClues.length;

  const teamsOut = teamRows.map((t) => ({
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
  }));

  // Alla gåtor (utan antagna fält som inte finns i schemat)
  const clues = await db.select().from(contentClues);

  // En stabil sort (t.ex. titel) när order-fält saknas
  clues.sort((a, b) => a.title.localeCompare(b.title));

  return NextResponse.json({
    ok: true,
    teams: teamsOut,
    clues: clues.map((c) => ({
      id: c.id,
      title: c.title,
      icon: (c as any).icon ?? null,
      riddle: c.riddle,
      expectedDigit: (c as any).expectedDigit ?? null,
      verification: (c as any).verification ?? null,
      locationHint: (c as any).locationHint ?? null,
      safetyHint: (c as any).safetyHint ?? null,
      notes: (c as any).notes ?? null,
      active: c.active,
    })),
  });
}
