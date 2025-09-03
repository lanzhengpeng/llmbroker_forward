<template>
  <section class="prompt-section">
    <h2>提示词编排</h2>
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
  gap: 10px;
  background: #1e1e1e;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 12px;
  min-height: 0;
  flex: 1 1 0;
  height: 100%;
}
.section-body {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
}
.section-footer {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 10px;
}
.confirm-btn {
  background: #3a8bf6;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 24px;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: background 0.14s ease, transform 0.12s ease, box-shadow 0.12s ease,
    border-color 0.12s ease;
}
.confirm-btn:hover {
  background: #2f7ddf;
  transform: translateY(-1px);
  box-shadow: 0 10px 30px rgba(58, 139, 246, 0.12);
}
.confirm-btn:active {
  transform: translateY(0);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.section-body {
  flex: 1 1 auto;
  overflow-y: auto; /* 仅保留竖向滚动 */
  overflow-x: hidden; /* 隐藏横向滚动条 */
}
.command-input {
  width: 100%;
  height: 100%;
  min-height: 120px;
  resize: none;
  padding: 10px 12px;
  border: 1px solid #333;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
  background: #121212; /* 深黑 */
  color: #e0e0e0; /* 浅色文字 */
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
  background: #000;
}
.section-body::-webkit-scrollbar-thumb,
.command-input::-webkit-scrollbar-thumb {
  background-color: #0d0d0d;
  border-radius: 10px;
  border: 2px solid #000;
}
.section-body::-webkit-scrollbar-thumb:hover,
.command-input::-webkit-scrollbar-thumb:hover {
  background-color: #1a1a1a;
}

.section-body,
.command-input {
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: #0d0d0d #000; /* thumb track */
}
</style>
