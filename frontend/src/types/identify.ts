/** 鉴定依据 */
export const ID_BASES = ['形态特征', '孢子印', '显微观察'] as const
export type IdBasis = (typeof ID_BASES)[number]

/** 置信度 */
export const ID_CONFIDENCES = ['高', '中', '低'] as const
export type IdConfidence = (typeof ID_CONFIDENCES)[number]

/** 复核状态：未复核 / 已确认 / 待重新确认（两侧对不上，等人裁定） */
export const REVIEW_STATUSES = ['未复核', '已确认', '待重新确认'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

/** IdentifyLog 鉴定结论（复核侧：结论与复核状态） */
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
  /** 复核状态：未复核 / 已确认 / 待重新确认 */
  reviewStatus: ReviewStatus
  /**
   * 结论依据快照（按依据认范围）：
   * 形态特征→形态指纹；孢子印→孢子印指纹；显微观察→''（锁定，两边不动）
   */
  basisSnapshot: string
  /** 最近一次确认日期 */
  confirmedDate?: string
}
