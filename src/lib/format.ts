export const enc = new TextEncoder()
export const dec = new TextDecoder()

export async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

export function bytesToB64(bytes: Uint8Array, urlSafe = false) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  const b = btoa(s)
  return urlSafe ? b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b
}

export function b64ToBytes(input: string): Uint8Array<ArrayBuffer> {
  let s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  if (!/^[A-Za-z0-9+/]*$/.test(s)) throw new Error('Invalid base64 characters')
  if (s.length % 4 === 1) throw new Error('Invalid base64 length')
  s += '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function utf8Strict(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

const ALLOWED_WHITESPACE = new Set([0x09, 0x0a, 0x0d])
const REPLACEMENT_CHAR = 0xfffd

export function isPrintable(s: string) {
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    const isControl = cp < 0x20 || cp === 0x7f
    if ((isControl && !ALLOWED_WHITESPACE.has(cp)) || cp === REPLACEMENT_CHAR) return false
  }
  return true
}

export function toHex(bytes: Uint8Array, sep = ' ') {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(sep)
}

export function hexdump(bytes: Uint8Array, max = 8192) {
  const lines: string[] = []
  const n = Math.min(bytes.length, max)
  for (let off = 0; off < n; off += 16) {
    const row = bytes.subarray(off, Math.min(off + 16, n))
    const hex = Array.from(row, (b) => b.toString(16).padStart(2, '0'))
    const left = hex.slice(0, 8).join(' ')
    const right = hex.slice(8).join(' ')
    const ascii = Array.from(row, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('')
    lines.push(`${off.toString(16).padStart(8, '0')}  ${left.padEnd(23)}  ${right.padEnd(23)}  |${ascii}|`)
  }
  if (bytes.length > max) lines.push(`… ${bytes.length - max} more bytes`)
  return lines.join('\n')
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function fmtDuration(ms: number, parts = 3) {
  const units: [string, number][] = [
    ['y', 31_536_000_000],
    ['d', 86_400_000],
    ['h', 3_600_000],
    ['m', 60_000],
    ['s', 1000],
  ]
  const out: string[] = []
  let r = Math.floor(Math.abs(ms))
  for (const [u, v] of units) {
    if (r >= v) {
      const n = Math.floor(r / v)
      r -= n * v
      out.push(`${n}${u}`)
    } else if (out.length) {
      out.push(`0${u}`)
    }
    if (out.length >= parts) break
  }
  const trimmed = out.filter((p, i) => i === 0 || !p.startsWith('0'))
  return trimmed.length ? trimmed.join(' ') : `${Math.floor(Math.abs(ms))}ms`
}

export function relTime(target: number, now: number) {
  const d = target - now
  if (Math.abs(d) < 1000) return 'now'
  const s = fmtDuration(d, 2)
  return d > 0 ? `in ${s}` : `${s} ago`
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

export function fmtInZone(ms: number, timeZone?: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
    timeZoneName: 'shortOffset',
  })
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]))
  return {
    text: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`,
    weekday: p.weekday,
    offset: p.timeZoneName,
  }
}

export function clockParts(ms: number, timeZone?: string) {
  const d = new Date(ms)
  if (!timeZone) return { h: pad(d.getHours()), m: pad(d.getMinutes()), s: pad(d.getSeconds()) }
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]))
  return { h: p.hour, m: p.minute, s: p.second }
}
