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
  contract,
} from '../helpers'
import ResizeObserver from 'resize-observer-polyfill'
import Measure, { MeasureEvent, MeasureEventInit } from './measure'

interface ScrollRenderRange {
  visible: IndexRange
  rendered: IndexRange
}

interface AbstractListInterface extends Vue {
  keepAliveInstancePoolSize: number
  resizeObserver: ResizeObserver
  sizeManager: MeasureCache
  positionManager: CompressedPositionManager
  instanceCache: { [key: string]: VNode }
  range: Readonly<ScrollRenderRange>
  _rangeCache: Partial<ScrollRenderRange>
  _direction: ListDirection
  _hasPendingRender: boolean
}

interface AbstractListData {
  scrollDirection: ScrollDirection
}

interface AbstractListMethods {
  onItemMeasure(index: number): void
  renderItemsRange(start: number, end: number): VNode[]
  renderItems(): VNode[]
  forceRenderInTick(): void
}

interface AbstractListComputed {}

export const enum ListDirection {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
}

interface AbstractListProps {
  /**
   * Indicates list is scrolling. This prop is passed to `item` slot for possible render optimizations.
   */
  isScrolling: boolean
  /**
   * Scroll position of the list. Depending upon `direction` prop, it should be `scrollTop` or `scrollLeft` of the scroll container.
   */
  scrollOffset: number
  /**
   * Direction of the list.
   *
   * - __vertical:__ A list scrolling top to bottom.
   * - __horizontal:__ A list scrolling left to right.
   */
  direction: ListDirection
  /**
   * Number of items in the list.
   */
  itemsCount: number
  /**
   * Number of extra items to render outside the viewport.
   */
  overscanItemsCount: number
  /**
   * Height or width of the viewport. (depends on `direction`)
   */
  viewportSize: number
  /**
   * Estimated width/height of an item.
   */
  estimatedItemSize: number
  /**
   * Number of items (from start of the list) to be rendered always.
   */
  prefixFixedItemsCount: number
  /**
   * Number of items (from end of the list) to be rendered always.
   */
  suffixFixedItemsCount: number
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
      scrollOffset: PropTypes.number.isRequired,
      viewportSize: PropTypes.number.isRequired,
      itemsCount: PropTypes.number.isRequired,
      estimatedItemSize: PropTypes.number.isRequired,
      overscanItemsCount: PropTypes.number.defaultValue(3),
      prefixFixedItemsCount: PropTypes.number.defaultValue(0),
      suffixFixedItemsCount: PropTypes.number.defaultValue(0),
      direction: PropTypes.oneOf(
        ListDirection.HORIZONTAL,
        ListDirection.VERTICAL
      ).defaultValue(ListDirection.VERTICAL),
      isScrolling: PropTypes.bool.defaultValue(false),
    },

    provide() {
      const provide = {}

      Object.defineProperties(provide, {
        [InjectKey.MEASURE_CACHE]: {
          get: () => this.sizeManager,
        },
        [InjectKey.RESIZE_OBSERVER]: {
          get: () => this.resizeObserver,
        },
      })

      return provide
    },

    data() {
      return {
        scrollDirection: ScrollDirection.FORWARD,
      }
    },

    created() {
      const vm = this
      this._direction = this.direction

      const sizes = createMeasureCache({
        key: row => `${row}`,
        height: this.estimatedItemSize,
        width: this.estimatedItemSize,
      })

      const position = createCompressedPositionManager({
        count: this.itemsCount,
        estimatedCellSize: this.estimatedItemSize,
        sizeGetter:
          this._direction === ListDirection.HORIZONTAL
            ? index => (sizes.has(index) ? sizes.get(index).width : null)
            : index => (sizes.has(index) ? sizes.get(index).height : null),
      })

      this.sizeManager = sizes
      this.positionManager = position

      this._rangeCache = {}
      this.range = {
        get visible() {
          return (
            vm._rangeCache.visible ||
            (vm._rangeCache.visible = position.find(
              vm.scrollOffset,
              vm.viewportSize
            ))
          )
        },
        get rendered() {
          return overScanRange(
            vm.range.visible,
            vm.scrollDirection,
            vm.overscanItemsCount,
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

      this.instanceCache = {}
    },

    destroyed() {
      const instances = Object.values(this.instanceCache)

      delete this.instanceCache
      delete this.positionManager
      delete this.sizeManager

      instances.forEach(vnode => {
        if (vnode.componentInstance) vnode.componentInstance.$destroy()
      })
    },

    methods: {
      onItemMeasure(index) {
        this.positionManager.unset(index)
        this.forceRenderInTick()
      },

      forceRenderInTick() {
        if (this._hasPendingRender) {
          return
        }

        this._hasPendingRender = true

        this.$nextTick(() => {
          this.$forceUpdate()
        })
      },

      renderItemsRange(start, end) {
        const children = []
        const offsetAdjustment = this.positionManager.adjustOffset(
          this.scrollOffset,
          this.viewportSize
        )
        const {
          isScrolling,
          keepAliveInstancePoolSize,
          prefixFixedItemsCount,
          suffixFixedItemsCount,
        } = this
        const maxFixedPrefix = prefixFixedItemsCount
        const minFixedSuffix = this.itemsCount - suffixFixedItemsCount - 1
        const sizeKey =
          this._direction === ListDirection.HORIZONTAL ? 'width' : 'height'
        for (let index = start; index <= end; ++index) {
          const { offset, size } = this.positionManager.get(index)
          const isFixedStart = index < maxFixedPrefix
          const isFixedEnd = index > minFixedSuffix
          const isFixed = isFixedStart || isFixedEnd
          const key = isFixed
            ? `index:${index}`
            : `key:${index % keepAliveInstancePoolSize}`
          const compressedOffset = offset + offsetAdjustment

          const vnode = this.$createElement(
            Measure,
            {
              keepAlive: true,
              key,
              attrs: { key },
              props: {
                rowIndex: index,
                [sizeKey]: size,
              },
              on: { measure: this.onItemMeasure },
            },
            this.$scopedSlots.item!({
              key,
              index,
              offset,
              size,
              isScrolling,
              isFixed,
              isFixedStart,
              isFixedEnd,
              compressedOffset,
            })
          )

          if (this.instanceCache[key]) {
            vnode.componentInstance = this.instanceCache[key].componentInstance
          } else {
            this.instanceCache[key] = vnode
          }
          children.push(vnode)
        }

        return children
      },

      renderItems() {
        const { start, end } = this.range.rendered

        const children: VNode[] = []

        let actualStart = start
        let actualEnd = end

        if (this.prefixFixedItemsCount) {
          children.push(
            ...this.renderItemsRange(0, this.prefixFixedItemsCount - 1)
          )

          actualStart = Math.max(this.prefixFixedItemsCount, start)
        }

        const suffixStart = this.itemsCount - this.suffixFixedItemsCount

        if (this.suffixFixedItemsCount) {
          actualEnd = Math.min(end, suffixStart - 1)
        }

        children.push(...this.renderItemsRange(actualStart, actualEnd))

        if (this.suffixFixedItemsCount) {
          children.push(
            ...this.renderItemsRange(suffixStart, this.itemsCount - 1)
          )
        }
        return children
      },
    },

    watch: {
      itemsCount(newCount: number) {
        if (this.positionManager.length !== newCount) {
          this.positionManager.configure({
            count: newCount,
          })
          this.forceRenderInTick()
        }
      },
      scrollOffset(newOffset: number, oldOffset: number = 0) {
        this.scrollDirection =
          oldOffset < newOffset
            ? ScrollDirection.FORWARD
            : ScrollDirection.REVERSE
      },
    },

    render() {
      this._hasPendingRender = false // rendering now
      this._rangeCache = {} // bust range caches

      // Compute keepAlive pool size
      this.keepAliveInstancePoolSize = Math.max(
        this.keepAliveInstancePoolSize || 2,
        this.range.rendered.end - this.range.rendered.start + 1
      )

      const container = getFirstVnode(
        this.$scopedSlots.container!({ size: this.positionManager.size })
      )

      container.children = this.renderItems()

      return container
    },
  })
)
