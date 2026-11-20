import { useState, type DragEvent } from 'react'
import { TOOLS, type Tool } from './registry'
import { getStored, usePersistent } from '../lib/store'

const ORDER_KEY = 'ui:order'
const PINS_KEY = 'ui:pins'
const NO_ORDER: string[] = []
const DEFAULT_PINS = ['json', 'jwt']

/** Pinned tools first, then the rest; each group follows the saved order, new tools go last. */
function arrange(order: string[], pins: string[]): Tool[] {
  const rank = (t: Tool) => {
    const i = order.indexOf(t.id)
    return i === -1 ? order.length + TOOLS.indexOf(t) : i
  }
  return [...TOOLS].sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)) || rank(a) - rank(b))
}

/** The current tool order, read outside React (keyboard shortcuts). */
export const orderedTools = () => arrange(getStored(ORDER_KEY, NO_ORDER), getStored(PINS_KEY, DEFAULT_PINS))

/** Tool for a jump-shortcut slot: Alt+1-9 → 0-8, Alt+Shift+1-9 → 9-17. */
export const SHORTCUT_SLOTS = 18

export function shortcutLabel(i: number, prefix = '') {
  if (i >= SHORTCUT_SLOTS) return ''
  return i < 9 ? `${prefix}${i + 1}` : `${prefix}⇧${i - 8}`
}

export function useToolOrder() {
  const [order, setOrder] = usePersistent<string[]>(ORDER_KEY, NO_ORDER)
  const [pins, setPins] = usePersistent<string[]>(PINS_KEY, DEFAULT_PINS)
  const tools = arrange(order, pins)

  /** Move a tool to a display index. Landing inside the pinned group pins it, landing below unpins it. */
  const move = (id: string, to: number) => {
    const ids = tools.map((t) => t.id)
    const from = ids.indexOf(id)
    if (from === -1) return
    ids.splice(from, 1)
    ids.splice(to > from ? to - 1 : to, 0, id)
    const at = ids.indexOf(id)
    const pinnedOthers = ids.filter((x) => x !== id && pins.includes(x)).length
    const shouldPin = at < pinnedOthers || (pins.includes(id) && at === pinnedOthers)
    setOrder(ids)
    if (shouldPin !== pins.includes(id)) setPins((p) => (shouldPin ? [...p, id] : p.filter((x) => x !== id)))
  }

  const togglePin = (id: string) => {
    // keep the stored order in sync with what's on screen before the groups shift
    setOrder(tools.map((t) => t.id))
    setPins((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  return { tools, pins, move, togglePin }
}

/**
 * Native HTML5 drag-to-reorder. Spread `itemProps(id, index)` on each draggable element;
 * `dropIndex` is where the dragged item would land (render an indicator before that index).
 */
export function useDragReorder(move: (id: string, to: number) => void, axis: 'x' | 'y' = 'y') {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const reset = () => {
    setDragId(null)
    setDropIndex(null)
  }

  const itemProps = (id: string, index: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/x-toolbox-tool', id)
      setDragId(id)
    },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!dragId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const r = e.currentTarget.getBoundingClientRect()
      const after = axis === 'y' ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2
      setDropIndex(after ? index + 1 : index)
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      if (!dragId) return
      e.preventDefault()
      if (dropIndex != null) move(dragId, dropIndex)
      reset()
    },
    onDragEnd: reset,
  })

  return { dragId, dropIndex, itemProps }
}
