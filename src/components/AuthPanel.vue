<template>
  <section class="auth-panel" @click.self="$emit('close')">
    <div class="auth-card" @click.stop>
      <div class="auth-tabs">
        <button
          type="button"
          :class="{ active: mode === 'login' }"
          @click="mode = 'login'"
        >
          登录
        </button>
        <button
          type="button"
          :class="{ active: mode === 'register' }"
          @click="mode = 'register'"
        >
          注册
        </button>
        <button type="button" class="close" @click="$emit('close')">×</button>
      </div>

      <form
        v-if="mode === 'login'"
        class="auth-form"
        @submit.prevent="onSubmitLogin"
      >
        <label>
          用户名 <input v-model.trim="loginUsername" placeholder="输入用户名" />
        </label>
        <label>
          密码
          <input
            v-model.trim="loginPassword"
            type="password"
            placeholder="输入密码"
          />
        </label>
        <div class="auth-actions">
          <button class="btn primary" type="submit">登录</button>
        </div>
        <p v-if="error" class="auth-error">{{ error }}</p>
      </form>

      <form v-else class="auth-form" @submit.prevent="onSubmitRegister">
        <label>
          用户名 <input v-model.trim="regUsername" placeholder="设置用户名" />
        </label>
        <label>
          密码
          <input
            v-model.trim="regPassword"
            type="password"
            placeholder="设置密码"
          />
        </label>
        <label>
          确认密码
          <input
            v-model.trim="regConfirm"
            type="password"
            placeholder="再次输入密码"
          />
        </label>
        <div class="auth-actions">
          <button class="btn primary" type="submit">注册</button>
        </div>
        <p v-if="error" class="auth-error">{{ error }}</p>
      </form>

      <div v-if="user" class="account-row">
          <span>当前账号：<span class="account-name">{{ user.username }}</span></span>
          <button class="btn" @click="$emit('logout')">退出登录</button>
        </div>

        <!-- 管理账户信息 -->
        <div v-if="user" class="account-manage">
          <h3>管理账户信息</h3>
          <div class="fields">
            <label class="field">
              <span class="field-label">API Key</span>
              <input v-model.trim="apiKey" placeholder="api_key" />
            </label>
            <label class="field">
              <span class="field-label">Model URL</span>
              <input v-model.trim="modelUrl" placeholder="http://.../v1" />
            </label>
            <label class="field">
              <span class="field-label">Model Name</span>
              <input v-model.trim="modelName" placeholder="模型名（可选）" />
            </label>
          </div>
          <div class="auth-actions">
            <button class="btn" @click="onUpdateModelInfo">保存</button>
          </div>
        </div>
    </div>
  </section>
</template>

<script>
import { agentRequest } from "../api/client.js";

export default {
  name: "AuthPanel",
  props: {
    error: { type: String, default: "" },
    user: { type: Object, default: null },
  },
  data() {
    return {
      mode: "login",
      loginUsername: "",
      loginPassword: "",
      regUsername: "",
      regPassword: "",
      regConfirm: "",
  apiKey: "",
  modelUrl: "",
  modelName: "",
    };
  },
  mounted() {
    this.populateFromUser();
  },
  watch: {
    user() {
      this.populateFromUser();
    },
  },
  methods: {
    populateFromUser() {
      if (this.user) {
        this.apiKey = this.user.api_key || this.user.apiKey || "";
        this.modelUrl = this.user.model_url || this.user.modelUrl || "";
        this.modelName = this.user.model_name || this.user.modelName || "";
      } else {
        this.apiKey = "";
        this.modelUrl = "";
        this.modelName = "";
      }
    },
    onSubmitLogin() {
      this.$emit("login", {
        username: this.loginUsername,
        password: this.loginPassword,
      });
    },
    onSubmitRegister() {
      this.$emit("register", {
        username: this.regUsername,
        password: this.regPassword,
        confirm: this.regConfirm,
      });
    },
    async onUpdateModelInfo() {
      try {
        const payload = {
          api_key: this.apiKey || undefined,
          model_url: this.modelUrl || undefined,
          model_name: this.modelName || undefined,
        };
        const res = await agentRequest("/user/update_model_info", {
          method: "PUT",
          body: payload,
        });
        const msg = res && (res.message || res.detail) ? (res.message || res.detail) : res;
        // 如果是对象则格式化为可读 JSON
        const out = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
        alert("更新成功: " + out);
      } catch (e) {
        console.error("更新模型信息失败", e);
        const candidate = e?.data ?? e?.message ?? e;
        let errText;
        try {
          errText = typeof candidate === "string" ? candidate : JSON.stringify(candidate, null, 2);
        } catch (err) {
          errText = String(candidate);
        }
        alert("更新失败: " + errText);
      }
    },
  },
};
</script>

<style scoped>
.auth-panel {
  position: relative;
  background: #ffffff; /* 纯白背景 */
  color: #111;
}
.auth-card {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 8px;
  width: min(680px, calc(100% - 40px));
  background: #ffffff; /* 卡片白色 */
  border-radius: 12px;
  padding: 18px;
  color: #111;
  border: 1px solid #e6e6e6; /* 轻微边框，去掉科技感阴影 */
  box-shadow: none;
  z-index: 30;
}
.auth-tabs {
  display: flex;
  gap: 8px;
  align-items: center;
}
.auth-tabs > button {
  border: 1px solid transparent;
  background: transparent;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  color: #333;
  font-weight: 600;
  transition: background 0.12s ease, transform 0.12s ease;
  position: relative;
}
.auth-tabs > button:hover {
  background: #f5f5f5;
  transform: translateY(-1px);
}
.auth-tabs > button.active {
  color: #111;
  background: #f0f0f0;
  border-color: #e0e0e0;
}
.auth-tabs > .close {
  margin-left: auto;
  background: transparent;
  border: none;
  font-size: 18px;
  line-height: 1;
  padding: 6px 10px;
  color: #666;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 0 0;
}
.auth-form label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #333;
}
.auth-form input {
  border: 1px solid #e6e6e6;
  background: #ffffff;
  border-radius: 8px;
  padding: 10px 12px;
  outline: none;
  color: #111;
}
.auth-form input::placeholder {
  color: #9aa3ad;
}
.auth-form input:focus {
  border-color: #cfd8e0;
  box-shadow: none;
  outline: none;
}
.auth-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.auth-error {
  color: #d9534f;
  font-size: 12px;
}
.account-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  font-size: 13px;
}
.account-row .account-name {
  font-weight: 700;
  color: #111;
}

.btn {
  border: 1px solid #dcdcdc;
  background: #ffffff;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: #111;
  transition: background 0.12s ease, transform 0.08s ease;
}
.btn.primary {
  background: #ffffff; /* 改为白色主题 */
  color: #000;
  border: none;
}

/* 管理账户信息：水平弹性布局 */
.account-manage .fields {
  display: flex;
  gap: 10px;
  align-items: start;
  margin-top: 12px;
}
.account-manage .field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 0;
  min-width: 0; /* allow shrink */
}
.account-manage .field input {
  width: 100%;
  box-sizing: border-box;
}
@media (max-width: 700px) {
  .account-manage .fields {
    flex-direction: column;
  }
}

/* 悬停/激活效果，去掉大阴影 */
.btn:hover {
  transform: translateY(-1px);
  background: #fafafa;
}
.btn:active {
  transform: translateY(0);
}
.btn.primary:hover {
  filter: brightness(0.95);
}
</style>
