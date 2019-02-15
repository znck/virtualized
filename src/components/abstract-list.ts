import Vue, { VNode } from 'vue'
import PropTypes from '@znck/prop-types'
import { InjectKey, ScrollDirection, ScrollTrigger } from '../constants'
import {
  createMeasureCache,
  overScanRange,
  getFirstVnode,
  MeasureCache,
  CompressedPositionManager,
  createCompressedPositionManager,
  IndexRange,
  mergeVnode,
  contract,
  OffsetFitMode,
} from '../helpers'
import ResizeObserver from 'resize-observer-polyfill'
import Measure, { MeasureEvent, MeasureEventInit } from './measure'

interface ScrollRenderRange {
  readonly visible: IndexRange
  readonly rendered: IndexRange
}

interface ScrollRenderState extends ScrollRenderRange {
  readonly index: number
  readonly offset: number
  readonly size: number
  readonly occluded: number
}

interface AbstractListInterface extends Vue {
  resizeObserver: ResizeObserver
  measured: MeasureCache
  manager: CompressedPositionManager
  vnodeCache: { [key: number]: VNode }
  current: ScrollRenderRange
  savedScrollState: ScrollRenderState
  poolSize: number
  _horizontal: boolean
  _scrollToIndex: number | null
  _hasPendingRender: (() => void) | null
  _ignoreScrollEvents: boolean
}
interface AbstractListData {
  scrollOffset: number
  scrollTrigger: ScrollTrigger
  scrollDirection: ScrollDirection
}
interface AbstractListMethods {
  onScroll(event: MouseEvent): void
  onItemMeasure(index: number): void
  computePoolSize(): void
  scrollTo(offset: number, preventEvent?: boolean, smooth?: boolean): void
  scrollToIndex(index: number, mode?: OffsetFitMode, smooth?: boolean): void
  computeScrollPosition(scrollTop: number, trigger: ScrollTrigger): void
  saveCurrentScrollState(): void
  forceRenderInNextFrame(done: () => void): void
  renderListItems(): VNode[]
}
interface AbstractListComputed {}
interface AbstractListProps {
  horizontal: boolean
  itemsCount: number
  overscanCount: number
  containerSize: number
  estimatedItemSize: number
}

