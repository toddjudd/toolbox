import { useMemo } from 'react'
import { Editor } from '../components/Editor'
import { Badge, Btn, CopyBtn, Empty, Pane, Seg } from '../components/ui'
import { usePersistent } from '../lib/store'

type Mode = 'encode' | 'decode'
type Variant = 'component' | 'uri' | 'form'

function codec(input: string, mode: Mode, variant: Variant): { ok: true; out: string } | { ok: false; error: string } {
  try {
    if (mode === 'encode') {
      if (variant === 'uri') return { ok: true, out: encodeURI(input) }
      const out = encodeURIComponent(input)
      return { ok: true, out: variant === 'form' ? out.replace(/%20/g, '+') : out }
    }
    const src = variant === 'form' ? input.replace(/\+/g, ' ') : input
    return { ok: true, out: variant === 'uri' ? decodeURI(src) : decodeURIComponent(src) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export default function UrlTool() {
  const [tab, setTab] = usePersistent<'codec' | 'parse'>('url:tab', 'codec')
  return (
    <div className="flex flex-col gap-3">
      <Seg
        value={tab}
        onChange={setTab}
        className="self-start"
        options={[
          { value: 'codec', label: 'encode / decode' },
          { value: 'parse', label: 'parse & edit' },
        ]}
      />
      {tab === 'codec' ? <Codec /> : <Parser />}
    </div>
  )
}

function Codec() {
  const [input, setInput] = usePersistent('url:input', '')
  const [mode, setMode] = usePersistent<Mode>('url:mode', 'decode')
  const [variant, setVariant] = usePersistent<Variant>('url:variant', 'component')
  const res = useMemo(() => codec(input, mode, variant), [input, mode, variant])
  const out = res.ok ? res.out : ''
  const stillEncoded = mode === 'decode' && res.ok && /%[0-9a-f]{2}/i.test(out)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Seg value={mode} onChange={setMode} options={['encode', 'decode'] as const} />
        <Seg
          value={variant}
          onChange={setVariant}
          options={[
            { value: 'component', label: 'component', title: 'encodeURIComponent: escapes everything incl. / ? & =' },
            { value: 'uri', label: 'full URI', title: 'encodeURI: keeps URL structure (: / ? & = #)' },
            { value: 'form', label: 'form (+)', title: 'application/x-www-form-urlencoded: spaces as +' },
          ]}
        />
        <div className="flex-1" />
        {stillEncoded && (
          <Btn variant="primary" onClick={() => setInput(out)} title="output still contains %XX sequences">
            decode again (double-encoded)
          </Btn>
        )}
        <Btn
          disabled={!res.ok || !out}
          onClick={() => {
            setInput(out)
            setMode(mode === 'encode' ? 'decode' : 'encode')
          }}
        >
          ⇄ swap
        </Btn>
        <Btn variant="ghost" onClick={() => setInput('')}>
          clear
        </Btn>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Pane title="input" className="work-h" actions={<span className="text-[11px] text-faint">{input.length} chars</span>}>
          <Editor value={input} onChange={setInput} wrap placeholder={mode === 'encode' ? 'text to encode…' : 'percent-encoded text to decode…'} autoFocus />
        </Pane>
        <Pane
          title={mode === 'encode' ? 'encoded' : 'decoded'}
          className="work-h"
          actions={
            <>
              {!res.ok && <Badge tone="err">✗ {res.error}</Badge>}
              <CopyBtn text={out} />
            </>
          }
        >
          <Editor value={out} readOnly wrap />
        </Pane>
      </div>
    </>
  )
}

type Row = [string, string]

function Parser() {
  const [raw, setRaw] = usePersistent('url:parse', '')
  const parsed = useMemo(() => {
    const s = raw.trim()
    if (!s) return null
    try {
      return { url: new URL(s), assumed: false }
    } catch {
      try {
        return { url: new URL('https://' + s), assumed: true }
      } catch {
        return { error: 'Not a valid URL' }
      }
    }
  }, [raw])

  const url = parsed && 'url' in parsed ? parsed.url : null
  const rows: Row[] = url ? [...url.searchParams.entries()] : []

  const edit = (fn: (u: URL) => void) => {
    if (!url) return
    const u = new URL(url.href)
    fn(u)
    setRaw(u.href)
  }
  const setRows = (next: Row[]) =>
    edit((u) => {
      u.search = new URLSearchParams(next).toString()
    })

  const fields: [string, keyof URL, string][] = [
    ['protocol', 'protocol', 'https:'],
    ['username', 'username', ''],
    ['password', 'password', ''],
    ['hostname', 'hostname', 'example.com'],
    ['port', 'port', 'default'],
    ['pathname', 'pathname', '/'],
    ['hash', 'hash', '#fragment'],
  ]

  return (
    <div className="flex flex-col gap-3">
      <Pane
        title="url"
        actions={
          <>
            {parsed && 'error' in parsed && <Badge tone="err">✗ {parsed.error}</Badge>}
            {parsed && 'assumed' in parsed && parsed.assumed && <Badge tone="warn">assumed https://</Badge>}
            <Btn variant="ghost" onClick={() => setRaw('https://api.example.com:8443/v2/orders/search?status=paid&limit=50&q=green%20keyboard&tags=a&tags=b#results')}>
              sample
            </Btn>
            <CopyBtn text={url?.href ?? ''} />
          </>
        }
      >
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={3}
          spellCheck={false}
          autoFocus
          placeholder="https://api.example.com/v1/things?limit=10&cursor=abc"
          className="block w-full resize-y bg-transparent p-3 text-[12.5px] leading-relaxed break-all text-fg outline-none placeholder:text-faint"
        />
      </Pane>

      {!url ? (
        <Pane title="parts">
          <Empty>paste a URL to break it apart. Edits below rebuild it live.</Empty>
        </Pane>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Pane title="parts" actions={<span className="text-[11px] text-faint">origin {url.origin}</span>}>
            <div className="flex flex-col gap-2 p-3">
              {fields.map(([label, key, ph]) => (
                <label key={label} className="grid grid-cols-[6rem_1fr] items-center gap-2">
                  <span className="text-[11.5px] text-dim">{label}</span>
                  <input
                    className="input"
                    value={String(url[key] ?? '')}
                    placeholder={ph}
                    onChange={(e) =>
                      edit((u) => {
                        ;(u as unknown as Record<string, string>)[key] = e.target.value
                      })
                    }
                    spellCheck={false}
                  />
                </label>
              ))}
              <div className="mt-1 border-t border-line pt-2">
                <div className="label mb-1">path segments</div>
                <div className="flex flex-wrap gap-1">
                  {url.pathname
                    .split('/')
                    .filter(Boolean)
                    .map((seg, i) => (
                      <span key={i} className="rounded border border-line-2 px-1.5 py-0.5 text-[11.5px] text-accent-soft">
                        {safeDecode(seg)}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </Pane>

          <Pane
            title={`query params · ${rows.length}`}
            actions={
              <>
                <Btn onClick={() => setRows([...rows, ['', '']])}>+ param</Btn>
                <Btn variant="ghost" disabled={!rows.length} onClick={() => setRows([...rows].sort((a, b) => a[0].localeCompare(b[0])))}>
                  sort
                </Btn>
                <CopyBtn text={JSON.stringify(Object.fromEntries(rows), null, 2)} label="as JSON" />
              </>
            }
          >
            {rows.length === 0 ? (
              <Empty>no query string. Add a param.</Empty>
            ) : (
              <div className="flex flex-col gap-1.5 p-3">
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-1.5 px-0.5 text-[10.5px] text-faint uppercase">
                  <span>key</span>
                  <span>value (decoded)</span>
                  <span />
                </div>
                {rows.map(([k, v], i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-1.5">
                    <input
                      className="input text-info"
                      value={k}
                      onChange={(e) => setRows(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))}
                      spellCheck={false}
                    />
                    <input
                      className="input"
                      value={v}
                      onChange={(e) => setRows(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))}
                      spellCheck={false}
                    />
                    <Btn variant="danger" onClick={() => setRows(rows.filter((_, j) => j !== i))} title="remove">
                      ✕
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </Pane>
        </div>
      )}
    </div>
  )
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
