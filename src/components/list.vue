<script lang="ts">
import Vue from 'vue'
import PropTypes from '@znck/prop-types'
import AbstractList from './abstract-list'
import { mergeVnode, getFirstVnode, contract } from '../helpers'

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

export default contract(
  Vue.extend<{}, {}, ListComputed, ListProps>({
    name: 'List',

    components: {
      AbstractList,
    },

    inheritAttrs: false,

    props: {
      tag: PropTypes.string.value('div'),
      items: PropTypes.oneOfType(PropTypes.number, PropTypes.array).isRequired,
      height: PropTypes.number.isRequired,
      buffer: PropTypes.number.value(3),
      itemHeight: PropTypes.number.value(100),
    },

    computed: {
      count() {
        return typeof this.items === 'number' ? this.items : this.items.length
      },
    },

    render(h) {
      const items = Array.isArray(this.items) ? this.items : []

      return h(AbstractList, {
        props: {
          itemsCount: this.count,
          overscanCount: this.buffer,
          containerSize: this.height,
          estimatedItemSize: this.itemHeight,
        },
        scopedSlots: {
          item: ({ index, compressedOffset }) => {
            const vnode = getFirstVnode(
              this.$scopedSlots.default!({ index, item: items[index] })
            )

            mergeVnode(vnode, {
              data: {
                style: {
                  position: 'absolute',
                  top: `${compressedOffset}px`,
                  width: '100%',
                },
              },
            })

            return [vnode]
          },
          container: ({ size }) => [
            h('div', {
              style: {
                height: size + 'px',
                overflowY: 'auto',
                boxSizing: 'border-box',
                '-webkit-overflow-scrolling': 'touch',
              },
              props: { ...this.$attrs },
              on: { ...this.$listeners },
            }),
          ],
          contents: ({ size }) => [
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
      })
    },
  })
)
</script>
