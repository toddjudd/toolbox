import { useEffect, useMemo, useRef, useState } from 'react'
import { TOOLS } from '../tools/registry'
import { detect } from '../lib/detect'
import { fuzzy } from '../lib/fuzzy'
import { navigate } from '../lib/router'
import { copy } from '../lib/format'
import { setStored, getStored } from '../lib/store'
import { uuidv4, uuidv7, ulid, nanoid } from '../lib/ids'
import { cx } from './ui'

type Item = {
  key: string
  group: string
  glyph: string
  label: string
  hint?: string
  keywords?: string
  run: () => void | Promise<void>
}

function actions(): Item[] {
  const now = Date.now()
  const c = (key: string, label: string, value: () => string, glyph = '⧉', keywords = '') => ({
    key,
    group: 'Actions',
    glyph,
    label,
    hint: value(),
    keywords,
    run: () => copy(value()),
  })
  return [
    c('a-uuid4', 'Copy new UUID v4', uuidv4, '#', 'uuid guid random v4 generate'),
    c('a-uuid7', 'Copy new UUID v7', uuidv7, '#', 'uuid v7 time sortable generate'),
    c('a-ulid', 'Copy new ULID', ulid, '#', 'ulid id'),
    c('a-nano', 'Copy new nanoid', () => nanoid(), '#', 'nanoid id short'),
    c('a-epoch', 'Copy epoch (seconds)', () => String(Math.floor(now / 1000)), '◷', 'unix timestamp now time'),
    c('a-epochms', 'Copy epoch (ms)', () => String(now), '◷', 'unix timestamp now millis'),
    c('a-iso', 'Copy ISO-8601 now', () => new Date(now).toISOString(), '◷', 'date time iso utc now'),
    {
      key: 'a-crt',
      group: 'Actions',
      glyph: '▤',
      label: 'Toggle CRT mode',
      keywords: 'crt scanlines retro theme',
      run: () => setStored('ui:crt', !getStored('ui:crt', false)),
    },
    { key: 'a-home', group: 'Actions', glyph: '~', label: 'Go home', keywords: 'home start new tab', run: () => navigate('') },
  ]
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [flash, setFlash] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const query = q.trim()
    const toolItems: Item[] = TOOLS.map((t) => ({
      key: 't-' + t.id,
      group: 'Tools',
      glyph: t.glyph,
      label: t.name,
      hint: t.desc,
      keywords: t.keywords,
      run: () => navigate(t.id),
    }))
    const acts = actions()
    if (!query) return [...toolItems, ...acts]

    const score = (i: Item) => Math.max(fuzzy(query, i.label) * 2, fuzzy(query, i.keywords ?? '') )
    const rank = (list: Item[]) =>
      list
        .map((i) => [i, score(i)] as const)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([i]) => i)

    const matchedTools = rank(toolItems)
    const matchedActs = rank(acts)
    const looksLikeData = query.length > 12 || /[^a-z0-9 \-]/i.test(query) || /^\d+$/.test(query)
    const dets = detect(q)
      .filter((d) => d.confidence !== 'low' || (looksLikeData && !matchedTools.length))
      .filter((d) => looksLikeData || d.confidence === 'high')
      .slice(0, 5)
      .map<Item>((d, i) => ({
        key: `d-${i}`,
        group: 'Paste → tool',
        glyph: TOOLS.find((t) => t.id === d.tool)?.glyph ?? '›',
        label: d.label,
        hint: d.preview,
        run: d.apply,
      }))
    return looksLikeData ? [...dets, ...matchedTools, ...matchedActs] : [...matchedTools, ...matchedActs, ...dets]
  }, [q])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const run = async (i: Item | undefined) => {
    if (!i) return
    await i.run()
    if (i.group === 'Actions' && i.hint) {
      setFlash(`copied ${i.hint}`)
      setTimeout(onClose, 450)
    } else onClose()
  }

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-line-2 bg-panel shadow-[0_0_0_1px_rgba(57,255,20,.15),0_30px_80px_-20px_rgba(0,0,0,.9),0_0_60px_-20px_rgba(57,255,20,.4)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <span className="glow text-accent">❯</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSel((s) => Math.min(s + 1, items.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSel((s) => Math.max(s - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                run(items[sel])
              } else if (e.key === 'Escape') onClose()
            }}
            placeholder="Search tools, run an action, or paste anything…"
            className="h-14 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-faint"
            spellCheck={false}
          />
          <span className="kbd">esc</span>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {items.length === 0 && <div className="px-4 py-6 text-center text-xs text-faint">nothing matches</div>}
          {items.map((it, idx) => {
            const header = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            return (
              <div key={it.key}>
                {header && <div className="label px-4 pt-2.5 pb-1 text-[10px]">{header}</div>}
                <button
                  data-idx={idx}
                  onMouseMove={() => setSel(idx)}
                  onClick={() => run(it)}
                  className={cx(
                    'flex w-full items-center gap-3 px-4 py-2 text-left',
                    idx === sel ? 'bg-accent/10 text-accent' : 'text-fg',
                  )}
                >
                  <span
                    className={cx(
                      'grid h-6 w-7 shrink-0 place-items-center rounded border text-[11px]',
                      idx === sel ? 'border-accent/60 text-accent' : 'border-line-2 text-dim',
                    )}
                  >
                    {it.glyph}
                  </span>
                  <span className="shrink-0">{it.label}</span>
                  {it.hint && <span className="min-w-0 flex-1 truncate text-right text-[11.5px] text-faint">{it.hint}</span>}
                  {idx === sel && <span className="kbd shrink-0">↵</span>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-faint">
          <span>{flash ? <span className="text-accent">✓ {flash}</span> : 'tip: paste a JWT, URL, timestamp, JSON… and hit enter'}</span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
          </span>
        </div>
      </div>
    </div>
  )
}
