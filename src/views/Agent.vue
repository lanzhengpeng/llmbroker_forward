<template>
  <div class="agent-page">
    <!-- 顶部 Banner -->
    <AuthBanner :user="user" @toggle-auth="onToggleAuth" @go-home="goHome" />

    <!-- 登录/注册面板 -->
    <transition name="fade-slide">
      <AuthPanel
        v-if="showAuth"
        :error="authError"
        :user="user"
        @close="closeAuth"
        @login="onLogin"
        @register="onRegister"
        @logout="logout"
      />
    </transition>

    <!-- 主体布局：左右分栏，左侧上下分栏 -->
    <div class="agent-layout">
      <section class="left-panel">
        <LeftSplitPanel
          v-model="promptText"
          :tools="tools"
          @add="onAddTool"
          @fetch="onFetchTools"
          @test="onTestTool"
        />
      </section>

      <section class="right-panel">
        <ChatSection :messages="messages" @send="onSendMessage" />
      </section>
    </div>
  </div>
</template>

<script>
import {
  login as apiLogin,
  getToken,
  clearToken,
  agentRequest,
} from "../api/client.js";
import AuthBanner from "../components/AuthBanner.vue";
import AuthPanel from "../components/AuthPanel.vue";
import LeftSplitPanel from "../components/LeftSplitPanel.vue";
import ChatSection from "../components/ChatSection.vue";

export default {
  name: "Agent",
  components: {
    AuthBanner,
    AuthPanel,
    LeftSplitPanel,
    ChatSection,
  },
  data() {
    return {
      // 认证
      user: null,
      showAuth: false,
      authError: "",
      // 业务数据
      promptText: "",
      tools: [],
      messages: [],
    };
  },
  mounted() {
    try {
      const raw = localStorage.getItem("agent_user");
      if (raw) this.user = JSON.parse(raw);
      const t = getToken();
      if (t && !this.user) this.user = { username: "已登录用户" };
    } catch {}
  },
  methods: {
    goHome() {
      this.$router.push("/");
    },
    onToggleAuth() {
      this.showAuth = !this.showAuth;
      this.authError = "";
    },
    closeAuth() {
      this.showAuth = false;
      this.authError = "";
    },
    async onLogin({ username, password }) {
      this.authError = "";
      if (!username || !password) {
        this.authError = "请输入用户名与密码。";
        return;
      }
      try {
        await apiLogin(username, password);
        this.user = { username };
        localStorage.setItem("agent_user", JSON.stringify(this.user));
        this.closeAuth();
      } catch (e) {
        this.authError = e?.message || "登录失败";
      }
    },
    async onRegister({ username, password, confirm }) {
      this.authError = "";
      if (!username || !password || !confirm) {
        this.authError = "请完整填写注册信息。";
        return;
      }
      if (password !== confirm) {
        this.authError = "两次输入的密码不一致。";
        return;
      }
      try {
        await apiLogin(username, password); // 暂用登录获取 token
        this.user = { username };
        localStorage.setItem("agent_user", JSON.stringify(this.user));
        this.closeAuth();
      } catch (e) {
        this.authError = e?.message || "注册失败";
      }
    },
    logout() {
      localStorage.removeItem("agent_user");
      this.user = null;
      this.showAuth = false;
      clearToken();
    },
    // 工具：添加
    async onAddTool({ url, openapi }) {
      try {
        if (!url || !openapi) {
          alert("请填写 Base URL 与 OpenAPI JSON");
          return;
        }
        let openapiJson;
        try {
          openapiJson = JSON.parse(openapi);
        } catch (e) {
          alert("OpenAPI JSON 解析失败，请粘贴有效的 JSON 文本。");
          return;
        }

        const res = await agentRequest("/agent/register_tools", {
          method: "POST",
          body: { base_url: url, openapi_json: openapiJson },
        });
        const msg = (res && (res.message || res.detail)) || "工具注册完成";
        alert(msg);
      } catch (e) {
        console.error("添加工具失败:", e);
        // 简单提示
        alert(e?.message || "添加工具失败");
      }
    },
    // 工具：获取列表
    async onFetchTools() {
      try {
        const resp = await agentRequest("/tool/list", { method: "GET" });
        const arr = Array.isArray(resp)
          ? resp
          : Array.isArray(resp?.tools)
          ? resp.tools
          : [];
        this.tools = arr.map((t) => ({
          ...t,
          testing: false,
          testResult: undefined,
        }));
      } catch (e) {
        console.error("获取工具失败:", e);
        alert(e?.message || "获取工具失败");
      }
    },
    // 工具：单独测试
    async onTestTool(payload) {
      // payload: { index, toolName, params }
      const { index, toolName, params } = payload || {};
      if (index == null || !this.tools[index]) return;
      // 标记测试中
      this.tools = this.tools.map((t, i) =>
        i === index ? { ...t, testing: true, testResult: undefined } : t
      );
      try {
        const body = {
          tool_id: toolName,
          test_params: params || {},
        };
        const res = await agentRequest("/tool/test", {
          method: "POST",
          body,
        });
        this.tools = this.tools.map((t, i) =>
          i === index ? { ...t, testing: false, testResult: res } : t
        );
      } catch (e) {
        this.tools = this.tools.map((t, i) =>
          i === index
            ? {
                ...t,
                testing: false,
                testResult: { error: e?.message || "测试失败" },
              }
            : t
        );
      }
    },
    // 占位：聊天发送
    onSendMessage(text) {
      if (!text) return;
      this.messages.push({ role: "user", text });
    },
  },
};
</script>

<style scoped>
/* 页面容器（包含 Banner + 主体） */
.agent-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #121212;
  color: #e0e0e0;
  overflow: hidden; /* 外层不出现滚动条 */
  position: fixed; /* 固定充满窗口，彻底不让 body 出滚动条 */
  inset: 0;
}

/* 主体布局 */
.agent-layout {
  display: flex;
  gap: 0;
  padding: 0; /* 取消内边距 */
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 0; /* 关键：允许子项按视口弹性收缩 */
}

.left-panel,
.right-panel {
  background: #1e1e1e;
  border: 1px solid #2a2a2a;
  border-radius: 10px;
  padding: 0; /* 取消 panel 内部 padding */
  box-sizing: border-box;
  min-height: 0; /* 防止内容把高度撑破视口 */
}

.left-panel {
  flex: 0 0 38%;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 避免父级抢滚动，由内部 pane 控制 */
}

.right-panel {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 由内部 ChatSection 控制滚动 */
}

/* 让 ChatSection 充满右侧并自行管理内部滚动 */
.right-panel > * {
  flex: 1 1 auto;
  min-height: 0;
}

/* 让 LeftSplitPanel 占满左侧可用高度 */
.left-panel > * {
  flex: 1 1 auto;
  min-height: 0;
}

/* 过渡（用于 AuthPanel 出入场） */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
