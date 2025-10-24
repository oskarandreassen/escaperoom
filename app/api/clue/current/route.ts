export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams } from "@/lib/schema";
import { computeTimeLeft, CONFIG } from "@/lib/time";


const DEFAULT_CLUE_SECONDS = 5 * 60;
const QUESTIONS_PER_TEAM = 4;

// Load from data/clues.ts regardless of export name
async function getClues(): Promise<any[]> {
  const mod: any = await import("../../../../data/clues");
  return mod?.CLUES ?? mod?.default ?? mod?.clues ?? [];
}

// Fisher–Yates shuffle (safe with noUncheckedIndexedAccess)
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}
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

  const ALL = await getClues();
  const active = ALL.filter((c) => !!c?.active);
  const totalPool = active.length;

  // Create per-team order (4 clues) if missing/bad
  let orderIds: number[] = Array.isArray(team.orderIds) ? (team.orderIds as number[]) : [];
  if (orderIds.length !== QUESTIONS_PER_TEAM || orderIds.some((x) => typeof x !== "number")) {
    orderIds = pickAndShuffle(totalPool, QUESTIONS_PER_TEAM);
    await db.update(teams).set({ orderIds, step: 0 }).where(eq(teams.id, teamId));
    (team as any).orderIds = orderIds;
    (team as any).step = 0;
  }

  const total = orderIds.length;
  const step = Math.max(0, Math.min(Number(team.step ?? 0), Math.max(total - 1, 0)));

  if (total === 0) {
    return NextResponse.json({ ok: true, finished: true, team: { id: team.id, step: 0, total: 0 }, totalTimeSec: 0 });
  }

  if (team.completedAt) {
    const totalTimeSec =
      team.startedAt && team.completedAt
        ? Math.floor(((team.completedAt as Date).getTime() - (team.startedAt as Date).getTime()) / 1000)
        : 0;
    return NextResponse.json({ ok: true, finished: true, team: { id: team.id, step, total }, totalTimeSec });
  }

  const clueIdx = orderIds[step] ?? -1;
  const current = clueIdx >= 0 && clueIdx < active.length ? active[clueIdx] : undefined;

  if (!current) {
    return NextResponse.json({
      ok: true,
      finished: true,
      team: { id: team.id, step: total, total },
      totalTimeSec: team.startedAt ? Math.floor((Date.now() - (team.startedAt as Date).getTime()) / 1000) : 0,
    });
  }

  // Timer
const startedAtMs = (team.startedAt as Date | null)?.getTime() ?? Date.now();
const penalties = Number((team.penaltiesSec as number | null) ?? 0);

// Räkna korrekt kvarvarande tid (drar av straff)
const timeLeftSec = computeTimeLeft(Date.now(), startedAtMs, penalties);

// Bygg deadline från "nu + kvarvarande tid" så klientens ticker funkar som idag
const deadline = new Date(Date.now() + timeLeftSec * 1000);
  // Type comes from your file: "code" or "digit"
  const inferredType: "code" | "digit" =
    current?.type === "code" ? "code" : "digit";

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
