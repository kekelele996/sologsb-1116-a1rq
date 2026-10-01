<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { CollectPoint, IdentifyLog, ReviewStatus, SporeColor, SporePrint, TraitsDraft } from '@/types'
import { SPORE_COLORS } from '@/types'
import GeoPointForm from '@/components/common/GeoPointForm.vue'
import GillAttachmentTag from '@/components/common/GillAttachmentTag.vue'
import SporePrintSwatch from '@/components/common/SporePrintSwatch.vue'
import TraitsSummary from '@/components/common/TraitsSummary.vue'
import TraitsForm from '@/components/common/TraitsForm.vue'
import { useStore } from '@/hooks/usePersistentStore'
import { recordStore } from '@/stores/recordStore'
import { sporeStore } from '@/stores/sporeStore'
import { pointStore } from '@/stores/pointStore'
import { identifyStore } from '@/stores/identifyStore'
import { sporeColorHex } from '@/utils/spore'
import { evaluateReview } from '@/utils/sides'
import { uid } from '@/utils/id'

const route = useRoute()
const router = useRouter()
const recordState = useStore(recordStore)
const sporeState = useStore(sporeStore)
const pointState = useStore(pointStore)
const identifyState = useStore(identifyStore)

const record = computed(() => recordState.records.find((item) => item.id === route.params.id) ?? null)
const spore = computed(() => sporeState.spores.find((item) => item.recordId === record.value?.id) ?? null)
const logs = computed(() => identifyState.logs.filter((item) => item.recordId === record.value?.id))
const latestLog = computed(() => logs.value[0] ?? null)
/** 复核侧结论与采集侧现状的对不上程度（按依据认范围） */
const evaluation = computed(() => evaluateReview(record.value, spore.value, latestLog.value))
/** 当前条目所属采集点名称（在脚本内取，避免模板内箭头函数丢失空值收窄） */
const recordPointName = computed(() => {
  const current = record.value
  if (!current) return '未关联'
  return pointState.points.find((item) => item.id === current.pointId)?.name ?? '未关联'
})

const sporeForm = reactive({
  id: '',
  color: '白色' as SporeColor,
  shape: '',
  hours: 12,
  observeDate: new Date().toISOString().slice(0, 10),
  moisture: ''
})

const pointDraft = reactive<CollectPoint>({
  id: '',
  name: '',
  longitude: 0,
  latitude: 0,
  altitude: 0,
  vegetation: '针阔混交林',
  substrate: '落叶层',
  companionTrees: '',
  collectDate: '',
  collector: ''
})

watch(
  () => [record.value?.id, spore.value?.id, pointState.points.length] as const,
  () => {
    if (!record.value) return
    const current = spore.value
    if (current) {
      sporeForm.id = current.id
      sporeForm.color = current.color
      sporeForm.shape = current.shape
      sporeForm.hours = current.hours
      sporeForm.observeDate = current.observeDate
      sporeForm.moisture = current.moisture
    }
    const point = pointState.points.find((item) => item.id === record.value?.pointId)
    if (point) Object.assign(pointDraft, point)
  },
  { immediate: true }
)

/* ---------- 采集侧：孢子印观察（失败按本侧重试，复核侧保留） ---------- */
const savingSpore = ref(false)
const sporeSaveError = ref(false)

async function saveSpore(): Promise<void> {
  if (!record.value) return
  sporeSaveError.value = false
  savingSpore.value = true
  try {
    const row: SporePrint = {
      id: sporeForm.id || uid('spo'),
      recordId: record.value.id,
      color: sporeForm.color,
      shape: sporeForm.shape.trim(),
      hours: Number(sporeForm.hours) || 0,
      observeDate: sporeForm.observeDate,
      moisture: sporeForm.moisture.trim()
    }
    await sporeStore.getState().save(row)
    sporeForm.id = row.id
    ElMessage.success(`孢子印观察已记录：${row.color}`)
  } catch {
    sporeSaveError.value = true
  } finally {
    savingSpore.value = false
  }
}

