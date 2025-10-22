export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentClues } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

type Body =
  | {
      id?: string;
      title?: string;
      icon?: string | null;
      riddle?: string;
      type?: "digit" | "code";
      expectedDigit?: number | string | null;
      expectedCode?: string | null;
      durationSec?: number | string | null;
      active?: boolean | string;
      orderIdx?: number | string;
    }
  | undefined;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body?.title || !body?.type || !body?.riddle) {
    return NextResponse.json({ ok: false, error: "title, type, riddle krävs" }, { status: 400 });
  }

  const id = randomUUID();
  const val: any = {
    id,
    title: String(body.title),
    icon: body.icon ? String(body.icon) : null,
    riddle: String(body.riddle),
    type: body.type === "code" ? "code" : "digit",
    expectedDigit:
      body.type === "digit" && body.expectedDigit !== undefined && body.expectedDigit !== null
        ? Number(body.expectedDigit)
        : null,
    expectedCode:
      body.type === "code" && body.expectedCode ? String(body.expectedCode) : null,
    durationSec: body.durationSec ? Number(body.durationSec) : 300,
    active: !!body.active,
    orderIdx: body.orderIdx ? Number(body.orderIdx) : 0,
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
  if (body.type !== undefined) updates.type = body.type === "code" ? "code" : "digit";
  if (body.durationSec !== undefined) updates.durationSec = Number(body.durationSec);
  if (body.active !== undefined) updates.active = !!body.active;
  if (body.orderIdx !== undefined) updates.orderIdx = Number(body.orderIdx);
  if (body.expectedDigit !== undefined)
    updates.expectedDigit =
      body.expectedDigit === null || body.expectedDigit === ""
        ? null
        : Number(body.expectedDigit);
  if (body.expectedCode !== undefined)
    updates.expectedCode =
      body.expectedCode === null || body.expectedCode === ""
        ? null
        : String(body.expectedCode);

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
