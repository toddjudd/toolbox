import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Editor } from '../components/Editor'
import { Badge, Btn, CopyBtn, Empty, Pane, Seg, Toggle, cx } from '../components/ui'
import { usePersistent } from '../lib/store'
import { enc } from '../lib/format'

type Sev = 'danger' | 'warn' | 'info'

const NAMES: Record<number, string> = {
  0x00: 'NULL',
  0x09: 'CHARACTER TABULATION (TAB)',
  0x0a: 'LINE FEED (LF)',
  0x0b: 'LINE TABULATION (VT)',
  0x0c: 'FORM FEED (FF)',
  0x0d: 'CARRIAGE RETURN (CR)',
  0x1b: 'ESCAPE',
  0x20: 'SPACE',
  0x7f: 'DELETE',
  0x85: 'NEXT LINE (NEL)',
  0xa0: 'NO-BREAK SPACE',
  0xad: 'SOFT HYPHEN',
  0x2002: 'EN SPACE',
  0x2003: 'EM SPACE',
  0x2007: 'FIGURE SPACE',
  0x2009: 'THIN SPACE',
  0x200a: 'HAIR SPACE',
  0x200b: 'ZERO WIDTH SPACE',
  0x200c: 'ZERO WIDTH NON-JOINER',
  0x200d: 'ZERO WIDTH JOINER',
  0x200e: 'LEFT-TO-RIGHT MARK',
  0x200f: 'RIGHT-TO-LEFT MARK',
  0x2010: 'HYPHEN',
  0x2011: 'NON-BREAKING HYPHEN',
  0x2013: 'EN DASH',
  0x2014: 'EM DASH',
  0x2018: 'LEFT SINGLE QUOTATION MARK',
  0x2019: 'RIGHT SINGLE QUOTATION MARK',
  0x201c: 'LEFT DOUBLE QUOTATION MARK',
  0x201d: 'RIGHT DOUBLE QUOTATION MARK',
  0x2026: 'HORIZONTAL ELLIPSIS',
  0x2028: 'LINE SEPARATOR',
  0x2029: 'PARAGRAPH SEPARATOR',
  0x202a: 'LEFT-TO-RIGHT EMBEDDING',
  0x202b: 'RIGHT-TO-LEFT EMBEDDING',
  0x202c: 'POP DIRECTIONAL FORMATTING',
  0x202d: 'LEFT-TO-RIGHT OVERRIDE',
  0x202e: 'RIGHT-TO-LEFT OVERRIDE',
  0x202f: 'NARROW NO-BREAK SPACE',
  0x205f: 'MEDIUM MATHEMATICAL SPACE',
  0x2060: 'WORD JOINER',
  0x2066: 'LEFT-TO-RIGHT ISOLATE',
  0x2067: 'RIGHT-TO-LEFT ISOLATE',
  0x2068: 'FIRST STRONG ISOLATE',
  0x2069: 'POP DIRECTIONAL ISOLATE',
  0x2212: 'MINUS SIGN',
  0x3000: 'IDEOGRAPHIC SPACE',
  0xfe0f: 'VARIATION SELECTOR-16 (emoji)',
  0xfeff: 'BYTE ORDER MARK / ZWNBSP',
  0xfffd: 'REPLACEMENT CHARACTER',
}

const SHORT: Record<number, string> = {
  0x00: 'NUL',
  0x0b: 'VT',
  0x0c: 'FF',
  0x1b: 'ESC',
  0x7f: 'DEL',
  0x85: 'NEL',
  0xa0: 'NBSP',
  0xad: 'SHY',
  0x200b: 'ZWSP',
  0x200c: 'ZWNJ',
  0x200d: 'ZWJ',
  0x200e: 'LRM',
  0x200f: 'RLM',
  0x2028: 'LS',
  0x2029: 'PS',
  0x202a: 'LRE',
  0x202b: 'RLE',
  0x202c: 'PDF',
  0x202d: 'LRO',
  0x202e: 'RLO',
  0x202f: 'NNBSP',
  0x2060: 'WJ',
  0x2066: 'LRI',
  0x2067: 'RLI',
  0x2068: 'FSI',
  0x2069: 'PDI',
  0x3000: 'IDSP',
  0xfeff: 'BOM',
}

