<script>
import PropTypes from '@znck/prop-types'
import AbstractList from './abstract-list'

export default {
  name: 'List',

  components: {
    AbstractList,
  },

  inheritAttrs: false,

  props: {
    tag: PropTypes.string.value('div'),
    items: PropTypes.oneOfType(PropTypes.number, PropTypes.array).isRequired,
    height: PropTypes.number.isRequired,
    buffer: PropTypes.number.value(1),
    itemHeight: PropTypes.number.value(100),
  },

  computed: {
    count() {
      return typeof this.items === 'number' ? this.items : this.items.length
    },
  },

  methods: {
    valueOf(index) {
      if (typeof this.items === 'number') return { index, item: index }
      return {
        index,
        item: this.items[index],
      }
    },
  },

  render(h) {
    return h(AbstractList, {
      props: {
        itemsCount: this.count,
        overscanCount: this.buffer,
        containerHeight: this.height,
        estimatedItemHeight: this.itemHeight,
      },
      scopedSlots: {
        item: ({ index }) => this.$scopedSlots.default(this.valueOf(index)),
        container: () => h('div', { props: { ...this.$attrs }, on: { ...this.$listeners } }),
        contents: () => h(this.tag),
      }
    })
  }
}
</script>
