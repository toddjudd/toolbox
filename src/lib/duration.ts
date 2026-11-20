// Everything is carried as a float count of nanoseconds. Calendar units are fixed-length
// (1mo = 30d, 1y = 365d) because a bare duration has no start date to anchor them to.

export const NS = 1
export const US = 1e3
export const MS = 1e6
export const SEC = 1e9
export const MIN = 60 * SEC
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR
export const WEEK = 7 * DAY
export const MONTH = 30 * DAY
export const YEAR = 365 * DAY

export type NumUnit = 'ns' | 'us' | 'ms' | 's' | 'm' | 'h' | 'd'

export const NUM_UNITS: { id: NumUnit; label: string; long: string; ns: number; bias: number }[] = [
  { id: 'ns', label: 'ns', long: 'nanoseconds', ns: NS, bias: 0.05 },
  { id: 'us', label: 'µs', long: 'microseconds', ns: US, bias: 0 },
  { id: 'ms', label: 'ms', long: 'milliseconds', ns: MS, bias: 0.25 },
  { id: 's', label: 's', long: 'seconds', ns: SEC, bias: 0.3 },
  { id: 'm', label: 'min', long: 'minutes', ns: MIN, bias: -0.1 },
  { id: 'h', label: 'h', long: 'hours', ns: HOUR, bias: -0.2 },
  { id: 'd', label: 'd', long: 'days', ns: DAY, bias: -0.3 },
]

const ALIASES: [RegExp, number][] = [
  [/^(ns|nsecs?|nanos?|nanoseconds?)$/, NS],
  [/^(us|µs|μs|usecs?|micros?|microseconds?)$/, US],
  [/^(ms|msecs?|millis?|milliseconds?)$/, MS],
  [/^(s|secs?|seconds?)$/, SEC],
  [/^(m|mins?|minutes?)$/, MIN],
  [/^(h|hrs?|hours?)$/, HOUR],
  [/^(d|days?)$/, DAY],
  [/^(w|wks?|weeks?)$/, WEEK],
  [/^(mo|mos|months?)$/, MONTH],
  [/^(y|yrs?|years?)$/, YEAR],
]

const unitNs = (u: string) => ALIASES.find(([re]) => re.test(u))?.[1]

export type Parsed =
  | { kind: 'number'; ns: number; value: number; unit: NumUnit; guessed: boolean }
  | { kind: 'units' | 'iso' | 'clock'; ns: number }

export type ParseResult = Parsed | { error: string } | null

const NUM = String.raw`(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?`
const BARE_RE = new RegExp(`^([+-])?(${NUM})$`, 'i')
const ISO_N = String.raw`(\d+(?:[.,]\d+)?)`
const ISO_RE = new RegExp(
  `^([+-])?P(?!$)(?:${ISO_N}Y)?(?:${ISO_N}M)?(?:${ISO_N}W)?(?:${ISO_N}D)?(?:T(?=[\\d.,])(?:${ISO_N}H)?(?:${ISO_N}M)?(?:${ISO_N}S)?)?$`,
  'i',
)
// [d.|d:]hh:mm[:ss[.fff]]; the lookahead only lets a day part in when two more colons follow,
// so "01:30:00" is h:m:s and "1.02:03:04" (.NET TimeSpan) is d.h:m:s.
const CLOCK_RE = /^([+-])?(?:(\d+)[.:](?=\d+:\d+:))?(\d+):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/
const TERM_RE = new RegExp(`\\s*([+-])?\\s*(${NUM})\\s*([a-zµμ]+)?`, 'iy')

