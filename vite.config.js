import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || 'http://127.0.0.1:8000'

  // 复制sql.js的WASM文件到public目录
  const wasmSrc = resolve('node_modules/sql.js/dist/sql-wasm.wasm')
  const wasmDest = resolve('public/sql-wasm.wasm')
  if (existsSync(wasmSrc) && !existsSync(wasmDest)) {
    copyFileSync(wasmSrc, wasmDest)
    console.log('✓ 已复制 sql-wasm.wasm 到 public 目录')
  }

  return {
    plugins: [vue()],
    base: './', // 使用相对路径，便于部署到子目录
    build: {
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'vue-router'],
            utils: ['marked', 'sql.js']
          }
        }
      }
    },
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
