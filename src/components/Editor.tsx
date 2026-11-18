import CodeMirror from '@uiw/react-codemirror'
import { Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { json } from '@codemirror/lang-json'
import { tags as t } from '@lezer/highlight'
import { useMemo } from 'react'
import { cx } from './ui'

const greenTheme = EditorView.theme(
  {
    '&': { color: 'var(--color-fg)', backgroundColor: 'transparent', fontSize: '12.5px' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65' },
    '.cm-content': { caretColor: 'var(--color-accent)', padding: '10px 0' },
    '.cm-line': { padding: '0 12px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)', borderLeftWidth: '2px' },
    '&.cm-focused .cm-cursor': { boxShadow: '0 0 6px color-mix(in srgb, var(--color-accent) 80%, transparent)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--color-accent) 20%, transparent) !important',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--color-faint)',
      border: 'none',
      borderRight: '1px solid var(--color-line)',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-accent-soft)' },
    '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--color-accent) 3.5%, transparent)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-placeholder': { color: 'var(--color-faint)' },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--color-panel-2)',
      border: '1px solid var(--color-line-2)',
      color: 'var(--color-dim)',
      padding: '0 6px',
    },
    '.cm-foldGutter .cm-gutterElement': { color: 'var(--color-faint)' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
      outline: '1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)',
    },
    '.cm-selectionMatch': { backgroundColor: 'rgba(92,225,255,.12)' },
    '.cm-searchMatch': { backgroundColor: 'rgba(255,209,102,.25)', outline: '1px solid rgba(255,209,102,.6)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)' },
    '.cm-panels': { backgroundColor: 'var(--color-panel-2)', color: 'var(--color-fg)', borderColor: 'var(--color-line)' },
    '.cm-panels input, .cm-panels button': { fontFamily: 'var(--font-mono)' },
    '.cm-tooltip': { backgroundColor: 'var(--color-panel-2)', border: '1px solid var(--color-line-2)' },
  },
  { dark: true },
)

const greenHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'var(--color-info)' },
  { tag: t.string, color: 'var(--color-accent-soft)' },
  { tag: [t.number, t.integer, t.float], color: 'var(--color-warn)' },
  { tag: [t.bool, t.null, t.atom], color: 'var(--color-violet)' },
  { tag: [t.punctuation, t.separator, t.brace, t.squareBracket], color: 'var(--color-dim)' },
  { tag: t.keyword, color: 'var(--color-violet)' },
  { tag: t.comment, color: 'var(--color-faint)', fontStyle: 'italic' },
  { tag: t.invalid, color: 'var(--color-err)' },
])

const baseTheme: Extension = [greenTheme, syntaxHighlighting(greenHighlight)]

const markCache = new Map<string, Decoration>()
const mark = (cls: string) => {
  let d = markCache.get(cls)
  if (!d) markCache.set(cls, (d = Decoration.mark({ class: cls })))
  return d
}

export type MarkRange = { from: number; to: number; cls: string }

/** Highlights arbitrary (non-overlapping or nested-sorted) ranges. Clamped to doc length. */
export function markRanges(ranges: MarkRange[]): Extension {
  const sorted = [...ranges].sort((a, b) => a.from - b.from || b.to - a.to)
  return EditorView.decorations.of((view) => {
    const len = view.state.doc.length
    const b = new RangeSetBuilder<Decoration>()
    let last = -1
    for (const r of sorted) {
      const from = Math.max(Math.min(r.from, len), last)
      const to = Math.min(r.to, len)
      if (to > from) {
        b.add(from, to, mark(r.cls))
        last = to
      }
    }
    return b.finish()
  })
}

export function markLine(lineNo: number, cls: string): Extension {
  return EditorView.decorations.of((view) => {
    const b = new RangeSetBuilder<Decoration>()
    if (lineNo >= 1 && lineNo <= view.state.doc.lines) {
      const line = view.state.doc.line(lineNo)
      b.add(line.from, line.from, Decoration.line({ class: cls }))
    }
    return b.finish()
  })
}

type Props = {
  value: string
  onChange?: (v: string) => void
  lang?: 'json'
  readOnly?: boolean
  placeholder?: string
  extensions?: Extension[]
  wrap?: boolean
  lineNumbers?: boolean
  autoHeight?: boolean
  autoFocus?: boolean
  className?: string
}

export function Editor({
  value,
  onChange,
  lang,
  readOnly,
  placeholder,
  extensions,
  wrap,
  lineNumbers = true,
  autoHeight,
  autoFocus,
  className,
}: Props) {
  const exts = useMemo(
    () => [...(lang === 'json' ? [json()] : []), ...(wrap ? [EditorView.lineWrapping] : []), ...(extensions ?? [])],
    [lang, wrap, extensions],
  )
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      theme={baseTheme}
      extensions={exts}
      height={autoHeight ? undefined : '100%'}
      autoFocus={autoFocus}
      className={cx(!autoHeight && 'h-full', className)}
      basicSetup={{
        lineNumbers,
        foldGutter: lang === 'json',
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        autocompletion: false,
        closeBrackets: lang === 'json' && !readOnly,
        highlightSelectionMatches: true,
        searchKeymap: true,
      }}
    />
  )
}
