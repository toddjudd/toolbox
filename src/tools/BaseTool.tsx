import { useMemo } from 'react'
import { Badge, CopyBtn, Pane, Seg, cx } from '../components/ui'
import { usePersistent } from '../lib/store'
import { bytesToB64, isPrintable, toHex } from '../lib/format'

type Radix = 'd' | 'x' | 'o' | 'b'
type Src = { radix: Radix; text: string }
const RADIX: Record<Radix, { base: number; prefix: string; label: string; re: RegExp }> = {
  d: { base: 10, prefix: '', label: 'decimal', re: /^-?\d+$/ },
  x: { base: 16, prefix: '0x', label: 'hex', re: /^-?[0-9a-f]+$/i },
  o: { base: 8, prefix: '0o', label: 'octal', re: /^-?[0-7]+$/ },
  b: { base: 2, prefix: '0b', label: 'binary', re: /^-?[01]+$/ },
}
const WIDTHS = ['8', '16', '32', '64'] as const
type Width = (typeof WIDTHS)[number]

function parseBig(src: Src): bigint | null | 'err' {
  const t = src.text.trim().replace(/[_\s,]/g, '').replace(/^(-?)0[xob]/i, '$1')
  if (!t || t === '-') return null
  if (!RADIX[src.radix].re.test(t)) return 'err'
  const neg = t.startsWith('-')
  const body = neg ? t.slice(1) : t
  const v = src.radix === 'd' ? BigInt(body) : BigInt(RADIX[src.radix].prefix + body)
  return neg ? -v : v
}


