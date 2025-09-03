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

    <!-- 主体布局：三栏 -->
    <div class="agent-layout three-cols">
      <section class="col prompt-col">
        <PromptSection v-model="promptText" />
      </section>
      <section class="col tools-col">
        <ToolsSection :tools="tools" @add="onAddTool" @fetch="onFetchTools" @test="onTestTool" @clear="onClearTools" />
      </section>
      <section class="col chat-col">
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
import PromptSection from "../components/PromptSection.vue";
import ToolsSection from "../components/ToolsSection.vue";
import ChatSection from "../components/ChatSection.vue";

export default {
  name: "Agent",
  components: {
    AuthBanner,
    AuthPanel,
    PromptSection,
    ToolsSection,
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
        // 先调用注册接口
        await agentRequest('/user/register', {
          method: 'POST',
          body: { username, password },
        });
        // 注册成功后自动登录以获取 token
        await apiLogin(username, password);
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
  const res = await agentRequest("/tool/register_tools", {
          method: "POST",
          body: { base_url: url, openapi_json: openapiJson },
        });
        const msg = (res && (res.message || res.detail)) || "工具注册完成";
        alert(msg);
      } catch (e) {
        console.error("添加工具失败:", e);
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
      const { index, toolName, params } = payload || {};
      if (index == null || !this.tools[index]) return;
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
    // 工具：清空所有工具
    async onClearTools() {
      if (!confirm('确定要清空所有工具吗？此操作不可逆。')) return;
      try {
        const res = await agentRequest('/tool/clear_tools', { method: 'DELETE', body: {} });
        // 兼容后端可能返回不同结构
        const ok = res && (res.success || res.code === 0 || /清除|已清空|ok/i.test(JSON.stringify(res)));
        if (ok) {
          this.tools = [];
          alert('已清空所有工具');
        } else {
          alert((res && (res.message || res.detail)) || '清空工具返回未知结果');
        }
      } catch (e) {
        console.error('清空工具失败:', e);
        alert(e?.message || '清空工具失败');
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
  overflow: hidden;
  position: fixed;
  inset: 0;
}

/* 三栏布局 */
.agent-layout.three-cols {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
  background: #18181c;
  overflow: hidden;
}
.col {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 12px 8px;
}
/* 三大板块均分空间，沾满整个区域 */
.prompt-col,
.tools-col,
.chat-col {
  /* 强制等宽：每列占据三分之一宽度 */
  flex: 0 0 33.3333%;
  max-width: 33.3333%;
  min-width: 0;
  box-sizing: border-box;
  border-right: 1px solid #222;
}
.chat-col {
  border-right: none;
}
@media (max-width: 1100px) {
  .agent-layout.three-cols {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
  }
  .col {
    min-width: 0;
    width: 100%;
    padding: 8px 4px;
    border-right: none;
    border-bottom: 1px solid #222;
  }
  .prompt-col, .tools-col, .chat-col {
    max-width: none;
    min-width: 0;
    border-right: none;
    border-bottom: 1px solid #222;
  }
  .chat-col {
    border-bottom: none;
  }
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

cdexwss