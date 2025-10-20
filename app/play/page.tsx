// app/play/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Timer from '@/components/Timer';

type Clue = {
  index: number;
  title: string;
  icon: string;
  riddle: string;
  locationHint?: string | null;
  safetyHint?: string | null;
};

export default function PlayPage() {
  const [clue, setClue] = useState<Clue | null>(null);
  const [digit, setDigit] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [completed, setCompleted] = useState<{ ok: boolean; timeLeft: number } | null>(null);
  const [cooldownMsg, setCooldownMsg] = useState<string | null>(null);
  const polling = useRef<NodeJS.Timeout | null>(null);

  async function fetchClue() {
    const r = await fetch('/api/clue/current');
    if (r.status === 204) {
      // done, fetch finish state
      const f = await fetch('/api/finish', { method: 'POST' });
      if (f.ok) {
        const data = await f.json();
        setCompleted({ ok: data.completed, timeLeft: data.timeLeft });
      }
      return;
    }
    if (!r.ok) return;
    const data = await r.json();
    setClue(data);
  }

  async function fetchStatus() {
    const r = await fetch('/api/team/status', { cache: 'no-store' });
    if (!r.ok) return;
    const data = await r.json();
    setTimeLeft(data.timeLeft);
    setLockedUntil(data.lockedUntil ? Date.parse(data.lockedUntil) : null);
  }

  async function submitDigit(e: React.FormEvent) {
    e.preventDefault();
    if (!digit) return;
    const now = Date.now();
    if (lockedUntil && now < lockedUntil) {
      setCooldownMsg('Vänta, cooldown aktiv…');
      setTimeout(() => setCooldownMsg(null), 1000);
      return;
    }
    const r = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ digit: Number(digit[0]) })
    });
    const data = await r.json();
    setTimeLeft(data.timeLeft);
    setLockedUntil(data.lockedUntil ? Date.parse(data.lockedUntil) : null);

    if (data.correct) {
      setDigit('');
      await fetchClue();
    } else {
      // wrong feedback
      setCooldownMsg('Fel siffra (–30s). Cooldown 3s.');
      setTimeout(() => setCooldownMsg(null), 1500);
    }

    // if step advanced to 4 server will return finish on next clue fetch
    if (data.step >= 4) {
      const f = await fetch('/api/finish', { method: 'POST' });
      if (f.ok) {
        const fin = await f.json();
        setCompleted({ ok: fin.completed, timeLeft: fin.timeLeft });
      }
    }
  }

  useEffect(() => {
    fetchClue();
    fetchStatus();
    polling.current = setInterval(() => {
      fetchStatus();
    }, 2000);
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
  }, []);

  const mmss = useMemo(() => {
    if (timeLeft == null) return '--:--';
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  if (completed) {
    return (
      <main className="space-y-6">
        {completed.ok ? (
          <>
            <h1 className="text-2xl font-bold">Klarade utmaningen!</h1>
            <p>Ni slutförde med <b>{Math.floor(completed.timeLeft / 60)}:{(completed.timeLeft % 60).toString().padStart(2,'0')}</b> kvar.</p>
            <p className="text-sm opacity-80">Placering visas efter spelomgången.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Tiden är ute!</h1>
            <p>Tack för kämpainsatsen.</p>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ledtråd {clue ? clue.index + 1 : 1}/4</h1>
        <Timer timeLeft={timeLeft ?? 0} />
      </div>

      {clue ? (
        <section className="space-y-3">
          <div className="text-2xl">{clue.icon} <span className="font-semibold">{clue.title}</span></div>
          <pre className="whitespace-pre-wrap bg-neutral-900 p-3 rounded-md border border-neutral-800 text-sm leading-6">
{clue.riddle}
          </pre>
          {clue.locationHint ? <p className="text-sm opacity-90"><b>Så vet ni att ni är rätt:</b> {clue.locationHint}</p> : null}
          {clue.safetyHint ? <p className="text-sm opacity-80"><b>Säkerhet:</b> {clue.safetyHint}</p> : null}

          <form onSubmit={submitDigit} className="mt-2 flex gap-2">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              className="w-20 text-center rounded-md bg-neutral-900 border border-neutral-700 p-2 text-xl"
              placeholder="Siffra"
              value={digit}
              onChange={(e) => setDigit(e.target.value.replace(/\D/g, '').slice(0,1))}
            />
            <button className="rounded-md bg-purple-600 px-4 py-2 font-semibold">Skicka</button>
          </form>
          {cooldownMsg ? <div className="text-xs opacity-80">{cooldownMsg}</div> : null}
        </section>
      ) : (
        <p>Laddar ledtråd…</p>
      )}

      <div className="text-sm opacity-70">Tid kvar: {mmss}</div>
    </main>
  );
}
