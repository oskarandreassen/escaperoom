// app/api/team/start/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/schema";

export async function POST() {
  // Skapa enkelt testlag
  const name = `Team-${Math.random().toString(36).slice(2, 6)}`;
  const [created] = await db
    .insert(teams)
    .values({ teamName: name })
    .returning();

  return NextResponse.json(created);
}
