<template>
  <section class="tools-section">
    <!-- Header: vertical nav buttons -->
    <div class="panel-headers">
      <button class="nav-btn" @click.stop="setActive('prompt')">
        <img
          src="/prompt.svg"
          alt="prompt"
          style="width: 16px; height: 16px; margin-right: 6px"
        />
        编辑提示词
      </button>
      <button class="nav-btn" @click.stop="setActive('view')">
        <img
          src="/src/assets/agent/库.svg"
          alt="库"
          style="width: 16px; height: 16px; margin-right: 6px"
        />
        查看工具列表
      </button>
      <button
        class="nav-btn"
        :class="{ active: activePanel === 'add' }"
        @click.stop="setActive('add')"
      >
        添加工具
      </button>
      <button class="nav-btn" @click.stop="fetchTools">获取工具列表</button>
      <button class="nav-btn" @click.stop="loadFromDb">从数据库加载</button>
      <button class="nav-btn" @click.stop="clearTools">清空所有</button>
    </div>

    <!-- Visible control panels: three columns (add / delete / fetch) -->
    <div class="control-panels" style="display: none">
      <!-- 原来的内联面板已被模态框替代 -->
    </div>

    <div class="section-body" style="display: none">
      <!-- 工具列表已移至模态框中显示 -->
    </div>

    <div class="divider"></div>

    <!-- 测试参数弹窗（Teleport 到 body，确保居中显示且不被裁剪） -->
    <teleport to="body">
      <!-- 添加工具模态框 -->
      <div v-if="showAddModal" class="modal-mask" @click.self="closeAddModal">
        <div class="modal">
          <h3>添加工具</h3>
          <div class="form-grid">
            <div class="form-row">
              <label>工具 URL</label>
              <input
                type="text"
                v-model.trim="addUrl"
                placeholder="例如：http://127.0.0.1:8500"
              />
            </div>
            <div class="form-row">
              <label>OpenAPI JSON</label>
              <textarea
                rows="8"
                v-model.trim="addOpenapi"
                placeholder="在此粘贴完整的 OpenAPI JSON 内容"
                spellcheck="false"
              ></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn" @click="closeAddModal">取消</button>
            <button class="btn primary" @click="confirmAdd">添加到内存</button>
          </div>
        </div>
      </div>

      <!-- 查看工具列表模态框 -->
      <div
        v-if="showFetchModal"
        class="modal-mask"
        @click.self="closeFetchModal"
      >
        <div class="modal" style="width: min(800px, 95vw); max-height: 85vh">
          <h3>工具列表</h3>
          <div class="form-grid">
            <!-- 工具列表显示区域 -->
            <div class="modal-tool-list" v-if="tools && tools.length">
              <h4 style="margin: 16px 0 8px 0; color: #333333">
                当前工具（{{ tools.length }} 个）
              </h4>
              <div
                class="tool-list-container"
                style="max-height: 400px; overflow-y: auto"
              >
                <div
                  v-for="(t, idx) in tools"
                  :key="t.name || idx"
                  class="modal-tool-item simple-mode"
                >
                  <!-- 简化显示：只显示工具名称 -->
                  <div class="tool-simple-display">
                    <span
                      class="tool-name"
                      :class="{ passed: !!t.testResult }"
                      >{{ t.name || "-" }}</span
                    >
                    <span class="tool-status" v-if="t.testResult">✓</span>
                  </div>

                  <!-- 详细显示：悬停时显示 -->
                  <div class="tool-detailed-display">
                    <div class="tool-header">
                      <button class="expander" @click.stop="toggleExpand(idx)">
                        <span class="chevron" :class="{ open: isExpanded(idx) }"
                          >▶</span
                        >
                        <span
                          class="name"
                          :class="{ passed: !!t.testResult }"
                          >{{ t.name || "-" }}</span
                        >
                      </button>
                      <div class="ops">
                        <button
                          class="btn"
                          :class="{ success: !!t.testResult }"
                          :disabled="t.testing"
                          @click.stop="openTestModal(idx, t)"
                        >
                          {{
                            t.testResult
                              ? "测试通过"
                              : t.testing
                              ? "测试中…"
                              : "测试"
                          }}
                        </button>
                        <button
                          class="btn"
                          :disabled="!t.testResult || t.saving"
                          @click.stop="saveTool(idx, t.name)"
                        >
                          {{
                            t.saved
                              ? "已保存"
                              : t.saving
                              ? "保存中…"
                              : "保存到 DB"
                          }}
                        </button>
                        <button
                          class="btn danger"
                          @click.stop="deleteToolDirect(t.name)"
                          title="删除工具"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <transition name="expand">
                      <div v-if="isExpanded(idx)" class="details">
                        <div class="line">
                          <span class="k">描述：</span>
                          <span class="v">{{ t.description || "-" }}</span>
                        </div>
                        <div
                          class="line block"
                          v-if="
                            t.parameters && Object.keys(t.parameters).length
                          "
                        >
                          <span class="k">参数：</span>
                          <div class="params">
                            <div
                              v-for="(p, key) in t.parameters"
                              :key="key"
                              class="param-row"
                            >
                              <span class="param-key">{{ key }}</span>
                              <span class="param-type">{{
                                p?.type || "-"
                              }}</span>
                              <span class="param-desc">{{
                                p?.description || "-"
                              }}</span>
                              <span class="param-default"
                                >默认：{{ p?.default ?? "-" }}</span
                              >
                            </div>
                          </div>
                        </div>
                        <div class="test-state" v-if="t.testing">正在测试…</div>
                        <div class="test-result" v-else-if="t.testResult">
                          <pre>{{ prettyJson(t.testResult) }}</pre>
                        </div>
                      </div>
                    </transition>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-else
              class="placeholder"
              style="margin: 16px 0; text-align: center"
            >
              暂无工具，请使用上方按钮获取或添加工具。
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn" @click="closeFetchModal">关闭</button>
          </div>
        </div>
      </div>

      <!-- 测试工具模态框 -->
      <div v-if="showTestModal" class="modal-mask" @click.self="closeTestModal">
        <div class="modal">
          <h3>测试工具：{{ testToolName || "-" }}</h3>
          <div v-if="testParamKeys.length" class="form-grid">
            <div v-for="key in testParamKeys" :key="key" class="form-row">
              <label>{{ key }}</label>
              <input
                v-if="fieldType(key) === 'number'"
                type="number"
                v-model.number="testForm[key]"
              />
              <select
                v-else-if="fieldType(key) === 'boolean'"
                v-model="testForm[key]"
              >
                <option :value="true">true</option>
                <option :value="false">false</option>
              </select>
              <textarea
                v-else-if="fieldType(key) === 'longtext'"
                rows="4"
                v-model.trim="testForm[key]"
                spellcheck="false"
              ></textarea>
              <input v-else type="text" v-model.trim="testForm[key]" />
              <small class="hint">{{ paramDesc(key) }}</small>
            </div>
          </div>
          <div v-else class="placeholder small">
            该工具未声明参数，将直接发起测试。
          </div>
          <div class="modal-actions">
            <button class="btn" @click="closeTestModal">取消</button>
            <button class="btn primary" @click="confirmRunTest">
              开始测试
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 提示词编辑模态框 -->
    <teleport v-if="showPromptModal" to="body">
      <div class="modal-mask" @click.self="closePromptModal">
        <div class="modal prompt-modal">
          <div class="modal-header">
            <h3>编辑提示词</h3>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>系统提示词：</label>
              <textarea
                v-model="promptText"
                class="prompt-textarea"
                placeholder="请输入系统提示词，用于指导AI的行为和回答风格..."
                rows="10"
              ></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn" @click="closePromptModal">取消</button>
            <button class="btn primary" @click="savePrompt">保存</button>
          </div>
        </div>
      </div>
    </teleport>
  </section>
