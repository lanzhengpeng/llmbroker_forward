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
        <span>当前账号：{{ user.username }}</span>
        <button class="btn" @click="$emit('logout')">退出登录</button>
      </div>
    </div>
  </section>
</template>

<script>
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
    };
  },
  methods: {
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
  },
};
</script>

<style scoped>
.auth-panel {
  position: relative;
  background: transparent;
}
.auth-card {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 8px;
  width: min(640px, calc(100% - 32px));
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  z-index: 10;
}
.auth-tabs {
  display: flex;
  gap: 8px;
  align-items: center;
}
.auth-tabs > button {
  border: 1px solid #e5e7eb;
  background: #fafafa;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.auth-tabs > button.active {
  background: #ede9fe;
  border-color: #c4b5fd;
  color: #5b21b6;
}
.auth-tabs > .close {
  margin-left: auto;
  background: transparent;
  border: none;
  font-size: 18px;
  line-height: 1;
  padding: 4px 8px;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0 0;
}
.auth-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.auth-form input {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 10px;
  outline: none;
}
.auth-form input:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}
.auth-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.auth-error {
  color: #dc2626;
  font-size: 12px;
}
.account-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 13px;
}

.btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.btn.primary {
  background: #7c3aed;
  color: #fff;
  border-color: #7c3aed;
}
</style>
