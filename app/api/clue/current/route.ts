// app/api/clue/current/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentClues } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  // Returnera första aktiva ledtråden (exempel – ändra till din logik)
  const rows = await db.select().from(contentClues).where(eq(contentClues.active, true));
  if (rows.length === 0) return NextResponse.json({ error: "no active clue" }, { status: 404 });

  return NextResponse.json(rows[0]);
}
