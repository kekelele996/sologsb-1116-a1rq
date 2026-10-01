import { createStore } from 'zustand/vanilla'
import type { SporePrint } from '@/types'
import { SIDE_COLLECT } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'
import { assertSide, withCollectRetry } from '@/utils/side'

export interface SporeState {
  spores: SporePrint[]
  loaded: boolean
  hydrate: () => Promise<void>
  /** 采集侧保存：只落孢子印表，失败按本侧重试 */
  save: (spore: SporePrint) => Promise<void>
  remove: (id: string) => Promise<void>
  removeByRecord: (recordId: string) => Promise<void>
}

export const sporeStore = createStore<SporeState>((set, get) => ({
  spores: [],
  loaded: false,
  hydrate: async () => {
    const spores = await syncAll<SporePrint>(db.spores)
    spores.sort((a, b) => b.observeDate.localeCompare(a.observeDate))
    set({ spores, loaded: true })
  },
  save: async (spore) => {
    const row = assertSide(spore, SIDE_COLLECT)
    await withCollectRetry(() => syncPut<SporePrint>(db.spores, row))
    await get().hydrate()
  },
  remove: async (id) => {
    await withCollectRetry(() => syncDelete<SporePrint>(db.spores, id))
    await get().hydrate()
  },
  removeByRecord: async (recordId) => {
    const targets = get().spores.filter((item) => item.recordId === recordId)
    await withCollectRetry(async () => {
      await Promise.all(targets.map((item) => syncDelete<SporePrint>(db.spores, item.id)))
    })
    await get().hydrate()
  }
}))
