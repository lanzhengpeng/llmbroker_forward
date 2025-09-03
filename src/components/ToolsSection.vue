<template>
  <section class="tools-section">
    <h2>工具管理</h2>

    <ul class="tool-top-list">
      <li class="tool-top-item">
        <span @click.stop="showAdd = !showAdd"
          >{{ showAdd ? "▼" : "▶" }} 添加工具</span
        >
        <transition name="fade">
          <div v-if="showAdd" class="add-form">
            <div class="row">
              <label>工具 URL</label>
              <input
                v-model.trim="addUrl"
                placeholder="例如：http://127.0.0.1:8500"
              />
            </div>
            <div class="row">
              <label>OpenAPI JSON</label>
              <textarea
                v-model.trim="addOpenapi"
                placeholder="在此粘贴完整的 OpenAPI JSON 内容"
                rows="8"
                spellcheck="false"
              ></textarea>
            </div>
            <div class="actions">
              <button class="btn primary" @click.stop="confirmAdd">确定</button>
              <button class="btn" @click.stop="cancelAdd">取消</button>
            </div>
          </div>
        </transition>
      </li>

      <li class="tool-top-item">
        <span @click.stop="showDelete = !showDelete"
          >{{ showDelete ? "\u25bc" : "\u25b6" }} 删除工具</span
        >
        <transition name="fade">
          <div v-if="showDelete" class="delete-area">
            <div class="row">
              <label>工具名</label>
              <input
                v-model.trim="deleteName"
                placeholder="输入要删除的工具名"
              />
            </div>
            <div class="actions">
              <button class="btn primary" @click.stop="confirmDelete">
                删除
              </button>
              <button class="btn" @click.stop="cancelDelete">取消</button>
            </div>
            <div
              class="hint"
              style="margin-top: 8px; color: #9ca3af; font-size: 13px"
            >
              建议先点击“从数据库加载”将数据库中的工具加载到内存，再点击“获取工具列表”确认名称正确，然后再执行删除。
            </div>
          </div>
        </transition>
      </li>

      <li class="tool-top-item">
        <span @click.stop="showFetch = !showFetch"
          >{{ showFetch ? "▼" : "▶" }} 获取工具列表</span
        >
        <transition name="fade">
          <div v-if="showFetch" class="fetch-area">
            <div class="fetch-actions">
              <button class="btn" @click.stop="fetchTools">
                点击获取工具列表
              </button>
              <button
                class="btn"
                style="margin-left: 8px"
                @click.stop="loadFromDb"
              >
                从数据库加载
              </button>
              <button
                class="btn"
                style="margin-left: 8px"
                @click.stop="clearTools"
              >
                清空所有工具
              </button>
            </div>

            <!-- 工具列表区（现在嵌入到 li 中） -->
            <div class="section-body">
              <div class="tool-list" v-if="tools && tools.length">
                <div
                  v-for="(t, idx) in tools"
                  :key="t.name || idx"
                  class="tool-item"
                >
                  <div class="row">
                    <button class="expander" @click.stop="toggleExpand(idx)">
                      <span class="chevron" :class="{ open: isExpanded(idx) }"
                        >▶</span
                      >
                      <span class="name" :class="{ passed: !!t.testResult }">{{
                        t.name || "-"
                      }}</span>
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
                        style="margin-left: 8px"
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
                    </div>
                  </div>
                  <transition name="fade">
                    <div v-if="isExpanded(idx)" class="details">
                      <div class="line">
                        <span class="k">描述：</span>
                        <span class="v">{{ t.description || "-" }}</span>
                      </div>
                      <div
                        class="line block"
                        v-if="t.parameters && Object.keys(t.parameters).length"
                      >
                        <span class="k">参数：</span>
                        <div class="params">
                          <div
                            v-for="(p, key) in t.parameters"
                            :key="key"
                            class="param-row"
                          >
                            <span class="param-key">{{ key }}</span>
                            <span class="param-type">{{ p?.type || "-" }}</span>
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
              <div v-else class="placeholder">
                暂无工具，点击“获取工具”或“添加工具”。
              </div>
            </div>
          </div>
        </transition>
      </li>
    </ul>

    <div class="divider"></div>

    <!-- 测试参数弹窗（Teleport 到 body，确保居中显示且不被裁剪） -->
    <teleport to="body">
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
      deleteName: "",
      // 测试弹窗
      showTestModal: false,
      testIndex: null,
      testToolName: "",
      testForm: {},
      testSchema: {},
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
      this.showAdd = false;
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
    confirmDelete() {
      if (!this.deleteName) {
        alert("请输入要删除的工具名");
        return;
      }
      // emit delete event with the tool name
      this.$emit("delete", { toolName: this.deleteName });
      // reset
      this.deleteName = "";
      this.showDelete = false;
    },
    cancelDelete() {
      this.deleteName = "";
      this.showDelete = false;
    },
  },
};
</script>

<style scoped>
.tools-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #1e1e1e;
  border: 1px solid #2a2a2a;
  border-radius: 10px;
  padding: 12px;
  color: #e0e0e0;
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
  background: #3a8bf6;
  color: #fff;
  border-color: #3a8bf6;
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
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 10px;
  background: #1b1b1b;
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
  /* 第一列为弹性列，避免 key 被压瘦；描述与默认列保留最小值 */
  grid-template-columns: minmax(120px, 1fr) 90px minmax(180px, 1.6fr) minmax(
      140px,
      320px
    );
  gap: 16px;
  align-items: center;
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
  min-width: 140px; /* 保护描述列不被挤得过窄 */
}
.param-default {
  color: #cbd5e1;
  text-align: right;
  white-space: nowrap; /* 保持单行以避免换行导致列高度过高 */
  overflow: hidden;
  text-overflow: ellipsis; /* 过长以省略号显示 */
  word-break: normal;
  writing-mode: horizontal-tb !important; /* 禁止竖排 */
  transform: none !important;
  align-self: center;
  padding-left: 8px; /* 给默认值左侧留点空隙 */
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

/* 顶部li标签样式 */
.tool-top-list {
  list-style: none;
  margin: 0 0 8px 0;
  padding: 0;
}
.tool-top-item {
  background: #23272f;
  color: #e0e0e0;
  border-radius: 8px;
  margin-bottom: 6px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: background 0.2s;
  position: relative;
}
.tool-top-item:hover {
  background: #2a2a2a;
}
.tool-top-item > span {
  display: flex;
  align-items: center;
  gap: 6px;
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
</style>