</template>

<script>
export default {
  name: "ToolsSection",
  props: { tools: { type: Array, default: () => [] } },
  computed: {
    testParamKeys() {
      return Object.keys(this.testSchema || {});
    },
  },
  data() {
    return {
      showAdd: false,
      showFetch: false,
      addUrl: "",
      addOpenapi: "",
      expandedIndex: null,
      showDelete: false,
      activePanel: null,
      // 模态框状态
      showAddModal: false,
      showFetchModal: false,
      showPromptModal: false,
      // 测试弹窗
      showTestModal: false,
      testIndex: null,
      testToolName: "",
      testForm: {},
      testSchema: {},
      // 提示词编辑
      promptText: "",
    };
  },
  methods: {
    prettyJson(obj) {
      try {
        const s = JSON.stringify(obj, null, 2);
        return s.length > 600 ? s.slice(0, 600) + "\n…(已截断)" : s;
      } catch {
        return String(obj ?? "");
      }
    },
    isExpanded(idx) {
      return this.expandedIndex === idx;
    },
    toggleExpand(idx) {
      this.expandedIndex = this.expandedIndex === idx ? null : idx;
    },
    setActive(name) {
      // 改为打开对应的模态框
      if (name === "add") {
        this.showAddModal = true;
      } else if (name === "view") {
        this.showFetchModal = true;
      } else if (name === "prompt") {
        this.showPromptModal = true;
      }
    },
    openToolPage(index, tool) {
      const name = tool?.name || "";
      try {
        const path = `/tool/${encodeURIComponent(name)}`;
        this.$router.push(path);
      } catch (e) {
        console.error("导航失败", e);
      }
    },
    openTestModal(idx, tool) {
      this.testIndex = idx;
      this.testToolName = tool?.name || "";
      this.testSchema = tool?.parameters || {};
      const form = {};
      for (const key of Object.keys(this.testSchema)) {
        const p = this.testSchema[key] || {};
        const def = p.default;
        if (def !== undefined) form[key] = def;
        else if ((p.type || "").toLowerCase() === "boolean") form[key] = false;
        else if (["integer", "number"].includes((p.type || "").toLowerCase()))
          form[key] = 0;
        else form[key] = "";
      }
      this.testForm = form;
      this.showTestModal = true;
    },
    closeTestModal() {
      this.showTestModal = false;
      this.testIndex = null;
      this.testToolName = "";
      this.testForm = {};
      this.testSchema = {};
    },
    fieldType(key) {
      const t = (this.testSchema?.[key]?.type || "").toLowerCase();
      if (t === "integer" || t === "number") return "number";
      if (t === "boolean") return "boolean";
      if (
        t === "string" &&
        ((this.testSchema?.[key]?.format || "").toLowerCase() === "textarea" ||
          (this.testSchema?.[key]?.description || "").length > 60)
      )
        return "longtext";
      return "text";
    },
    paramDesc(key) {
      const p = this.testSchema?.[key] || {};
      const typ = p.type ? `(${p.type})` : "";
      const d = p.description || "";
      return [typ, d].filter(Boolean).join(" ");
    },
    confirmRunTest() {
      const payload = {
        index: this.testIndex,
        toolName: this.testToolName,
        params: { ...this.testForm },
      };
      this.$emit("test", payload);
      this.closeTestModal();
    },
    confirmAdd() {
      if (!this.addUrl || !this.addOpenapi) return;
      this.$emit("add", { url: this.addUrl, openapi: this.addOpenapi });
      this.addUrl = "";
      this.addOpenapi = "";
      this.showAddModal = false;
    },
    closeAddModal() {
      this.addUrl = "";
      this.addOpenapi = "";
      this.showAddModal = false;
    },
    cancelAdd() {
      this.addUrl = "";
      this.addOpenapi = "";
      this.showAdd = false;
    },
    fetchTools() {
      this.$emit("fetch");
    },
    clearTools() {
      this.$emit("clear");
    },
    saveTool(index, toolName) {
      this.$emit("save", { index, toolName });
    },
    loadFromDb() {
      this.$emit("load");
    },
    deleteToolDirect(toolName) {
      if (!toolName) {
        alert("工具名不能为空");
        return;
      }
      if (confirm(`确定要删除工具 "${toolName}" 吗？`)) {
        // emit delete event with the tool name
        this.$emit("delete", { toolName });
      }
    },
    closeFetchModal() {
      this.showFetchModal = false;
    },
    closePromptModal() {
      this.showPromptModal = false;
    },
    savePrompt() {
      // 保存提示词逻辑
      localStorage.setItem("agent_prompt", this.promptText);
      alert("提示词已保存");
      this.showPromptModal = false;
    },
    cancelDelete() {
      this.deleteName = "";
      this.showDelete = false;
    },
  },
  mounted() {
    // 加载保存的提示词
    const savedPrompt = localStorage.getItem("agent_prompt");
    if (savedPrompt) {
      this.promptText = savedPrompt;
    }
  },
};
</script>

