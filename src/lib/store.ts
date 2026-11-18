import { useCallback, useSyncExternalStore } from 'react'

const PREFIX = 'tb:'
const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function load<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T
  let value = fallback
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw != null) value = JSON.parse(raw) as T
  } catch {}
  cache.set(key, value)
  return value
}

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l())
}

function write(key: string) {
  timers.delete(key)
  try {
    const raw = JSON.stringify(cache.get(key))
    if (raw === undefined) localStorage.removeItem(PREFIX + key)
    else if (raw.length < 2_000_000) localStorage.setItem(PREFIX + key, raw)
  } catch {}
}

function persist(key: string) {
  clearTimeout(timers.get(key))
  timers.set(
    key,
    setTimeout(() => write(key), 250),
  )
}

export function flushStored() {
  for (const [key, t] of timers) {
    clearTimeout(t)
    write(key)
  }
}

export function setStored<T>(key: string, value: T) {
  cache.set(key, value)
  persist(key)
  emit(key)
}

export function getStored<T>(key: string, fallback: T): T {
  return load(key, fallback)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushStored)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushStored())
  window.addEventListener('storage', (e) => {
    if (!e.key?.startsWith(PREFIX)) return
    const key = e.key.slice(PREFIX.length)
    if (!cache.has(key)) return
    if (e.newValue == null) cache.delete(key)
    else {
      try {
        cache.set(key, JSON.parse(e.newValue))
      } catch {
        return
      }
    }
    emit(key)
  })
}

export function usePersistent<T>(key: string, fallback: T) {
  const subscribe = useCallback(
    (cb: () => void) => {
      let set = listeners.get(key)
      if (!set) {
        set = new Set()
        listeners.set(key, set)
      }
      set.add(cb)
      return () => {
        set.delete(cb)
      }
    },
    [key],
  )
  const value = useSyncExternalStore(subscribe, () => load(key, fallback))
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = load(key, fallback)
      setStored(key, typeof next === 'function' ? (next as (p: T) => T)(prev) : next)
    },
    [key, fallback],
  )
  return [value, update] as const
}
