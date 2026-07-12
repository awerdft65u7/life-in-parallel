import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

type Metric = { name: string; value: number; note?: string };
type TimelineItem = { period: string; milestone: string };
type OptionResult = {
  title: string;
  score: number;
  summary: string;
  fact: string;
  strengths: string[];
  tradeoffs: string[];
  metrics: Metric[];
  timeline?: TimelineItem[];
};
type CompareResult = {
  verdict: { winner: string; summary: string };
  timeline_relevant: boolean;
  options: OptionResult[];
};

export const Route = createFileRoute("/")({
  component: LifeInParallel,
});

const EXAMPLES: Array<{ domain: string; prompt: string }> = [
  { domain: "Career", prompt: "Should I pursue an MBA, start a startup, or take a software job?" },
  { domain: "Food", prompt: "For breakfast should I eat eggs, fruits, or pizza?" },
  { domain: "Technology", prompt: "Should I buy an iPhone, Samsung, or Pixel?" },
];

/** Extract three comparable options from a natural sentence. */
function extractOptions(raw: string): string[] | null {
  const q = raw.replace(/\?+\s*$/g, "").trim();
  if (!q) return null;

  // Split on commas, " or ", " vs "
  const parts = q
    .split(/\s*,\s*|\s+or\s+|\s+vs\.?\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length < 3) return null;

  // Use the last 3 fragments as candidate options
  const last3 = parts.slice(-3);

  // Clean leading verbs / question phrasing from the first candidate
  last3[0] = last3[0]
    .replace(
      /^(for\s+[\w\s]+?\s+)?(should|shall|would|could|can|do|will)\s+(i|we|you)\s+(eat|buy|get|take|start|pursue|choose|pick|do|use|try|go\s+with|invest\s+in|study|learn|watch|read|book|order)?\s*/i,
      "",
    )
    .replace(/^(a|an|the)\s+/i, "")
    .trim();

  const cleaned = last3.map((s) => s.replace(/^[-–—]\s*/, "").trim()).filter(Boolean);
  if (cleaned.length !== 3 || cleaned.some((s) => s.length === 0)) return null;
  return cleaned;
}

