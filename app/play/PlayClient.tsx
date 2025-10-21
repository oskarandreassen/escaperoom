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
  const m = Math.floor(v / 60).toString().padStart(2, "0");
  const ss = (v % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}
function humanTime(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function PlayClient() {
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

    if ("finished" in data && data.finished) {
      setFinished(true);
      setTotalTime(data.totalTimeSec);
      deadlineRef.current = null;
      setTimeLeft(0);
      setLoading(false);
      return;
    }

    const d = data as Extract<CurrentResp, { ok: true; finished: false }>;
    setFinished(false);
    setTitle(d.clue.title);
    setIcon(d.clue.icon);
    setRiddle(d.clue.riddle);
    setType(d.clue.type);

    const dl = new Date(d.deadline);
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

  useEffect(() => {
    tickerRef.current = window.setInterval(() => {
      if (!deadlineRef.current) return;
      const now = new Date();
      setTimeLeft(Math.max(0, Math.floor((deadlineRef.current.getTime() - now.getTime()) / 1000)));
    }, 1000);
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
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
          await load();
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

  function tap(n: number) {
    if (finished) return;
    if (type === "digit") setAnswer(String(n));
    else setAnswer((prev) => (prev + String(n)).slice(0, 8));
  }

  // ===== UI =====
  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(255,130,30,0.12),transparent),radial-gradient(1200px_600px_at_90%_-10%,rgba(120,60,255,0.10),transparent)] bg-[#0b0c11] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-black/30 bg-black/40 border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-300 select-none">
              Halloween Escaperoom
            </span>
            <span className="hidden sm:block text-sm opacity-70">Vågar ni gå in?</span>
          </div>
          {!finished && (
            <div
              aria-live="polite"
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xl font-bold tabular-nums shadow"
            >
              {mmss(timeLeft)}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-[6.5rem] sm:pb-10 pt-6">
        {/* Progress */}
        <div className="mb-4 text-sm opacity-80">
          Ledtråd{" "}
          <span className="font-semibold">
            {Math.min(step + 1, Math.max(total, 1))}/{Math.max(total, 1)}
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">Laddar…</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-900/25 p-6">{error}</div>
        ) : finished ? (
          <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-400/30 bg-gradient-to-b from-emerald-900/25 to-emerald-900/10 p-8 text-center shadow-2xl">
            <div className="text-5xl mb-2">🎉</div>
            <h2 className="text-2xl sm:text-3xl font-semibold mb-2">Klart! Grymt jobbat.</h2>
            <p className="text-base opacity-90 mb-6">
              Klar tid:{" "}
              <span className="text-3xl font-bold tabular-nums align-middle">{humanTime(totalTime ?? 0)}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/"
                className="inline-flex justify-center rounded-xl border border-white/10 bg-white/10 px-5 py-3 font-medium hover:bg-white/20"
              >
                ↩︎ Till startsidan
              </a>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(`Klar tid: ${humanTime(totalTime ?? 0)}`);
                }}
                className="inline-flex justify-center rounded-xl border border-emerald-400/40 bg-emerald-600/30 px-5 py-3 font-medium hover:bg-emerald-600/40"
              >
                📋 Kopiera klar tid
              </button>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1.25fr_1fr]">
            {/* Riddle card */}
            <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/0 p-6 sm:p-8 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <h2 className="text-xl sm:text-2xl font-semibold">{title}</h2>
                <span className="ml-auto rounded-full border border-white/10 px-2.5 py-0.5 text-xs opacity-75">
                  {type === "digit" ? "1 siffra" : "Kod"}
                </span>
              </div>
              <article className="space-y-2 leading-relaxed opacity-95">
                {riddle.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </article>
            </section>

            {/* Answer card */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 shadow-xl">
              <label htmlFor="answer" className="mb-2 block text-sm opacity-80">
                Skriv in svaret
              </label>
              <input
                id="answer"
                inputMode="numeric"
                pattern="[0-9]*"
                value={answer}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setAnswer(type === "digit" ? v.slice(0, 1) : v.slice(0, 8));
                }}
                className="mb-5 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-2xl tabular-nums outline-none focus:ring-2 focus:ring-white/20"
                placeholder={type === "digit" ? "En siffra (0–9)" : "Kod (endast siffror)"}
                aria-label={type === "digit" ? "En siffra 0–9" : "Kod, endast siffror"}
              />

              {/* Desktop keypad */}
              <div className="hidden sm:grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <Key key={n} onClick={() => tap(n)}>
                    {n}
                  </Key>
                ))}
                <Key onClick={() => setAnswer((p) => p.slice(0, -1))}>⌫</Key>
                <Key onClick={() => tap(0)}>0</Key>
                <Key
                  primary
                  disabled={submitting || answer.length === 0}
                  onClick={submit}
                  ariaLabel="Skicka svar"
                >
                  ✅
                </Key>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Mobile docked keypad */}
      {!finished && !loading && !error && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/50 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:hidden">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <Key key={`m${n}`} onClick={() => tap(n)}>
                  {n}
                </Key>
              ))}
              <Key onClick={() => setAnswer((p) => p.slice(0, -1))}>⌫</Key>
              <Key onClick={() => tap(0)}>0</Key>
              <Key primary disabled={submitting || answer.length === 0} onClick={submit} ariaLabel="Skicka svar">
                ✅
              </Key>
            </div>
            {feedback ? (
              <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white/90">
                {feedback}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/** Small keypad button */
function Key({
  children,
  onClick,
  disabled,
  primary,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-2xl py-3 text-xl font-semibold transition active:scale-[0.98]",
        "border border-white/10",
        primary ? "bg-emerald-600/40 hover:bg-emerald-600/50" : "bg-white/10 hover:bg-white/20",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
