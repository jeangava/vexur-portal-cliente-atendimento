<script setup lang="ts">
import type { SituacaoFatura } from '#shared/types/portal'

const props = defineProps<{ situacao: SituacaoFatura }>()
const visual = computed(() => VISUAL_SITUACAO[props.situacao])
</script>

<template>
  <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[15px] font-bold" :class="visual.selo">
    <Icone :nome="visual.icone" :tamanho="18" :espessura="2.4" />
    {{ visual.rotulo }}
  </span>
</template>