async function removeSpore(): Promise<void> {
  if (!sporeForm.id) return
  await sporeStore.getState().remove(sporeForm.id)
  sporeForm.id = ''
  ElMessage.success('孢子印记录已删除')
}

/* ---------- 采集侧：形态特征（字段级保存，不压复核结论） ---------- */
const traitsDialogVisible = ref(false)
const savingTraits = ref(false)
const traitsSaveError = ref(false)
const traitsDraft = reactive<TraitsDraft>({
  capDiameter: 5,
  capShape: '平展',
  capMargin: '全缘',
  capTexture: '光滑',
  fleshThickness: 1,
  fleshReaction: '不变色',
  attachment: '直生',
  gillDensity: '中等',
  stipeLength: 5,
  stipeDiameter: 1,
  ring: '无菌环',
  volva: '无菌托',
  odor: '',
  hostTree: '',
  fruitBodyCount: 1
})

function openTraitsDialog(): void {
  if (!record.value) return
  traitsSaveError.value = false
  const r = record.value
  Object.assign(traitsDraft, {
    capDiameter: r.capDiameter,
    capShape: r.capShape,
    capMargin: r.capMargin,
    capTexture: r.capTexture,
    fleshThickness: r.fleshThickness,
    fleshReaction: r.fleshReaction,
    attachment: r.attachment,
    gillDensity: r.gillDensity,
    stipeLength: r.stipeLength,
    stipeDiameter: r.stipeDiameter,
    ring: r.ring,
    volva: r.volva,
    odor: r.odor,
    hostTree: r.hostTree,
    fruitBodyCount: r.fruitBodyCount
  })
  traitsDialogVisible.value = true
}

async function saveTraits(): Promise<void> {
  if (!record.value) return
  traitsSaveError.value = false
  savingTraits.value = true
  try {
    await recordStore.getState().saveCollectorSide(record.value.id, { ...traitsDraft })
    ElMessage.success('形态特征已保存（采集侧），复核结论未受影响')
    traitsDialogVisible.value = false
  } catch {
    traitsSaveError.value = true
  } finally {
    savingTraits.value = false
  }
}

/* ---------- 采集点（采集侧） ---------- */
async function savePoint(): Promise<void> {
  if (!pointDraft.name.trim()) {
    ElMessage.warning('采集点名称不能为空')
    return
  }
  await pointStore.getState().save({ ...pointDraft })
  ElMessage.success('采集点信息已更新')
}

/* ---------- 复核侧：结论裁定 ---------- */
async function confirmConclusion(): Promise<void> {
  if (!latestLog.value) return
  await identifyStore.getState().confirm(latestLog.value.id)
  ElMessage.success('结论已确认，依据快照已按当前采集侧刷新')
}

async function sendBackConclusion(): Promise<void> {
  if (!latestLog.value) return
  await identifyStore.getState().sendBack(latestLog.value.id)
  ElMessage.info('已送回重新鉴定，原结论保留为历史留痕')
}

