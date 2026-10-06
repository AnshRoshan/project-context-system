import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import CompiledPage from "./islands/CompiledPage";
import StopHook from "./islands/StopHook";
import Terminal from "./islands/Terminal";
import Ledger from "./islands/Ledger";
import CostChart from "./islands/CostChart";
import ThemeToggle from "./islands/ThemeToggle";
import { startLiveFacts, startRevealObserver, startScrollSpy } from "./lib/motion";
import { watchSystem } from "./lib/theme";

/* --------------------------------------------------------------------------
   This page is a static document. Every word of copy lives in index.html and
   is readable with JavaScript disabled. React mounts islands into it and
   replaces only the interactive placeholders.
-------------------------------------------------------------------------- */

export type IslandName = "page" | "hook" | "cli" | "ledger" | "cost" | "copybtn" | "theme";

/* ------------------------------------------------------------ copy command */

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);

  const copy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setDone(true);
    } catch {
      setDone(false);
    }
  }, [text]);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 1400);
    return () => window.clearTimeout(t);
  }, [done]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={done ? "Copied to clipboard" : `Copy command: ${text}`}
      className="rounded-[3px] border px-2 py-1 font-mono text-[10.5px] transition-colors duration-150"
      style={{
        borderColor: done ? "var(--c-con-accent)" : "var(--c-con-line)",
        color: done ? "var(--c-con-accent)" : "var(--c-con-fg-2)",
      }}
    >
      {done ? "copied" : "copy"}
    </button>
  );
}

/* ---------------------------------------------------------------- registry */

export default function App({
  island,
  attrs,
}: {
  island: IslandName;
  attrs: Record<string, string>;
}) {
  switch (island) {
    case "page":
      return <CompiledPage />;
    case "hook":
      return <StopHook />;
    case "cli":
      return <Terminal />;
    case "ledger":
      return <Ledger />;
    case "cost":
      return <CostChart />;
    case "theme":
      return <ThemeToggle />;
    case "copybtn":
      return <CopyButton text={attrs.copy ?? ""} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ mount */

export function mountApp(): void {
  document.documentElement.classList.add("js");

  const stopReveal = startRevealObserver();
  const stopSpy = startScrollSpy();
  const stopSystem = watchSystem();
  startLiveFacts();

  const hosts = Array.from(document.querySelectorAll<HTMLElement>("[data-island]"));
  const roots: { unmount: () => void }[] = [];

  for (const host of hosts) {
    const island = host.dataset.island as IslandName;
    if (!island) continue;
    const attrs: Record<string, string> = {};
    for (const a of Array.from(host.attributes)) {
      if (a.name.startsWith("data-") && a.name !== "data-island") {
        attrs[a.name.slice(5)] = a.value;
      }
    }
    try {
      const root = createRoot(host);
      root.render(<App island={island} attrs={attrs} />);
      roots.push(root);
    } catch {
      /* the static fallback already in the host stays in place */
    }
  }

  window.addEventListener("pagehide", () => {
    stopReveal();
    stopSpy();
    stopSystem();
    for (const r of roots) {
      try {
        r.unmount();
      } catch {
        /* noop */
      }
    }
  });
}