export default contract(
  Vue.extend<
    AbstractListInterface,
    AbstractListData,
    AbstractListMethods,
    AbstractListComputed,
    AbstractListProps
  >({
    name: 'AbstractList',

    props: {
      horizontal: PropTypes.bool.value(false),
      itemsCount: PropTypes.number.isRequired,
      overscanCount: PropTypes.number.value(1),
      containerSize: PropTypes.number.isRequired,
      estimatedItemSize: PropTypes.number.value(30),
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
        scrollOffset: 0,
        scrollDirection: ScrollDirection.FORWARD,
        scrollTrigger: ScrollTrigger.NONE,
      }
    },

    created() {
      const vm = this
      this._horizontal = this.horizontal // cache and ignore changes
      const measured = (this.measured = createMeasureCache({
        ...(this._horizontal
          ? { width: this.estimatedItemSize }
          : { height: this.estimatedItemSize }),
        key: row => `${row}`,
      }))
      const manager = (this.manager = createCompressedPositionManager({
        count: this.itemsCount,
        estimatedCellSize: this.estimatedItemSize,
        sizeGetter: this._horizontal
          ? index => (measured.has(index) ? measured.get(index).width : null)
          : index => (measured.has(index) ? measured.get(index).height : null),
      }))

      this.current = {
        get visible() {
          return manager.find(vm.scrollOffset, vm.containerSize)
        },
        get rendered() {
          return overScanRange(
            vm.current.visible,
            vm.scrollDirection,
            vm.overscanCount,
            vm.itemsCount
          )
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
      onItemMeasure(index) {
        this._scrollToIndex = this.savedScrollState.index

        this.manager.unset(index)
        this.forceRenderInNextFrame(() => {
          if (this._scrollToIndex) {
            this._scrollToIndex = null
          }
        })
      },
      saveCurrentScrollState() {
        const index = this.current.visible.start
        const { offset, size } = this.manager.get(index)
        let occluded = 0

        if (offset <= this.scrollOffset && this.scrollOffset <= offset + size) {
          occluded = this.scrollOffset - offset
        }

        this.savedScrollState = {
          visible: this.current.visible,
          rendered: this.current.rendered,
          index,
          offset,
          size,
          occluded,
        }
      },
      onScroll(event) {
        if (this._ignoreScrollEvents) return

        const el = (event.target || this.$el) as HTMLElement
        const scrollOffset = Math.max(
          0,
          this._horizontal ? el.scrollLeft : el.scrollTop
        )
        this._scrollToIndex = null // cancel pending scroll to index

        this.computeScrollPosition(scrollOffset, ScrollTrigger.OBSERVED)
      },

      computeScrollPosition(scrollOffset, trigger = ScrollTrigger.REQUESTED) {
        if (scrollOffset < 0) return // Guard against negative scroll

        if (scrollOffset !== this.scrollOffset) {
          this.scrollTrigger = trigger
          this.scrollDirection =
            scrollOffset < this.scrollOffset
              ? ScrollDirection.FORWARD
              : ScrollDirection.REVERSE
          this.scrollOffset = scrollOffset
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
        const { start, end } = this.current.rendered

        const prevPoolSize = this.poolSize || 2

        this.poolSize = Math.max(prevPoolSize, end - start + 2)
      },

      scrollTo(offset, preventEvent = false, smooth = true) {
        const prevValue = this._ignoreScrollEvents
        this._ignoreScrollEvents = preventEvent
        this._horizontal
          ? this.$el.scrollTo({
              left: offset,
              behavior: smooth ? 'smooth' : 'auto',
            })
          : this.$el.scrollTo({
              top: offset,
              behavior: smooth ? 'smooth' : 'auto',
            })
        this._ignoreScrollEvents = prevValue
      },

      scrollToIndex(index, mode = OffsetFitMode.AUTO, smooth = false) {
        this.scrollTo(
          this.manager.computeUpdatedOffset(
            index,
            this.scrollOffset,
            this.containerSize,
            mode
          ),
          false,
          smooth
        )
      },

      renderListItems() {
        const { start, end } = this.current.rendered
        const children = []
        const offsetAdjustment = this.manager.adjustOffset(
          this.scrollOffset,
          this.containerSize
        )

        for (let index = start; index <= end; ++index) {
          const { offset, size } = this.manager.get(index)
          const key = index % this.poolSize
          const compressedOffset = offset + offsetAdjustment
          const vnode = this.$createElement(
            Measure,
            {
              keepAlive: true,
              key,
              attrs: { key },
              props: {
                rowIndex: index,
                height: this._horizontal ? false : size,
                width: this._horizontal ? size : false,
              },
              on: { measure: this.onItemMeasure },
            },
            this.$scopedSlots.item!({
              key,
              index,
              offset,
              size,
              compressedOffset,
            })
          )

          if (this.vnodeCache[key])
            vnode.componentInstance = this.vnodeCache[key].componentInstance
          else this.vnodeCache[key] = vnode
          children.push(vnode)
        }

        return children
      },
    },

    watch: {
      itemsCount(newCount: number) {
        if (this.manager.length !== newCount) {
          this.manager.configure({
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
        this.$scopedSlots.container!({ size: this.containerSize })
      )
      const contents = getFirstVnode(
        this.$scopedSlots.contents!({ size: this.manager.size })
      )

      mergeVnode(container, {
        data: {
          on: { '&scroll': this.onScroll },
        },
        children: [contents],
      })

      mergeVnode(contents, {
        children: this.renderListItems(),
      })

      return container
    },
  })
)
