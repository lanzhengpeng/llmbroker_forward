<template>
  <section
    class="chat-section"
    :class="{ 'has-messages': hasMessages, 'no-messages': !hasMessages }"
  >
    <div class="messages" ref="msgBox" @scroll="onMessagesScroll">
      <div
        v-for="(m, idx) in localMessages"
        :key="idx"
        class="msg"
        :class="m.role"
      >
        <div class="bubble-wrap" :class="m.role">
          <!-- 隐藏角色标签
          <span class="role">{{
            m.role === "user"
              ? "我"
              : m.role === "assistant"
              ? "机器人"
              : m.role
          }}</span>
          -->
          <div class="bubble">
            <!-- 调试信息 -->
            <div style="font-size: 10px; color: #999; margin-bottom: 8px">
              contentItems:
              {{ m.contentItems ? m.contentItems.length : "无" }} 项
            </div>

            <!-- 混合内容显示 - 按时间顺序显示思考和工具调用 -->
            <template v-if="m.contentItems && m.contentItems.length > 0">
              <div v-for="(item, index) in m.contentItems" :key="index">
                <!-- 思考内容 -->
                <span v-if="item.type === 'thought'" class="text">{{
                  item.content
                }}</span>

                <!-- 最终回答 -->
                <div v-else-if="item.type === 'final'" class="final-answer">
                  <div class="final-separator"></div>
                  <span class="text final-text">{{ item.content }}</span>
                </div>

                <!-- 工具调用块 -->
                <div v-else-if="item.type === 'tool'" class="tool-usage-block">
                  <div
                    class="rounded-xl border-[0.5px] border-components-panel-border-subtle bg-background-section-burn"
                  >
                    <div
                      class="system-xs-medium flex cursor-pointer items-center px-2.5 py-2 text-text-tertiary pb-1.5"
                      @click="toggleToolBlock(item.content)"
                      style="user-select: none; -webkit-user-select: none"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="currentColor"
                        class="remixicon mr-1 h-3.5 w-3.5"
                      >
                        <path
                          d="M17 8V2H20C20.5523 2 21 2.44772 21 3V7C21 7.55228 20.5523 8 20 8H17ZM15 22C15 22.5523 14.5523 23 14 23H10C9.44772 23 9 22.5523 9 22V8H2.5V6.07437C2.5 5.7187 2.68891 5.3898 2.99613 5.21059L8.5 2H15V22Z"
                        ></path>
                      </svg>
                      已使用
                      <div class="mx-1 text-text-secondary">
                        {{ item.content.action || "工具调用中..." }}
                      </div>
                      <svg
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="currentColor"
                        class="remixicon ml-auto h-4 w-4"
                        :class="{ 'rotate-180': item.content.expanded }"
                      >
                        <path
                          d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z"
                        ></path>
                      </svg>
                    </div>
                    <div v-if="item.content.expanded" class="tool-details">
                      <div
                        v-if="item.content.action_input"
                        class="mx-1 mb-0.5 rounded-[10px] bg-components-panel-on-panel-item-bg text-text-secondary"
                      >
                        <div
                          class="system-xs-semibold-uppercase flex h-7 items-center justify-between px-2 pt-1"
                        >
                          请求
                        </div>
                        <div class="code-xs-regular break-words px-3 pb-2 pt-1">
                          {{ formatJsonString(item.content.action_input) }}
                        </div>
                      </div>
                      <div
                        v-if="item.content.observation"
                        class="mx-1 mb-1 rounded-[10px] bg-components-panel-on-panel-item-bg text-text-secondary"
                      >
                        <div
                          class="system-xs-semibold-uppercase flex h-7 items-center justify-between px-2 pt-1"
                        >
                          响应
                        </div>
                        <div class="code-xs-regular break-words px-3 pb-2 pt-1">
                          {{ formatJsonString(item.content.observation) }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- 回退显示 - 兼容旧格式 -->
            <template v-else>
              <!-- 普通文本内容 -->
              <span class="text" v-if="m.html" v-html="m.html"></span>
              <span class="text" v-else>{{ m.text }}</span>

              <!-- 工具使用块列表（向后兼容） -->
              <div
                v-if="m.toolCalls && m.toolCalls.length > 0"
                class="tool-calls-container"
              >
                <div
                  v-for="(toolCall, index) in m.toolCalls"
                  :key="index"
                  class="tool-usage-block"
                >
                  <!-- 工具调用块内容保持不变... -->
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
      <button v-if="!atBottom" class="jump-bottom" @click="scrollToBottom">
        <img src="/src/assets/agent/底部.svg" alt="回到底部" />
      </button>
    </div>
    <!-- 没有消息时显示的问候语 -->
    <div v-if="!hasMessages" class="greeting">
      <h2>你好，{{ user?.username || "用户" }}</h2>
    </div>
    <div class="composer">
      <div class="custom-input-grid">
        <div class="grid-area-primary">
          <div class="prosemirror-container">
            <div
              contenteditable="true"
              translate="no"
              class="ProseMirror"
              id="prompt-textarea"
              data-virtualkeyboard="true"
              @input="onInputChange"
              @keyup.enter="onSend"
              placeholder="询问任何问题"
            ></div>
          </div>
        </div>
        <div class="grid-area-leading">
          <span class="flex" data-state="closed">
            <button
              type="button"
              class="composer-btn"
              data-testid="composer-plus-btn"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                class="icon"
              >
                <path
                  d="M9.33496 16.5V10.665H3.5C3.13273 10.665 2.83496 10.3673 2.83496 10C2.83496 9.63273 3.13273 9.33496 3.5 9.33496H9.33496V3.5C9.33496 3.13273 9.63273 2.83496 10 2.83496C10.3673 2.83496 10.665 3.13273 10.665 3.5V9.33496H16.5L16.6338 9.34863C16.9369 9.41057 17.165 9.67857 17.165 10C17.165 10.3214 16.9369 10.5894 16.6338 10.6514L16.5 10.665H10.665V16.5C10.665 16.8673 10.3673 17.165 10 17.165C9.63273 17.165 9.33496 16.8673 9.33496 16.5Z"
                ></path>
              </svg>
            </button>
          </span>
        </div>
        <div class="grid-area-trailing">
          <div class="flex-gap-small">
            <span class="" data-state="closed">
              <button aria-label="听写按钮" type="button" class="composer-btn">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label=""
                  class="icon"
                  font-size="inherit"
                >
                  <path
                    d="M15.7806 10.1963C16.1326 10.3011 16.3336 10.6714 16.2288 11.0234L16.1487 11.2725C15.3429 13.6262 13.2236 15.3697 10.6644 15.6299L10.6653 16.835H12.0833L12.2171 16.8486C12.5202 16.9106 12.7484 17.1786 12.7484 17.5C12.7484 17.8214 12.5202 18.0894 12.2171 18.1514L12.0833 18.165H7.91632C7.5492 18.1649 7.25128 17.8672 7.25128 17.5C7.25128 17.1328 7.5492 16.8351 7.91632 16.835H9.33527L9.33429 15.6299C6.775 15.3697 4.6558 13.6262 3.84992 11.2725L3.76984 11.0234L3.74445 10.8906C3.71751 10.5825 3.91011 10.2879 4.21808 10.1963C4.52615 10.1047 4.84769 10.2466 4.99347 10.5195L5.04523 10.6436L5.10871 10.8418C5.8047 12.8745 7.73211 14.335 9.99933 14.335C12.3396 14.3349 14.3179 12.7789 14.9534 10.6436L15.0052 10.5195C15.151 10.2466 15.4725 10.1046 15.7806 10.1963ZM12.2513 5.41699C12.2513 4.17354 11.2437 3.16521 10.0003 3.16504C8.75675 3.16504 7.74835 4.17343 7.74835 5.41699V9.16699C7.74853 10.4104 8.75685 11.418 10.0003 11.418C11.2436 11.4178 12.2511 10.4103 12.2513 9.16699V5.41699ZM13.5814 9.16699C13.5812 11.1448 11.9781 12.7479 10.0003 12.748C8.02232 12.748 6.41845 11.1449 6.41828 9.16699V5.41699C6.41828 3.43889 8.02221 1.83496 10.0003 1.83496C11.9783 1.83514 13.5814 3.439 13.5814 5.41699V9.16699Z"
                  ></path>
                </svg>
              </button>
            </span>
            <div class="btn-container">
              <span class="" data-state="closed">
                <button
                  data-testid="composer-speech-button"
                  :aria-label="input.trim() ? '发送消息' : '启动语音模式'"
                  :class="['voice-btn', { 'send-mode': input.trim() }]"
                  @click="input.trim() ? onSend() : startVoiceMode()"
                >
                  <div class="flex items-center justify-center">
                    <!-- 有输入时显示发送图标 -->
                    <img
                      v-if="input.trim()"
                      src="/src/assets/agent/发送.svg"
                      alt="发送"
                      class="icon"
                      width="20"
                      height="20"
                    />
                    <!-- 无输入时显示语音图标 -->
                    <svg
                      v-else
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                      class="icon"
                    >
                      <path
                        d="M7.167 15.416V4.583a.75.75 0 0 1 1.5 0v10.833a.75.75 0 0 1-1.5 0Zm4.166-2.5V7.083a.75.75 0 0 1 1.5 0v5.833a.75.75 0 0 1-1.5 0ZM3 11.25V8.75a.75.75 0 0 1 1.5 0v2.5a.75.75 0 0 1-1.5 0Zm12.5 0V8.75a.75.75 0 0 1 1.5 0v2.5a.75.75 0 0 1-1.5 0Z"
                      ></path>
                    </svg>
                  </div>
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { agentStream, agentRequest } from "../api/client.js";
import { marked } from "marked";
export default {
  name: "ChatSection",
  props: {
    userId: {
      type: [String, Number],
      default: null,
    },
    user: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      input: "",
      streaming: false,
      localMessages: [],
      reader: null,
      aborter: null,
      // 打字机相关
      typingQueue: [],
      typingActive: false,
      typeAbort: false,
      typeDelay: 30, // 每字符间隔(ms)
      currentAssistantIndex: -1,
      currentToolMessageIndex: -1, // 当前工具调用消息索引
      pendingFinal: null,
      clearNoticeTimer: null,
      isHidden: false, // 页面可见性
      atBottom: true, // 是否贴底
    };
  },
  mounted() {
    this.isHidden = typeof document !== "undefined" ? document.hidden : false;
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.$nextTick(() => this.onMessagesScroll());
    // 页面加载时尝试拉取历史聊天记录
    this.loadHistory();
    // 监听复制按钮点击
    this.$el.addEventListener("click", this.onCopyClick);
  },
  beforeUnmount() {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    // 移除复制按钮监听
    this.$el.removeEventListener("click", this.onCopyClick);
    if (this.clearNoticeTimer) {
      clearTimeout(this.clearNoticeTimer);
      this.clearNoticeTimer = null;
    }
  },
  watch: {
    userId: {
      immediate: false,
      handler() {
        this.loadHistory();
      },
    },
    messages: {
      immediate: true,
      handler(v) {
        this.localMessages = Array.isArray(v) ? [...v] : [];
        this.$nextTick(this.maybeScrollToBottom);
      },
    },
  },
  computed: {
    hasMessages() {
      return this.localMessages && this.localMessages.length > 0;
    },
  },
  methods: {
    onInputChange(event) {
      this.input = event.target.textContent || event.target.innerText || "";
      // 确保空内容时显示placeholder
      if (!this.input.trim()) {
        event.target.innerHTML = "";
      }
    },
    // 启动语音模式
    startVoiceMode() {
      // 这里可以实现语音识别功能
      console.log("启动语音模式");
      // 目前只是一个占位符，未来可以集成语音识别API
    },
    onZoom() {
      // 发送切换左侧栏的事件
      this.$emit("toggle-left-panel");
    },
    // 从后端加载聊天历史并映射到 localMessages
    async loadHistory() {
      try {
        const res = await agentRequest("/chat_session/get_chat_history", {
          method: "GET",
        });
        // 支持多种后端返回格式：
        // 1) { chat_sessions: '[{...},...]' } (字符串化的 JSON)
        // 2) { chat_sessions: [{...}, ...] }
        // 3) 直接返回数组
        let sessions = null;
        if (!res) {
          sessions = [];
        } else if (Array.isArray(res)) {
          sessions = res;
        } else if (res.chat_sessions) {
          if (typeof res.chat_sessions === "string") {
            try {
              sessions = JSON.parse(res.chat_sessions);
            } catch {
              sessions = [];
            }
          } else if (Array.isArray(res.chat_sessions)) {
            sessions = res.chat_sessions;
          } else {
            sessions = [];
          }
        } else if (res.data && res.data.chat_sessions) {
          const cs = res.data.chat_sessions;
          if (typeof cs === "string") {
            try {
              sessions = JSON.parse(cs);
            } catch {
              sessions = [];
            }
          } else if (Array.isArray(cs)) {
            sessions = cs;
          } else {
            sessions = [];
          }
        } else {
          sessions = [];
        }

        // 按时间排序（升序），然后映射为 localMessages
        sessions = sessions.sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        const mapped = sessions.map((s) => {
          const text = s.message_content ?? s.message ?? "";
          return {
            role: s.role ?? "assistant",
            text,
            html: this.renderMarkdown(text),
            messageId: s.message_id,
            created_at: s.created_at,
          };
        });
        this.localMessages = mapped;
        this.$nextTick(this.scrollToBottom);
      } catch (e) {
        // 拉取失败时在界面显示一条系统信息（但不打断页面）
        this.localMessages.push({
          role: "system",
          text: `加载历史失败: ${e?.message || e}`,
        });
      }
    },
    onMessagesScroll() {
      const el = this.$refs.msgBox;
      if (!el) return;
      const threshold = 20; // px 容差
      this.atBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    },
    maybeScrollToBottom() {
      if (this.atBottom) this.scrollToBottom();
    },
    // 切换工具块的展开/收起状态
    toggleToolBlock(toolCall) {
      // 切换单个工具调用的展开状态
      this.$set(toolCall, "expanded", !toolCall.expanded);
      console.log("切换工具块状态:", toolCall.expanded);
    },
    // 格式化JSON字符串显示
    formatJsonString(jsonStr) {
      try {
        if (typeof jsonStr === "string") {
          // 尝试解析并重新格式化
          const parsed = JSON.parse(jsonStr);
          return JSON.stringify(parsed, null, 2);
        } else if (typeof jsonStr === "object") {
          return JSON.stringify(jsonStr, null, 2);
        }
        return jsonStr;
      } catch (e) {
        // 如果不是有效的JSON，直接返回原字符串
        return jsonStr;
      }
    },
    renderMarkdown(text) {
      try {
        let html = marked.parse(text || "", { breaks: true });
        html = this.basicSanitize(html);
        // 处理代码块，插入复制按钮
        html = html.replace(
          /<pre><code( class="[^"]*")?>([\s\S]*?)<\/code><\/pre>/g,
          (match, cls, code) => {
            // 解码 html 实体
            const decoded = code
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
            // 生成唯一 id
            const id = "code-" + Math.random().toString(36).slice(2, 10);
            return (
              `<div class="code-block-wrap" style="position:relative;">` +
              `<button class="copy-btn" data-code-id="${id}">复制</button>` +
              `<pre><code${cls || ""} id="${id}">${code}</code></pre>` +
              `</div>`
            );
          }
        );
        return html;
      } catch {
        return text || "";
      }
    },
    // 复制代码块内容
    onCopyClick(e) {
      const btn = e.target.closest(".copy-btn");
      if (!btn) return;
      const codeId = btn.getAttribute("data-code-id");
      if (!codeId) return;
      const codeEl = document.getElementById(codeId);
      if (!codeEl) return;
      let code = codeEl.innerText;
      // 复制到剪贴板
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
          btn.innerText = "已复制";
          setTimeout(() => {
            btn.innerText = "复制";
          }, 1200);
        });
      } else {
        // 兼容旧浏览器
        const textarea = document.createElement("textarea");
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
          btn.innerText = "已复制";
          setTimeout(() => {
            btn.innerText = "复制";
          }, 1200);
        } catch {}
        document.body.removeChild(textarea);
      }
    },
    basicSanitize(html) {
      if (!html) return "";
      // 移除脚本标签
      html = html.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        ""
      );
      // 移除内联事件处理
      html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
      html = html.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
      html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
      // 阻断 javascript: 协议
      html = html.replace(
        /(href|src)\s*=\s*(["'])\s*javascript:[^\2]*\2/gi,
        '$1="#"'
      );
      return html;
    },
    onVisibilityChange() {
      this.isHidden = document.hidden;
    },
    async onSend() {
      if (!this.input || this.streaming) return;
      const userText = this.input;
      this.input = "";
      // 清空DOM中的contenteditable内容
      const inputElement = document.getElementById("prompt-textarea");
      if (inputElement) {
        inputElement.innerHTML = "";
      }
      this.localMessages.push({ role: "user", text: userText });
      // 助手占位，并记录 index
      const aiIndex =
        this.localMessages.push({
          role: "assistant",
          text: "",
          html: "",
          hasThought: false,
          toolCalls: [], // 保留向后兼容
          contentItems: [], // 新的混合内容数组，按时间顺序存储思考和工具调用
        }) - 1;
      this.currentAssistantIndex = aiIndex;
      console.log("创建助手消息，索引:", aiIndex);
      this.streaming = true;
      try {
        const { reader, controller } = await agentStream(
          "/agent/run_agent_stream",
          {
            method: "POST",
            body: { task: userText },
          }
        );
        this.reader = reader;
        this.aborter = controller;
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || ""; // 残余保留
          for (const line of lines) {
            if (!line || !line.startsWith("data:")) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const evt = JSON.parse(jsonStr);
              if (evt && typeof evt === "object") {
                const status = evt.status;
                // 添加调试日志 - 所有事件
                console.log("接收到事件:", status, evt);

                // 特别关注最终回答事件
                if (status === "final" || status === "answer") {
                  console.log("🎯 捕获到最终回答事件:", {
                    status: status,
                    evt: evt,
                    result: evt.result,
                    value: evt.value,
                    message: evt.message,
                  });
                }

                // 检查是否包含最终回答的其他可能字段
                if (evt.result || evt.final || evt.answer) {
                  console.log("🔍 事件包含可能的最终回答字段:", {
                    status: status,
                    result: evt.result,
                    final: evt.final,
                    answer: evt.answer,
                    fullEvent: evt,
                  });
                }

                // 特别关注工具相关事件
                if (
                  status === "action" ||
                  status === "action_input" ||
                  status === "observation"
                ) {
                  console.log("工具事件详情:", {
                    status: status,
                    value: evt.value,
                    currentAssistantIndex: this.currentAssistantIndex,
                    messageExists:
                      !!this.localMessages[this.currentAssistantIndex],
                    currentMessage:
                      this.localMessages[this.currentAssistantIndex],
                  });
                }

                // 特别关注最终回答事件
                if (status === "final" || status === "answer") {
                  console.log("最终回答事件详情:", {
                    status: status,
                    result: evt.result,
                    value: evt.value,
                    message: evt.message,
                    currentAssistantIndex: this.currentAssistantIndex,
                    messageExists:
                      !!this.localMessages[this.currentAssistantIndex],
                    typingActive: this.typingActive,
                    typingQueueLength: this.typingQueue.length,
                  });
                }

                let payload = "";
                // 如果后端返回错误事件，直接作为聊天信息显示并结束流
                if (status === "error") {
                  const msg = evt.message || evt.error || JSON.stringify(evt);
                  this.localMessages.push({
                    role: "assistant",
                    text: `错误: ${msg}`,
                  });
                  // abort reader/controller
                  try {
                    controller?.abort();
                  } catch {}
                  this.streaming = false;
                  this.reader = null;
                  this.aborter = null;
                  return;
                }
                if (status === "thought") {
                  payload = evt.value ?? evt.message ?? "";
                  if (payload) {
                    const text = String(payload);
                    // 标记该助手机器人消息包含思考内容
                    if (this.localMessages[this.currentAssistantIndex]) {
                      this.localMessages[
                        this.currentAssistantIndex
                      ].hasThought = true;
                    }
                    if (
                      this.isHidden &&
                      this.localMessages[this.currentAssistantIndex]
                    ) {
                      this.localMessages[this.currentAssistantIndex].text +=
                        text + "\n";
                      this.localMessages[this.currentAssistantIndex].html =
                        this.renderMarkdown(
                          this.localMessages[this.currentAssistantIndex].text
                        );
                      this.$nextTick(this.maybeScrollToBottom);
                    } else {
                      this.enqueueThought(text);
                    }
                  }
                } else if (
                  status === "action" ||
                  status === "action_input" ||
                  status === "observation"
                ) {
                  // 处理工具调用相关事件（action、action_input、observation）
                  const idx = this.currentAssistantIndex;
                  console.log("处理工具事件:", {
                    status: status,
                    value: evt.value,
                    idx: idx,
                    messageExists: !!this.localMessages[idx],
                    totalMessages: this.localMessages.length,
                  });

                  if (this.localMessages[idx] && evt.value) {
                    // toolCalls数组已在消息创建时初始化
                    let currentToolCall = null;

                    if (status === "action") {
                      // 只有当action不为NONE时才在当前消息中添加工具调用块
                      if (evt.value && evt.value !== "NONE") {
                        // 在当前助手消息中添加工具调用
                        currentToolCall = {
                          action: evt.value,
                          action_input: null,
                          observation: null,
                          expanded: true, // 默认展开，方便查看生成过程
                        };
                        this.localMessages[idx].toolCalls.push(currentToolCall);

                        // 同时添加到混合内容数组
                        if (this.localMessages[idx].contentItems) {
                          this.localMessages[idx].contentItems.push({
                            type: "tool",
                            content: currentToolCall,
                            timestamp: Date.now(),
                          });
                        }

                        console.log("在当前消息中添加工具调用块:", evt.value);
                      } else {
                        console.log("收到NONE action，不创建工具调用块");
                        return;
                      }
                    } else {
                      // action_input 或 observation 事件
                      // 更新当前消息中的最后一个工具调用
                      const toolCalls = this.localMessages[idx].toolCalls;
                      if (toolCalls.length > 0) {
                        currentToolCall = toolCalls[toolCalls.length - 1];
                        // 设置对应字段
                        if (currentToolCall) {
                          this.$set(currentToolCall, status, evt.value);
                          console.log(`更新工具调用 ${status}:`, evt.value);
                        }
                      } else {
                        // 如果没有有效的工具调用，忽略这些事件
                        console.log(
                          `忽略 ${status} 事件，因为没有有效的工具调用`
                        );
                        return;
                      }
                    }

                    this.$nextTick(this.maybeScrollToBottom);
                  }
                } else if (status === "tool_call") {
                  // 处理完整工具调用事件（保留向后兼容）
                  const idx = this.currentAssistantIndex;
                  if (this.localMessages[idx]) {
                    // 设置工具调用信息
                    if (evt.action) {
                      this.localMessages[idx].action = evt.action;
                    }
                    if (evt.action_input) {
                      this.localMessages[idx].action_input = evt.action_input;
                    }
                    if (evt.observation) {
                      this.localMessages[idx].observation = evt.observation;
                    }
                    // 如果事件包含完整的工具信息对象
                    if (evt.tool_call) {
                      const toolCall = evt.tool_call;
                      if (toolCall.action) {
                        this.localMessages[idx].action = toolCall.action;
                      }
                      if (toolCall.action_input) {
                        this.localMessages[idx].action_input =
                          toolCall.action_input;
                      }
                      if (toolCall.observation) {
                        this.localMessages[idx].observation =
                          toolCall.observation;
                      }
                    }
                    // 设置默认收起状态
                    if (
                      !this.localMessages[idx].hasOwnProperty("toolExpanded")
                    ) {
                      this.$set(this.localMessages[idx], "toolExpanded", false);
                    }
                    this.$nextTick(this.maybeScrollToBottom);
                  }
                } else if (status === "final" || status === "answer") {
                  // 处理最终回答（final 和 answer 任选其一）
                  payload = evt.result ?? evt.value ?? evt.message ?? "";
                  console.log("处理最终回答:", {
                    status: status,
                    payload: payload,
                    currentAssistantIndex: this.currentAssistantIndex,
                    typingActive: this.typingActive,
                    typingQueueLength: this.typingQueue.length,
                  });

                  if (payload) {
                    const text = String(payload);
                    const idx = this.currentAssistantIndex;

                    if (this.typingActive || this.typingQueue.length > 0) {
                      // 延迟写入最终答案
                      this.pendingFinal = text;
                    } else {
                      if (this.localMessages[idx]) {
                        // 添加到混合内容数组
                        if (this.localMessages[idx].contentItems) {
                          this.localMessages[idx].contentItems.push({
                            type: "final",
                            content: text,
                            timestamp: Date.now(),
                          });
                          console.log("成功添加最终回答到contentItems:", text);
                        } else {
                          // 回退到旧方式（向后兼容）
                          const hadThought =
                            !!this.localMessages[idx].hasThought;
                          const add =
                            (hadThought ? "\n\n---\n\n" : "") +
                            "**" +
                            text +
                            "**";
                          this.localMessages[idx].text += add + "\n";
                          this.localMessages[idx].html = this.renderMarkdown(
                            this.localMessages[idx].text
                          );
                        }
                        this.$nextTick(this.maybeScrollToBottom);
                      } else {
                        // 回退：如果未找到占位，就入队正常显示
                        this.enqueueThought("**" + text + "**");
                      }
                    }
                  }
                }
              }
            } catch {
              // 忽略非 JSON 行
            }
          }
        }
      } catch (e) {
        this.localMessages.push({
          role: "system",
          text: `流式出错: ${e?.message || e}`,
        });
      } finally {
        this.streaming = false;
        this.reader = null;
        this.aborter = null;
      }
    },
    onCancel() {
      try {
        this.aborter?.abort();
      } catch {}
      this.streaming = false;
      // 中止打字并清空队列
      this.typeAbort = true;
      this.typingQueue = [];
      // 清理任何待写入的最终答案
      this.pendingFinal = null;
    },
    async clearHistory() {
      try {
        const res = await agentRequest("/chat_session/clear_chat_history", {
          method: "DELETE",
        });
        // agentRequest 可能返回 Response-like 对象或解码后的 JSON。
        // 如果后端返回解析后的 JSON 包含 message 表示成功（例如 {message: '聊天记录已清除'}），也应视为成功。
        const isSuccess = !!(
          (res && (res.status === 200 || res.code === 200)) ||
          (res &&
            typeof res === "object" &&
            typeof res.message === "string" &&
            /清除|已清除|删除|已删除|刪除|已刪除/.test(res.message))
        );
        if (isSuccess) {
          // 成功时直接清空，不显示提示信息
          if (this.clearNoticeTimer) {
            clearTimeout(this.clearNoticeTimer);
            this.clearNoticeTimer = null;
          }
          this.localMessages = [];
        } else {
          const status = res?.status ?? res?.code ?? "unknown";
          const text = res?.text ?? res?.message ?? JSON.stringify(res);
          this.localMessages.push({
            role: "system",
            text: `清除失败: ${status}, ${text}`,
          });
        }
      } catch (e) {
        this.localMessages.push({
          role: "system",
          text: `清除失败: ${e?.message || e}`,
        });
      }
    },
    scrollToBottom() {
      const el = this.$refs.msgBox;
      if (!el) return;
      // 使用平滑滚动到底部
      el.scrollTo({
        top: el.scrollHeight,
        behavior: "smooth",
      });
    },
    enqueueThought(text) {
      // 同时添加到混合内容数组
      const idx = this.currentAssistantIndex;
      if (this.localMessages[idx] && this.localMessages[idx].contentItems) {
        this.localMessages[idx].contentItems.push({
          type: "thought",
          content: text,
          timestamp: Date.now(),
        });
        console.log(
          "添加思考内容到contentItems:",
          text.substring(0, 50) + "..."
        );
      }

      this.typingQueue.push(text);
      this.startTyping();
    },
    async startTyping() {
      if (this.typingActive) return;
      this.typingActive = true;
      this.typeAbort = false;
      const idx = this.currentAssistantIndex;
      try {
        while (!this.typeAbort && this.typingQueue.length > 0) {
          const block = this.typingQueue.shift();
          if (this.isHidden || this.typeDelay <= 0) {
            // 标签页隐藏时或无延迟时，整块快速写入，避免后台限速导致暂停
            if (this.localMessages[idx]) {
              this.localMessages[idx].text += block + "\n";
              this.localMessages[idx].html = this.renderMarkdown(
                this.localMessages[idx].text
              );
              await this.$nextTick();
              this.maybeScrollToBottom();
            }
          } else {
            // 前台逐字打字
            for (const ch of block) {
              if (this.typeAbort) break;
              if (!this.localMessages[idx]) break;
              this.localMessages[idx].text += ch;
              this.localMessages[idx].html = this.renderMarkdown(
                this.localMessages[idx].text
              );
              await this.$nextTick();
              this.maybeScrollToBottom();
              if (this.typeDelay > 0)
                await new Promise((r) => setTimeout(r, this.typeDelay));
            }
            if (this.typeAbort) break;
            // 每输出一块就换行
            if (this.localMessages[idx]) {
              this.localMessages[idx].text += "\n";
              this.localMessages[idx].html = this.renderMarkdown(
                this.localMessages[idx].text
              );
              await this.$nextTick();
              this.maybeScrollToBottom();
            }
          }
        }
      } finally {
        this.typingActive = false;
        // 如果在打字过程中收到了 final（被延迟），现在把它写入消息
        if (this.pendingFinal) {
          const text = String(this.pendingFinal);
          const idx = this.currentAssistantIndex;

          if (this.localMessages[idx]) {
            // 使用新的混合内容结构
            if (this.localMessages[idx].contentItems) {
              this.localMessages[idx].contentItems.push({
                type: "final",
                content: text,
                timestamp: Date.now(),
              });
            } else {
              // 回退到旧方式（向后兼容）
              const hadThought = !!this.localMessages[idx].hasThought;
              const add =
                (hadThought ? "\n\n---\n\n" : "") + "**" + text + "**";
              this.localMessages[idx].text += add + "\n";
              this.localMessages[idx].html = this.renderMarkdown(
                this.localMessages[idx].text
              );
            }
            this.$nextTick(this.maybeScrollToBottom);
          } else {
            this.enqueueThought("**" + text + "**");
          }
          this.pendingFinal = null;
        }
      }
    },
  },
};
</script>

