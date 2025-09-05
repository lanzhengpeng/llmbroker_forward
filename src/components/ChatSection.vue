<template>
  <section class="chat-section">
    <div class="messages" ref="msgBox" @scroll="onMessagesScroll">
      <div
        v-for="(m, idx) in localMessages"
        :key="idx"
        class="msg"
        :class="m.role"
      >
        <div class="bubble-wrap" :class="m.role">
          <span class="role">{{ m.role === 'user' ? '我' : m.role === 'assistant' ? '机器人' : m.role }}</span>
          <div class="bubble">
            <span class="text" v-if="m.html" v-html="m.html"></span>
            <span class="text" v-else>{{ m.text }}</span>
          </div>
        </div>
      </div>
      <button v-if="!atBottom" class="jump-bottom" @click="scrollToBottom">
        回到底部
      </button>
    </div>
    <div class="composer">
      <input
        v-model.trim="input"
        placeholder="输入消息..."
        @keyup.enter="onSend"
      />
      <button class="btn" v-if="streaming" @click="onCancel">取消</button>
      <button class="btn primary" :disabled="streaming" @click="onSend">
        发送
      </button>
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
    this.$el.addEventListener('click', this.onCopyClick);
  },
  beforeUnmount() {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    // 移除复制按钮监听
    this.$el.removeEventListener('click', this.onCopyClick);
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
  methods: {
    onZoom() {
      // 发送切换左侧栏的事件
      this.$emit('toggle-left-panel');
    },
    // 从后端加载聊天历史并映射到 localMessages
    async loadHistory() {
      try {
        const res = await agentRequest('/chat_session/get_chat_history', { method: 'GET' });
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
          if (typeof res.chat_sessions === 'string') {
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
          if (typeof cs === 'string') {
            try { sessions = JSON.parse(cs); } catch { sessions = []; }
          } else if (Array.isArray(cs)) { sessions = cs; } else { sessions = []; }
        } else {
          sessions = [];
        }

        // 按时间排序（升序），然后映射为 localMessages
        sessions = sessions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const mapped = sessions.map((s) => {
          const text = s.message_content ?? s.message ?? '';
          return {
            role: s.role ?? 'assistant',
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
        this.localMessages.push({ role: 'system', text: `加载历史失败: ${e?.message || e}` });
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
    renderMarkdown(text) {
      try {
        let html = marked.parse(text || "", { breaks: true });
        html = this.basicSanitize(html);
        // 处理代码块，插入复制按钮
  html = html.replace(/<pre><code( class="[^"]*")?>([\s\S]*?)<\/code><\/pre>/g, (match, cls, code) => { 
          // 解码 html 实体
          const decoded = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
          // 生成唯一 id
          const id = 'code-' + Math.random().toString(36).slice(2, 10);
          return `<div class="code-block-wrap" style="position:relative;">`
            + `<button class="copy-btn" data-code-id="${id}">复制</button>`
            + `<pre><code${cls || ''} id="${id}">${code}</code></pre>`
            + `</div>`;
        });
        return html;
      } catch {
        return text || "";
      }
    },
    // 复制代码块内容
    onCopyClick(e) {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;
      const codeId = btn.getAttribute('data-code-id');
      if (!codeId) return;
      const codeEl = document.getElementById(codeId);
      if (!codeEl) return;
      let code = codeEl.innerText;
      // 复制到剪贴板
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
          btn.innerText = '已复制';
          setTimeout(() => { btn.innerText = '复制'; }, 1200);
        });
      } else {
        // 兼容旧浏览器
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          btn.innerText = '已复制';
          setTimeout(() => { btn.innerText = '复制'; }, 1200);
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
      this.localMessages.push({ role: "user", text: userText });
      // 助手占位，并记录 index
      const aiIndex =
        this.localMessages.push({ role: "assistant", text: "", html: "", hasThought: false }) - 1;
      this.currentAssistantIndex = aiIndex;
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
                let payload = "";
                // 如果后端返回错误事件，直接作为聊天信息显示并结束流
                if (status === "error") {
                  const msg = evt.message || evt.error || JSON.stringify(evt);
                  this.localMessages.push({ role: "assistant", text: `错误: ${msg}` });
                  // abort reader/controller
                  try { controller?.abort(); } catch {}
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
                          this.localMessages[this.currentAssistantIndex].hasThought = true;
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
                    } else if (status === "final") {
                      payload = evt.result ?? evt.value ?? evt.message ?? "";
                      if (payload) {
                        // 只在final时输出最终内容，但如果当前还在输出思考（打字机活跃或队列不空），
                        // 则先保存到 pendingFinal，等待打字完成后再追加，保证思考先完成再显示回答。
                        const text = String(payload);
                        const idx = this.currentAssistantIndex;
                        if (this.typingActive || this.typingQueue.length > 0) {
                          // 延迟写入最终答案
                          this.pendingFinal = text;
                        } else {
                          if (this.localMessages[idx]) {
                            const hadThought = !!this.localMessages[idx].hasThought;
                            // 如果之前有思考内容，插入 markdown 的水平线作为分割
                            const add = (hadThought ? "\n\n---\n\n" : "") + "**" + text + "**";
                            this.localMessages[idx].text += add + "\n";
                            this.localMessages[idx].html = this.renderMarkdown(this.localMessages[idx].text);
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
        const res = await agentRequest('/chat_session/clear_chat_history', { method: 'DELETE' });
        // agentRequest 可能返回 Response-like 对象或解码后的 JSON。
        // 如果后端返回解析后的 JSON 包含 message 表示成功（例如 {message: '聊天记录已清除'}），也应视为成功。
        const isSuccess = !!(
          (res && (res.status === 200 || res.code === 200)) ||
          (res && typeof res === 'object' && typeof res.message === 'string' && /清除|已清除|删除|已删除|刪除|已刪除/.test(res.message))
        );
        if (isSuccess) {
          // 清空历史后在顶部显示一次系统提示，然后短暂显示后移除
          if (this.clearNoticeTimer) {
            clearTimeout(this.clearNoticeTimer);
            this.clearNoticeTimer = null;
          }
          this.localMessages = [];
          // 把提示插入到数组顶端
          this.localMessages.unshift({ role: 'system', text: '聊天记录已清除' });
          this.clearNoticeTimer = setTimeout(() => {
            // 移除提示（保持历史已清空）
            this.localMessages = [];
            this.clearNoticeTimer = null;
          }, 1500);
        } else {
          const status = res?.status ?? (res?.code ?? 'unknown');
          const text = res?.text ?? (res?.message ?? JSON.stringify(res));
          this.localMessages.push({ role: 'system', text: `清除失败: ${status}, ${text}` });
        }
      } catch (e) {
        this.localMessages.push({ role: 'system', text: `清除失败: ${e?.message || e}` });
      }
    },
    scrollToBottom() {
      const el = this.$refs.msgBox;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    },
    enqueueThought(text) {
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
          const hadThought = this.localMessages[idx] ? !!this.localMessages[idx].hasThought : false;
          const add = (hadThought ? "\n\n---\n\n" : "") + "**" + text + "**";
          if (this.localMessages[idx]) {
            this.localMessages[idx].text += add + "\n";
            this.localMessages[idx].html = this.renderMarkdown(this.localMessages[idx].text);
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
.messages {
  flex: 1 1 auto;
  min-height: 0; /* 关键：允许在 flex 布局中自身滚动 */
  overflow-y: auto;
  overflow-x: hidden; /* 不需要横向滚动 */
  position: relative; /* 使回到底部按钮定位于容器内 */
  margin-bottom: 12px;
  background: transparent; /* 去掉消息区背景 */
  border: none;
  border-radius: 0;
  padding: 4px 0; /* 更紧凑 */
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
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  word-break: break-word;
  white-space: pre-line;
  font-size: 16px;
  position: relative;
}
.msg.user .bubble {
  background: linear-gradient(90deg, #ffffff 80%, #ffffff 100%);
  color: #000;
  border-bottom-right-radius: 4px;
  border-top-right-radius: 18px;
  border-top-left-radius: 18px;
  border-bottom-left-radius: 18px;
}
.msg.assistant .bubble {
  background: #ffffff;
  color: #333333;
  border-bottom-left-radius: 4px;
  border-top-right-radius: 18px;
  border-top-left-radius: 18px;
  border-bottom-right-radius: 18px;
}
.bubble .text {
  white-space: pre-line;
  word-break: break-word;
}
.bubble .text hr {
  border: none;
  border-top: 1px dashed rgba(255,255,255,0.12);
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
  border: 1px solid rgba(0,0,0,0.25);
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
  position: absolute;
  right: 14px;
  bottom: 14px;
  padding: 6px 10px;
  background: #ffffff;
  border: 1px solid #d0d0d0;
  color: #333333;
  border-radius: 999px;
  cursor: pointer;
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
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
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
</style>
