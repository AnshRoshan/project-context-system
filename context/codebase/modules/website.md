---
title: Website
type: module
status: active
summary: The public site in web/. Vite plus React, built to one self-contained index.html, deployed to GitHub Pages by the pages workflow.
tags: [website, docs, deploy]
covers: ["web/**"]
confidence: verified
updated: 2026-10-09
---

# Website

> Target path in your repo: `context/codebase/modules/website.md`
>
> Create it with `ctx new module website --covers "web/**"` and paste this body,
> or copy the file directly. It exists so that `ctx coverage` does not report
> `web/**` as a blind spot and `ctx lint` stays at 0 errors and 0 warnings.

## TL;DR

- The public site lives in `web/`. It is a Vite project. React renders islands only.
- `npm run build` emits ONE file, `web/dist/index.html`. The CSS and the JS are inlined.
- The page must stay readable with JavaScript disabled. All copy is static HTML.
- Every number and transcript on the page is read from this repo. Never invent one.

## Why it is built, not static

The previous site was a hand written `web/index.html`. It is now a Vite build
because the page carries five interactive parts that share typed data. The data
lives in one module, `web/src/data/transcripts.ts`, so a CLI change is a one
file edit, not a search through markup.

The build uses `vite-plugin-singlefile`. The output has no asset URLs, so the
site works at `/project-context-system/` with no Vite `base` setting.

## Contracts

| Contract | Rule |
|---|---|
| No JavaScript | Every word of copy is in `web/index.html`. Islands replace placeholders that already hold a readable static fallback. A blank canvas is a bug. |
| Reduced motion | `prefers-reduced-motion: reduce` stops all animation. The canvas runs no animation frame loop at all in that mode. |
| Off screen | The canvas loop is gated by `IntersectionObserver` and cancelled when the graph leaves the viewport. |
| Contrast | Every text pair passes WCAG AA in both themes. Non-text marks pass 3:1. |
| Facts | Release, test count, dependency count, doctor checks and lint rules come from this repo. The page states that documented ranges are ranges. |
| No em dashes | The page follows ASD-STE100, the same rule `references/prompt-craft.md` sets for specs. |

## Layout

| Path | What lives here |
|---|---|
| `web/index.html` | the whole document: all copy, all tables, all static fallbacks |
| `web/src/index.css` | the token contract. Light and dark themes, console tokens, utilities |
| `web/src/lib/theme.ts` | theme choice, persistence, and canvas token reading |
| `web/src/lib/motion.ts` | reveal observer, scroll meter, scroll spy, live badge values |
| `web/src/data/transcripts.ts` | every CLI transcript, the graph model, the ledger, the cost bounds |
| `web/src/islands/` | the five interactive parts plus the theme control |
| `web/src/App.tsx` | the island registry and the mount function |

## Theming

Two themes, light and dark, plus a system option. The choice is stored under
the `pcs-theme` key in `localStorage`. An inline script in the document head
sets `data-theme` before the first paint, so the page never flashes the wrong
theme.

Terminals stay dark in both themes. A terminal is dark. The console tokens are
therefore separate from the page tokens, and the dark theme sinks the console
below the page so it still reads as inset.

## Gotchas

- Canvas cannot read CSS variables. `readTokens()` in `theme.ts` resolves them,
  and the graph repaints on the `pcs:theme` event. Add any new canvas colour
  there, never as a literal in the component.
- The streamed terminals are `aria-hidden`. Each one carries an unstreamed
  `sr-only` copy of the full output. Assistive tech must not receive one line
  every 22 ms.
- `vite-plugin-singlefile` inlines everything. Do not add a large image to the
  bundle. Prefer SVG in the markup, or a file in `web/public/`.

## Deploy

`.github/workflows/pages.yml` runs on a push to `main` that touches `web/**`.
It installs, builds, and uploads `web/dist`. Nothing is committed from the
build. `web/dist` and `web/node_modules` are gitignored.
