<template>
  <div class="projects-page">
    <!-- 上方横幅板块 -->
    <section class="banner" :class="{ collapsed: isCollapsed }">
      <div class="banner-content">
        <div class="banner-left">
          <div class="banner-header">
            <button @click="goHome" class="back-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              返回主页
            </button>
            <h1>我的项目</h1>
          </div>
          <p class="subtitle">
            精选一些近期/代表性的个人项目，支持搜索与按标签筛选。
          </p>
        </div>
        
        <div class="banner-right">
          <input
            v-model.trim="query"
            class="search"
            type="text"
            placeholder="搜索项目名称或描述..."
            :disabled="loading"
          />
        </div>
      </div>
    </section>

    <!-- 下方内容板块：左右分布 -->
    <section class="content" ref="content">
      <!-- 左侧标签选择区 -->
      <aside class="sidebar">
        <h3 class="sidebar-title">标签筛选</h3>
        <div class="tags">
          <button
            v-for="tag in allTags"
            :key="tag"
            class="tag"
            :class="{ active: selectedTags.includes(tag) }"
            @click="toggleTag(tag)"
            :disabled="loading"
          >
            {{ tag }}
          </button>
          <button
            class="tag clear"
            v-if="selectedTags.length"
            @click="clearTags"
            :disabled="loading"
          >
            清空筛选
          </button>
        </div>
      </aside>

      <!-- 右侧卡片展示区 -->
      <main class="main-content">
        <div v-if="loading" class="loading">
          <p>加载中...</p>
        </div>
        
        <div class="grid" v-else-if="filteredProjects.length">
          <article v-for="p in filteredProjects" :key="p.id" class="card">
            <div class="card-head">
              <div class="cover" v-if="p.cover">
                <img :src="p.cover" :alt="p.title" loading="lazy" />
              </div>
              <h3 class="title">{{ p.title }}</h3>
            </div>
            <p class="desc">{{ p.description }}</p>
            <div class="meta">
              <span v-for="t in p.tags" :key="t" class="pill">{{ t }}</span>
            </div>
            <div class="actions">
              <router-link
                v-if="p.demo && !isExternal(p.demo)"
                :to="p.demo"
                class="btn primary"
                >使用</router-link
              >
              <a
                v-else-if="p.demo"
                :href="p.demo"
                target="_blank"
                rel="noopener"
                class="btn primary"
                >预览</a
              >
              <a
                v-if="p.github"
                :href="p.github"
                target="_blank"
                rel="noopener"
                class="btn"
                >GitHub</a
              >
            </div>
          </article>
        </div>

        <div v-else-if="!loading" class="empty">
          <p>没有找到匹配的项目。</p>
          <p>总项目数: {{ projects.length }}</p>
          <p>筛选后项目数: {{ filteredProjects.length }}</p>
          <button class="btn" @click="resetFilters">重置筛选</button>
        </div>
      </main>
    </section>
  </div>
</template>

<script>
import initSqlJs from "sql.js/dist/sql-wasm.js";

