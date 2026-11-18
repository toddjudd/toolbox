# ~/toolbox

A private, 100% client-side dev toolbox / new-tab page. Dark terminal-green UI.

**Tools:** JSON · JWT · URL · Base64 · Unicode inspector · Regex · Epoch · UUID · Base/Bits

- `Ctrl K` / `/`: command palette. Paste anything (JWT, URL, epoch, JSON…) and it opens the right tool.
- `Alt 1-9`: jump to a tool, `Alt 0` home.
- Home: clock, search with bangs (`!gh !npm !mdn !so !ciu !claude`), smart paste, quick links, scratchpad.
- Theme: every color derives from one `--accent` (OKLCH relative colors). Pick it from the footer swatch or `Ctrl K` → "theme".
- State persists in `localStorage`. A strict CSP (`connect-src 'self'`) means pasted data can't be sent anywhere.

## Dev

```sh
npm install
npm run dev
npm run build   # → dist/
```

## Deploy

Vercel (Vite preset), connected to this GitHub repo: every push to `main` deploys to production at https://toolbox.tjudd.dev, and other branches get preview deploys. Headers/CSP live in `vercel.json`.

## Adding a tool

1. Create `src/tools/MyTool.tsx` (default export component).
2. Register it in `src/tools/registry.ts`.
3. Optional: teach `src/lib/detect.ts` to recognize its input for smart paste.
