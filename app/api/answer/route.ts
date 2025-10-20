// app/api/answer/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, teams, contentClues } from "@/lib/schema";
import { eq } from "drizzle-orm";

type Body = {
  teamId?: string;
  digit?: number;
  clueId?: string;
  timeLeftAtSubmit?: number;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!body.teamId) {
    return NextResponse.json({ error: "teamId missing" }, { status: 400 });
  }
  if (typeof body.digit !== "number") {
    return NextResponse.json({ error: "digit missing" }, { status: 400 });
  }
  if (!body.clueId) {
    return NextResponse.json({ error: "clueId missing" }, { status: 400 });
  }

  // Hämta förväntad siffra för vald ledtråd
  const clueRows = await db
    .select({ expectedDigit: contentClues.expectedDigit })
    .from(contentClues)
    .where(eq(contentClues.id, body.clueId));

  const clue = clueRows[0];
  if (!clue) {
    return NextResponse.json({ error: "clue not found" }, { status: 404 });
  }

  const isCorrect = clue.expectedDigit === body.digit;

  // Spara submissionen
  const [saved] = await db
    .insert(submissions)
    .values({
      teamId: body.teamId,
      digit: body.digit,
      correct: isCorrect,
      timeLeftAtSubmit: body.timeLeftAtSubmit ?? 0,
    })
    .returning();

  // Om rätt svar: öka teamets steg på ett säkert sätt (utan sql-template)
  if (isCorrect) {
    const current = await db
      .select({ step: teams.step })
      .from(teams)
      .where(eq(teams.id, body.teamId));

    const currentStep = current[0]?.step ?? 0;

    await db
      .update(teams)
      .set({ step: currentStep + 1 })
      .where(eq(teams.id, body.teamId));
  }

  return NextResponse.json({ ok: true, submission: saved, correct: isCorrect });
}
