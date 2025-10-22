export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams } from "@/lib/schema";

const DEFAULT_CLUE_SECONDS = 5 * 60;
const QUESTIONS_PER_TEAM = 4;

// Robust laddning av data/clues.ts oavsett exportformat
async function getClues(): Promise<any[]> {
  const mod: any = await import("../../../../data/clues");
  return mod?.CLUES ?? mod?.default ?? mod?.clues ?? [];
}

// Fisher–Yates shuffle (safe for noUncheckedIndexedAccess)
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;   // non-null assertions: i & j are in range
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}


// Plocka K unika index från [0..n-1], slumpad ordning
function pickAndShuffle(n: number, k: number): number[] {
  const count = Math.min(Math.max(0, k), Math.max(0, n));
  const indices = Array.from({ length: n }, (_, i) => i);
  return shuffle(indices).slice(0, count);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ ok: false, error: "Missing teamId" }, { status: 400 });

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return NextResponse.json({ ok: false, error: "Team not found" }, { status: 404 });

  // Aktiva gåtor från datafilen
  const ALL = await getClues();
  const active = ALL.filter((c) => !!c?.active);
  const totalPool: number = active.length;

  // Säkerställ att orderIds finns och har exakt QUESTIONS_PER_TEAM stycken
  let orderIds: number[] = Array.isArray(team.orderIds) ? (team.orderIds as number[]) : [];
  if (orderIds.length !== QUESTIONS_PER_TEAM || orderIds.some((x) => typeof x !== "number")) {
    orderIds = pickAndShuffle(totalPool, QUESTIONS_PER_TEAM);
    await db.update(teams).set({ orderIds, step: 0 }).where(eq(teams.id, teamId));
    (team as any).orderIds = orderIds;
    (team as any).step = 0;
  }

  const total: number = orderIds.length;
  const step: number = Math.max(0, Math.min(Number(team.step ?? 0), Math.max(total - 1, 0)));

  // Inga frågor valda → klart
  if (total === 0) {
    return NextResponse.json({
      ok: true,
      finished: true,
      team: { id: team.id, step: 0, total: 0 },
      totalTimeSec: 0,
    });
  }

  // Klart
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

  // Hämta aktuell index säkert
  const clueIdx: number = orderIds[step] ?? -1;
  const current = clueIdx >= 0 && clueIdx < active.length ? active[clueIdx] : undefined;

  if (!current) {
    // Om gåtan avaktiverats mitt i spelet → avsluta
    return NextResponse.json({
      ok: true,
      finished: true,
      team: { id: team.id, step: total, total },
      totalTimeSec: team.startedAt
        ? Math.floor((Date.now() - (team.startedAt as Date).getTime()) / 1000)
        : 0,
    });
  }

  // Timer
  const startedAtMs = (team.startedAt as Date | null)?.getTime() ?? Date.now();
  const penalties = Number((team.penaltiesSec as number | null) ?? 0);
  const deadline = new Date(startedAtMs + (DEFAULT_CLUE_SECONDS + penalties) * 1000);
  const now = new Date();
  const timeLeftSec = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));

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
