import assert from 'node:assert/strict'
import type { FungusRecord, IdentifyLog, SporePrint } from '../src/types'
import {
  SideMismatchError,
  assertSide,
  morphSignature,
  reviewStatusOf,
  sporeSignature,
  withCollectRetry
} from '../src/utils/side'
import { SIDE_COLLECT, SIDE_REVIEW } from '../src/types'

const recordBase = {
  capDiameter: 9.5,
  capShape: '半球形',
  capMargin: '全缘',
  capTexture: '绒状',
  fleshThickness: 2.1,
  fleshReaction: '缓慢变蓝',
  attachment: '直生',
  gillDensity: '中等',
  stipeLength: 7.4,
  stipeDiameter: 2.2,
  ring: '膜质菌环',
  volva: '无菌托'
} as FungusRecord

const sporeBase = { color: '淡黄', shape: '圆形印痕', hours: 12, moisture: '偏干' } as SporePrint

function log(partial: Partial<IdentifyLog>): IdentifyLog {
  return {
    id: 'idf_x',
    recordId: 'rec_1',
    conclusion: 'Boletus sp.',
    basis: '形态特征',
    referenceBook: '',
    referencePage: '',
    confidence: '中',
    needReview: false,
    reviewer: '祁野',
    date: '2026-10-01',
    ownerSide: SIDE_REVIEW,
    morphSnapshot: morphSignature(recordBase),
    sporeSnapshot: sporeSignature(sporeBase),
    ...partial
  }
}

/* 1. 签名稳定与可检测 */
assert.equal(morphSignature(recordBase), morphSignature({ ...recordBase }), '形态签名应稳定')
assert.notEqual(
  morphSignature(recordBase),
  morphSignature({ ...recordBase, attachment: '离生' }),
  '形态改动应改变签名'
)
assert.notEqual(
  sporeSignature(sporeBase),
  sporeSignature({ ...sporeBase, color: '紫褐' }),
  '孢子印改动应改变签名'
)

/* 2. 形态依据：形态变了才重认；改孢子印不动它 */
assert.equal(reviewStatusOf(log({}), recordBase, sporeBase).state, 'confirmed')
assert.equal(
  reviewStatusOf(log({}), { ...recordBase, capShape: '平展' }, sporeBase).state,
  'reconfirm',
  '形态特征改动后应需重新确认'
)
assert.equal(
  reviewStatusOf(log({}), recordBase, { ...sporeBase, color: '紫褐' }).state,
  'confirmed',
  '形态依据结论不看孢子印变化'
)

/* 3. 孢子印依据：只看孢子印变没变，形态改了不重认 */
const sporeLog = log({ basis: '孢子印' })
assert.equal(reviewStatusOf(sporeLog, recordBase, sporeBase).state, 'confirmed')
assert.equal(
  reviewStatusOf(sporeLog, { ...recordBase, capShape: '钟形' }, sporeBase).state,
  'confirmed',
  '孢子印依据不看形态变化'
)
assert.equal(
  reviewStatusOf(sporeLog, recordBase, { ...sporeBase, hours: 24 }).state,
  'reconfirm',
  '孢子印变了应需重认'
)

/* 4. 显微观察：两边都不动 */
const microLog = log({ basis: '显微观察' })
assert.equal(
  reviewStatusOf(microLog, { ...recordBase, attachment: '延生' }, { ...sporeBase, color: '黑褐' }).state,
  'confirmed',
  '显微观察永不失效'
)

/* 5. 待复核优先；快照缺失（老数据）不凭空挂失效 */
assert.equal(reviewStatusOf(log({ needReview: true }), { ...recordBase, capShape: '钟形' }, sporeBase).state, 'pending')
assert.equal(
  reviewStatusOf(log({ morphSnapshot: '' }), { ...recordBase, capShape: '钟形' }, sporeBase).state,
  'confirmed',
  '老数据空快照按基线即当前处理'
)

/* 6. 归属隔离：补归属 + 跨侧拒绝 */
const stamped = assertSide({ id: 'a' }, SIDE_COLLECT)
assert.equal(stamped.ownerSide, 'collect')
assert.throws(
  () => assertSide({ id: 'a', ownerSide: SIDE_REVIEW }, SIDE_COLLECT),
  SideMismatchError,
  '采集侧不能改复核侧数据'
)
assert.throws(
  () => assertSide({ id: 'a', ownerSide: SIDE_COLLECT }, SIDE_REVIEW),
  SideMismatchError,
  '复核侧不能改采集侧数据'
)

/* 7. 采集侧重试：瞬时失败重试后成功；归属错误不重试直接抛 */
let attempts = 0
const recovered = await withCollectRetry(async () => {
  attempts += 1
  if (attempts < 3) throw new Error('transient')
  return 'ok'
}, 3)
assert.equal(recovered, 'ok')
assert.equal(attempts, 3)

await assert.rejects(
  withCollectRetry(
    async () => {
      throw new SideMismatchError(SIDE_COLLECT, SIDE_REVIEW)
    },
    3
  ),
  SideMismatchError,
  '归属错误不应走重试'
)

await assert.rejects(
  withCollectRetry(
    async () => {
      throw new Error('disk full')
    },
    1
  ),
  /disk full/,
  '重试耗尽应抛原错误，交由界面保留草稿'
)

console.log('all side-partition invariants passed ✔')
