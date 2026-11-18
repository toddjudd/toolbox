import { useCallback, useSyncExternalStore } from 'react'

/**
 * Tiny persistent store backed by localStorage.
 * - Reads are cached in memory, writes to disk are debounced.
 * - Any component (or the command palette) can set a key and every subscriber updates.
 * - Syncs across open tabs via the `storage` event.
 */

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
  } catch {
    /* storage unavailable or corrupt: use fallback */
  }
  cache.set(key, value)
  return value
}

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l())
}

function persist(key: string) {
  clearTimeout(timers.get(key))
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      try {
        const raw = JSON.stringify(cache.get(key))
        if (raw === undefined) localStorage.removeItem(PREFIX + key)
        else if (raw.length < 2_000_000) localStorage.setItem(PREFIX + key, raw)
      } catch {
        /* quota exceeded: keep in memory only */
      }
    }, 250),
  )
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return [value, update] as const
}
