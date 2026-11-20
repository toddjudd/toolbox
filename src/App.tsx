import { Suspense, useEffect, useState } from 'react'
import { toolById, type Tool } from './tools/registry'
import { SHORTCUT_SLOTS, orderedTools, shortcutLabel, useDragReorder, useToolOrder } from './tools/order'
import { navigate, useRoute } from './lib/router'
import { usePersistent } from './lib/store'
import { useNow } from './lib/hooks'
import { clockParts, copy } from './lib/format'
import { CommandPalette } from './components/CommandPalette'
import { ThemePicker } from './components/ThemePicker'
import { DEFAULT_ACCENT, applyAccent } from './lib/theme'
import { cx } from './components/ui'
import Home from './Home'

const GITHUB_URL = 'https://github.com/toddjudd/toolbox'

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest('.cm-editor'))

export default function App() {
  const route = useRoute()
  const tool = toolById(route)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [crt] = usePersistent('ui:crt', false)
  const [accent] = usePersistent('ui:accent', DEFAULT_ACCENT)

  useEffect(() => {
    document.documentElement.classList.toggle('crt', crt)
  }, [crt])

  useEffect(() => applyAccent(accent), [accent])

  useEffect(() => {
    const open = () => setThemeOpen(true)
    window.addEventListener('tb:theme-picker', open)
    return () => window.removeEventListener('tb:theme-picker', open)
  }, [])

  useEffect(() => {
    document.title = tool ? `${tool.name} · ~/toolbox` : '~/toolbox'
    setNavOpen(false)
  }, [tool])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      } else if (e.key === '/' && !isEditable(e.target)) {
        e.preventDefault()
        setPaletteOpen(true)
      } else if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[0-9]$/.test(e.code)) {
        // e.code, not e.key: Shift turns "1" into "!" and macOS Option produces symbols
        const n = Number(e.code.slice(5))
        if (n === 0) {
          if (e.shiftKey) return
          e.preventDefault()
          navigate('')
          return
        }
        const slot = (e.shiftKey ? 9 : 0) + n - 1
        const target = slot < SHORTCUT_SLOTS ? orderedTools()[slot] : undefined
        e.preventDefault()
        if (target) navigate(target.id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <div className="flex h-dvh flex-col">
      <TopBar onPalette={() => setPaletteOpen(true)} onMenu={() => setNavOpen((o) => !o)} />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar current={route} open={navOpen} onClose={() => setNavOpen(false)} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-8 text-xs text-faint cursor-blink">loading</div>}>
            {tool ? <ToolFrame key={tool.id} tool={tool} /> : <Home onPalette={() => setPaletteOpen(true)} />}
          </Suspense>
        </main>
      </div>
      <StatusBar onTheme={() => setThemeOpen((o) => !o)} />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {themeOpen && <ThemePicker onClose={() => setThemeOpen(false)} />}
    </div>
  )
}

function TopBar({ onPalette, onMenu }: { onPalette: () => void; onMenu: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b sm:gap-3 border-line bg-bg/80 px-3 backdrop-blur sm:px-4">
      <button className="btn btn-ghost px-2 md:hidden" onClick={onMenu} aria-label="menu">
        ☰
      </button>
      <a href="#/" className="glow shrink-0 text-[15px] font-semibold tracking-tight text-accent">
        ~/toolbox<span className="cursor-blink" />
      </a>
      <button
        onClick={onPalette}
        className="mx-auto flex h-8 w-full min-w-0 max-w-md items-center gap-2 rounded-md border border-line-2 bg-panel px-3 text-left text-xs text-faint transition hover:border-accent/60 hover:text-dim"
      >
        <span className="text-accent/70">❯</span>
        <span className="min-w-0 flex-1 truncate">search tools or paste anything…</span>
        <span className="kbd max-sm:hidden">Ctrl</span>
        <span className="kbd max-sm:hidden">K</span>
      </button>
      <span className="hidden w-[7.5rem] lg:block" />
    </header>
  )
}

