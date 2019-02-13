import { ScrollDirection } from './constants'

export interface IndexRange {
  start: number
  end: number
}

export function overScanRange(
  { start, end }: IndexRange,
  direction: ScrollDirection,
  overScanCount: number,
  total: number
): IndexRange {
  if (direction === ScrollDirection.FORWARD) {
    start = Math.max(0, start - 1)
    end = Math.min(total - 1, end + overScanCount)
  } else {
    start = Math.max(0, start - overScanCount)
    end = Math.min(total - 1, end + 1)
  }

  return { start, end }
}

export interface Size {
  height: number
  width: number
}

export interface MeasureCacheConfig {
  height: number
  width: number
  key(row: number, column: number): string
}

export interface MeasureCache {
  has(row: number, column?: number): boolean
  get(row: number, column?: number): Size
  set(row: number, column: number, size: Size): void
  is(row: number, column: number, size?: Size): boolean
  remove(row: number, column?: number): void
}

const DEFAULT_MEASURE_CACHE_CONFIG: MeasureCacheConfig = {
  height: 30,
  width: 100,
  key: (row, column) => `${row}:${column}`,
}

export function createMeasureCache(options: Partial<MeasureCacheConfig> = {}) {
  const { key, height, width } = { ...DEFAULT_MEASURE_CACHE_CONFIG, ...options }

  const fallbackSize: Size = Object.freeze({ height, width })
  const store: { [key: string]: Size } = {}
  const cache: MeasureCache = {
    has(row, column = 0) {
      return key(row, column) in store
    },
    get(row, column = 0) {
      return store[key(row, column)] || fallbackSize
    },
    set(row, column, size) {
      store[key(row, column)] = size
    },
    is(row, column, size) {
      const currentSize = cache.get(row, column)

      return size
        ? size.width === currentSize.width && size.height === currentSize.height
        : false
    },
    remove(row, column = 0) {
      delete store[key(row, column)]
    },
  }

  return cache
}

export interface Position {
  offset: number
  size: number
}

export interface PositionManagerConfig {
  count: number
  estimatedCellSize: number
  sizeGetter(index: number): number | null
}

export interface PositionManager {
  store?: any
  length: number
  size: number
  lastMeasuredCell: Position
  configure(options: Partial<PositionManagerConfig>): void
  get(index: number): Position
  unset(index: number): void
  find(offset: number, viewport: number): IndexRange
}

