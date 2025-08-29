
<template>
  <div class="agent-layout">
    <!-- 左侧板块：侧边栏+提示词输入框 -->
    <div class="left-panel">
      <div class="sidebar" :class="{ open: sidebarOpen }">
        <button class="toggle-btn" @click="toggleSidebar">
          {{ sidebarOpen ? '收起工具栏' : '展开工具栏' }}
        </button>
        <div v-if="sidebarOpen" class="tool-manager">
          <h3>工具管理</h3>
          <ul>
            <li v-for="tool in tools" :key="tool.id">
              {{ tool.name }}
              <button @click="removeTool(tool.id)" class="btn small">删除</button>
            </li>
          </ul>
          <input v-model="newToolName" placeholder="新工具名称" />
          <button @click="addTool" class="btn small">添加工具</button>
        </div>
      </div>
      <div class="prompt-input">
        <h2>Agent 提示词</h2>
        <textarea v-model="prompt" placeholder="请输入Agent提示词..." class="command-input"></textarea>
        <button @click="sendPrompt" class="btn primary">发送提示词</button>
      </div>
    </div>
    <!-- 右侧板块：用户需求区 -->
    <div class="right-panel">
      <h2>用户需求</h2>
      <div class="user-needs">
        <textarea v-model="userNeed" placeholder="请输入用户需求..." class="command-input"></textarea>
        <button @click="sendUserNeed" class="btn">提交需求</button>
        <div v-if="userNeedResult" class="response-content">
          <h3>需求结果：</h3>
          <pre>{{ userNeedResult }}</pre>
        </div>
      </div>
    </div>
  </div>
  <!-- 错误提示 -->
  <div v-if="error" class="error-toast" @click="clearError">
    <span>{{ error }}</span>
    <button class="close-btn">×</button>
  </div>
</template>


<script>
export default {
  name: 'Agent',
  data() {
    return {
      sidebarOpen: false,
      tools: [
        { id: 1, name: '工具A' },
        { id: 2, name: '工具B' }
      ],
      newToolName: '',
      prompt: '',
      userNeed: '',
      userNeedResult: '',
      error: null
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },
    addTool() {
      if (!this.newToolName.trim()) {
        this.error = '工具名称不能为空';
        return;
      }
      this.tools.push({ id: Date.now(), name: this.newToolName.trim() });
      this.newToolName = '';
    },
    removeTool(id) {
      this.tools = this.tools.filter(tool => tool.id !== id);
    },
    sendPrompt() {
      if (!this.prompt.trim()) {
        this.error = '请输入Agent提示词';
        return;
      }
      // 这里可以添加发送提示词的逻辑
      this.error = null;
      alert('已发送提示词：' + this.prompt);
    },
    sendUserNeed() {
      if (!this.userNeed.trim()) {
        this.error = '请输入用户需求';
        return;
      }
      // 这里可以添加处理用户需求的逻辑
      this.error = null;
      this.userNeedResult = '已提交需求：' + this.userNeed;
    },
    clearError() {
      this.error = null;
    }
  }
}
</script>


<style scoped>
.agent-layout {
  display: flex;
  min-height: 100vh;
  background: #f3f4f6;
}
.left-panel {
  width: 400px;
  min-width: 320px;
  background: #fff;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  box-shadow: 2px 0 8px rgba(0,0,0,0.04);
}
.sidebar {
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem;
  transition: width 0.3s;
}
.sidebar {
  width: 60px;
  overflow: hidden;
}
.sidebar.open {
  width: 220px;
  overflow: visible;
}
.toggle-btn {
  width: 100%;
  margin-bottom: 1rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
}
.tool-manager {
  margin-top: 0.5rem;
}
.tool-manager ul {
  list-style: none;
  padding: 0;
  margin: 0 0 0.5rem 0;
}
.tool-manager li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0;
}
.prompt-input {
  flex: 1;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.prompt-input h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  color: #1f2937;
}
.right-panel {
  flex: 1;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
}
.right-panel h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: #1f2937;
}
.user-needs {
  background: #fff;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.command-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
  resize: vertical;
  min-height: 80px;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #fff;
  color: #374151;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn.primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}
.btn.small {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
}
.response-content {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
  color: #1f2937;
}
.error-toast {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: #dc2626;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  z-index: 50;
  cursor: pointer;
  max-width: 400px;
}
.close-btn {
  background: none;
  border: none;
  color: #dc2626;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
@media (max-width: 1024px) {
  .agent-layout {
    flex-direction: column;
  }
  .left-panel {
    width: 100%;
    min-width: unset;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: none;
  }
  .right-panel {
    padding: 1rem;
  }
}
</style>
