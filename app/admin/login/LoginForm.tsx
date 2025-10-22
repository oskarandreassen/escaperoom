"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginForm() {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sp = useSearchParams();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });

      // Om API:et kraschar och inte returnerar JSON => fånga text
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        const raw = await res.text();
        setErr(raw || "Tekniskt fel. Försök igen.");
        setLoading(false);
        return;
      }

      if (!res.ok || !data?.ok) {
        setErr(data?.error || "Fel lösenord");
      } else {
        const next = sp.get("next") || "/admin";
        router.replace(next);
      }
    } catch {
      setErr("Tekniskt fel. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-900/60 p-5 shadow-xl"
      >
        <h1 className="mb-4 text-xl font-bold">Admin login</h1>
        {err ? (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm">
            {err}
          </div>
        ) : null}
        <input
          type="password"
          placeholder="Admin-lösenord"
          className="mb-3 w-full rounded-md bg-neutral-900 border border-neutral-700 p-2"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
        />
        <button
          className="w-full rounded-md bg-purple-600 px-4 py-2 font-semibold"
          disabled={loading}
        >
          {loading ? "Loggar in…" : "Logga in"}
        </button>
      </form>
    </main>
  );
}