function Sidebar({ current, open, onClose }: { current: string; open: boolean; onClose: () => void }) {
  const { tools, pins, move, togglePin } = useToolOrder()
  const { dragId, dropIndex, itemProps } = useDragReorder(move)
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} />}
      <nav
        className={cx(
          'z-40 flex w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-bg p-2 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:pt-14 max-md:transition-transform',
          !open && 'max-md:-translate-x-full',
        )}
      >
        <NavLink active={current === ''} glyph="~" label="home" href="#/" kbd="0" />
        <div className="label mt-3 mb-1 px-2 text-[10px]">tools</div>
        {tools.map((t, i) => {
          const pinned = pins.includes(t.id)
          return (
            <div key={t.id} {...itemProps(t.id, i)} className={cx('group relative', dragId === t.id && 'opacity-40')}>
              {dropIndex === i && dragId && <DropLine edge="top" />}
              {dropIndex === i + 1 && i === tools.length - 1 && dragId && <DropLine edge="bottom" />}
              <NavLink active={current === t.id} glyph={t.glyph} label={t.name} href={`#/${t.id}`} kbd={shortcutLabel(i)} />
              <button
                onClick={() => togglePin(t.id)}
                className={cx(
                  'absolute top-1/2 right-8 -translate-y-1/2 px-1 text-[11px]',
                  pinned ? 'text-accent/80' : 'text-faint opacity-0 group-hover:opacity-100',
                )}
                title={pinned ? 'unpin' : 'pin to top'}
              >
                {pinned ? '★' : '☆'}
              </button>
            </div>
          )
        })}
        <div className="mt-auto px-2 pt-6 pb-1 text-[10.5px] leading-relaxed text-faint">
          <span className="kbd">Alt</span>+<span className="kbd">1-9</span> jump
          <br />
          <span className="kbd">Alt</span>+<span className="kbd">Shift</span>+<span className="kbd">1-9</span> 10+
          <br />
          <span className="kbd">/</span> or <span className="kbd">Ctrl K</span> command
          <br />
          drag to reorder
        </div>
      </nav>
    </>
  )
}

function DropLine({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <span
      className={cx(
        'pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded bg-accent shadow-[0_0_6px_var(--color-accent)]',
        edge === 'top' ? '-top-px' : '-bottom-px',
      )}
    />
  )
}

function NavLink({ active, glyph, label, href, kbd }: { active: boolean; glyph: string; label: string; href: string; kbd: string }) {
  return (
    <a
      href={href}
      className={cx(
        'flex h-8 items-center gap-2.5 rounded-md px-2 text-[12.5px] transition',
        active ? 'bg-accent/10 text-accent shadow-[inset_2px_0_0_var(--color-accent)]' : 'text-dim hover:bg-panel-2 hover:text-fg',
      )}
    >
      <span className={cx('grid h-5 w-6 place-items-center rounded text-[10.5px]', active ? 'text-accent glow' : 'text-faint')}>{glyph}</span>
      <span className="flex-1">{label}</span>
      <span className="text-[10px] text-faint tabular-nums">{kbd}</span>
    </a>
  )
}

function ToolFrame({ tool }: { tool: Tool }) {
  const { Component } = tool
  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="glow text-lg font-semibold text-accent">
          <span className="mr-2 text-accent/60">{tool.glyph}</span>
          {tool.name}
        </h1>
        <p className="text-xs text-dim">{tool.desc}</p>
      </div>
      <Component />
    </div>
  )
}

function StatusBar({ onTheme }: { onTheme: () => void }) {
  const now = useNow(1000)
  const [crt, setCrt] = usePersistent('ui:crt', false)
  const local = clockParts(now)
  const utc = clockParts(now, 'UTC')
  const epoch = Math.floor(now / 1000)
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-bg px-3 text-[11px] text-faint">
      <span className="flex items-center gap-1.5" title="Everything runs in your browser. No analytics, no network calls with your data.">
        <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]" />
        <span className="hidden sm:inline">100% local · nothing leaves this tab</span>
        <span className="sm:hidden">local</span>
      </span>
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-faint transition hover:text-accent" title="source on GitHub" aria-label="Source on GitHub">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      </a>
      <span className="flex-1" />
      <span className="hidden sm:inline">
        local <span className="text-dim">{`${local.h}:${local.m}:${local.s}`}</span>
      </span>
      <span>
        utc <span className="text-dim">{`${utc.h}:${utc.m}:${utc.s}`}</span>
      </span>
      <button className="hover:text-accent" onClick={() => copy(String(epoch))} title="copy epoch">
        epoch <span className="text-dim tabular-nums">{epoch}</span>
      </button>
      <button className={cx('hover:text-accent', crt && 'text-accent')} onClick={() => setCrt(!crt)} title="toggle CRT scanlines">
        crt
      </button>
      <button data-theme-trigger onClick={onTheme} className="flex items-center gap-1.5 hover:text-accent" title="theme color">
        <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]" />
        <span className="max-sm:hidden">theme</span>
      </button>
    </footer>
  )
}
