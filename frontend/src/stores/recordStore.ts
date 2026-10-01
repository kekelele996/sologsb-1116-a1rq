import { createStore } from 'zustand/vanilla'
import type { FungusRecord } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'
import { pickCollectorPatch } from '@/utils/sides'
import { withRetry } from '@/utils/async'

export interface RecordState {
  records: FungusRecord[]
  loaded: boolean
  hydrate: () => Promise<void>
  save: (record: FungusRecord) => Promise<void>
  /** 采集侧保存：只落形态特征与采集信息，字段级合并；失败按本侧重试，复核侧保留 */
  saveCollectorSide: (recordId: string, patch: Partial<FungusRecord>) => Promise<void>
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
    await syncPut<FungusRecord>(db.records, { ...record, side: record.side ?? 'collector' })
    await get().hydrate()
  },
  saveCollectorSide: async (recordId, patch) => {
    const safe = pickCollectorPatch(patch)
    await withRetry(async () => {
      const current = await db.records.get(recordId)
      if (!current) throw new Error('记录不存在或已被删除')
      // 只合并采集侧字段；复核侧数据（结论/状态在 identifies 表）原样保留，不越界
      const next: FungusRecord = { ...current, ...safe, side: 'collector' }
      await db.records.put(next)
    })
    await get().hydrate()
  },
  remove: async (id) => {
    await syncDelete<FungusRecord>(db.records, id)
    await get().hydrate()
  }
}))
