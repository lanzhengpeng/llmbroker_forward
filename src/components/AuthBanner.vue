<template>
  <header class="auth-banner" @click="$emit('toggle-auth')">
    <button
      class="home-btn btn"
      @click.stop="$emit('go-home')"
      aria-label="返回主页"
    >
      返回主页
    </button>
    <div class="banner-content">
      <span v-if="!user">点击登录 / 注册</span>
      <span v-else>已登录：{{ user.username }}（点击管理账户）</span>
    </div>
  </header>
</template>

<script>
export default {
  name: "AuthBanner",
  props: {
    user: { type: Object, default: null },
  },
};
</script>

<style scoped>
.auth-banner {
  position: relative;
  background: linear-gradient(90deg, #6d28d9, #7c3aed, #a855f7);
  color: #fff;
  cursor: pointer;
  user-select: none;
}
.auth-banner .home-btn {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}
.banner-content {
  padding: 0; /* 取消内边距 */
  text-align: center;
  font-size: 14px;
}

.btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}
</style>
