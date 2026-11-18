import { useMemo, useState } from 'react'
import { Badge, Btn, CopyBtn, KV, Pane, Seg } from '../components/ui'
import { usePersistent } from '../lib/store'
import { useNow } from '../lib/hooks'
import { fmtDuration, fmtInZone, relTime } from '../lib/format'

type Unit = 'auto' | 's' | 'ms' | 'us' | 'ns'
const UNIT_LABEL: Record<string, string> = { s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds', date: 'date string' }
const DEFAULT_ZONES = 'UTC, America/New_York, America/Chicago, America/Denver, America/Los_Angeles, Europe/London, Europe/Berlin, Asia/Tokyo'

function parse(s: string, unit: Unit): { ms: number; unit: string } | { error: string } | null {
  const t = s.trim()
  if (!t) return null
  if (t.toLowerCase() === 'now') return { ms: Date.now(), unit: 'date' }
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const digits = t.replace(/^-/, '').split('.')[0].length
    const u = unit === 'auto' ? (digits <= 11 ? 's' : digits <= 14 ? 'ms' : digits <= 17 ? 'us' : 'ns') : unit
    const n = Number(t)
    const ms = u === 's' ? n * 1000 : u === 'ms' ? n : u === 'us' ? n / 1e3 : n / 1e6
    return { ms, unit: u }
  }
  const d = Date.parse(t)
  if (!isNaN(d)) return { ms: d, unit: 'date' }
  return { error: 'Couldn’t parse that. Try 1731900000, 1731900000000, 2026-11-18T10:00:00Z, or "now"' }
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7)
}

function toLocalInput(ms: number) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 19)
}

export default function EpochTool() {
  const now = useNow(1000)
  const [input, setInput] = usePersistent('epoch:input', '')
  const [unit, setUnit] = usePersistent<Unit>('epoch:unit', 'auto')
  const [zonesRaw, setZonesRaw] = usePersistent('epoch:zones', DEFAULT_ZONES)
  const [editZones, setEditZones] = useState(false)

  const p = useMemo(() => parse(input, unit), [input, unit])
  const ok = p && 'ms' in p && !isNaN(new Date(p.ms).getTime()) ? p : null
  const ms = ok?.ms ?? now
  const d = new Date(ms)
  const zones = zonesRaw
    .split(/[,\n]/)
    .map((z) => z.trim())
    .filter(Boolean)
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ['now · seconds', String(Math.floor(now / 1000))],
          ['now · milliseconds', String(now)],
          ['now · ISO 8601', new Date(now).toISOString().replace(/\.\d+Z$/, 'Z')],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-panel px-3 py-2">
            <div className="min-w-0">
              <div className="label text-[10px]">{k}</div>
              <div className="glow truncate text-[15px] text-accent tabular-nums">{v}</div>
            </div>
            <CopyBtn text={v} />
          </div>
        ))}
      </div>

      <Pane
        title="convert"
        actions={
          <>
            {p && 'error' in p && <Badge tone="err">✗ unrecognized</Badge>}
            {ok && <Badge tone="info">read as {UNIT_LABEL[ok.unit]}</Badge>}
            <Seg value={unit} onChange={setUnit} options={['auto', 's', 'ms', 'us', 'ns'] as const} />
          </>
        }
      >
        <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <input
            className="input h-10! flex-1 text-[15px]!"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="epoch (s/ms/µs/ns), ISO date, RFC 2822, or “now”"
            spellCheck={false}
            autoFocus
          />
          <input
            type="datetime-local"
            step={1}
            className="input h-10! sm:w-60 [color-scheme:dark]"
            value={toLocalInput(ms)}
            onChange={(e) => e.target.value && setInput(String(Math.floor(new Date(e.target.value).getTime() / 1000)))}
            title="pick a local date & time"
          />
          <Btn onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>now</Btn>
          <Btn variant="ghost" onClick={() => setInput('')}>
            clear
          </Btn>
        </div>
        {p && 'error' in p && <div className="px-3 pb-3 text-[12px] text-err">{p.error}</div>}
        {!input && <div className="px-3 pb-3 text-[11.5px] text-faint">showing the current time. Type or paste a value to convert it.</div>}
      </Pane>

      <div className="grid gap-3 lg:grid-cols-2">
        <Pane title={ok ? 'result' : 'right now'} actions={<Badge tone={ms > now ? 'info' : 'dim'}>{relTime(ms, now)}</Badge>}>
          <KV k="unix seconds" v={String(Math.floor(ms / 1000))} />
          <KV k="unix millis" v={String(Math.floor(ms))} />
          <KV k="ISO 8601 (UTC)" v={d.toISOString()} />
          <KV k="RFC 2822 / HTTP" v={d.toUTCString()} />
          <KV k={`local (${localTz})`} v={`${fmtInZone(ms).text} ${fmtInZone(ms).offset}`} />
          <KV k="relative" v={relTime(ms, now)} />
          <KV
            k="calendar"
            v={`${d.toLocaleDateString(undefined, { weekday: 'long' })} · ISO week ${isoWeek(d)} · day ${Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5)}`}
            mono={false}
          />
        </Pane>

        <Pane
          title="time zones"
          actions={
            <Btn variant="ghost" onClick={() => setEditZones(!editZones)}>
              {editZones ? 'done' : 'edit'}
            </Btn>
          }
        >
          {editZones && (
            <div className="border-b border-line p-3">
              <textarea className="input text-[12px]" rows={3} value={zonesRaw} onChange={(e) => setZonesRaw(e.target.value)} spellCheck={false} />
              <div className="mt-1 text-[10.5px] text-faint">comma-separated IANA zones, e.g. Europe/Paris, Asia/Kolkata, Australia/Sydney</div>
            </div>
          )}
          {zones.map((z) => {
            try {
              const f = fmtInZone(ms, z)
              return <KV key={z} k={z} v={`${f.text}`} hint={`${f.weekday} ${f.offset}`} />
            } catch {
              return <KV key={z} k={z} v="invalid time zone" />
            }
          })}
        </Pane>
      </div>

      <DurationCalc />
    </div>
  )
}

