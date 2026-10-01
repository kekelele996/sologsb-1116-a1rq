import type { FungusRecord, IdentifyLog, ReviewStatus, SporePrint } from '@/types'

/**
 * 两侧分治：采集侧（形态特征 + 孢子印观察）与复核侧（结论 + 复核状态）各管各的。
 * 改动只落本侧，保存时按字段归属合并，不越界写对方的数据。
 */

/** 采集侧可写的条目字段（形态特征 + 采集信息）；复核侧字段不在此列 */
export const COLLECTOR_RECORD_FIELDS = [
  'code',
  'tempName',
  'fruitBodyCount',
  'pointId',
  'capDiameter',
  'capShape',
  'capMargin',
  'capTexture',
  'fleshThickness',
  'fleshReaction',
  'attachment',
  'gillDensity',
  'stipeLength',
  'stipeDiameter',
  'ring',
  'volva',
  'odor',
  'hostTree',
  'collectDate',
  'collector',
  'note'
] as const

export type CollectorRecordField = (typeof COLLECTOR_RECORD_FIELDS)[number]

/** 从补丁中只取采集侧字段，避免把复核侧字段带进采集侧写入 */
export function pickCollectorPatch(patch: Record<string, unknown>): Partial<FungusRecord> {
  const out: Record<string, unknown> = {}
  for (const key of COLLECTOR_RECORD_FIELDS) {
    if (key in patch) out[key] = patch[key]
  }
  return out as Partial<FungusRecord>
}

/** FNV-1a 32 位哈希（稳定、轻量，用于依据快照比对） */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** 稳定序列化（按键排序），保证同内容同指纹 */
function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`
}

/** 形态特征指纹（菌盖 / 菌肉 / 菌褶菌管 / 菌柄 / 气味 / 树种 / 子实体数量） */
export function morphologyFingerprint(record: FungusRecord): string {
  return fnv1a(
    stableJson({
      capDiameter: record.capDiameter,
      capShape: record.capShape,
      capMargin: record.capMargin,
      capTexture: record.capTexture,
      fleshThickness: record.fleshThickness,
      fleshReaction: record.fleshReaction,
      attachment: record.attachment,
      gillDensity: record.gillDensity,
      stipeLength: record.stipeLength,
      stipeDiameter: record.stipeDiameter,
      ring: record.ring,
      volva: record.volva,
      odor: record.odor,
      hostTree: record.hostTree,
      fruitBodyCount: record.fruitBodyCount
    })
  )
}

/** 孢子印指纹（印色 / 印形 / 时长 / 观察日期 / 干湿度） */
export function sporeFingerprint(spore: SporePrint | null | undefined): string {
  if (!spore) return 'none'
  return fnv1a(
    stableJson({
      color: spore.color,
      shape: spore.shape,
      hours: spore.hours,
      observeDate: spore.observeDate,
      moisture: spore.moisture
    })
  )
}

/**
 * 按依据认范围，返回结论应锚定的本侧数据快照：
 * - 形态特征 → 形态指纹（形态改动后需重新确认）
 * - 孢子印   → 孢子印指纹（只看孢子印有没有变）
 * - 显微观察 → ''（锁定，两边都不动）
 */
export function basisSnapshotFor(
  basis: IdentifyLog['basis'],
  record: FungusRecord,
  spore: SporePrint | null | undefined
): string {
  switch (basis) {
    case '形态特征':
      return morphologyFingerprint(record)
    case '孢子印':
      return sporeFingerprint(spore ?? null)
    case '显微观察':
      return ''
  }
}

export interface ReviewEvaluation {
  status: ReviewStatus | '无结论'
  /** 两侧对不上，需等人裁定 */
  stale: boolean
  /** 显微观察依据锁定：两边都不动 */
  locked: boolean
  /** 变动说明 */
  reason: string
  /** 结论依据 */
  basis: IdentifyLog['basis'] | null
}

/** 评估复核侧结论与采集侧现状是否对得上（结论按依据认范围） */
export function evaluateReview(
  record: FungusRecord | null | undefined,
  spore: SporePrint | null | undefined,
  log: IdentifyLog | null | undefined
): ReviewEvaluation {
  if (!log) {
    return { status: '无结论', stale: false, locked: false, reason: '尚无鉴定结论', basis: null }
  }
  // 显微观察：两边都不动，锁定
  if (log.basis === '显微观察') {
    return {
      status: log.reviewStatus ?? '未复核',
      stale: false,
      locked: true,
      reason: '显微观察依据锁定，形态与孢子印改动均不影响，两边不动',
      basis: log.basis
    }
  }
  if (!record) {
    return { status: '待重新确认', stale: true, locked: false, reason: '条目已删除，结论无法核对', basis: log.basis }
  }
  if (log.basis === '孢子印') {
    const current = sporeFingerprint(spore ?? null)
    const stale = current !== (log.basisSnapshot ?? '')
    return {
      status: stale ? '待重新确认' : log.reviewStatus ?? '未复核',
      stale,
      locked: false,
      reason: stale ? '孢子印观察已变动，结论需重新确认' : '孢子印未变动，结论仍有效',
      basis: log.basis
    }
  }
  // 形态特征
  const current = morphologyFingerprint(record)
  const stale = current !== (log.basisSnapshot ?? '')
  return {
    status: stale ? '待重新确认' : log.reviewStatus ?? '未复核',
    stale,
    locked: false,
    reason: stale ? '形态特征已变动，结论需重新确认' : '形态特征未变动，结论仍有效',
    basis: log.basis
  }
}
