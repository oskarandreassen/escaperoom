// app/api/team/start/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawName: unknown = body?.teamName ?? body?.team ?? body?.name;

    if (typeof rawName !== "string" || !rawName.trim()) {
      return NextResponse.json({ ok: false, error: "Ange ett lagnamn." }, { status: 400 });
    }

    const teamName = rawName.trim().slice(0, 64);

    // förhindra dubbletter
    const exists = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.teamName, teamName))
      .limit(1);

    if (exists.length) {
      return NextResponse.json(
        { ok: false, error: "Det finns redan ett lag med det namnet." },
        { status: 409 }
      );
    }

    const inserted = await db
      .insert(teams)
      .values({ teamName }) // defaults sätter resten
      .returning({ id: teams.id });

    const created = inserted[0];
    if (!created) {
      return NextResponse.json(
        { ok: false, error: "Kunde inte skapa lag (tomt svar från databasen)." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, teamId: created.id });
  } catch (err) {
    console.error("Create team error:", err);
    return NextResponse.json(
      { ok: false, error: "Något gick fel när laget skulle skapas." },
      { status: 500 }
    );
  }
}
