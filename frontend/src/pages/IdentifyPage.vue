<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { IdentifyLog } from '@/types'
import {
  CAP_MARGINS,
  CAP_SHAPES,
  CAP_TEXTURES,
  FLESH_REACTIONS,
  GILL_ATTACHMENTS,
  GILL_DENSITIES,
  ID_BASES,
  ID_CONFIDENCES,
  SPORE_COLORS
} from '@/types'
import GillAttachmentTag from '@/components/common/GillAttachmentTag.vue'
import SporePrintSwatch from '@/components/common/SporePrintSwatch.vue'
import { useStore } from '@/hooks/usePersistentStore'
import { EMPTY_CRITERIA, useCandidateMatch, type MatchCriteria } from '@/hooks/useCandidateMatch'
import { recordStore } from '@/stores/recordStore'
import { sporeStore } from '@/stores/sporeStore'
import { identifyStore } from '@/stores/identifyStore'
import { pointStore } from '@/stores/pointStore'
import { reviewStatusOf } from '@/utils/side'
import { uid } from '@/utils/id'

const recordState = useStore(recordStore)
const sporeState = useStore(sporeStore)
const identifyState = useStore(identifyStore)
const pointState = useStore(pointStore)

const criteria = reactive<MatchCriteria>({ ...EMPTY_CRITERIA })
const { candidates, hasCondition } = useCandidateMatch(
  computed(() => recordState.records),
  computed(() => sporeState.spores),
  computed(() => ({ ...criteria }))
)

const activeRecordId = ref('')
const active = computed(() => recordState.records.find((item) => item.id === activeRecordId.value) ?? null)

const logForm = reactive({
  conclusion: '',
  basis: '形态特征' as IdentifyLog['basis'],
  referenceBook: '',
  referencePage: '',
  confidence: '中' as IdentifyLog['confidence'],
  needReview: true,
  reviewer: ''
})

watch(
  () => [recordState.records.length, activeRecordId.value] as const,
  () => {
    if (!activeRecordId.value && recordState.records.length > 0) {
      activeRecordId.value = recordState.records[0].id
    }
  },
  { immediate: true }
)

function pointName(pointId: string): string {
  return pointState.points.find((point) => point.id === pointId)?.name ?? '未关联采集点'
}

function resetCriteria(): void {
  Object.assign(criteria, EMPTY_CRITERIA)
}

function pickCandidate(recordId: string, conclusion: string): void {
  activeRecordId.value = recordId
  logForm.conclusion = conclusion
  ElMessage.info('已把候选条目的暂定名填入结论，请核对后保存')
}

/** 依据候选条目生成学名草稿（暂定名去掉括号说明） */
function draftConclusion(tempName: string): string {
  return tempName.replace(/[（(].*?[)）]/g, '').trim()
}

async function saveLog(): Promise<void> {
  if (!active.value) {
    ElMessage.warning('请先在候选名录中选择要落结论的条目')
    return
  }
  if (!logForm.conclusion.trim()) {
    ElMessage.warning('请填写结论学名')
    return
  }
  // 复核侧保存：只写鉴定表，依据快照由 store 按当前形态 / 孢子印留底
  const saved = await identifyStore.getState().save({
    id: uid('idf'),
    recordId: active.value.id,
    conclusion: logForm.conclusion.trim(),
    basis: logForm.basis,
    referenceBook: logForm.referenceBook.trim(),
    referencePage: logForm.referencePage.trim(),
    confidence: logForm.confidence,
    needReview: logForm.needReview,
    reviewer: logForm.reviewer.trim(),
    date: new Date().toISOString().slice(0, 10)
  })
  ElMessage.success(`${active.value.code} 已记录结论：${saved.conclusion}（${saved.confidence}）`)
  logForm.conclusion = ''
}

const latestOf = (recordId: string): IdentifyLog | undefined =>
  identifyState.logs.find((item) => item.recordId === recordId)

function latestStateOf(recordId: string): string | null {
  const log = latestOf(recordId)
  return log ? statusOf(log).state : null
}

function sporeOf(recordId: string) {
  return sporeState.spores.find((item) => item.recordId === recordId) ?? null
}

function statusOf(log: IdentifyLog) {
  return reviewStatusOf(log, recordState.records.find((item) => item.id === log.recordId), sporeOf(log.recordId) ?? undefined)
}

/**
 * 两边对不上：待复核 / 需重新确认的留痕按采集编号摆出来等人裁定。
 * 显微观察永不进队列；形态依据只看形态签名，孢子印依据只看孢子印签名。
 */
const pendingQueue = computed(() => {
  const queue = identifyState.logs
    .map((log) => ({ log, status: statusOf(log) }))
    .filter((item) => item.status.state === 'pending' || item.status.state === 'reconfirm')
    .map((item) => ({
      ...item,
      record: recordState.records.find((record) => record.id === item.log.recordId) ?? null
    }))
    .filter((item) => item.record)
  return queue.sort((a, b) => a.record!.code.localeCompare(b.record!.code, 'zh-Hans-CN'))
})

