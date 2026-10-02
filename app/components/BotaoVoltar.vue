<script setup lang="ts">
defineProps<{ to: string, rotulo?: string }>()
</script>

<template>
  <div>
    <NuxtLink
      :to="to"
      class="inline-flex min-h-12 items-center gap-1.5 rounded-[14px] bg-white py-0 pr-4 pl-2.5 text-[17px] font-bold text-tinta no-underline shadow-leve"
    >
      <Icone nome="voltar" :tamanho="22" :espessura="2.4" />
      {{ rotulo ?? 'Voltar' }}
    </NuxtLink>
  </div>
</template>
