import { useEffect, useMemo, useState } from 'react'
import { Editor, markRanges } from '../components/Editor'
import { Badge, Btn, CopyBtn, Empty, Pane, Toggle } from '../components/ui'
import { usePersistent } from '../lib/store'
import { useNow } from '../lib/hooks'
import { b64ToBytes, bytesToB64, dec, enc, fmtDuration, relTime } from '../lib/format'

type Json = Record<string, unknown>
type Decoded = { kind: 'empty' } | { kind: 'err'; error: string } | { kind: 'ok'; header: Json; payload: Json; sigBytes: number }

function decodeJwt(t: string): Decoded {
  if (!t) return { kind: 'empty' }
  const parts = t.split('.')
  if (parts.length === 5) return { kind: 'err', error: 'This is a JWE (encrypted token, 5 parts). Its payload can’t be read without the decryption key.' }
  if (parts.length !== 3) return { kind: 'err', error: `Expected 3 dot-separated parts, got ${parts.length}` }
  const part = (s: string, name: string) => {
    let txt: string
    try {
      txt = dec.decode(b64ToBytes(s))
    } catch {
      throw new Error(`${name} is not valid base64url`)
    }
    try {
      return JSON.parse(txt) as Json
    } catch {
      throw new Error(`${name} is not valid JSON`)
    }
  }
  try {
    return { kind: 'ok', header: part(parts[0], 'Header'), payload: part(parts[1], 'Payload'), sigBytes: b64ToBytes(parts[2]).length }
  } catch (e) {
    return { kind: 'err', error: (e as Error).message }
  }
}

type AlgSpec = { kind: 'hmac' | 'rsa' | 'pss' | 'ec'; hash: string; curve?: string; bytes: number }
const ALGS: Record<string, AlgSpec> = {
  HS256: { kind: 'hmac', hash: 'SHA-256', bytes: 32 },
  HS384: { kind: 'hmac', hash: 'SHA-384', bytes: 48 },
  HS512: { kind: 'hmac', hash: 'SHA-512', bytes: 64 },
  RS256: { kind: 'rsa', hash: 'SHA-256', bytes: 32 },
  RS384: { kind: 'rsa', hash: 'SHA-384', bytes: 48 },
  RS512: { kind: 'rsa', hash: 'SHA-512', bytes: 64 },
  PS256: { kind: 'pss', hash: 'SHA-256', bytes: 32 },
  PS384: { kind: 'pss', hash: 'SHA-384', bytes: 48 },
  PS512: { kind: 'pss', hash: 'SHA-512', bytes: 64 },
  ES256: { kind: 'ec', hash: 'SHA-256', curve: 'P-256', bytes: 32 },
  ES384: { kind: 'ec', hash: 'SHA-384', curve: 'P-384', bytes: 48 },
  ES512: { kind: 'ec', hash: 'SHA-512', curve: 'P-521', bytes: 64 },
}

async function verifyJwt(token: string, alg: string, keyText: string, secretB64: boolean, kid?: string) {
  const [h, p, s] = token.split('.')
  const data = enc.encode(`${h}.${p}`)
  const sig = b64ToBytes(s)
  const a = ALGS[alg]
  if (!a) throw new Error(`Algorithm "${alg}" isn’t supported here`)
  if (a.kind === 'hmac') {
    const raw = secretB64 ? b64ToBytes(keyText) : enc.encode(keyText)
    const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: a.hash }, false, ['verify'])
    return crypto.subtle.verify('HMAC', key, sig, data)
  }
  const importAlgo =
    a.kind === 'rsa' ? { name: 'RSASSA-PKCS1-v1_5', hash: a.hash } : a.kind === 'pss' ? { name: 'RSA-PSS', hash: a.hash } : { name: 'ECDSA', namedCurve: a.curve! }
  const kt = keyText.trim()
  let key: CryptoKey
  if (kt.startsWith('{')) {
    let jwk = JSON.parse(kt) as JsonWebKey & { keys?: (JsonWebKey & { kid?: string })[]; kid?: string }
    if (Array.isArray(jwk.keys)) {
      const found = jwk.keys.find((k) => kid && k.kid === kid) ?? jwk.keys[0]
      if (!found) throw new Error('JWKS has no keys')
      jwk = found
    }
    const { key_ops: _ops, ...clean } = jwk as JsonWebKey & { kid?: string }
    void _ops
    key = await crypto.subtle.importKey('jwk', clean, importAlgo, false, ['verify'])
  } else {
    if (/BEGIN (RSA )?PRIVATE KEY|BEGIN EC PRIVATE/.test(kt)) throw new Error('That’s a private key: paste the public key instead')
    if (/BEGIN RSA PUBLIC KEY/.test(kt)) throw new Error('PKCS#1 "RSA PUBLIC KEY" not supported: use SPKI "PUBLIC KEY" or a JWK')
    if (/BEGIN CERTIFICATE/.test(kt)) throw new Error('Certificates not supported yet: paste the public key (SPKI) or JWK')
    const der = b64ToBytes(kt.replace(/-----[^-]+-----/g, ''))
    key = await crypto.subtle.importKey('spki', der, importAlgo, false, ['verify'])
  }
  const verifyAlgo = a.kind === 'rsa' ? { name: 'RSASSA-PKCS1-v1_5' } : a.kind === 'pss' ? { name: 'RSA-PSS', saltLength: a.bytes } : { name: 'ECDSA', hash: a.hash }
  return crypto.subtle.verify(verifyAlgo, key, sig, data)
}