function focusRecord(recordId: string): void {
  activeRecordId.value = recordId
  ElMessage.info('已定位到该条目，可在下方更新结论')
}

/** 重新确认：结论不变，复核侧追加一条带新快照的留痕后自动出队 */
async function reconfirm(log: IdentifyLog): Promise<void> {
  const { value: reviewer } = await ElMessageBox.prompt('沿用原结论重新确认，请填写复核人', '重新确认结论', {
    confirmButtonText: '确认并留痕',
    cancelButtonText: '取消',
    inputValue: log.reviewer,
    inputPlaceholder: '如 祁野'
  })
  await identifyStore.getState().reconfirm(log, reviewer)
  ElMessage.success('已重新确认并刷新依据快照，原结论保持不变')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">鉴定工作页</h2>
        <p class="page-sub">
          左侧勾选观察到的形态特征与孢子印条件，右侧实时给出候选名录排序（着生方式与印色权重最高），确认后落鉴定结论。
        </p>
      </div>
      <el-tag type="info" effect="plain">{{ hasCondition ? '已设条件，按匹配度排序' : '未设条件，按编号排序' }}</el-tag>
    </div>

    <div class="layout">
      <el-card shadow="never" class="criteria-card">
        <template #header>
          <div class="card-head">
            <span>特征勾选</span>
            <el-button link type="primary" size="small" @click="resetCriteria">重置</el-button>
          </div>
        </template>
        <el-form label-width="88px" size="small">
          <el-form-item label="着生方式">
            <el-select v-model="criteria.attachment" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in GILL_ATTACHMENTS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="孢子印">
            <el-select v-model="criteria.sporeColor" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="color in SPORE_COLORS" :key="color" :label="color" :value="color" />
            </el-select>
          </el-form-item>
          <el-form-item label="菌盖形状">
            <el-select v-model="criteria.capShape" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in CAP_SHAPES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="菌盖边缘">
            <el-select v-model="criteria.capMargin" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in CAP_MARGINS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="表面质地">
            <el-select v-model="criteria.capTexture" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in CAP_TEXTURES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="菌褶密度">
            <el-select v-model="criteria.gillDensity" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in GILL_DENSITIES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="菌肉反应">
            <el-select v-model="criteria.fleshReaction" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in FLESH_REACTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="关联树种">
            <el-input v-model="criteria.hostTree" placeholder="如 辽东栎" clearable />
          </el-form-item>
        </el-form>
        <div class="rule">
          <p>权重：着生方式 26 · 孢子印 22 · 菌盖形状 12 · 表面质地 10 · 菌褶密度 10 · 边缘 8 · 菌肉反应 8 · 树种 4</p>
          <p>印色与着生方式不一致时，若属于该印色的先验组合仍计半分。</p>
        </div>
      </el-card>

      <div class="right">
        <el-card shadow="never" class="candidate-card">
          <template #header>候选名录（按匹配度排序，共 {{ candidates.length }} 条）</template>
          <div class="candidate-list">
            <button
              v-for="item in candidates"
              :key="item.record.id"
              type="button"
              class="candidate"
              :class="{ active: activeRecordId === item.record.id }"
              @click="activeRecordId = item.record.id"
            >
              <div class="candidate-top">
                <span class="mono">{{ item.record.code }}</span>
                <span class="cand-name">{{ item.record.tempName || '未命名条目' }}</span>
                <span class="percent">{{ item.percent }}%</span>
              </div>
              <el-progress :percentage="item.percent" :show-text="false" :stroke-width="6" />
              <div class="candidate-tags">
                <GillAttachmentTag :attachment="item.record.attachment" />
                <SporePrintSwatch :color="item.spore?.color ?? null" :caption="`${item.record.capShape} · ${item.record.gillDensity}褶`" />
              </div>
              <div class="match-line">
                <span v-if="item.matched.length" class="hit">命中：{{ item.matched.join('、') }}</span>
                <span v-if="item.missed.length" class="miss">未命中：{{ item.missed.join('、') }}</span>
              </div>
              <div class="candidate-actions">
                <el-button
                  size="small"
                  type="primary"
                  plain
                  @click.stop="pickCandidate(item.record.id, draftConclusion(item.record.tempName))"
                >
                  以该条为结论草稿
                </el-button>
                <template v-if="latestOf(item.record.id)">
                  <span class="muted">已有结论：{{ latestOf(item.record.id)?.conclusion }}</span>
                  <el-tag
                    v-if="latestStateOf(item.record.id) === 'reconfirm'"
                    size="small"
                    type="danger"
                    effect="dark"
                  >
                    需重认
                  </el-tag>
                </template>
                <span v-else class="muted">尚无结论</span>
              </div>
            </button>
            <el-empty v-if="candidates.length === 0" description="暂无条目，先去图谱总览新建" />
          </div>
        </el-card>

        <el-card shadow="never" class="queue-card">
          <template #header>
            <div class="card-head">
              <span>待裁定队列（{{ pendingQueue.length }}）· 按采集编号排列</span>
              <el-tooltip content="形态依据只盯形态改动，孢子印依据只盯孢子印改动，显微观察不入队">
                <el-tag size="small" type="info" effect="plain">认范围规则</el-tag>
              </el-tooltip>
            </div>
          </template>
          <el-table :data="pendingQueue" border size="small">
            <el-table-column label="采集编号" width="150">
              <template #default="{ row }">{{ row.record?.code }}</template>
            </el-table-column>
            <el-table-column prop="log.conclusion" label="结论" min-width="150" />
            <el-table-column prop="log.basis" label="依据" width="90" />
            <el-table-column label="状态 / 原因" min-width="200">
              <template #default="{ row }">
                <el-tag v-if="row.status.state === 'pending'" type="warning" size="small" effect="dark">待复核</el-tag>
                <el-tag v-else type="danger" size="small" effect="dark">需重新确认</el-tag>
                <span v-if="row.status.reason" class="queue-reason">{{ row.status.reason }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="170">
              <template #default="{ row }">
                <el-button size="small" @click="focusRecord(row.log.recordId)">定位条目</el-button>
                <el-button
                  v-if="row.status.state === 'reconfirm'"
                  size="small"
                  type="danger"
                  plain
                  @click="reconfirm(row.log)"
                >
                  重新确认
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="pendingQueue.length === 0" description="两侧一致，暂无待裁定条目" :image-size="70" />
        </el-card>

        <el-card shadow="never" class="log-card">
          <template #header>
            记录鉴定结论
            <span v-if="active" class="muted"> · 目标条目 {{ active.code }}（{{ pointName(active.pointId) }}）</span>
          </template>
          <el-form label-width="92px">
            <el-form-item label="结论学名" required>
              <el-input v-model="logForm.conclusion" placeholder="如 Lepista sordida" />
            </el-form-item>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="依据">
                  <el-select v-model="logForm.basis" style="width: 100%">
                    <el-option v-for="item in ID_BASES" :key="item" :label="item" :value="item" />
                  </el-select>
                </el-form-item>
              </el-col>              <el-col :span="12">
                <el-form-item label="置信度">
                  <el-select v-model="logForm.confidence" style="width: 100%">
                    <el-option v-for="item in ID_CONFIDENCES" :key="item" :label="item" :value="item" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="14">
                <el-form-item label="参考图鉴">
                  <el-input v-model="logForm.referenceBook" placeholder="如 《菌物图鉴》" />
                </el-form-item>
              </el-col>
              <el-col :span="10">
                <el-form-item label="页码">
                  <el-input v-model="logForm.referencePage" placeholder="如 P.145" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="复核人">
                  <el-input v-model="logForm.reviewer" placeholder="如 祁野" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="待复核">
                  <el-switch v-model="logForm.needReview" />
                </el-form-item>
              </el-col>
            </el-row>
            <p class="basis-hint">
              结论按依据认范围：形态特征 → 形态改动需重认；孢子印 → 只看孢子印变没变；显微观察 → 两边都不动。
            </p>
            <div class="form-actions">
              <el-button type="primary" @click="saveLog">保存鉴定结论（仅复核侧）</el-button>
            </div>
          </el-form>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}
.criteria-card {
  width: 300px;
  border-radius: 12px;
}
.right {
  flex: 1 1 520px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.candidate-card,
.queue-card,
.log-card {
  border-radius: 12px;
}
.queue-card {
  margin-top: 16px;
}
.queue-reason {
  margin-left: 8px;
  font-size: 11px;
  color: #a45b1f;
}
.basis-hint {
  margin: -4px 0 12px 92px;
  font-size: 11px;
  color: #7f8d82;
  line-height: 1.6;
}
.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 460px;
  overflow: auto;
}
.candidate {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid #e8e2d6;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.candidate.active {
  border-color: #c96f3a;
  box-shadow: 0 0 0 1px #c96f3a inset;
}
.candidate-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cand-name {
  font-size: 13px;
  font-weight: 600;
}
.percent {
  margin-left: auto;
  font-size: 13px;
  color: #c96f3a;
  font-weight: 600;
}
.candidate-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.match-line {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
}
.hit {
  color: #2f7a4d;
}
.miss {
  color: #a45b1f;
}
.candidate-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rule {
  padding: 8px 10px;
  border-radius: 8px;
  background: #f7f5f0;
  font-size: 11px;
  color: #6f7d72;
  line-height: 1.7;
}
.rule p {
  margin: 0;
}
.form-actions {
  padding-left: 92px;
}
</style>
