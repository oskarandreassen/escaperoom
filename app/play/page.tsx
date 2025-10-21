// app/play/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type CurrentClueOk = {
  ok: true;
  team: { id: string; step: number; total: number };
  clue: { id: string; title: string; icon: string; riddle: string };
  deadline: string;
  timeLeftSec: number;
};
type CurrentClueErr = { ok: false; error: string };
type CurrentClueResp = CurrentClueOk | CurrentClueErr;

function formatMMSS(seconds: number) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function PlayPage() {
  const sp = useSearchParams();
  const teamId = sp.get("team");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(0);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [riddle, setRiddle] = useState("");

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [finished, setFinished] = useState(false);

  const [digit, setDigit] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const deadlineRef = useRef<Date | null>(null);

  async function loadClue() {
    if (!teamId) {
      setError("Saknar teamId i URL:en.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setFeedback(null);

    const res = await fetch(`/api/clue/current?teamId=${encodeURIComponent(teamId)}`, {
      method: "GET",
      cache: "no-store",
    });
    const data: CurrentClueResp = await res.json();
    if (!data.ok) {
      setError(data.error || "Kunde inte hämta ledtråd.");
      setLoading(false);
      return;
    }

    setStep(data.team.step);
    setTotal(data.team.total);
    setTitle(data.clue.title);
    setIcon(data.clue.icon);
    setRiddle(data.clue.riddle);

    const deadline = new Date(data.deadline);
    deadlineRef.current = deadline;

    const now = new Date();
    const diff = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
    setTimeLeft(diff);
    setLoading(false);
    setDigit("");
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (cancel) return;
      await loadClue();
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Tick 1/s
  useEffect(() => {
    const t = setInterval(() => {
      if (!deadlineRef.current) return;
      const now = new Date();
      const diff = Math.max(0, Math.floor((deadlineRef.current.getTime() - now.getTime()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  async function submitDigit(d: number) {
    if (!teamId || submitting) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/clue/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ teamId, digit: d }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.error === "cooldown") {
          setFeedback(`Vänta ${data.retryAfterSec ?? 1}s innan nästa försök…`);
          return;
        }
        setFeedback(data?.error || "Fel vid inskick.");
        return;
      }

      if (data.result === "correct") {
        if (data.finished) {
          setFinished(true);
          setFeedback("🎉 Klart! Alla ledtrådar lösta.");
        } else {
          setFeedback("✅ Rätt! Går vidare…");
          // Ladda nästa ledtråd
          await loadClue();
        }
      } else if (data.result === "wrong") {
        setFeedback(`❌ Fel! −${data.penaltyAppliedSec}s och ${data.cooldownSec}s cooldown.`);
        // Hämta ny deadline/tid från servern via current
        await loadClue();
      } else {
        setFeedback("Okänt svar från servern.");
      }
    } finally {
      setSubmitting(false);
      setDigit("");
    }
  }

  const handleKey = (n: number) => {
    setDigit(String(n));
    submitDigit(n);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-white">
      <div className="mb-4 text-3xl font-bold">
        Ledtråd {Math.min(step + 1, total)}/{Math.max(total, 1)}
      </div>

      <div className="mb-2 text-xl font-semibold">
        {formatMMSS(timeLeft)} <span className="opacity-70 text-base ml-1">kvar</span>
      </div>

      {loading ? (
        <div className="opacity-80">Laddar ledtråd…</div>
      ) : error ? (
        <div className="rounded-md border border-red-500/40 bg-red-900/20 p-3 text-red-200">
          {error}
        </div>
      ) : finished ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-900/20 p-4">
          🎉 Klart! Grymt jobbat.
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{icon}</span>
              <h2 className="text-2xl font-semibold">{title}</h2>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 leading-relaxed">
              {riddle.split("\n").map((line, i) => (
                <p key={i} className="mb-2">
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Snabb inmatning 0–9 */}
          <div className="grid grid-cols-5 gap-2 max-w-sm">
            {[1,2,3,4,5,6,7,8,9,0].map((n) => (
              <button
                key={n}
                className="rounded-xl border border-white/10 bg-white/10 py-3 text-lg font-semibold hover:bg-white/20 disabled:opacity-50"
                disabled={submitting}
                onClick={() => handleKey(n)}
              >
                {n}
              </button>
            ))}
          </div>

          {feedback ? (
            <div className="mt-4 text-sm opacity-90">{feedback}</div>
          ) : null}
        </>
      )}
    </main>
  );
}
