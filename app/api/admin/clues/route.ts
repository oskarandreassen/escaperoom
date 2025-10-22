export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentClues } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

type Body = {
  id?: string;
  title?: string;
  icon?: string | null;
  riddle?: string;
  expectedDigit?: number | string | null;
  verification?: string | null; // kod-svar
  locationHint?: string | null;
  safetyHint?: string | null;
  notes?: string | null;
  active?: boolean | string;
} | undefined;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body?.title || !body?.riddle) {
    return NextResponse.json({ ok: false, error: "title och riddle krävs" }, { status: 400 });
  }

  const id = randomUUID();
  const val: any = {
    id,
    title: String(body.title),
    icon: body.icon ? String(body.icon) : null,
    riddle: String(body.riddle),
    expectedDigit:
      body.expectedDigit === null || body.expectedDigit === "" || body.expectedDigit === undefined
        ? null
        : Number(body.expectedDigit),
    verification: body.verification ? String(body.verification) : null,
    locationHint: body.locationHint ? String(body.locationHint) : null,
    safetyHint: body.safetyHint ? String(body.safetyHint) : null,
    notes: body.notes ? String(body.notes) : null,
    active: !!body.active,
  };

  const [row] = await db.insert(contentClues).values(val).returning();
  return NextResponse.json({ ok: true, clue: row });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body?.id) return NextResponse.json({ ok: false, error: "id saknas" }, { status: 400 });

  const updates: any = {};
  if (body.title !== undefined) updates.title = String(body.title);
  if (body.icon !== undefined) updates.icon = body.icon ? String(body.icon) : null;
  if (body.riddle !== undefined) updates.riddle = String(body.riddle);
  if (body.expectedDigit !== undefined)
    updates.expectedDigit =
      body.expectedDigit === null || body.expectedDigit === ""
        ? null
        : Number(body.expectedDigit);
  if (body.verification !== undefined)
    updates.verification = body.verification ? String(body.verification) : null;
  if (body.locationHint !== undefined)
    updates.locationHint = body.locationHint ? String(body.locationHint) : null;
  if (body.safetyHint !== undefined)
    updates.safetyHint = body.safetyHint ? String(body.safetyHint) : null;
  if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes) : null;
  if (body.active !== undefined) updates.active = !!body.active;

  const [row] = await db.update(contentClues).set(updates).where(eq(contentClues.id, body.id)).returning();
  return NextResponse.json({ ok: true, clue: row });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id saknas" }, { status: 400 });

  await db.delete(contentClues).where(eq(contentClues.id, id));
  return NextResponse.json({ ok: true });
}