async function makeSample() {
  const secret = 'your-256-bit-secret'
  const iat = Math.floor(Date.now() / 1000)
  const b = (o: object) => bytesToB64(enc.encode(JSON.stringify(o)), true)
  const body = `${b({ alg: 'HS256', typ: 'JWT' })}.${b({
    iss: 'https://auth.example.com',
    sub: 'user_42',
    aud: 'api.example.com',
    name: 'Ada Lovelace',
    roles: ['admin', 'billing'],
    iat,
    nbf: iat,
    exp: iat + 3600,
  })}`
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)))
  return { token: `${body}.${bytesToB64(sig, true)}`, secret }
}

const CLAIMS: Record<string, string> = {
  iss: 'issuer',
  sub: 'subject',
  aud: 'audience',
  exp: 'expires',
  nbf: 'not before',
  iat: 'issued at',
  jti: 'token id',
  azp: 'authorized party',
  scope: 'scope',
  scp: 'scopes',
  sid: 'session id',
  auth_time: 'auth time',
  nonce: 'nonce',
  email: 'email',
  name: 'name',
  roles: 'roles',
  alg: 'algorithm',
  typ: 'type',
  kid: 'key id',
  cty: 'content type',
}
const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat', 'auth_time', 'updated_at'])
const PART_CLS = ['cm-jwt-h', 'cm-jwt-p', 'cm-jwt-s']

