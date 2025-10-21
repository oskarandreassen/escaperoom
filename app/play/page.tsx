// app/play/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type CurrentOk =
  | {
      ok: true;
      finished: true;
      team: { id: string; step: number; total: number };
      totalTimeSec: number;
    }
  | {
      ok: true;
      finished: false;
      team: { id: string; step: number; total: number };
      clue: { id: string; title: string; icon: string; riddle: string; type: "digit" | "code" };
      deadline: string;
      timeLeftSec: number;
    };

type CurrentResp = CurrentOk | { ok: false; error: string };

function mmss(s: number) {
  const v = Math.max(0, s);
  const m = Math.floor(v / 60)
    .toString()
    .padStart(2, "0");
  const ss = (v % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}
function humanTime(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function PlayPage() {
  const sp = useSearchParams();
  const teamId = sp.get("team");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(0);

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [riddle, setRiddle] = useState("");
  const [type, setType] = useState<"digit" | "code">("digit");

  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState<number | null>(null);

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const deadlineRef = useRef<Date | null>(null);
  const tickerRef = useRef<number | null>(null);

  async function load() {
    if (!teamId) {
      setError("Saknar teamId.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setFeedback(null);

    const res = await fetch(`/api/clue/current?teamId=${encodeURIComponent(teamId)}`, {
      cache: "no-store",
    });
    const data: CurrentResp = await res.json();

    if (!data.ok) {
      setError((data as any).error || "Kunde inte hämta ledtråd.");
      setLoading(false);
      return;
    }

    setStep(data.team.step);
    setTotal(data.team.total);

    if (data.finished) {
      setFinished(true);
      setTotalTime(data.totalTimeSec);
      // stoppa timer i UI
      deadlineRef.current = null;
      setTimeLeft(0);
      setLoading(false);
      return;
    }

    setFinished(false);
    setTitle(data.clue.title);
    setIcon(data.clue.icon);
    setRiddle(data.clue.riddle);
    setType(data.clue.type);

    const dl = new Date(data.deadline);
    deadlineRef.current = dl;
    const now = new Date();
    setTimeLeft(Math.max(0, Math.floor((dl.getTime() - now.getTime()) / 1000)));

    setAnswer("");
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Tick 1/s när det finns deadline
  useEffect(() => {
    tickerRef.current = window.setInterval(() => {
      if (!deadlineRef.current) return;
      const now = new Date();
      setTimeLeft(Math.max(0, Math.floor((deadlineRef.current.getTime() - now.getTime()) / 1000)));
    }, 1000);
    return () => {
      if (tickerRef.current) {
        clearInterval(tickerRef.current);
      }
    };
  }, []);

  async function submit() {
    if (!teamId || submitting || finished) return;
    if (!/^\d+$/.test(answer)) {
      setFeedback("Endast siffror tillåtna.");
      return;
    }
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/clue/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ teamId, answer }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.error === "cooldown") {
          setFeedback(`Vänta ${data.retryAfterSec ?? 1}s…`);
          return;
        }
        setFeedback(data?.error || "Fel vid inskick.");
        return;
      }

      if (data.result === "correct") {
        if (data.finished) {
          setFinished(true);
          setFeedback("🎉 Klart! Grymt jobbat.");
          await load(); // detta hämtar total tid och nollställer timer
        } else {
          setFeedback("✅ Rätt! Går vidare…");
          await load();
        }
      } else if (data.result === "wrong") {
        setFeedback(`❌ Fel! −${data.penaltyAppliedSec}s och ${data.cooldownSec}s cooldown.`);
        await load();
      } else if (data.result === "finished") {
        setFinished(true);
        await load();
      }
    } finally {
      setSubmitting(false);
      setAnswer("");
    }
  }

  // UI-knappar 0–9
  function tap(n: number) {
    if (finished) return;
    if (type === "digit") {
      setAnswer(String(n));
    } else {
      setAnswer((prev) => (prev + String(n)).slice(0, 8));
    }
  }

  // ===== UI =====
  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-black via-[#0b0c11] to-[#0b0c11] text-white">
      {/* Page container */}
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Header row */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <span className="rounded-xl bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-300">
              Halloween Escaperoom
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Vågar ni gå in?</h1>
          </div>

          {/* Visa timer endast när INTE finished */}
          {!finished && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-2xl font-bold tabular-nums shadow-sm">
              {mmss(timeLeft)}
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="mb-6 text-sm opacity-80">
          Ledtråd{" "}
          <span className="font-semibold">
            {Math.min(step + 1, Math.max(total, 1))}/{Math.max(total, 1)}
          </span>
        </div>

        {/* Content grid */}
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">Laddar…</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-900/20 p-6">{error}</div>
        ) : finished ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/20 p-6 shadow-lg">
            <div className="mb-2 text-2xl font-semibold">🎉 Klart! Grymt jobbat.</div>
            <div className="text-lg opacity-90">
              Klar tid: <span className="font-semibold">{humanTime(totalTime ?? 0)}</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
            {/* Riddle card */}
            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/0 p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-2xl">{icon}</span>
                <h2 className="text-xl font-semibold">{title}</h2>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-xs opacity-70">
                  {type === "digit" ? "1 siffra" : "Kod"}
                </span>
              </div>

              <div className="leading-relaxed opacity-95">
                {riddle.split("\n").map((line, i) => (
                  <p key={i} className="mb-2">
                    {line}
                  </p>
                ))}
              </div>
            </section>

            {/* Answer card */}
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
              <div className="mb-3 text-sm opacity-80">Skriv in svaret</div>

              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={answer}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setAnswer(type === "digit" ? v.slice(0, 1) : v.slice(0, 8));
                }}
                className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 p-4 text-2xl tabular-nums outline-none focus:ring-2 focus:ring-white/20"
                placeholder={type === "digit" ? "En siffra (0–9)" : "Kod (endast siffror)"}
              />

              <div className="grid grid-cols-5 gap-2 mb-4">
                {[1,2,3,4,5,6,7,8,9,0].map((n) => (
                  <button
                    key={n}
                    className="rounded-xl border border-white/10 bg-white/10 py-3 text-lg font-semibold hover:bg-white/20 active:scale-[0.98] transition"
                    onClick={() => tap(n)}
                    type="button"
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="col-span-2 rounded-xl border border-white/10 bg-white/10 py-3 text-lg font-semibold hover:bg-white/20"
                  onClick={() => setAnswer((p) => p.slice(0, -1))}
                  type="button"
                >
                  ⌫ Radera
                </button>
                <button
                  className="col-span-3 rounded-xl border border-emerald-400/40 bg-emerald-600/30 py-3 text-lg font-semibold hover:bg-emerald-600/40 disabled:opacity-60"
                  onClick={submit}
                  disabled={submitting || answer.length === 0}
                  type="button"
                >
                  ✅ Skicka
                </button>
              </div>

              {feedback ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm opacity-90">
                  {feedback}
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
