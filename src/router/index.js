import { createRouter, createWebHistory } from 'vue-router'
import Chat from '../views/Chat.vue'

const routes = [
    { path: '/chat', component: Chat },
    // 可以在这里添加其他页面路由
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

export default router
