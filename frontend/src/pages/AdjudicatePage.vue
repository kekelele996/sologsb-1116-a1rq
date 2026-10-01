<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { IdentifyLog, ReviewStatus } from '@/types'
import { useStore } from '@/hooks/usePersistentStore'
import { recordStore } from '@/stores/recordStore'
import { sporeStore } from '@/stores/sporeStore'
import { identifyStore } from '@/stores/identifyStore'
import { evaluateReview } from '@/utils/sides'

const router = useRouter()
const recordState = useStore(recordStore)
const sporeState = useStore(sporeStore)
const identifyState = useStore(identifyStore)

type Filter = '全部' | '待重新确认' | '未复核' | '已确认' | '已锁定'
const filters: Filter[] = ['待重新确认', '未复核', '已锁定', '已确认', '全部']
const activeFilter = ref<Filter>('待重新确认')

const sporeOf = (recordId: string) => sporeState.spores.find((item) => item.recordId === recordId) ?? null
const logOf = (recordId: string): IdentifyLog | null =>
  identifyState.logs.find((item) => item.recordId === recordId) ?? null

interface AdjudicateRow {
  recordId: string
  code: string
  tempName: string
  log: IdentifyLog
  status: ReviewStatus | '无结论'
  stale: boolean
  locked: boolean
  reason: string
  basis: IdentifyLog['basis'] | null
}

/** 所有有结论的条目，按采集编号排序；两侧对不上的排在前面 */
const rows = computed<AdjudicateRow[]>(() => {
  return recordState.records
    .map((record) => {
      const log = logOf(record.id)
      if (!log) return null
      const evaluation = evaluateReview(record, sporeOf(record.id), log)
      return {
        recordId: record.id,
        code: record.code,
        tempName: record.tempName,
        log,
        status: evaluation.status,
        stale: evaluation.stale,
        locked: evaluation.locked,
        reason: evaluation.reason,
        basis: evaluation.basis
      }
    })
    .filter((item): item is AdjudicateRow => item !== null)
    .sort((a, b) => {
      if (a.stale !== b.stale) return a.stale ? -1 : 1
      return a.code.localeCompare(b.code, 'zh-Hans-CN')
    })
})

const filtered = computed(() => {
  if (activeFilter.value === '全部') return rows.value
  if (activeFilter.value === '已锁定') return rows.value.filter((item) => item.locked)
  return rows.value.filter((item) => item.status === activeFilter.value)
})

const staleCount = computed(() => rows.value.filter((item) => item.stale).length)

async function confirm(row: AdjudicateRow): Promise<void> {
  await identifyStore.getState().confirm(row.log.id)
  ElMessage.success(`${row.code} 结论已确认，依据快照已刷新`)
}

async function sendBack(row: AdjudicateRow): Promise<void> {
  await identifyStore.getState().sendBack(row.log.id)
  ElMessage.info(`${row.code} 已送回重新鉴定，原结论保留为历史留痕`)
}

function statusTagType(status: ReviewStatus | '无结论'): 'info' | 'success' | 'danger' | 'warning' {
  if (status === '已确认') return 'success'
  if (status === '待重新确认') return 'danger'
  if (status === '未复核') return 'warning'
  return 'info'
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">结论裁定</h2>
        <p class="page-sub">
          两侧对不上的条目按采集编号摆出，等人裁定：确认结论仍有效（按依据刷新快照）或送回重新鉴定。
          结论按依据认范围——形态特征看形态、孢子印看孢子印、显微观察两边不动。
        </p>
      </div>
      <el-tag v-if="staleCount > 0" type="danger" effect="dark">待重新确认 {{ staleCount }} 条</el-tag>
    </div>

    <el-card shadow="never" class="block">
      <template #header>
        <div class="block-head">
          <span>裁定清单（{{ filtered.length }} / {{ rows.length }}）</span>
          <el-radio-group v-model="activeFilter" size="small">
            <el-radio-button v-for="item in filters" :key="item" :value="item">{{ item }}</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <el-table :data="filtered" border stripe>
        <el-table-column label="采集编号" width="160">
          <template #default="{ row }: { row: AdjudicateRow }">
            <span class="mono">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column label="暂定名" min-width="160">
          <template #default="{ row }: { row: AdjudicateRow }">
            {{ row.tempName || '未命名条目' }}
          </template>
        </el-table-column>
        <el-table-column label="结论学名" min-width="160">
          <template #default="{ row }: { row: AdjudicateRow }">
            {{ row.log.conclusion }}
          </template>
        </el-table-column>
        <el-table-column label="依据" width="110">
          <template #default="{ row }: { row: AdjudicateRow }">
            <span>{{ row.basis ?? '—' }}</span>
            <el-tag v-if="row.locked" size="small" type="info" effect="plain" class="lock-tag">锁定</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }: { row: AdjudicateRow }">
            <el-tag :type="statusTagType(row.status)" size="small" effect="dark">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="变动说明" min-width="220" />
        <el-table-column label="操作" width="240">
          <template #default="{ row }: { row: AdjudicateRow }">
            <template v-if="row.locked">
              <span class="muted">显微观察，两边不动</span>
            </template>
            <template v-else>
              <el-button size="small" type="primary" :disabled="!row.stale && row.status === '已确认'" @click="confirm(row)">
                {{ row.stale ? '确认仍有效' : '确认已复核' }}
              </el-button>
              <el-button size="small" @click="sendBack(row)">送回重鉴定</el-button>
              <el-button size="small" text @click="router.push(`/atlas/${row.recordId}`)">详情</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="filtered.length === 0" description="当前筛选下没有需要裁定的条目" />
    </el-card>
  </div>
</template>

<style scoped>
.block {
  border-radius: 12px;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.lock-tag {
  margin-left: 4px;
}
</style>
