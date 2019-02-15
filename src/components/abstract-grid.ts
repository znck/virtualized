import Vue, { VNode } from 'vue'
import ResizeObserver from 'resize-observer-polyfill'
import Measure from './measure'
import {
  MeasureCache,
  CompressedPositionManager,
  IndexRange,
  OffsetFitMode,
  contract,
  createMeasureCache,
  createCompressedPositionManager,
  overScanRange,
  getFirstVnode,
  mergeVnode,
} from '../helpers'
import PropTypes from '@znck/prop-types'
import { ScrollTrigger, ScrollDirection, InjectKey } from '../constants'
import { MeasureEvent, MeasureEventInit } from './measure'

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
  readonly row: number
  readonly column: number
  readonly offsetTop: number
  readonly offsetLeft: number
  readonly width: number
  readonly height: number
}

interface AbstractGridInstance extends Vue {
  resizeObserver: ResizeObserver
  measured: MeasureCache
  manager: {
    row: CompressedPositionManager
    column: CompressedPositionManager
  }
  vnodeCache: { [key: number]: VNode }
  current: ScrollRenderRange
  savedScrollState: ScrollRenderState
  poolSize: {
    x: number
    y: number
  }
  _scrollToCell: Partial<{
    row: number
    column: number
  }> | null
  _hasPendingRender: (() => void) | null
  _ignoreScrollEvents: boolean
}

interface AbstractGridData {
  scrollTop: number
  scrollLeft: number
  scrollTrigger: ScrollTrigger
  scrollDirectionVertical: ScrollDirection
  scrollDirectionHorizontal: ScrollDirection
}

interface AbstractGridMethods {
  onScroll(event: MouseEvent): void
  onItemMeasure(row: number, column: number): void
  computePoolSize(): void
  scrollTo(
    offset: {
      top: number
      left: number
    },
    preventEvent?: boolean,
    smooth?: boolean
  ): void
  scrollToCell(
    cell: {
      row: number
      column: number
    },
    mode?: OffsetFitMode,
    smooth?: boolean
  ): void
  computeScrollPosition(
    offset: {
      top: number
      left: number
    },
    trigger: ScrollTrigger
  ): void
  saveCurrentScrollState(): void
  forceRenderInNextFrame(done: () => void): void
  renderGridCells(): VNode[]
}

interface AbstractGridComputed {}

interface AbstractGridProps {
  rowCount: number
  columnCount: number
  containerWidth: number
  containerHeight: number
  estimatedItemWidth: number
  estimatedItemHeight: number
  overscanCountVertical: number
  overscanCountHorizontal: number
}

