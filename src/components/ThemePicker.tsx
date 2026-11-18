import { useEffect, useRef, useState } from 'react'
import { usePersistent } from '../lib/store'
import { DEFAULT_ACCENT, PRESETS, isHex } from '../lib/theme'
import { Btn, Toggle, cx } from './ui'

export function ThemePicker({ onClose }: { onClose: () => void }) {
  const [accent, setAccent] = usePersistent('ui:accent', DEFAULT_ACCENT)
  const [crt, setCrt] = usePersistent('ui:crt', false)
  const [draft, setDraft] = useState(accent)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setDraft(accent), [accent])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (!ref.current?.contains(el) && !el.closest('[data-theme-trigger]')) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed right-3 bottom-9 z-50 w-72 rounded-xl border border-line-2 bg-panel p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,.9),0_0_40px_-18px_var(--color-accent)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="label">theme color</span>
        <button className="text-faint hover:text-fg" onClick={onClose} aria-label="close">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-9 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.hex}
            title={p.name}
            onClick={() => setAccent(p.hex)}
            className={cx(
              'aspect-square rounded-md border transition hover:scale-110',
              accent.toLowerCase() === p.hex ? 'border-fg ring-1 ring-fg/60' : 'border-transparent',
            )}
            style={{ background: p.hex, boxShadow: `0 0 10px -3px ${p.hex}` }}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="relative h-8 w-10 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line-2" style={{ background: accent }} title="pick any color">
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <input
          className="input font-mono"
          value={draft}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value.trim()
            setDraft(v)
            const hex = v.startsWith('#') ? v : '#' + v
            if (isHex(hex)) setAccent(hex.toLowerCase())
          }}
        />
        <Btn variant="ghost" onClick={() => setAccent(DEFAULT_ACCENT)} title="reset to phosphor green">
          reset
        </Btn>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <Toggle checked={crt} onChange={setCrt} label="CRT scanlines" />
        <span className="text-[10.5px] text-faint">Ctrl K → “theme”</span>
      </div>
    </div>
  )
}
