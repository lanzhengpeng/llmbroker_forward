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
      <div class="tool-actions">
        <button class="btn small" @click="showAdd = !showAdd">
          {{ showAdd ? "取消添加" : "添加工具" }}
        </button>
        <button class="btn small" @click="showImport = !showImport">
          {{ showImport ? "取消自动注册" : "自动注册" }}
        </button>
      </div>

      <!-- 手动添加工具 -->
      <div v-if="showAdd" class="tool-form">
        <input v-model.trim="form.name" class="input" placeholder="工具名称" />
        <input
          v-model.trim="form.endpoint"
          class="input"
          placeholder="调用地址 / 命令"
        />
        <textarea
          v-model.trim="form.description"
          class="input textarea"
          placeholder="工具描述"
        ></textarea>
        <label class="inline-flex">
          <input type="checkbox" v-model="form.enabled" />启用
        </label>
        <div class="btn-row">
          <button class="btn primary" @click="addTool">保存</button>
          <button class="btn" @click="resetForm">重置</button>
        </div>
      </div>

      <!-- 自动注册（粘贴 JSON 配置） -->
      <div v-if="showImport" class="tool-import">
        <textarea
          v-model.trim="importText"
          class="input textarea"
          rows="5"
          placeholder='粘贴工具配置 JSON，如 {"name":"","endpoint":"","description":"","enabled":true}'
        ></textarea>
        <div class="btn-row">
          <button class="btn" @click="importTools">解析并添加</button>
          <button class="btn" @click="clearImport">清空</button>
        </div>
      </div>

      <!-- 工具列表 -->
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
            <input type="checkbox" v-model="streamMode" :disabled="loading" />
            流式
          </label>
          <label class="inline-flex ml">
            模型：
            <input
              v-model="model"
              :disabled="loading"
              class="model-input"
              placeholder="模型名称"
            />
          </label>
          <span v-if="loading" class="loading-text">{{
            streamMode ? "流式生成中..." : "请求中..."
          }}</span>
        </div>
      </div>
      <div class="messages" ref="messagesContainer">
        <!-- 欢迎占位：仅当没有任何用户消息时显示 -->
        <div v-if="!hasUserMessage" class="welcome-empty">
          你好！欢迎使用聊天
        </div>
        <template v-else>
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            :class="['message', msg.from]"
          >
            <!-- 支持换行显示 -->
            <span v-html="formatReply(msg.text, msg.isStreaming)"></span>
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
            v-if="loading && streamMode"
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

