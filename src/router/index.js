import { createRouter, createWebHistory } from 'vue-router'
import Chat from '../views/Chat.vue'
import Test from "../views/Index.vue"
const Projects = () => import('../views/Projects.vue')

const routes = [
    { path: '/chat', component: Chat },
    { path: '/projects', component: Projects },
    { path: '/', component: Test }
    // 可以在这里添加其他页面路由
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

export default router
