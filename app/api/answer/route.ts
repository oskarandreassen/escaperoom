// app/api/answer/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, teams, contentClues } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    teamId?: string;
    digit?: number;
    clueId?: string;
    timeLeftAtSubmit?: number;
  };

  if (!body.teamId) return NextResponse.json({ error: "teamId missing" }, { status: 400 });
  if (typeof body.digit !== "number") return NextResponse.json({ error: "digit missing" }, { status: 400 });
  if (!body.clueId) return NextResponse.json({ error: "clueId missing" }, { status: 400 });

  // Hämta förväntad siffra
  const clueRows = await db
    .select({ expectedDigit: contentClues.expectedDigit })
    .from(contentClues)
    .where(eq(contentClues.id, body.clueId));

  if (clueRows.length === 0) return NextResponse.json({ error: "clue not found" }, { status: 404 });

  const isCorrect = clueRows[0].expectedDigit === body.digit;

  const [saved] = await db
    .insert(submissions)
    .values({
      teamId: body.teamId,
      digit: body.digit,
      correct: isCorrect,
      timeLeftAtSubmit: body.timeLeftAtSubmit ?? 0,
    })
    .returning();

  // (valfritt) uppdatera team.step / penalties beroende på om svaret är rätt
  if (isCorrect) {
    await db
      .update(teams)
      .set({ step: (/* @ts-expect-error */ (undefined as never)) })
      .where(eq(teams.id, body.teamId));
    // ↑ Lämna tomt — fyll i logiken när du vet hur steg ska räknas
  }

  return NextResponse.json({ ok: true, submission: saved, correct: isCorrect });
}
