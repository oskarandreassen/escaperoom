export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    teamName?: string;
    participants?: string;
  };
  if (!body.teamName || typeof body.teamName !== "string") {
    return NextResponse.json({ ok: false, error: "teamName krävs" }, { status: 400 });
  }

  const [row] = await db
    .insert(teams)
    .values({
      teamName: body.teamName.trim(),
      participants: (body.participants || "").trim() || null,
      step: 0,
    })
    .returning();

  return NextResponse.json({ ok: true, team: row });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id saknas" }, { status: 400 });

  await db.delete(teams).where(eq(teams.id, id));
  return NextResponse.json({ ok: true });
}
