export type Token = { t: string; d: string; depth: number; kind: 'group' | 'class' | 'quant' | 'anchor' | 'escape' | 'literal' | 'alt' | 'err' }

const ESC: Record<string, string> = {
  d: 'digit 0-9',
  D: 'not a digit',
  w: 'word char [A-Za-z0-9_]',
  W: 'not a word char',
  s: 'whitespace',
  S: 'not whitespace',
  b: 'word boundary',
  B: 'not a word boundary',
  n: 'newline',
  r: 'carriage return',
  t: 'tab',
  f: 'form feed',
  v: 'vertical tab',
  '0': 'null char',
}

const SPECIAL = '\\[](){}*+?^$.|'

/** Very small regex tokenizer that explains a pattern in plain English. */
export function explain(p: string): Token[] {
  const out: Token[] = []
  let i = 0
  let depth = 0
  let group = 0
  const push = (t: string, d: string, kind: Token['kind'], dp = depth) => out.push({ t, d, depth: dp, kind })

  while (i < p.length) {
    const c = p[i]
    if (c === '\\') {
      const n = p[i + 1]
      if (n === undefined) {
        push('\\', 'trailing backslash (error)', 'err')
        i++
      } else if ((n === 'p' || n === 'P') && p[i + 2] === '{') {
        const e = p.indexOf('}', i)
        const t = p.slice(i, e + 1)
        push(t, `${n === 'P' ? 'NOT ' : ''}unicode property “${t.slice(3, -1)}”`, 'escape')
        i = e + 1
      } else if (n === 'k' && p[i + 2] === '<') {
        const e = p.indexOf('>', i)
        push(p.slice(i, e + 1), `same text as group “${p.slice(i + 3, e)}”`, 'escape')
        i = e + 1
      } else if (n === 'x') {
        push(p.slice(i, i + 4), `char 0x${p.slice(i + 2, i + 4)}`, 'escape')
        i += 4
      } else if (n === 'u') {
        if (p[i + 2] === '{') {
          const e = p.indexOf('}', i)
          push(p.slice(i, e + 1), `code point U+${p.slice(i + 3, e).toUpperCase()}`, 'escape')
          i = e + 1
        } else {
          push(p.slice(i, i + 6), `char U+${p.slice(i + 2, i + 6).toUpperCase()}`, 'escape')
          i += 6
        }
      } else if (n === 'c') {
        push(p.slice(i, i + 3), `control char ctrl-${p[i + 2]}`, 'escape')
        i += 3
      } else if (/[1-9]/.test(n)) {
        let j = i + 1
        while (/\d/.test(p[j] ?? '')) j++
        push(p.slice(i, j), `same text as group #${p.slice(i + 1, j)}`, 'escape')
        i = j
      } else {
        push('\\' + n, ESC[n] ?? `literal “${n}”`, ESC[n] ? 'escape' : 'literal')
        i += 2
      }
      continue
    }
    if (c === '[') {
      let j = i + 1
      if (p[j] === '^') j++
      if (p[j] === ']') j++
      while (j < p.length && p[j] !== ']') {
        if (p[j] === '\\') j++
        j++
      }
      const t = p.slice(i, j + 1)
      const neg = t[1] === '^'
      push(t, neg ? `any char NOT in: ${t.slice(2, -1)}` : `any one of: ${t.slice(1, -1)}`, 'class')
      i = j + 1
      continue
    }
    if (c === '(') {
      const look: [string, string][] = [
        ['(?:', 'group (non-capturing)'],
        ['(?=', 'lookahead: followed by'],
        ['(?!', 'negative lookahead: NOT followed by'],
        ['(?<=', 'lookbehind: preceded by'],
        ['(?<!', 'negative lookbehind: NOT preceded by'],
      ]
      const hit = look.find(([s]) => p.startsWith(s, i))
      let t: string
      let d: string
      if (hit) [t, d] = hit
      else if (p.startsWith('(?<', i)) {
        const e = p.indexOf('>', i)
        t = p.slice(i, e + 1)
        d = `capture group #${++group} named “${t.slice(3, -1)}”`
      } else {
        t = '('
        d = `capture group #${++group}`
      }
      push(t, d, 'group')
      depth++
      i += t.length
      continue
    }
    if (c === ')') {
      depth = Math.max(0, depth - 1)
      push(')', 'end group', 'group')
      i++
      continue
    }
    if (c === '*' || c === '+' || c === '?') {
      const lazy = p[i + 1] === '?'
      const base = c === '*' ? '0 or more times' : c === '+' ? '1 or more times' : 'optional (0 or 1)'
      push(c + (lazy ? '?' : ''), `↳ ${base}${lazy ? ', as few as possible (lazy)' : c === '?' ? '' : ', as many as possible'}`, 'quant')
      i += lazy ? 2 : 1
      continue
    }
    if (c === '{') {
      const m = /^\{(\d+)(,(\d*))?\}(\??)/.exec(p.slice(i))
      if (m) {
        const d = m[2] === undefined ? `exactly ${m[1]}` : m[3] === '' ? `${m[1]} or more` : `${m[1]} to ${m[3]}`
        push(m[0], `↳ ${d} times${m[4] ? ' (lazy)' : ''}`, 'quant')
        i += m[0].length
        continue
      }
    }
    if (c === '^') {
      push('^', 'start of string (or line with m flag)', 'anchor')
      i++
      continue
    }
    if (c === '$') {
      push('$', 'end of string (or line with m flag)', 'anchor')
      i++
      continue
    }
    if (c === '.') {
      push('.', 'any char except newline (incl. newline with s flag)', 'escape')
      i++
      continue
    }
    if (c === '|') {
      push('|', 'OR', 'alt', Math.max(0, depth - 0))
      i++
      continue
    }
    // literal run; leave the last char alone if a quantifier follows it
    let j = i
    while (j < p.length && !SPECIAL.includes(p[j])) j++
    if (j === i) j = i + 1
    if (j - i > 1 && '*+?{'.includes(p[j] ?? '')) j--
    push(p.slice(i, j), `literal “${p.slice(i, j)}”`, 'literal')
    i = j
  }
  return out
}