const CATS: [string, string][] = [
  ['Lu', 'uppercase letter'],
  ['Ll', 'lowercase letter'],
  ['Lt', 'titlecase letter'],
  ['Lm', 'modifier letter'],
  ['Lo', 'letter'],
  ['Mn', 'combining mark'],
  ['Mc', 'spacing mark'],
  ['Me', 'enclosing mark'],
  ['Nd', 'digit'],
  ['Nl', 'letter number'],
  ['No', 'number'],
  ['Pc', 'connector punct.'],
  ['Pd', 'dash'],
  ['Ps', 'open punct.'],
  ['Pe', 'close punct.'],
  ['Pi', 'initial quote'],
  ['Pf', 'final quote'],
  ['Po', 'punctuation'],
  ['Sm', 'math symbol'],
  ['Sc', 'currency'],
  ['Sk', 'modifier symbol'],
  ['So', 'symbol'],
  ['Zs', 'space'],
  ['Zl', 'line separator'],
  ['Zp', 'paragraph sep.'],
  ['Cc', 'control'],
  ['Cf', 'format (invisible)'],
  ['Co', 'private use'],
  ['Cs', 'surrogate'],
]
const CAT_RE = CATS.map(([c, d]) => [c, d, new RegExp(`^\\p{${c}}$`, 'u')] as const)
const SCRIPTS = ['Latin', 'Greek', 'Cyrillic', 'Armenian', 'Hebrew', 'Arabic', 'Devanagari', 'Thai', 'Hangul', 'Hiragana', 'Katakana', 'Han', 'Cherokee'].map(
  (s) => [s, new RegExp(`\\p{Script=${s}}`, 'u')] as const,
)
const BIDI = new Set([0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f, 0x061c])
const QUOTES = new Set([0x2018, 0x2019, 0x201a, 0x201b, 0x201c, 0x201d, 0x201e, 0x201f, 0x2032, 0x2033, 0x00ab, 0x00bb])
const DASHES = new Set([0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212])

function category(ch: string) {
  for (const [c, d, re] of CAT_RE) if (re.test(ch)) return { code: c, desc: d }
  return { code: 'Cn', desc: 'unassigned' }
}
function script(ch: string) {
  for (const [s, re] of SCRIPTS) if (re.test(ch)) return s
  return /\p{Script=Common}/u.test(ch) ? 'Common' : /\p{Script=Inherited}/u.test(ch) ? 'Inherited' : 'Other'
}

function classify(cp: number, cat: string): { sev: Sev; why: string } | null {
  if (BIDI.has(cp)) return { sev: 'danger', why: 'bidi control: can reorder how code displays (Trojan Source)' }
  if (cp >= 0xe0000 && cp <= 0xe007f) return { sev: 'danger', why: 'tag character: invisible, used for ASCII smuggling' }
  if (cp === 0x200b || cp === 0x2060 || cp === 0xfeff) return { sev: 'danger', why: 'zero-width / invisible' }
  if (cp === 0xfffd) return { sev: 'danger', why: 'replacement char: something failed to decode' }
  if (cp === 0x2028 || cp === 0x2029) return { sev: 'danger', why: 'unicode line break: breaks JS strings & many parsers' }
  if (cp === 0x0a) return null
  if (cp === 0x09) return { sev: 'info', why: 'tab' }
  if (cp === 0x0d) return { sev: 'info', why: 'carriage return (Windows line ending?)' }
  if (cat === 'Cc') return { sev: 'danger', why: 'control character' }
  if (cp === 0x200c || cp === 0x200d) return { sev: 'warn', why: 'zero-width joiner: fine in emoji/scripts, suspicious in code' }
  if (cp === 0xad) return { sev: 'warn', why: 'soft hyphen: invisible' }
  if (cat === 'Zs' && cp !== 0x20) return { sev: 'warn', why: 'non-standard space' }
  if (QUOTES.has(cp)) return { sev: 'warn', why: 'smart quote: breaks code/JSON/shell' }
  if (DASHES.has(cp)) return { sev: 'warn', why: 'typographic dash: not an ASCII hyphen' }
  if (cp === 0x2026) return { sev: 'warn', why: 'ellipsis: not three dots' }
  if (cat === 'Cf') return { sev: 'warn', why: 'invisible format character' }
  if (cat === 'Co') return { sev: 'warn', why: 'private use area' }
  if (cp >= 0xfe00 && cp <= 0xfe0f) return { sev: 'info', why: 'variation selector' }
  return null
}

