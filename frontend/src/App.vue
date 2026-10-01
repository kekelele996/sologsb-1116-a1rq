<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from '@/hooks/usePersistentStore'
import { recordStore } from '@/stores/recordStore'
import { sporeStore } from '@/stores/sporeStore'
import { pointStore } from '@/stores/pointStore'
import { identifyStore } from '@/stores/identifyStore'
import { appStore } from '@/stores/appStore'

const route = useRoute()
const recordState = useStore(recordStore)
const sporeState = useStore(sporeStore)
const pointState = useStore(pointStore)
const identifyState = useStore(identifyStore)
const appState = useStore(appStore)

const menus = [
  { path: '/atlas', label: '图谱总览', icon: 'Grid' },
  { path: '/points', label: '采集点管理', icon: 'Location' },
  { path: '/identify', label: '鉴定工作页', icon: 'Search' },
  { path: '/compare', label: '条目对比', icon: 'Files' }
]

const activeMenu = computed(() => menus.find((item) => route.path.startsWith(item.path))?.path ?? '/atlas')

const stats = computed(() => [
  { label: '条目', value: recordState.records.length },
  { label: '孢子印', value: sporeState.spores.length },
  { label: '采集点', value: pointState.points.length },
  { label: '鉴定留痕', value: identifyState.logs.length }
])
</script>

<template>
  <div v-if="!appState.ready" class="boot">
    <div class="boot-card">
      <div class="boot-logo">菌</div>
      <template v-if="appState.error">
        <h2>本地数据启用失败</h2>
        <p class="boot-error">{{ appState.error }}</p>
        <el-button type="primary" @click="appStore.getState().bootstrap()">重试启用</el-button>
      </template>
      <template v-else>
        <h2>正在回填采集 / 复核归属…</h2>
        <p class="boot-sub">已有数据第一次分边，完成后再启用，请勿关闭页面</p>
        <el-icon class="boot-spin is-loading"><Loading /></el-icon>
      </template>
    </div>
  </div>

  <el-container v-else class="shell">
    <el-aside width="232px" class="aside">
      <div class="brand">
        <div class="logo">菌</div>
        <div>
          <div class="brand-title">野生菌采集鉴定图谱</div>
          <div class="brand-sub">Fungi Collection Atlas</div>
        </div>
      </div>
      <el-menu :default-active="activeMenu" router class="menu">
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
      <div class="stat-box">
        <div v-for="item in stats" :key="item.label" class="stat-row">
          <span>{{ item.label }}</span>
          <b>{{ item.value }}</b>
        </div>
        <p class="stat-tip">数据保存在浏览器 IndexedDB，无需后端服务</p>
      </div>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="crumb">{{ (route.meta.title as string) ?? '图谱' }}</span>
        <span class="head-tip">采集侧管形态与孢子印，复核侧管结论与状态，各存各的互不覆盖</span>
      </el-header>
      <el-main class="main">
        <p class="warn-strip">
          免责声明：本工具仅用于采集记录与形态整理，内容不可作为食用依据；鉴定结论须与权威图鉴及专业人员复核。
        </p>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.boot {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f1ea;
}
.boot-card {
  width: 360px;
  padding: 32px 28px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #e8e2d6;
  text-align: center;
  box-shadow: 0 12px 32px rgba(59, 42, 29, 0.08);
}
.boot-logo {
  width: 48px;
  height: 48px;
  margin: 0 auto 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, #e0a06a, #c96f3a);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;
  color: #3b2a1d;
}
.boot-card h2 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #3b2a1d;
}
.boot-sub,
.boot-error {
  font-size: 12px;
  color: #7f8d82;
  line-height: 1.7;
  margin: 0 0 16px;
}
.boot-error {
  color: #a45b1f;
  word-break: break-all;
}
.boot-spin {
  font-size: 22px;
  color: #c96f3a;
}
.shell {
  height: 100vh;
}
.aside {
  display: flex;
  flex-direction: column;
  background: #3b2a1d;
  color: #f3e9dc;
  padding: 16px 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e0a06a, #c96f3a);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #3b2a1d;
}
.brand-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}
.brand-sub {
  font-size: 11px;
  color: #c9b6a3;
}
.menu {
  border-right: none;
  background: transparent;
}
:deep(.menu .el-menu-item) {
  color: #e6d8c7;
  border-radius: 8px;
  margin-bottom: 4px;
}
:deep(.menu .el-menu-item.is-active) {
  background: #c96f3a;
  color: #fff;
}
:deep(.menu .el-menu-item:hover) {
  background: #4d3826;
}
.stat-box {
  margin-top: auto;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  font-size: 12px;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  color: #e6d8c7;
}
.stat-tip {
  margin: 8px 0 0;
  color: #b9a591;
  line-height: 1.6;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e8e2d6;
}
.crumb {
  font-weight: 600;
}
.head-tip {
  font-size: 12px;
  color: #7f8d82;
}
.main {
  padding: 16px 20px 0;
  overflow: auto;
}
</style>
