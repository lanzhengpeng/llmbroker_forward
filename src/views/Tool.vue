<template>
  <section class="tool-page">
    <h2>工具: {{ decodedName }}</h2>
    <div v-if="tool">
      <p><strong>描述：</strong> {{ tool.description || '-' }}</p>
      <div v-if="tool.parameters && Object.keys(tool.parameters).length">
        <h3>参数</h3>
        <ul>
          <li v-for="(p, key) in tool.parameters" :key="key">
            <strong>{{ key }}</strong> — <em>{{ p.type || '-' }}</em>
            <div>{{ p.description || '-' }}</div>
          </li>
        </ul>
      </div>
    </div>
    <div v-else>
      <p>未找到该工具的本地信息。请从工具列表返回或先获取工具列表。</p>
    </div>
  </section>
</template>

<script>
export default {
  name: 'ToolView',
  props: ['name'],
  data() {
    return {
      tool: null,
    };
  },
  computed: {
    decodedName() {
      try {
        return decodeURIComponent(this.name || '')
      } catch {
        return this.name || ''
      }
    }
  },
  created() {
    // Try to get tool info from parent or global state (props or window)
    // Under-specification: repository doesn't show a global store; assume parent passes `tools` via $root or the list is on window.__TOOLS__
    const allTools = (this.$root && this.$root.$data && this.$root.$data.tools) || window.__TOOLS__ || [];
    this.tool = allTools.find(t => (t.name || '') === this.decodedName) || null;
  }
}
</script>

<style scoped>
.tool-page {
  padding: 16px;
  color: #e5e7eb;
}
</style>
