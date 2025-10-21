// app/api/admin/login/page.tsx
'use client';

import { useState } from 'react';

export default function AdminLoginPage() {
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ password: pwd })
    });
    if (res.ok) window.location.href = '/api/admin';
    else alert('Fel lösenord');
    setLoading(false);
  }

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-bold">Admin-inlogg</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          type="password"
          placeholder="Admin-lösenord"
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 p-2"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
        />
        <button className="rounded-md bg-purple-600 px-4 py-2 font-semibold" disabled={loading}>
          {loading ? 'Loggar in…' : 'Logga in'}
        </button>
      </form>
    </main>
  );
}