function DurationCalc() {
  const [val, setVal] = usePersistent('epoch:dur', '86400')
  const [u, setU] = usePersistent<'s' | 'ms' | 'm' | 'h'>('epoch:durunit', 's')
  const n = Number(val)
  const ms = isNaN(n) ? NaN : n * { s: 1000, ms: 1, m: 60000, h: 3600000 }[u]
  const iso = (() => {
    if (isNaN(ms)) return ''
    let r = Math.floor(ms / 1000)
    const dd = Math.floor(r / 86400)
    r -= dd * 86400
    const hh = Math.floor(r / 3600)
    r -= hh * 3600
    const mm = Math.floor(r / 60)
    const ss = r - mm * 60
    if (!dd && !hh && !mm && !ss) return 'PT0S'
    return `P${dd ? dd + 'D' : ''}${hh || mm || ss ? 'T' : ''}${hh ? hh + 'H' : ''}${mm ? mm + 'M' : ''}${ss ? ss + 'S' : ''}`
  })()
  return (
    <Pane title="duration / TTL" actions={<Seg value={u} onChange={setU} options={['ms', 's', 'm', 'h'] as const} />}>
      <div className="grid gap-3 p-3 sm:grid-cols-[14rem_1fr] sm:items-center">
        <input className="input" value={val} onChange={(e) => setVal(e.target.value)} placeholder="3600" spellCheck={false} />
        {isNaN(ms) ? (
          <span className="text-[12px] text-err">not a number</span>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
            <span className="text-accent">{fmtDuration(ms, 5)}</span>
            <span className="text-dim">{(ms / 1000).toLocaleString()} s</span>
            <span className="text-dim">{(ms / 3600000).toLocaleString(undefined, { maximumFractionDigits: 4 })} h</span>
            <span className="text-dim">{(ms / 86400000).toLocaleString(undefined, { maximumFractionDigits: 4 })} d</span>
            <span className="text-info">{iso}</span>
          </div>
        )}
      </div>
    </Pane>
  )
}