type Info = {
  i: number
  cp: number
  ch: string
  cat: { code: string; desc: string }
  script: string
  flag: { sev: Sev; why: string } | null
}

function analyze(text: string) {
  const out: Info[] = []
  let i = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    const cat = category(ch)
    out.push({ i, cp, ch, cat, script: script(ch), flag: classify(cp, cat.code) })
    i += ch.length
  }
  return { chars: out, mixed: flagHomoglyphs(out) }
}

function flagHomoglyphs(chars: Info[]) {
  const letterScripts = new Set(chars.filter((x) => x.cat.code.startsWith('L')).map((x) => x.script))
  const confusable = ['Cyrillic', 'Greek', 'Armenian', 'Cherokee'].filter((s) => letterScripts.has(s))
  if (!letterScripts.has('Latin') || !confusable.length) return []
  for (const x of chars)
    if (!x.flag && confusable.includes(x.script) && x.cat.code.startsWith('L'))
      x.flag = { sev: 'warn', why: `${x.script} letter mixed into Latin text: possible homoglyph` }
  return confusable
}

const hexcp = (cp: number) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
const utf8 = (ch: string) => enc.encode(ch)
const jsEsc = (cp: number) => (cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`)

type CleanOpts = { invisible: boolean; spaces: boolean; quotes: boolean; eol: boolean; nfc: boolean }
function clean(s: string, o: CleanOpts) {
  if (o.invisible) s = s.replace(/[\u200B-\u200F\u2060-⁤\uFEFF\u00AD\u202A-\u202E\u2066-\u2069\u061C]|[\u{E0000}-\u{E007F}]/gu, '')
  if (o.spaces) s = s.replace(/[\u00A0 -   　]/g, ' ')
  if (o.quotes)
    s = s
      .replace(/[‘’‚‛′]/g, "'")
      .replace(/[“”„‟″«»]/g, '"')
      .replace(/[‐-―−]/g, '-')
      .replace(/…/g, '...')
  if (o.eol) s = s.replace(/\r\n?/g, '\n').replace(/[\u2028\u2029\u0085]/g, '\n')
  if (o.nfc) s = s.normalize('NFC')
  return s
}

type BytesFmt = 'hex' | 'bin' | 'dec' | 'js' | 'html' | 'cps'
function asBytes(text: string, f: BytesFmt) {
  if (f === 'js') return [...text].map((c) => (/[\x20-\x7e]/.test(c) && c !== '\\' ? c : jsEsc(c.codePointAt(0)!))).join('')
  if (f === 'html') return [...text].map((c) => (/[\x20-\x7e]/.test(c) && !/[<>&"']/.test(c) ? c : `&#x${c.codePointAt(0)!.toString(16).toUpperCase()};`)).join('')
  if (f === 'cps') return [...text].map((c) => hexcp(c.codePointAt(0)!)).join(' ')
  const b = enc.encode(text)
  if (f === 'hex') return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ')
  if (f === 'bin') return Array.from(b, (x) => x.toString(2).padStart(8, '0')).join(' ')
  return Array.from(b).join(' ')
}

const MAX_ROWS = 1500
const MAX_VIS = 30000

