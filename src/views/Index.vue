<template>
  <div class="profile-page">
    <div class="avatar-box">
      <img class="avatar" src="/src/assets/home/头像.jpg" alt="头像" />
      <h2 class="name">lanzhengpeng</h2>
      <p class="desc">欢迎访问我的主页！</p>
    </div>
    <nav class="nav-bar">
      <router-link to="/" class="nav-item home-icon">
        <img class="nav-icon" src="/src/assets/home/主页.svg" alt="主页" />
        <span class="nav-label">主页</span>
      </router-link>
      <router-link to="/chat" class="nav-item work-icon">
        <img class="nav-icon" src="/src/assets/home/作品.svg" alt="聊天" />
        <span class="nav-label">聊天</span>
      </router-link>
      <a
        href="https://github.com/lanzhengpeng"
        target="_blank"
        class="nav-item github-icon"
      >
        <img class="nav-icon" src="/src/assets/home/github.svg" alt="GitHub" />
        <span class="nav-label">GitHub</span>
      </a>
    </nav>
  </div>
</template>

<script>
export default {
  name: "ProfilePage",
};
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: #18181c;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* 背景充满全屏，无内边距 */
  padding: 0;
  margin: 0;
  position: fixed;
  inset: 0;
  overflow: auto;
}
.avatar-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
}
.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  border: 3px solid #222;
  background: #222;
}
.name {
  color: #fff;
  font-size: 2rem;
  margin: 16px 0 8px 0;
  font-weight: 600;
}
.desc {
  color: #aaa;
  font-size: 1.1rem;
  margin-bottom: 8px;
}
.nav-bar {
  display: flex;
  gap: 32px;
  justify-content: center;
  flex-wrap: wrap;
}
.nav-item {
  color: #fff;
  font-size: 1.1rem;
  text-decoration: none;
  padding: 10px 16px;
  border-radius: 12px;
  background: rgba(40, 40, 50, 0.7);
  transition: background 0.2s, color 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 72px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.nav-item:hover {
  background: #4a9eff;
  color: #18181c;
}
.nav-icon {
  width: 28px;
  height: 28px;
  display: block;
}
.nav-label {
  font-size: 0.85rem;
  line-height: 1;
}
.home-icon,
.work-icon,
.github-icon {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 平板适配 */
@media (max-width: 768px) {
  .avatar {
    width: 100px;
    height: 100px;
  }
  .name {
    font-size: 1.6rem;
  }
  .desc {
    font-size: 1rem;
  }
  .nav-bar {
    gap: 20px;
  }
  .nav-item {
    min-width: 64px;
    padding: 10px 14px;
  }
  .nav-icon {
    width: 26px;
    height: 26px;
  }
}

/* 手机适配 */
@media (max-width: 480px) {
  /* 保持全屏铺满，不添加内边距 */
  .avatar {
    width: 84px;
    height: 84px;
  }
  .name {
    font-size: 1.3rem;
    margin: 12px 0 6px 0;
  }
  .desc {
    font-size: 0.95rem;
  }
  .nav-bar {
    gap: 12px;
  }
  .nav-item {
    min-width: 56px;
    padding: 8px 12px;
    gap: 4px;
    border-radius: 10px;
  }
  .nav-icon {
    width: 22px;
    height: 22px;
  }
  .nav-label {
    font-size: 0.78rem;
  }
}
</style>
