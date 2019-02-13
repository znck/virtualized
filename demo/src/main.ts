import Vue from 'vue'
import App from './app.vue'

console.log('Using vue ' + Vue.version)

Vue.config.performance = true
Vue.config.devtools = true
Vue.config.silent = false

new Vue({
  el: '#app',
  render: h => h(App),
})
