# HomeKeys-Liberty

## Hard Rules
- NEVER run `git add`, `git commit`, `git push`, or open PRs unless explicitly asked.
- NEVER start dev servers automatically unless explicitly asked.
- Keep final summaries brief (modified file paths + what to test). Do NOT paste full code snippets in chat.

## Browser & GUI Verification (playwright-cli)
- Use `playwright-cli` in headless mode against local dev URLs (Front: http://localhost:5173).
- Use `playwright-cli snapshot` to inspect structure and locate element refs (`e12`, `e15`) before interacting.
- When the user asks for a visual check or screenshot of a specific GUI section, locate its element ref via snapshot and run:
  `playwright-cli screenshot <ref> --filename=.playwright-cli/screenshots/<name>.png`
- For full-page captures, omit the element ref and use `--full-page`.
- Always run `playwright-cli close-all` when finished so Chromium does not stay open in memory.