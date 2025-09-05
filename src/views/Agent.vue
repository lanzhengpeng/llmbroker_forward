<template>
  <div class="agent-page">
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

    <!-- 主体布局：两栏，左侧为工具/提示切换面板，右侧为聊天 -->
    <div
      class="agent-layout two-cols"
      :class="{ 'left-collapsed': !leftColVisible }"
    >
      <section class="col left-col" :class="{ collapsed: !leftColVisible }">
        <!-- 左侧Banner部分 - 始终显示 -->
        <div class="left-banner">
          <button
            class="home-btn"
            @click.stop="goHome"
            aria-label="返回主页"
            title="返回主页"
          >
            <img src="/src/assets/agent/logo.svg" alt="返回主页" />
          </button>
        </div>

        <!-- 收起状态下显示的图标容器 -->
        <div class="collapsed-icons-container">
          <!-- 收起状态下显示的编辑提示词图标 -->
          <div
            class="collapsed-prompt-btn"
            @click="openPromptModal"
            title="编辑提示词"
          >
            <img src="/prompt.svg" alt="编辑提示词" />
          </div>

          <!-- 收起状态下显示的查看工具列表图标 -->
          <div
            class="collapsed-tools-btn"
            @click="openToolsModal"
            title="查看工具列表"
          >
            <img src="/src/assets/agent/库.svg" alt="查看工具列表" />
          </div>
        </div>

        <div class="left-content" v-show="leftColVisible">
          <div class="panel">
            <ToolsSection
              ref="toolsSection"
              :tools="tools"
              @add="onAddTool"
              @fetch="onFetchTools"
              @load="onLoadTools"
              @test="onTestTool"
              @clear="onClearTools"
              @save="onSaveTool"
              @delete="onDeleteTool"
            />
          </div>
        </div>

        <!-- 左侧底部Banner - 始终显示 -->
        <div class="left-bottom-banner">
          <div
            class="bottom-avatar"
            @click="onToggleAuth"
            :title="user ? `当前账号：${user.username}` : '点击管理账户'"
          >
            <img src="/头像.png" alt="用户头像" />
          </div>
        </div>
      </section>

      <section class="col chat-col">
        <!-- 右侧Banner部分 -->
        <div
          class="right-banner"
          :class="{ 'has-messages': messages.length > 0 }"
        >
          <div class="banner-left">
            <button class="zoom-btn" @click="toggleLeftPanel">
              <img src="/zoom.svg" alt="缩放" />
            </button>
            <h2>Agent智能体</h2>
          </div>
          <div class="banner-content">
            <!-- 中间区域空白 -->
          </div>
          <div class="new-chat-btn" @click="startNewChat" title="新建对话">
            <img src="/new_chat.svg" alt="新建对话" />
          </div>
        </div>

        <ChatSection
          ref="chatSection"
          :messages="messages"
          :user="user"
          @send="onSendMessage"
          @toggle-left-panel="toggleLeftPanel"
        />
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
      // 左侧视图：'tools' 或 'prompt'
      leftView: "tools",
      // 左侧栏显示控制
      leftColVisible: true,
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
        await agentRequest("/user/register", {
          method: "POST",
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
    // 工具：保存到数据库（根据名字保存内存中的工具）
    async onSaveTool({ index, toolName }) {
      if (index == null || !this.tools[index]) return;
      // 只允许保存测试通过的工具
      if (!this.tools[index].testResult) {
        alert("该工具尚未通过测试，无法保存。");
        return;
      }
      // 标记保存中
      this.tools = this.tools.map((t, i) =>
        i === index ? { ...t, saving: true } : t
      );
      try {
        const res = await agentRequest("/tool/save", {
          method: "POST",
          body: { tool_name: toolName },
        });
        // 更新为已保存
        this.tools = this.tools.map((t, i) =>
          i === index ? { ...t, saving: false, saved: true } : t
        );
        const msg = (res && (res.message || res.detail)) || "保存成功";
        // 在页面上显示（也支持更复杂的通知组件）
        alert(`保存工具响应: ${msg}`);
      } catch (e) {
        this.tools = this.tools.map((t, i) =>
          i === index ? { ...t, saving: false } : t
        );
        console.error("保存工具失败:", e);
        alert(e?.message || "保存工具失败");
      }
    },
    // 工具：从数据库加载到内存后刷新列表
    async onLoadTools() {
      try {
        const res = await agentRequest("/tool/load", {
          method: "POST",
          body: {},
        });
        const msg =
          (res && (res.message || res.detail)) || JSON.stringify(res || {});
        // 刷新工具列表
        await this.onFetchTools();
        alert(`加载工具响应: ${msg}`);
      } catch (e) {
        console.error("加载工具失败:", e);
        alert(e?.message || "加载工具失败");
      }
    },
    // 工具：按名字删除（先将数据库加载到内存并刷新列表，以确保名称一致）
    async onDeleteTool({ toolName }) {
      if (!toolName) return;
      if (!confirm(`确定要删除工具 "${toolName}" 吗？此操作不可逆。`)) return;
      try {
        // 先请求后端将 DB 中的工具加载到内存（后端负责同步）
        await agentRequest("/tool/load", { method: "POST", body: {} });
        // 刷新内存列表以确认名称
        await this.onFetchTools();

        // 发起按名字删除请求（DELETE /tool/delete）
        const delRes = await agentRequest("/tool/delete", {
          method: "DELETE",
          body: { tool_name: toolName },
        });

        // 重新刷新列表
        await this.onFetchTools();

        const msg =
          (delRes && (delRes.message || delRes.detail)) ||
          JSON.stringify(delRes || {});
        alert(`删除工具响应: ${msg}`);
      } catch (e) {
        console.error("删除工具失败:", e);
        alert(e?.message || "删除工具失败");
      }
    },
    // 工具：清空所有工具
    async onClearTools() {
      if (!confirm("确定要清空所有工具吗？此操作不可逆。")) return;
      try {
        const res = await agentRequest("/tool/clear_tools", {
          method: "DELETE",
          body: {},
        });
        // 兼容后端可能返回不同结构
        const ok =
          res &&
          (res.success ||
            res.code === 0 ||
            /清除|已清空|ok/i.test(JSON.stringify(res)));
        if (ok) {
          this.tools = [];
          alert("已清空所有工具");
        } else {
          alert((res && (res.message || res.detail)) || "清空工具返回未知结果");
        }
      } catch (e) {
        console.error("清空工具失败:", e);
        alert(e?.message || "清空工具失败");
      }
    },
    // 占位：聊天发送
    onSendMessage(text) {
      if (!text) return;
      this.messages.push({ role: "user", text });
    },
    // 切换左侧栏显示/隐藏
    toggleLeftPanel() {
      this.leftColVisible = !this.leftColVisible;
    },
    // 新建对话
    startNewChat() {
      // 调用ChatSection的clearHistory方法来清空历史记录
      if (this.$refs.chatSection && this.$refs.chatSection.clearHistory) {
        this.$refs.chatSection.clearHistory();
      } else {
        // 兜底方案：直接清空本地消息
        this.messages = [];
      }
    },
    // 打开编辑提示词模态框
    openPromptModal() {
      // 通过ref调用ToolsSection的编辑提示词功能
      if (this.$refs.toolsSection && this.$refs.toolsSection.setActive) {
        this.$refs.toolsSection.setActive("prompt");
      }
    },
    // 打开查看工具列表模态框
    openToolsModal() {
      // 通过ref调用ToolsSection的查看工具列表功能
      if (this.$refs.toolsSection && this.$refs.toolsSection.setActive) {
        this.$refs.toolsSection.setActive("view");
      }
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
  background: #ffffff;
  color: #333333;
  overflow: hidden;
  position: fixed;
  inset: 0;
}

/* 两栏布局 */
.agent-layout.two-cols {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
  background: #ffffff;
  overflow: hidden;
}

/* 当左侧栏收起时，聊天区域调整宽度 */
.agent-layout.two-cols.left-collapsed .chat-col {
  width: calc(100% - 56px); /* 减去收起后的侧边栏宽度 */
  flex: 1 1 calc(100% - 56px);
}
.col {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 0; /* 移除原有padding，让banner自己控制间距 */
}
.left-col {
  flex: 0 0 256px; /* 左侧固定宽度，从320px缩短1/5到256px */
  max-width: 40%;
  min-width: 220px;
  box-sizing: border-box;
  border-right: 1px solid #e0e0e0;
  background: #f8f9fa; /* 改为浅灰色背景 */
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease; /* 添加平滑过渡 */
  overflow: hidden; /* 防止内容溢出 */
  padding: 0; /* 确保没有默认内边距 */
  margin: 0; /* 确保没有默认外边距 */
}

/* 收起状态的侧边栏样式 */
.left-col.collapsed {
  flex: 0 0 56px; /* 收起时的固定宽度 */
  max-width: 56px;
  min-width: 56px;
  background: #ffffff; /* 白色背景 */
  justify-content: flex-start; /* 改为flex-start，让所有元素靠上显示 */
  padding: 0 !important; /* 强制移除所有内边距 */
  margin: 0 !important; /* 强制移除所有外边距 */
  position: relative; /* 添加相对定位，为底部banner的绝对定位提供参考 */
}

/* 确保收起状态下col元素也没有内边距 */
.col.left-col.collapsed {
  padding: 0 !important;
  margin: 0 !important;
}

/* 确保收起状态下所有子元素都没有外边距 */
.left-col.collapsed * {
  margin: 0 !important;
}

.left-col.collapsed > * {
  margin: 0 !important;
}

/* 移除旧的收起状态样式 */
.left-col-collapsed {
  display: none;
}

.collapsed-avatar {
  display: none;
}
.chat-col {
  flex: 1 1 auto;
  min-width: 0;
  box-sizing: border-box;
  transition: all 0.3s ease; /* 添加平滑过渡 */
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 左侧顶部切换按钮 */
.left-header {
  display: flex;
  gap: 8px;
  padding: 8px 12px; /* 添加左右内边距 */
  align-items: center;
  background: #f8f9fa; /* 添加灰色背景 */
}

.left-header .section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333333;
}
.tab-btn {
  background: transparent;
  color: #666666;
  border: 1px solid transparent;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.tab-btn.active {
  background: #f0f0f0;
  color: #333333;
  border-color: #d0d0d0;
}
.left-content {
  padding: 8px 12px; /* 添加左右内边距与header保持一致 */
  overflow: auto;
  flex: 1 1 auto;
  background: #f8f9fa; /* 添加灰色背景 */
}
.panel {
  height: 100%;
}

@media (max-width: 900px) {
  .agent-layout.two-cols {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
  }
  .left-col {
    width: 100%;
    max-width: none;
    min-width: 0;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }
  .chat-col {
    width: 100%;
    min-width: 0;
  }
}

/* 左侧栏滑动过渡效果 */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.4s ease;
  overflow: hidden;
}
.slide-left-enter-from {
  width: 0;
  min-width: 0;
  flex: 0 0 0;
  opacity: 0;
  transform: translateX(-100%);
}
.slide-left-leave-to {
  width: 0;
  min-width: 0;
  flex: 0 0 0;
  opacity: 0;
  transform: translateX(-100%);
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

/* 左侧Banner样式 */
.left-banner {
  position: relative;
  background: #f8f9fa; /* 改为浅灰色背景与侧边栏保持一致 */
  color: #333333;
  padding: 12px;
  flex-shrink: 0;
}

/* 收起状态下的顶部banner样式 */
.left-col.collapsed .left-banner {
  background: #ffffff;
  /* 保持相同的padding */
}

.left-banner .home-btn {
  background: transparent;
  border: none;
  color: #333333;
  padding: 8px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px; /* 固定宽度，与头像一致 */
  height: 32px; /* 固定高度，与头像一致 */
}

.left-banner .home-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}

.left-banner .home-btn img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

/* 右侧Banner样式 */
.right-banner {
  position: relative;
  background: #ffffff;
  color: #333333;
  padding: 0; /* 移除所有内边距 */
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px; /* 调整为原来的3/4，从56px变为42px */
}

/* 只有在有消息时才显示分割线 */
.right-banner.has-messages {
  border-bottom: 1px solid #e0e0e0;
}

.right-banner .banner-left {
  display: flex;
  align-items: center;
  gap: 8px; /* zoom按钮和标题之间的间距 */
  padding-left: 9px; /* 左边距 */
}

.right-banner .banner-left h2 {
  margin: 0;
  font-size: 20px; /* 变大 */
  color: #333333;
  font-weight: 700; /* 加粗 */
}

.right-banner .banner-content {
  flex: 1;
  text-align: center;
  font-size: 14px;
  padding: 0 12px; /* 添加左右内边距 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.right-banner .banner-content h2 {
  margin: 0;
  font-size: 16px;
  color: #333333;
  font-weight: 600;
}

.right-banner .new-chat-btn {
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 6px; /* 添加圆角以配合背景 */
  margin-right: 12px; /* 添加右边距 */
}

.right-banner .new-chat-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.right-banner .new-chat-btn img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

/* zoom 按钮样式 */
.right-banner .zoom-btn {
  padding: 4px;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.95);
  cursor: pointer;
  transition: background 0.2s;
}

.right-banner .zoom-btn:hover {
  background: rgba(240, 240, 240, 0.98);
}

.right-banner .zoom-btn img {
  width: 10px;
  height: 10px;
  display: block;
  filter: brightness(0) opacity(0.6); /* 使SVG图标变为深灰色 */
}

/* 左侧底部Banner样式 */
.left-bottom-banner {
  position: relative;
  background: #f8f9fa;
  padding: 12px;
  flex-shrink: 0;
  border-top: 1px solid #e0e0e0;
}

/* 收起状态下的底部Banner样式 */
.left-col.collapsed .left-bottom-banner {
  background: #ffffff;
  border-top: none;
  position: absolute; /* 绝对定位 */
  bottom: 0; /* 固定在底部 */
  left: 0;
  right: 0;
}

.left-bottom-banner .bottom-avatar {
  display: flex;
  align-items: center;
  justify-content: flex-start; /* 靠左显示 */
  cursor: pointer;
  transition: opacity 0.2s;
}

.left-bottom-banner .bottom-avatar:hover {
  opacity: 0.8;
}

.left-bottom-banner .bottom-avatar img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(0, 0, 0, 0.2);
}

