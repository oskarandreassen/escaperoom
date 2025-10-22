"use client";

import { useEffect, useMemo, useState } from "react";

type TeamRow = {
  id: string;
  teamName: string;
  participants?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  step?: number | null;
  totalClues?: number | null;
  wrongGuesses: number;
  timeLeftAtFinishSec?: number | null;
};

type OverviewResp = {
  ok: true;
  teams: TeamRow[];
};

export default function AdminPage() {
  const [data, setData] = useState<OverviewResp | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof TeamRow>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) {
        console.error("overview error:", await res.text().catch(() => ""));
        return;
      }
      const json = (await res.json()) as OverviewResp;
      if (json?.ok) setData(json);
    } catch (e) {
      console.error("overview fetch failed:", e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredTeams = useMemo(() => {
    if (!data) return [];
    const f = filter.trim().toLowerCase();
    let arr = data.teams;
    if (f) {
      arr = arr.filter((t) =>
        [t.teamName, t.participants || ""].join(" ").toLowerCase().includes(f)
      );
    }
    arr = [...arr].sort((a, b) => {
      const A = (a[sortKey] ?? "") as any;
      const B = (b[sortKey] ?? "") as any;
      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, filter, sortKey, sortDir]);

  function toggleExpand(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }

  function fmtSecs(secs?: number | null) {
    if (secs == null) return "—";
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${String(r).padStart(2, "0")}s`;
  }

  return (
    <main className="min-h-screen p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetch("/api/admin/login", { method: "DELETE" }).then(
              () => (window.location.href = "/")
            );
          }}
        >
          <button className="rounded-md border border-white/10 bg-neutral-900 px-3 py-1.5">
            Logga ut
          </button>
        </form>
      </div>

      {/* Filter & sort */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-56">
            <label className="text-xs opacity-70">Filtrera</label>
            <input
              className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
              placeholder="Sök på gruppnamn eller deltagare…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs opacity-70">Sortera på</label>
            <select
              className="w-40 rounded-md border border-white/10 bg-neutral-900 p-2"
              value={sortKey as string}
              onChange={(e) => setSortKey(e.target.value as keyof TeamRow)}
            >
              <option value="createdAt">Skapad</option>
              <option value="startedAt">Starttid</option>
              <option value="completedAt">Sluttid</option>
              <option value="teamName">Gruppnamn</option>
              <option value="wrongGuesses">Felgissningar</option>
              <option value="step">Steg</option>
              <option value="timeLeftAtFinishSec">Tid kvar när klar</option>
            </select>
          </div>
          <div>
            <label className="text-xs opacity-70">Riktning</label>
            <select
              className="w-32 rounded-md border border-white/10 bg-neutral-900 p-2"
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
            >
              <option value="desc">Fallande</option>
              <option value="asc">Stigande</option>
            </select>
          </div>
          <button
            onClick={load}
            className="ml-auto rounded-md border border-white/10 bg-neutral-900 px-3 py-1.5"
          >
            Uppdatera
          </button>
        </div>
      </section>

      {/* Teams (read-only) */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <h2 className="mb-3 text-lg font-semibold">Grupper</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-2">Grupp</th>
                <th>Spelare</th>
                <th>Deltagare</th>
                <th>Start</th>
                <th>Tid kvar när klar</th>
                <th>Steg</th>
                <th>Felgissn.</th>
                <th>Resultat</th>
              </tr>
            </thead>

            <tbody>
              {filteredTeams.map((t) => {
                const members = (t.participants || "")
                  .split(/[,\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                const playersCount = members.length || 0;

                const result = t.completedAt
                  ? "Klar"
                  : t.startedAt
                  ? "Pågår/Timeout?"
                  : "Inte startad";

                return (
                  <tr key={t.id} className="border-top border-white/5">
                    <td className="py-2">
                      <button
                        className="underline decoration-dotted"
                        onClick={() => toggleExpand(t.id)}
                        title="Visa medlemmar"
                      >
                        {t.teamName}
                      </button>
                    </td>
                    <td>{playersCount}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>
                      {t.participants || "—"}
                    </td>
                    <td>
                      {t.startedAt
                        ? new Date(t.startedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      {t.completedAt
                        ? fmtSecs(t.timeLeftAtFinishSec)
                        : "—"}
                    </td>
                    <td>
                      {t.step ?? 0}/{t.totalClues ?? "?"}
                    </td>
                    <td>{t.wrongGuesses}</td>
                    <td>{result}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanders med deltagare */}
        <div className="mt-3 space-y-3">
          {filteredTeams
            .filter((t) => expanded[t.id])
            .map((t) => {
              const members = (t.participants || "")
                .split(/[,\n]/)
                .map((s) => s.trim())
                .filter(Boolean);
              return (
                <div key={t.id} className="rounded-lg border border-white/10 p-3">
                  <div className="text-sm font-semibold opacity-80 mb-1">
                    Medlemmar i{" "}
                    <span className="opacity-100">{t.teamName}</span>
                  </div>
                  {members.length ? (
                    <ul className="list-disc pl-5 text-sm space-y-0.5">
                      {members.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm opacity-60">
                      Inga registrerade namn.
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    </main>
  );
}
