<template>
  <section class="prompt-section">
    <div class="section-body">
      <textarea
        class="command-input"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        placeholder="在这里编排/编辑提示词……"
      ></textarea>
    </div>
    <div class="section-footer">
      <button class="confirm-btn" :disabled="loading" @click="confirmPrompt">
        {{ loading ? "保存中…" : "确认" }}
      </button>
    </div>
  </section>
</template>

<script>
import { agentRequest } from "../api/client.js";

export default {
  name: "PromptSection",
  props: {
    modelValue: { type: String, default: "" },
  },
  data() {
    return { loading: false };
  },
  async mounted() {
    // 页面加载时从数据库加载提示词到内存并同步到 v-model
    try {
      await this.loadPromptFromDb();
    } catch (e) {
      // 忽略加载错误，保留当前值
      console.error("加载提示词失败", e);
    }
  },
  methods: {
    async loadPromptFromDb() {
      try {
        const res = await agentRequest("/prompt/load_task_step_prompt", {
          method: "POST",
          body: {},
        });
        // 尝试从多种可能的字段中提取提示词文本
        let promptText = "";
        if (!res) promptText = "";
        else if (typeof res === "string") promptText = res;
        else if (res.prompt) promptText = res.prompt;
        else if (res.task_step_prompt) promptText = res.task_step_prompt;
        else if (res.data && res.data.prompt) promptText = res.data.prompt;
        else if (res.result && res.result.prompt)
          promptText = res.result.prompt;
        else if (res.prompt_text) promptText = res.prompt_text;
        else promptText = "";

        // 如果拿到内容，更新到父组件 v-model
        if (promptText !== undefined && promptText !== null) {
          this.$emit("update:modelValue", String(promptText));
        }
        return res;
      } catch (e) {
        console.error("loadPromptFromDb error", e);
        throw e;
      }
    },
    async confirmPrompt() {
      if (this.loading) return;
      this.loading = true;
      try {
        // 保存到数据库（按用户要求使用 /prompt/save）
        const saveRes = await agentRequest("/prompt/save", {
          method: "POST",
          body: { prompt: this.modelValue },
        });

        const saveMsg =
          (saveRes && (saveRes.message || saveRes.detail)) || "保存成功";

        // 保存后立即从数据库加载提示词并同步到内存/界面
        try {
          await this.loadPromptFromDb();
        } catch (e) {
          console.error("保存后加载提示词失败", e);
        }

        alert(saveMsg);
      } catch (e) {
        console.error("保存提示词失败", e);
        alert(e?.message || "保存失败");
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
/* 编排区域主盒子占满父容器 */
.prompt-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: transparent; /* 去掉卡片背景 */
  border: none; /* 去掉边框 */
  border-radius: 0;
  padding: 6px 4px; /* 更紧凑的内边距 */
  min-height: 0;
  flex: 1 1 0;
  height: 100%;
  color: #333333; /* 添加深色文字 */
}
.section-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden; /* 保证内部 textarea 使用自己的滚动 */
}
.section-footer {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 8px;
}
.confirm-btn {
  background: #ffffff;
  color: #000;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.14s ease, transform 0.12s ease;
}
.confirm-btn:hover {
  background: #f0f0f0;
  transform: translateY(-1px);
}
.confirm-btn:active {
  transform: translateY(0);
}

.command-input {
  width: 100%;
  flex: 1 1 auto; /* 弹性占满剩余空间 */
  min-height: 120px;
  height: auto;
  resize: none;
  padding: 10px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
  background: #ffffff; /* 白色背景 */
  color: #333333; /* 深色文字 */
  overflow-y: auto; /* 仅保留竖向滚动 */
  overflow-x: hidden; /* 隐藏横向滚动条 */
}
.command-input:focus,
.command-input:focus-visible {
  outline: none !important;
  border-color: inherit !important;
  box-shadow: none !important;
  background: #0f0f0f;
}

/* 强制覆盖任何来自全局或浏览器的高亮（最后的保险措施） */
.prompt-section .command-input:focus,
.prompt-section .command-input:focus-visible,
.prompt-section textarea.command-input:focus,
.prompt-section textarea.command-input:focus-visible {
  outline: none !important;
  box-shadow: none !important;
  border-color: rgba(255, 255, 255, 0.02) !important;
}

/* 提示词区域滚动条（纯黑系） */
.section-body::-webkit-scrollbar,
.command-input::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.section-body::-webkit-scrollbar-track,
.command-input::-webkit-scrollbar-track {
  background: #f5f5f5;
}
.section-body::-webkit-scrollbar-thumb,
.command-input::-webkit-scrollbar-thumb {
  background-color: #d0d0d0;
  border-radius: 10px;
  border: 2px solid #f5f5f5;
}
.section-body::-webkit-scrollbar-thumb:hover,
.command-input::-webkit-scrollbar-thumb:hover {
  background-color: #b0b0b0;
}

.section-body,
.command-input {
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: #d0d0d0 #f5f5f5; /* thumb track */
}
</style>
