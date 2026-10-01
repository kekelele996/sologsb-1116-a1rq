import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from '@/App.vue'
import router from '@/router'
import { appStore } from '@/stores/appStore'
import '@/styles/main.css'

const app = createApp(App)

Object.entries(ElementPlusIconsVue).forEach(([key, component]) => {
  app.component(key, component)
})

app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 第一次打开先回填归属再启用：回填 / 水合完成后才挂载，避免半成品数据进入界面
void appStore
  .getState()
  .bootstrap()
  .finally(() => app.mount('#app'))
