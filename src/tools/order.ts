import { useState, type DragEvent } from 'react'
import { TOOLS, type Tool } from './registry'
import { getStored, usePersistent } from '../lib/store'

const ORDER_KEY = 'ui:order'
// Stars were replaced by drag-to-reorder; tools someone had starred seed the initial order.
const DEFAULT_ORDER = getStored<string[]>('ui:pins', [])

/** Tools in the saved order; tools missing from it (e.g. newly added) go last in registry order. */
function arrange(order: string[]): Tool[] {
  const rank = (t: Tool) => {
    const i = order.indexOf(t.id)
    return i === -1 ? order.length + TOOLS.indexOf(t) : i
  }
  return [...TOOLS].sort((a, b) => rank(a) - rank(b))
}

/** The current tool order, read outside React (keyboard shortcuts). */
export const orderedTools = () => arrange(getStored(ORDER_KEY, DEFAULT_ORDER))

/** Tool for a jump-shortcut slot: Alt+1-9 → 0-8, Alt+Shift+1-9 → 9-17. */
export const SHORTCUT_SLOTS = 18

export function shortcutLabel(i: number, prefix = '') {
  if (i >= SHORTCUT_SLOTS) return ''
  return i < 9 ? `${prefix}${i + 1}` : `${prefix}⇧${i - 8}`
}

export function useToolOrder() {
  const [order, setOrder] = usePersistent<string[]>(ORDER_KEY, DEFAULT_ORDER)
  const tools = arrange(order)

  /** Move a tool to a display index (the index it is dropped before). */
  const move = (id: string, to: number) => {
    const ids = tools.map((t) => t.id)
    const from = ids.indexOf(id)
    if (from === -1) return
    ids.splice(from, 1)
    ids.splice(to > from ? to - 1 : to, 0, id)
    setOrder(ids)
  }

  return { tools, move }
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
