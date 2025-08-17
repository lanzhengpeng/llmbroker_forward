# 部署检查清单 ✅

## 📋 部署前检查

### ✅ 构建检查
- [x] 项目构建成功 (`npm run build`)
- [x] 构建产物生成正常 (dist/ 目录)
- [x] 静态资源正确复制 (sql-wasm.wasm, db/config.db)

### 🔧 配置检查
- [x] API目标地址已配置 (`VITE_API_TARGET=http://124.222.61.180:8000`)
- [x] Vite代理配置正确
- [x] Vue Router配置为 history 模式

### ⚠️ 部署注意事项

1. **服务器配置**
   - 需要配置SPA fallback，所有路由都应该返回 index.html
   - 确保服务器支持 MIME 类型：
     - `.wasm` -> `application/wasm`
     - `.js` -> `text/javascript` 或 `application/javascript`
     - `.css` -> `text/css`

2. **后端API配置**
   - 确保后端服务 `http://124.222.61.180:8000` 可访问
   - 检查CORS配置，允许前端域名访问
   - 确保API端点正常工作：
     - `/chat/stream`
     - `/chat/mcp/stream`
     - `/models`
     - `/tools`
     - `/tools/register`

3. **数据库文件**
   - SQLite数据库文件 `db/config.db` 已包含在构建中
   - 确保浏览器能正确加载 `.wasm` 文件

## 🚀 推荐部署方式

### Nginx配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/your/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # WASM文件MIME类型
    location ~* \.wasm$ {
        add_header Content-Type application/wasm;
        add_header Cache-Control "public, max-age=31536000";
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        add_header Cache-Control "public, max-age=31536000";
    }

    # 数据库文件
    location /db/ {
        add_header Cache-Control "public, max-age=86400";
    }
}
```

### Apache配置示例
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/your/dist
    
    # SPA fallback
    <Directory "/path/to/your/dist">
        AllowOverride All
        Require all granted
        FallbackResource /index.html
    </Directory>
    
    # WASM文件MIME类型
    AddType application/wasm .wasm
    
    # 缓存策略
    <FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
    </FilesMatch>
</VirtualHost>
```

## 🔍 部署后测试

1. **基本功能测试**
   - [ ] 首页正常加载
   - [ ] 路由跳转正常 (`/`, `/chat`, `/projects`)
   - [ ] 静态资源加载正常

2. **聊天功能测试**
   - [ ] 能够发送消息
   - [ ] 流式响应正常
   - [ ] 思考动画正常显示
   - [ ] MCP工具调用正常

3. **项目展示测试**
   - [ ] 项目列表正常显示
   - [ ] 搜索功能正常
   - [ ] 标签筛选正常
   - [ ] 数据库查询正常

4. **响应式测试**
   - [ ] 桌面端显示正常
   - [ ] 移动端适配正常
   - [ ] 各种屏幕尺寸兼容

## ⚡ 性能优化建议

1. **启用Gzip压缩**
2. **配置静态资源缓存**
3. **使用CDN加速静态资源**
4. **启用HTTP/2**

## 🐛 常见问题

1. **刷新页面404**
   - 原因：SPA路由问题
   - 解决：配置服务器fallback到index.html

2. **WASM文件加载失败**
   - 原因：MIME类型配置错误
   - 解决：配置`.wasm`文件MIME类型为`application/wasm`

3. **API请求失败**
   - 原因：CORS配置或后端服务不可用
   - 解决：检查后端CORS设置和服务状态

4. **数据库查询失败**
   - 原因：SQLite文件路径错误
   - 解决：确保`db/config.db`文件正确部署
