<template>
  <div class="chat-container">
    <div class="messages" ref="messagesContainer">
      <div v-for="(msg, idx) in messages" :key="idx" :class="['message', msg.from]">
        <strong>{{ msg.from === 'user' ? '我' : '机器人' }}:</strong>
        <span>{{ msg.text }}</span>
      </div>
    </div>

    <input
      v-model="inputText"
      @keyup.enter="sendMessage"
      :disabled="loading"
      placeholder="请输入消息，回车发送"
      class="input-box"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      inputText: '',
      messages: [{ from: 'bot', text: '你好！欢迎使用聊天' }],
      loading: false,
    }
  },
  methods: {
    async sendMessage() {
      if (!this.inputText.trim() || this.loading) return

      // 添加用户消息
      this.messages.push({ from: 'user', text: this.inputText.trim() })
      this.loading = true

      // 先添加一个空机器人消息，后续流式更新
      this.messages.push({ from: 'bot', text: '' })

      // 调用后端接口，流式读取
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: this.inputText }),
        })

        if (!response.body) throw new Error('服务器不支持流式响应')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let done = false
        let botMsg = ''

        while (!done) {
          const { value, done: doneReading } = await reader.read()
          done = doneReading
          if (value) {
            botMsg += decoder.decode(value)
            this.messages[this.messages.length - 1].text = botMsg
          }
        }
      } catch (e) {
        this.messages[this.messages.length - 1].text = '[机器人回复出错]'
        console.error(e)
      }

      this.inputText = ''
      this.loading = false
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer
        container.scrollTop = container.scrollHeight
      })
    },
  },
}
</script>

<style scoped>
.chat-container {
  max-width: 600px;
  margin: 20px auto;
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
.message {
  margin-bottom: 8px;
}
.message.user {
  text-align: right;
  color: blue;
}
.message.bot {
  text-align: left;
  color: green;
}
.input-box {
  padding: 10px;
  font-size: 1rem;
}
</style>
