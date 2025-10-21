// app/api/team/status/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId missing" }, { status: 400 });

  const rows = await db.select().from(teams).where(eq(teams.id, teamId));
  if (rows.length === 0) return NextResponse.json({ error: "team not found" }, { status: 404 });

  return NextResponse.json(rows[0]);
}
