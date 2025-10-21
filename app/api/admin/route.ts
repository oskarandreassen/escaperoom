// app/api/admin/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST() {
  // ev. framtida admin-init/seed
  return NextResponse.json({ ok: true });
}
