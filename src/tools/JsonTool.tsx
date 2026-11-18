import { useMemo, useState } from 'react'
import { Editor, markLine } from '../components/Editor'
import { Badge, Btn, CopyBtn, Empty, Pane, Seg, Toggle } from '../components/ui'
import { usePersistent } from '../lib/store'
import { enc, fmtBytes } from '../lib/format'

type Indent = '2' | '4' | 'tab' | 'min'
type Parsed = { kind: 'empty' } | { kind: 'ok'; value: unknown } | { kind: 'err'; message: string; line?: number; col?: number }

const SAMPLE = `{"id":"ord_8f2k1","status":"paid","amount":{"value":4999,"currency":"USD"},"customer":{"id":"cus_219","email":"dev@example.com","tags":["beta","vip"]},"items":[{"sku":"KB-01","qty":1,"price":4999,"meta":{"color":"green","switches":"tactile"}}],"metadata":null,"created_at":"2026-11-18T09:41:00Z","livemode":false}`

function parseJson(src: string): Parsed {
  if (!src.trim()) return { kind: 'empty' }
  try {
    return { kind: 'ok', value: JSON.parse(src) }
  } catch (e) {
    const message = (e as Error).message
    const lc = /line (\d+) column (\d+)/.exec(message)
    if (lc) return { kind: 'err', message, line: +lc[1], col: +lc[2] }
    const pos = /position (\d+)/.exec(message)
    if (pos) {
      const before = src.slice(0, +pos[1])
      return { kind: 'err', message, line: before.split('\n').length, col: +pos[1] - before.lastIndexOf('\n') }
    }
    if (/end of (JSON )?input/i.test(message)) return { kind: 'err', message, line: src.split('\n').length }
    return { kind: 'err', message }
  }
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep)
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]),
    )
  return v
}

function stats(v: unknown) {
  let nodes = 0
  let depth = 0
  const walk = (x: unknown, d: number) => {
    nodes++
    depth = Math.max(depth, d)
    if (x && typeof x === 'object') for (const c of Object.values(x)) walk(c, d + 1)
  }
  walk(v, 0)
  return { nodes, depth }
}

