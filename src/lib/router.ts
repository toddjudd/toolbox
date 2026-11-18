import { useSyncExternalStore } from 'react'

function current() {
  return location.hash.replace(/^#\/?/, '').split('?')[0]
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

/** Current route id, e.g. "" for home or "json" for #/json */
export function useRoute() {
  return useSyncExternalStore(subscribe, current)
}

export function navigate(path: string) {
  const h = '#/' + path.replace(/^\/+/, '')
  if (location.hash !== h) location.hash = h
}
