import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

const routes = [
  { name: 'home', path: '/', component: () => import('./home.vue') },
  { name: '1d', path: '/demo/1d', component: () => import('./demo-1d.vue') },
  { name: '2d', path: '/demo/2d', component: () => import('./demo-2d.vue') },
]

export default new Router({
  routes,
})
