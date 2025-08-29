<template>
  <section class="tools-section">
    <h2>工具管理</h2>

    <!-- 顶部操作按钮 -->
    <div class="actions top">
      <button class="btn" @click="showAdd = true">添加工具</button>
      <button class="btn" @click="$emit('fetch')">获取工具</button>
    </div>

    <!-- 添加工具表单 -->
    <div v-if="showAdd" class="add-form">
      <div class="row">
        <label>Base URL</label>
        <input
          v-model.trim="addUrl"
          placeholder="例如：http://8.218.206.87:8500"
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
        <button class="btn primary" @click="confirmAdd">确定</button>
        <button class="btn" @click="cancelAdd">取消</button>
      </div>
    </div>

    <!-- 列表滚动容器（只在内部滚动） -->
    <div class="section-body">
      <div class="tool-list" v-if="tools && tools.length">
        <div v-for="(t, idx) in tools" :key="t.name || idx" class="tool-item">
          <div class="row">
            <button class="expander" @click.stop="toggleExpand(idx)">
              <span class="chevron" :class="{ open: isExpanded(idx) }">▶</span>
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
                {{ t.testResult ? "测试通过" : t.testing ? "测试中…" : "测试" }}
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
                    <span class="param-desc">{{ p?.description || "-" }}</span>
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
  </section>

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
          <button class="btn primary" @click="confirmRunTest">开始测试</button>
        </div>
      </div>
    </div>
  </teleport>
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
      addUrl: "",
      addOpenapi: "",
      expandedIndex: null,
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

.actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}
.actions.top {
  margin-bottom: 8px;
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
  background: #7c3aed;
  color: #fff;
  border-color: #7c3aed;
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
.add-form textarea:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
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
}
.tool-item {
  display: block;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 10px;
  background: #1b1b1b;
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
  gap: 8px;
  background: transparent;
  border: none;
  color: #e5e7eb;
  cursor: pointer;
  padding: 2px 4px;
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
  gap: 6px;
  margin-top: 6px;
}
.param-row {
  display: grid;
  grid-template-columns: 160px 100px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}
.param-key {
  color: #e5e7eb;
  font-weight: 600;
}
.param-type {
  color: #93c5fd;
}
.param-desc {
  color: #d1d5db;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.param-default {
  color: #cbd5e1;
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
</style>
