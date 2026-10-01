import type { FungusRecord, IdentifyLog, ReviewState, SporePrint } from '@/types'
import { SIDE_COLLECT, SIDE_REVIEW, type DataSide } from '@/types'

/* ---------------- 依据范围签名 ---------------- */

/** 形态特征中影响鉴定口径的字段（采集侧管理，复核结论按此认范围） */
export const MORPH_SIGNATURE_KEYS = [
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
  'volva'
] as const

/** 孢子印观察中影响鉴定口径的字段 */
export const SPORE_SIGNATURE_KEYS = ['color', 'shape', 'hours', 'moisture'] as const

function stableSignature(pick: Record<string, unknown>): string {
  return JSON.stringify(pick)
}

/** 形态特征签名：只看形态字段，气味 / 树种 / 备注等不影响形态依据结论 */
export function morphSignature(record: Pick<FungusRecord, (typeof MORPH_SIGNATURE_KEYS)[number]>): string {
  const pick = Object.fromEntries(MORPH_SIGNATURE_KEYS.map((key) => [key, record[key]]))
  return stableSignature(pick)
}

/** 孢子印签名 */
export function sporeSignature(spore: Pick<SporePrint, (typeof SPORE_SIGNATURE_KEYS)[number]>): string {
  const pick = Object.fromEntries(SPORE_SIGNATURE_KEYS.map((key) => [key, spore[key]]))
  return stableSignature(pick)
}

/* ---------------- 归属与写入隔离 ---------------- */

/** 归属不匹配：表示一侧试图改动另一侧的数据 */
export class SideMismatchError extends Error {
  constructor(
    readonly expected: DataSide,
    readonly actual: DataSide | undefined
  ) {
    super(`数据归属${actual ? `「${actual}」` : '缺失'}，不能由「${expected}」侧改动`)
    this.name = 'SideMismatchError'
  }
}

/**
 * 落本侧写入：先校验输入自带归属（跨侧拒绝），通过后再补齐为本侧归属。
 * 采集侧保存只动采集侧行、复核侧保存只动复核侧行；默认归属不会被外部输入污染。
 */
export function assertSide<T extends object>(
  row: T & { ownerSide?: DataSide },
  expected: DataSide
): T & { ownerSide: DataSide } {
  if (row.ownerSide && row.ownerSide !== expected) {
    throw new SideMismatchError(expected, row.ownerSide)
  }
  return { ...row, ownerSide: expected }
}

/* ---------------- 依据认范围：复核状态判定 ---------------- */

export interface ReviewStatus {
  /** 总体状态：待复核 / 已确认 / 需重新确认 */
  state: ReviewState
  /** 触发重认的来源说明（形态改动 / 孢子印改动） */
  reason: string
}

/**
 * 按依据认范围：
 * - 形态特征：形态签名变了才需重新确认；
 * - 孢子印：只看孢子印签名变没变；
 * - 显微观察：两边都不动，永不失效。
 * 快照缺失（老数据未补）时按「基线即当前」处理，不凭空挂失效。
 */
export function reviewStatusOf(
  log: IdentifyLog,
  record: FungusRecord | undefined,
  spore: SporePrint | undefined
): ReviewStatus {
  if (log.needReview) return { state: 'pending', reason: '' }
  if (log.basis === '显微观察') {
    return { state: 'confirmed', reason: '' }
  }
  if (log.basis === '形态特征') {
    if (record && log.morphSnapshot && morphSignature(record) !== log.morphSnapshot) {
      return { state: 'reconfirm', reason: '形态特征已改动，需复核人重新确认' }
    }
    return { state: 'confirmed', reason: '' }
  }
  // 孢子印：只看孢子印有没有变
  if (spore && log.sporeSnapshot && sporeSignature(spore) !== log.sporeSnapshot) {
    return { state: 'reconfirm', reason: '孢子印观察已改动，需复核人重新确认' }
  }
  return { state: 'confirmed', reason: '' }
}

/* ---------------- 采集侧保存重试 ---------------- */

/**
 * 采集侧保存失败后按本侧重试：只重试本侧动作，不触碰复核侧。
 * 指数退避；仍失败则把错误抛给调用方保留草稿。
 */
export async function withCollectRetry<T>(action: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      // 归属错误属于程序问题，重试无意义，直接抛出
      if (error instanceof SideMismatchError) throw error
      lastError = error
      if (attempt < retries) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 200 * 2 ** attempt))
      }
    }
  }
  throw lastError
}

/** 采集侧标记，供界面判断归属 */
export { SIDE_COLLECT, SIDE_REVIEW }
