<template>
  <div ref="container" class="split-container" @mouseleave="onMouseUp">
    <!-- 上方：提示词编排 -->
    <div class="pane top" :style="{ height: topHeightPx + 'px' }">
      <PromptSection v-model="innerPrompt" />
    </div>

    <!-- 中间：拖拽条 -->
    <div
      class="divider"
      :class="{ dragging }"
      @mousedown="onMouseDown"
      :title="'拖拽调整高度'"
    ></div>

    <!-- 下方：工具管理 -->
    <div class="pane bottom">
      <ToolsSection
        :tools="tools"
        @add="$emit('add', $event)"
        @fetch="$emit('fetch')"
        @test="$emit('test', $event)"
      />
    </div>
  </div>
</template>

<script>
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import PromptSection from "./PromptSection.vue";
import ToolsSection from "./ToolsSection.vue";

export default {
  name: "LeftSplitPanel",
  components: { PromptSection, ToolsSection },
  props: {
    modelValue: { type: String, default: "" },
    tools: { type: Array, default: () => [] },
    // 可选：初始上部高度百分比（0-1），默认 0.6
    initialRatio: { type: Number, default: 0.6 },
    minHeight: { type: Number, default: 50 },
    dividerSize: { type: Number, default: 6 },
  },
  emits: ["update:modelValue", "add", "fetch", "test"],
  setup(props, { emit }) {
    const container = ref(null);
    const dragging = ref(false);
    const containerTop = ref(0);
    const containerHeight = ref(0);
    const innerHeight = ref(0);
    const paddingTop = ref(0);
    const paddingBottom = ref(0);
    const topHeightPx = ref(0);

    const innerPrompt = ref(props.modelValue);
    watch(
      () => props.modelValue,
      (v) => {
        if (v !== innerPrompt.value) innerPrompt.value = v;
      }
    );
    watch(innerPrompt, (v) => emit("update:modelValue", v));

    const recalcBounds = () => {
      if (!container.value) return;
      const rect = container.value.getBoundingClientRect();
      containerTop.value = rect.top + window.scrollY;
      // 使用 clientHeight 与布局一致，避免边框/滚动条干扰
      containerHeight.value = container.value.clientHeight;
      const styles = getComputedStyle(container.value);
      paddingTop.value = parseFloat(styles.paddingTop) || 0;
      paddingBottom.value = parseFloat(styles.paddingBottom) || 0;
      innerHeight.value = Math.max(
        0,
        containerHeight.value - paddingTop.value - paddingBottom.value
      );
      // 初始化时根据比例设置上部高度
      if (!dragging.value && topHeightPx.value === 0) {
        const initTop = Math.round(innerHeight.value * props.initialRatio);
        const maxTop = Math.max(
          props.minHeight,
          innerHeight.value - props.minHeight - props.dividerSize
        );
        topHeightPx.value = Math.max(
          props.minHeight,
          Math.min(maxTop, initTop)
        );
      } else {
        // 调整到有效范围
        topHeightPx.value = clamp(topHeightPx.value);
      }
    };

    const clamp = (h) => {
      const maxTop = Math.max(
        props.minHeight,
        innerHeight.value - props.minHeight - props.dividerSize
      );
      const minTop = props.minHeight;
      return Math.max(minTop, Math.min(maxTop, h));
    };

    const onMouseDown = (e) => {
      e.preventDefault();
      dragging.value = true;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!dragging.value) return;
      if (!container.value) return;
      // 计算相对容器顶部的高度
      const rect = container.value.getBoundingClientRect();
      const y = e.clientY - rect.top - paddingTop.value; // 减去内边距，避免偏移
      topHeightPx.value = clamp(y);
    };

    const onMouseUp = () => {
      if (!dragging.value) return;
      dragging.value = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    const onResize = () => recalcBounds();

    onMounted(() => {
      recalcBounds();
      window.addEventListener("resize", onResize);
      // 微任务后再次测量，避免初次渲染尺寸不准
      requestAnimationFrame(recalcBounds);
      setTimeout(recalcBounds, 0);
    });
    onBeforeUnmount(() => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    });
    return {
      container,
      dragging,
      topHeightPx,
      innerPrompt,
      onMouseDown,
      onMouseUp,
    };
  },
};
</script>

<style scoped>
.split-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px; /* 内边距 */
  box-sizing: border-box; /* 关键：包含 padding，避免撑高父容器 */
}

.pane {
  min-height: 50px;
  display: flex;
  flex-direction: column;
}

.pane.bottom {
  flex: 1 1 auto;
  min-height: 0; /* 占满剩余空间并允许内部滚动 */
  overflow: hidden; /* 将滚动交给子组件内部 */
}

/* 让子组件（PromptSection、ToolsSection）充满 pane 可用空间 */
.pane > * {
  flex: 1 1 auto;
  min-height: 0;
}

.divider {
  height: 6px;
  cursor: row-resize;
  background: #2a2a2a; /* 深色分割条 */
  border-top: 1px solid #2a2a2a;
  border-bottom: 1px solid #2a2a2a;
}
.divider.dragging {
  background: #3a3a3a;
}

/* 内部卡片由子组件控制（白底、圆角、边框） */
</style>