export default function BaseTool() {
  const [src, setSrc] = usePersistent<Src>('base:src', { radix: 'd', text: '255' })
  const [width, setWidth] = usePersistent<Width>('base:width', '32')
  const v = useMemo(() => parseBig(src), [src])
  const w = BigInt(width)
  const mask = (1n << w) - 1n
  const val = typeof v === 'bigint' ? v : null
  // representation for non-decimal bases: two's complement when negative
  const unsigned = val == null ? null : val < 0n ? val & mask : val

  const show = (r: Radix) => {
    if (src.radix === r) return src.text
    if (val == null) return ''
    if (r === 'd') return val.toString(10)
    return unsigned!.toString(RADIX[r].base)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title="number"
          actions={
            <>
              {v === 'err' && <Badge tone="err">✗ invalid {RADIX[src.radix].label} digits</Badge>}
              {val != null && val < 0n && <Badge tone="info">negative → {width}-bit two’s complement</Badge>}
            </>
          }
        >
          <div className="flex flex-col gap-2.5 p-3">
            {(['d', 'x', 'o', 'b'] as Radix[]).map((r) => (
              <label key={r} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
                <span className="text-[11.5px] text-dim">
                  {RADIX[r].label}
                  <span className="ml-1 text-faint">{RADIX[r].prefix}</span>
                </span>
                <input
                  className={cx('input text-[13.5px]!', src.radix === r && 'border-accent/60!')}
                  value={show(r)}
                  onChange={(e) => setSrc({ radix: r, text: e.target.value })}
                  spellCheck={false}
                  autoFocus={r === 'd'}
                />
                <CopyBtn text={show(r) ? RADIX[r].prefix + show(r) : ''} />
              </label>
            ))}
          </div>
        </Pane>

        <Pane title="fits in…">
          {val == null ? (
            <div className="p-4 text-xs text-faint">enter a number</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>width</th>
                  <th>as unsigned</th>
                  <th>as signed</th>
                </tr>
              </thead>
              <tbody>
                {WIDTHS.map((ws) => {
                  const bw = BigInt(ws)
                  const m = (1n << bw) - 1n
                  const u = val & m
                  const s = u >= 1n << (bw - 1n) ? u - (1n << bw) : u
                  const fitsU = val >= 0n && val <= m
                  const fitsS = val >= -(1n << (bw - 1n)) && val < 1n << (bw - 1n)
                  return (
                    <tr key={ws}>
                      <td className="text-dim">
                        {ws}-bit
                        <div className="text-[10.5px] text-faint">
                          u{ws} / i{ws}
                        </div>
                      </td>
                      <td className={fitsU ? 'text-accent' : 'text-faint line-through'}>{u.toString()}</td>
                      <td className={fitsS ? 'text-accent' : 'text-faint line-through'}>{s.toString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Pane>
      </div>

      <Pane
        title="bits · click to flip"
        actions={
          <>
            <span className="text-[11px] text-faint">{unsigned != null ? `${unsigned.toString(2).replace(/^0+/, '').length || 0} significant bits · popcount ${(unsigned & mask).toString(2).split('1').length - 1}` : ''}</span>
            <Seg value={width} onChange={setWidth} options={WIDTHS.map((x) => ({ value: x, label: `${x}` }))} />
          </>
        }
      >
        <div className="flex flex-wrap gap-x-3 gap-y-3 p-3">
          {Array.from({ length: Number(w) / 8 }, (_, byte) => {
            const hi = Number(w) / 8 - 1 - byte
            return (
              <div key={byte} className="flex flex-col items-center gap-1">
                <div className="flex gap-0.5">
                  {Array.from({ length: 8 }, (_, bit) => {
                    const idx = BigInt(hi * 8 + (7 - bit))
                    const on = unsigned != null && ((unsigned >> idx) & 1n) === 1n
                    return (
                      <button
                        key={bit}
                        title={`bit ${idx} = ${1n << idx}`}
                        onClick={() => {
                          const cur = unsigned ?? 0n
                          const next = (cur ^ (1n << idx)) & mask
                          setSrc({ radix: 'd', text: next.toString() })
                        }}
                        className={cx(
                          'h-8 w-6 rounded border text-[12px] transition',
                          on ? 'border-accent/70 bg-accent/15 text-accent glow' : 'border-line-2 text-faint hover:border-accent/40 hover:text-dim',
                        )}
                      >
                        {on ? 1 : 0}
                      </button>
                    )
                  })}
                </div>
                <span className="text-[10px] text-faint">
                  {hi * 8 + 7}…{hi * 8} · 0x{unsigned != null ? ((unsigned >> BigInt(hi * 8)) & 0xffn).toString(16).padStart(2, '0') : '00'}
                </span>
              </div>
            )
          })}
        </div>
      </Pane>

      <BytesText />
    </div>
  )
}

function parseBytes(s: string): { bytes: Uint8Array; fmt: string } | { error: string } | null {
  const t = s.trim()
  if (!t) return null
  const tokens = t.split(/[\s,]+/).filter(Boolean)
  if (tokens.every((x) => /^[01]{8}$/.test(x))) return { bytes: Uint8Array.from(tokens, (x) => parseInt(x, 2)), fmt: 'binary' }
  const hexOnly = t.replace(/0x/gi, '').replace(/\\x/gi, '').replace(/[\s,:-]/g, '')
  if (/^[0-9a-f]+$/i.test(hexOnly) && (hexOnly.length % 2 === 0) && !(tokens.length > 1 && tokens.every((x) => /^\d{1,3}$/.test(x) && x.length !== 2))) {
    return { bytes: Uint8Array.from(hexOnly.match(/../g)!, (x) => parseInt(x, 16)), fmt: 'hex' }
  }
  if (tokens.every((x) => /^\d{1,3}$/.test(x) && Number(x) < 256)) return { bytes: Uint8Array.from(tokens, Number), fmt: 'decimal' }
  return { error: 'expected hex (48 65 6c…), binary (01001000 …) or decimal bytes (72 101 …)' }
}

function BytesText() {
  const [raw, setRaw] = usePersistent('base:bytes', '48 65 6c 6c 6f 2c 20 f0 9f 8c 8e')
  const p = useMemo(() => parseBytes(raw), [raw])
  const ok = p && 'bytes' in p ? p : null
  const text = ok ? new TextDecoder().decode(ok.bytes) : ''
  return (
    <Pane title="bytes → text" actions={ok ? <Badge tone="info">read as {ok.fmt}</Badge> : p && 'error' in p ? <Badge tone="err">✗ can’t parse</Badge> : null}>
      <div className="grid gap-3 p-3 lg:grid-cols-2">
        <textarea className="input text-[12.5px]" rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} placeholder="48 65 6c 6c 6f  or  01001000 01101001  or  72 105" />
        <div className="flex flex-col gap-1.5">
          {p && 'error' in p && <div className="text-[12px] text-err">{p.error}</div>}
          {ok && (
            <>
              <Row k="utf-8" v={text} warn={!isPrintable(text)} />
              <Row k="hex" v={toHex(ok.bytes)} />
              <Row k="base64" v={bytesToB64(ok.bytes)} />
              <Row k="length" v={`${ok.bytes.length} bytes`} />
              <div className="text-[11px] text-faint">for text → hex/binary, use the Unicode tool’s “as bytes” panel</div>
            </>
          )}
        </div>
      </div>
    </Pane>
  )
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-[12.5px]">
      <span className="w-14 shrink-0 text-dim">{k}</span>
      <span className={cx('min-w-0 flex-1 break-all whitespace-pre-wrap', warn ? 'text-warn' : 'text-accent-soft')}>{v || '-'}</span>
      <CopyBtn text={v} />
    </div>
  )
}

