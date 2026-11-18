# ~/toolbox

A private, 100% client-side dev toolbox / new-tab page. Dark terminal-green UI.

Live at **https://toolbox.tjudd.dev**.

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

## Self-hosting

It's a static site: `npm run build` and serve `dist/` anywhere. `vercel.json` holds the security headers (strict CSP, no-referrer, etc.). On Vercel, import the repo with the Vite preset and they apply automatically; on other hosts, port those headers to your server config.

If you deploy your own copy, update the canonical/Open Graph URLs in `index.html` and `GITHUB_URL` in `src/App.tsx`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Adding a tool in short:

1. Create `src/tools/MyTool.tsx` (default export component).
2. Register it in `src/tools/registry.ts`.
3. Optional: teach `src/lib/detect.ts` to recognize its input for smart paste.

## License

[MIT](LICENSE)
