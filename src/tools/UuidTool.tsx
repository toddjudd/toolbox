import { useCallback, useEffect, useMemo, useState } from 'react'
import { Editor } from '../components/Editor'
import { Badge, Btn, CopyBtn, Empty, KV, Pane, Seg, Toggle } from '../components/ui'
import { usePersistent } from '../lib/store'
import { nanoid, ulid, ulidTime, uuidv4, uuidv7 } from '../lib/ids'

type Kind = 'v4' | 'v7' | 'ulid' | 'nanoid'

function inspect(raw: string) {
  const s = raw.trim()
  if (!s) return null
  const hex = s.replace(/^[{(]|[})]$/g, '').replace(/-/g, '')
  if (/^[0-9a-f]{32}$/i.test(hex)) {
    const h = hex.toLowerCase()
    const version = parseInt(h[12], 16)
    const vbits = parseInt(h[16], 16)
    const variant = vbits >> 3 === 0 ? 'NCS (reserved)' : vbits >> 2 === 2 ? 'RFC 9562 / 4122' : vbits >> 1 === 6 ? 'Microsoft (reserved)' : 'future (reserved)'
    let time: number | null = null
    if (version === 7) time = parseInt(h.slice(0, 12), 16)
    else if (version === 1 || version === 6) {
      const t =
        version === 1
          ? (BigInt('0x' + h.slice(13, 16)) << 48n) | (BigInt('0x' + h.slice(8, 12)) << 32n) | BigInt('0x' + h.slice(0, 8))
          : (BigInt('0x' + h.slice(0, 12)) << 12n) | BigInt('0x' + h.slice(13, 16))
      time = Number(t / 10000n) - 12219292800000
    }
    const nil = /^0+$/.test(h)
    const max = /^f+$/.test(h)
    const desc: Record<number, string> = {
      1: 'time-based (MAC address)',
      2: 'DCE security',
      3: 'name-based (MD5)',
      4: 'random',
      5: 'name-based (SHA-1)',
      6: 'reordered time',
      7: 'unix-time ordered',
      8: 'custom',
    }
    return {
      kind: 'uuid' as const,
      canonical: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`,
      version: nil ? 'nil' : max ? 'max' : `v${version} · ${desc[version] ?? 'unknown'}`,
      variant,
      time,
    }
  }
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(s)) return { kind: 'ulid' as const, canonical: s.toUpperCase(), version: 'ULID', variant: 'Crockford base32', time: ulidTime(s) }
  return { kind: 'err' as const }
}

export default function UuidTool() {
  const [kind, setKind] = usePersistent<Kind>('uuid:kind', 'v4')
  const [count, setCount] = usePersistent('uuid:count', 5)
  const [upper, setUpper] = usePersistent('uuid:upper', false)
  const [hyphens, setHyphens] = usePersistent('uuid:hyphens', true)
  const [braces, setBraces] = usePersistent('uuid:braces', false)
  const [nanoLen, setNanoLen] = usePersistent('uuid:nanolen', 21)
  const [ids, setIds] = useState<string[]>([])
  const [inspectRaw, setInspectRaw] = usePersistent('uuid:inspect', '')

  const generate = useCallback(() => {
    const n = Math.max(1, Math.min(1000, count || 1))
    setIds(Array.from({ length: n }, () => (kind === 'v4' ? uuidv4() : kind === 'v7' ? uuidv7() : kind === 'ulid' ? ulid() : nanoid(nanoLen))))
  }, [kind, count, nanoLen])

  useEffect(generate, [generate])

  const isUuid = kind === 'v4' || kind === 'v7'
  const formatted = ids
    .map((id) => {
      let s = id
      if (isUuid && !hyphens) s = s.replace(/-/g, '')
      if (isUuid && upper) s = s.toUpperCase()
      if (isUuid && braces) s = `{${s}}`
      return s
    })
    .join('\n')

  const info = useMemo(() => inspect(inspectRaw), [inspectRaw])

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Pane
        title="generate"
        className="work-h"
        actions={
          <>
            <Btn variant="primary" onClick={generate}>
              ↻ regenerate
            </Btn>
            <CopyBtn text={formatted} label={ids.length > 1 ? `copy ${ids.length}` : 'copy'} />
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Seg
              value={kind}
              onChange={setKind}
              options={[
                { value: 'v4', label: 'UUID v4', title: 'random' },
                { value: 'v7', label: 'UUID v7', title: 'time-ordered, great for DB keys' },
                { value: 'ulid', label: 'ULID' },
                { value: 'nanoid', label: 'nanoid' },
              ]}
            />
            <label className="flex items-center gap-2 text-[12px] text-dim">
              count
              <input type="number" min={1} max={1000} className="input w-20" value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </label>
            {isUuid ? (
              <>
                <Toggle checked={upper} onChange={setUpper} label="UPPER" />
                <Toggle checked={hyphens} onChange={setHyphens} label="hyphens" />
                <Toggle checked={braces} onChange={setBraces} label="{braces}" />
              </>
            ) : kind === 'nanoid' ? (
              <label className="flex items-center gap-2 text-[12px] text-dim">
                length
                <input type="number" min={4} max={64} className="input w-20" value={nanoLen} onChange={(e) => setNanoLen(Number(e.target.value))} />
              </label>
            ) : null}
          </div>
        }
      >
        <Editor value={formatted} readOnly />
      </Pane>

      <Pane title="inspect" actions={info && info.kind !== 'err' ? <Badge tone="ok">✓ valid</Badge> : info ? <Badge tone="err">✗ not a UUID/ULID</Badge> : null}>
        <div className="p-3">
          <input
            className="input"
            value={inspectRaw}
            onChange={(e) => setInspectRaw(e.target.value)}
            placeholder="paste a UUID or ULID…"
            spellCheck={false}
          />
        </div>
        {!info ? (
          <Empty>version, variant & embedded timestamp</Empty>
        ) : info.kind === 'err' ? null : (
          <div className="border-t border-line">
            <KV k="canonical" v={info.canonical} />
            <KV k="version" v={info.version} mono={false} />
            <KV k="variant" v={info.variant} mono={false} />
            {info.time != null && (
              <>
                <KV k="timestamp" v={new Date(info.time).toISOString()} />
                <KV k="unix ms" v={String(info.time)} />
              </>
            )}
            <div className="p-3">
              <Btn variant="ghost" onClick={() => setInspectRaw(ids[0] ?? '')} disabled={!ids.length}>
                inspect the first generated id
              </Btn>
            </div>
          </div>
        )}
      </Pane>
    </div>
  )
}