<style scoped>
/* 聊天区域主盒子占满父容器 */
.chat-section {
  background: transparent; /* 去掉卡片外壳 */
  border: none;
  border-radius: 0;
  padding: 0; /* 消除与父容器的间隙 */
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: #333333;
  flex: 1 1 0;
  height: 100%;
}

/* 没有消息时 - 居中显示 */
.chat-section.no-messages {
  justify-content: center; /* 垂直居中 */
  align-items: center; /* 水平居中 */
}

/* 没有消息时，创建一个包装容器来包含问候语和输入框 */
.chat-section.no-messages .greeting,
.chat-section.no-messages .composer {
  position: relative;
}

/* 问候语样式 */
.greeting {
  margin-bottom: 48px; /* 与输入框的间距翻倍：24px -> 48px */
  text-align: center;
  transform: translateY(-42px); /* 向上偏移更多，考虑输入框中心居中 */
}

.greeting h2 {
  font-size: 36px; /* 字体大小增加到3/2：24px -> 36px */
  font-weight: bold;
  color: #333333;
  margin: 0;
}

/* 没有消息时，输入框偏移让其中心居中 */
.chat-section.no-messages .composer {
  width: 100%; /* 占满聊天区域宽度 */
  max-width: none; /* 移除最大宽度限制 */
  transition: all 0.3s ease; /* 添加过渡动画 */
  transform: translateY(
    -70px
  ); /* 向上偏移，让输入框中心居中 (问候语84px + 输入框28px = 112px的一半约56px + 额外调整) */
}

