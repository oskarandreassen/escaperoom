// app/api/team/start/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, contentClues } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";

/**
 * Skapar ett nytt lag och startar en runda.
 * - Unikt lagnamn (case-insensitive).
 * - Sparar valfria "participants" (komma-separerade namn eller fri text).
 * - Initierar steg, ordning och starttid.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const teamNameRaw: unknown = body?.teamName;
    const participantsRaw: unknown = body?.participants;

    const teamName = typeof teamNameRaw === "string" ? teamNameRaw.trim() : "";
    const participants =
      typeof participantsRaw === "string" ? participantsRaw.trim() || null : null;

    if (!teamName) {
      return NextResponse.json({ ok: false, error: "Ange ett lagnamn." }, { status: 400 });
    }

    // Finns redan?
    const existing = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.teamName, teamName))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Det finns redan ett lag med det namnet." },
        { status: 409 }
      );
    }

    // Bygg ordning (enkel: index 0..N-1 baserat på aktiva ledtrådar)
    const activeClues = await db
      .select({ id: contentClues.id })
      .from(contentClues)
      .where(eq(contentClues.active, true))
      .orderBy(asc(contentClues.id));

    const orderIds = Array.from({ length: activeClues.length }, (_, i) => i);
    const now = new Date();

    const inserted = await db
      .insert(teams)
      .values({
        teamName,
        participants, // <-- spara deltagare
        createdAt: now,
        startedAt: now,
        step: 0,
        orderIds,
        penaltiesSec: 0,
        fraudSuspected: false,
      })
      .returning({ id: teams.id });

    const row = inserted?.[0];
    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Kunde inte skapa lagpost." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, teamId: row.id });
  } catch (err: any) {
    console.error("Create team error:", err);
    return NextResponse.json(
      { ok: false, error: "Något gick fel när laget skulle skapas." },
      { status: 500 }
    );
  }
}
