import { useEffect, useMemo, useRef, useState } from 'react'
import { Editor, markRanges } from '../components/Editor'
import { Badge, Btn, CopyBtn, Empty, Pane, Seg, cx } from '../components/ui'
import { usePersistent } from '../lib/store'
import { explain } from './regexExplain'
import type { RegexReq, RegexRes } from './regex.worker'

const FLAGS: [string, string][] = [
  ['g', 'global: find all matches'],
  ['i', 'case-insensitive'],
  ['m', 'multiline: ^ and $ match at line breaks'],
  ['s', 'dotAll: . matches newlines'],
  ['u', 'unicode'],
  ['y', 'sticky'],
]

const PRESETS: { name: string; pattern: string; flags: string }[] = [
  { name: 'email', pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+', flags: 'gi' },
  { name: 'url', pattern: 'https?:\\/\\/[^\\s/$.?#].[^\\s]*', flags: 'gi' },
  { name: 'uuid', pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', flags: 'gi' },
  { name: 'ipv4', pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b', flags: 'g' },
  { name: 'iso date', pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})(?:T(?<time>\\d{2}:\\d{2}(?::\\d{2})?))?', flags: 'g' },
  { name: 'hex color', pattern: '#(?:[0-9a-f]{3}){1,2}\\b', flags: 'gi' },
  { name: 'semver', pattern: '\\bv?(\\d+)\\.(\\d+)\\.(\\d+)(?:-([\\w.-]+))?(?:\\+([\\w.-]+))?\\b', flags: 'g' },
  { name: 'jwt', pattern: 'eyJ[\\w-]+\\.eyJ[\\w-]+\\.[\\w-]*', flags: 'g' },
  { name: 'json key', pattern: '"([^"]+)"\\s*:', flags: 'g' },
  { name: 'env var', pattern: '^(?<key>[A-Z_][A-Z0-9_]*)=(?<value>.*)$', flags: 'gm' },
]

const SAMPLE_TEXT = `Contact: ada@example.com, grace.hopper+ops@navy.mil
Release v2.14.0-beta.1 shipped 2026-11-18T09:41 from 10.0.0.12
Docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions
Request id 6f1c2b0e-9d4a-4c3e-8b7a-2f5d1e9c0a11 · theme #39ff14
API_KEY=sk_test_123
DEBUG=true`

type Saved = { name: string; pattern: string; flags: string }

let workerSeq = 0
function useRegexWorker(req: Omit<RegexReq, 'id'>) {
  const [res, setRes] = useState<RegexRes | { ok: false; error: string; timeout: true } | null>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => () => workerRef.current?.terminate(), [])

  useEffect(() => {
    if (!req.pattern) {
      setRes(null)
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const debounce = setTimeout(() => {
      if (!workerRef.current) workerRef.current = new Worker(new URL('./regex.worker.ts', import.meta.url), { type: 'module' })
      const w = workerRef.current
      const id = ++workerSeq
      timer = setTimeout(() => {
        w.terminate()
        workerRef.current = null
        setRes({ ok: false, error: 'Timed out after 1.5s: likely catastrophic backtracking. Try possessive-style rewrites or tighter classes.', timeout: true })
      }, 1500)
      w.onmessage = (e: MessageEvent<RegexRes>) => {
        if (e.data.id !== id) return
        clearTimeout(timer)
        setRes(e.data)
      }
      w.postMessage({ ...req, id } satisfies RegexReq)
    }, 90)
    return () => {
      clearTimeout(debounce)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.pattern, req.flags, req.text, req.replace])

  return res
}

export default function RegexTool() {
  const [pattern, setPattern] = usePersistent('regex:pattern', '')
  const [flags, setFlags] = usePersistent('regex:flags', 'g')
  const [text, setText] = usePersistent('regex:text', '')
  const [replace, setReplace] = usePersistent('regex:replace', '')
  const [tab, setTab] = usePersistent<'matches' | 'replace' | 'explain' | 'library'>('regex:tab', 'matches')
  const [saved, setSaved] = usePersistent<Saved[]>('regex:saved', [])

  const res = useRegexWorker({ pattern, flags, text, replace: tab === 'replace' ? replace : null })
  const ok = res?.ok ? res : null

  const marks = useMemo(
    () => (ok ? [markRanges(ok.matches.filter((m) => m.end > m.index).map((m, i) => ({ from: m.index, to: m.end, cls: i % 2 ? 'cm-m-b' : 'cm-m-a' })))] : []),
    [ok],
  )
  const tokens = useMemo(() => explain(pattern), [pattern])

  const toggleFlag = (f: string) => setFlags(flags.includes(f) ? flags.replace(f, '') : [...flags + f].sort((a, b) => 'dgimsuvy'.indexOf(a) - 'dgimsuvy'.indexOf(b)).join(''))
  const literal = `/${pattern.replace(/(?<!\\)\//g, '\\/')}/${flags}`

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cx(
          'flex flex-wrap items-center gap-2 rounded-xl border bg-panel p-2 pl-4 transition',
          res && !res.ok ? 'border-err/60' : 'border-line-2 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(57,255,20,.1)]',
        )}
      >
        <span className="text-lg text-faint">/</span>
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="your pattern here"
          spellCheck={false}
          autoFocus
          className="h-9 min-w-[12rem] flex-1 bg-transparent text-[15px] text-accent outline-none placeholder:text-faint"
        />
        <span className="text-lg text-faint">/</span>
        <div className="flex gap-0.5">
          {FLAGS.map(([f, d]) => (
            <button
              key={f}
              title={d}
              onClick={() => toggleFlag(f)}
              className={cx('h-7 w-7 rounded text-[13px] transition', flags.includes(f) ? 'bg-accent/15 text-accent glow' : 'text-faint hover:text-fg')}
            >
              {f}
            </button>
          ))}
        </div>
        <CopyBtn text={literal} label="copy /re/" />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
        {!pattern ? (
          <Badge>enter a pattern</Badge>
        ) : res && !res.ok ? (
          <Badge tone="err">✗ {res.error}</Badge>
        ) : ok ? (
          <>
            <Badge tone={ok.matches.length ? 'ok' : 'warn'}>
              {ok.matches.length}
              {ok.truncated ? '+' : ''} match{ok.matches.length === 1 ? '' : 'es'}
            </Badge>
            <span className="text-faint">{ok.ms.toFixed(1)} ms</span>
          </>
        ) : (
          <Badge>…</Badge>
        )}
        <div className="flex-1" />
        <Btn variant="ghost" onClick={() => setText(SAMPLE_TEXT)}>
          sample text
        </Btn>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Pane title="test string" className="work-h" actions={<span className="text-[11px] text-faint">{text.length} chars</span>}>
          <Editor value={text} onChange={setText} extensions={marks} placeholder="text to test against…" />
        </Pane>

        <Pane
          title={tab}
          className="work-h"
          actions={
            <Seg
              value={tab}
              onChange={setTab}
              options={[
                { value: 'matches', label: 'matches' },
                { value: 'replace', label: 'replace' },
                { value: 'explain', label: 'explain' },
                { value: 'library', label: 'library' },
              ]}
            />
          }
        >
          {tab === 'matches' &&
            (!ok || !ok.matches.length ? (
              <Empty>{pattern ? 'no matches' : 'matches & capture groups show up here'}</Empty>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th className="w-20">index</th>
                    <th>match</th>
                    <th>groups</th>
                  </tr>
                </thead>
                <tbody>
                  {ok.matches.slice(0, 1000).map((m, i) => (
                    <tr key={i}>
                      <td className="text-faint">{i}</td>
                      <td className="text-faint">
                        {m.index}–{m.end}
                      </td>
                      <td className="break-all">
                        <span className={cx('rounded px-1', i % 2 ? 'bg-info/15 text-info' : 'bg-accent/15 text-accent')}>{m.text || <i className="text-faint">empty</i>}</span>
                      </td>
                      <td className="text-[11.5px]">
                        {m.groups.map((g, gi) => {
                          const name = ok.groupNames[gi]
                          return (
                            <div key={gi} className="flex gap-2">
                              <span className="shrink-0 text-faint">{name ? `<${name}>` : `$${gi + 1}`}</span>
                              <span className="break-all text-accent-soft">{g ?? <i className="text-faint">undefined</i>}</span>
                            </div>
                          )
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {tab === 'replace' && (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b border-line p-2">
                <input
                  className="input"
                  value={replace}
                  onChange={(e) => setReplace(e.target.value)}
                  placeholder="replacement: $1, $<name>, $& (whole match)"
                  spellCheck={false}
                />
                <CopyBtn text={ok?.replaced ?? ''} />
              </div>
              <div className="min-h-0 flex-1">
                <Editor value={ok?.replaced ?? ''} readOnly />
              </div>
            </div>
          )}

          {tab === 'explain' &&
            (!tokens.length ? (
              <Empty>type a pattern to see it explained token by token</Empty>
            ) : (
              <div className="flex flex-col p-2">
                {tokens.map((tk, i) => (
                  <div key={i} className="flex items-baseline gap-3 rounded px-2 py-1 hover:bg-panel-2" style={{ paddingLeft: 8 + tk.depth * 18 }}>
                    <code
                      className={cx(
                        'shrink-0 rounded border px-1.5 text-[12px]',
                        tk.kind === 'group' && 'border-violet/40 text-violet',
                        tk.kind === 'class' && 'border-info/40 text-info',
                        tk.kind === 'quant' && 'border-warn/40 text-warn',
                        tk.kind === 'anchor' && 'border-err/40 text-err',
                        tk.kind === 'escape' && 'border-accent/40 text-accent',
                        tk.kind === 'literal' && 'border-line-2 text-fg',
                        tk.kind === 'alt' && 'border-err/40 text-err',
                        tk.kind === 'err' && 'border-err text-err',
                      )}
                    >
                      {tk.t}
                    </code>
                    <span className="text-[12px] text-dim">{tk.d}</span>
                  </div>
                ))}
              </div>
            ))}

          {tab === 'library' && (
            <div className="flex flex-col gap-4 p-3">
              <div>
                <div className="label mb-2">saved</div>
                <div className="flex flex-col gap-1">
                  {saved.map((s, i) => (
                    <div key={i} className="group flex items-center gap-2">
                      <button
                        className="flex min-w-0 flex-1 items-baseline gap-3 rounded px-2 py-1 text-left hover:bg-accent/10"
                        onClick={() => {
                          setPattern(s.pattern)
                          setFlags(s.flags)
                          setTab('matches')
                        }}
                      >
                        <span className="shrink-0 text-fg">{s.name}</span>
                        <code className="truncate text-[11px] text-faint">
                          /{s.pattern}/{s.flags}
                        </code>
                      </button>
                      <button className="px-1 text-faint opacity-0 group-hover:opacity-100 hover:text-err" onClick={() => setSaved(saved.filter((_, j) => j !== i))}>
                        ✕
                      </button>
                    </div>
                  ))}
                  <form
                    className="mt-1 flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const name = (new FormData(e.currentTarget).get('name') as string).trim()
                      if (!name || !pattern) return
                      setSaved([...saved, { name, pattern, flags }])
                      e.currentTarget.reset()
                    }}
                  >
                    <input name="name" className="input" placeholder={pattern ? 'name this pattern…' : 'enter a pattern first'} disabled={!pattern} />
                    <Btn type="submit" variant="primary" disabled={!pattern}>
                      save
                    </Btn>
                  </form>
                </div>
              </div>
              <div>
                <div className="label mb-2">presets</div>
                <div className="flex flex-col gap-1">
                  {PRESETS.map((s) => (
                    <button
                      key={s.name}
                      className="flex items-baseline gap-3 rounded px-2 py-1 text-left hover:bg-accent/10"
                      onClick={() => {
                        setPattern(s.pattern)
                        setFlags(s.flags)
                        setTab('matches')
                      }}
                    >
                      <span className="w-20 shrink-0 text-fg">{s.name}</span>
                      <code className="truncate text-[11px] text-faint">
                        /{s.pattern}/{s.flags}
                      </code>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Pane>
      </div>
    </div>
  )
}
