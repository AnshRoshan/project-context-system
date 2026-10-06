import { useTheme, type ThemeChoice } from "../lib/theme";

const OPTIONS: { id: ThemeChoice; label: string; glyph: string }[] = [
  { id: "light", label: "Light theme", glyph: "\u25D1" },
  { id: "system", label: "Match the system theme", glyph: "\u25CE" },
  { id: "dark", label: "Dark theme", glyph: "\u25D5" },
];

export default function ThemeToggle() {
  const { choice, resolved, set } = useTheme();

  return (
    <div
      className="flex items-center rounded-[4px] border border-line p-0.5"
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map((o) => {
        const on = choice === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => set(o.id)}
            aria-pressed={on}
            title={o.label}
            className="grid h-6 w-7 place-items-center rounded-[2px] font-mono text-[12px] leading-none transition-colors duration-150"
            style={{
              backgroundColor: on ? "var(--c-fg)" : "transparent",
              color: on ? "var(--c-bg)" : "var(--c-fg-3)",
            }}
          >
            <span aria-hidden="true">{o.glyph}</span>
            <span className="sr-only">{o.label}</span>
          </button>
        );
      })}
      <span className="sr-only" role="status" aria-live="polite">
        {choice === "system" ? `System theme, currently ${resolved}` : `${choice} theme`}
      </span>
    </div>
  );
}
