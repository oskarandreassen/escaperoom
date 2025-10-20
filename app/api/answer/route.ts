// app/api/answer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getTeamCookie } from '@/lib/cookie';
import { CONFIG, computeTimeLeft } from '@/lib/time';

const IDMAP = ['bastu','hanglas','medicinskap','toalett'] as const;

export async function POST(req: NextRequest) {
  const teamId = getTeamCookie();
  if (!teamId) return NextResponse.json({ ok: false }, { status: 401 });

  const { digit } = await req.json();
  const tryDigit = Number(digit);
  if (!Number.isInteger(tryDigit) || tryDigit < 0 || tryDigit > 9) {
    return NextResponse.json({ ok: false, message: 'Ogiltig siffra' }, { status: 400 });
  }

  // Fetch team
  const teamRes = await sql/*sql*/`
    SELECT step, started_at, penalties_sec, locked_until, order_ids
    FROM teams WHERE id = ${teamId} LIMIT 1
  `;
  if (teamRes.rowCount === 0) return NextResponse.json({ ok: false }, { status: 404 });
  const team = teamRes.rows[0] as {
    step: number; started_at: string; penalties_sec: number; locked_until: string | null; order_ids: number[];
  };

  // time calc
  const now = Date.now();
  const startedAt = new Date(team.started_at).getTime();
  let timeLeft = computeTimeLeft(now, startedAt, team.penalties_sec);
  if (timeLeft <= 0) {
    // out of time
    return NextResponse.json({ correct: false, step: team.step, timeLeft: 0, lockedUntil: null }, { status: 200 });
  }

  // cooldown check
  if (team.locked_until && now < new Date(team.locked_until).getTime()) {
    return NextResponse.json({
      correct: false, step: team.step, timeLeft, lockedUntil: new Date(team.locked_until).toISOString()
    }, { status: 200 });
  }

  if (team.step >= 4) {
    return NextResponse.json({ correct: false, step: team.step, timeLeft }, { status: 200 });
  }

  const index = team.order_ids[team.step];
  const clueId = IDMAP[index];

  // fetch expected digit server-side only
  const clueRes = await sql/*sql*/`
    SELECT expected_digit FROM content_clues WHERE id = ${clueId} AND active = true LIMIT 1
  `;
  if (clueRes.rowCount === 0) return NextResponse.json({ ok: false }, { status: 404 });
  const expected = clueRes.rows[0].expected_digit as number;

  let correct = tryDigit === expected;
  let newStep = team.step;
  let penalties = team.penalties_sec;
  let lockedUntil: string | null = null;

  if (correct) {
    newStep = team.step + 1;
  } else {
    penalties = team.penalties_sec + CONFIG.WRONG_PENALTY_SEC;
    lockedUntil = new Date(Date.now() + CONFIG.INPUT_COOLDOWN_SEC * 1000).toISOString();
  }

  // recompute time after penalty
  timeLeft = computeTimeLeft(Date.now(), startedAt, penalties);

  // write submission + update team atomically
  await sql/*sql*/`
    WITH upd AS (
      UPDATE teams
      SET step = ${newStep},
          penalties_sec = ${penalties},
          locked_until = ${lockedUntil},
          last_wrong_at = ${correct ? null : new Date().toISOString()}
      WHERE id = ${teamId}
      RETURNING id
    )
    INSERT INTO submissions (team_id, digit, correct, time_left_at_submit)
    VALUES (${teamId}, ${tryDigit}, ${correct}, ${timeLeft})
  `;

  return NextResponse.json({
    correct, step: newStep, timeLeft, lockedUntil
  });
}
