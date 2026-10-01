import { createStore } from 'zustand/vanilla'
import {
  backfillOwnership,
  seedDemoData,
  stampDbVersion
} from '@/hooks/usePersistentStore'
import { pointStore } from './pointStore'
import { recordStore } from './recordStore'
import { sporeStore } from './sporeStore'
import { identifyStore } from './identifyStore'

export interface AppState {
  /** 归属回填与首次水合是否完成；未完成前界面不启用 */
  ready: boolean
  booting: boolean
  error: string

  bootstrap: () => Promise<void>
}

export const appStore = createStore<AppState>((set, get) => ({
  ready: false,
  booting: false,
  error: '',
  bootstrap: async () => {
    if (get().booting) return
    set({ booting: true, error: '' })
    try {
      // 已有数据没分过边：先回填归属再启用，之后再水合到各侧 store
      await seedDemoData()
      await backfillOwnership()
      await stampDbVersion()
      await pointStore.getState().hydrate()
      await recordStore.getState().hydrate()
      await sporeStore.getState().hydrate()
      await identifyStore.getState().hydrate()
      set({ ready: true, booting: false })
    } catch (error) {
      set({
        ready: false,
        booting: false,
        error: error instanceof Error ? error.message : '本地数据初始化失败'
      })
    }
  }
}))
