import { NextResponse } from "next/server";

const COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || "adm";
const MAX_DAYS = parseInt(process.env.ADMIN_COOKIE_MAX_DAYS || "14", 10);

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "ADMIN_PASSWORD saknas i env." }, { status: 500 });
  }
  if (password !== expected) {
    return NextResponse.json({ ok: false, error: "Fel lösenord." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "1",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    maxAge: MAX_DAYS * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    maxAge: 0,
  });
  return res;
}