/* 没有消息时的输入框宽度 - 默认(侧边栏展开时) */
.chat-section.no-messages .custom-input-grid {
  width: calc(
    50vw - 128px
  ); /* 整个界面宽度的一半减去侧边栏宽度的一半(256px/2) */
  max-width: none; /* 移除最大宽度限制 */
  transition: all 0.3s ease; /* 添加过渡动画 */
}

/* 有消息时 - 正常布局 */
.chat-section.has-messages {
  justify-content: flex-end; /* 输入框在底部 */
}

/* 有消息时的输入框宽度 - 保持与无消息时相同 */
.chat-section.has-messages .composer {
  width: 100%; /* 占满聊天区域宽度 */
  max-width: none; /* 移除最大宽度限制 */
  transition: all 0.3s ease; /* 添加过渡动画 */
  align-items: center; /* 水平居中 */
  align-self: center; /* 自身居中 */
}

.chat-section.has-messages .custom-input-grid {
  width: calc(50vw - 128px); /* 与无消息时保持相同宽度 */
  max-width: none; /* 移除最大宽度限制 */
  transition: all 0.3s ease; /* 添加过渡动画 */
}
.messages {
  flex: 1 1 auto;
  min-height: 0; /* 关键：允许在 flex 布局中自身滚动 */
  overflow-y: auto;
  overflow-x: hidden; /* 不需要横向滚动 */
  position: relative; /* 改回相对定位 */
  margin-bottom: 12px;
  background: transparent; /* 去掉消息区背景 */
  border: none;
  /* 让滚动条显示在最右边 */
  width: 100%;
  padding-right: 0;
}

