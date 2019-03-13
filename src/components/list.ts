import Vue from 'vue'
import PropTypes from '@znck/prop-types'
import AbstractList from './abstract-list'
import { getFirstVnode, contract } from '../helpers'

interface ListInterface extends Vue {
  _scrollTopFrame: number
  _isScrollingTimeout: number
}

interface ListComputed {
  count: number
}

interface ListProps {
  tag: string
  items: any[] | number
  height: number
  buffer: number
  itemHeight: number
}

interface ListData {
  scrollTop: number
  isScrolling: boolean
}

interface ListMethods {
  onScroll(event: MouseEvent): void
}

export default contract(
  Vue.extend<ListInterface, ListData, ListMethods, ListComputed, ListProps>({
    name: 'List',

    components: {
      AbstractList,
    },

    inheritAttrs: false,

    props: {
      tag: PropTypes.string.defaultValue('div'),
      items: PropTypes.oneOfType(PropTypes.number, PropTypes.array).isRequired,
      height: PropTypes.number.isRequired,
      buffer: PropTypes.number.defaultValue(3),
      itemHeight: PropTypes.number.defaultValue(100),
    },

    data() {
      return {
        scrollTop: 0,
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
        if (!this._scrollTopFrame) {
          this._scrollTopFrame = requestAnimationFrame(() => {
            this._scrollTopFrame = 0

            this.scrollTop = this.$el.scrollTop
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
            height: this.height + 'px',
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
              scrollOffset: this.scrollTop,
              viewportSize: this.height,
              itemsCount: this.count,
              estimatedItemSize: this.itemHeight,
              overscanCount: this.buffer,
              isScrolling: this.isScrolling,
              prefixFixedItemsCount: 1,
              suffixFixedItemsCount: 1,
            },
            scopedSlots: {
              item: props => {
                const { index, compressedOffset } = props
                const vnode = getFirstVnode(
                  this.$scopedSlots.default!({ ...props, item: items[index] })
                )

                vnode.data = {
                  ...vnode.data,
                  style: {
                    width: '100%',
                    ...(vnode.data && vnode.data.style),
                    position: 'absolute',
                    top: `${compressedOffset}px`,
                  },
                }

                return [vnode]
              },
              container: ({ size }) => [
                h(this.tag, {
                  style: {
                    height: size + 'px',
                    width: '100%',
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
