/* The compiled page the product actually produces, used as design material.
   Front matter fields, the TL;DR rule and the covers glob are the real page
   format from references/page-format.md and SKILL.md. */

export type FmField = { key: string; value: string; hot?: boolean };

export type PagePhase = {
  id: number;
  chip: string;
  command?: string;
  /** front matter deltas applied in this phase */
  fm: Record<string, string>;
  /** index of the TL;DR line to surface, or -1 */
  tldr: number;
  /** extra terminal lines revealed in this phase */
  out: string[];
  state: "verified" | "stale" | "fixed";
  note: string;
};

export const PAGE = {
  path: "context/codebase/modules/auth.md",
  fm: [
    { key: "title", value: "Authentication" },
    { key: "type", value: "module" },
    { key: "status", value: "active" },
    { key: "covers", value: "src/auth/**" },
    { key: "confidence", value: "verified" },
    { key: "updated", value: "2026-10-02" },
  ] as FmField[],
  tldr: [
    "Session tokens are httpOnly cookies with a 15 minute lifetime.",
    "The refresh token rotates on every use. The old one is void at once.",
    "Never log a token payload. Lint catches token-shaped strings.",
  ],
  body: [
    { h: "Contract", p: "POST /auth/login returns 200 and two cookies. It returns 429 after 5 attempts in 60 seconds." },
    { h: "Invariant", p: "A revoked session voids its refresh token in the same request. There is no grace window." },
    { h: "Gotcha", p: "The cookie domain is the apex host. A subdomain cannot read it, and that is deliberate." },
  ],
  linked: [
    "context/decisions.md D-04",
    "context/api-contracts.md",
    ".claude/rules/testing.md",
  ],
};

export const PHASES: PagePhase[] = [
  {
    id: 1,
    chip: "read",
    tldr: 0,
    fm: {},
    state: "verified",
    note: "A fresh session reads the page. It costs about 820 tokens, and it does not scan the repository.",
    out: [],
  },
  {
    id: 2,
    chip: "commit",
    command: "git commit -m \"rotate the refresh token on use\"",
    tldr: 0,
    fm: {},
    state: "verified",
    note: "The agent changes src/auth/session.ts. The page still says nothing about rotation.",
    out: [" M src/auth/session.ts", " A src/auth/rotate.ts"],
  },
  {
    id: 3,
    chip: "stale",
    command: "node context/ctx.mjs stale",
    tldr: 0,
    fm: { updated: "2026-10-02 (stale)" },
    state: "stale",
    note: "Git knows the page predates the commit. The covers glob src/auth/** now matches changed code.",
    out: [
      "context/codebase/modules/auth.md",
      "  2 files: src/auth/session.ts, src/auth/rotate.ts",
      "  page last touched 8ae5d7d, code moved past it",
    ],
  },
  {
    id: 4,
    chip: "impact",
    command: "node context/ctx.mjs impact",
    tldr: 1,
    fm: { updated: "2026-10-06" },
    state: "fixed",
    note: "The covering page is edited in the same change. The TL;DR gains the invariant the code now has.",
    out: [
      "pages that must be updated:",
      "  x context/codebase/modules/auth.md   covers src/auth/**",
      "uncovered files (BLIND SPOT):",
      "  ! src/auth/rotate.ts",
    ],
  },
  {
    id: 5,
    chip: "stamp",
    command: "node context/ctx.mjs stamp",
    tldr: 1,
    fm: { confidence: "verified", updated: "2026-10-06" },
    state: "verified",
    note: "Stamped against HEAD. The page is true again, and the next session inherits the fact for free.",
    out: ["stamped 1 page(s): updated 2026-10-06, verified_at 8ae5d7d"],
  },
];
