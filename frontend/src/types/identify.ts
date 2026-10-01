import type { DataSide } from './side'

/** 鉴定依据 */
export const ID_BASES = ['形态特征', '孢子印', '显微观察'] as const
export type IdBasis = (typeof ID_BASES)[number]

/** 置信度 */
export const ID_CONFIDENCES = ['高', '中', '低'] as const
export type IdConfidence = (typeof ID_CONFIDENCES)[number]

/** 复核状态（读时派生 + 留痕字段） */
export const REVIEW_STATES = ['pending', 'confirmed', 'reconfirm'] as const
export type ReviewState = (typeof REVIEW_STATES)[number]

/** IdentifyLog 鉴定留痕（复核侧） */
export interface IdentifyLog {
  id: string
  recordId: string
  /** 结论学名 */
  conclusion: string
  basis: IdBasis
  /** 参考图鉴名称 */
  referenceBook: string
  /** 页码 */
  referencePage: string
  confidence: IdConfidence
  needReview: boolean
  reviewer: string
  date: string
  /** 归属侧：结论与复核状态由复核人维护，恒为 review */
  ownerSide: DataSide
  /**
   * 落结论时的形态特征签名。
   * 依据「形态特征」时，采集侧形态改动后签名对不上即需重新确认；
   * 历史数据回填时按当时数据补快照，不产生失效。
   */
  morphSnapshot: string
  /** 落结论时的孢子印观察签名（依据「孢子印」时使用） */
  sporeSnapshot: string
}

/** 复核侧保存结论时的入参（归属与快照由保存动作补齐） */
export type IdentifyLogInput = Omit<IdentifyLog, 'ownerSide' | 'morphSnapshot' | 'sporeSnapshot'> &
  Partial<Pick<IdentifyLog, 'morphSnapshot' | 'sporeSnapshot'>>
