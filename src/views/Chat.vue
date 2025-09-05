<template>
  <div class="chat-page">
    <!-- 左侧 MCP 工具栏 -->
    <aside
      class="sidebar"
      :class="{ open: isMobile && isSidebarOpen }"
      @touchstart="onSidebarTouchStart"
      @touchmove="onSidebarTouchMove"
      @touchend="onSidebarTouchEnd"
    >
      <div class="sidebar-header">
        <h2>MCP 工具栏</h2>
        <small>供大模型调用的工具，支持用户自动注册</small>
      </div>
      <div class="tool-actions tabs">
        <button
          class="tab-btn"
          :class="{ active: activeToolTab === 'add' }"
          @click="activeToolTab = 'add'"
        >
          添加工具
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeToolTab === 'list' }"
          :disabled="toolsLoading"
          @click="activeToolTab = 'list'; fetchTools()"
        >
          {{ toolsLoading ? "加载中..." : "获取工具列表" }}
        </button>
      </div>

      <!-- 侧栏内容区，仅此区域滚动 -->
      <div class="tool-content">
        <!-- 添加工具表单（仅当标签为 add 时显示） -->
        <div v-if="activeToolTab === 'add'" class="tool-form">
        <input v-model.trim="registerForm.name" class="input" placeholder="工具名称 (必填)" />
        <textarea
          v-model.trim="registerForm.description"
          class="input textarea"
          rows="3"
          placeholder="工具描述"
        ></textarea>
        <textarea
          v-model.trim="registerForm.curl"
          class="input textarea"
          rows="3"
          placeholder='curl 命令，例如：curl https://api.weatherapi.com/v1/current.json?q=Hefei'
        ></textarea>
        <label class="inline-flex"><input type="checkbox" v-model="registerForm.auth_required" />需要鉴权</label>
        <textarea
          v-model.trim="registerForm.modifiable_fields_text"
          class="input textarea"
          rows="3"
          placeholder='可修改字段 JSON，如 {"q":"城市名称"}'
        ></textarea>
        <textarea
          v-model.trim="registerForm.usage_example_text"
          class="input textarea"
          rows="3"
          placeholder='使用示例 JSON，如 {"q":"Hefei"}'
        ></textarea>
        <div class="btn-row">
          <button class="btn primary" :disabled="registerLoading" @click="registerTool">
            {{ registerLoading ? "提交中..." : "提交注册" }}
          </button>
          <button class="btn" :disabled="registerLoading" @click="resetRegisterForm">重置</button>
        </div>
        </div>

        <!-- 工具列表（仅当标签为 list 时显示） -->
        <div v-if="activeToolTab === 'list'" class="tool-list-wrap">
        <ul class="tool-list">
          <li v-for="tool in tools" :key="tool.id" class="tool-item">
            <div class="tool-main">
              <div class="tool-title">{{ tool.name }}</div>
              <div class="tool-desc">{{ tool.description }}</div>
              <code class="tool-endpoint" v-if="tool.endpoint">{{
                tool.endpoint
              }}</code>
            </div>
            <div class="tool-ops">
              <label class="inline-flex">
                <input
                  type="checkbox"
                  v-model="tool.enabled"
                  @change="saveTools"
                />启用
              </label>
              <button class="btn danger small" @click="removeTool(tool.id)">
                删除
              </button>
            </div>
          </li>
        </ul>
        </div>
      </div>

      <div class="tool-footer">
        <button class="btn small" @click="exportTools">导出配置</button>
        <button class="btn small" @click="clearToolsConfirm">清空全部</button>
      </div>
    </aside>

    <!-- 移动端遮罩，用于侧栏打开时点击关闭 -->
    <div
      v-if="isMobile && isSidebarOpen"
      class="overlay"
      @click="closeSidebar"
    ></div>

    <!-- 右侧聊天面板 -->
    <div
      class="chat-container chat-panel"
      @touchstart="onChatTouchStart"
      @touchmove="onChatTouchMove"
      @touchend="onChatTouchEnd"
    >
      <div class="stream-toggle">
        <div class="controls-row">
          <button v-if="isMobile" class="btn small" @click="toggleSidebar">
            {{ isSidebarOpen ? "收起工具" : "展开工具" }}
          </button>
          <router-link to="/" class="btn btn-with-icon">
            <img class="nav-icon" src="/src/assets/home/主页.svg" alt="主页" />
            <span>返回首页</span>
          </router-link>
          <label class="inline-flex">
            <input type="checkbox" v-model="enableMcp" :disabled="loading" />
            允许调用 MCP
          </label>
          <div class="model-select-wrap ml">
            <label class="inline-flex">模型：</label>
            <div class="model-select" @keydown.escape.stop.prevent="closeModels">
              <input
                v-model="model"
                :disabled="loading"
                class="model-input"
                placeholder="选择或输入模型"
                @focus="openModels"
                @click="openModels"
                @input="onModelInput"
                @blur="onModelBlur"
              />
              <div
                v-if="modelsOpen"
                class="model-dropdown"
              >
                <div class="model-dropdown-header">
                  <span v-if="modelsLoading">加载模型列表...</span>
                  <span v-else>可选模型（{{ filteredModels.length }}）</span>
                </div>
                <ul class="model-options">
                  <li
                    v-for="(m, i) in filteredModels"
                    :key="m.model_value + ':' + i"
                    class="model-option"
                    @mousedown.prevent="selectModel(m)"
                  >
                    <div class="opt-name">{{ m.model_name || m.model_value }}</div>
                    <div class="opt-meta">{{ m.provider_name || '' }}</div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <span v-if="loading" class="loading-text">流式生成中...</span>
        </div>
      </div>
      <div class="messages" ref="messagesContainer">
        <!-- 欢迎占位：仅当没有任何用户消息时显示 -->
        <div v-if="!hasUserMessage" class="welcome-empty">
          你好！欢迎使用Agent智能体
        </div>
        <template v-else>
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            :class="['message', msg.from]"
            v-show="!(isThinking && msg.from === 'bot' && !msg.text)"
          >
            <!-- 支持换行显示 -->
            <span v-html="formatReply(msg.text, msg.isStreaming)"></span>
          </div>
          <!-- 思考中动画 -->
          <div v-if="isThinking" class="message bot thinking-message-wrapper">
            <div class="thinking-bubble">
              <div class="thinking-container">
                <div class="thinking-dots">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </div>
                <div class="thinking-text">思考中...</div>
                <div class="thinking-time">{{ thinkingTime }}s</div>
              </div>
            </div>
            <div class="thinking-info">
              <span class="thinking-label">思考中...</span>
              <span class="thinking-duration">{{ thinkingTime }}s</span>
            </div>
          </div>
        </template>
      </div>
      <div class="input-area">
        <textarea
          ref="inputBox"
          v-model="inputText"
          @input="autoResize"
          @keydown.enter.exact.prevent="sendMessage"
          @keydown.enter.shift.exact="insertNewLine"
          @keyup="autoResize"
          @paste="$nextTick(autoResize)"
          :disabled="loading"
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          class="input-box textarea"
          rows="1"
        ></textarea>
        <div class="btn-row">
          <button
            @click="sendMessage"
            :disabled="loading || !trimmedInput"
            class="btn primary"
          >
            发送
          </button>
          <button
            v-if="loading"
            @click="stopStream"
            class="btn warn"
          >
            停止
          </button>
          <button
            @click="retryLast"
            :disabled="loading || !lastUserMessage"
            class="btn"
          >
            重试
          </button>
          <button @click="clearChat" :disabled="loading" class="btn">
            清空
          </button>
        </div>
        <p v-if="error" class="error-text">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { marked } from "marked";