/* 没有消息时隐藏消息区域 */
.chat-section.no-messages .messages {
  display: none;
}

/* 有消息时显示消息区域 */
.chat-section.has-messages .messages {
  display: block;
  /* 让消息区域占满全宽，但内容居中 */
  width: 100%; /* 占满全宽，滚动条在最右边 */
  max-width: none;
  margin: 0 auto 12px auto; /* 垂直居中，底部保持12px间距 */
  padding: 0; /* 移除内边距 */
  box-sizing: border-box;
}

/* 消息内容容器，限制宽度并居中 */
.chat-section.has-messages .messages .msg {
  max-width: calc(50vw - 128px); /* 限制消息宽度 */
  margin-left: auto;
  margin-right: auto;
  margin-top: 10px;
  margin-bottom: 10px;
}

.msg {
  margin: 10px 0;
  display: flex;
  justify-content: flex-start;
}
.msg.user {
  justify-content: flex-end;
}
.bubble-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 80%;
}
.msg.user .bubble-wrap {
  align-items: flex-end;
}
/* 机器人消息占满全宽 */
.msg.assistant .bubble-wrap {
  max-width: 100%; /* 机器人消息占满整个容器宽度 */
  align-items: flex-start;
}
.bubble-wrap .role {
  font-size: 13px;
  color: #666666;
  margin-bottom: 2px;
  margin-left: 6px;
  margin-right: 6px;
}
.msg.user .bubble-wrap .role {
  color: #333333;
  align-self: flex-end;
}
.msg.assistant .bubble-wrap .role {
  color: #333333;
  align-self: flex-start;
}
.bubble {
  background: #ffffff;
  color: #333333;
  border-radius: 18px;
  padding: 10px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  word-break: break-word;
  white-space: pre-line;
  font-size: 16px;
  position: relative;
}
.msg.user .bubble {
  background: #e9e9e980; /* 新的背景色，80表示透明度 */
  color: #0d0d0d; /* 新的字体颜色 */
  border-bottom-right-radius: 4px;
  border-top-right-radius: 18px;
  border-top-left-radius: 18px;
  border-bottom-left-radius: 18px;
}
.msg.assistant .bubble {
  background: transparent; /* 移除背景色 */
  color: #333333;
  border-radius: 0; /* 移除圆角 */
  box-shadow: none; /* 移除阴影 */
  padding: 10px 0; /* 调整内边距，移除左右padding */
}
.bubble .text {
  white-space: pre-line;
  word-break: break-word;
}
.bubble .text hr {
  border: none;
  border-top: 1px dashed rgba(255, 255, 255, 0.12);
  margin: 8px 0;
}
.bubble .text strong {
  font-weight: 800;
  color: #000000;
}
.composer {
  display: flex;
  gap: 8px;
  flex: 0 0 auto; /* 固定在底部，不随消息区滚动 */
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 6px 0;
  width: 100%;
  max-width: 600px; /* 限制最大宽度 */
  flex-direction: column; /* 垂直排列 */
}

