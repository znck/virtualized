<script>
import List from '../../src/components/list'
import Carousal from '../../src/components/carousal'
import Item from './components/item'

export default {
  components: {
    Carousal,
    List,
    Item,
  },
  data() {
    return {
      height: ~~((window.innerHeight - 16) * 0.33333),
      width: window.innerWidth - 16,
      items: Array(100)
        .fill(0)
        .map(() => Math.random()),
    }
  },
  mounted() {
    window.addEventListener('resize', () => {
      this.height = ~~((window.innerHeight - 16) * 0.33333)
      this.width = window.innerWidth - 16
    })
  }
}
</script>

<template>
  <div class="app">
    <Carousal :items="items" :width="width" :item-width="440" v-slot="{ index, item, key }" :style="{ height: height + 'px' }">
      <div class="item" :style="{backgroundColor: `hsl(${(index * 10) % 361}, 60%, 80%)`, width: '440px' }">
        <img :key="key" :src="`https://picsum.photos/400/200?image=${index % 10}`">
        <Item :msg="`${item} at index ${index}`"/>
      </div>
    </Carousal>
    <List :items="items" :height="height * 2" v-slot="{ index, item, key }">
      <div class="item" :style="{backgroundColor: `hsl(${(index * 10) % 361}, 60%, 80%)` }">
        <img :key="key" :src="`https://picsum.photos/400/200?image=${index % 10}`">
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

html {
  padding: 0;
}

body {
  margin: 0;
  padding: 8px;
}
</style>
