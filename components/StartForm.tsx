// components/StartForm.tsx
'use client';

import { useState } from 'react';

export default function StartForm() {
  const [teamName, setTeamName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const disabled = !accepted || !teamName || loading;

  async function onStart(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/team/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName })
      });
      if (!res.ok) throw new Error('Kunde inte starta');
      // redirect to play
      window.location.href = '/play';
    } catch (e) {
      alert('Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onStart}>
      <div>
        <label className="block text-sm mb-1">Lagnamn</label>
        <input
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 p-2"
          placeholder="Team Spökena"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          maxLength={40}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        Vi har läst och godkänner reglerna.
      </label>
      <button
        disabled={disabled}
        className="w-full rounded-md bg-purple-600 py-2 font-semibold disabled:opacity-50"
      >
        {loading ? 'Startar…' : 'Starta'}
      </button>
    </form>
  );
}
