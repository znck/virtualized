import Vue, { VNode } from 'vue'
import ResizeObserver from 'resize-observer-polyfill'
import {
  MeasureCache,
  CompressedPositionManager,
  IndexRange,
} from 'src/helpers'

interface ScrollRenderRange {
  readonly visible: {
    readonly row: IndexRange
    readonly column: IndexRange
  }
  readonly rendered: {
    readonly row: IndexRange
    readonly column: IndexRange
  }
}

interface ScrollRenderState extends ScrollRenderRange {
  readonly index: number
  readonly offset: number
  readonly size: number
  readonly occluded: number
}

interface AbstractGridInstance {
  resizeObserver: ResizeObserver
  measured: MeasureCache
  manager: {
    row: CompressedPositionManager
    column: CompressedPositionManager
  }
  vnodeCache: { [key: number]: VNode }
  current: ScrollRenderRange
  savedScrollState: ScrollRenderState
  poolSize: number
  _scrollToIndex: number | null
  _hasPendingRender: (() => void) | null
  _ignoreScrollEvents: boolean
}

interface AbstractGridData {
  scrollTop: number
  scrollLeft: number
}