/* 没有消息时 - 居中对齐 */
.chat-section.no-messages .composer {
  align-items: center; /* 水平居中 */
}

/* 有消息时 - 保持居中对齐 */
.chat-section.has-messages .composer {
  align-items: center; /* 水平居中 */
  align-self: center; /* 自身居中 */
}
.composer input {
  flex: 1;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  background: #ffffff;
  outline: none;
  padding: 8px 12px;
  color: #333333;
}
.composer input:focus {
  outline: none;
  border-color: #b0b0b0;
  box-shadow: none;
  background: #ffffff;
}
.btn {
  border: 1px solid rgba(0, 0, 0, 0.25);
  background: #ffffff;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: #000000;
}
.btn:hover {
  background: #f0f0f0;
}
.btn.primary {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}
.btn.primary:hover {
  background: #f0f0f0;
}

.jump-bottom {
  position: fixed; /* 固定定位，相对于视口 */
  /* 计算输入框的中心位置 */
  left: calc(256px + (100vw - 256px) / 2); /* 侧边栏宽度 + 右侧区域的中心 */
  bottom: 80px; /* 在输入框上方 */
  transform: translateX(-50%); /* 水平居中 */
  padding: 8px;
  background: #ffffff;
  border: 1px solid #d0d0d0;
  color: #333333;
  border-radius: 50%; /* 圆形按钮 */
  cursor: pointer;
  width: 40px; /* 固定宽高 */
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); /* 添加阴影 */
  z-index: 100; /* 确保在其他元素上方 */
}

