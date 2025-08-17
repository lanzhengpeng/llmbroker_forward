# LLM Broker Forward

🚀 一个现代化的大语言模型聊天应用前端，支持流式对话、MCP工具调用和项目展示。

## ✨ 特性

### 💬 智能聊天
- **流式响应**：实时显示AI回复内容，支持打字机效果
- **思考动画**：等待AI响应时的优雅动画效果和思考时间显示
- **MCP工具集成**：支持Model Context Protocol工具调用
- **自适应输入框**：输入框根据内容自动调整高度和圆角
- **Markdown渲染**：支持富文本消息显示

### 📱 现代化界面
- **响应式设计**：完美适配桌面端和移动端
- **暗色主题**：护眼的深色主题设计
- **流畅动画**：丰富的过渡动画和交互效果
- **高级布局**：使用CSS Grid和Flexbox打造现代布局

### 🛠️ MCP工具管理
- **工具注册**：支持通过curl命令注册自定义工具
- **工具列表**：管理和配置可用的MCP工具
- **动态调用**：AI可根据需要自动调用合适的工具

### 📂 项目展示
- **项目管理**：基于SQLite数据库的项目展示系统
- **标签筛选**：按技术标签过滤项目
- **搜索功能**：快速查找项目
- **响应式卡片**：优雅的项目卡片布局

## 🔧 技术栈

- **前端框架**：Vue 3 + Composition API
- **构建工具**：Vite
- **路由管理**：Vue Router 4
- **数据库**：SQLite (sql.js)
- **Markdown**：marked
- **样式**：原生CSS + CSS Grid/Flexbox

## 📦 安装

```bash
# 克隆项目
git clone https://github.com/lanzhengpeng/llmbroker_forward.git
cd llmbroker_forward

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 🚀 使用

### 开发环境

```bash
# 默认开发模式 (端口 25679)
npm run dev

# 指定模式开发
npm run dev:8      # mode 8
npm run dev:124    # mode 124
```

### 生产构建

```bash
# 默认构建
npm run build

# 指定模式构建
npm run build:8
npm run build:124

# 预览构建结果
npm run preview
```

### 环境配置

创建 `.env` 文件配置后端API地址：

```env
# 后端API地址 (默认: http://127.0.0.1:8000)
VITE_API_TARGET=http://your-backend-url:port
```

## 🏗️ 项目结构

```
llmbroker_forward/
├── public/                 # 静态资源
│   ├── sql-wasm.wasm      # SQLite WASM文件
│   └── db/                # 数据库文件
│       └── config.db      # 项目配置数据库
├── src/
│   ├── assets/            # 静态资源
│   │   └── home/          # 首页图标
│   ├── components/        # 公共组件
│   ├── router/           # 路由配置
│   │   └── index.js
│   ├── views/            # 页面组件
│   │   ├── Index.vue     # 首页
│   │   ├── Chat.vue      # 聊天页面
│   │   └── Projects.vue  # 项目展示
│   ├── App.vue           # 根组件
│   ├── main.js           # 入口文件
│   └── style.css         # 全局样式
├── vite.config.js        # Vite配置
└── package.json          # 项目配置
```

## 🎨 功能特色

### 智能思考动画
聊天页面在等待AI响应时会显示优雅的思考动画：
- 呼吸式缩放的圆形气泡
- 三个点的跳动效果
- 实时显示思考时间

### 动态输入框
输入框会根据内容智能调整：
- 单行时为药丸形状
- 多行时自动变成圆角矩形
- 超过最大高度时显示滚动条

### MCP工具系统
支持Model Context Protocol工具：
- 通过curl命令注册工具
- 可视化管理工具列表
- AI自动调用相关工具

### 项目展示系统
基于SQLite的项目管理：
- 支持项目图片、描述、标签
- 实时搜索和标签筛选
- 响应式卡片布局

## 🔌 API接口

前端通过代理访问后端API，主要接口包括：

- `POST /chat/stream` - 普通流式聊天
- `POST /chat/mcp/stream` - MCP工具增强聊天
- `GET /models` - 获取可用模型列表
- `GET /tools` - 获取工具列表
- `POST /tools/register` - 注册新工具

## 🎯 浏览器支持

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- 移动端浏览器

## 🤝 贡献

欢迎提交Issue和Pull Request！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👨‍💻 作者

**lanzhengpeng**

- GitHub: [@lanzhengpeng](https://github.com/lanzhengpeng)

## 🙏 致谢

感谢以下开源项目：
- [Vue.js](https://vuejs.org/) - 渐进式JavaScript框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [sql.js](https://sql.js.org/) - 浏览器中的SQLite
- [marked](https://marked.js.org/) - Markdown解析器

---

⭐ 如果这个项目对你有帮助，请给它一个星标！
