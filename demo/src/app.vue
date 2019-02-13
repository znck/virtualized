<script>
import List from '../../src/components/list'
import Item from './components/item'

export default {
  components: {
    List,
    Item,
  },
  data() {
    return {
      height: 800,
      items: Array(1000)
        .fill(0)
        .map(() => Math.random()),
    }
  },
}
</script>

<template>
  <div class="app">
    <List :items="items" :height="height" v-slot="{ index, item }">
      <div class="item" :style="{backgroundColor: `hsl(${(index * 10) % 361}, 60%, 80%)` }">
        <img :src="`https://picsum.photos/400/200?image=${index}`">
        <Item :msg="`${item} at index ${index}`"/>
      </div>
    </List>
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
}

.item:hover {
  filter: sepia();
}
</style>
