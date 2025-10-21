// app/api/clue/current/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams } from "@/lib/schema";
import { CLUES, DEFAULT_CLUE_SECONDS } from "@/data/clues";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });

  // Filtrera på aktiva gåtor
  const activeClues = CLUES.filter((c) => c.active !== false);
  const total = activeClues.length;
  const step = Math.min(Math.max(typeof team.step === "number" ? team.step : 0, 0), Math.max(total - 1, 0));

  // Om laget redan är klart: returnera "finished" + totaltid, och starta inte någon ny timer.
  if (team.completedAt && team.startedAt) {
    const totalMs = new Date(team.completedAt).getTime() - new Date(team.startedAt).getTime();
    const totalSec = Math.max(0, Math.floor(totalMs / 1000));
    return NextResponse.json({
      ok: true,
      finished: true,
      team: { id: team.id, step: total, total },
      totalTimeSec: totalSec,
    });
  }

  if (total === 0) {
    return NextResponse.json({ ok: false, error: "No active clues in config" }, { status: 500 });
  }

  const clue = activeClues[step];
  if (!clue) {
    return NextResponse.json({ ok: false, error: "Clue not found for step" }, { status: 404 });
  }

  // Bestäm per-ledtråd-tid
  const clueSeconds = typeof clue.durationSec === "number" ? clue.durationSec : DEFAULT_CLUE_SECONDS;

  // Timerhantering: använd teams.lockedUntil som "deadline" för pågående ledtråd.
  const now = new Date();
  let deadline = team.lockedUntil ? new Date(team.lockedUntil) : null;

  // Starta deadline om saknas eller passerad OCH laget inte är klart
  if (!deadline || deadline <= now) {
    const newDeadline = new Date(now.getTime() + clueSeconds * 1000);
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
    finished: false,
    team: { id: team.id, step, total },
    clue: {
      id: clue.id,
      title: clue.title,
      icon: clue.icon,
      riddle: clue.riddle,
      type: clue.type,
    },
    deadline: deadline.toISOString(),
    timeLeftSec,
  });
}
