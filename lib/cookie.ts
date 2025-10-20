// lib/cookie.ts
import { cookies } from 'next/headers';

const COOKIE_NAME = 'team_id';
const COOKIE_AGE = 60 * 60 * 24 * 7; // 7 dagar

export function setTeamCookie(teamId: string) {
  cookies().set({
    name: COOKIE_NAME,
    value: teamId,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: COOKIE_AGE
  });
}

export function getTeamCookie(): string | null {
  return cookies().get(COOKIE_NAME)?.value ?? null;
}

export function clearTeamCookie() {
  cookies().delete(COOKIE_NAME);
}
