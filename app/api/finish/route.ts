// app/api/finish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getTeamCookie } from '@/lib/cookie';
import { CONFIG, computeTimeLeft } from '@/lib/time';
import { KV, RUN_CODES_KEY } from '@/lib/kv';
import { toCharDigit } from '@/lib/utils';

const IDMAP = ['bastu','hanglas','medicinskap','toalett'] as const;

export async function POST(_req: NextRequest) {
  const teamId = getTeamCookie();
  if (!teamId) return NextResponse.json({ ok: false }, { status: 401 });

  // Load full team status
  const tRes = await sql/*sql*/`
    SELECT id, step, started_at, penalties_sec, order_ids, completed_at, final_code
    FROM teams WHERE id = ${teamId} LIMIT 1
  `;
  if (tRes.rowCount === 0) return NextResponse.json({ ok: false }, { status: 404 });

  const t = tRes.rows[0] as {
    id: string; step: number; started_at: string; penalties_sec: number; order_ids: number[];
    completed_at: string | null; final_code: string | null;
  };

  const nowMs = Date.now();
  const startedAt = new Date(t.started_at).getTime();
  let timeLeft = computeTimeLeft(nowMs, startedAt, t.penalties_sec);
  if (timeLeft < 0) timeLeft = 0;

  // If already finished, just return
  if (t.completed_at && t.final_code) {
    return NextResponse.json({ completed: true, timeLeft });
  }

  // If not at step 4 and still time left, don’t finalize
  if (t.step < 4 && timeLeft > 0) {
    return NextResponse.json({ completed: false, timeLeft }, { status: 200 });
  }

  // Build final code from correct digits in their order
  // We derive by querying each clue expected_digit in the given permutation
  const expectedDigitsRes = await sql/*sql*/`
    SELECT id, expected_digit FROM content_clues WHERE id = ANY(${IDMAP as unknown as string[]})
  `;

  const map = new Map<string, number>();
  for (const r of expectedDigitsRes.rows) {
    map.set(r.id as string, r.expected_digit as number);
  }

  const codeDigits = t.order_ids.slice(0,4).map(i => {
    const clueId = IDMAP[i];
    const d = map.get(clueId)!;
    return toCharDigit(d);
  });
  const finalCode = codeDigits.join('');

  // Antifraud: check KV set
  let fraud = false;
  try {
    const exists = await KV.sismember(RUN_CODES_KEY, finalCode);
    if (exists) {
      fraud = true;
    } else {
      await KV.sadd(RUN_CODES_KEY, finalCode);
    }
  } catch {
    // KV might be unavailable — ignore antifraud gracefully
  }

  await sql/*sql*/`
    UPDATE teams
    SET completed_at = NOW(),
        final_code = ${finalCode},
        fraud_suspected = ${fraud}
    WHERE id = ${teamId}
  `;

  return NextResponse.json({ completed: true, timeLeft, fraudSuspected: fraud });
}
