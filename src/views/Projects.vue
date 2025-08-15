<template>
  <div class="projects-page">
    <header class="header">
      <h1>我的项目</h1>
      <p class="subtitle">
        精选一些近期/代表性的个人项目，支持搜索与按标签筛选。
      </p>
    </header>

    <section class="filters">
      <input
        v-model.trim="query"
        class="search"
        type="text"
        placeholder="搜索项目名称或描述..."
        :disabled="loading"
      />
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
    </section>

    <section class="grid" v-if="filteredProjects.length">
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
            >预览</router-link
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
    </section>

    <section v-else class="empty">
      <p>没有找到匹配的项目。</p>
      <button class="btn" @click="resetFilters">重置筛选</button>
    </section>
  </div>
</template>

<script>
export default {
  name: "ProjectsPage",
  data() {
    return {
      loading: false,
      query: "",
      selectedTags: [],
      // 这里放一些示例数据，后续可替换为接口返回
      projects: [
        {
          id: "llmbroker-forward",
          title: "LLMBroker Forward Web",
          description:
            "Vite + Vue3 前端，用于连接 FastAPI 后端的聊天与项目展示。",
          tags: ["Vue3", "Vite", "FastAPI", "Chat"],
          github: "https://github.com/lanzhengpeng/llmbroker_forward",
          demo: "/",
          cover: null,
        },
        {
          id: "chat-page",
          title: "Chat 对话页",
          description:
            "支持流式/非流式响应、可终止、模型可配置的聊天页面示例。",
          tags: ["Vue", "Streaming", "LLM"],
          github:
            "https://github.com/lanzhengpeng/llmbroker_forward/tree/main/src/views",
          demo: "/chat",
          cover: null,
        },
        {
          id: "api-fastapi",
          title: "FastAPI 后端接口",
          description:
            "提供 /chat 与 /chat/stream 接口对接大模型，支持文本流输出。",
          tags: ["Python", "FastAPI", "AI"],
          github: "https://github.com/lanzhengpeng/llmbroker_forward",
          demo: null,
          cover: null,
        },
      ],
    };
  },
  computed: {
    allTags() {
      const s = new Set();
      this.projects.forEach((p) => p.tags?.forEach((t) => s.add(t)));
      return Array.from(s);
    },
    filteredProjects() {
      const q = this.query.toLowerCase();
      return this.projects.filter((p) => {
        const matchesQuery =
          !q ||
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q);
        const matchesTags =
          !this.selectedTags.length ||
          this.selectedTags.every((t) => p.tags.includes(t));
        return matchesQuery && matchesTags;
      });
    },
  },
  methods: {
    isExternal(url) {
      return /^https?:\/\//i.test(url);
    },
    toggleTag(tag) {
      const idx = this.selectedTags.indexOf(tag);
      if (idx >= 0) this.selectedTags.splice(idx, 1);
      else this.selectedTags.push(tag);
    },
    clearTags() {
      this.selectedTags = [];
    },
    resetFilters() {
      this.query = "";
      this.clearTags();
    },
  },
};
</script>

<style scoped>
.projects-page {
  min-height: 100vh;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.header h1 {
  margin: 0;
  font-size: 2rem;
}
.subtitle {
  color: #666;
  margin: 4px 0 0;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.search {
  width: 100%;
  max-width: 560px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  outline: none;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag {
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
}
.tag.active {
  background: #4a9eff;
  color: #fff;
  border-color: #4a9eff;
}
.tag.clear {
  background: #f7f7f7;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cover img {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
}
.title {
  margin: 0;
  font-size: 1.1rem;
}
.desc {
  color: #555;
  margin: 0;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pill {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f2f4f7;
  color: #555;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.btn {
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-decoration: none;
  color: #222;
  font-size: 14px;
}
.btn.primary {
  background: #4a9eff;
  border-color: #4a9eff;
  color: #fff;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .projects-page {
    padding: 16px;
  }
  .header h1 {
    font-size: 1.6rem;
  }
  .subtitle {
    font-size: 0.95rem;
  }
}
@media (max-width: 480px) {
  .projects-page {
    padding: 12px;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