<style scoped>
.tools-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: transparent; /* 去掉卡片背景 */
  border: none;
  border-radius: 0;
  padding: 6px 4px; /* 更紧凑 */
  color: #333333;
  flex: 1 1 auto;
  min-height: 0;
  max-height: 100%;
  overflow: hidden; /* 外层不滚动，由内部 section-body 滚动 */
}

/* 添加工具入口区和工具列表分隔样式 */
.add-tool-area {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.top-nav .nav-left {
  display: flex;
  gap: 12px;
  align-items: center;
  /* content-sized buttons like the screenshot */
}
.top-nav .nav-right {
  flex: 0 0 auto;
}
.nav-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #333333;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start; /* 靠左对齐 */
  width: 100%; /* 占满整行 */
  box-sizing: border-box;
  font-size: 14px;
  text-align: left;
  transition: background 0.2s, color 0.2s;
}
.nav-btn:hover {
  background: #f5f5f5;
  color: #666666;
}
.nav-btn.active {
  background: transparent;
  color: #000000;
  border: none;
  font-weight: 500;
}

.control-panels {
  display: flex;
  gap: 12px;
  margin-top: 10px;
  width: 100%;
  flex-wrap: wrap; /* 允许换行，防止内容溢出 */
  align-items: flex-start;
}

