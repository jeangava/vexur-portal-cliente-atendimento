<script setup lang="ts">
defineProps<{ texto: string, id?: string }>()
</script>

<template>
  <div v-if="texto" :id="id" role="alert" class="flex items-start gap-2 text-base font-semibold text-erro">
    <Icone nome="alerta" :tamanho="22" :espessura="2.2" class="mt-px" />
    <span>{{ texto }}</span>
  </div>
</template>
