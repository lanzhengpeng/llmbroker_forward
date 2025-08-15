import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [vue()],
    server: {
      host: true,
  port: 25679,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          // 去掉 /api 前缀再转发
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // 在终端打印代理的目标与路径
              console.log('[proxyReq]', req.method, req.url, '->', options.target)
            })
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('[proxyRes]', req.method, req.url, proxyRes.statusCode)
            })
          },
        },
      },
    },
  }
})