export default {
  name: "Projects",
  data() {
    return {
      loading: true,
      projects: [],
      query: "",
      selectedTags: [],
      isCollapsed: false,
      _db: null,
    };
  },

  async mounted() {
    document.body.classList.add("projects-full-bleed");
    
    try {
      const SQL = await initSqlJs({
        locateFile: (file) => `/sql-wasm.wasm`,
      });
      const response = await fetch("/db/config.db");
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const buf = await response.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(buf));
      this._db = db;

      const selectQuery = `SELECT * FROM projects`;
      const stmt = db.prepare(selectQuery);
      const projects = [];
      while (stmt.step()) {
        projects.push(stmt.getAsObject());
      }
      stmt.free();

      if (projects.length) {
        let hasProjectTags = false;
        let hasInlineTags = false;
        try {
          db.exec("SELECT 1 FROM project_tags LIMIT 1");
          hasProjectTags = true;
        } catch {}
        try {
          db.exec("SELECT tags FROM projects WHERE tags IS NOT NULL LIMIT 1");
          hasInlineTags = true;
        } catch {}

        this.projects = projects.map((obj) => {
          let tags = [];
          if (hasProjectTags && obj.id != null) {
            try {
              const q = `SELECT tag FROM project_tags WHERE project_id = ?`;
              const stmt = db.prepare(q);
              stmt.bind([obj.id]);
              while (stmt.step()) {
                const rowVal = stmt.getAsObject();
                if (rowVal.tag != null) tags.push(String(rowVal.tag));
              }
              stmt.free();
            } catch (e) {
              console.warn("读取 project_tags 失败，回落到内联 tags 列：", e);
            }
          }
          if (!tags.length && hasInlineTags && obj.tags != null) {
            tags = String(obj.tags)
              .split(/[，,\s]+/)
              .map((s) => s.trim())
              .filter(Boolean);
          }
          obj.tags = tags;
          return obj;
        });
      }
      
      console.log('项目数据加载完成:', this.projects.length, '个项目');
      console.log('项目列表:', this.projects);
    } catch (err) {
      console.error("初始化/读取数据库出错：", err);
      this.projects = [];
    } finally {
      this.loading = false;
    }

    this.$nextTick(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.addEventListener("scroll", this.onContentScroll, { passive: true });
        this.onContentScroll();
      }
    });
  },
  beforeUnmount() {
    document.body.classList.remove("projects-full-bleed");
    if (this._db) {
      try { this._db.close(); } catch {}
      this._db = null;
    }
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.removeEventListener("scroll", this.onContentScroll);
    }
  },
  computed: {
    filteredProjects() {
      let result = this.projects;
      if (this.query) {
        const q = this.query.toLowerCase();
        result = result.filter((p) => {
          return (
            p.title?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            (Array.isArray(p.tags) && p.tags.some((t) => t.toLowerCase().includes(q)))
          );
        });
      }
      if (this.selectedTags.length) {
        result = result.filter((p) =>
          this.selectedTags.every((t) => Array.isArray(p.tags) && p.tags.includes(t))
        );
      }
      return result;
    },
    allTags() {
      const tagSet = new Set();
      this.projects.forEach((p) => {
        if (Array.isArray(p.tags)) {
          p.tags.forEach((t) => tagSet.add(t));
        }
      });
      return Array.from(tagSet).sort();
    },
  },
  methods: {
    toggleTag(tag) {
      const idx = this.selectedTags.indexOf(tag);
      if (idx >= 0) {
        this.selectedTags.splice(idx, 1);
      } else {
        this.selectedTags.push(tag);
      }
    },
    clearTags() {
      this.selectedTags = [];
    },
    resetFilters() {
      this.query = "";
      this.selectedTags = [];
    },
    goHome() {
      this.$router.push('/');
    },
    isExternal(url) {
      if (!url) return false;
      try {
        const u = new URL(url, location.origin);
        return u.origin !== location.origin;
      } catch {
        return !url.startsWith("/");
      }
    },
    onContentScroll() {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        const wasCollapsed = this.isCollapsed;
        this.isCollapsed = mainContent.scrollTop > 50;
        
        // 只在状态改变时更新，避免重复操作
        if (wasCollapsed !== this.isCollapsed) {
          const projectsPage = document.querySelector('.projects-page');
          if (projectsPage) {
            if (this.isCollapsed) {
              projectsPage.classList.add('banner-collapsed');
            } else {
              projectsPage.classList.remove('banner-collapsed');
            }
          }
        }
      }
    },
  },
};
</script>

<style scoped>
.projects-page {
  --bg-primary: radial-gradient(circle at top, #0f0f0f, #000000);
  --bg-card: linear-gradient(135deg, rgba(18, 18, 18, 0.9), rgba(24, 24, 24, 0.8));
  --bg-glass: rgba(10, 10, 10, 0.7);
  --border-color: rgba(255, 255, 255, 0.1);
  --text-primary: rgba(255, 255, 255, 0.95);
  --text-secondary: rgba(255, 255, 255, 0.7);
  --accent-blue: #3b82f6;
  --accent-hover: #1d4ed8;

  width: 100%;
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  overflow: hidden;
}

/* 横幅区域 - 固定在顶部 */
.banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--bg-glass);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  padding: 12px 32px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  /* 确保banner始终覆盖可能出现的间隙 */
  box-shadow: 0 0 0 1px var(--bg-glass);
}

.banner.collapsed {
  transform: translateY(-100%); /* 完全向上移出视口 */
  opacity: 0;
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  max-width: 1400px;
  margin: 0 auto;
}

.banner-left {
  flex: 1;
  min-width: 0;
}

.banner-right {
  flex: 0 0 auto;
  width: 400px;
}

.banner-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 4px;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateX(-2px);
}

.back-button svg {
  color: var(--accent-primary);
  transition: transform 0.3s ease;
}

.back-button:hover svg {
  transform: translateX(-2px);
}

.banner h1 {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0 0 4px;
  background: linear-gradient(135deg, #60a5fa, #a855f7, #ec4899);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.search-bar {
  text-align: center;
}

.search {
  width: 100%;
  max-width: none;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: all 0.3s ease;
}

.search::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.search:focus {
  border-color: var(--accent-blue);
  background: rgba(255, 255, 255, 0.08);
}

/* 内容区域：左右布局，距离顶部banner的高度 */
.content {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 0;
  position: fixed;
  top: 100px; /* 默认banner高度 */
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  transition: top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin: 0; /* 确保没有外边距 */
  padding: 0; /* 确保没有内边距 */
}

/* 当banner完全隐藏时，content区域占据全屏，并为子元素margin预留空间 */
.banner-collapsed .content {
  top: 0; /* 完全占据顶部 */
}

/* 左侧边栏 */
.sidebar {
  background: rgba(8, 8, 8, 0.6);
  border-right: 1px solid var(--border-color);
  padding: 24px;
  overflow: hidden; /* 防止整个sidebar滚动 */
  display: flex;
  flex-direction: column;
}

.sidebar-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--text-primary);
  flex-shrink: 0; /* 标题不收缩，始终可见 */
}

