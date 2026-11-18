import { useEffect, useMemo, useRef, useState } from 'react'
import { TOOLS } from './tools/registry'
import { detect } from './lib/detect'
import { usePersistent } from './lib/store'
import { useNow } from './lib/hooks'
import { clockParts } from './lib/format'
import { Btn, Pane, cx } from './components/ui'

type Link = { label: string; url: string }

const DEFAULT_LINKS: Link[] = [
  { label: 'GitHub', url: 'https://github.com' },
  { label: 'Vercel', url: 'https://vercel.com/dashboard' },
  { label: 'MDN', url: 'https://developer.mozilla.org' },
  { label: 'localhost:3000', url: 'http://localhost:3000' },
  { label: 'localhost:5173', url: 'http://localhost:5173' },
  { label: 'Claude', url: 'https://claude.ai' },
]

const BANGS: Record<string, { name: string; url: (q: string) => string }> = {
  g: { name: 'Google', url: (q) => `https://www.google.com/search?q=${q}` },
  gh: { name: 'GitHub', url: (q) => `https://github.com/search?q=${q}&type=repositories` },
  ghc: { name: 'GitHub code', url: (q) => `https://github.com/search?q=${q}&type=code` },
  npm: { name: 'npm', url: (q) => `https://www.npmjs.com/search?q=${q}` },
  mdn: { name: 'MDN', url: (q) => `https://developer.mozilla.org/en-US/search?q=${q}` },
  so: { name: 'Stack Overflow', url: (q) => `https://stackoverflow.com/search?q=${q}` },
  ciu: { name: 'Can I Use', url: (q) => `https://caniuse.com/?search=${q}` },
  yt: { name: 'YouTube', url: (q) => `https://www.youtube.com/results?search_query=${q}` },
  w: { name: 'Wikipedia', url: (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${q}` },
  claude: { name: 'Claude', url: (q) => `https://claude.ai/new?q=${q}` },
}

function resolveSearch(raw: string): { url: string; label: string } | null {
  const q = raw.trim()
  if (!q) return null
  const m = /^!(\w+)\s+(.+)$/.exec(q) ?? /^(.+?)\s+!(\w+)$/.exec(q)
  if (m) {
    const [bang, term] = q.startsWith('!') ? [m[1], m[2]] : [m[2], m[1]]
    const b = BANGS[bang.toLowerCase()]
    if (b) return { url: b.url(encodeURIComponent(term)), label: `${b.name}: ${term}` }
  }
  if (/^https?:\/\/\S+$/i.test(q)) return { url: q, label: `open ${q}` }
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/\S*)?$/i.test(q)) return { url: `http://${q}`, label: `open http://${q}` }
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(q) && !/\s/.test(q)) return { url: `https://${q}`, label: `open https://${q}` }
  return { url: BANGS.g.url(encodeURIComponent(q)), label: `Google: ${q}` }
}

function greeting(h: number) {
  if (h < 5) return 'burning the midnight oil'
  if (h < 12) return 'good morning'
  if (h < 18) return 'good afternoon'
  return 'good evening'
}

export default function Home({ onPalette }: { onPalette: () => void }) {
  const now = useNow(1000)
  const c = clockParts(now)
  const date = new Date(now)
  const [q, setQ] = useState('')
  const target = resolveSearch(q)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      {/* hero */}
      <section className="flex flex-col items-center gap-2 text-center">
        <div className="text-xs tracking-widest text-dim uppercase">{greeting(date.getHours())}</div>
        <div className="glow font-semibold text-accent tabular-nums" style={{ fontSize: 'clamp(3rem, 10vw, 6rem)', lineHeight: 1 }}>
          {c.h}
          <span className="animate-pulse text-accent/50">:</span>
          {c.m}
          <span className="ml-2 align-top text-[0.3em] text-accent/50">{c.s}</span>
        </div>
        <div className="text-sm text-dim">
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </section>

      {/* search */}
      <form
        className="mx-auto w-full max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault()
          if (!target) return
          location.href = target.url
        }}
      >
        <div className="group flex h-12 items-center gap-3 rounded-xl border border-line-2 bg-panel px-4 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(57,255,20,.12),0_0_40px_-12px_rgba(57,255,20,.6)]">
          <span className="glow text-accent">❯</span>
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onPaste={(e) => {
              // pasting data (JWT, JSON, epoch…) into the search box jumps straight to the right tool
              const t = e.clipboardData.getData('text')
              const d = detect(t)[0]
              if (!q && d?.confidence === 'high' && d.tool !== 'url') {
                e.preventDefault()
                d.apply()
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && target) {
                e.preventDefault()
                window.open(target.url, '_blank', 'noopener')
              }
            }}
            placeholder="search google, !gh !npm !mdn !so !claude, or type a url"
            className="flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint"
            spellCheck={false}
          />
          {target && <span className="hidden max-w-[40%] truncate text-[11px] text-faint sm:block">↵ {target.label}</span>}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[11px] text-faint">
          {Object.entries(BANGS)
            .slice(1)
            .map(([k, b]) => (
              <button
                type="button"
                key={k}
                className="rounded px-1.5 py-0.5 hover:bg-panel-2 hover:text-accent"
                onClick={() => {
                  setQ(`!${k} ${q.replace(/^!\w+\s*/, '')}`)
                  searchRef.current?.focus()
                }}
                title={b.name}
              >
                !{k}
              </button>
            ))}
        </div>
      </form>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <SmartPaste />
          {/* tools grid */}
          <section>
            <div className="label mb-2 flex items-center justify-between">
              <span>tools</span>
              <button className="normal-case tracking-normal text-faint hover:text-accent" onClick={onPalette}>
                Ctrl K for everything
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {TOOLS.map((t, i) => (
                <a
                  key={t.id}
                  href={`#/${t.id}`}
                  className="group flex flex-col gap-1.5 rounded-lg border border-line bg-panel/80 p-3 transition hover:-translate-y-px hover:border-accent/60 hover:shadow-[0_0_24px_-10px_rgba(57,255,20,.7)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-8 place-items-center rounded border border-line-2 text-[11px] text-dim transition group-hover:border-accent/60 group-hover:text-accent group-hover:glow">
                      {t.glyph}
                    </span>
                    <span className="flex-1 text-[13px] text-fg group-hover:text-accent">{t.name}</span>
                    <span className="text-[10px] text-faint">alt {i + 1}</span>
                  </div>
                  <span className="text-[11px] leading-snug text-faint">{t.desc}</span>
                </a>
              ))}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <QuickLinks />
          <Scratchpad />
        </aside>
      </div>
    </div>
  )
}

