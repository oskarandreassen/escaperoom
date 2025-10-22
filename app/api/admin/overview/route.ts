export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, contentClues } from "@/lib/schema";
import { and, eq, isNotNull } from "drizzle-orm";

export async function GET() {
  // Teams + felgissningar
  const teamRows = await db.select().from(teams);

  // wrong guesses per team
  const subs = await db
    .select({
      teamId: submissions.teamId,
      isCorrect: submissions.isCorrect,
    })
    .from(submissions);

  const wrongByTeam = new Map<string, number>();
  for (const s of subs) {
    if (!s.isCorrect) {
      wrongByTeam.set(s.teamId, (wrongByTeam.get(s.teamId) || 0) + 1);
    }
  }

  const activeClues = await db
    .select()
    .from(contentClues)
    .where(eq(contentClues.active, true));

  const byId = (activeClues ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.id] = c.orderIdx ?? 0;
    return acc;
  }, {});

  const totalClues = activeClues.length;

  const teamsOut = teamRows.map((t) => ({
    id: t.id,
    teamName: t.teamName,
    participants: t.participants ?? null,
    createdAt: t.createdAt?.toISOString?.() ?? null,
    startedAt: t.startedAt?.toISOString?.() ?? null,
    completedAt: t.completedAt?.toISOString?.() ?? null,
    finalCode: t.finalCode ?? null,
    step: t.step ?? 0,
    totalClues,
    wrongGuesses: wrongByTeam.get(t.id) || 0,
  }));

  // Clues
  const clues = await db.select().from(contentClues);

  // Sort by order
  clues.sort((a, b) => (a.orderIdx ?? 0) - (b.orderIdx ?? 0));

  return NextResponse.json({
    ok: true,
    teams: teamsOut,
    clues: clues.map((c) => ({
      id: c.id,
      title: c.title,
      icon: c.icon ?? null,
      riddle: c.riddle,
      type: c.type,
      expectedDigit: c.expectedDigit ?? null,
      expectedCode: c.expectedCode ?? null,
      durationSec: c.durationSec ?? null,
      active: c.active,
      orderIdx: c.orderIdx ?? 0,
    })),
  });
}
