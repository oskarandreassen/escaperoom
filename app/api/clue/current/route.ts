// app/api/clue/current/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, contentClues } from "@/lib/schema";

const CLUE_TIME_SECONDS = 5 * 60; // 5 minuter

export async function GET(req: Request) {
  const url = new URL(req.url);
  const teamId = url.searchParams.get("teamId");

  if (!teamId) {
    return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });
  }

  // 1) Hämta laget
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) {
    return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });
  }

  // 2) Hämta alla aktiva ledtrådar i stabil ordning
  const clues = await db
    .select({
      id: contentClues.id,
      title: contentClues.title,
      icon: contentClues.icon,
      riddle: contentClues.riddle,
      expectedDigit: contentClues.expectedDigit,
    })
    .from(contentClues)
    .where(eq(contentClues.active, true))
    .orderBy(asc(contentClues.id));

  const total = clues.length;
  if (total === 0) {
    return NextResponse.json({ ok: false, error: "No active clues in DB" }, { status: 500 });
  }

  const stepRaw = typeof team.step === "number" ? team.step : 0;
  const step = Math.min(Math.max(stepRaw, 0), total - 1);

  const clue = clues[step];
  if (!clue) {
    return NextResponse.json({ ok: false, error: "Clue not found for current step" }, { status: 404 });
  }

  // 3) Starta/återstarta 5-minutersfönster
  const now = new Date();
  let deadline = team.lockedUntil ? new Date(team.lockedUntil) : null;

  // om deadline saknas eller passerad -> sätt ny
  if (!deadline || deadline <= now) {
    const newDeadline = new Date(now.getTime() + CLUE_TIME_SECONDS * 1000);

    await db
      .update(teams)
      .set({
        startedAt: team.startedAt ?? now,
        lockedUntil: newDeadline,
      })
      .where(eq(teams.id, teamId));

    deadline = newDeadline;
  }

  const timeLeftSec = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));

  return NextResponse.json({
    ok: true,
    team: { id: team.id, step, total },
    clue: { id: clue.id, title: clue.title, icon: clue.icon, riddle: clue.riddle },
    deadline: deadline.toISOString(),
    timeLeftSec,
  });
}
