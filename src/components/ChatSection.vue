<template>
  <section class="chat-section">
    <h2>聊天区</h2>
    <div class="messages" ref="msgBox" @scroll="onMessagesScroll">
      <div
        v-for="(m, idx) in localMessages"
        :key="idx"
        class="msg"
        :class="m.role"
      >
        <span class="role">{{ m.role }}:</span>
        <span class="text" v-if="m.html" v-html="m.html"></span>
        <span class="text" v-else>{{ m.text }}</span>
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
import { agentStream } from "../api/client.js";
import { marked } from "marked";
export default {
  name: "ChatSection",
  props: {
    messages: { type: Array, default: () => [] },
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
      isHidden: false, // 页面可见性
      atBottom: true, // 是否贴底
    };
  },
  mounted() {
    this.isHidden = typeof document !== "undefined" ? document.hidden : false;
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.$nextTick(() => this.onMessagesScroll());
  },
  beforeUnmount() {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  },
  watch: {
    messages: {
      immediate: true,
      handler(v) {
        this.localMessages = Array.isArray(v) ? [...v] : [];
        this.$nextTick(this.maybeScrollToBottom);
      },
    },
  },
  methods: {
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
        const html = marked.parse(text || "", { breaks: true });
        return this.basicSanitize(html);
      } catch {
        return text || "";
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
        this.localMessages.push({ role: "assistant", text: "", html: "" }) - 1;
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
                if (status === "thought") {
                  payload = evt.value ?? evt.message ?? "";
                } else if (status === "answer") {
                  payload = evt.value ?? evt.message ?? evt.result ?? "";
                } else if (status === "final") {
                  payload = evt.result ?? evt.value ?? evt.message ?? "";
                } else if (status === "step") {
                  // 输出步骤事件
                  if (typeof evt.step !== "undefined" && evt.step !== null) {
                    payload = `步骤: ${evt.step}`;
                  } else {
                    payload = evt.value ?? evt.message ?? "";
                  }
                }
                if (payload) {
                  const text = String(payload);
                  if (
                    this.isHidden &&
                    this.localMessages[this.currentAssistantIndex]
                  ) {
                    // 后台直接写入并换行，避免被打字器/定时器节流
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
      }
    },
  },
};
</script>

<style scoped>
.chat-section {
  background: #1e1e1e;
  border: 1px solid #2a2a2a;
  border-radius: 10px;
  padding: 12px; /* 自身内边距 */
  /* 弹性填充父容器，避免超过视口 */
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: #e0e0e0;
}
.messages {
  flex: 1 1 auto;
  min-height: 0; /* 关键：允许在 flex 布局中自身滚动 */
  overflow-y: auto;
  overflow-x: hidden; /* 不需要横向滚动 */
  position: relative; /* 使回到底部按钮定位于容器内 */
  margin-bottom: 12px;
  background: #000; /* 消息区纯黑背景 */
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 10px;
}
.msg {
  margin: 6px 0;
}
.msg .role {
  color: #9aa0a6;
  margin-right: 4px;
}
.msg .text {
  /* Markdown 已转为 HTML，这里正常换行，长词断行 */
  white-space: normal;
  word-break: break-word;
}
.msg.user .role {
  color: #8ab4f8;
}
.msg.assistant .role {
  color: #81c995;
}
.composer {
  display: flex;
  gap: 8px;
  flex: 0 0 auto; /* 固定在底部，不随消息区滚动 */
  background: #1a1a1a; /* 深灰底，更贴近黑色主题 */
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 8px;
}
.composer input {
  flex: 1;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 8px 10px;
  outline: none;
  background: #121212;
  color: #e0e0e0;
}
.composer input:focus {
  border-color: #6b4ce6;
  box-shadow: 0 0 0 3px rgba(107, 76, 230, 0.25);
}
.btn {
  border: 1px solid #333;
  background: #2a2a2a;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: #e0e0e0;
}
.btn:hover {
  background: #353535;
}
.btn.primary {
  background: #6b4ce6;
  color: #fff;
  border-color: #6b4ce6;
}
.btn.primary:hover {
  background: #7a5bf0;
}

.jump-bottom {
  position: absolute;
  right: 14px;
  bottom: 14px;
  padding: 6px 10px;
  background: #2a2a2a;
  border: 1px solid #444;
  color: #e0e0e0;
  border-radius: 999px;
  cursor: pointer;
}
.jump-bottom:hover {
  background: #353535;
}

/* 聊天区域滚动条（纯黑系） */
.messages::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.messages::-webkit-scrollbar-track {
  background: #000;
}
.messages::-webkit-scrollbar-thumb {
  background-color: #0d0d0d;
  border-radius: 10px;
  border: 2px solid #000;
}
.messages::-webkit-scrollbar-thumb:hover {
  background-color: #1a1a1a;
}
.messages {
  scrollbar-width: thin;
  scrollbar-color: #0d0d0d #000;
}
</style>
