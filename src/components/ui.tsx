import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { copy } from '../lib/format'

export function cx(...c: (string | false | null | undefined | 0)[]) {
  return c.filter(Boolean).join(' ')
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
}

export function Btn({ active, variant = 'default', className, type = 'button', ...p }: BtnProps) {
  return (
    <button
      type={type}
      {...p}
      className={cx(
        'btn',
        active && 'btn-active',
        variant === 'primary' && 'btn-primary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'danger' && 'btn-danger',
        className,
      )}
    />
  )
}

export function CopyBtn({
  text,
  label = 'copy',
  className,
  variant,
}: {
  text: string | (() => string)
  label?: ReactNode
  className?: string
  variant?: BtnProps['variant']
}) {
  const [done, setDone] = useState(false)
  const empty = typeof text === 'string' && !text
  return (
    <Btn
      className={className}
      variant={variant}
      disabled={empty}
      onClick={async () => {
        await copy(typeof text === 'function' ? text() : text)
        setDone(true)
        setTimeout(() => setDone(false), 1200)
      }}
    >
      {done ? <span className="text-accent">✓ copied</span> : label}
    </Btn>
  )
}

type Opt<T extends string> = T | { value: T; label: ReactNode; title?: string }

export function Seg<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: readonly Opt<T>[]
  className?: string
}) {
  return (
    <div className={cx('seg', className)} role="group">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
        return (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            title={typeof o === 'string' ? undefined : o.title}
            onClick={() => onChange(v)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  title,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  title?: string
}) {
  return (
    <label className="toggle" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-box" aria-hidden />
      <span>{label}</span>
    </label>
  )
}

export function Pane({
  title,
  actions,
  children,
  footer,
  className,
  bodyClassName,
}: {
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cx('pane', className)}>
      <header className="pane-h">
        <span className="pane-t">{title}</span>
        <div className="flex min-w-0 items-center gap-1.5">{actions}</div>
      </header>
      <div className={cx('pane-b', bodyClassName)}>{children}</div>
      {footer && <footer className="pane-f">{footer}</footer>}
    </section>
  )
}

export function Badge({ tone = 'dim', children, title }: { tone?: 'ok' | 'err' | 'warn' | 'info' | 'dim'; children: ReactNode; title?: string }) {
  return (
    <span className={cx('badge', `badge-${tone}`)} title={title}>
      {children}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-24 items-center justify-center p-6 text-center text-xs text-faint">{children}</div>
}

export function KV({ k, v, mono = true, hint, copyText }: { k: ReactNode; v: string; mono?: boolean; hint?: ReactNode; copyText?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="kv group"
      onClick={async () => {
        await copy(copyText ?? v)
        setDone(true)
        setTimeout(() => setDone(false), 900)
      }}
      title="click to copy"
    >
      <span className="kv-k">{k}</span>
      <span className={cx('kv-v', mono && 'font-mono')}>
        {v}
        {hint && <span className="ml-2 text-faint">{hint}</span>}
      </span>
      <span className="kv-c">{done ? '✓' : 'copy'}</span>
    </button>
  )
}