.jump-bottom img {
  width: 20px;
  height: 20px;
}
.jump-bottom:hover {
  background: #f8f8f8;
}

/* 聊天区域滚动条（白色系） */
.messages::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.messages::-webkit-scrollbar-track {
  background: #ffffff;
}
.messages::-webkit-scrollbar-thumb {
  background-color: #d0d0d0;
  border-radius: 10px;
  border: 2px solid #ffffff;
}
.messages::-webkit-scrollbar-thumb:hover {
  background-color: #b0b0b0;
}
.messages {
  scrollbar-width: thin;
  scrollbar-color: #d0d0d0 #ffffff;
}

/* 代码块复制按钮样式 */
/* 代码块复制按钮样式优化，保证在气泡内右上角始终可见 */
.code-block-bubble {
  position: relative;
  margin: 8px 0;
}
.code-block-bubble .copy-btn {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 10;
  font-size: 13px;
  padding: 2px 10px;
  border-radius: 6px;
  border: none;
  background: #ffffff;
  color: #000;
  cursor: pointer;
  opacity: 0.92;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: background 0.2s, opacity 0.2s;
}
.code-block-bubble .copy-btn:hover {
  background: #f0f0f0;
  opacity: 1;
}
@media (max-width: 600px) {
  .code-block-bubble .copy-btn {
    font-size: 15px;
    padding: 6px 16px;
    top: 4px;
    right: 4px;
  }
}

