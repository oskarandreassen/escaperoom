export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams } from "@/lib/schema";

const DEFAULT_CLUE_SECONDS = 5 * 60;

// Robust laddning av data/clues.ts oavsett exportformat
async function getClues(): Promise<any[]> {
  const mod: any = await import("../../../../data/clues");
  return mod?.CLUES ?? mod?.default ?? mod?.clues ?? [];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });

  const ALL = (await getClues()) as any[];
  // använd bara aktiva, i samma ordning som i filen
  const clues = ALL.filter((c) => !!c.active);
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

  if (team.completedAt) {
    const totalTimeSec =
      team.startedAt && team.completedAt
        ? Math.floor(((team.completedAt as Date).getTime() - (team.startedAt as Date).getTime()) / 1000)
        : 0;
    return NextResponse.json({
      ok: true,
      finished: true,
      team: { id: team.id, step, total },
      totalTimeSec,
    });
  }

  const current = clues[step];
  if (!current) {
    return NextResponse.json({
      ok: true,
      finished: true,
      team: { id: team.id, step: total, total },
      totalTimeSec: team.startedAt
        ? Math.floor((Date.now() - (team.startedAt as Date).getTime()) / 1000)
        : 0,
    });
  }

  // Timer: startedAt + standardtid + ack. straff (penaltiesSec)
  const startedAtMs = (team.startedAt as Date | null)?.getTime() ?? Date.now();
  const penalties = Number((team.penaltiesSec as number | null) ?? 0);
  const deadline = new Date(startedAtMs + (DEFAULT_CLUE_SECONDS + penalties) * 1000);
  const now = new Date();
  const timeLeftSec = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));

  // härled typ från din clues.ts: verification => code, annars digit
  const inferredType =
    current?.verification && String(current.verification).length > 0 ? "code" : "digit";

  return NextResponse.json({
    ok: true,
    finished: false,
    team: { id: team.id, step, total },
    clue: {
      id: current?.id ?? String(step),
      title: current?.title ?? "",
      icon: current?.icon ?? "",
      riddle: current?.riddle ?? "",
      type: inferredType,
    },
    deadline: deadline.toISOString(),
    timeLeftSec,
  });
}
