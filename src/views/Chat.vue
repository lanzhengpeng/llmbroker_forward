<template>
  <div class="chat-container">
    <div class="stream-toggle">
      <div class="controls-row">
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
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['message', msg.from]"
      >
        <strong>{{ msg.from === "user" ? "我" : "机器人" }}:</strong>
        <!-- 支持换行显示 -->
        <span v-html="formatReply(msg.text)"></span>
      </div>
    </div>
    <div class="input-area">
      <textarea
        v-model="inputText"
        @keydown.enter.exact.prevent="sendMessage"
        @keydown.enter.shift.exact="insertNewLine"
        :disabled="loading"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        class="input-box textarea"
        rows="3"
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
        <button @click="clearChat" :disabled="loading" class="btn">清空</button>
      </div>
      <p v-if="error" class="error-text">{{ error }}</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      inputText: "",
      messages: [{ from: "bot", text: "你好！欢迎使用聊天" }],
      loading: false,
      streamMode: true, // 是否使用流式响应
      currentStreamResponse: "", // 用于存储流式响应的临时数据
      model: "GLM-4.5-Flash", // 默认模型，可修改
      abortController: null, // 终止流用
      error: null,
    };
  },
  computed: {
    trimmedInput() {
      return this.inputText.trim();
    },
    lastUserMessage() {
      for (let i = this.messages.length - 1; i >= 0; i--) {
        if (this.messages[i].from === "user") return this.messages[i].text;
      }
      return null;
    },
    apiBase() {
      // 支持通过 Vite 环境变量配置，例如 VITE_API_BASE=http://127.0.0.1:8000
      return import.meta.env.VITE_API_BASE || "http://localhost:8000";
    },
  },
  methods: {
    formatReply(text) {
      if (!text) return "";
      // 转义HTML再把换行替换成 <br>
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
      return escaped.replace(/\n/g, "<br>");
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
    },
    async sendMessage() {
      if (!this.trimmedInput || this.loading) return;
      this.error = null;
      const userMessage = this.trimmedInput;
      this.messages.push({ from: "user", text: userMessage });
      this.loading = true;
      this.inputText = "";

      // 添加机器人的临时响应
      const botMessageIndex = this.messages.length;
      this.messages.push({
        from: "bot",
        text: this.streamMode ? "" : "思考中...",
      });

      try {
        if (this.streamMode) {
          // 使用流式API
          this.abortController = new AbortController();
          const response = await fetch(`${this.apiBase}/chat/stream`, {
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
            signal: this.abortController.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          // 创建新的 TextDecoder 用于处理流数据
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          this.currentStreamResponse = "";

          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) {
                console.log("Stream complete");
                break;
              }

              // 解码数据块并添加到响应中
              const text = decoder.decode(value, { stream: true });
              if (text) {
                this.currentStreamResponse += text;
                // 响应式更新消息
                this.messages[botMessageIndex] = {
                  from: "bot",
                  text: this.currentStreamResponse,
                };

                // 滚动到底部
                this.$nextTick(() => {
                  const container = this.$refs.messagesContainer;
                  if (container) {
                    container.scrollTop = container.scrollHeight;
                  }
                });
              }
            }
          } catch (error) {
            if (error.name === "AbortError") {
              // 用户主动停止
              this.messages[botMessageIndex] = {
                from: "bot",
                text: this.currentStreamResponse + " [已停止]",
              };
            } else {
              console.error("Stream processing error:", error);
              this.error = "流式读取失败: " + error.message;
              this.messages[botMessageIndex] = {
                from: "bot",
                text: this.currentStreamResponse || "[读取响应出错]",
              };
            }
          } finally {
            this.loading = false;
            try {
              await reader.cancel();
            } catch (e) {}
            this.abortController = null;
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
        console.error("请求错误：", e);
      }

      this.loading = false;
      this.currentStreamResponse = "";
      this.abortController = null;
      this.scrollToBottom();
    },
  },
};
</script>

<style scoped>
.chat-container {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #ddd;
  padding: 10px;
  display: flex;
  flex-direction: column;
  height: 80vh;
}
.messages {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 10px;
}
.stream-toggle {
  margin-bottom: 15px;
  text-align: right;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
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
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 8px;
  max-width: 80%;
  word-break: break-word;
}

.message.user {
  margin-left: auto;
  background-color: #dcf8c6;
  color: #000;
}

.message.bot {
  margin-right: auto;
  background-color: #fff;
  color: #000;
}

.message strong {
  display: block;
  margin-bottom: 5px;
  font-size: 0.9em;
  color: #666;
}

.input-box {
  width: 100%;
  padding: 12px;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  outline: none;
  transition: border-color 0.3s ease;
}

.input-box:focus {
  border-color: #4a9eff;
}

.input-box:disabled {
  background-color: #f5f5f5;
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
}

.btn {
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.btn:hover:not(:disabled) {
  background: #f0f0f0;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.input-area {
  margin-top: 4px;
}

.error-text {
  margin-top: 6px;
  color: #d93025;
  font-size: 13px;
}
</style>
