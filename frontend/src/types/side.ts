/** 数据归属侧：采集人 / 复核人各管各的 */
export const DATA_SIDES = ['collect', 'review'] as const
export type DataSide = (typeof DATA_SIDES)[number]

/** 采集侧标识 */
export const SIDE_COLLECT: DataSide = 'collect'
/** 复核侧标识 */
export const SIDE_REVIEW: DataSide = 'review'