// 让 Markdown 将单个换行视为 <br>，以符合聊天换行预期
marked.setOptions({ gfm: true, breaks: true });

export default {
  data() {
    return {
      inputText: "",
      messages: [{ from: "bot", text: "你好！欢迎使用Agent智能体" }],
      loading: false,
      isThinking: false, // 思考中状态
      thinkingStartTime: null, // 思考开始时间
      thinkingTime: 0, // 思考时间（秒）
      thinkingTimer: null, // 思考时间定时器
  enableMcp: false, // 勾选后走 /chat/mcp/stream
      model: "hunyuan-lite", // 默认模型，可修改
  models: [],
  modelsOpen: false,
  modelsLoading: false,
  hasTyped: false,
      abortController: null, // 终止流用
      error: null,
      typewriterInterval: null, // 打字机定时器
      typewriterBuffer: "", // 打字机缓冲区
      // MCP 工具栏状态
      tools: [],
      activeToolTab: "list",
      showAdd: false,
      showImport: false,
      showRegister: false,
      importText: "",
      form: { name: "", endpoint: "", description: "", enabled: true },
      registerForm: {
        name: "",
        description: "",
        curl: "",
        auth_required: true,
        modifiable_fields_text: '{"q":"城市名称"}',
        usage_example_text: '{"q":"Hefei"}',
      },
      toolsLoading: false, // 获取工具列表加载状态
      registerLoading: false, // 注册工具加载状态
      // 移动端侧栏 & 手势
      isSidebarOpen: false,
      viewportWidth: typeof window !== "undefined" ? window.innerWidth : 1024,
      touchStartX: 0,
      touchStartY: 0,
      touchDeltaX: 0,
      touchActive: false,
    };
  },
  mounted() {
    this.loadTools();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.onResize);
    }
    // 初始化输入框高度为一行，并启用自适应
    this.$nextTick(() => this.autoResize());
  },
  beforeUnmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.onResize);
    }
    // 清理思考定时器
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
    }
  },
  computed: {
    trimmedInput() {
      return this.inputText.trim();
    },
    hasUserMessage() {
      return (
        Array.isArray(this.messages) &&
        this.messages.some((m) => m && (m.from === "user" || m.role === "user"))
      );
    },
    lastUserMessage() {
      for (let i = this.messages.length - 1; i >= 0; i--) {
        if (this.messages[i].from === "user") return this.messages[i].text;
      }
      return null;
    },
    apiBase() {
      // 统一通过 Vite 代理转发到后端，前端只用 /api 前缀
      // 如需直连可设置 VITE_API_BASE，否则默认 '/api'
      return import.meta.env.VITE_API_BASE || "/api";
    },
    isMobile() {
      return this.viewportWidth <= 768;
    },
    filteredModels() {
      const list = Array.isArray(this.models) ? this.models : [];
      // 初次展开不按默认值过滤，避免只看到一个
      if (!this.hasTyped) return list;
      const q = (this.model || '').toLowerCase();
      if (!q) return list;
      return list.filter(m => {
        const name = (m.model_name || '').toLowerCase();
        const val = (m.model_value || '').toLowerCase();
        const prov = (m.provider_name || '').toLowerCase();
        return name.includes(q) || val.includes(q) || prov.includes(q);
      });
    }
  },
  methods: {
    async fetchModels() {
      if (this.modelsLoading) return;
      this.modelsLoading = true;
      try {
        const resp = await fetch(`${this.apiBase}/models`, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!resp.ok) {
          const t = await resp.text().catch(() => '');
          throw new Error(`HTTP ${resp.status} ${t}`);
        }
        const body = await resp.json().catch(() => ({}));
        const arr = Array.isArray(body?.models) ? body.models : (Array.isArray(body) ? body : []);
        this.models = arr.map(x => ({
          model_value: x.model_value || x.value || x.id || '',
          model_name: x.model_name || x.name || x.model_value || x.id || '',
          provider_name: x.provider_name || x.provider || '',
        }));
      } catch (e) {
        console.error('获取模型列表失败:', e);
      } finally {
        this.modelsLoading = false;
      }
    },
    openModels() {
      this.modelsOpen = true;
      this.hasTyped = false;
      if (!this.models || this.models.length === 0) this.fetchModels();
    },
    closeModels() {
      this.modelsOpen = false;
    },
    onModelBlur() {
      // 延迟关闭，保证点击选项的 mousedown 能先触发
      setTimeout(() => (this.modelsOpen = false), 120);
    },
    onModelInput() {
      if (this.modelsOpen) this.hasTyped = true;
    },
    selectModel(m) {
      this.model = m.model_value || m.model_name;
      this.modelsOpen = false;
    },
    // 视口与侧栏
    onResize() {
      this.viewportWidth = window.innerWidth;
      if (!this.isMobile) this.isSidebarOpen = false;
    },
    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
    },
    closeSidebar() {
      this.isSidebarOpen = false;
    },
    // 在聊天区域左滑打开侧栏
    onChatTouchStart(e) {
      if (!this.isMobile) return;
      const t = e.touches[0];
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
      this.touchDeltaX = 0;
      this.touchActive = true;
    },
    onChatTouchMove(e) {
      if (!this.isMobile || !this.touchActive) return;
      const t = e.touches[0];
      const dx = t.clientX - this.touchStartX;
      const dy = t.clientY - this.touchStartY;
      if (Math.abs(dy) > Math.abs(dx)) return; // 纵向滚动优先
      this.touchDeltaX = dx;
    },
    onChatTouchEnd() {
      if (!this.isMobile || !this.touchActive) return;
      const threshold = 50;
      if (this.touchDeltaX < -threshold) {
        // 左滑
        this.isSidebarOpen = true;
      }
      this.touchActive = false;
      this.touchDeltaX = 0;
    },
    // 在侧栏右滑关闭
    onSidebarTouchStart(e) {
      if (!this.isMobile) return;
      const t = e.touches[0];
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
      this.touchDeltaX = 0;
      this.touchActive = true;
    },
    onSidebarTouchMove(e) {
      if (!this.isMobile || !this.touchActive) return;
      const t = e.touches[0];
      const dx = t.clientX - this.touchStartX;
      const dy = t.clientY - this.touchStartY;
      if (Math.abs(dy) > Math.abs(dx)) return;
      this.touchDeltaX = dx;
    },
    onSidebarTouchEnd() {
      if (!this.isMobile || !this.touchActive) return;
      const threshold = 50;
      if (this.touchDeltaX > threshold) {
        // 右滑
        this.isSidebarOpen = false;
      }
      this.touchActive = false;
      this.touchDeltaX = 0;
    },
    // -------- MCP 工具栏逻辑 --------
    newId() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },
    loadTools() {
      try {
        const raw = localStorage.getItem("mcp_tools");
        this.tools = raw ? JSON.parse(raw) : [];
      } catch (e) {
        this.tools = [];
      }
    },
    saveTools() {
      try {
        localStorage.setItem("mcp_tools", JSON.stringify(this.tools));
      } catch (e) {}
    },
    resetForm() {
      this.form = { name: "", endpoint: "", description: "", enabled: true };
    },
    resetRegisterForm() {
      this.registerForm = {
        name: "",
        description: "",
        curl: "",
        auth_required: true,
        modifiable_fields_text: '{"q":"城市名称"}',
        usage_example_text: '{"q":"Hefei"}',
      };
    },
    addTool() {
      if (!this.form.name.trim()) return;
      const tool = { id: this.newId(), ...this.form };
      this.tools.unshift(tool);
      this.saveTools();
      this.resetForm();
      this.showAdd = false;
    },
    removeTool(id) {
      this.tools = this.tools.filter((t) => t.id !== id);
      this.saveTools();
    },
    clearToolsConfirm() {
      if (confirm("确定清空所有工具吗？")) {
        this.tools = [];
        this.saveTools();
      }
    },
    clearImport() {
      this.importText = "";
    },
    importTools() {
      if (!this.importText.trim()) return;
      try {
        const parsed = JSON.parse(this.importText);
        if (Array.isArray(parsed)) {
          parsed.forEach((p) =>
            this.tools.unshift({ id: this.newId(), enabled: true, ...p })
          );
        } else if (typeof parsed === "object") {
          this.tools.unshift({ id: this.newId(), enabled: true, ...parsed });
        }
        this.saveTools();
        this.importText = "";
        this.showImport = false;
      } catch (e) {
        alert("解析失败，请检查 JSON 格式");
      }
    },
    async fetchTools() {
      if (this.toolsLoading) return;
      this.toolsLoading = true;
      try {
        const resp = await fetch(`${this.apiBase}/tools`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`HTTP ${resp.status} ${text}`);
        }
        const body = await resp.json().catch(() => ({}));

        // 统一抽取列表
        let items = [];
        if (Array.isArray(body)) {
          items = body;
        } else if (Array.isArray(body?.tools)) {
          items = body.tools;
        } else if (body && typeof body.tools === "object" && body.tools !== null) {
          // 适配 {'tools': { name: description }}
          items = Object.entries(body.tools).map(([name, desc]) => ({
            name,
            description: String(desc ?? ""),
          }));
        } else if (Array.isArray(body?.data)) {
          items = body.data;
        } else if (body && typeof body.data === "object" && body.data !== null) {
          items = Object.entries(body.data).map(([name, desc]) => ({
            name,
            description: String(desc ?? ""),
          }));
        }

        // 规范化
        const normalized = (items || []).map((item, idx) => {
          const name = item?.name ?? item?.id ?? (typeof item === "string" ? item : `工具${idx + 1}`);
          const description = item?.description ?? item?.desc ?? "";
          const endpoint = item?.endpoint ?? item?.url ?? "";
          return {
            id: this.newId(),
            name,
            endpoint,
            description,
            enabled: typeof item?.enabled === "boolean" ? item.enabled : true,
          };
        });

        this.tools = normalized;
        this.saveTools();
      } catch (err) {
        console.error("获取工具列表失败:", err);
        alert(`获取工具列表失败：${err.message || err}`);
      } finally {
        this.toolsLoading = false;
      }
    },
    // -------- 聊天逻辑 --------
    startThinking() {
      this.isThinking = true;
      this.thinkingStartTime = Date.now();
      this.thinkingTime = 0;
      
      // 每100ms更新一次思考时间
      this.thinkingTimer = setInterval(() => {
        if (this.thinkingStartTime) {
          this.thinkingTime = Math.round((Date.now() - this.thinkingStartTime) / 1000);
        }
      }, 100);
      
      this.scrollToBottom();
    },
    
    stopThinking() {
      this.isThinking = false;
      this.thinkingStartTime = null;
      this.thinkingTime = 0;
      
      if (this.thinkingTimer) {
        clearInterval(this.thinkingTimer);
        this.thinkingTimer = null;
      }
    },
    formatReply(text, isStreaming) {
      if (!text) return "";
      // If streaming, just show plain text (escaped for safety).
      // Otherwise, parse the full text as Markdown.
      if (isStreaming) {
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;")
          .replace(/\r\n|\r|\n/g, "<br>");
      }
      return marked.parse(text);
    },
    insertNewLine(e) {
      // 默认行为已经添加换行，这里确保不触发发送
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer;
        if (container) container.scrollTop = container.scrollHeight;
      });
    },
    clearChat() {
      if (this.loading) return;
      this.messages = [{ from: "bot", text: "你好！欢迎使用Agent智能体" }];
      this.error = null;
    },
    retryLast() {
      if (this.loading || !this.lastUserMessage) return;
      this.inputText = this.lastUserMessage;
      this.sendMessage();
    },
    stopStream() {
      if (this.abortController) {
        try {
          this.abortController.abort();
        } catch (e) {
          /* ignore */
        }
      }
      if (this.typewriterInterval) {
        clearInterval(this.typewriterInterval);
        this.typewriterInterval = null;
      }
      // 停止思考状态
      this.stopThinking();
    },
    async sendMessage() {
      if (!this.trimmedInput || this.loading) return;
      this.error = null;
      const userMessage = this.trimmedInput;
      this.messages.push({ from: "user", text: userMessage });
      this.loading = true;
      this.inputText = "";
      this.$nextTick(() => this.autoResize());

      // 开始思考状态
      this.startThinking();

      // 添加机器人的临时响应（思考时不显示）
      const botMessageIndex = this.messages.length;
      this.messages.push({
        from: "bot",
        text: "",
        isStreaming: true, // Mark this message as currently streaming
      });

      try {
        this.typewriterBuffer = "";
          if (this.typewriterInterval) clearInterval(this.typewriterInterval);

          // 使用流式API
          this.abortController = new AbortController();
          const streamPath = this.enableMcp ? "/chat/mcp/stream" : "/chat/stream";
          const response = await fetch(`${this.apiBase}${streamPath}`, {
            method: "POST",
            headers: {
              Accept: "text/event-stream, application/json, text/plain",
              "Content-Type": "application/json",
            },
            // credentials: "include", // 后端无需 Cookie，避免多余头部
            body: JSON.stringify({
              model: this.model,
              message: userMessage,
            }),
            signal: this.abortController.signal,
          });

          if (!response.ok || !response.body) {
            let errText = "";
            try {
              errText = await response.text();
            } catch (_) {}
            throw new Error(
              `HTTP ${response.status}: ${errText || "请求失败"}`
            );
          }

          // 启动打字机
          this.typewriterInterval = setInterval(() => {
            if (this.typewriterBuffer.length > 0) {
              const char = this.typewriterBuffer.charAt(0);
              this.typewriterBuffer = this.typewriterBuffer.slice(1);
              this.messages[botMessageIndex].text += char;
              this.scrollToBottom();
            } else {
              // 缓冲区空了，但流可能还没结束
            }
          }, 30); // 打字速度，单位ms

          // 创建新的 TextDecoder 用于处理流数据（SSE 规范：同一事件可能包含多个 data: 行，用\n拼接）
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let eventLines = [];

          const flushEvent = () => {
            if (!eventLines.length) return;
            const payload = eventLines.join("\n");
            eventLines = [];
            if (!payload || payload === "[DONE]") return;
            try {
              const data = JSON.parse(payload);
              const piece =
                data.reply ??
                data.content ??
                data.delta ??
                data.text ??
                data.message ?? "";
              if (typeof piece === "string") {
                // 第一次收到数据时停止思考状态
                if (this.isThinking) {
                  this.stopThinking();
                }
                this.typewriterBuffer += piece;
              } else if (piece != null) {
                // 第一次收到数据时停止思考状态
                if (this.isThinking) {
                  this.stopThinking();
                }
                this.typewriterBuffer += String(piece);
              } else {
                // 无已知字段，回退整个 JSON 文本
                if (this.isThinking) {
                  this.stopThinking();
                }
                this.typewriterBuffer += payload;
              }
            } catch (_) {
              // 非 JSON，按原文追加（保留换行）
              if (this.isThinking) {
                this.stopThinking();
              }
              this.typewriterBuffer += payload;
            }
          };

          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) {
                // 将缓冲的最后一段也处理为一个事件
                if (buffer.length) {
                  const pendingLines = buffer.split(/\r?\n/);
                  buffer = pendingLines.pop() ?? "";
                  for (const raw of pendingLines) {
                    if (raw.startsWith("data:")) {
                      let v = raw.slice(5);
                      if (v.startsWith(" ")) v = v.slice(1);
                      eventLines.push(v);
                    } else if (raw === "") {
                      flushEvent();
                    } else {
                      // 兼容非 SSE 文本流
                      if (this.isThinking) {
                        this.stopThinking();
                      }
                      this.typewriterBuffer += raw + "\n";
                    }
                  }
                  // 若还有未以空行结束的事件，也做一次 flush
                  if (eventLines.length) flushEvent();
                  // 余下的 buffer 若是 data: 开头也处理
                  if (buffer.startsWith("data:")) {
                    let v = buffer.slice(5);
                    if (v.startsWith(" ")) v = v.slice(1);
                    eventLines.push(v);
                    flushEvent();
                    buffer = "";
                  } else if (buffer.trim().length) {
                    if (this.isThinking) {
                      this.stopThinking();
                    }
                    this.typewriterBuffer += buffer;
                    buffer = "";
                  }
                }
                break;
              }

              const chunk = decoder.decode(value, { stream: true });
              if (!chunk) continue;
              buffer += chunk;
              const lines = buffer.split(/\r?\n/);
              buffer = lines.pop() ?? ""; // 保留不完整的一行
              for (const raw of lines) {
                if (raw.startsWith("data:")) {
                  let v = raw.slice(5);
                  if (v.startsWith(" ")) v = v.slice(1);
                  eventLines.push(v);
                } else if (raw === "") {
                  // 空行表示一个 SSE 事件结束
                  flushEvent();
                } else {
                  // 非标准 SSE 行，回退到原文追加
                  if (this.isThinking) {
                    this.stopThinking();
                  }
                  this.typewriterBuffer += raw + "\n";
                }
              }
            }
          } catch (error) {
            if (error.name === "AbortError") {
              // 用户主动停止
              this.messages[botMessageIndex].text += " [已停止]";
            } else {
              console.error("Stream processing error:", error);
              this.error = "流式读取失败: " + error.message;
              this.messages[botMessageIndex].text += " [读取响应出错]";
            }
          } finally {
            // 停止思考状态
            this.stopThinking();
            
            // 等待打字机完成
            const finalFlush = setInterval(() => {
              if (this.typewriterBuffer.length === 0) {
                clearInterval(this.typewriterInterval);
                this.typewriterInterval = null;
                clearInterval(finalFlush);
                this.loading = false;
                this.abortController = null;
                // Streaming is done, mark it so it can be rendered as Markdown
                if (this.messages[botMessageIndex]) {
                  this.messages[botMessageIndex].isStreaming = false;
                }
                this.scrollToBottom();
              }
            }, 100);
            try {
              await reader.cancel();
            } catch (e) {}
          }
        
      } catch (e) {
        this.error = e.message || "请求出现错误";
        this.messages[botMessageIndex] = {
          from: "bot",
          text: "[机器人回复出错]",
        };
        if (this.messages[botMessageIndex]) {
          this.messages[botMessageIndex].isStreaming = false;
        }
        console.error("请求错误：", e);
        this.loading = false;
        this.abortController = null;
        // 停止思考状态
        this.stopThinking();
        this.scrollToBottom();
      }
    },
    parseJSONSafe(text, fallback) {
      try {
        const t = (text || "").trim();
        if (!t) return fallback;
        return JSON.parse(t);
      } catch (_) {
        return fallback;
      }
    },
    autoResize() {
      const el = this.$refs.inputBox;
      if (!el) return;
      
      // 重置高度以获取真实的scrollHeight
      el.style.height = "auto";
      el.style.overflowY = "hidden";
      
      const scrollHeight = el.scrollHeight;
      // 根据屏幕尺寸调整最大高度
      const maxHeight = this.isMobile ? 100 : 120;
      const minHeight = 39; // 最小高度（一行）
      
      // 计算圆角半径：一行时是完全圆形，两行及以上时是12px圆角
      const borderRadius = scrollHeight <= minHeight ? 9999 : 12;
      
      if (scrollHeight <= maxHeight) {
        // 内容不超过最大高度，自适应高度
        el.style.height = scrollHeight + "px";
        el.style.overflowY = "hidden";
      } else {
        // 内容超过最大高度，固定高度并显示滚动条
        el.style.height = maxHeight + "px";
        el.style.overflowY = "auto";
      }
      
      // 应用动态圆角
      el.style.borderRadius = borderRadius + "px";
    },
    async registerTool() {
      if (this.registerLoading) return;
      if (!this.registerForm.name.trim()) {
        alert("请填写工具名称");
        return;
      }
      if (!this.registerForm.curl.trim()) {
        alert("请填写 curl 命令");
        return;
      }
      // 构造 payload
      const payload = {
        name: this.registerForm.name.trim(),
        description: this.registerForm.description.trim(),
        curl: this.registerForm.curl.trim(),
        auth_required: !!this.registerForm.auth_required,
        modifiable_fields: this.parseJSONSafe(this.registerForm.modifiable_fields_text, {}),
        usage_example: this.parseJSONSafe(this.registerForm.usage_example_text, {}),
      };
      // 简单校验 JSON 文本有效性
      if (typeof payload.modifiable_fields !== 'object' || payload.modifiable_fields === null) {
        alert('可修改字段需要为 JSON 对象');
        return;
      }
      if (typeof payload.usage_example !== 'object' || payload.usage_example === null) {
        alert('使用示例需要为 JSON 对象');
        return;
      }

      this.registerLoading = true;
      try {
        const resp = await fetch(`${this.apiBase}/tools/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`HTTP ${resp.status} ${text}`);
        }
        // 成功：刷新工具列表并关闭表单
        try { await this.fetchTools(); } catch (_) {}
        this.showRegister = false;
        this.resetRegisterForm();
        alert('注册成功');
      } catch (err) {
        console.error('注册工具失败:', err);
        alert(`注册失败：${err.message || err}`);
      } finally {
        this.registerLoading = false;
      }
    },
  },
};
</script>

<style scoped>
.chat-page {
  position: fixed;
  inset: 0;
  display: flex;
  overflow: hidden;
  background: #f3f4f6;
}
.sidebar {
  width: 16.67%; /* 调整为总宽度的 1/6 */
  min-width: 180px; /* 保留最小宽度避免太窄 */
  max-width: 16.67%; /* 最大宽度也限制为 1/6 */
  background: #161820; /* 深色背景，比聊天区 #0f1115 稍浅 */
  border-right: 1px solid #1e2028; /* 深色边框 */
  padding: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 由内部容器滚动 */
  color: #ffffff; /* 白色文字以提高可读性 */
}
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 10;
}
.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  color: #ffffff; /* 在深色背景上使用白色文字 */
}
.sidebar-header small {
  color: #b0b0b0; /* 在深色背景上使用浅灰色文字 */
  color: #6b7280;
}
.tool-actions {
  margin: 10px 0;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tool-content {
  flex: 1;
  min-height: 0; /* 允许内部滚动 */
  overflow: auto;
  display: flex;
  flex-direction: column;
}
.tool-content::-webkit-scrollbar { width: 10px; height: 10px; }
.tool-content::-webkit-scrollbar-track { background: #0b0d11; border-radius: 8px; }
.tool-content::-webkit-scrollbar-thumb { background: #2a2f3a; border-radius: 8px; border: 2px solid #0b0d11; }
.tool-content::-webkit-scrollbar-thumb:hover { background: #3a3f4a; }
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.tab-btn {
  padding: 6px 12px;
  border: 1px solid #2a2e3a;
  border-radius: 6px;
  background: transparent;
  color: #ddd;
  cursor: pointer;
}
.tab-btn.active {
  background: #252832;
  color: #fff;
  border-color: #2a2e3a;
}
.tab-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.tool-form,
.tool-import {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #1e2028; /* 深色边框 */
  border-radius: 6px;
  font-size: 14px;
  background-color: #1c1e26; /* 深色背景 */
  color: #ffffff; /* 白色文字 */
  box-sizing: border-box; /* 防止撑出容器 */
  max-width: 100%;
}
.input.textarea {
  resize: vertical;
}
.tool-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tool-list-wrap { flex: 1; min-height: 0; }
.tool-item {
  border: 1px solid #1e2028; /* 深色边框 */
  border-radius: 8px;
  padding: 10px;
  background: #1c1e26; /* 略微浅一点的背景，与工具栏形成层次 */
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.tool-title {
  font-weight: 600;
  color: #ffffff; /* 白色标题 */
}
.tool-desc {
  color: #b0b0b0; /* 浅灰色描述 */
  font-size: 13px;
  margin-top: 2px;
}
.tool-endpoint {
  color: #d0d0d0; /* 浅色文字 */
  background: #22242e; /* 深色但比工具项稍浅的背景 */
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-top: 6px;
}
.tool-ops {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tool-footer {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chat-panel {
  flex: 1; /* 占据剩余所有空间，会自动成为 4/5 的宽度 */
  display: flex;
  flex-direction: column;
  padding: 0;
  min-width: 0; /* 允许在Flex中收缩，避免子内容溢出 */
  box-sizing: border-box;
}
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0; /* 避免子元素撑破容器 */
  max-width: 100%;
  background: #0f1115; /* 高级黑 */
  color: #fff;
  padding: 12px;
  border-radius: 0;
}
.messages {
  flex: 1;
  overflow-y: auto;
  margin: 10px 0;
  max-width: 100%;
  box-sizing: border-box;
  /* Firefox 自定义滚动条颜色 */
  scrollbar-color: #3a3f4a #0b0d11; /* thumb track */
  scrollbar-width: thin;
}
/* WebKit 系列（Chromium, Safari）自定义滚动条 */
.messages::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.messages::-webkit-scrollbar-track {
  background: #0b0d11; /* 深色轨道，避免白底 */
  border-radius: 8px;
}
.messages::-webkit-scrollbar-thumb {
  background: #2a2f3a; /* 深色滚动块 */
  border-radius: 8px; /* 更圆润 */
  border: 2px solid #0b0d11; /* 形成内间距效果，更优雅 */
}
.messages::-webkit-scrollbar-thumb:hover {
  background: #3a3f4a;
}
.stream-toggle {
  margin-bottom: 6px;
  text-align: left;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  max-width: 100%;
  box-sizing: border-box;
}

.inline-flex {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #555;
}

.ml {
  margin-left: 8px;
}

.model-input {
  border: 1px solid #2c2f36;
  background: #11141a;
  color: #fff;
  caret-color: #fff;
  padding: 4px 6px;
  border-radius: 6px;
  min-width: 160px;
}
.model-input::placeholder { color: #9aa0a6; }
.model-input:focus { outline: none; border-color: inherit; box-shadow: none; }

.model-select-wrap { display: inline-flex; align-items: center; gap: 6px; position: relative; }
.model-select { position: relative; display: inline-block; }
.model-dropdown {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0;
  min-width: 260px;
  max-height: 260px;
  overflow: auto;
  background: #0f1115;
  border: 1px solid #2c2f36;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.model-dropdown { scrollbar-color: #2a2f3a #0b0d11; scrollbar-width: thin; }
.model-dropdown::-webkit-scrollbar { width: 10px; height: 10px; }
.model-dropdown::-webkit-scrollbar-track { background: #0b0d11; border-radius: 8px; }
.model-dropdown::-webkit-scrollbar-thumb { background: #2a2f3a; border-radius: 8px; border: 2px solid #0b0d11; }
.model-dropdown::-webkit-scrollbar-thumb:hover { background: #3a3f4a; }
.model-dropdown-header { padding: 8px 10px; font-size: 12px; color: #9aa0a6; border-bottom: 1px solid #2c2f36; position: sticky; top: 0; background: #0f1115; }
.model-options { list-style: none; margin: 0; padding: 6px 0; }
.model-option { padding: 8px 10px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.model-option:hover { background: #1a1f29; }
.model-option .opt-name { color: #e0e0e0; font-weight: 600; }
.model-option .opt-meta { color: #9aa0a6; font-size: 12px; }

.loading-text {
  color: #888;
  font-size: 13px;
}

.stream-toggle label {
  cursor: pointer;
  user-select: none;
  color: #cfd3dc;
}

.stream-toggle input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 38px;
  height: 22px;
  background: #1a1d24;
  border: 1px solid #2c2f36;
  border-radius: 9999px;
  position: relative;
  margin-right: 6px;
  outline: none;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, opacity 0.2s;
  vertical-align: middle;
}
.stream-toggle input[type="checkbox"]::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #a0a7b3;
  transition: transform 0.2s, background 0.2s;
}
.stream-toggle input[type="checkbox"]:checked {
  background: #4a9eff;
  border-color: #4a9eff;
}
.stream-toggle input[type="checkbox"]:checked::after {
  transform: translateX(16px);
  background: #ffffff;
}
.stream-toggle input[type="checkbox"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.stream-toggle input[type="checkbox"]:focus-visible {
  box-shadow: 0 0 0 3px rgba(74,158,255,0.25);
}

.message {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 16px; /* 圆一点 */
  width: fit-content; /* 单行按内容自适应，避免气泡过宽 */
  max-width: 78%;
  word-break: break-word; /* 兼容性回退 */
  overflow-wrap: anywhere; /* 长不可断单词/URL 也可换行 */
  font-size: 18px; /* 更大字号，让文字更饱满 */
  line-height: 1.45;
}

.message.user {
  margin-left: auto;
  background-color: #2a2f3a;
  color: #fff;
}

.message.bot {
  margin-right: auto;
  background-color: #1a1f29;
  color: #fff;
}

.message strong {
  display: none;
}

/* 重置 v-html 插入内容（如 p/ul/ol/pre/blockquote/heading）的默认外边距，避免撑大气泡高度 */
.message :deep(p),
.message :deep(ul),
.message :deep(ol),
.message :deep(pre),
.message :deep(blockquote),
.message :deep(h1),
.message :deep(h2),
.message :deep(h3),
.message :deep(h4),
.message :deep(h5),
.message :deep(h6) {
  margin: 0;
}
/* 段落连续时提供最小间距 */
.message :deep(p + p) {
  margin-top: 0.5em;
}
/* 超长内容处理：链接、行内代码、代码块、图片等 */
.message :deep(a) {
  word-break: break-all;
}
.message :deep(code) {
  word-break: break-word;
  overflow-wrap: anywhere;
}
.message :deep(pre) {
  white-space: pre-wrap; /* 保留缩进且允许换行 */
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 100%;
  overflow: auto; /* 超出时出现滚动条（水平/垂直）*/
}
.message :deep(img) {
  max-width: 100%;
  height: auto;
}

.input-box {
  width: 100%;
  padding: 8px 12px; /* 更紧凑，贴合一行高度 */
  font-size: 1rem;
  border: 1px solid #2c2f36;
  background: #11141a;
  color: #fff;
  border-radius: 9999px; /* 药丸形状，会根据高度动态调整 */
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease, border-radius 0.3s ease, height 0.2s ease;
  box-sizing: border-box;
  resize: none; /* 禁止手动拖拽 */
  overflow-y: hidden; /* 自适应时隐藏内部滚动条 */
  max-height: 120px; /* 限制最大高度为5行左右 */
  min-height: 39px; /* 最小高度保持一行 */
  /* 自定义滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: #3a3f4a #1a1e26;
}

/* WebKit 系列滚动条样式 */
.input-box::-webkit-scrollbar {
  width: 6px;
}

.input-box::-webkit-scrollbar-track {
  background: #1a1e26;
  border-radius: 10px;
}

.input-box::-webkit-scrollbar-thumb {
  background: #3a3f4a;
  border-radius: 10px;
}

.input-box::-webkit-scrollbar-thumb:hover {
  background: #4a5560;
}

.input-box:focus {
  outline: none;
  border-color: inherit;
  box-shadow: none;
}

.input-box:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.textarea {
  resize: vertical;
  font-family: inherit;
}

.btn-row {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
  box-sizing: border-box;
  justify-content: flex-start;
}

.btn {
  padding: 6px 12px;
  border: 1px solid #252832; /* 深色边框 */
  border-radius: 4px;
  background: #1c1e26; /* 深色背景 */
  color: #e0e0e0; /* 浅色文字 */
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  white-space: nowrap; /* 按钮文字不换行，整体换行 */
  display: inline-flex;
  align-items: center;
}
.btn:hover:not(:disabled) {
  background: #252832; /* 深色悬停效果 */
  border-color: #2a2e3a; /* 略亮的边框 */
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn.small {
  padding: 4px 8px;
  font-size: 12px;
}
.btn.primary {
  background: #4a9eff;
  color: #fff;
  border-color: #4a9eff;
}
.btn.primary:hover:not(:disabled) {
  background: #3c8ee8;
}
.btn.warn {
  background: #ffb347;
  border-color: #ff9800;
  color: #fff;
}
.btn.warn:hover:not(:disabled) {
  background: #ff9800;
}
.btn.danger {
  background: #ef4444;
  border-color: #ef4444;
  color: #fff;
}
.btn.danger:hover:not(:disabled) {
  background: #dc2626;
}

.input-area {
  margin-top: 4px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.error-text {
  margin-top: 6px;
  color: #d93025;
  font-size: 13px;
}

/* 返回首页按钮图标对齐样式 */
.btn-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #111; /* 高级黑色 */
  color: #fff;
  border-color: #111;
  text-decoration: none; /* 去除下划线 */
}
.btn-with-icon:hover:not(:disabled) {
  background: #1a1a1a;
  color: #fff;
  text-decoration: none;
}
.btn-with-icon .nav-icon {
  width: 16px;
  height: 16px;
  display: inline-block;
}

/* 欢迎占位样式：居中、加粗、变大 */
.welcome-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
  opacity: 0.9;
}

/* 思考中动画样式 */
.thinking-message-wrapper {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
  width: auto !important;
  max-width: none !important;
}

.thinking-bubble {
  animation: breathe 2s ease-in-out infinite;
  border: 1px solid #4a9eff !important;
  box-shadow: 0 0 15px rgba(74, 158, 255, 0.3);
  width: 24px !important;
  height: 24px !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  background: #1a1f29 !important;
  flex-shrink: 0;
}

@keyframes breathe {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 15px rgba(74, 158, 255, 0.3);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 25px rgba(74, 158, 255, 0.5);
  }
}

.thinking-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 8px;
  text-align: center;
  width: 100%;
}

.thinking-dots {
  display: flex;
  gap: 1px;
  align-items: center;
  justify-content: center;
}

.thinking-dots .dot {
  width: 3px;
  height: 3px;
  background-color: #4a9eff;
  border-radius: 50%;
  display: inline-block;
  animation: bounce 1.4s ease-in-out infinite both;
}

.thinking-dots .dot:nth-child(1) {
  animation-delay: -0.32s;
}

.thinking-dots .dot:nth-child(2) {
  animation-delay: -0.16s;
}

.thinking-dots .dot:nth-child(3) {
  animation-delay: 0s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0.3);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.thinking-text {
  display: none; /* 隐藏文字，空间太小 */
}

.thinking-time {
  display: none; /* 隐藏时间，空间太小 */
}

.thinking-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.thinking-label {
  color: #e0e0e0;
  font-style: italic;
  font-weight: 500;
  font-size: 14px;
}

.thinking-duration {
  color: #4a9eff;
  font-size: 12px;
  font-weight: 600;
  background: rgba(74, 158, 255, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
  text-align: center;
  width: fit-content;
}

/* 自适应：窄屏时收窄侧栏 */
@media (max-width: 768px) {
  .sidebar {
    width: 240px; /* 在移动设备上使用固定宽度而非百分比 */
    padding: 10px;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 11;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    max-width: 83.33%; /* 但最大不超过屏幕的 5/6 */
    min-width: unset; /* 移除最小宽度限制 */
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .chat-panel {
    padding: 0;
    width: 100%; /* 在移动设备上占满整个宽度 */
    max-width: 100%; /* 确保在移动设备上能占满 */
  }
  .chat-container {
    padding: 10px;
  }
  .welcome-empty {
    font-size: 22px;
  }
  .message {
    font-size: 16px; /* 移动端略小，便于阅读 */
    line-height: 1.5;
    padding: 8px 10px; /* 收紧内边距，单行更紧凑 */
  }
  
  /* 移动端思考动画适配 */
  .thinking-bubble {
    width: 20px !important;
    height: 20px !important;
  }
  
  .thinking-message-wrapper {
    gap: 8px !important;
  }
  
  .thinking-dots .dot {
    width: 2px;
    height: 2px;
  }
  
  .thinking-label {
    font-size: 12px;
  }
  
  .thinking-duration {
    font-size: 10px;
    padding: 1px 6px;
  }
  
  /* 移动端输入框适配 */
  .input-box {
    max-height: 100px; /* 移动端稍微小一些 */
    transition: border-color 0.2s ease, background 0.2s ease, border-radius 0.3s ease, height 0.2s ease;
  }
}
</style>