.panel-headers {
  display: flex;
  flex-direction: column; /* 改为竖直排列 */
  gap: 4px; /* minimal spacing */
  align-items: flex-start; /* 左对齐 */
  margin-bottom: 8px;
}
.control-panels .panel {
  /* 取消卡片化外观，让面板直接显示 */
  background: transparent;
  border: none;
  padding: 6px 0;
  border-radius: 0;
  box-sizing: border-box;
  /* 等分，但允许基准宽度并防止内容撑破父容器 */
  flex: 1 1 220px;
  min-width: 0;
}
.control-panels .panel .row {
  display: flex;
  flex-direction: column; /* 竖着排列 */
  align-items: center;
}
.control-panels .panel.add-panel .row {
  /* 更高优先级覆盖：确保添加工具面板内的标签与输入靠左 */
  align-items: flex-start;
  text-align: left;
}
.control-panels .panel .row .nav-btn {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  border: none;
  color: #333333;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 400;
  flex: 1 1 auto; /* 占满可用空间 */
  text-align: left;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start; /* 靠左对齐 */
  transition: background 0.2s, color 0.12s;
}
.control-panels .panel .row .nav-btn:hover {
  background: #f5f5f5;
  color: #666666;
}
.control-panels .panel .row .nav-btn.active {
  background: transparent;
  color: #000000;
  padding: 4px 0;
  border-radius: 0;
  box-shadow: none;
  font-weight: 500;
}

.fetch-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start; /* 左对齐按钮 */
}
.fetch-actions .btn {
  min-width: 120px;
}

/* 让 fetch-panel 的按钮紧贴 control-panels 的左侧和上侧边缘 */
.control-panels .panel.fetch-panel {
  padding: 0; /* 移除所有内边距 */
}
.control-panels .panel.fetch-panel .panel-body {
  padding: 0;
  margin: 0;
}
.fetch-actions {
  margin: 0;
  padding: 0; /* 移除所有内边距包括顶部 */
}

