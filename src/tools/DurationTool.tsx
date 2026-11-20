import { useMemo } from 'react'
import { Badge, Btn, CopyBtn, KV, Pane, Seg, cx } from '../components/ui'
import { usePersistent } from '../lib/store'
import { useNow } from '../lib/hooks'
import { fmtInZone, relTime } from '../lib/format'
import {
  DAY,
  HOUR,
  LIMITS,
  MIN,
  MONTH,
  MS,
  NUM_UNITS,
  SEC,
  US,
  WEEK,
  YEAR,
  fmtClock,
  fmtGo,
  fmtIso,
  fmtLong,
  fmtNum,
  fmtShort,
  fmtTimeSpan,
  guessUnits,
  headline,
  parseDuration,
  type NumUnit,
} from '../lib/duration'

type UnitSel = NumUnit | 'auto'

const EXAMPLES = ['600000', '3600', '86400000', '1e9', '1h30m', '1d 2h 3m', 'PT2H45M', '90 minutes', '01:30:00', '2147483647 ms']

const KIND_LABEL = { units: 'units', iso: 'ISO 8601', clock: 'clock (h:mm:ss)' }

const EVERY_UNIT: [string, number][] = [
  ['nanoseconds', 1],
  ['microseconds', US],
  ['milliseconds', MS],
  ['seconds', SEC],
  ['minutes', MIN],
  ['hours', HOUR],
  ['days', DAY],
  ['weeks', WEEK],
  ['months (30d)', MONTH],
  ['years (365d)', YEAR],
]

const MAX_DATE_MS = 8.64e15

export default function DurationTool() {
  const [input, setInput] = usePersistent('duration:input', '600000')
  const [unit, setUnit] = usePersistent<UnitSel>('duration:unit', 'auto')
  const p = useMemo(() => parseDuration(input, unit), [input, unit])
  const ok = p && 'ns' in p && Number.isFinite(p.ns) ? p : null
  const ns = ok?.ns ?? 0

  return (
    <div className="flex flex-col gap-3">
      <Pane
        title="duration"
        actions={
          <>
            {p && 'error' in p && <Badge tone="err">✗ unrecognized</Badge>}
            {ok?.kind === 'number' && (
              <Badge tone="info" title={ok.guessed ? 'best guess; pick a unit to override' : undefined}>
                {ok.guessed ? 'guessed' : 'read as'} {NUM_UNITS.find((u) => u.id === ok.unit)!.long}
              </Badge>
            )}
            {ok && ok.kind !== 'number' && <Badge tone="info">read as {KIND_LABEL[ok.kind]}</Badge>}
          </>
        }
      >
        <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <input
            className="input h-10! flex-1 text-[15px]!"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="600000, 3600, 1h30m, 1d 2h 3m, PT2H, 90 minutes, 01:30:00…"
            spellCheck={false}
            autoFocus
          />
          <Seg
            className="self-start sm:self-auto"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'auto', label: 'auto', title: 'guess the unit of a bare number' },
              ...NUM_UNITS.map((u) => ({ value: u.id, label: u.label, title: `bare numbers are ${u.long}` })),
            ]}
          />
          <Btn variant="ghost" onClick={() => setInput('')}>
            clear
          </Btn>
        </div>
        {p && 'error' in p && <div className="px-3 pb-2 text-[12px] text-err">{p.error}</div>}
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 text-[11px] text-faint">
          <span>try</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} className="rounded border border-line px-1.5 py-0.5 hover:border-accent/50 hover:text-accent" onClick={() => setInput(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </Pane>

      {ok && <Hero ns={ns} />}

      {ok && (
        <div className="grid gap-3 lg:grid-cols-2">
          {ok.kind === 'number' ? (
            <Interpretations value={ok.value} unit={ok.unit} guessed={ok.guessed} onPick={setUnit} />
          ) : (
            <Formats ns={ns} />
          )}
          <FromNow ns={ns} />
          {ok.kind === 'number' && <Formats ns={ns} />}
          <EveryUnit ns={ns} />
        </div>
      )}

      {ok && <Limits ns={ns} />}
    </div>
  )
}