export function createPositionManager({
  count,
  estimatedCellSize,
  sizeGetter,
}: PositionManagerConfig) {
  const store: { [key: number]: Position } = {}
  let lastDeferredIndex = -1
  let lastMeasuredIndex = -1

  const manager: PositionManager = {
    store,
    get length() {
      return count
    },
    get size() {
      const lastCell = manager.lastMeasuredCell
      const measuredTotalSize = lastCell.offset + lastCell.size
      const estimatedTotalSize =
        (count - lastMeasuredIndex - 1) * estimatedCellSize

      return measuredTotalSize + estimatedTotalSize
    },
    get lastMeasuredCell() {
      const cell =
        lastMeasuredIndex < 0
          ? { offset: 0, size: 0 }
          : store[lastMeasuredIndex]
      return cell
    },
    configure({
      count: newCount,
      estimatedCellSize: newEstimatedCellSize,
      sizeGetter: newSizeGetter,
    }) {
      if (newCount) count = newCount
      if (newEstimatedCellSize) estimatedCellSize = newEstimatedCellSize
      if (newSizeGetter) sizeGetter = newSizeGetter
    },
    unset(index) {
      if (typeof index === 'number') {
        delete store[index]

        lastDeferredIndex = lastMeasuredIndex = Math.min(
          index - 1,
          lastMeasuredIndex
        )
      }
    },
    get(index) {
      if (index < 0 || index >= count) {
        throw new Error(`index ${index} is outside of range 0..${count}`)
      }

      if (index > lastMeasuredIndex) {
        if (index < lastDeferredIndex) {
          // already have estimated size
        } else {
          const lastMeasured = manager.lastMeasuredCell
          let offset = lastMeasured.offset + lastMeasured.size

          for (let i = lastMeasuredIndex + 1; i <= index; ++i) {
            const size = sizeGetter(i)

            if (size === null) {
              store[i] = {
                offset: offset,
                size: estimatedCellSize,
              }

              offset += estimatedCellSize
              lastDeferredIndex = i
            } else {
              store[i] = {
                offset,
                size,
              }

              offset += size
              lastMeasuredIndex = i
            }
          }
        }
      }

      return store[index]
    },
    find(offset, size) {
      if (manager.size === 0) return { start: 0, end: 0 }

      offset = Math.min(manager.size - size, Math.max(0, offset))

      const start = offset === 0 ? 0 : nearestCell(offset)
      const cell = manager.get(start)

      const maxOffset = offset + size
      offset = cell.offset + cell.size

      let end = start
      while (offset < maxOffset && end < count - 1) {
        ++end

        offset += manager.get(end).size
      }

      return { start, end }
    },
  }

  function nearestCell(offset: number): number {
    return binarySearch(0, count - 1, Math.max(0, offset))
  }

  function binarySearch(low: number, high: number, offset: number): number {
    while (low <= high) {
      const mid = low + ~~((high - low) / 2)
      const currentOffset = manager.get(mid).offset

      if (currentOffset === offset) {
        return mid
      } else if (currentOffset < offset) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    if (low > 0) {
      return low - 1
    }

    return 0
  }

  return manager
}

export interface ScaledPositionManagerConfig extends PositionManagerConfig {
  maxScrollSize?: number
}
export interface ScaledPositionManager extends PositionManager {
  hasScaledOffsets: boolean
}

export function createScalingPositionManager({
  maxScrollSize = 1.5e9,
  ...options
}: ScaledPositionManagerConfig): ScaledPositionManager {
  const manager = createPositionManager(options)
  const scalingManager: ScaledPositionManager = {
    ...manager,
    get hasScaledOffsets() {
      return false
    },
    get length() {
      return manager.length
    },
    get size() {
      return manager.size
    },
    get lastMeasuredCell() {
      return manager.lastMeasuredCell
    },
  }

  return scalingManager
}

import { VNode } from 'vue'
import { ScopedSlot } from 'vue/types/vnode'
export function getWrapperVnode(fn?: ScopedSlot): VNode | null {
  if (fn) {
    const nodes = fn({})

    if (nodes && nodes.length) {
      return nodes[0]
    }
  }

  return null
}

function mergeVnodeMulti(target: any, source: any, key: string) {
  if (!target[key]) target[key] = source[key]
  else if (Array.isArray(target[key]))
    Array.isArray(source[key])
      ? target[key].push(...source[key])
      : target[key].push(source[key])
  else
    target[key] = Array.isArray(source[key])
      ? [target[key], ...source[key]]
      : [target[key], source[key]]
}

function mergeVnodeData(vnode: any, { data }: any) {
  if (!vnode.data) {
    vnode.data = data

    return vnode
  }

  for (const key in data) {
    if (/on/i.test(key)) {
      if (!vnode.data[key]) vnode.data[key] = data[key]
      else {
        for (const event in data[key]) {
          mergeVnodeMulti(vnode.data[key], data[key], event)
        }
      }
    } else {
      mergeVnodeMulti(vnode.data, data, key)
    }
  }

  return vnode
}

function mergeVnodeChildren(vnode: any, { children }: any) {
  if (!vnode.children) vnode.children = children
  else vnode.children = [...vnode.children, ...children]
}

export function mergeVnode(a: VNode, b: Partial<VNode>) {
  if (b.data) mergeVnodeData(a, b)
  if (b.children) mergeVnodeChildren(a, b)

  return a
}

export function contract<T>(component: T): T {
  component = (component as any).extendOptions
  delete (component as any)._Ctor

  return component
}
