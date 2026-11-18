import { useEffect, useMemo, useState } from 'react'
import { Editor } from '../components/Editor'
import { Badge, Btn, CopyBtn, Pane, Seg, Toggle } from '../components/ui'
import { usePersistent } from '../lib/store'
import { b64ToBytes, bytesToB64, enc, fmtBytes, hexdump, isPrintable, utf8Strict } from '../lib/format'

type Mode = 'auto' | 'encode' | 'decode'
type FileRes = { name: string; size: number; type: string; b64: string }

function sniffImage(b: Uint8Array): string | null {
  const s = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x)
  if (s(0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (s(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (s(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  if (s(0, 0x52, 0x49, 0x46, 0x46) && s(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'
  if (s(0, 0x3c, 0x73, 0x76, 0x67) || s(0, 0x3c, 0x3f, 0x78, 0x6d, 0x6c)) return 'image/svg+xml'
  return null
}

export default function Base64Tool() {
  const [input, setInput] = usePersistent('base64:input', '')
  const [mode, setMode] = usePersistent<Mode>('base64:mode', 'auto')
  const [urlSafe, setUrlSafe] = usePersistent('base64:urlsafe', false)
  const [view, setView] = usePersistent<'text' | 'hex'>('base64:view', 'text')
  const [file, setFile] = useState<FileRes | null>(null)
  const [dataUri, setDataUri] = useState(false)
  const [drag, setDrag] = useState(false)

  const res = useMemo(() => {
    const compact = input.replace(/\s+/g, '')
    let decoded: { bytes: Uint8Array; text: string | null } | null = null
    let decodeErr: string | null = null
    if (compact) {
      try {
        const bytes = b64ToBytes(compact)
        decoded = { bytes, text: utf8Strict(bytes) }
      } catch (e) {
        decodeErr = (e as Error).message
      }
    }
    const looksB64 = !!decoded && compact.length >= 4 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)
    const dir: 'encode' | 'decode' =
      mode === 'auto' ? (looksB64 && (sniffImage(decoded!.bytes) || (decoded!.text != null && isPrintable(decoded!.text))) ? 'decode' : 'encode') : mode
    if (dir === 'encode') return { dir, out: input ? bytesToB64(enc.encode(input), urlSafe) : '', bytes: null, error: null, image: null }
    if (!decoded) return { dir, out: '', bytes: null, error: decodeErr, image: null }
    const image = sniffImage(decoded.bytes)
    const asText = decoded.text != null && view === 'text'
    return {
      dir,
      out: asText ? decoded.text! : hexdump(decoded.bytes),
      bytes: decoded.bytes,
      error: null,
      image,
      binary: decoded.text == null,
    }
  }, [input, mode, urlSafe, view])

  const imgUrl = useMemo(() => (res.image && res.bytes ? URL.createObjectURL(new Blob([res.bytes as Uint8Array<ArrayBuffer>], { type: res.image })) : null), [res])
  useEffect(() => () => void (imgUrl && URL.revokeObjectURL(imgUrl)), [imgUrl])

  const readFile = (f: File) => {
    const r = new FileReader()
    r.onload = () => setFile({ name: f.name, size: f.size, type: f.type || 'application/octet-stream', b64: bytesToB64(new Uint8Array(r.result as ArrayBuffer), urlSafe) })
    r.readAsArrayBuffer(f)
  }

  const fileOut = file ? (dataUri ? `data:${file.type};base64,${file.b64}` : file.b64) : ''

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Seg value={mode} onChange={setMode} options={['auto', 'encode', 'decode'] as const} />
        <Toggle checked={urlSafe} onChange={setUrlSafe} label="url-safe (base64url)" title="- and _ instead of + and /, no padding" />
        {res.dir === 'decode' && <Seg value={view} onChange={setView} options={[{ value: 'text', label: 'utf-8' }, { value: 'hex', label: 'hexdump' }]} />}
        <div className="flex-1" />
        <label className="btn cursor-pointer">
          ⇪ encode a file
          <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
        </label>
        <Btn
          disabled={!res.out || !!res.bytes?.length && res.binary}
          onClick={() => {
            setInput(res.out)
            setMode(res.dir === 'encode' ? 'decode' : 'encode')
          }}
        >
          ⇄ swap
        </Btn>
        <Btn variant="ghost" onClick={() => setInput('')}>
          clear
        </Btn>
      </div>

      {file && (
        <Pane
          title={`file → base64 · ${file.name}`}
          actions={
            <>
              <span className="text-[11px] text-faint">
                {fmtBytes(file.size)} → {fmtBytes(fileOut.length)}
              </span>
              <Toggle checked={dataUri} onChange={setDataUri} label="data URI" />
              <CopyBtn text={fileOut} />
              <Btn variant="ghost" onClick={() => setFile(null)}>
                ✕
              </Btn>
            </>
          }
        >
          <div className="max-h-40 overflow-auto p-3 text-[11.5px] break-all text-dim">
            {fileOut.slice(0, 20000)}
            {fileOut.length > 20000 && <span className="text-faint"> … ({fileOut.length - 20000} more chars, use copy)</span>}
          </div>
        </Pane>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div
          className="contents"
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            const f = e.dataTransfer.files?.[0]
            if (f) readFile(f)
          }}
        >
          <Pane
            title="input"
            className={drag ? 'work-h border-accent!' : 'work-h'}
            actions={
              <>
                {mode === 'auto' && input && <Badge tone="info">auto: {res.dir}</Badge>}
                <span className="text-[11px] text-faint">{fmtBytes(enc.encode(input).length)}</span>
              </>
            }
          >
            <Editor value={input} onChange={setInput} wrap placeholder="text to encode, or base64 to decode… (or drop a file)" autoFocus />
          </Pane>
        </div>
        <Pane
          title={res.dir === 'encode' ? 'base64' : res.binary ? 'decoded (binary)' : 'decoded'}
          className="work-h"
          actions={
            <>
              {res.error && <Badge tone="err">✗ {res.error}</Badge>}
              {res.bytes && <span className="text-[11px] text-faint">{fmtBytes(res.bytes.length)}</span>}
              {res.image && <Badge tone="info">{res.image}</Badge>}
              <CopyBtn text={res.out} />
            </>
          }
        >
          {imgUrl ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
              <img src={imgUrl} alt="decoded" className="max-h-[70%] max-w-full rounded border border-line-2 bg-[repeating-conic-gradient(#0e1811_0_25%,#0a110c_0_50%)] bg-[length:16px_16px]" />
              <a href={imgUrl} download={`decoded.${res.image!.split('/')[1].replace('+xml', '')}`} className="btn">
                ⇩ download
              </a>
            </div>
          ) : (
            <Editor value={res.out} readOnly wrap={res.dir === 'encode' || view === 'text'} lineNumbers={res.dir === 'decode'} />
          )}
        </Pane>
      </div>
    </div>
  )
}
