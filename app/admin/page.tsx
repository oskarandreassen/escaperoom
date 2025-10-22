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
  finalCode?: string | null;
  wrongGuesses: number; // aggregerat
};

type ClueRow = {
  id: string;
  title: string;
  icon?: string | null;
  riddle: string;
  type: "digit" | "code";
  expectedDigit?: number | null;
  expectedCode?: string | null;
  durationSec?: number | null;
  active: boolean;
  orderIdx: number;
};

type OverviewResp = {
  ok: true;
  teams: TeamRow[];
  clues: ClueRow[];
};

export default function AdminPage() {
  const [data, setData] = useState<OverviewResp | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof TeamRow>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    const json = await res.json();
    if (json?.ok) setData(json);
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
      const A = a[sortKey] ?? "";
      const B = b[sortKey] ?? "";
      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, filter, sortKey, sortDir]);

  function toggleExpand(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }

  async function createTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const teamName = String(fd.get("teamName") || "");
    const participants = String(fd.get("participants") || "");
    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamName, participants }),
    });
    if (res.ok) {
      e.currentTarget.reset();
      load();
    } else {
      alert("Kunde inte skapa lag.");
    }
  }

  async function deleteTeam(id: string) {
    if (!confirm("Ta bort det här laget?")) return;
    const res = await fetch(`/api/admin/teams?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function upsertClue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    // normalisera
    (body as any).durationSec = Number(body.durationSec || 300);
    (body as any).orderIdx = Number(body.orderIdx || 0);
    (body as any).active = (body.active as string) === "on";
    // välj metod
    const method = body.id ? "PATCH" : "POST";
    const res = await fetch("/api/admin/clues", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      (e.currentTarget as HTMLFormElement).reset();
      load();
    } else {
      alert("Kunde inte spara gåtan.");
    }
  }

  async function deleteClue(id: string) {
    if (!confirm("Ta bort denna gåta?")) return;
    const res = await fetch(`/api/admin/clues?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <main className="min-h-screen p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetch("/api/admin/login", { method: "DELETE" }).then(() => (window.location.href = "/"));
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
        </div>
      </section>

      {/* Teams */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Grupper</h2>
          <button
            onClick={load}
            className="rounded-md border border-white/10 bg-neutral-900 px-3 py-1.5"
          >
            Uppdatera
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-2">Grupp</th>
                <th>Spelare</th>
                <th>Start</th>
                <th>Slut</th>
                <th>Steg</th>
                <th>Felgissn.</th>
                <th>Resultat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((t) => {
                const playersCount =
                  (t.participants || "")
                    .split(/[,\n]/)
                    .map((s) => s.trim())
                    .filter(Boolean).length || 0;

                const result =
                  t.completedAt
                    ? "Klar"
                    : t.startedAt
                    ? "Pågår/Timeout?"
                    : "Inte startad";

                return (
                  <tr key={t.id} className="border-t border-white/5">
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
                    <td>{t.startedAt ? new Date(t.startedAt).toLocaleString() : "—"}</td>
                    <td>{t.completedAt ? new Date(t.completedAt).toLocaleString() : "—"}</td>
                    <td>
                      {t.step ?? 0}/{t.totalClues ?? "?"}
                    </td>
                    <td>{t.wrongGuesses}</td>
                    <td>{result}</td>
                    <td className="text-right">
                      <button
                        onClick={() => deleteTeam(t.id)}
                        className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-300"
                      >
                        Ta bort
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanders */}
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
                    Medlemmar i <span className="opacity-100">{t.teamName}</span>
                  </div>
                  {members.length ? (
                    <ul className="list-disc pl-5 text-sm space-y-0.5">
                      {members.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm opacity-60">Inga registrerade namn.</div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Create team */}
        <div className="mt-6 rounded-lg border border-white/10 p-4">
          <h3 className="mb-2 font-semibold">Skapa ny grupp</h3>
          <form onSubmit={createTeam} className="grid gap-2 md:grid-cols-2">
            <input
              required
              name="teamName"
              placeholder="Gruppnamn"
              className="rounded-md border border-white/10 bg-neutral-900 p-2"
            />
            <textarea
              name="participants"
              placeholder="Spelare (komma- eller rad-separerade)"
              className="rounded-md border border-white/10 bg-neutral-900 p-2 md:col-span-2"
              rows={3}
            />
            <button className="rounded-md bg-purple-600 px-4 py-2 font-semibold md:col-span-2">
              Skapa
            </button>
          </form>
        </div>
      </section>

      {/* Clues */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Gåtor</h2>
          <button
            onClick={load}
            className="rounded-md border border-white/10 bg-neutral-900 px-3 py-1.5"
          >
            Uppdatera
          </button>
        </div>

        <div className="grid gap-4">
          {data?.clues.map((c) => (
            <form key={c.id} onSubmit={upsertClue} className="rounded-lg border border-white/10 p-3">
              <input type="hidden" name="id" defaultValue={c.id} />
              <div className="grid gap-2 md:grid-cols-6">
                <div className="md:col-span-2">
                  <label className="text-xs opacity-70">Titel</label>
                  <input
                    name="title"
                    defaultValue={c.title}
                    className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Ikon</label>
                  <input
                    name="icon"
                    defaultValue={c.icon || ""}
                    className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Typ</label>
                  <select
                    name="type"
                    defaultValue={c.type}
                    className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                  >
                    <option value="digit">Siffra (0–9)</option>
                    <option value="code">Kod (flera siffror)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs opacity-70">Duration (sek)</label>
                  <input
                    name="durationSec"
                    type="number"
                    min={30}
                    step={30}
                    defaultValue={c.durationSec ?? 300}
                    className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Order</label>
                  <input
                    name="orderIdx"
                    type="number"
                    step={1}
                    defaultValue={c.orderIdx}
                    className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                  />
                </div>
                <div className="md:col-span-6">
                  <label className="text-xs opacity-70">Gåta</label>
                  <textarea
                    name="riddle"
                    defaultValue={c.riddle}
                    rows={3}
                    className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                  />
                </div>
                {c.type === "digit" ? (
                  <div>
                    <label className="text-xs opacity-70">Förväntad siffra</label>
                    <input
                      name="expectedDigit"
                      type="number"
                      min={0}
                      max={9}
                      defaultValue={c.expectedDigit ?? 0}
                      className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs opacity-70">Förväntad kod</label>
                    <input
                      name="expectedCode"
                      pattern="^[0-9]+$"
                      defaultValue={c.expectedCode || ""}
                      className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                    />
                  </div>
                )}
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="active" defaultChecked={c.active} />
                  <span>Aktiv</span>
                </label>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button className="rounded-md bg-purple-600 px-4 py-1.5 font-semibold">Spara</button>
                <button
                  type="button"
                  onClick={() => deleteClue(c.id)}
                  className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-red-300"
                >
                  Ta bort
                </button>
              </div>
            </form>
          ))}

          {/* Ny gåta */}
          <form onSubmit={upsertClue} className="rounded-lg border border-dashed border-white/20 p-3">
            <div className="mb-2 font-semibold opacity-80">Lägg till gåta</div>
            <div className="grid gap-2 md:grid-cols-6">
              <div className="md:col-span-2">
                <label className="text-xs opacity-70">Titel</label>
                <input
                  name="title"
                  required
                  className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Ikon</label>
                <input name="icon" className="w-full rounded-md border border-white/10 bg-neutral-900 p-2" />
              </div>
              <div>
                <label className="text-xs opacity-70">Typ</label>
                <select
                  name="type"
                  className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                >
                  <option value="digit">Siffra (0–9)</option>
                  <option value="code">Kod (flera siffror)</option>
                </select>
              </div>
              <div>
                <label className="text-xs opacity-70">Duration (sek)</label>
                <input
                  name="durationSec"
                  type="number"
                  min={30}
                  step={30}
                  defaultValue={300}
                  className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Order</label>
                <input
                  name="orderIdx"
                  type="number"
                  step={1}
                  defaultValue={0}
                  className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                />
              </div>
              <div className="md:col-span-6">
                <label className="text-xs opacity-70">Gåta</label>
                <textarea
                  name="riddle"
                  required
                  rows={3}
                  className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                />
              </div>
              {/* Både digit/code visas; backend ignorerar fel fält */}
              <div>
                <label className="text-xs opacity-70">Förväntad siffra</label>
                <input
                  name="expectedDigit"
                  type="number"
                  min={0}
                  max={9}
                  className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Förväntad kod</label>
                <input
                  name="expectedCode"
                  pattern="^[0-9]+$"
                  className="w-full rounded-md border border-white/10 bg-neutral-900 p-2"
                />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="active" defaultChecked />
                <span>Aktiv</span>
              </label>
            </div>
            <div className="mt-3">
              <button className="rounded-md bg-purple-600 px-4 py-1.5 font-semibold">Lägg till</button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
