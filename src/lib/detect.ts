import { navigate } from './router'
import { setStored } from './store'
import { b64ToBytes, dec, isPrintable, relTime, utf8Strict } from './format'

export type Detection = {
  tool: string
  label: string
  preview: string
  confidence: 'high' | 'medium' | 'low'
  apply: () => void
}

const open = (tool: string, sets: Record<string, unknown>) => () => {
  for (const [k, v] of Object.entries(sets)) setStored(k, v)
  navigate(tool)
}

const clip = (s: string, n = 70) => (s.length > n ? s.slice(0, n) + '…' : s).replace(/\s+/g, ' ')

const UUID_RE = /^[{(]?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}[)}]?$/i
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i

/** Figures out what a blob of pasted text probably is, best guesses first. */
export function detect(raw: string): Detection[] {
  const s = raw.trim()
  const out: Detection[] = []
  if (!s) return out
  const now = Date.now()

  // JWT
  if (/^eyJ[\w-]*\.eyJ[\w-]*\.[\w-]*$/.test(s)) {
    let preview = 'JSON Web Token'
    try {
      const h = JSON.parse(dec.decode(b64ToBytes(s.split('.')[0])))
      const p = JSON.parse(dec.decode(b64ToBytes(s.split('.')[1])))
      const bits = [h.alg && `alg ${h.alg}`, p.sub && `sub ${p.sub}`, typeof p.exp === 'number' && `exp ${relTime(p.exp * 1000, now)}`]
      preview = bits.filter(Boolean).join(' · ')
    } catch {
      /* keep default */
    }
    out.push({ tool: 'jwt', label: 'Decode JWT', preview, confidence: 'high', apply: open('jwt', { 'jwt:input': s }) })
  }

  // JSON
  if (/^[[{"]/.test(s)) {
    try {
      const v = JSON.parse(s)
      const preview = Array.isArray(v)
        ? `array · ${v.length} items`
        : v && typeof v === 'object'
          ? `object · ${Object.keys(v).length} keys: ${clip(Object.keys(v).join(', '), 50)}`
          : typeof v === 'string'
            ? `JSON string literal: ${clip(v, 50)}`
            : String(v)
      out.push({ tool: 'json', label: 'Format JSON', preview, confidence: 'high', apply: open('json', { 'json:input': s }) })
    } catch (e) {
      if (/^[[{]/.test(s))
        out.push({
          tool: 'json',
          label: 'Debug invalid JSON',
          preview: clip((e as Error).message, 80),
          confidence: 'medium',
          apply: open('json', { 'json:input': s }),
        })
    }
  }

  // URL
  if (/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(s)) {
    try {
      const u = new URL(s)
      const n = [...u.searchParams.keys()].length
      out.push({
        tool: 'url',
        label: 'Parse URL',
        preview: `${u.host}${clip(u.pathname, 30)}${n ? ` · ${n} param${n > 1 ? 's' : ''}` : ''}`,
        confidence: 'high',
        apply: open('url', { 'url:tab': 'parse', 'url:parse': s }),
      })
    } catch {
      /* not a URL */
    }
  }
  if (/%[0-9a-f]{2}/i.test(s)) {
    let preview = ''
    try {
      preview = decodeURIComponent(s.replace(/\+/g, ' '))
    } catch {
      preview = 'malformed percent-encoding'
    }
    out.push({
      tool: 'url',
      label: 'URL-decode',
      preview: clip(preview),
      confidence: 'medium',
      apply: open('url', { 'url:tab': 'codec', 'url:mode': 'decode', 'url:input': s }),
    })
  }

  // timestamps
  if (/^-?\d{9,19}(\.\d+)?$/.test(s)) {
    const digits = s.replace(/^-/, '').split('.')[0].length
    const n = Number(s)
    const ms = digits <= 11 ? n * 1000 : digits <= 14 ? n : digits <= 17 ? n / 1e3 : n / 1e6
    const d = new Date(ms)
    if (!isNaN(d.getTime()))
      out.push({
        tool: 'epoch',
        label: 'Convert timestamp',
        preview: `${d.toISOString()} · ${relTime(ms, now)}`,
        confidence: 'high',
        apply: open('epoch', { 'epoch:input': s }),
      })
  } else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s) && !isNaN(Date.parse(s))) {
    out.push({
      tool: 'epoch',
      label: 'Convert date → epoch',
      preview: `${Math.floor(Date.parse(s) / 1000)} · ${relTime(Date.parse(s), now)}`,
      confidence: 'high',
      apply: open('epoch', { 'epoch:input': s }),
    })
  }

  // IDs
  if (UUID_RE.test(s)) {
    const hex = s.replace(/[^0-9a-f]/gi, '')
    out.push({
      tool: 'uuid',
      label: 'Inspect UUID',
      preview: `version ${parseInt(hex[12], 16)}`,
      confidence: 'high',
      apply: open('uuid', { 'uuid:inspect': s }),
    })
  } else if (ULID_RE.test(s)) {
    out.push({ tool: 'uuid', label: 'Inspect ULID', preview: 'ULID', confidence: 'medium', apply: open('uuid', { 'uuid:inspect': s }) })
  }

  // numbers in other bases
  if (/^-?0x[0-9a-f_]+$/i.test(s) || /^0b[01_]+$/i.test(s) || /^0o[0-7_]+$/i.test(s)) {
    let preview = ''
    try {
      preview = `= ${BigInt(s.replace(/_/g, '')).toString()} (dec)`
    } catch {
      /* ignore */
    }
    out.push({
      tool: 'base',
      label: 'Convert number',
      preview,
      confidence: 'high',
      apply: open('base', { 'base:src': { radix: s.match(/^-?0([xbo])/i)![1].toLowerCase(), text: s.replace(/^(-?)0[xbo]/i, '$1') } }),
    })
  } else if (/^-?\d{1,18}$/.test(s)) {
    out.push({
      tool: 'base',
      label: 'Convert number',
      preview: `= 0x${BigInt(s).toString(16)}`,
      confidence: 'medium',
      apply: open('base', { 'base:src': { radix: 'd', text: s } }),
    })
  }

  // regex literal
  const re = /^\/(.+)\/([dgimsuyv]*)$/s.exec(s)
  if (re) {
    out.push({
      tool: 'regex',
      label: 'Test regex',
      preview: s,
      confidence: 'medium',
      apply: open('regex', { 'regex:pattern': re[1], 'regex:flags': re[2] || 'g' }),
    })
  }

  // base64
  const compact = s.replace(/\s+/g, '')
  if (compact.length >= 8 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(compact) && !/^\d+$/.test(compact) && !UUID_RE.test(s)) {
    try {
      const bytes = b64ToBytes(compact)
      const txt = utf8Strict(bytes)
      if (txt != null && isPrintable(txt))
        out.push({
          tool: 'base64',
          label: 'Base64-decode',
          preview: clip(txt),
          confidence: /[+/=]/.test(compact) || compact.length % 4 === 0 ? 'medium' : 'low',
          apply: open('base64', { 'base64:input': s, 'base64:mode': 'decode' }),
        })
      else
        out.push({
          tool: 'base64',
          label: 'Base64-decode (binary)',
          preview: `${bytes.length} bytes`,
          confidence: 'low',
          apply: open('base64', { 'base64:input': s, 'base64:mode': 'decode' }),
        })
    } catch {
      /* not base64 */
    }
  }

  // fallbacks
  // eslint-disable-next-line no-control-regex
  const odd = (s.match(/[^\x09\x0A\x0D\x20-\x7E]/g) ?? []).length
  out.push({
    tool: 'unicode',
    label: 'Inspect characters',
    preview: `${[...s].length} chars${odd ? ` · ${odd} non-ASCII` : ''}`,
    confidence: odd ? 'medium' : 'low',
    apply: open('unicode', { 'unicode:input': raw }),
  })
  out.push({
    tool: 'base64',
    label: 'Base64-encode',
    preview: 'encode as base64',
    confidence: 'low',
    apply: open('base64', { 'base64:input': raw, 'base64:mode': 'encode' }),
  })
  out.push({
    tool: 'regex',
    label: 'Use as regex test text',
    preview: clip(s, 50),
    confidence: 'low',
    apply: open('regex', { 'regex:text': raw }),
  })

  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.confidence] - rank[b.confidence])
}
