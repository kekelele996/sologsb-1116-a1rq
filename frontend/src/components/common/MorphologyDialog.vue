<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FungusRecord } from '@/types'
import {
  CAP_MARGINS,
  CAP_SHAPES,
  CAP_TEXTURES,
  FLESH_REACTIONS,
  GILL_ATTACHMENTS,
  GILL_DENSITIES,
  RING_TYPES,
  SIDE_COLLECT,
  VOLVA_TYPES
} from '@/types'
import { recordStore } from '@/stores/recordStore'

const props = defineProps<{ modelValue: boolean; record: FungusRecord }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

const form = reactive({
  capDiameter: 5,
  capShape: '平展' as FungusRecord['capShape'],
  capMargin: '全缘' as FungusRecord['capMargin'],
  capTexture: '光滑' as FungusRecord['capTexture'],
  fleshThickness: 1,
  fleshReaction: '不变色' as FungusRecord['fleshReaction'],
  attachment: '直生' as FungusRecord['attachment'],
  gillDensity: '中等' as FungusRecord['gillDensity'],
  stipeLength: 5,
  stipeDiameter: 1,
  ring: '无菌环' as FungusRecord['ring'],
  volva: '无菌托' as FungusRecord['volva']
})

watch(
  () => [props.modelValue, props.record.id] as const,
  () => {
    if (!props.modelValue) return
    form.capDiameter = props.record.capDiameter
    form.capShape = props.record.capShape
    form.capMargin = props.record.capMargin
    form.capTexture = props.record.capTexture
    form.fleshThickness = props.record.fleshThickness
    form.fleshReaction = props.record.fleshReaction
    form.attachment = props.record.attachment
    form.gillDensity = props.record.gillDensity
    form.stipeLength = props.record.stipeLength
    form.stipeDiameter = props.record.stipeDiameter
    form.ring = props.record.ring
    form.volva = props.record.volva
  },
  { immediate: true }
)

function close(): void {
  emit('update:modelValue', false)
}

async function submit(): Promise<void> {
  try {
    // 采集侧保存：只覆盖形态字段，本侧编号 / 孢子印与复核侧结论均不受影响
    await recordStore.getState().save({
      ...props.record,
      ...form,
      capDiameter: Number(form.capDiameter) || 0,
      fleshThickness: Number(form.fleshThickness) || 0,
      stipeLength: Number(form.stipeLength) || 0,
      stipeDiameter: Number(form.stipeDiameter) || 0,
      ownerSide: SIDE_COLLECT
    })
    ElMessage.success('形态特征已更新；若复核结论依据形态特征，将提示复核人重新确认')
    emit('saved')
    close()
  } catch {
    ElMessage.error('采集侧保存失败，请稍后重试（复核侧数据不受影响）')
  }
}
</script>

<template>
  <el-dialog :model-value="modelValue" title="补录 / 修订形态特征（采集侧）" width="720px" @update:model-value="close">
    <el-form label-width="110px">
      <el-divider content-position="left">菌盖</el-divider>
      <el-row :gutter="12">
        <el-col :span="6">
          <el-form-item label="直径(cm)">
            <el-input-number v-model="form.capDiameter" :min="0" :step="0.5" :controls="false" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="形状">
            <el-select v-model="form.capShape" style="width: 100%">
              <el-option v-for="item in CAP_SHAPES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="边缘">
            <el-select v-model="form.capMargin" style="width: 100%">
              <el-option v-for="item in CAP_MARGINS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="表面质地">
            <el-select v-model="form.capTexture" style="width: 100%">
              <el-option v-for="item in CAP_TEXTURES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-divider content-position="left">菌肉 / 菌褶菌管</el-divider>
      <el-row :gutter="12">
        <el-col :span="6">
          <el-form-item label="菌肉厚(cm)">
            <el-input-number v-model="form.fleshThickness" :min="0" :step="0.1" :controls="false" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="变色反应">
            <el-select v-model="form.fleshReaction" style="width: 100%">
              <el-option v-for="item in FLESH_REACTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="着生方式">
            <el-select v-model="form.attachment" style="width: 100%">
              <el-option v-for="item in GILL_ATTACHMENTS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="菌褶密度">
            <el-select v-model="form.gillDensity" style="width: 100%">
              <el-option v-for="item in GILL_DENSITIES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-divider content-position="left">菌柄 / 菌环菌托</el-divider>
      <el-row :gutter="12">
        <el-col :span="6">
          <el-form-item label="柄长(cm)">
            <el-input-number v-model="form.stipeLength" :min="0" :step="0.5" :controls="false" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="柄径(cm)">
            <el-input-number v-model="form.stipeDiameter" :min="0" :step="0.1" :controls="false" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="菌环">
            <el-select v-model="form.ring" style="width: 100%">
              <el-option v-for="item in RING_TYPES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="菌托">
            <el-select v-model="form.volva" style="width: 100%">
              <el-option v-for="item in VOLVA_TYPES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" @click="submit">保存形态特征（失败自动重试）</el-button>
    </template>
  </el-dialog>
</template>
