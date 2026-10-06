# context/raw/ — immutable sources

Drop original material here: PRDs, meeting notes, vendor/API docs, design exports, customer emails, research, data samples.

Rules (the agent follows these; humans too):
1. **Never edit a file in here.** It is the ground truth other pages are compiled from. Changed source → add a new file (`name.v2.md`).
2. **Never summarize in chat only.** Run INGEST (skill `references/operations.md`): write `context/sources/<slug>.md` (use `ctx new source <slug>`), update every affected wiki page, append to `context/log.md`.
3. Prefer markdown. Convert web pages/PDFs to markdown first; keep images next to the file.
4. No secrets or personal data. Redact before dropping.

This README is excluded from the wiki catalog.