export default function JwtTool() {
  const [token, setToken] = usePersistent('jwt:input', '')
  const [key, setKey] = useState('') // never persisted
  const [keyB64, setKeyB64] = useState(false)
  const [ver, setVer] = useState<{ state: 'idle' | 'ok' | 'bad' | 'err'; msg?: string }>({ state: 'idle' })
  const now = useNow(1000)

  const t = token.trim().replace(/^Bearer\s+/i, '')
  const d = useMemo(() => decodeJwt(t), [t])
  const marks = useMemo(() => {
    const start = token.indexOf(t)
    let off = start
    const ranges = t
      .split('.')
      .slice(0, 3)
      .map((p, i) => {
        const r = { from: off, to: off + p.length, cls: PART_CLS[i] }
        off += p.length + 1
        return r
      })
    return [markRanges(ranges)]
  }, [token, t])

  const alg = d.kind === 'ok' ? String(d.header.alg ?? '') : ''
  const spec = ALGS[alg]
  const kid = d.kind === 'ok' && typeof d.header.kid === 'string' ? d.header.kid : undefined

  useEffect(() => {
    if (d.kind !== 'ok' || !key.trim()) {
      setVer({ state: 'idle' })
      return
    }
    let cancelled = false
    verifyJwt(t, alg, key, keyB64, kid)
      .then((ok) => !cancelled && setVer({ state: ok ? 'ok' : 'bad' }))
      .catch((e: Error) => !cancelled && setVer({ state: 'err', msg: e.message }))
    return () => {
      cancelled = true
    }
  }, [t, alg, key, keyB64, kid, d.kind])

  const payload = d.kind === 'ok' ? d.payload : null
  const exp = typeof payload?.exp === 'number' ? payload.exp * 1000 : null
  const nbf = typeof payload?.nbf === 'number' ? payload.nbf * 1000 : null
  const iat = typeof payload?.iat === 'number' ? payload.iat * 1000 : null

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        <Pane
          title="encoded token"
          className="h-72 lg:h-[22rem]"
          actions={
            <>
              <Btn
                variant="ghost"
                onClick={async () => {
                  const s = await makeSample()
                  setToken(s.token)
                  setKey(s.secret)
                  setKeyB64(false)
                }}
              >
                sample
              </Btn>
              <Btn variant="ghost" onClick={() => setToken('')}>
                clear
              </Btn>
              <CopyBtn text={t} />
            </>
          }
          footer={
            <span className="flex gap-3 text-[11px]">
              <span className="cm-jwt-h">■ header</span>
              <span className="cm-jwt-p">■ payload</span>
              <span className="cm-jwt-s">■ signature</span>
              {d.kind === 'ok' && <span className="ml-auto text-faint">{d.sigBytes} byte signature</span>}
            </span>
          }
        >
          <Editor value={token} onChange={setToken} wrap lineNumbers={false} extensions={marks} placeholder="Paste a JWT (eyJ…). A leading 'Bearer ' is fine." autoFocus />
        </Pane>

        <Pane
          title="verify signature"
          actions={
            ver.state === 'ok' ? (
              <Badge tone="ok">✓ signature verified</Badge>
            ) : ver.state === 'bad' ? (
              <Badge tone="err">✗ invalid signature</Badge>
            ) : ver.state === 'err' ? (
              <Badge tone="warn">⚠ key error</Badge>
            ) : (
              <Badge>not checked</Badge>
            )
          }
        >
          <div className="flex flex-col gap-2 p-3">
            <p className="text-[11.5px] text-dim">
              {!alg
                ? 'Paste a token first.'
                : alg === 'none'
                  ? '⚠ alg "none": this token is unsigned. Never accept it server-side.'
                  : !spec
                    ? `Algorithm ${alg} can’t be verified here.`
                    : spec.kind === 'hmac'
                      ? `${alg}: enter the shared secret.`
                      : `${alg}: paste the public key (PEM / SPKI), a JWK, or a whole JWKS${kid ? ` (matches kid "${kid}")` : ''}.`}
            </p>
            <textarea
              className="input font-mono text-[12px]"
              rows={spec && spec.kind !== 'hmac' ? 6 : 2}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={spec && spec.kind !== 'hmac' ? '-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----   or   {"kty":"RSA",…}' : 'your-256-bit-secret'}
              spellCheck={false}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {spec?.kind === 'hmac' ? <Toggle checked={keyB64} onChange={setKeyB64} label="secret is base64-encoded" /> : <span />}
              <span className="text-[10.5px] text-faint">keys stay in memory only: never saved, never sent</span>
            </div>
            {ver.state === 'err' && <p className="text-[11.5px] text-warn">{ver.msg}</p>}
          </div>
        </Pane>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {d.kind === 'empty' && (
          <Pane title="decoded">
            <Empty>paste a token, or hit “sample”</Empty>
          </Pane>
        )}
        {d.kind === 'err' && (
          <Pane title="decoded">
            <div className="p-4 text-[12.5px] text-err">✗ {d.error}</div>
          </Pane>
        )}
        {d.kind === 'ok' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={alg === 'none' ? 'err' : 'info'}>alg {alg || '?'}</Badge>
              {typeof d.header.typ === 'string' && <Badge>typ {d.header.typ}</Badge>}
              {exp == null ? (
                <Badge tone="warn">no exp: never expires</Badge>
              ) : exp < now ? (
                <Badge tone="err">✗ expired {relTime(exp, now)}</Badge>
              ) : nbf && nbf > now ? (
                <Badge tone="warn">not valid until {relTime(nbf, now)}</Badge>
              ) : (
                <Badge tone="ok">✓ valid · expires {relTime(exp, now)}</Badge>
              )}
              {exp && iat && <Badge>lifetime {fmtDuration(exp - iat, 2)}</Badge>}
            </div>
            <Pane title="header" actions={<CopyBtn text={JSON.stringify(d.header, null, 2)} />}>
              <Editor value={JSON.stringify(d.header, null, 2)} readOnly lang="json" lineNumbers={false} autoHeight />
            </Pane>
            <Pane title="payload" actions={<CopyBtn text={JSON.stringify(d.payload, null, 2)} />}>
              <Editor value={JSON.stringify(d.payload, null, 2)} readOnly lang="json" lineNumbers={false} autoHeight />
            </Pane>
            <Pane title="claims">
              <table className="tbl">
                <tbody>
                  {Object.entries(d.payload).map(([k, v]) => (
                    <tr key={k}>
                      <td className="w-28 whitespace-nowrap">
                        <span className="text-info">{k}</span>
                        {CLAIMS[k] && <div className="text-[10.5px] text-faint">{CLAIMS[k]}</div>}
                      </td>
                      <td className="break-all">
                        {TIME_CLAIMS.has(k) && typeof v === 'number' ? (
                          <>
                            <div>{new Date(v * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'long' })}</div>
                            <div className="text-[11px] text-faint">
                              {relTime(v * 1000, now)} · {new Date(v * 1000).toISOString()} · {v}
                            </div>
                          </>
                        ) : typeof v === 'string' ? (
                          <span className="text-accent-soft">{v}</span>
                        ) : (
                          <span className="text-warn">{JSON.stringify(v)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Pane>
          </>
        )}
      </div>
    </div>
  )
}