function SmartPaste() {
  const [text, setText] = useState('')
  const dets = useMemo(() => detect(text).slice(0, 4), [text])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName))) return
      const t = e.clipboardData?.getData('text') ?? ''
      if (!t.trim()) return
      e.preventDefault()
      const d = detect(t)
      if (d[0]?.confidence === 'high') d[0].apply()
      else setText(t)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  return (
    <section className="rounded-xl border border-dashed border-line-2 bg-panel/60 p-3 transition focus-within:border-accent/60">
      <div className="label mb-2 flex items-center justify-between">
        <span>smart paste</span>
        <span className="normal-case tracking-normal text-faint">Ctrl V anywhere on this page</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        spellCheck={false}
        placeholder="paste a JWT, URL, JSON, timestamp, UUID, base64, 0xFF… and I'll open the right tool"
        className="w-full resize-none bg-transparent text-[12.5px] text-fg outline-none placeholder:text-faint"
      />
      {text.trim() && (
        <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
          {dets.map((d, i) => (
            <button
              key={i}
              onClick={d.apply}
              className={cx(
                'flex items-center gap-3 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-accent/10 hover:text-accent',
                i === 0 ? 'text-accent' : 'text-fg',
              )}
            >
              <span className="w-4 text-faint">{i === 0 ? '↵' : '›'}</span>
              <span className="shrink-0">{d.label}</span>
              <span className="min-w-0 flex-1 truncate text-right text-[11px] text-faint">{d.preview}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function QuickLinks() {
  const [links, setLinks] = usePersistent<Link[]>('home:links', DEFAULT_LINKS)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Link>({ label: '', url: '' })

  return (
    <Pane
      title="quick links"
      actions={
        <Btn variant="ghost" onClick={() => setEditing(!editing)}>
          {editing ? 'done' : 'edit'}
        </Btn>
      }
    >
      <div className="flex flex-col p-1.5">
        {links.map((l, i) => (
          <div key={i} className="group flex items-center gap-2">
            <a
              href={l.url}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] text-fg hover:bg-accent/10 hover:text-accent"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-line-2 text-[10px] text-dim uppercase group-hover:border-accent/50 group-hover:text-accent">
                {l.label[0]}
              </span>
              <span className="truncate">{l.label}</span>
            </a>
            {editing && (
              <>
                <button className="px-1 text-faint hover:text-fg" disabled={i === 0} onClick={() => setLinks((ls) => swap(ls, i, i - 1))}>
                  ↑
                </button>
                <button className="px-1.5 text-faint hover:text-err" onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
        {editing && (
          <form
            className="mt-2 flex flex-col gap-1.5 border-t border-line p-1.5 pt-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!draft.url.trim()) return
              const url = /^[a-z]+:\/\//i.test(draft.url) ? draft.url : `https://${draft.url}`
              setLinks((ls) => [...ls, { label: draft.label.trim() || url.replace(/^https?:\/\//, ''), url }])
              setDraft({ label: '', url: '' })
            }}
          >
            <input className="input" placeholder="label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            <input className="input" placeholder="https://…" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            <Btn type="submit" variant="primary" className="justify-center">
              + add link
            </Btn>
          </form>
        )}
      </div>
    </Pane>
  )
}

function swap<T>(arr: T[], a: number, b: number) {
  const next = [...arr]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

function Scratchpad() {
  const [text, setText] = usePersistent('home:scratch', '')
  return (
    <Pane title="scratchpad" actions={<span className="text-[10.5px] text-faint">{text.length ? `${text.length} chars · saved` : 'autosaves'}</span>}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder="notes, todo, snippets… survives tab closes"
        className="block h-56 w-full resize-y bg-transparent p-3 text-[12.5px] leading-relaxed text-fg outline-none placeholder:text-faint"
      />
    </Pane>
  )
}
