import { createStore } from 'zustand/vanilla'
import type { FungusRecord, IdentifyLog, IdentifyLogInput, SporePrint } from '@/types'
import { SIDE_REVIEW } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'
import { assertSide, morphSignature, sporeSignature } from '@/utils/side'
import { uid } from '@/utils/id'

export interface IdentifyState {
  logs: IdentifyLog[]
  loaded: boolean
  hydrate: () => Promise<void>
  /** 复核侧保存：只落鉴定表；结论快照按当前形态 / 孢子印留底 */
  save: (log: IdentifyLogInput) => Promise<IdentifyLog>
  remove: (id: string) => Promise<void>
  /** 复核人重新确认：结论本体不动，在复核侧追加一条带新快照的留痕 */
  reconfirm: (log: IdentifyLog, reviewer?: string) => Promise<IdentifyLog>
  latestOf: (recordId: string) => IdentifyLog | undefined
}

/** 取条目当前形态与最新孢子印（只读采集侧数据，不改动） */
async function resolveSnapshots(
  recordId: string
): Promise<{ record?: FungusRecord; spore?: SporePrint }> {
  const [record, spores] = await Promise.all([
    db.records.get(recordId),
    db.spores.where('recordId').equals(recordId).toArray()
  ])
  spores.sort((a, b) => b.observeDate.localeCompare(a.observeDate))
  return { record, spore: spores[0] }
}

/** 按当前条目 / 孢子印把复核入参补成完整留痕（采集侧数据不被改动，只读取签名） */
function stampLog(
  input: IdentifyLogInput,
  record: FungusRecord | undefined,
  spore: SporePrint | undefined
): IdentifyLog {
  // 先按输入自带归属校验，跨侧数据在这里被拒绝（避免被后面的默认归属洗白）
  return assertSide(
    {
      ...input,
      morphSnapshot: input.morphSnapshot ?? (record ? morphSignature(record) : ''),
      sporeSnapshot: input.sporeSnapshot ?? (spore ? sporeSignature(spore) : '')
    },
    SIDE_REVIEW
  ) as IdentifyLog
}

export const identifyStore = createStore<IdentifyState>((set, get) => ({
  logs: [],
  loaded: false,
  hydrate: async () => {
    const logs = await syncAll<IdentifyLog>(db.identifies)
    logs.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id))
    set({ logs, loaded: true })
  },
  save: async (input) => {
    const { record, spore } = await resolveSnapshots(input.recordId)
    const row = stampLog(input, record, spore)
    await syncPut<IdentifyLog>(db.identifies, row)
    await get().hydrate()
    return row
  },
  remove: async (id) => {
    await syncDelete<IdentifyLog>(db.identifies, id)
    await get().hydrate()
  },
  reconfirm: async (log, reviewer) => {
    const { record, spore } = await resolveSnapshots(log.recordId)
    // 结论本体（学名 / 依据 / 参考 / 置信度）保持不变，只把复核状态与依据快照刷新
    const row = stampLog(
      {
        ...log,
        id: uid('idf'),
        needReview: false,
        reviewer: reviewer?.trim() || log.reviewer,
        date: new Date().toISOString().slice(0, 10)
      },
      record,
      spore
    )
    await syncPut<IdentifyLog>(db.identifies, row)
    await get().hydrate()
    return row
  },
  latestOf: (recordId) => get().logs.find((item) => item.recordId === recordId)
}))