export default contract(
  Vue.extend<
    AbstractGridInstance,
    AbstractGridData,
    AbstractGridMethods,
    AbstractGridComputed,
    AbstractGridProps
  >({
    name: 'AbstractGrid',

    props: {
      rowCount: PropTypes.number.isRequired,
      columnCount: PropTypes.number.isRequired,
      containerWidth: PropTypes.number.isRequired,
      containerHeight: PropTypes.number.isRequired,
      estimatedItemWidth: PropTypes.number.value(30),
      estimatedItemHeight: PropTypes.number.value(120),
      overscanCountVertical: PropTypes.number.value(1),
      overscanCountHorizontal: PropTypes.number.value(1),
    },

    provide() {
      const provide = {}

      Object.defineProperties(provide, {
        [InjectKey.MEASURE_CACHE]: {
          get: () => this.measured,
        },
        [InjectKey.RESIZE_OBSERVER]: {
          get: () => this.resizeObserver,
        },
      })

      return provide
    },

    data() {
      return {
        scrollTop: 0,
        scrollLeft: 0,
        scrollTrigger: ScrollTrigger.NONE,
        scrollDirectionVertical: ScrollDirection.FORWARD,
        scrollDirectionHorizontal: ScrollDirection.FORWARD,
      }
    },

    created() {
      const vm = this
      const measured = createMeasureCache({
        width: this.estimatedItemWidth,
        height: this.estimatedItemHeight,
        key: (row, column) => `${row}:${column}`,
      })
      this.measured = measured
      const manager = {
        row: createCompressedPositionManager({
          count: this.rowCount,
          estimatedCellSize: this.estimatedItemHeight,
          sizeGetter: row =>
            this.measured.hasMax(row, Infinity)
              ? this.measured.rowHeight(row)
              : null,
        }),
        column: createCompressedPositionManager({
          count: this.columnCount,
          estimatedCellSize: this.estimatedItemWidth,
          sizeGetter: column =>
            this.measured.hasMax(Infinity, column)
              ? this.measured.columnWidth(column)
              : null,
        }),
      }
      this.manager = manager

      this.current = {
        visible: {
          get row() {
            return manager.row.find(vm.scrollTop, vm.containerHeight)
          },
          get column() {
            return manager.column.find(vm.scrollLeft, vm.containerWidth)
          },
        },
        rendered: {
          get row() {
            return overScanRange(
              vm.current.visible.row,
              vm.scrollDirectionVertical,
              vm.overscanCountVertical,
              vm.rowCount
            )
          },
          get column() {
            return overScanRange(
              vm.current.visible.column,
              vm.scrollDirectionHorizontal,
              vm.overscanCountHorizontal,
              vm.columnCount
            )
          },
        },
      }

      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target) {
            const event: MeasureEvent = new CustomEvent<MeasureEventInit>(
              'measure',
              {
                detail: {
                  contentRect: entry.contentRect,
                },
              }
            )
            entry.target.dispatchEvent(event)
          }
        }
      })

      this.vnodeCache = {}
    },

    destroyed() {
      const instances = Object.values(this.vnodeCache)
      delete this.vnodeCache

      instances.forEach(vnode => {
        if (vnode.componentInstance) vnode.componentInstance.$destroy()
      })
    },

    methods: {
      onItemMeasure(row, column) {
        this._scrollToCell = {
          row: this.savedScrollState.row,
          column: this.savedScrollState.column,
        }
        this.manager.row.unset(row)
        this.manager.column.unset(column)

        this.forceRenderInNextFrame(() => {
          if (this._scrollToCell) {
            this._scrollToCell = null // TODO: Adjust on resize.
          }
        })
      },
      saveCurrentScrollState() {
        const row = this.current.visible.row.start
        const column = this.current.visible.column.start
        const { offset: offsetTop, size: height } = this.manager.row.get(row)
        const { offset: offsetLeft, size: width } = this.manager.column.get(
          column
        )
        this.savedScrollState = {
          visible: this.current.visible,
          rendered: this.current.rendered,
          row,
          column,
          width,
          height,
          offsetLeft,
          offsetTop,
        }
      },
      onScroll(event) {
        if (this._ignoreScrollEvents) return

        const el = (event.target || this.$el) as HTMLElement
        const scrollLeft = Math.max(0, el.scrollLeft)
        const scrollTop = Math.max(0, el.scrollTop)
        this._scrollToCell = null // cancel pending scroll to index

        this.computeScrollPosition(
          { left: scrollLeft, top: scrollTop },
          ScrollTrigger.OBSERVED
        )
      },

      computeScrollPosition(
        { top: scrollTop, left: scrollLeft },
        trigger = ScrollTrigger.REQUESTED
      ) {
        if (scrollLeft >= 0 && scrollLeft !== this.scrollLeft) {
          this.scrollTrigger = trigger
          this.scrollDirectionHorizontal =
            scrollLeft < this.scrollLeft
              ? ScrollDirection.FORWARD
              : ScrollDirection.REVERSE
          this.scrollLeft = scrollLeft
        }

        if (scrollTop >= 0 && scrollTop !== this.scrollTop) {
          this.scrollTrigger = trigger
          this.scrollDirectionVertical =
            scrollTop < this.scrollTop
              ? ScrollDirection.FORWARD
              : ScrollDirection.REVERSE
          this.scrollTop = scrollTop
        }
      },

      forceRenderInNextFrame(fn) {
        if (this._hasPendingRender) {
          this._hasPendingRender = fn
          return
        }

        this._hasPendingRender = fn
        this.$nextTick(() => {
          const done = this._hasPendingRender!
          this._hasPendingRender = null

          this.$forceUpdate()
          done()
        })
      },

      computePoolSize() {
        if (!this.poolSize)
          this.poolSize = {
            x: 3,
            y: 3,
          }

        const prevPoolSize = this.poolSize

        this.poolSize.y = Math.max(
          prevPoolSize.y,
          this.current.rendered.row.end - this.current.rendered.row.start + 2
        )
        this.poolSize.x = Math.max(
          this.poolSize.x,
          this.current.rendered.column.end -
            this.current.rendered.column.start +
            2
        )
      },

      scrollTo({ top, left }, preventEvent = false, smooth = true) {
        const prevValue = this._ignoreScrollEvents
        this._ignoreScrollEvents = preventEvent
        this.$el.scrollTo({
          left,
          top,
          behavior: smooth ? 'smooth' : 'auto',
        })
        this._ignoreScrollEvents = prevValue
      },

      scrollToCell({ row, column }, mode = OffsetFitMode.AUTO, smooth = false) {
        this.scrollTo(
          {
            top: this.manager.row.computeUpdatedOffset(
              row,
              this.scrollTop,
              this.containerHeight,
              mode
            ),
            left: this.manager.column.computeUpdatedOffset(
              column,
              this.scrollLeft,
              this.containerWidth,
              mode
            ),
          },
          false,
          smooth
        )
      },

      renderGridCells() {
        const { start: rowStart, end: rowEnd } = this.current.rendered.row
        const {
          start: columnStart,
          end: columnEnd,
        } = this.current.rendered.column
        const offsetTopAdjustment = this.manager.row.adjustOffset(
          this.scrollTop,
          this.containerHeight
        )
        const offsetLeftAdjustment = this.manager.column.adjustOffset(
          this.scrollLeft,
          this.containerWidth
        )

        const children = []

        for (let row = rowStart; row <= rowEnd; ++row) {
          const { offset: offsetTop, size: height } = this.manager.row.get(row)
          const compressedOffsetTop = offsetTop + offsetTopAdjustment
          const cells = []
          const keyPrefix = (row % this.poolSize.y) + ':'
          for (let column = columnStart; column <= columnEnd; ++column) {
            const key = keyPrefix + (column % this.poolSize.x)
            const { offset: offsetLeft, size: width } = this.manager.column.get(
              column
            )
            const compressedOffsetLeft = offsetLeft + offsetLeftAdjustment

            const vnode = this.$createElement(
              Measure,
              {
                keepAlive: true,
                key,
                attrs: { key },
                props: {
                  rowIndex: row,
                  columnIndex: column,
                  width,
                  height,
                },
                on: { measure: this.onItemMeasure },
              },
              this.$scopedSlots.cell!({
                key,
                row,
                column,
                width,
                height,
                offsetLeft,
                compressedOffsetLeft,
                offsetTop,
                compressedOffsetTop,
              })
            )

            if (this.vnodeCache[key])
              vnode.componentInstance = this.vnodeCache[key].componentInstance
            else this.vnodeCache[key] = vnode

            cells.push(vnode)
          }

          if (this.$scopedSlots.row) {
            const vnode = getFirstVnode(
              this.$scopedSlots.row({
                row,
                height,
                offsetTop,
                compressedOffsetTop,
                children: cells,
              })
            )

            children.push(vnode)
          } else {
            children.push(...cells)
          }
        }

        return children
      },
    },

    watch: {
      rowCount(newCount: number) {
        if (this.manager.row.length !== newCount) {
          this.manager.row.configure({
            count: newCount,
          })
          this.$forceUpdate()
        }
      },
      columnCount(newCount: number) {
        if (this.manager.column.length !== newCount) {
          this.manager.column.configure({
            count: newCount,
          })
          this.$forceUpdate()
        }
      },
    },

    render(h) {
      this.computePoolSize()
      this.saveCurrentScrollState()

      const container = getFirstVnode(
        this.$scopedSlots.container!({
          width: this.containerWidth,
          height: this.containerHeight,
        })
      )
      const contents = getFirstVnode(
        this.$scopedSlots.contents!({
          width: this.manager.column.size,
          height: this.manager.row.size,
        })
      )

      mergeVnode(container, {
        data: {
          on: { '&scroll': this.onScroll },
        },
        children: [contents],
      })

      mergeVnode(contents, {
        children: this.renderGridCells(),
      })

      return container
    },
  })
)
