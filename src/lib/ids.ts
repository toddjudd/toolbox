const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

export function fmtUuid(b: Uint8Array) {
  const h = hex(b)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function uuidv4() {
  return crypto.randomUUID()
}

let lastMs = 0
let seq = 0
/** RFC 9562 UUIDv7, monotonic within the same millisecond via a 12-bit counter. */
export function uuidv7() {
  const b = crypto.getRandomValues(new Uint8Array(16))
  let ms = Date.now()
  if (ms <= lastMs) {
    seq++
    if (seq > 0xfff) {
      lastMs++
      seq = 0
    }
    ms = lastMs
  } else {
    lastMs = ms
    seq = b[6] & 0x07 // random start, leaves headroom
  }
  const t = BigInt(ms)
  for (let i = 0; i < 6; i++) b[i] = Number((t >> BigInt(8 * (5 - i))) & 0xffn)
  b[6] = 0x70 | ((seq >> 8) & 0x0f)
  b[7] = seq & 0xff
  b[8] = (b[8] & 0x3f) | 0x80
  return fmtUuid(b)
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export function ulid() {
  let ms = Date.now()
  let time = ''
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[ms % 32] + time
    ms = Math.floor(ms / 32)
  }
  const r = crypto.getRandomValues(new Uint8Array(16))
  let rand = ''
  for (let i = 0; i < 16; i++) rand += CROCKFORD[r[i] & 31]
  return time + rand
}

export function ulidTime(id: string) {
  let ms = 0
  for (const c of id.slice(0, 10).toUpperCase()) {
    const v = CROCKFORD.indexOf(c)
    if (v < 0) return null
    ms = ms * 32 + v
  }
  return ms
}

const NANO = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'
export function nanoid(size = 21) {
  const r = crypto.getRandomValues(new Uint8Array(size))
  let id = ''
  for (let i = 0; i < size; i++) id += NANO[r[i] & 63]
  return id
}
