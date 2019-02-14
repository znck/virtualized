// @ts-ignore
// import devtools from '@vue/devtools'
import Vue from 'vue'
import App from './app.vue'

console.log('Using vue ' + Vue.version)

Vue.config.performance = true
Vue.config.devtools = true
Vue.config.silent = false

if (process.env.NODE_ENV !== 'production') {
  // devtools.connect(
  //   '192.168.0.100', 8098
  // )
}

new Vue({
  el: '#app',
  render: h => h(App),
})