const childPath = (p: string, k: string | number) =>
  typeof k === 'number' ? `${p}[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `${p}.${k}` : `${p}[${JSON.stringify(k)}]`

export default function JsonTool() {
  const [input, setInput] = usePersistent('json:input', '')
  const [indent, setIndent] = usePersistent<Indent>('json:indent', '2')
  const [view, setView] = usePersistent<'text' | 'tree'>('json:view', 'text')
  const [sort, setSort] = usePersistent('json:sort', false)
  const [path, setPath] = useState('$')
  const [treeDepth, setTreeDepth] = useState({ d: 2, n: 0 })

  const parsed = useMemo(() => parseJson(input), [input])
  const value = useMemo(() => (parsed.kind === 'ok' ? (sort ? sortDeep(parsed.value) : parsed.value) : undefined), [parsed, sort])
  const output = useMemo(
    () => (parsed.kind === 'ok' ? JSON.stringify(value, null, indent === 'min' ? undefined : indent === 'tab' ? '\t' : Number(indent)) : ''),
    [parsed, value, indent],
  )
  const st = useMemo(() => (parsed.kind === 'ok' ? stats(parsed.value) : null), [parsed])
  const errExt = useMemo(() => (parsed.kind === 'err' && parsed.line ? [markLine(parsed.line, 'cm-err-line')] : []), [parsed])
  const nested = parsed.kind === 'ok' && typeof parsed.value === 'string' && /^\s*[[{]/.test(parsed.value) ? parsed.value : null

  const status =
    parsed.kind === 'ok' ? (
      <Badge tone="ok">✓ valid</Badge>
    ) : parsed.kind === 'err' ? (
      <Badge tone="err">✗ {parsed.line ? `line ${parsed.line}${parsed.col ? `:${parsed.col}` : ''}` : 'invalid'}</Badge>
    ) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Seg
          value={indent}
          onChange={setIndent}
          options={[
            { value: '2', label: '2 sp' },
            { value: '4', label: '4 sp' },
            { value: 'tab', label: 'tab' },
            { value: 'min', label: 'minify' },
          ]}
        />
        <Seg value={view} onChange={setView} options={['text', 'tree'] as const} />
        <Toggle checked={sort} onChange={setSort} label="sort keys" />
        <div className="flex-1" />
        {nested && (
          <Btn variant="primary" onClick={() => setInput(nested)}>
            unwrap nested JSON string
          </Btn>
        )}
        <Btn disabled={parsed.kind !== 'ok'} onClick={() => setInput(output)} title="replace input with formatted output">
          apply to input
        </Btn>
        <Btn
          disabled={!input.trim()}
          onClick={() => setInput(JSON.stringify(parsed.kind === 'ok' ? JSON.stringify(parsed.value) : input))}
          title="wrap as an escaped JSON string literal"
        >
          escape as string
        </Btn>
        <Btn variant="ghost" onClick={() => setInput(SAMPLE)}>
          sample
        </Btn>
        <Btn variant="ghost" onClick={() => setInput('')}>
          clear
        </Btn>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title="input"
          className="work-h"
          actions={status}
          footer={
            parsed.kind === 'err' ? (
              <span className="text-err">{parsed.message}</span>
            ) : st ? (
              <span className="text-faint">
                {Array.isArray(parsed.kind === 'ok' && parsed.value) ? 'array' : typeof (parsed.kind === 'ok' && parsed.value)} · {st.nodes} nodes · depth {st.depth} ·{' '}
                {fmtBytes(enc.encode(input).length)}
              </span>
            ) : undefined
          }
        >
          <Editor value={input} onChange={setInput} lang="json" placeholder="Paste JSON…" extensions={errExt} autoFocus />
        </Pane>

        <Pane
          title={view === 'tree' ? 'tree' : 'output'}
          className="work-h"
          actions={
            <>
              {view === 'tree' && (
                <>
                  <Btn variant="ghost" onClick={() => setTreeDepth((t) => ({ d: 99, n: t.n + 1 }))}>
                    expand
                  </Btn>
                  <Btn variant="ghost" onClick={() => setTreeDepth((t) => ({ d: 1, n: t.n + 1 }))}>
                    collapse
                  </Btn>
                </>
              )}
              {output && <span className="text-[11px] text-faint">{fmtBytes(enc.encode(output).length)}</span>}
              <CopyBtn text={output} />
            </>
          }
          footer={
            view === 'tree' && value !== undefined ? (
              <div className="flex items-center gap-2">
                <span className="text-faint">path</span>
                <code className="min-w-0 flex-1 truncate text-info">{path}</code>
                <CopyBtn text={path} />
              </div>
            ) : undefined
          }
        >
          {parsed.kind !== 'ok' ? (
            <Empty>{parsed.kind === 'err' ? 'fix the error on the left' : 'formatted output shows up here'}</Empty>
          ) : view === 'text' ? (
            <Editor value={output} readOnly lang="json" />
          ) : (
            <div className="p-3 text-[12.5px]" key={treeDepth.n}>
              <TreeNode v={value} path="$" depth={0} openDepth={treeDepth.d} onPick={setPath} last />
            </div>
          )}
        </Pane>
      </div>
    </div>
  )
}

const LIMIT = 300

function Prim({ v }: { v: unknown }) {
  if (typeof v === 'string') return <span className="break-all text-accent-soft">{JSON.stringify(v)}</span>
  if (typeof v === 'number') return <span className="text-warn">{v}</span>
  if (typeof v === 'boolean') return <span className="text-violet">{String(v)}</span>
  return <span className="text-violet">null</span>
}

function TreeNode({
  k,
  v,
  path,
  depth,
  openDepth,
  onPick,
  last,
}: {
  k?: string | number
  v: unknown
  path: string
  depth: number
  openDepth: number
  onPick: (p: string) => void
  last: boolean
}) {
  const isObj = v !== null && typeof v === 'object'
  const isArr = Array.isArray(v)
  const [open, setOpen] = useState(depth < openDepth)
  const [limit, setLimit] = useState(LIMIT)
  const comma = last ? '' : <span className="text-faint">,</span>
  const pad = { paddingLeft: depth * 16 }
  const keyEl =
    k === undefined ? null : (
      <>
        <button className={typeof k === 'number' ? 'text-faint hover:text-info' : 'text-info hover:underline'} onClick={() => onPick(path)}>
          {typeof k === 'number' ? k : JSON.stringify(k)}
        </button>
        <span className="text-faint">: </span>
      </>
    )

  if (!isObj)
    return (
      <div style={pad} className="flex leading-6">
        <span className="w-4 shrink-0" />
        <span className="min-w-0" onClick={() => onPick(path)}>
          {keyEl}
          <Prim v={v} />
          {comma}
        </span>
      </div>
    )

  const entries: [string | number, unknown][] = isArr ? (v as unknown[]).map((x, i) => [i, x]) : Object.entries(v as Record<string, unknown>)
  const [o, c] = isArr ? ['[', ']'] : ['{', '}']
  return (
    <div>
      <div style={pad} className="flex leading-6">
        <button className="w-4 shrink-0 text-left text-faint hover:text-accent" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'}
        </button>
        <span>
          {keyEl}
          <span className="text-dim">{o}</span>
          {!open && (
            <>
              <button className="mx-1 rounded bg-panel-2 px-1.5 text-[11px] text-faint hover:text-accent" onClick={() => setOpen(true)}>
                {entries.length} {isArr ? 'items' : 'keys'}
              </button>
              <span className="text-dim">{c}</span>
              {comma}
            </>
          )}
        </span>
      </div>
      {open && (
        <>
          {entries.slice(0, limit).map(([ck, cv], i) => (
            <TreeNode
              key={ck}
              k={ck}
              v={cv}
              path={childPath(path, ck)}
              depth={depth + 1}
              openDepth={openDepth}
              onPick={onPick}
              last={i === entries.length - 1}
            />
          ))}
          {entries.length > limit && (
            <button style={{ paddingLeft: (depth + 1) * 16 + 16 }} className="leading-6 text-faint hover:text-accent" onClick={() => setLimit((l) => l + LIMIT)}>
              … {entries.length - limit} more
            </button>
          )}
          <div style={{ paddingLeft: depth * 16 + 16 }} className="leading-6 text-dim">
            {c}
            {comma}
          </div>
        </>
      )}
    </div>
  )
}
