import { useEffect, useMemo, useRef, useState } from "react";
import { CLI_COMMANDS, type Line } from "../data/transcripts";
import { queryReducedMotion } from "../lib/motion";

const TONE: Record<string, string> = {
  dim: "text-con-fg-2",
  text: "text-con-fg",
  good: "text-con-fg",
  bad: "text-con-accent font-medium",
  signal: "text-con-fg",
  cmd: "text-con-fg",
};

export default function Terminal() {
  const [activeId, setActiveId] = useState(CLI_COMMANDS[0].id);
  const [shown, setShown] = useState(0);
  const timerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const active = useMemo(
    () => CLI_COMMANDS.find((c) => c.id === activeId) ?? CLI_COMMANDS[0],
    [activeId],
  );

  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (queryReducedMotion()) {
      setShown(active.lines.length);
      return;
    }
    setShown(0);
    timerRef.current = window.setInterval(() => {
      setShown((s) => {
        if (s >= active.lines.length) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          return s;
        }
        return s + 1;
      });
    }, 22);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [active]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [activeId]);

  const lines: Line[] = active.lines.slice(0, shown);

  return (
    <div className="console overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-con-line px-4 py-2.5">
        <span className="font-mono text-[11px] text-con-fg">~/your-project</span>
        <span className="font-mono text-[11px] text-con-fg-2">ctx {active.id}</span>
        <span
          className="ml-auto rounded-[3px] border border-con-line px-2 py-0.5 font-mono text-[10.5px]"
          style={{ color: active.exit === 0 ? "var(--c-con-fg)" : "var(--c-con-accent)" }}
        >
          exit {active.exit}
        </span>
      </div>

      <div
        className="flex flex-wrap gap-1.5 border-b border-con-line px-3 py-3"
        style={{ backgroundColor: "var(--c-con-2)" }}
        role="group"
        aria-label="ctx commands"
      >
        {CLI_COMMANDS.map((c) => {
          const on = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => setActiveId(c.id)}
              className="rounded-[3px] border px-2.5 py-1.5 font-mono text-[10.5px] transition-colors duration-150"
              style={{
                borderColor: on ? "var(--c-con-accent)" : "var(--c-con-line)",
                color: on ? "var(--c-con)" : "var(--c-con-fg-2)",
                backgroundColor: on ? "var(--c-con-accent)" : "transparent",
              }}
            >
              {c.chip}
            </button>
          );
        })}
      </div>

      <p className="border-b border-con-line px-4 py-2.5 text-[12.5px] leading-snug text-con-fg">
        {active.note}
      </p>

      <div
        ref={scrollRef}
        className="term-scroll max-h-[420px] min-h-[280px] overflow-y-auto px-4 py-4"
        aria-hidden="true"
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-[1.75] sm:text-[12px]">
          <span className="block text-con-fg">
            <span className="text-con-accent">$ </span>
            {active.cmd}
          </span>
          <span className="block">{"\u00a0"}</span>
          {lines.map((l, i) => (
            <span key={i} className={`block ${TONE[l.tone ?? "text"] ?? "text-con-fg"}`}>
              {l.t || "\u00a0"}
            </span>
          ))}
          {shown >= active.lines.length && (
            <span
              className="anim-blink mt-1 inline-block h-[12px] w-[7px]"
              style={{ backgroundColor: "var(--c-con-accent)" }}
            />
          )}
        </pre>
      </div>

      {/* full output, unstreamed, for assistive tech */}
      <div className="sr-only">
        <p>
          Command: {active.cmd}. Exit code {active.exit}. {active.note}
        </p>
        <pre>{active.lines.map((l) => l.t).join("\n")}</pre>
      </div>

      <div className="border-t border-con-line px-4 py-2.5" style={{ backgroundColor: "var(--c-con-2)" }}>
        <p className="font-mono text-[10.5px] leading-relaxed text-con-fg-2">
          read-only commands accept --json. every payload carries command and ok. CI reads ok.
        </p>
      </div>
    </div>
  );
}