function LifeInParallel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [detected, setDetected] = useState<string[] | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDetected(extractOptions(question));
  }, [question]);

  const canSubmit = useMemo(
    () => !!detected && detected.length === 3 && !loading,
    [detected, loading],
  );

  async function submit() {
    const options = extractOptions(question);
    if (!options) {
      setError("Please mention three choices, e.g. 'A, B, or C'.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("http://localhost:5000/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, options }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something went wrong");
      setResult(data as CompareResult);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function loadExample(ex: (typeof EXAMPLES)[number]) {
    setQuestion(ex.prompt);
    setResult(null);
    setError(null);
  }

  return (
    <div className="lp-shell">
      <div className="lp-sky" aria-hidden>
        <div className="lp-stars lp-stars--far" />
        <div className="lp-stars lp-stars--mid" />
        <div className="lp-stars lp-stars--near" />
      </div>

      <main className="relative mx-auto max-w-6xl px-6 pt-24 pb-32 sm:pt-32">
        <header className="text-center">
          <h1 className="lp-title mx-auto">
            Life in <em>Parallel</em>
          </h1>
          <p className="lp-subtitle mx-auto mt-7 max-w-xl">
            Compare three possibilities.<br className="hidden sm:block" />
            Explore their long-term impact.<br className="hidden sm:block" />
            Make smarter decisions with AI.
          </p>
        </header>

        <section className="mt-16">
          <ChatInput
            question={question}
            setQuestion={setQuestion}
            onSubmit={submit}
            loading={loading}
            canSubmit={canSubmit}
            detected={detected}
          />

          {error && (
            <p className="mt-4 text-center text-sm text-rose-300/90">{error}</p>
          )}

          <div className="mt-14">
            <p className="text-center text-[11px] uppercase tracking-[0.28em] text-white/35">Try an example</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.domain}
                  onClick={() => loadExample(ex)}
                  className="lp-glass lp-card group rounded-2xl p-5 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="lp-chip">{ex.domain}</span>
                    <span className="text-white/25 transition-all duration-300 group-hover:text-white/70 group-hover:translate-x-1">→</span>
                  </div>
                  <p className="mt-4 text-[15px] leading-relaxed text-white/75">{ex.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div ref={resultsRef}>
          {result && <Results result={result} />}
        </div>

        <footer className="mt-28 text-center text-xs text-white/25">
          Life in Parallel · Structured AI reasoning, not fortune telling.
        </footer>
      </main>
    </div>
  );
}

function ChatInput({
  question, setQuestion, onSubmit, loading, canSubmit, detected,
}: {
  question: string;
  setQuestion: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  canSubmit: boolean;
  detected: string[] | null;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    el.addEventListener("mousemove", move);
    return () => el.removeEventListener("mousemove", move);
  }, []);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 260) + "px";
  }, [question]);

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) onSubmit();
    }
  }

  return (
    <div ref={wrapRef} className="lp-glass lp-chat relative rounded-[28px] p-5 sm:p-6">
      <div className="lp-chat__glow" aria-hidden />

      <textarea
        ref={textRef}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={onKey}
        rows={2}
        placeholder={"Compare three life choices...\nExample: Should I pursue an MBA, start a startup, or take a software job?"}
        className="lp-chat__textarea w-full resize-none bg-transparent text-[17px] sm:text-[19px] leading-relaxed text-white placeholder:text-white/30 outline-none"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-[24px] flex items-center gap-2 flex-wrap">
          {detected ? (
            detected.map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="lp-detected-chip"
              >
                <span className="opacity-50 mr-1.5">{i + 1}</span>
                {d}
              </span>
            ))
          ) : (
            <span className="text-xs text-white/35">AI will auto-detect your three choices</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-[11px] text-white/35">⏎ Enter to compare</span>
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className={`lp-cta rounded-full px-6 py-2.5 text-sm font-medium ${loading ? "lp-analyzing" : ""}`}
          >
            {loading ? "Analyzing" : "Compare"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Results({ result }: { result: CompareResult }) {
  const winnerIdx = result.options.findIndex(
    (o) => o.title.toLowerCase().trim() === result.verdict.winner.toLowerCase().trim(),
  );

  return (
    <section className="mt-20 lp-fade-in">
      <div className="lp-glass rounded-3xl p-7 sm:p-9">
        <div className="flex items-center gap-2">
          <span className="lp-chip">🎯 Verdict</span>
          <span className="text-xs text-white/40">Executive summary</span>
        </div>
        <h2 className="lp-display mt-4 text-3xl sm:text-[42px] leading-tight">
          Strongest choice:{" "}
          <span className="text-white lp-glow-soft">{result.verdict.winner}</span>
        </h2>
        <p className="mt-5 max-w-3xl text-[15px] sm:text-base text-white/70 leading-relaxed">
          {result.verdict.summary}
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {result.options.map((opt, i) => (
          <OptionCard
            key={`${opt.title}-${i}`}
            option={opt}
            isWinner={i === winnerIdx}
            showTimeline={result.timeline_relevant}
          />
        ))}
      </div>
    </section>
  );
}

function OptionCard({ option, isWinner, showTimeline }: { option: OptionResult; isWinner: boolean; showTimeline: boolean }) {
  const timeline = showTimeline ? option.timeline ?? [] : [];
  return (
    <article className={`lp-glass lp-card ${isWinner ? "lp-card--winner" : ""} rounded-3xl p-7 flex flex-col`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          {isWinner && <span className="lp-chip mb-3">✨ Recommended</span>}
          <h3 className="lp-display text-[28px] leading-tight">{option.title}</h3>
        </div>
        <div className="text-right">
          <div className="text-[40px] font-light tabular-nums text-white leading-none lp-glow-soft">
            {Math.round(option.score)}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/40">Overall</div>
        </div>
      </header>

      <p className="mt-4 text-[14.5px] text-white/70 leading-relaxed">{option.summary}</p>

      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">💡 Research Fact</div>
        <p className="mt-1.5 text-[14px] text-white/85 leading-relaxed italic">{option.fact}</p>
      </div>

      <div className="mt-6">
        <div className="text-[10px] uppercase tracking-[0.24em] text-white/45 mb-3">📈 Metrics</div>
        <ul className="space-y-3">
          {option.metrics.map((m, i) => (
            <li key={`${m.name}-${i}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13.5px] text-white/85">{m.name}</span>
                <span className="text-xs tabular-nums text-white/50">{Math.round(m.value)}</span>
              </div>
              <div className="lp-meter mt-1.5">
                <div className="lp-meter__fill" style={{ width: `${Math.max(2, Math.min(100, m.value))}%` }} />
              </div>
              {m.note && <div className="mt-1 text-[11px] text-white/40">{m.note}</div>}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-emerald-300/75 mb-2">✅ Strengths</div>
          <ul className="space-y-2">
            {option.strengths.map((s, i) => (
              <li key={i} className="text-[13.5px] text-white/80 leading-relaxed pl-4 relative">
                <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-emerald-300/80" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-rose-300/75 mb-2">⚠️ Trade-offs</div>
          <ul className="space-y-2">
            {option.tradeoffs.map((s, i) => (
              <li key={i} className="text-[13.5px] text-white/80 leading-relaxed pl-4 relative">
                <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-rose-300/80" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45 mb-3">🕰 Timeline</div>
          <ol className="relative border-l border-white/10 pl-4 space-y-3">
            {timeline.map((t, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-white/70 shadow-[0_0_10px_2px_rgba(255,255,255,0.35)]" />
                <div className="text-xs text-white/60">{t.period}</div>
                <div className="text-[13.5px] text-white/85">{t.milestone}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
