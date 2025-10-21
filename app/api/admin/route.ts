// app/api/admin/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST() {
  // Lägg ev. admin-initialisering här (tex seedning)
  return NextResponse.json({ ok: true });
}
