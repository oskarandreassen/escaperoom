// app/api/finish/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const body = (await req.json()) as { teamId?: string; finalCode?: string };

  if (!body.teamId) return NextResponse.json({ error: "teamId missing" }, { status: 400 });
  if (typeof body.finalCode !== "string") {
    return NextResponse.json({ error: "finalCode missing" }, { status: 400 });
  }

  // Markera lag som klart
  const [updated] = await db
    .update(teams)
    .set({ completedAt: new Date(), finalCode: body.finalCode as string })
    .where(eq(teams.id, body.teamId))
    .returning();

  if (!updated) return NextResponse.json({ error: "team not found" }, { status: 404 });

  return NextResponse.json({ ok: true, team: updated });
}