/* 响应式布局：移动端适配 */
@media (max-width: 600px) {
  .chat-section {
    padding: 0;
    border-radius: 0;
    font-size: 15px;
  }
  .messages {
    padding: 4px;
    border-radius: 0;
    margin-bottom: 8px;
    font-size: 15px;
  }
  .msg {
    margin: 6px 0;
    font-size: 15px;
  }
  .bubble-wrap {
    max-width: 95%;
  }
  .bubble {
    font-size: 15px;
    padding: 8px 12px;
  }
  .composer {
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    border-radius: 0;
  }
  .composer input {
    padding: 7px 8px;
    font-size: 15px;
    border-radius: 6px;
  }
  .btn {
    width: 100%;
    padding: 8px 0;
    font-size: 15px;
    border-radius: 6px;
  }
  .jump-bottom {
    right: 8px;
    bottom: 8px;
    padding: 5px 8px;
    font-size: 14px;
    border-radius: 999px;
  }
}

/* 新的聊天输入样式 */
.bg-token-bg-primary {
  background-color: #f5f5f5;
  border: 1px solid #d1d5db;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.shadow-short {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.composer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #666;
}

.composer-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.composer-secondary-button-color {
  background-color: #f0f0f0;
  color: #374151;
}

.ProseMirror {
  outline: none;
  border: none;
  resize: none;
  background: transparent;
  font-size: 16px;
  line-height: 1.5;
  color: #111827;
  min-height: 1.5em;
  padding: 8px 0; /* 添加内边距 */
}

