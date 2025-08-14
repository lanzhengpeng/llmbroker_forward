<template>
  <div class="profile-page">
    <div class="avatar-box">
      <img class="avatar" src="/src/assets/home/头像.jpg" alt="头像" />
      <h2 class="name">lanzhengpeng</h2>
      <p class="desc">欢迎访问我的主页！</p>
    </div>
    <nav class="nav-bar">
      <router-link to="/" class="nav-item home-icon">
        <img src="/src/assets/home/主页.svg" alt="主页" style="height:28px;width:28px;vertical-align:middle;" />
      </router-link>
      <router-link to="/chat" class="nav-item work-icon">
        <img src="/src/assets/home/作品.svg" alt="作品" style="height:28px;width:28px;vertical-align:middle;" />
      </router-link>
      <a href="https://github.com/lanzhengpeng" target="_blank" class="nav-item github-icon">
        <img src="/src/assets/home/github.svg" alt="GitHub" style="height:28px;width:28px;vertical-align:middle;" />
      </a>
    </nav>
  </div>
</template>

<script>
export default {
  name: "ProfilePage"
};
</script>

<style scoped>
.work-icon {
  padding: 6px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-page {
  min-height: 100vh;
  background: #18181c;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
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
}
.nav-item {
  color: #fff;
  font-size: 1.1rem;
  text-decoration: none;
  padding: 8px 20px;
  border-radius: 20px;
  background: rgba(40,40,50,0.7);
  transition: background 0.2s, color 0.2s;
}
.nav-item:hover {
  background: #4a9eff;
  color: #18181c;
}
.github-icon {
  padding: 6px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.home-icon {
  padding: 6px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