function Hero({ ns }: { ns: number }) {
  const h = headline(ns)
  const short = fmtShort(ns)
  const long = fmtLong(ns)
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line-2 bg-panel px-4 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="glow text-[clamp(1.6rem,4vw,2.4rem)] leading-tight font-semibold text-accent tabular-nums">{h.text}</div>
        <div className="mt-1 text-[13px] text-dim">{long}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[15px] text-accent-soft tabular-nums">{short}</span>
        <CopyBtn text={short} />
        <CopyBtn text={long} label="copy words" variant="ghost" />
      </div>
    </section>
  )
}

function Interpretations({ value, unit, guessed, onPick }: { value: number; unit: NumUnit; guessed: boolean; onPick: (u: UnitSel) => void }) {
  const ranked = useMemo(() => guessUnits(value), [value])
  const best = ranked[0].id
  return (
    <Pane title={`${fmtNum(value)} could mean…`} actions={<span className="text-[11px] text-faint">click a row to lock the unit</span>}>
      <table className="tbl">
        <tbody>
          {NUM_UNITS.map((u) => {
            const r = ranked.find((x) => x.id === u.id)!
            const active = u.id === unit
            return (
              <tr key={u.id} onClick={() => onPick(active && !guessed ? 'auto' : u.id)} className="cursor-pointer" title={active && !guessed ? 'back to auto' : `read as ${u.long}`}>
                <td className={cx('w-24', active ? 'text-accent' : 'text-dim')}>
                  {active ? '❯ ' : ''}
                  {u.long}
                </td>
                <td className={cx('tabular-nums', active ? 'text-accent glow' : 'text-fg')}>{fmtShort(r.value)}</td>
                <td className="text-faint">{headline(r.value).text}</td>
                <td className="w-16 text-right">{u.id === best && <Badge tone={active ? 'ok' : 'dim'}>likely</Badge>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Pane>
  )
}

function Formats({ ns }: { ns: number }) {
  return (
    <Pane title="formats">
      <KV k="short" v={fmtShort(ns)} />
      <KV k="words" v={fmtLong(ns)} mono={false} />
      <KV k="ISO 8601" v={fmtIso(ns)} />
      <KV k="Go time.Duration" v={fmtGo(ns)} />
      <KV k="clock (h:mm:ss)" v={fmtClock(ns)} />
      <KV k=".NET TimeSpan" v={fmtTimeSpan(ns)} />
    </Pane>
  )
}

function EveryUnit({ ns }: { ns: number }) {
  return (
    <Pane title="in every unit">
      {EVERY_UNIT.map(([label, per]) => {
        const v = ns / per
        return <KV key={label} k={label} v={fmtNum(v)} copyText={String(Number(v.toPrecision(15)))} />
      })}
    </Pane>
  )
}

function FromNow({ ns }: { ns: number }) {
  const now = useNow(1000)
  const delta = ns / MS
  const row = (label: string, ms: number) => {
    if (!Number.isFinite(ms) || Math.abs(ms) > MAX_DATE_MS) return <KV key={label} k={label} v="out of Date range" />
    const z = fmtInZone(ms)
    return [
      <KV key={label} k={label} v={`${z.text} ${z.offset}`} hint={z.weekday} />,
      <KV key={label + 'u'} k={`${label} · unix s`} v={String(Math.floor(ms / 1000))} hint={relTime(ms, now)} />,
    ]
  }
  return (
    <Pane title="from now" actions={<span className="text-[11px] text-faint">expiry, TTL, “started at”</span>}>
      {row('now + Δ', now + delta)}
      {row('now − Δ', now - delta)}
    </Pane>
  )
}

function Limits({ ns }: { ns: number }) {
  const a = Math.abs(ns)
  return (
    <Pane title="fits in…">
      <table className="tbl">
        <thead>
          <tr>
            <th>limit</th>
            <th>max</th>
            <th className="text-right">this duration</th>
          </tr>
        </thead>
        <tbody>
          {LIMITS.map((l) => {
            const ratio = a / l.ns
            return (
              <tr key={l.label}>
                <td>
                  <div className="text-dim">{l.label}</div>
                  <div className="text-[10.5px] text-faint">{l.note}</div>
                </td>
                <td className="text-dim tabular-nums">≈ {headline(l.ns).text.replace(/^≈ /, '')}</td>
                <td className="text-right">
                  {ratio <= 1 ? (
                    <Badge tone="ok">✓ {ratio < 0.001 ? '<0.1' : (ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)}% of max</Badge>
                  ) : (
                    <Badge tone="err">✗ overflows ×{fmtNum(Number(ratio.toPrecision(3)))}</Badge>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Pane>
  )
}