.add-panel label,
.delete-panel label {
  display: block;
  color: #9ca3af;
  font-weight: 600;
}

/* 使添加工具面板内容靠左显示，并将输入框背景调为黑色 */
.add-panel .row {
  align-items: flex-start; /* 左对齐交叉轴 */
  text-align: left;
}
.add-panel input,
.add-panel textarea,
.add-panel .panel-textarea {
  background: #000; /* 纯黑背景 */
  color: #e0e0e0;
  border: 1px solid #2a2a2a;
}
.add-panel input::placeholder,
.add-panel textarea::placeholder {
  color: #666;
}

/* 删除工具面板同理：左对齐标签/输入并设置输入背景为黑色 */
.control-panels .panel.delete-panel .row,
.delete-panel .row {
  align-items: flex-start;
  text-align: left;
}
.delete-panel input,
.delete-panel textarea {
  background: #000;
  color: #e0e0e0;
  border: 1px solid #2a2a2a;
}
.delete-panel input::placeholder,
.delete-panel textarea::placeholder {
  color: #666;
}

.add-tool-toggle {
  font-weight: 600;
}
.divider {
  height: 1px;
  background: #222;
  margin: 8px 0 12px 0;
  border-radius: 2px;
}
.btn {
  border: 1px solid #2a2a2a;
  background: #2a2a2a;
  color: #e0e0e0;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.btn.success {
  background: #065f46;
  border-color: #065f46;
  color: #eafff6;
}
.btn.primary {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}
.btn.danger {
  background: #dc3545;
  color: #ffffff;
  border-color: #dc3545;
}
.btn.danger:hover {
  background: #c82333;
  border-color: #bd2130;
}
.btn:hover {
  background: #343434;
  border-color: #3a3a3a;
}

.add-form {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
}
.add-form .row {
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: center;
  gap: 8px;
}
.add-form input,
.add-form textarea {
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 8px 10px;
  outline: none;
  background: #121212;
  color: #e0e0e0;
}
.add-form textarea {
  resize: vertical;
  max-height: 30vh;
  overflow: auto;
}
.add-form input:focus,
.add-form textarea:focus,
.form-row input:focus,
.form-row select:focus,
.form-row textarea:focus {
  outline: none;
  border-color: inherit;
  box-shadow: none;
}
.add-form input::placeholder,
.add-form textarea::placeholder {
  color: #888;
}

/* 列表滚动容器 */
.section-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 100%;
}

/* 给滚动容器留出右侧空间，避免系统滚动条覆盖内容 */
.fetch-area .section-body,
.section-body {
  padding-right: 12px;
  box-sizing: border-box;
}
.section-body::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.section-body::-webkit-scrollbar-track {
  background: #000;
}
.section-body::-webkit-scrollbar-thumb {
  background-color: #0d0d0d;
  border-radius: 10px;
  border: 2px solid #000;
}
.section-body::-webkit-scrollbar-thumb:hover {
  background-color: #1a1a1a;
}
.section-body {
  scrollbar-width: thin;
  scrollbar-color: #0d0d0d #000;
}

