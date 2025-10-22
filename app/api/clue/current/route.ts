// app/api/clue/current/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, contentClues } from "@/lib/schema";

const DEFAULT_CLUE_SECONDS = 5 * 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });

  // Hämta aktiva gåtor i ordning
  const clues = await db
    .select()
    .from(contentClues)
    .where(eq(contentClues.active, true))
    .orderBy(asc(contentClues.orderIdx));

  const total = clues.length;
  const step = Math.max(0, Math.min(Number(team.step ?? 0), Math.max(total - 1, 0)));

  if (total === 0) {
    return NextResponse.json({
      ok: true,
      finished: true,
      team: { id: team.id, step: 0, total: 0 },
      totalTimeSec: 0,
    });
  }

  // Klar?
  if (team.completedAt) {
    return NextResponse.json({
      ok: true,
      finished: true,
      team: { id: team.id, step, total },
      totalTimeSec: Math.floor(((team.completedAt as Date).getTime() - (team.startedAt as Date).getTime()) / 1000),
    });
  }

  const current = clues[step];
  if (!current) {
    // beyond last step => finished
    return NextResponse.json({
      ok: true,
      finished: true,
      team: { id: team.id, step: total, total },
      totalTimeSec: team.startedAt ? Math.floor((Date.now() - (team.startedAt as Date).getTime()) / 1000) : 0,
    });
  }

  // Deadline: per-step duration, startat + ev. straff (penaltiesSec)
  const per = Number(current.durationSec ?? DEFAULT_CLUE_SECONDS);
  const baseStart = team.deadline ? (team.deadline as Date).getTime() - per * 1000 : Date.now();
  const startedAtMs = team.deadline ? baseStart : (team.startedAt as Date | null)?.getTime() ?? Date.now();
  const penalties = Number(team.penaltiesSec ?? 0);
  const deadline = new Date(startedAtMs + (per + penalties) * 1000);
  const now = new Date();
  const timeLeftSec = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));

  return NextResponse.json({
    ok: true,
    finished: false,
    team: { id: team.id, step, total },
    clue: {
      id: current.id,
      title: current.title,
      icon: current.icon ?? "",
      riddle: current.riddle,
      type: current.type,
    },
    deadline: deadline.toISOString(),
    timeLeftSec,
  });
}