export default {
  data() {
    return {
      inputText: "",
      messages: [{ from: "bot", text: "你好！欢迎使用聊天" }],
      loading: false,
      streamMode: true, // 是否使用流式响应
      model: "GLM-4.5-Flash", // 默认模型，可修改
      abortController: null, // 终止流用
      error: null,
      typewriterInterval: null, // 打字机定时器
      typewriterBuffer: "", // 打字机缓冲区
      // MCP 工具栏状态
      tools: [],
      showAdd: false,
      showImport: false,
      importText: "",
      form: { name: "", endpoint: "", description: "", enabled: true },
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
  },
  methods: {
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
    // -------- 聊天逻辑 --------
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
          .replace(/\n/g, "<br>");
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
      this.messages = [{ from: "bot", text: "你好！欢迎使用聊天" }];
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
    },
    async sendMessage() {
      if (!this.trimmedInput || this.loading) return;
      this.error = null;
      const userMessage = this.trimmedInput;
      this.messages.push({ from: "user", text: userMessage });
      this.loading = true;
      this.inputText = "";
      this.$nextTick(() => this.autoResize());

      // 添加机器人的临时响应
      const botMessageIndex = this.messages.length;
      this.messages.push({
        from: "bot",
        text: "",
        isStreaming: true, // Mark this message as currently streaming
      });

      try {
        if (this.streamMode) {
          this.typewriterBuffer = "";
          if (this.typewriterInterval) clearInterval(this.typewriterInterval);

          // 使用流式API
          this.abortController = new AbortController();
          const response = await fetch(`${this.apiBase}/chat/stream`, {
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

          // 创建新的 TextDecoder 用于处理流数据（按行解析，兼容 JSON 行或纯文本）
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) {
                console.log("Stream complete");
                // 处理最后残留未换行内容
                if (buffer) {
                  let line = buffer.trim();
                  if (line.startsWith("data:")) line = line.slice(5).trim();
                  if (line) {
                    try {
                      const data = JSON.parse(line);
                      this.typewriterBuffer += data.reply ?? line;
                    } catch (_) {
                      this.typewriterBuffer += line;
                    }
                  }
                }
                break;
              }

              // 解码数据块并添加到响应中
              const chunk = decoder.decode(value, { stream: true });
              if (!chunk) continue;
              buffer += chunk;
              let lines = buffer.split(/\r?\n/);
              buffer = lines.pop() ?? ""; // 保留未完整的一行
              for (const raw of lines) {
                let line = raw.trim();
                if (!line) continue;
                // 兼容 SSE: 只处理以 data: 开头的内容
                if (line.startsWith("data:")) {
                  line = line.slice(5).trim();
                  if (!line) continue;
                }
                if (!line) continue;
                try {
                  const data = JSON.parse(line);
                  this.typewriterBuffer += data.reply ?? line;
                } catch (_) {
                  this.typewriterBuffer += line;
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
        } else {
          // 使用普通API
          const response = await fetch(`${this.apiBase}/chat`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Origin: window.location.origin,
            },
            credentials: "include",
            body: JSON.stringify({
              model: this.model,
              message: userMessage,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `请求失败，状态码：${response.status}，响应内容：${errorText}`
            );
          }

          const data = await response.json();
          this.messages[botMessageIndex] = {
            from: "bot",
            text: data.reply || "无响应内容",
          };
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
      }

      if (!this.streamMode) {
        this.loading = false;
        this.abortController = null;
        this.scrollToBottom();
      }
    },
    autoResize() {
      const el = this.$refs.inputBox;
      if (!el) return;
      // 自适应高度：先重置为 auto，再设置为 scrollHeight
      el.style.height = "auto";
      el.style.overflowY = "hidden";
      el.style.height = el.scrollHeight + "px";
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
  width: 300px;
  min-width: 260px;
  max-width: 360px;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  padding: 14px;
  overflow: auto;
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
}
.sidebar-header small {
  color: #6b7280;
}
.tool-actions {
  margin: 10px 0;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
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
.tool-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.tool-title {
  font-weight: 600;
}
.tool-desc {
  color: #6b7280;
  font-size: 13px;
  margin-top: 2px;
}
.tool-endpoint {
  color: #374151;
  background: #f9fafb;
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
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  min-width: 0; /* 允许在Flex中收缩，避免子内容溢出 */
  box-sizing: border-box;
  max-width: 100%;
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
  border: 1px solid #ccc;
  padding: 4px 6px;
  border-radius: 4px;
  min-width: 140px;
}

.loading-text {
  color: #888;
  font-size: 13px;
}

.stream-toggle label {
  cursor: pointer;
  user-select: none;
  color: #666;
}

.stream-toggle input[type="checkbox"] {
  margin-right: 5px;
}

.message {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 16px; /* 圆一点 */
  width: fit-content; /* 单行按内容自适应，避免气泡过宽 */
  max-width: 78%;
  word-break: break-word;
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

.input-box {
  width: 100%;
  padding: 8px 12px; /* 更紧凑，贴合一行高度 */
  font-size: 1rem;
  border: 1px solid #2c2f36;
  background: #11141a;
  color: #fff;
  border-radius: 9999px; /* 药丸形状 */
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease;
  box-sizing: border-box;
  resize: none; /* 禁止手动拖拽 */
  overflow-y: hidden; /* 自适应时隐藏内部滚动条 */
}

.input-box:focus {
  border-color: #4a9eff;
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
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  white-space: nowrap; /* 按钮文字不换行，整体换行 */
  display: inline-flex;
  align-items: center;
}
.btn:hover:not(:disabled) {
  background: #f0f0f0;
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

/* 自适应：窄屏时收窄侧栏 */
@media (max-width: 768px) {
  .sidebar {
    width: 240px;
    padding: 10px;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 11;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .chat-panel {
    padding: 0;
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
}
</style>