.tool-list {
  display: grid;
  gap: 8px;
  width: 100%;
}
.tool-item {
  display: block;
  border: none; /* 去掉卡片边框 */
  border-radius: 0;
  padding: 6px 0; /* 更紧凑的条目间距 */
  background: transparent;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden; /* 防止内部内容被推到外面 */
}
.tool-item .row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.expander {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: #e5e7eb;
  cursor: pointer;
  padding: 2px 6px; /* 略微减小横向内边距 */
  /* 允许在 flex 行内伸缩，避免把右侧按钮挤到容器外 */
  flex: 1 1 auto;
  min-width: 0;
}
.chevron {
  display: inline-block;
  transition: transform 0.15s ease;
}
.chevron.open {
  transform: rotate(90deg);
}
.name {
  font-weight: 600;
  color: #fff;
  font-size: 14px; /* 缩小名称字体 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tool-item {
  font-size: 13px; /* 整体条目字体更紧凑 */
  padding: 12px; /* 增加内边距，留出空间 */
}
.tool-top-item {
  overflow: visible; /* 保证 li 内的展开内容和按钮不会被裁剪 */
  font-size: 14px; /* 顶部 li 字体稍小 */
}
.tool-item .ops {
  display: flex;
  gap: 6px;
  align-items: center;
  flex: 0 0 auto;
  margin-left: 8px; /* 确保与左侧名称分离并固定在右侧 */
}
.tool-item .ops .btn {
  padding: 6px 8px;
  font-size: 13px;
  color: var(--btn-text-light);
}
.tool-top-item {
  overflow: visible; /* 保证 li 内的展开内容和按钮不会被裁剪 */
}
.name.passed {
  color: #10b981;
}
.details {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #2a2a2a;
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 100%;
  overflow: hidden; /* 防止内容溢出 */
  box-sizing: border-box;
}
.details .line {
  margin-bottom: 8px;
}
.details .line .k {
  display: inline-block;
  min-width: 72px;
  color: #9ca3af;
  font-weight: 600;
}
.details .line .v {
  color: #d1d5db;
  line-height: 1.6;
}
.tool-item .meta {
  font-size: 13px;
  color: #d1d5db;
}
.tool-item .meta .line {
  margin: 2px 0;
}
.tool-item .meta .k {
  color: #9ca3af;
}
.tool-item .meta .block {
  margin-top: 6px;
}
.params {
  display: grid;
  gap: 8px;
  margin-top: 6px;
}
.param-row {
  display: grid;
  /* 在模态框中使用更紧凑的布局，避免超出容器 */
  grid-template-columns:
    minmax(80px, 1fr) minmax(60px, 0.8fr) minmax(100px, 2fr)
    minmax(80px, 1fr);
  gap: 8px; /* 减小间距 */
  align-items: start; /* 顶部对齐，便于多行文本 */
  max-width: 100%;
  overflow: hidden;
}
.param-key {
  color: #e5e7eb;
  font-weight: 700;
  display: block;
  min-width: 0; /* 允许在 grid 中收缩 */
  max-width: 100%;
  /* 允许换行以防止被压瘦，同时在必要时换行显示 */
  white-space: normal;
  overflow: visible;
  word-break: break-word;
}
.param-type {
  color: #60a5fa;
  font-size: 13px;
}
.param-desc {
  color: #d1d5db;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: normal; /* 允许正常换行 */
  min-width: 0; /* 允许收缩 */
  font-size: 13px; /* 稍小字体节省空间 */
}
.param-default {
  color: #cbd5e1;
  text-align: left; /* 改为左对齐 */
  white-space: normal; /* 允许换行 */
  overflow: visible;
  word-break: break-word; /* 允许断行 */
  font-size: 12px; /* 小字体 */
  min-width: 0; /* 允许收缩 */
}

