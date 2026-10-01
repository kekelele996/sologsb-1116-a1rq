import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import Dexie from 'dexie'

/* ---------- 1. 造一个只到 v1 的老库（无菌肉反应字段，也没有 ownerSide / 快照） ---------- */
const DB_NAME = 'gbfungiguide'
const legacy = new Dexie(DB_NAME)
legacy.version(1).stores({
  records: 'id, code, pointId, attachment',
  spores: 'id, recordId, color',
  points: 'id, name, substrate',
  identifies: 'id, recordId, conclusion',
  meta: 'key'
})

const oldRecord = {
  id: 'rec_old',
  code: 'OLD-001',
  tempName: '老条目',
  fruitBodyCount: 1,
  pointId: 'p1',
  capDiameter: 5,
  capShape: '平展',
  capMargin: '全缘',
  capTexture: '光滑',
  fleshThickness: 1,
  // 注意：没有 fleshReaction（v1 字段），也没有 ownerSide
  attachment: '直生',
  gillDensity: '中等',
  stipeLength: 5,
  stipeDiameter: 1,
  ring: '无菌环',
  volva: '无菌托',
  odor: '',
  hostTree: '',
  collectDate: '2026-01-01',
  collector: '甲',
  note: ''
}
const oldSpore = {
  id: 'spo_old',
  recordId: 'rec_old',
  color: '白色',
  shape: '圆',
  hours: 8,
  observeDate: '2026-01-01',
  moisture: '干'
}
const oldLog = {
  id: 'idf_old',
  recordId: 'rec_old',
  conclusion: 'Agaricus sp.',
  basis: '形态特征',
  referenceBook: '',
  referencePage: '',
  confidence: '中',
  needReview: false,
  reviewer: '乙',
  date: '2026-01-02'
}
await legacy.table('points').put({
  id: 'p1',
  name: '点',
  longitude: 116,
  latitude: 40,
  altitude: 100,
  vegetation: '针阔混交林',
  substrate: '落叶层',
  companionTrees: '',
  collectDate: '2026-01-01',
  collector: '甲'
})
await legacy.table('records').put(oldRecord)
await legacy.table('spores').put(oldSpore)
await legacy.table('identifies').put(oldLog)
legacy.close()

/* ---------- 2. 用应用真实的 db（含 v3 迁移）重新打开，触发升级 ---------- */
const { db, backfillOwnership } = await import('../src/hooks/usePersistentStore')

const rec = await db.records.get('rec_old')
assert.equal(rec?.ownerSide, 'collect', '升级后条目归属采集侧')
assert.equal(rec?.fleshReaction, '不变色', 'v2 的菌肉默认值迁移仍生效')
const spo = await db.spores.get('spo_old')
assert.equal(spo?.ownerSide, 'collect', '孢子印归属采集侧')
const logRow = await db.identifies.get('idf_old')
assert.equal(logRow?.ownerSide, 'review', '鉴定留痕归属复核侧')
assert.ok(logRow?.morphSnapshot, '历史结论应回填形态快照')
assert.ok(logRow?.sporeSnapshot, '历史结论应回填孢子印快照')

/* ---------- 3. 回填是幂等的，再跑一次不变化、不报错 ---------- */
await backfillOwnership()
const logRow2 = await db.identifies.get('idf_old')
assert.equal(logRow2?.morphSnapshot, logRow?.morphSnapshot)

/* ---------- 4. 采集侧 store 写入，跨侧不互盖 + 失败不碰复核侧 ---------- */
const { recordStore } = await import('../src/stores/recordStore')
const { identifyStore } = await import('../src/stores/identifyStore')
const { morphSignature } = await import('../src/utils/side')

// 采集侧补形态（只更新采集表）
const updatedRec = { ...rec!, capShape: '钟形' }
await recordStore.getState().save(updatedRec)
const logRow3 = await db.identifies.get('idf_old')
assert.equal(logRow3?.conclusion, 'Agaricus sp.', '采集侧改形态不能盖掉复核结论')
assert.notEqual(logRow3?.morphSnapshot, morphSignature(updatedRec), '结论快照保持为旧形态（结论本体未动）')

// 复核侧若误收到采集侧归属的行，必须被拒绝
const crossSideRow = {
  ...logRow3!,
  id: 'idf_bad',
  morphSnapshot: logRow3!.morphSnapshot,
  sporeSnapshot: logRow3!.sporeSnapshot,
  ownerSide: 'collect' as const
}
await assert.rejects(
  identifyStore.getState().save(crossSideRow),
  /不能由/,
  '复核侧不能写入归属采集侧的行'
)

