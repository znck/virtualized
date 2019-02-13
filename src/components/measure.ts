import Vue from 'vue'
import PropTypes from '@znck/prop-types'
import { InjectKey } from '../constants'
import { MeasureCache, Size, contract, mergeVnode } from '../helpers'
import ResizeObserver from 'resize-observer-polyfill'

export interface MeasureEventInit {
  contentRect: ResizeObserverEntry['contentRect']
}
export type MeasureEvent = CustomEvent<MeasureEventInit>

interface MeasureInstance extends Vue {
  cache: MeasureCache
  observer: ResizeObserver
  skipResize: boolean
  $el: HTMLElement
}

interface MeasureData {}

interface MeasureProps {
  rowIndex: number
  columnIndex: number
}

interface MeasureMethods {
  measure(): Size
  measureOrCached(force?: boolean): Size
  measureIfRequired(force?: boolean): void
  onMeasure(event: MeasureEvent): void
}

interface MeasureComputed {}

export default contract(
  Vue.extend<
    MeasureInstance,
    MeasureData,
    MeasureMethods,
    MeasureProps,
    MeasureComputed
  >({
    name: 'Measure',

    props: {
      rowIndex: PropTypes.number.isRequired,
      columnIndex: PropTypes.number.value(0),
    },

    inject: {
      cache: {
        from: InjectKey.MEASURE_CACHE,
      },
      observer: {
        from: InjectKey.RESIZE_OBSERVER,
      },
    },

    mounted() {
      this.measureIfRequired()
      if (this.$el) this.observer.observe(this.$el)
    },

    updated() {
      this.measureIfRequired()
      this.$nextTick(() => (this.skipResize = false))
    },

    methods: {
      measure(): Size {
        const height = ~~this.$el.offsetHeight
        const width = ~~this.$el.offsetWidth
        const size = { height, width }

        this.$emit('measure', this.rowIndex, this.columnIndex, size)

        return size
      },

      measureOrCached(force = false) {
        this.measureIfRequired(force)

        return this.cache.get(this.rowIndex, this.columnIndex)
      },

      onMeasure(event: MeasureEvent) {
        const { width, height } = event.detail.contentRect

        if (
          width &&
          height &&
          !this.cache.is(this.rowIndex, this.columnIndex, {
            width,
            height,
          })
        ) {
          this.measureIfRequired(true)
        }
      },

      measureIfRequired(force: boolean = false) {
        if (force || !this.cache.has(this.rowIndex, this.columnIndex)) {
          const size = this.measure()

          if (size === null) {
            // TODO: Why?
          }

          this.cache.set(this.rowIndex, this.columnIndex, size)
        }
      },
    },

    render() {
      const children = this.$scopedSlots.default!({
        measure: this.measureOrCached,
      })

      PropTypes.validate(() => {
        if (!children || children.length > 1)
          console.warn('Requires only on child element.')
      })

      return mergeVnode(children![0], {
        data: {
          on: {
            measure: this.onMeasure,
          },
          nativeOn: {
            measure: this.onMeasure,
          },
        },
      })
    },
  })
)
