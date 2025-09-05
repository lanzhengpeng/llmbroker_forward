<template>
  <header class="auth-banner">
    <button
      class="home-btn btn"
      @click.stop="$emit('go-home')"
      aria-label="返回主页"
    >
      返回主页
    </button>
    <div class="banner-content">
      <!-- 中间区域不显示文字，也不处理点击 -->
    </div>
    <div v-if="user" class="user-avatar" @click="$emit('toggle-auth')" title="点击管理账户">
      <img src="/头像.png" alt="用户头像" />
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
  background: #ffffff; /* 白色背景 */
  color: #333333;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid #e0e0e0; /* 浅灰色分割线 */
}
.auth-banner .home-btn {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.08);
  color: #333333;
  border-color: rgba(0, 0, 0, 0.2);
  padding: 4px 8px; /* smaller */
  font-size: 13px;
  border-radius: 6px;
}
.banner-content {
  padding: 20px 0; /* 调整为现在的6/5 */
  text-align: center;
  font-size: 14px;
}

.user-avatar {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  transition: opacity 0.2s;
}
.user-avatar:hover {
  opacity: 0.8;
}
.user-avatar img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(0, 0, 0, 0.2);
}

.btn {
  border: 1px solid #d0d0d0;
  background: #f8f8f8;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}
</style>
