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
      items: Array(5000)
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
    <Carousal :items="items" :width="width" :item-width="340" v-slot="{ index, item, key }" :style="{ height: height + 'px' }">
      <div class="item" :style="{backgroundColor: `hsl(${(index * 10) % 361}, 60%, 80%)`, width: '340px' }">
        <img :key="key" :src="`https://picsum.photos/300/150?image=${index % 10}`">
        <Item :msg="`${item} at index ${index}`"/>
      </div>
    </Carousal>
    <List :items="items" :height="height * 2" v-slot="{ index, item, key, isFixedStart }">
      <div class="item" :style="{backgroundColor: `hsl(${(index * 10) % 361}, 60%, 80%)`, position: isFixedStart ? 'sticky' : '', top: 0 }">
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
  box-sizing: border-box;
}

.item img {
  max-height: 75%;
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
