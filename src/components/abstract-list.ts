import Vue, { VNode } from 'vue'
import PropTypes from '@znck/prop-types'
import { InjectKey, ScrollDirection, ScrollTrigger } from '../constants'
import {
  createMeasureCache,
  overScanRange,
  getWrapperVnode,
  MeasureCache,
  ScaledPositionManager,
  createScalingPositionManager,
  IndexRange,
  mergeVnode,
  contract,
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
  manager: ScaledPositionManager
  vnodeCache: { [key: number]: VNode }
  current: ScrollRenderRange
  savedScrollState: ScrollRenderState
  poolSize: number
  _scrollToIndex: number | null
  _hasPendingRender: (() => void) | null
  _ignoreScrollEvents: boolean
}
interface AbstractListData {
  scrollTop: number
  scrollToIndex: number
  scrollTrigger: ScrollTrigger
  scrollDirection: ScrollDirection
}
interface AbstractListMethods {
  onScroll(event: MouseEvent): void
  onItemMeasure(index: number): void
  computePoolSize(): void
  computeScrollPosition(scrollTop: number, trigger: ScrollTrigger): void
  saveCurrentScrollState(): void
  forceRenderInNextFrame(done: () => void): void
  renderItem(index: number): VNode
  renderListItems(): VNode[]
}
interface AbstractListComputed {}
interface AbstractListProps {
  itemsCount: number
  overscanCount: number
  containerHeight: number
  estimatedItemHeight: number
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
      containerHeight: PropTypes.number.isRequired,
      itemsCount: PropTypes.number.isRequired,
      overscanCount: PropTypes.number.value(1),
      estimatedItemHeight: PropTypes.number.value(30),
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
        scrollDirection: ScrollDirection.FORWARD,
        scrollTrigger: ScrollTrigger.NONE,
        scrollToIndex: 0,
      }
    },

    created() {
      const vm = this
      const measured = (this.measured = createMeasureCache({
        height: this.estimatedItemHeight,
        key: row => `${row}`,
      }))
      const manager = (this.manager = createScalingPositionManager({
        count: this.itemsCount,
        estimatedCellSize: this.estimatedItemHeight,
        sizeGetter: index =>
          measured.has(index) ? measured.get(index).height : null,
      }))

      this.current = {
        get visible() {
          return manager.find(vm.scrollTop, vm.containerHeight)
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
            this.scrollToIndex = this._scrollToIndex
          }
        })
      },
      saveCurrentScrollState() {
        const index = this.current.visible.start
        const { offset, size } = this.manager.get(index)
        let occluded = 0

        if (offset <= this.scrollTop && this.scrollTop <= offset + size) {
          occluded = this.scrollTop - offset
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

        const scrollTop = Math.max(0, el.scrollTop)
        this._scrollToIndex = null // cancel pending scroll to index

        this.computeScrollPosition(scrollTop, ScrollTrigger.OBSERVED)
      },

      computeScrollPosition(scrollTop, trigger = ScrollTrigger.REQUESTED) {
        if (scrollTop < 0) return // Guard against negative scroll

        if (scrollTop !== this.scrollTop) {
          this.scrollTrigger = trigger
          this.scrollDirection =
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
        const { start, end } = this.current.rendered

        this.poolSize = Math.max(this.poolSize || 1, end - start + 1)
      },

      renderItem(index) {
        const { offset, size: height } = this.manager.get(index)
        const key = index % this.poolSize
        const vnode = this.$createElement(
          Measure,
          {
            keepAlive: true,
            key,
            style: {
              position: 'absolute',
              top: `${offset}px`,
              width: '100%',
            },
            attrs: { key },
            props: { rowIndex: index },
            on: { measure: this.onItemMeasure },
          },
          [
            this.$scopedSlots.item!({
              index,
              offset,
              height,
            }),
          ]
        )

        if (this.vnodeCache[key])
          vnode.componentInstance = this.vnodeCache[key].componentInstance
        else this.vnodeCache[key] = vnode

        return vnode
      },

      renderListItems() {
        const { start, end } = this.current.rendered
        const children = []

        for (let i = start; i <= end; ++i) {
          children.push(this.renderItem(i))
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

      const container = getWrapperVnode(this.$scopedSlots.container) || h('div')
      const contents = getWrapperVnode(this.$scopedSlots.contents) || h('div')

      mergeVnode(container, {
        data: {
          style: {
            height: this.containerHeight + 'px',
            overflowY: 'auto',
            boxSizing: 'border-box',
          },
          on: { scroll: this.onScroll },
        },
        children: [contents],
      })

      mergeVnode(contents, {
        data: {
          style: {
            height: this.manager.size + 'px',
            position: 'relative',
            overflow: 'hidden',
          },
        },
        children: this.renderListItems(),
      })

      return container
    },
  })
)
