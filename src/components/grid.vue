<script lang="ts">
import Vue from 'vue'
import PropTypes from '@znck/prop-types'
import AbstractGrid from './abstract-grid'
import { mergeVnode, getFirstVnode, contract } from '../helpers'

interface ListComputed {
  rowCount: number
  columnCount: number
}

interface ListProps {
  tag: string
  items: any[][]
  width: number
  height: number
  buffer: number
  itemHeight: number
  itemWidth: number
}

export default contract(
  Vue.extend<{}, {}, ListComputed, ListProps>({
    name: 'Grid',

    inheritAttrs: false,

    props: {
      tag: PropTypes.string.value('div'),
      items: PropTypes.arrayOf(PropTypes.array).isRequired,
      width: PropTypes.number.isRequired,
      height: PropTypes.number.isRequired,
      buffer: PropTypes.number.value(1),
      itemHeight: PropTypes.number.value(100),
      itemWidth: PropTypes.number.value(100),
    },

    computed: {
      rowCount() {
        return this.items.length
      },
      columnCount() {
        return this.items.reduce(
          (acc: number, items: any[]) => Math.max(acc, items.length),
          0
        )
      },
    },

    render(h) {
      const items = this.items
      const renderCell = this.$scopedSlots.default!
      const attrs = { ...this.$attrs }
      const listeners = { ...this.$listeners }
      const vnode = h(AbstractGrid, {
        props: {
          rowCount: this.rowCount,
          columnCount: this.columnCount,
          containerWidth: this.width,
          containerHeight: this.height,
          estimatedItemWidth: this.itemWidth,
          estimatedItemHeight: this.itemHeight,
          overscanCountVertical: this.buffer,
          overscanCountHorizontal: this.buffer,
        },
        scopedSlots: {
          // row: () => {
          //   return [
          //     h('div')
          //   ]
          // },
          cell: meta => {
            const {
              row,
              column,
              height,
              width,
              compressedOffsetLeft,
              compressedOffsetTop,
            } = meta
            const vnode = getFirstVnode(
              renderCell({
                item: items[row][column],
                ...meta,
              })
            )

            mergeVnode(vnode, {
              data: {
                style: {
                  position: 'absolute',
                  top: `${compressedOffsetTop}px`,
                  left: `${compressedOffsetLeft}px`,
                  minWidth: width + 'px',
                  minHeight: height + 'px',
                },
              },
            })

            return [vnode]
          },
          container: ({ width, height }) => [
            h('div', {
              style: {
                width: width + 'px',
                height: height + 'px',
                overflow: 'auto',
                boxSizing: 'border-box',
                '-webkit-overflow-scrolling': 'touch',
              },
              props: attrs,
              on: listeners,
            }),
          ],
          contents: ({ width, height }) => [
            h(this.tag, {
              style: {
                height: height + 'px',
                width: width + 'px',
                position: 'relative',
                overflow: 'hidden',
              },
            }),
          ],
        },
      })

      return vnode
    },
  })
)
</script>
