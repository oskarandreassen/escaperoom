// components/Timer.tsx
'use client';

import { useEffect, useState } from 'react';

export default function Timer({ timeLeft }: { timeLeft: number }) {
  const [local, setLocal] = useState(timeLeft);

  useEffect(() => setLocal(timeLeft), [timeLeft]);

  useEffect(() => {
    const t = setInterval(() => setLocal((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const m = Math.floor(local / 60);
  const s = local % 60;

  return (
    <div className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1 text-lg font-mono">
      {m}:{s.toString().padStart(2, '0')}
    </div>
  );
}
