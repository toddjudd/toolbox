import { useEffect, useState } from 'react'

/** Current time in ms, re-rendering on (roughly) aligned ticks. */
export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined
    const align = setTimeout(
      () => {
        setNow(Date.now())
        id = setInterval(() => setNow(Date.now()), interval)
      },
      interval - (Date.now() % interval),
    )
    return () => {
      clearTimeout(align)
      clearInterval(id)
    }
  }, [interval])
  return now
}

export function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