export function parseDuration(raw: string, unit: NumUnit | 'auto' = 'auto'): ParseResult {
  const s = raw
    .trim()
    .replace(/(\d)[_,](?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d)_(?=\d)/g, '$1')
  if (!s) return null

  const bare = BARE_RE.exec(s)
  if (bare) {
    const value = Number(bare[2]) * (bare[1] === '-' ? -1 : 1)
    const u = unit === 'auto' ? guessUnits(value)[0].id : unit
    return { kind: 'number', ns: value * NUM_UNITS.find((x) => x.id === u)!.ns, value, unit: u, guessed: unit === 'auto' }
  }

  const iso = ISO_RE.exec(s)
  if (iso) {
    const n = (i: number) => (iso[i] ? Number(iso[i].replace(',', '.')) : 0)
    const ns = n(2) * YEAR + n(3) * MONTH + n(4) * WEEK + n(5) * DAY + n(6) * HOUR + n(7) * MIN + n(8) * SEC
    return { kind: 'iso', ns: iso[1] === '-' ? -ns : ns }
  }

  const clock = CLOCK_RE.exec(s)
  if (clock) {
    const [, sign, d, h, m, sec] = clock
    if (Number(m) >= 60 || Number(sec ?? 0) >= 60) return { error: 'minutes and seconds in a clock duration must be under 60' }
    const ns = Number(d ?? 0) * DAY + Number(h) * HOUR + Number(m) * MIN + Number(sec ?? 0) * SEC
    return { kind: 'clock', ns: sign === '-' ? -ns : ns }
  }

  const words = s.toLowerCase().replace(/,|\band\b/g, ' ').trim()
  let ns = 0
  let pos = 0
  let terms = 0
  TERM_RE.lastIndex = 0
  while (pos < words.length) {
    TERM_RE.lastIndex = pos
    const t = TERM_RE.exec(words)
    if (!t) return { error: `can’t read “${words.slice(pos).trim()}”` }
    const [, sign, num, u] = t
    if (!u) return { error: `missing a unit after ${num} (e.g. ${num}s, ${num}m, ${num}h)` }
    const per = unitNs(u)
    if (per == null) return { error: `unknown unit “${u}”. Try ns, µs, ms, s, m, h, d, w, mo, y` }
    ns += Number(num) * per * (sign === '-' ? -1 : 1)
    pos = TERM_RE.lastIndex
    terms++
    while (words[pos] === ' ') pos++
  }
  return terms ? { kind: 'units', ns } : null
}

const PARTS: { ns: number; short: string; one: string; many: string }[] = [
  { ns: YEAR, short: 'y', one: 'year', many: 'years' },
  { ns: DAY, short: 'd', one: 'day', many: 'days' },
  { ns: HOUR, short: 'h', one: 'hour', many: 'hours' },
  { ns: MIN, short: 'm', one: 'minute', many: 'minutes' },
  { ns: SEC, short: 's', one: 'second', many: 'seconds' },
  { ns: MS, short: 'ms', one: 'millisecond', many: 'milliseconds' },
  { ns: US, short: 'µs', one: 'microsecond', many: 'microseconds' },
  { ns: NS, short: 'ns', one: 'nanosecond', many: 'nanoseconds' },
]

// Past ~104 days a float can't hold every nanosecond, so sub-ms parts there are rounding noise.
function wholeNs(ns: number) {
  const a = Math.abs(ns)
  return a > Number.MAX_SAFE_INTEGER ? Math.round(a / MS) * MS : Math.round(a)
}

export function breakdown(ns: number) {
  let r = wholeNs(ns)
  const out: { n: number; part: (typeof PARTS)[number] }[] = []
  for (const part of PARTS) {
    if (r >= part.ns) {
      const n = Math.floor(r / part.ns)
      r -= n * part.ns
      out.push({ n, part })
    }
  }
  return out
}

const sign = (ns: number) => (ns < 0 ? '-' : '')

export function fmtShort(ns: number) {
  const b = breakdown(ns)
  return b.length ? sign(ns) + b.map((x) => `${x.n}${x.part.short}`).join(' ') : '0s'
}

export function fmtLong(ns: number) {
  const b = breakdown(ns)
  if (!b.length) return '0 seconds'
  const words = b.map((x) => `${x.n.toLocaleString('en-US')} ${x.n === 1 ? x.part.one : x.part.many}`)
  const body = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0]
  return (ns < 0 ? 'minus ' : '') + body
}

const HEADLINE: { ns: number; one: string; many: string; exactOnly?: boolean }[] = [
  { ns: YEAR, one: 'year', many: 'years' },
  { ns: WEEK, one: 'week', many: 'weeks', exactOnly: true },
  { ns: DAY, one: 'day', many: 'days' },
  { ns: HOUR, one: 'hour', many: 'hours' },
  { ns: MIN, one: 'minute', many: 'minutes' },
  { ns: SEC, one: 'second', many: 'seconds' },
  { ns: MS, one: 'millisecond', many: 'milliseconds' },
  { ns: US, one: 'microsecond', many: 'microseconds' },
  { ns: NS, one: 'nanosecond', many: 'nanoseconds' },
]

export function fmtNum(v: number) {
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e21 || a < 1e-9)) return v.toExponential(4)
  return v.toLocaleString('en-US', { maximumFractionDigits: a < 1 ? 9 : a < 1000 ? 6 : 3 })
}

/** One number in the biggest unit that fits: "10 minutes", "≈ 6.94 days". */
export function headline(ns: number) {
  const a = Math.abs(ns)
  if (a === 0) return { text: '0 seconds', exact: true }
  const h = HEADLINE.find((u) => a >= u.ns && (!u.exactOnly || wholeNs(a) % u.ns === 0)) ?? HEADLINE.at(-1)!
  const v = a / h.ns
  const rounded = Number(v.toFixed(v < 10 ? 3 : v < 100 ? 2 : 1))
  const exact = Math.abs(rounded - v) < 1e-9 * Math.max(1, v)
  const num = rounded.toLocaleString('en-US', { maximumFractionDigits: 3 })
  return { text: `${exact ? '' : '≈ '}${sign(ns)}${num} ${rounded === 1 ? h.one : h.many}`, exact }
}

