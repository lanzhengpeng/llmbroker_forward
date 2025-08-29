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
  </section>
</template>

<script>
export default {
  name: "PromptSection",
  props: {
    modelValue: { type: String, default: "" },
  },
};
</script>

<style scoped>
.prompt-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #1e1e1e; /* 深灰/黑 */
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 12px;
  min-height: 140px;
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
.command-input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.25);
  background: #0f0f0f;
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
