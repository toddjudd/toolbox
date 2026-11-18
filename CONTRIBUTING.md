# Contributing

Thanks for taking a look. Bug reports, small fixes, and new tools are all welcome.

## Ground rules

- **Client-side only.** Nothing you paste into the toolbox may leave the browser. No network calls, analytics, or third-party scripts; the CSP in `vercel.json` (`connect-src 'self'`) enforces this, so don't loosen it.
- **Keep dependencies light.** A new runtime dependency needs a good reason; prefer a small hand-written function.
- **Open an issue first** for anything bigger than a bug fix or a single new tool, so we can agree on the shape before you write it.

## Setup

Requires Node 22+.

```sh
npm install
npm run dev
```

Before opening a PR, make sure these pass:

```sh
npm run lint
npm run build   # also type-checks
```

## Adding a tool

1. Create `src/tools/MyTool.tsx` with a default-exported component.
2. Register it in `src/tools/registry.ts`.
3. Optional: teach `src/lib/detect.ts` to recognize its input so smart paste can route to it.

Look at an existing tool (e.g. `UrlTool.tsx`) for the shared UI pieces in `src/components/ui.tsx` and state helpers in `src/lib/store.ts`.

## Style

- TypeScript, React function components, Tailwind for styling.
- Colors come from the `--accent` theme tokens; don't hard-code new colors.
- Comments explain *why*, not *what*. If code needs narrating, reshape the code.

## Pull requests

- One logical change per PR, with a short description of what and why.
- Include a screenshot or GIF for UI changes.
- By contributing, you agree your work is licensed under the project's [MIT License](LICENSE).
