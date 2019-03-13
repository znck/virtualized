import Vue from 'vue'
import PropTypes from '@znck/prop-types'
import AbstractList from './abstract-list'
import { mergeVnode, getFirstVnode, contract } from '../helpers'

interface CarousalInterface extends Vue {
  _scrollLeftFrame: number
  _isScrollingTimeout: number
}

interface CarousalComputed {
  count: number
}

interface CarousalProps {
  tag: string
  items: any[] | number
  width: number
  itemWidth: number
  buffer: number
}

interface CarousalData {
  scrollLeft: number
  isScrolling: boolean
}

interface CarousalMethods {
  onScroll(event: MouseEvent): void
}

export default contract(
  Vue.extend<
    CarousalInterface,
    CarousalData,
    CarousalMethods,
    CarousalComputed,
    CarousalProps
  >({
    name: 'Carousal',

    components: {
      AbstractList,
    },

    inheritAttrs: false,

    props: {
      tag: PropTypes.string.defaultValue('div'),
      items: PropTypes.oneOfType(PropTypes.number, PropTypes.array).isRequired,
      width: PropTypes.number.isRequired,
      buffer: PropTypes.number.defaultValue(3),
      itemWidth: PropTypes.number.defaultValue(100),
    },

    data() {
      return {
        scrollLeft: 0,
        isScrolling: false,
      }
    },

    computed: {
      count() {
        return typeof this.items === 'number' ? this.items : this.items.length
      },
    },

    methods: {
      onScroll(event) {
        if (!this._scrollLeftFrame) {
          this._scrollLeftFrame = requestAnimationFrame(() => {
            this._scrollLeftFrame = 0

            this.scrollLeft = this.$el.scrollLeft
          })
        }

        if (!this.isScrolling) this.isScrolling = true

        clearTimeout(this._isScrollingTimeout)
        this._isScrollingTimeout = window.setTimeout(() => {
          this.isScrolling = false
        }, 100)
      },
    },

    render(h) {
      const items = Array.isArray(this.items) ? this.items : []

      return h(
        'div',
        {
          style: {
            height: this.width + 'px',
            overflowY: 'auto',
            boxSizing: 'border-box',
            '-webkit-overflow-scrolling': 'touch',
          },
          props: { ...this.$attrs },
          on: { ...this.$listeners, '&scroll': this.onScroll },
        },
        [
          h(AbstractList, {
            props: {
              scrollOffset: this.scrollLeft,
              viewportSize: this.width,
              itemsCount: this.count,
              estimatedItemSize: this.itemWidth,
              direction: 'horizontal',
              overscanCount: this.buffer,
              isScrolling: this.isScrolling,
            },
            scopedSlots: {
              item: ({
                index,
                compressedOffset,
              }: {
                index: number
                compressedOffset: number
              }) => {
                const vnode = getFirstVnode(
                  this.$scopedSlots.default!({ index, item: items[index] })
                )

                mergeVnode(vnode, {
                  data: {
                    style: {
                      position: 'absolute',
                      top: 0,
                      left: `${compressedOffset}px`,
                      height: '100%',
                    },
                  },
                })

                return [vnode]
              },
              container: ({ size }: { size: number }) => [
                h(this.tag, {
                  style: {
                    height: '100%',
                    width: size + 'px',
                    position: 'relative',
                    overflow: 'hidden',
                  },
                }),
              ],
            },
          }),
        ]
      )
    },
  })
)