.tags {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto; /* 只有标签容器可滚动 */
  flex: 1; /* 占据剩余空间 */
  min-height: 0; /* 确保flex子元素可以收缩 */
  /* 标签容器的滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) rgba(0, 0, 0, 0.3);
}

.tags::-webkit-scrollbar {
  width: 6px;
}

.tags::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.tags::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.tags::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.tag {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.tag:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.2);
}

.tag.active {
  background: var(--accent-blue);
  color: white;
  border-color: var(--accent-blue);
}

.tag.clear {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  margin-top: 8px;
}

.tag.clear:hover {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.5);
  color: #fecaca;
}

/* 右侧主内容 */
.main-content {
  padding: 0 24px 24px 24px; /* 默认状态：无顶部padding */
  overflow-y: auto;
  height: 100%;
  /* 确保内容从顶部开始，无额外间距 */
  display: flex;
  flex-direction: column;
  transition: margin-top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  /* 自定义滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) rgba(0, 0, 0, 0.3);
}

/* 当banner隐藏时，添加顶部外边距 */
.banner-collapsed .main-content {
  margin-top: 24px;
}

/* 为边距区域添加浅色背景 */
.banner-collapsed .main-content::before {
  content: '';
  position: absolute;
  top: -24px;
  left: 0;
  right: 0;
  height: 24px;
  background: rgba(20, 20, 20, 0.8); /* 比主背景稍浅的颜色 */
  pointer-events: none;
}

.main-content::-webkit-scrollbar {
  width: 8px;
}

.main-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.main-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.main-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  margin: 0; /* 确保没有外边距 */
}

.card {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  margin: 0; /* 确保卡片没有外边距 */
  display: flex;
  flex-direction: column;
}

.card::before {
  content: '';
  position: absolute;
  inset: -1px;
  background: linear-gradient(135deg, transparent, rgba(59, 130, 246, 0.3), transparent);
  border-radius: 16px;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.card:hover {
  transform: translateY(-8px);
}

.card:hover::before {
  opacity: 0;
}

.card-head {
  margin-bottom: 16px;
}

.cover {
  width: 100%;
  height: 160px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.card:hover .cover img {
  transform: scale(1.05);
}

.title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.desc {
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 16px;
  font-size: 0.9rem;
  flex: 1; /* 让描述区域占据剩余空间，将按钮推到底部 */
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 20px;
  margin-top: auto; /* 将meta推到底部区域 */
}

.pill {
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #93c5fd;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: auto; /* 确保按钮始终在卡片底部 */
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  color: var(--text-secondary);
}

.btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.2);
}

.btn.primary {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: white;
}

.btn.primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.empty {
  text-align: center;
  padding: 0 20px 64px; /* 完全去掉顶部padding */
  color: var(--text-secondary);
  margin: 0; /* 确保没有外边距 */
  flex: 1; /* 占据剩余空间 */
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.loading {
  text-align: center;
  padding: 0 20px 64px;
  color: var(--text-secondary);
  margin: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.empty p {
  font-size: 1.1rem;
  margin: 0 0 20px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .content {
    grid-template-columns: 200px 1fr;
    top: 85px;
  }
  
  .banner-collapsed .content {
    top: 0; /* 移动端也完全占据顶部 */
  }
  
  .banner-content {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .banner-right {
    width: 100%;
  }
  
  .banner {
    padding: 12px 16px;
  }
  
  .sidebar {
    padding: 16px;
  }
  
  .main-content {
    padding: 0 16px 16px 16px; /* 移动端默认无顶部padding */
  }
  
  /* 移动端banner隐藏时的顶部外边距 */
  .banner-collapsed .main-content {
    margin-top: 16px;
  }
  
  /* 移动端边距区域的背景色 */
  .banner-collapsed .main-content::before {
    top: -16px;
    height: 16px;
  }
  
  .grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

@media (max-width: 640px) {
  .content {
    grid-template-columns: 1fr;
    grid-template-rows: 120px 1fr; /* 给标签区固定高度 */
    top: 80px;
  }
  
  .banner-collapsed .content {
    top: 0; /* 小屏幕也完全占据顶部 */
  }
  
  .banner h1 {
    font-size: 1.5rem;
  }
  
  .back-button {
    padding: 6px 12px;
    font-size: 0.8rem;
    gap: 6px;
  }
  
  .back-button svg {
    width: 16px;
    height: 16px;
  }
  
  .sidebar {
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    padding: 16px;
    height: auto; /* 移除固定高度，使用grid控制 */
  }
  
  .tags {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .tag {
    text-align: center;
    flex: 0 0 auto;
  }
}

/* 全局样式 */
:global(body.projects-full-bleed) {
  display: block !important;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0;
  overflow: hidden; /* 防止页面出现滚动条 */
  background: radial-gradient(circle at top, #0f0f0f, #000000);
  color: rgba(255, 255, 255, 0.95);
}
:global(body.projects-full-bleed #app) {
  max-width: none !important;
  padding: 0 !important;
  margin: 0 !important;
  text-align: initial !important;
}
:global(body.projects-full-bleed img) {
  max-width: 100%;
  height: auto;
}
:global(body.projects-full-bleed .desc),
:global(body.projects-full-bleed .pill),
:global(body.projects-full-bleed .tag) {
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
