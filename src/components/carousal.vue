<script lang="ts">
import Vue from 'vue'
import PropTypes from '@znck/prop-types'
import AbstractList from './abstract-list'
import { mergeVnode, getFirstVnode, contract } from '../helpers'

interface ListComputed {
  count: number
  getProps: (index: number) => { index: number; item: any }
}

interface ListProps {
  tag: string
  items: any[] | number
  width: number
  buffer: number
  itemWidth: number
}

export default contract(
  Vue.extend<{}, {}, ListComputed, ListProps>({
    name: 'Carousal',

    components: {
      AbstractList,
    },

    inheritAttrs: false,

    props: {
      tag: PropTypes.string.value('div'),
      items: PropTypes.oneOfType(PropTypes.number, PropTypes.array).isRequired,
      width: PropTypes.number.isRequired,
      buffer: PropTypes.number.value(3),
      itemWidth: PropTypes.number.value(100),
    },

    computed: {
      count() {
        return typeof this.items === 'number' ? this.items : this.items.length
      },
      getProps() {
        if (typeof this.items === 'number')
          return (index: number) => ({ index, item: index })

        return (index: number) => ({ index, item: (this.items as any)[index] })
      },
    },

    render(h) {
      return h(AbstractList, {
        props: {
          horizontal: true,
          itemsCount: this.count,
          overscanCount: this.buffer,
          containerSize: this.width,
          estimatedItemSize: this.itemWidth,
        },
        scopedSlots: {
          item: ({ index, compressedOffset }) => {
            const vnode = getFirstVnode(
              this.$scopedSlots.default!(this.getProps(index))
            )

            mergeVnode(vnode, {
              data: {
                style: {
                  position: 'absolute',
                  top: '0',
                  left: `${compressedOffset}px`,
                  height: '100%',
                },
              },
            })

            return [vnode]
          },
          container: ({ size }) => [
            h('div', {
              style: {
                width: size + 'px',
                overflowX: 'auto',
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
                height: '100%',
                width: size + 'px',
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