export default function UnicodeTool() {
  const [text, setText] = usePersistent('unicode:input', '')
  const [onlyFlagged, setOnlyFlagged] = usePersistent('unicode:flagged', false)
  const [fmt, setFmt] = usePersistent<BytesFmt>('unicode:fmt', 'hex')
  const [opts, setOpts] = usePersistent<CleanOpts>('unicode:clean', { invisible: true, spaces: true, quotes: true, eol: true, nfc: false })
  const [showEol, setShowEol] = useState(true)

  const { chars, mixed } = useMemo(() => analyze(text.slice(0, 200_000)), [text])
  const flagged = chars.filter((c) => c.flag)
  const counts = { danger: 0, warn: 0, info: 0 }
  for (const c of flagged) counts[c.flag!.sev]++
  const crlf = (text.match(/\r\n/g) ?? []).length
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length
  const graphemes = useMemo(() => [...new Intl.Segmenter().segment(text)].length, [text])
  const cleaned = useMemo(() => clean(text, opts), [text, opts])
  const bytes = useMemo(() => asBytes(text.slice(0, 50_000), fmt), [text, fmt])
  const rows = (onlyFlagged ? flagged : chars).slice(0, MAX_ROWS)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title="input"
          className="h-72 lg:h-[24rem]"
          actions={
            <>
              <Btn
                variant="ghost"
                onClick={() =>
                  setText('const price = “10”;\u00A0// ok?\u200B\nif (user.isАdmin) {\u202E return true }\r\nrésumé café — naïve… \uFEFF😀👍🏽')
                }
              >
                sample
              </Btn>
              <Btn variant="ghost" onClick={() => setText('')}>
                clear
              </Btn>
            </>
          }
          footer={
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-faint">
              <span>
                <span className="text-dim">{chars.length}</span> code points
              </span>
              <span>
                <span className="text-dim">{graphemes}</span> graphemes
              </span>
              <span>
                <span className="text-dim">{text.length}</span> UTF-16 units
              </span>
              <span>
                <span className="text-dim">{enc.encode(text).length}</span> UTF-8 bytes
              </span>
              <span>
                EOL <span className="text-dim">{crlf && lf ? `mixed (${crlf} CRLF, ${lf} LF)` : crlf ? 'CRLF' : lf ? 'LF' : 'n/a'}</span>
              </span>
            </div>
          }
        >
          <Editor value={text} onChange={setText} wrap placeholder="Paste text with mystery characters…" autoFocus />
        </Pane>

        <Pane
          title="x-ray"
          className="h-72 lg:h-[24rem]"
          actions={
            <>
              {counts.danger > 0 && <Badge tone="err">{counts.danger} dangerous</Badge>}
              {counts.warn > 0 && <Badge tone="warn">{counts.warn} suspicious</Badge>}
              {text && !counts.danger && !counts.warn && <Badge tone="ok">✓ clean</Badge>}
              <Toggle checked={showEol} onChange={setShowEol} label="¶" title="show line endings & tabs" />
            </>
          }
          footer={mixed.length ? <span className="text-warn">⚠ mixed scripts: Latin + {mixed.join(', ')}. Look-alike letters (homoglyphs) highlighted.</span> : undefined}
        >
          {text ? <XRay chars={chars} showEol={showEol} /> : <Empty>invisible & lookalike characters light up here</Empty>}
        </Pane>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title="clean"
          actions={
            <>
              <CopyBtn text={cleaned} label="copy cleaned" />
              <Btn variant="primary" disabled={cleaned === text} onClick={() => setText(cleaned)}>
                apply
              </Btn>
            </>
          }
        >
          <div className="flex flex-wrap gap-x-4 gap-y-2 p-3">
            <Toggle checked={opts.invisible} onChange={(v) => setOpts({ ...opts, invisible: v })} label="strip zero-width, BOM & bidi" />
            <Toggle checked={opts.spaces} onChange={(v) => setOpts({ ...opts, spaces: v })} label="odd spaces → space" />
            <Toggle checked={opts.quotes} onChange={(v) => setOpts({ ...opts, quotes: v })} label="smart quotes & dashes → ASCII" />
            <Toggle checked={opts.eol} onChange={(v) => setOpts({ ...opts, eol: v })} label="line endings → LF" />
            <Toggle checked={opts.nfc} onChange={(v) => setOpts({ ...opts, nfc: v })} label="normalize NFC" />
            <span className="w-full text-[11px] text-faint">
              {cleaned === text ? 'nothing to change' : `${text.length - cleaned.length >= 0 ? text.length - cleaned.length : 0} chars removed · ${enc.encode(cleaned).length} bytes after`}
            </span>
          </div>
        </Pane>
        <Pane
          title="as bytes / escapes"
          actions={
            <>
              <Seg
                value={fmt}
                onChange={setFmt}
                options={[
                  { value: 'hex', label: 'hex' },
                  { value: 'bin', label: 'bin' },
                  { value: 'dec', label: 'dec' },
                  { value: 'cps', label: 'U+' },
                  { value: 'js', label: 'js' },
                  { value: 'html', label: 'html' },
                ]}
              />
              <CopyBtn text={bytes} />
            </>
          }
        >
          <div className="max-h-32 overflow-auto p-3 text-[11.5px] leading-relaxed break-all text-accent-soft">{bytes || <span className="text-faint">-</span>}</div>
        </Pane>
      </div>

      <Pane
        title={`characters · ${(onlyFlagged ? flagged : chars).length}`}
        className="max-h-[36rem]"
        actions={<Toggle checked={onlyFlagged} onChange={setOnlyFlagged} label="only flagged" />}
      >
        {rows.length === 0 ? (
          <Empty>{text ? 'nothing flagged 🎉' : 'per-character breakdown appears here'}</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th className="w-14">char</th>
                <th>code point</th>
                <th>name / category</th>
                <th>script</th>
                <th>utf-8</th>
                <th className="hidden xl:table-cell">binary</th>
                <th>escape</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const b = utf8(c.ch)
                return (
                  <tr key={c.i} className={cx(c.flag?.sev === 'danger' && 'bg-err/5', c.flag?.sev === 'warn' && 'bg-warn/5')}>
                    <td className="text-faint">{c.i}</td>
                    <td>
                      <span className={cx('inline-grid min-w-7 place-items-center rounded border border-line-2 px-1 text-[14px]', c.flag && `uc-${c.flag.sev}`)}>
                        {visible(c)}
                      </span>
                    </td>
                    <td className="text-info">{hexcp(c.cp)}</td>
                    <td>
                      <div className="text-fg">{NAMES[c.cp] ?? c.cat.desc}</div>
                      <div className="text-[10.5px] text-faint">
                        {c.cat.code}
                        {c.flag && <span className={c.flag.sev === 'danger' ? 'text-err' : c.flag.sev === 'warn' ? 'text-warn' : ''}> · {c.flag.why}</span>}
                      </div>
                    </td>
                    <td className="text-dim">{c.script}</td>
                    <td className="whitespace-nowrap text-warn">{Array.from(b, (x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' ')}</td>
                    <td className="hidden whitespace-nowrap text-faint xl:table-cell">{Array.from(b, (x) => x.toString(2).padStart(8, '0')).join(' ')}</td>
                    <td className="text-dim">{jsEsc(c.cp)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {(onlyFlagged ? flagged : chars).length > MAX_ROWS && <div className="p-3 text-center text-[11px] text-faint">showing first {MAX_ROWS}</div>}
      </Pane>
    </div>
  )
}

function visible(c: Info) {
  if (SHORT[c.cp]) return <span className="text-[10px]">{SHORT[c.cp]}</span>
  if (c.cp === 0x0a) return '↵'
  if (c.cp === 0x0d) return '␍'
  if (c.cp === 0x09) return '⇥'
  if (c.cp === 0x20) return '·'
  if (c.cat.code === 'Cc') return <span className="text-[10px]">^{String.fromCharCode((c.cp + 64) & 0x7f)}</span>
  if (c.cat.code.startsWith('M')) return '◌' + c.ch
  if (c.cat.code === 'Zs' || c.cat.code === 'Cf') return <span className="text-[10px]">{hexcp(c.cp).slice(2)}</span>
  return c.ch
}

function XRay({ chars, showEol }: { chars: Info[]; showEol: boolean }) {
  const parts: ReactNode[] = []
  let buf = ''
  const flush = (k: number) => {
    if (buf) parts.push(<Fragment key={'t' + k}>{buf}</Fragment>)
    buf = ''
  }
  for (const c of chars.slice(0, MAX_VIS)) {
    if (c.cp === 0x0a) {
      flush(c.i)
      parts.push(
        <Fragment key={c.i}>
          {showEol && <span className="uc uc-info">↵</span>}
          {'\n'}
        </Fragment>,
      )
      continue
    }
    if (!c.flag || (c.flag.sev === 'info' && !showEol && c.cp !== 0x0d)) {
      buf += c.ch
      continue
    }
    flush(c.i)
    const label = SHORT[c.cp]
    const isVisibleGlyph = !label && !['Zs', 'Cf', 'Cc', 'Zl', 'Zp'].includes(c.cat.code)
    parts.push(
      <span
        key={c.i}
        className={cx('uc', `uc-${c.flag.sev}`, isVisibleGlyph && 'uc-char')}
        title={`${hexcp(c.cp)} ${NAMES[c.cp] ?? c.cat.desc}: ${c.flag.why}`}
      >
        {c.cp === 0x0d ? '␍' : c.cp === 0x09 ? '⇥\t' : isVisibleGlyph ? c.ch : label ?? hexcp(c.cp)}
      </span>,
    )
  }
  flush(-1)
  return <pre className="p-3 text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-fg">{parts}</pre>
}
