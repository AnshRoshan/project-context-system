import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";
export type Resolved = "light" | "dark";

export const THEME_KEY = "pcs-theme";
export const THEME_EVENT = "pcs:theme";

/* -------------------------------------------------------------------- read */

export function getChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage blocked */
  }
  return "system";
}

export function systemPrefers(): Resolved {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolve(choice: ThemeChoice): Resolved {
  return choice === "system" ? systemPrefers() : choice;
}

export function currentTheme(): Resolved {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/* ------------------------------------------------------------------- write */

export function applyTheme(choice: ThemeChoice, animate = true): void {
  const root = document.documentElement;
  const next = resolve(choice);

  if (animate && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("theming");
    window.setTimeout(() => root.classList.remove("theming"), 260);
  }

  root.dataset.theme = next;
  root.style.colorScheme = next;

  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* storage blocked */
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", next === "dark" ? "#0a1020" : "#f2f5f8");

  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { choice, resolved: next } }));
}

/** Keep "system" live when the OS flips while the page is open. */
export function watchSystem(): () => void {
  if (!window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getChoice() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/* -------------------------------------------------------------------- hook */

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(() =>
    typeof document === "undefined" ? "system" : getChoice(),
  );
  const [resolved, setResolved] = useState<Resolved>(() =>
    typeof document === "undefined" ? "light" : currentTheme(),
  );

  useEffect(() => {
    const onTheme = () => {
      setChoice(getChoice());
      setResolved(currentTheme());
    };
    window.addEventListener(THEME_EVENT, onTheme);
    return () => window.removeEventListener(THEME_EVENT, onTheme);
  }, []);

  const set = (next: ThemeChoice) => {
    applyTheme(next);
    setChoice(next);
    setResolved(resolve(next));
  };

  return { choice, resolved, set };
}

/* ------------------------------------------------------- canvas token read */

/**
 * Canvas cannot use CSS variables, so resolved values are read from the
 * document. The console tokens are theme independent, the page tokens are not.
 */
export type Tokens = {
  con: string;
  con2: string;
  line: string;
  fg: string;
  fg2: string;
  fg3: string;
  accent: string;
  accentLine: string;
};

const NAMES: Record<keyof Tokens, string> = {
  con: "--c-con",
  con2: "--c-con-2",
  line: "--c-con-line",
  fg: "--c-con-fg",
  fg2: "--c-con-fg-2",
  fg3: "--c-con-fg-2",
  accent: "--c-con-accent",
  accentLine: "--c-con-accent-line",
};

export function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Tokens;
  for (const key of Object.keys(NAMES) as (keyof Tokens)[]) {
    out[key] = cs.getPropertyValue(NAMES[key]).trim() || "#ffffff";
  }
  return out;
}

export function useTokens(): Tokens {
  const [tokens, setTokens] = useState<Tokens>(() =>
    typeof document === "undefined"
      ? ({
          con: "#0e1726",
          con2: "#131d2f",
          line: "#27344b",
          fg: "#e9eef6",
          fg2: "#93a2b8",
          fg3: "#93a2b8",
          accent: "#ffb627",
          accentLine: "#e08700",
        } as Tokens)
      : readTokens(),
  );

  useEffect(() => {
    const update = () => setTokens(readTokens());
    update();
    window.addEventListener(THEME_EVENT, update);
    return () => window.removeEventListener(THEME_EVENT, update);
  }, []);

  return tokens;
}
