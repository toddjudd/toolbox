/// <reference lib="webworker" />
// Runs regexes off the main thread so catastrophic backtracking can't freeze the page.

export type RegexReq = { id: number; pattern: string; flags: string; text: string; replace: string | null }
export type Match = { index: number; end: number; text: string; groups: (string | undefined)[]; named: Record<string, string | undefined> | null }
export type RegexRes =
  | { id: number; ok: true; matches: Match[]; truncated: boolean; replaced: string | null; groupNames: string[]; ms: number }
  | { id: number; ok: false; error: string }

const MAX = 5000

/** Name (or "") of each capture group, in order. */
function captureNames(p: string) {
  const names: string[] = []
  let inClass = false
  for (let i = 0; i < p.length; i++) {
    const c = p[i]
    if (c === '\\') {
      i++
      continue
    }
    if (inClass) {
      if (c === ']') inClass = false
      continue
    }
    if (c === '[') inClass = true
    else if (c === '(') {
      if (p[i + 1] !== '?') names.push('')
      else if (p[i + 2] === '<' && p[i + 3] !== '=' && p[i + 3] !== '!') names.push(p.slice(i + 3, p.indexOf('>', i)))
    }
  }
  return names
}

self.onmessage = (e: MessageEvent<RegexReq>) => {
  const { id, pattern, flags, text, replace } = e.data
  const t0 = performance.now()
  try {
    const user = new RegExp(pattern, flags)
    const global = flags.includes('g')
    const re = new RegExp(pattern, global ? flags : flags + 'g')
    const unicode = flags.includes('u') || flags.includes('v')
    const matches: Match[] = []
    let truncated = false
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      matches.push({ index: m.index, end: m.index + m[0].length, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : null })
      if (m[0].length === 0) {
        const cp = unicode ? text.codePointAt(re.lastIndex) : undefined
        re.lastIndex += cp !== undefined && cp > 0xffff ? 2 : 1
      }
      if (!global) break
      if (matches.length >= MAX) {
        truncated = true
        break
      }
    }
    const groupNames = captureNames(pattern)
    const replaced = replace == null ? null : text.replace(user, replace)
    const res: RegexRes = { id, ok: true, matches, truncated, replaced, groupNames, ms: performance.now() - t0 }
    self.postMessage(res)
  } catch (err) {
    const res: RegexRes = { id, ok: false, error: (err as Error).message }
    self.postMessage(res)
  }
}