.placeholder::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  pointer-events: none;
  position: absolute;
  left: 0;
  top: 8px; /* 与ProseMirror的padding对齐 */
}

.ProseMirror:empty::before {
  content: "询问任何问题";
  color: #9ca3af;
  pointer-events: none;
}

.ProseMirror:focus {
  outline: none;
}

.icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

/* Send mode下的图标颜色 */
.voice-btn.send-mode .icon {
  filter: brightness(0) invert(1);
}

/* 自定义grid布局 */
.custom-input-grid {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    "header header header"
    "leading primary trailing"
    ". footer .";
  border-radius: 28px;
  background-color: #f5f5f5;
  border: 1px solid #d1d5db;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 0.625rem;
  contain: inline-size;
  background-clip: padding-box;
  overflow: clip;
  width: 100%;
  max-width: 500px; /* 有消息时的最大宽度 */
  min-height: 56px; /* 确保最小高度 */
}

/* 没有消息时，输入框占据右侧区域的一半宽度 */
.chat-section.no-messages .custom-input-grid {
  width: 50%;
  max-width: none; /* 移除最大宽度限制 */
}

.grid-area-primary {
  grid-area: primary;
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  overflow-x: hidden;
  padding: 0 0.375rem;
  margin: -0.625rem 0;
}

.grid-area-leading {
  grid-area: leading;
  display: flex;
  align-items: center; /* 垂直居中 */
  justify-content: center; /* 水平居中 */
  min-height: 3.5rem; /* 与primary区域保持同样的最小高度 */
}

.grid-area-trailing {
  grid-area: trailing;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  min-height: 3.5rem; /* 与其他区域保持同样的最小高度 */
}

.prosemirror-container {
  position: relative;
  color: #111827;
  max-height: min(35vh, 13rem);
  flex: 1 1 0%;
  overflow: auto;
}

.flex-gap-small {
  display: flex;
  gap: 0.375rem;
}

.btn-container {
  min-width: 2.25rem;
}

.voice-btn {
  position: relative;
  display: flex;
  height: 2.25rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: #f0f0f0;
  color: #374151;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.voice-btn:hover {
  opacity: 0.8;
}

.voice-btn:disabled {
  color: #f9fafb;
  opacity: 0.3;
}

/* Send button state when input has text */
.voice-btn.send-mode {
  background-color: #000000;
  color: white;
}

.voice-btn.send-mode:hover {
  background-color: #333333;
  opacity: 1;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.justify-center {
  justify-content: center;
}

._fallbackTextarea_ebv8s_2 {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
}

/* 工具调用容器样式 */
.tool-calls-container {
  margin-top: 8px;
  padding-top: 0px;
  /* 移除边框，因为现在是独立消息 */
}

/* 工具使用块样式 */
.tool-usage-block {
  margin-bottom: 12px;
}

/* 最终回答样式 */
.final-answer {
  margin-top: 16px;
}

.final-separator {
  height: 1px;
  background-color: #e5e7eb;
  margin: 16px 0 12px 0;
}

.final-text {
  font-weight: 600;
  color: #1f2937;
}

.border-components-panel-border-subtle {
  border-color: #e0e0e0;
}

.bg-background-section-burn {
  background-color: #f8f9fa;
}

.system-xs-medium {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
}

.text-text-tertiary {
  color: #6b7280;
}

.text-text-secondary {
  color: #374151;
}

.bg-components-panel-on-panel-item-bg {
  background-color: #ffffff;
}

.system-xs-semibold-uppercase {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.code-xs-regular {
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  white-space: pre-wrap;
}

.rotate-180 {
  transform: rotate(180deg);
}

.remixicon {
  transition: transform 0.2s ease;
}

.tool-details {
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}
</style>
