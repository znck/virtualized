<script>
import Grid from '../../src/components/grid'
import Item from './components/item'

export default {
  components: {
    Grid,
    Item,
  },
  data() {
    return {
      height: window.innerHeight - 16,
      width: window.innerWidth - 16,
      items: Array(500)
        .fill(0)
        .map(() =>
          Array(500)
            .fill(0)
            .map(() => Math.random())
        ),
    }
  },
  mounted() {
    window.addEventListener('resize', () => {
      this.height = window.innerHeight - 16
      this.width = window.innerWidth - 16
    })
  },
}
</script>

<template>
  <div class="app">
    <Grid :items="items" :width="width" :height="height" v-slot="{ row, column, item }">
      <div
        class="item"
        :style="{backgroundColor: `hsl(${(row * 10) % 361}, ${50 + (column * 10) % 50}%, 80%)` }"
      >
        <Item :msg="`${''.padStart(~~(item * column) + 2, '0')} at index ${row}, ${column}`"/>
      </div>
    </Grid>
  </div>
</template>

<style>
.item {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.87);
  flex-direction: column;
  padding: 16px;
  box-sizing: border-box;
}

.item p {
  white-space: nowrap;
}

.item:hover {
  filter: sepia();
}

html {
  padding: 0;
}

body {
  margin: 0;
  padding: 8px;
}
</style>