/* 收起状态下的图标容器 */
.collapsed-icons-container {
  display: none; /* 默认隐藏 */
  flex-direction: column;
  align-items: center;
  padding-top: 16px; /* 顶部间距 */
  gap: 0; /* 图标之间无间距，紧挨着 */
}

/* 只在收起状态下显示图标容器 */
.left-col.collapsed .collapsed-icons-container {
  display: flex;
}

/* 收起状态下的编辑提示词按钮 */
.collapsed-prompt-btn {
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px; /* 统一的内边距 */
  flex-shrink: 0; /* 不收缩 */
  margin: 0 !important; /* 强制移除所有外边距 */
}

/* 收起状态下的查看工具列表按钮 */
.collapsed-tools-btn {
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px; /* 统一的内边距 */
  flex-shrink: 0; /* 不收缩 */
  margin: 0 !important; /* 强制移除所有外边距 */
}

.collapsed-prompt-btn:hover {
  opacity: 0.8;
}

.collapsed-tools-btn:hover {
  opacity: 0.8;
}

.collapsed-prompt-btn img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.collapsed-tools-btn img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.btn {
  border: 1px solid #d0d0d0;
  background: #f8f8f8;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}

/* 侧边栏收起时，调整没有消息状态下的输入框宽度 */
.agent-layout.left-collapsed .chat-section.no-messages .custom-input-grid {
  width: calc(
    50vw - 28px
  ); /* 整个界面宽度的一半减去收起侧边栏宽度的一半(56px/2) */
}

/* 侧边栏收起时，调整有消息状态下的输入框宽度 */
.agent-layout.left-collapsed .chat-section.has-messages .custom-input-grid {
  width: calc(50vw - 28px); /* 与无消息时保持相同宽度 */
}

/* 侧边栏收起时，调整消息区域宽度 */
.agent-layout.left-collapsed .chat-section.has-messages .messages {
  width: 100%; /* 保持全宽，滚动条在最右边 */
}

/* 侧边栏收起时，调整消息内容宽度 */
.agent-layout.left-collapsed .chat-section.has-messages .messages .msg {
  max-width: calc(50vw - 28px); /* 与输入框宽度保持一致 */
}

/* 侧边栏收起时，调整回到底部按钮位置 */
.agent-layout.left-collapsed .jump-bottom {
  left: calc(
    56px + (100vw - 56px) / 2
  ); /* 收起时侧边栏宽度56px + 右侧区域的中心 */
}
</style>