/** 历史留痕的复核状态标签（取结论当时的状态） */
function statusTagType(status: ReviewStatus): 'info' | 'success' | 'danger' {
  if (status === '已确认') return 'success'
  if (status === '待重新确认') return 'danger'
  return 'info'
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div v-if="record">
        <h2 class="page-title">{{ record.tempName || '未命名条目' }}</h2>
        <p class="page-sub">
          <span class="mono">{{ record.code }}</span> · 采集点
          {{ recordPointName }} · 采集日期
          {{ record.collectDate }} · 采集人 {{ record.collector || '—' }}
          <el-tag size="small" effect="plain" round class="side-tag">采集侧</el-tag>
        </p>
      </div>
      <div v-else>
        <h2 class="page-title">条目详情</h2>
        <p class="page-sub">未找到该条目，可能已被删除。</p>
      </div>
      <div class="head-actions">
        <el-button @click="router.push('/atlas')">返回图谱</el-button>
        <el-button v-if="record" @click="router.push('/identify')">去鉴定</el-button>
      </div>
    </div>

    <template v-if="record">
      <el-card shadow="never" class="block">
        <template #header>
          <div class="block-head">
            <span>形态描述（采集侧）</span>
            <div class="block-actions">
              <GillAttachmentTag :attachment="record.attachment" with-hint />
              <el-button size="small" type="primary" plain @click="openTraitsDialog">编辑形态特征</el-button>
            </div>
          </div>
        </template>
        <TraitsSummary :record="record" :spore="spore" :default-open="['cap', 'flesh', 'gill', 'stipe', 'eco']" />
        <p v-if="record.note" class="note">现场备注：{{ record.note }}</p>
      </el-card>

      <el-card shadow="never" class="block">
        <template #header>
          <div class="block-head">
            <span>孢子印观察（采集侧）</span>
            <SporePrintSwatch :color="spore?.color ?? null" size="large" :caption="spore ? `获取 ${spore.hours} h` : '尚未记录'" />
          </div>
        </template>
        <el-alert
          v-if="sporeSaveError"
          type="error"
          show-icon
          class="save-alert"
          title="孢子印保存失败，已自动重试 3 次仍未成功"
          description="复核侧结论与状态未受影响，可点击按钮按本侧重试。"
        >
          <div class="alert-actions">
            <el-button size="small" type="primary" :loading="savingSpore" @click="saveSpore">重新保存孢子印</el-button>
          </div>
        </el-alert>
        <div class="spore-body">
          <div class="spore-current" :style="{ background: spore ? sporeColorHex(spore.color) : '#f2f4f6' }">
            <div v-if="spore" class="spore-info">
              <p class="spore-color">{{ spore.color }}</p>
              <p class="spore-meta">印形：{{ spore.shape || '—' }}</p>
              <p class="spore-meta">时长：{{ spore.hours }} 小时 · 观察日期 {{ spore.observeDate }}</p>
              <p class="spore-meta">样本干湿度：{{ spore.moisture || '—' }}</p>
            </div>
            <p v-else class="spore-empty">该条目尚未登记孢子印观察</p>
          </div>
          <el-form label-width="92px" class="spore-form">
            <el-form-item label="印色">
              <el-select v-model="sporeForm.color" style="width: 100%">
                <el-option v-for="color in SPORE_COLORS" :key="color" :label="color" :value="color" />
              </el-select>
            </el-form-item>
            <el-form-item label="印形">
              <el-input v-model="sporeForm.shape" placeholder="如 圆形印痕，边缘略散" />
            </el-form-item>
            <el-form-item label="时长(h)">
              <el-input-number v-model="sporeForm.hours" :min="0" :step="1" :controls="false" style="width: 100%" />
            </el-form-item>
            <el-form-item label="观察日期">
              <el-date-picker v-model="sporeForm.observeDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="干湿度">
              <el-input v-model="sporeForm.moisture" type="textarea" :rows="2" placeholder="如 子实体偏干，印痕较薄" />
            </el-form-item>
            <div class="form-actions">
              <el-button type="primary" :loading="savingSpore" @click="saveSpore">{{ sporeForm.id ? '更新孢子印' : '登记孢子印' }}</el-button>
              <el-button v-if="sporeForm.id" type="danger" plain @click="removeSpore">删除记录</el-button>
            </div>
          </el-form>
        </div>
      </el-card>

      <el-card shadow="never" class="block">
        <template #header>采集点信息（含经纬度校验）</template>
        <GeoPointForm v-model="pointDraft" with-meta />
        <div class="form-actions">
          <el-button type="primary" @click="savePoint">保存采集点</el-button>
        </div>
      </el-card>

      <el-card shadow="never" class="block">
        <template #header>
          <div class="block-head">
            <span>鉴定留痕（复核侧 · {{ logs.length }} 条）</span>
            <el-tag size="small" effect="plain" round class="side-tag">复核侧</el-tag>
          </div>
        </template>

        <el-alert
          v-if="evaluation.locked"
          type="info"
          show-icon
          class="review-alert"
          :title="`依据「显微观察」，两边不动`"
          description="显微观察依据锁定：采集侧形态与孢子印改动均不影响该结论，复核侧也不重新锚定。"
        />
        <el-alert
          v-else-if="evaluation.stale"
          type="warning"
          show-icon
          class="review-alert"
          :title="`结论需重新确认（依据：${evaluation.basis}）`"
          :description="`${evaluation.reason}。两侧对不上，可确认结论仍有效并刷新快照，或送回重新鉴定。`"
        >
          <div class="alert-actions">
            <el-button size="small" type="primary" @click="confirmConclusion">确认结论仍有效</el-button>
            <el-button size="small" @click="sendBackConclusion">送回重新鉴定</el-button>
          </div>
        </el-alert>

        <el-table :data="logs" border stripe>
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column prop="conclusion" label="结论学名" min-width="160" />
          <el-table-column prop="basis" label="依据" width="110">
            <template #default="{ row }: { row: IdentifyLog }">
              <span>{{ row.basis }}</span>
              <el-tag v-if="row.basis === '显微观察'" size="small" type="info" effect="plain" class="lock-tag">锁定</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="参考图鉴" min-width="180">
            <template #default="{ row }: { row: IdentifyLog }">
              {{ row.referenceBook || '—' }} {{ row.referencePage }}
            </template>
          </el-table-column>
          <el-table-column prop="confidence" label="置信度" width="90" />
          <el-table-column label="复核状态" width="110">
            <template #default="{ row }: { row: IdentifyLog }">
              <el-tag :type="statusTagType(row.reviewStatus ?? '未复核')" size="small" effect="dark">
                {{ row.reviewStatus ?? '未复核' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="复核" width="110">
            <template #default="{ row }: { row: IdentifyLog }">
              <el-tag v-if="row.needReview" type="warning" size="small" effect="dark">待复核</el-tag>
              <span v-else class="muted">{{ row.reviewer || '已复核' }}</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="logs.length === 0" description="尚无鉴定结论，去「鉴定工作页」生成" />
      </el-card>
    </template>

    <el-dialog v-model="traitsDialogVisible" title="编辑形态特征（采集侧）" width="760px">
      <el-alert
        type="info"
        show-icon
        class="save-alert"
        title="采集侧保存：只落形态特征，不压复核结论"
        description="此处改动仅写入采集侧字段；复核侧的结论与复核状态原样保留，不会被盖掉。保存失败会自动重试 3 次。"
      />
      <TraitsForm v-model="traitsDraft" :disabled="savingTraits" />
      <el-alert
        v-if="traitsSaveError"
        type="error"
        show-icon
        class="save-alert"
        title="形态特征保存失败，已自动重试 3 次仍未成功"
        description="复核侧结论与状态未受影响，可点击按钮按本侧重试。"
      />
      <template #footer>
        <el-button @click="traitsDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingTraits" @click="saveTraits">保存形态特征</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.head-actions {
  display: flex;
  gap: 8px;
}
.block {
  border-radius: 12px;
  margin-bottom: 16px;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.block-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.side-tag {
  margin-left: 8px;
}
.note {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f7f5f0;
  font-size: 12px;
  color: #6f7d72;
}
.save-alert {
  margin-bottom: 12px;
}
.review-alert {
  margin-bottom: 12px;
}
.alert-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}
.lock-tag {
  margin-left: 4px;
}
.spore-body {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.spore-current {
  flex: 1 1 260px;
  min-height: 180px;
  border-radius: 12px;
  border: 1px solid #e8e2d6;
  padding: 16px;
  display: flex;
  align-items: center;
}
.spore-info p {
  margin: 2px 0;
}
.spore-color {
  font-size: 20px;
  font-weight: 700;
}
.spore-meta {
  font-size: 12px;
  color: #4b5b50;
}
.spore-empty {
  font-size: 13px;
  color: #7f8d82;
}
.spore-form {
  flex: 1 1 320px;
}
.form-actions {
  display: flex;
  gap: 8px;
  padding-left: 92px;
}
</style>
