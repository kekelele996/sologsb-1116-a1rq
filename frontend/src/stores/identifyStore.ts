import { createStore } from 'zustand/vanilla'
import type { IdentifyLog, ReviewStatus } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'
import { basisSnapshotFor } from '@/utils/sides'

export interface IdentifyState {
  logs: IdentifyLog[]
  loaded: boolean
  hydrate: () => Promise<void>
  save: (log: IdentifyLog) => Promise<void>
  /** 复核侧保存结论：按依据认范围锚定采集侧快照，并同步复核状态 */
  saveConclusion: (log: Omit<IdentifyLog, 'reviewStatus' | 'basisSnapshot'>) => Promise<void>
  /** 裁定：确认结论仍有效（按依据刷新快照，置为已确认） */
  confirm: (logId: string, reviewer?: string) => Promise<void>
  /** 裁定：送回重新鉴定（置为未复核，原结论保留为历史留痕） */
  sendBack: (logId: string) => Promise<void>
  remove: (id: string) => Promise<void>
  latestOf: (recordId: string) => IdentifyLog | undefined
}

function statusFromNeedReview(needReview: boolean): ReviewStatus {
  return needReview ? '未复核' : '已确认'
}

export const identifyStore = createStore<IdentifyState>((set, get) => ({
  logs: [],
  loaded: false,
  hydrate: async () => {
    const logs = await syncAll<IdentifyLog>(db.identifies)
    logs.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id))
    set({ logs, loaded: true })
  },
  save: async (log) => {
    await syncPut<IdentifyLog>(db.identifies, log)
    await get().hydrate()
  },
  saveConclusion: async (log) => {
    const record = await db.records.get(log.recordId)
    const spore = await db.spores.where('recordId').equals(log.recordId).first()
    const snapshot = record ? basisSnapshotFor(log.basis, record, spore ?? null) : ''
    const row: IdentifyLog = {
      ...log,
      basisSnapshot: snapshot,
      reviewStatus: statusFromNeedReview(log.needReview),
      confirmedDate: log.needReview ? undefined : log.date
    }
    await syncPut<IdentifyLog>(db.identifies, row)
    await get().hydrate()
  },
  confirm: async (logId, reviewer) => {
    const log = await db.identifies.get(logId)
    if (!log) return
    const record = await db.records.get(log.recordId)
    const spore = await db.spores.where('recordId').equals(log.recordId).first()
    const snapshot = record ? basisSnapshotFor(log.basis, record, spore ?? null) : log.basisSnapshot
    const today = new Date().toISOString().slice(0, 10)
    const row: IdentifyLog = {
      ...log,
      basisSnapshot: snapshot,
      reviewStatus: '已确认',
      needReview: false,
      confirmedDate: today,
      reviewer: reviewer?.trim() || log.reviewer
    }
    await syncPut<IdentifyLog>(db.identifies, row)
    await get().hydrate()
  },
  sendBack: async (logId) => {
    const log = await db.identifies.get(logId)
    if (!log) return
    const row: IdentifyLog = { ...log, reviewStatus: '未复核', needReview: true }
    await syncPut<IdentifyLog>(db.identifies, row)
    await get().hydrate()
  },
  remove: async (id) => {
    await syncDelete<IdentifyLog>(db.identifies, id)
    await get().hydrate()
  },
  latestOf: (recordId) => get().logs.find((item) => item.recordId === recordId)
}))
