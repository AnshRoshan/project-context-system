# web/ — the project-context-system site

The public site for
[project-context-system](https://github.com/AnshRoshan/project-context-system).
Vite plus React. The build emits one self-contained `index.html`.

Live: <https://anshroshan.github.io/project-context-system/>

> Setting this up for the first time? Read `INTEGRATION.md` in this folder
> before you copy anything, then delete it. It explains where the three files
> in `_repo-files/` belong.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/index.html, one file
npm run preview  # serve the built file
```

## Rules this site keeps

1. **It reads with JavaScript disabled.** Every word of copy is static HTML in
   `index.html`. React mounts islands into placeholders that already hold a
   readable fallback. A blank canvas is a bug.
2. **It respects `prefers-reduced-motion`.** All animation stops. The canvas
   runs no animation frame loop at all in that mode.
3. **It pauses off-screen.** The canvas loop is gated by `IntersectionObserver`.
4. **One accent.** Phosphor amber, and it means one thing: attention. Stale
   page, blocked hook, lint error, blind spot, active control. Never a second
   chromatic accent.
5. **Every number is real.** Release, test count, dependency count, doctor
   checks and lint rules are read from the repository. Documented ranges are
   labelled as ranges, not as measurements.
6. **ASD-STE100 copy.** Short sentences. One word, one meaning. Exact numbers.
   No em dashes. The same rule `references/prompt-craft.md` sets for specs.

## Where to change things

| You want to change | Edit |
|---|---|
| any copy on the page | `index.html` |
| a CLI transcript, the graph, the ledger | `src/data/transcripts.ts` |
| colours, type, spacing, themes | `src/index.css` |
| theme switching or canvas colours | `src/lib/theme.ts` |
| reveal, scroll meter, scroll spy, badges | `src/lib/motion.ts` |
| an interaction | `src/islands/` |

## Themes

Light and dark, plus a system option, in the header control. The choice is
stored under `pcs-theme` in `localStorage`. An inline script in `<head>` sets
`data-theme` before the first paint, so there is no flash.

Terminals stay dark in both themes, because a terminal is dark. The console
tokens (`--c-con*`) are separate from the page tokens for that reason.

## Deploy

`.github/workflows/pages.yml` at the repo root runs on a push to `main` that
touches `web/**`. It installs, runs `npm run build`, and uploads `web/dist`.

`vite-plugin-singlefile` inlines the CSS and the JS, so no asset URLs are
emitted and no Vite `base` is needed for the `/project-context-system/`
subpath. If you remove that plugin, set
`base: "/project-context-system/"` in `vite.config.ts`.