// 复核侧正常落新结论：读取最新形态做快照，且不修改采集表
const newRec = await db.records.get('rec_old')
const saved = await identifyStore.getState().save({
  id: 'idf_new',
  recordId: 'rec_old',
  conclusion: 'Agaricus campestris',
  basis: '形态特征',
  referenceBook: '',
  referencePage: '',
  confidence: '高',
  needReview: false,
  reviewer: '乙',
  date: '2026-10-01'
})
assert.equal(saved.morphSnapshot, morphSignature(newRec!), '新结论快照应为最新形态')
assert.equal(saved.ownerSide, 'review')
const stillRec = await db.records.get('rec_old')
assert.equal(stillRec?.capShape, '钟形', '复核侧保存不改动采集形态')

// 重新确认：结论本体不变，追加新留痕、刷新快照
const reconfirmed = await identifyStore.getState().reconfirm({ ...saved, needReview: false }, '乙')
assert.equal(reconfirmed.conclusion, saved.conclusion, '重认不改变结论本体')
assert.notEqual(reconfirmed.id, saved.id, '重认追加新留痕而非覆盖')

// 形态已改动：升级回填的老结论（基线是老形态）应挂「需重新确认」；重认后的新结论恢复
const { reviewStatusOf } = await import('../src/utils/side')
const afterMorphRec = await db.records.get('rec_old')
const afterMorphSpore = await db.spores.where('recordId').equals('rec_old').first()
const statusBefore = reviewStatusOf(logRow3!, afterMorphRec, afterMorphSpore)
assert.equal(statusBefore.state, 'reconfirm', '形态改动后，老基线结论应需重新确认')
assert.equal(reviewStatusOf(reconfirmed, afterMorphRec, afterMorphSpore).state, 'confirmed', '重认后状态恢复')

// 显微观察：形态怎么改都不失效
const micro = await identifyStore.getState().save({
  id: 'idf_micro',
  recordId: 'rec_old',
  conclusion: 'Microspora sp.',
  basis: '显微观察',
  referenceBook: '',
  referencePage: '',
  confidence: '高',
  needReview: false,
  reviewer: '乙',
  date: '2026-10-02'
})
const mutatedRec = { ...afterMorphRec!, attachment: '离生', capShape: '漏斗形' }
assert.equal(
  reviewStatusOf(micro, mutatedRec, { ...afterMorphSpore!, color: '黑褐' }).state,
  'confirmed',
  '显微观察两边都不动'
)

const allLogs = await db.identifies.toArray()
assert.ok(allLogs.some((l) => l.id === 'idf_old'), '原始留痕保留')
assert.ok(allLogs.some((l) => l.id === 'idf_new'), '新结论留痕保留')

/* ---------- 5. 待裁定队列按采集编号排序 ---------- */
await db.records.put({ ...afterMorphRec!, id: 'rec_zzz', code: 'ZZZ-999' })
await db.identifies.put({
  ...reconfirmed,
  id: 'idf_zzz',
  recordId: 'rec_zzz',
  needReview: true
})

const { recordStore: rs } = await import('../src/stores/recordStore')
const { sporeStore: ss } = await import('../src/stores/sporeStore')
await Promise.all([rs.getState().hydrate(), ss.getState().hydrate(), identifyStore.getState().hydrate()])

// 复刻鉴定页 pendingQueue 逻辑：pending/reconfirm 收集后按 code 升序
const recList = rs.getState().records
const sporeList = ss.getState().spores
const queue = identifyStore
  .getState()
  .logs.map((l) => ({
    log: l,
    status: reviewStatusOf(
      l,
      recList.find((r) => r.id === l.recordId),
      sporeList.find((s) => s.recordId === l.recordId)
    )
  }))
  .filter((x) => x.status.state === 'pending' || x.status.state === 'reconfirm')
  .map((x) => ({ ...x, record: recList.find((r) => r.id === x.log.recordId) }))
  .filter((x) => x.record)
  .sort((a, b) => a.record!.code.localeCompare(b.record!.code, 'zh-Hans-CN'))

assert.equal(queue.length, 2, '队列含一条待复核 + 一条因孢子印/形态待重认')
assert.equal(queue[0].record!.code, 'OLD-001', '队列按采集编号升序，OLD-001 在 ZZZ-999 前')
assert.equal(queue[1].record!.code, 'ZZZ-999')

console.log('db migration + two-side persistence smoke test passed ✔')
process.exit(0)
