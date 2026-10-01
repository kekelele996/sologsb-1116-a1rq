<script setup lang="ts">
import type { TraitsDraft } from '@/types'
import {
  CAP_MARGINS,
  CAP_SHAPES,
  CAP_TEXTURES,
  FLESH_REACTIONS,
  GILL_ATTACHMENTS,
  GILL_DENSITIES,
  RING_TYPES,
  VOLVA_TYPES
} from '@/types'

const props = defineProps<{
  modelValue: TraitsDraft
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: TraitsDraft): void
}>()

function patch(next: Partial<TraitsDraft>): void {
  emit('update:modelValue', { ...props.modelValue, ...next })
}
</script>

<template>
  <el-form label-width="110px" @submit.prevent>
    <el-divider content-position="left">菌盖</el-divider>
    <el-row :gutter="12">
      <el-col :span="6">
        <el-form-item label="直径(cm)">
          <el-input-number
            :model-value="modelValue.capDiameter"
            :min="0"
            :step="0.5"
            :controls="false"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: number | undefined) => patch({ capDiameter: Number(value ?? 0) })"
          />
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="形状">
          <el-select
            :model-value="modelValue.capShape"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: TraitsDraft['capShape']) => patch({ capShape: value })"
          >
            <el-option v-for="item in CAP_SHAPES" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="边缘">
          <el-select
            :model-value="modelValue.capMargin"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: TraitsDraft['capMargin']) => patch({ capMargin: value })"
          >
            <el-option v-for="item in CAP_MARGINS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="表面质地">
          <el-select
            :model-value="modelValue.capTexture"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: TraitsDraft['capTexture']) => patch({ capTexture: value })"
          >
            <el-option v-for="item in CAP_TEXTURES" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </el-col>
    </el-row>
    <el-divider content-position="left">菌肉 / 菌褶菌管</el-divider>
    <el-row :gutter="12">
      <el-col :span="6">
        <el-form-item label="菌肉厚(cm)">
          <el-input-number
            :model-value="modelValue.fleshThickness"
            :min="0"
            :step="0.1"
            :controls="false"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: number | undefined) => patch({ fleshThickness: Number(value ?? 0) })"
          />
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="变色反应">
          <el-select
            :model-value="modelValue.fleshReaction"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: TraitsDraft['fleshReaction']) => patch({ fleshReaction: value })"
          >
            <el-option v-for="item in FLESH_REACTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="着生方式">
          <el-select
            :model-value="modelValue.attachment"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: TraitsDraft['attachment']) => patch({ attachment: value })"
          >
            <el-option v-for="item in GILL_ATTACHMENTS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="菌褶密度">
          <el-select
            :model-value="modelValue.gillDensity"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: TraitsDraft['gillDensity']) => patch({ gillDensity: value })"
          >
            <el-option v-for="item in GILL_DENSITIES" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </el-col>
    </el-row>
    <el-divider content-position="left">菌柄 / 菌环菌托</el-divider>
    <el-row :gutter="12">
      <el-col :span="6">
        <el-form-item label="柄长(cm)">
          <el-input-number
            :model-value="modelValue.stipeLength"
            :min="0"
            :step="0.5"
            :controls="false"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: number | undefined) => patch({ stipeLength: Number(value ?? 0) })"
          />
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="柄径(cm)">
          <el-input-number
            :model-value="modelValue.stipeDiameter"
            :min="0"
            :step="0.1"
            :controls="false"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: number | undefined) => patch({ stipeDiameter: Number(value ?? 0) })"
          />
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="菌环">
          <el-select
            :model-value="modelValue.ring"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: TraitsDraft['ring']) => patch({ ring: value })"
          >
            <el-option v-for="item in RING_TYPES" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="6">
        <el-form-item label="菌托">
          <el-select
            :model-value="modelValue.volva"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: TraitsDraft['volva']) => patch({ volva: value })"
          >
            <el-option v-for="item in VOLVA_TYPES" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </el-col>
    </el-row>
    <el-divider content-position="left">气味与生境</el-divider>
    <el-row :gutter="12">
      <el-col :span="8">
        <el-form-item label="气味">
          <el-input
            :model-value="modelValue.odor"
            :disabled="disabled"
            placeholder="如 淡淡坚果味"
            @update:model-value="(value: string) => patch({ odor: value })"
          />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="关联树种">
          <el-input
            :model-value="modelValue.hostTree"
            :disabled="disabled"
            placeholder="如 辽东栎"
            @update:model-value="(value: string) => patch({ hostTree: value })"
          />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="子实体数量">
          <el-input-number
            :model-value="modelValue.fruitBodyCount"
            :min="1"
            :controls="false"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="(value: number | undefined) => patch({ fruitBodyCount: Number(value ?? 1) })"
          />
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>