function fracSec(nsRem: number, maxDigits: number) {
  const digits = String(Math.round(nsRem)).padStart(9, '0').slice(0, maxDigits).replace(/0+$/, '')
  return digits ? '.' + digits : ''
}

export function fmtIso(ns: number) {
  const a = wholeNs(ns)
  if (!a) return 'PT0S'
  const d = Math.floor(a / DAY)
  const h = Math.floor((a % DAY) / HOUR)
  const m = Math.floor((a % HOUR) / MIN)
  const sWhole = Math.floor((a % MIN) / SEC)
  const frac = fracSec(a % SEC, 9)
  const time = `${h ? h + 'H' : ''}${m ? m + 'M' : ''}${sWhole || frac ? `${sWhole}${frac}S` : ''}`
  return `${sign(ns)}P${d ? d + 'D' : ''}${time ? 'T' + time : ''}`
}

/** Go's time.Duration.String(): hours never roll into days. */
export function fmtGo(ns: number) {
  const a = wholeNs(ns)
  if (!a) return '0s'
  if (a < SEC) {
    const [u, per] = a < US ? ['ns', NS] : a < MS ? ['µs', US] : ['ms', MS]
    return `${sign(ns)}${Number((a / per).toFixed(6))}${u}`
  }
  const h = Math.floor(a / HOUR)
  const m = Math.floor((a % HOUR) / MIN)
  const s = `${Math.floor((a % MIN) / SEC)}${fracSec(a % SEC, 9)}`
  return `${sign(ns)}${h ? `${h}h${m}m` : m ? `${m}m` : ''}${s}s`
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** Total hours, never wrapping: 166:40:00. */
export function fmtClock(ns: number) {
  const a = wholeNs(ns)
  const h = Math.floor(a / HOUR)
  const m = Math.floor((a % HOUR) / MIN)
  const s = Math.floor((a % MIN) / SEC)
  const ms = Math.floor((a % SEC) / MS)
  return `${sign(ns)}${p2(h)}:${p2(m)}:${p2(s)}${ms ? '.' + String(ms).padStart(3, '0') : ''}`
}

/** .NET TimeSpan "c" format: [-][d.]hh:mm:ss[.fffffff] (100 ns ticks). */
export function fmtTimeSpan(ns: number) {
  const a = wholeNs(ns)
  const d = Math.floor(a / DAY)
  const h = Math.floor((a % DAY) / HOUR)
  const m = Math.floor((a % HOUR) / MIN)
  const s = Math.floor((a % MIN) / SEC)
  const ticks = Math.floor((a % SEC) / 100)
  return `${sign(ns)}${d ? d + '.' : ''}${p2(h)}:${p2(m)}:${p2(s)}${ticks ? '.' + String(ticks).padStart(7, '0') : ''}`
}

// Bare numbers are ambiguous, so rank every unit by how "configured by a human" the result looks:
// few non-zero parts (600000 ms = 10m beats 600000 s = 6d 22h 40m), within a sane range, with a
// small nudge toward the units that show up in config files most.
export function guessUnits(value: number) {
  return NUM_UNITS.map((u) => {
    const ns = Math.abs(value) * u.ns
    const ms = ns / MS
    let score = u.bias
    if (ns > 0) {
      score += 5 - breakdown(ns).length
      if (ms < 1) score -= 1 + Math.log10(1 / ms)
      else if (ms < 1000) score -= 0.4 * Math.log10(1000 / ms)
      if (ns > YEAR) score -= 1 + 1.5 * Math.log10(ns / YEAR)
    }
    return { ...u, value: value * u.ns, score }
  }).sort((a, b) => b.score - a.score)
}

export const LIMITS: { label: string; note: string; ns: number }[] = [
  { label: 'JS setTimeout / setInterval', note: '2³¹−1 ms; longer delays fire immediately', ns: (2 ** 31 - 1) * MS },
  { label: 'uint32 milliseconds', note: '2³²−1 ms, e.g. Windows GetTickCount wraps', ns: (2 ** 32 - 1) * MS },
  { label: 'JS safe integer of ns', note: '2⁵³ ns; ns counts beyond this lose precision in JSON / JS', ns: 2 ** 53 },
  { label: 'int32 seconds', note: '2³¹−1 s, the Y2038 limit', ns: (2 ** 31 - 1) * SEC },
  { label: 'int64 nanoseconds', note: '2⁶³−1 ns, Go time.Duration max', ns: 2 ** 63 - 1 },
]
