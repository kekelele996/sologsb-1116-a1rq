import { createStore } from 'zustand/vanilla'
import type { FungusRecord } from '@/types'
import { SIDE_COLLECT } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'
import { assertSide, withCollectRetry } from '@/utils/side'

export interface RecordState {
  records: FungusRecord[]
  loaded: boolean
  hydrate: () => Promise<void>
  /** 采集侧保存：只落采集表，失败按本侧重试；不触碰复核侧任何数据 */
  save: (record: FungusRecord) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const recordStore = createStore<RecordState>((set, get) => ({
  records: [],
  loaded: false,
  hydrate: async () => {
    const records = await syncAll<FungusRecord>(db.records)
    records.sort((a, b) => a.code.localeCompare(b.code, 'zh-Hans-CN'))
    set({ records, loaded: true })
  },
  save: async (record) => {
    const row = assertSide(record, SIDE_COLLECT)
    await withCollectRetry(() => syncPut<FungusRecord>(db.records, row))
    await get().hydrate()
  },
  remove: async (id) => {
    await withCollectRetry(() => syncDelete<FungusRecord>(db.records, id))
    await get().hydrate()
  }
}))