.test-result pre {
  max-height: 30vh;
  overflow: auto;
  background: #0f0f0f;
  color: #e5e7eb;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #2a2a2a;
}
.placeholder {
  color: #9ca3af;
  font-size: 14px;
  line-height: 1.6;
}
.tool-item .meta .v {
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* 测试弹窗样式 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  width: min(680px, 92vw);
  max-height: 80vh;
  overflow: auto;
  background: #1e1e1e;
  border: 1px solid #2a2a2a;
  border-radius: 10px;
  padding: 16px;
  color: #e5e7eb;
}
/* 模态框滚动条样式 */
.modal::-webkit-scrollbar {
  width: 10px;
}
.modal::-webkit-scrollbar-track {
  background: #000;
  border-radius: 5px;
}
.modal::-webkit-scrollbar-thumb {
  background-color: #222;
  border-radius: 5px;
}
.modal::-webkit-scrollbar-thumb:hover {
  background-color: #333;
}
.form-grid {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.form-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: start;
  gap: 10px;
}
.form-row label {
  color: #9ca3af;
}
.form-row input,
.form-row select,
.form-row textarea {
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 8px 10px;
  outline: none;
  background: #121212;
  color: #e0e0e0;
}
.form-row textarea {
  resize: vertical;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

/* 模态框中的工具列表样式 */
.modal-tool-item {
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.02);
}
.modal-tool-item .tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 12px;
}
.modal-tool-item .expander {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: #e5e7eb;
  cursor: pointer;
  padding: 2px 6px;
  flex: 1 1 auto;
  min-width: 0;
}
.modal-tool-item .ops {
  display: flex;
  gap: 6px;
  align-items: center;
  flex: 0 0 auto;
}
.modal-tool-item .ops .btn {
  padding: 4px 8px;
  font-size: 12px;
}
.tool-list-container {
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
}
.tool-list-container::-webkit-scrollbar {
  width: 8px;
}
.tool-list-container::-webkit-scrollbar-track {
  background: #000; /* 黑色轨道 */
  border-radius: 4px;
}
.tool-list-container::-webkit-scrollbar-thumb {
  background-color: #222; /* 深灰色滑块 */
  border-radius: 4px;
}
.tool-list-container::-webkit-scrollbar-thumb:hover {
  background-color: #333; /* 悬停时稍亮 */
}

/* 顶部li标签样式 */
.tool-top-list {
  display: none;
}
.add-form,
.fetch-area {
  margin-top: 10px;
}

/* 展开后的 fetch-area 内部允许滚动，不会撑开外层布局 */
.fetch-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fetch-area .section-body {
  /* 限制高度为视口的一部分，便于在 li 内滚动 */
  max-height: 45vh;
  min-height: 0;
  overflow-y: auto;
}

/* 确保 li 本身包含展开内容，不让内部元素浮出 */
.tool-top-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.fetch-area {
  width: 100%;
  box-sizing: border-box;
}
.fetch-area .section-body {
  width: 100%;
  box-sizing: border-box;
}

/* 保证每一行内的元素在狭窄容器下不会突破布局 */
.tool-item .row {
  min-width: 0;
  width: 100%;
}
.tool-item .row > * {
  min-width: 0;
}
.tool-item .ops {
  flex-shrink: 0;
}

/* 简化模式样式 */
.modal-tool-item.simple-mode {
  position: relative;
  background: transparent;
  border: none;
  margin-bottom: 4px;
  padding: 0;
  border-radius: 4px;
  transition: all 0.3s ease;
}

/* 简化显示：默认状态 */
.modal-tool-item.simple-mode .tool-simple-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.modal-tool-item.simple-mode .tool-name {
  font-size: 14px;
  color: #333333;
  font-weight: 500;
}

.modal-tool-item.simple-mode .tool-name.passed {
  color: #0f7b0f;
}

.modal-tool-item.simple-mode .tool-status {
  color: #0f7b0f;
  font-weight: bold;
  font-size: 16px;
}

/* 详细显示：默认隐藏 */
.modal-tool-item.simple-mode .tool-detailed-display {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: #ffffff;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-2px);
  transition: all 0.3s ease;
}

/* 悬停时显示详细信息 */
.modal-tool-item.simple-mode:hover .tool-simple-display {
  opacity: 0;
  transform: translateY(2px);
}

.modal-tool-item.simple-mode:hover .tool-detailed-display {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

/* 详细显示中的样式调整 */
.modal-tool-item.simple-mode .tool-detailed-display .tool-header {
  background: rgba(42, 42, 42, 0.02);
  border-bottom: 1px solid #f0f0f0;
}

.modal-tool-item.simple-mode .tool-detailed-display .expander {
  color: #333333;
}

.modal-tool-item.simple-mode .tool-detailed-display .name.passed {
  color: #0f7b0f;
}

.modal-tool-item.simple-mode .tool-detailed-display .details {
  background: #ffffff;
}

/* 提示词模态框样式 */
.prompt-modal {
  width: 90%;
  max-width: 600px;
}

.prompt-textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.prompt-textarea:focus {
  outline: none;
  border-color: #4a9eff;
  box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333333;
}
</style>
