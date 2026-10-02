<script setup lang="ts">
import type { Comunicado } from '#shared/types/portal'

const props = defineProps<{ comunicado: Comunicado }>()
const canal = computed(() => CANAL_COMUNICADO[props.comunicado.canal])
const selo = computed(() => seloDoComunicado(props.comunicado))
</script>

<template>
  <NuxtLink
    :to="`/comunicados/${comunicado.id}`"
    class="flex items-start gap-3.5 rounded-[22px] border-2 bg-white p-[18px] text-tinta no-underline shadow-cartao transition-shadow hover:shadow-[0_10px_30px_#353d681c] lg:p-5"
    :class="comunicado.vigente ? 'border-erro-borda' : 'border-transparent'"
  >
    <span
      class="flex size-12 shrink-0 items-center justify-center rounded-2xl"
      :class="comunicado.vigente ? 'bg-erro-claro text-erro' : 'bg-roxo-claro text-roxo-icone'"
    >
      <Icone :nome="comunicado.vigente ? 'alerta' : canal.icone" :tamanho="26" />
    </span>
    <span class="flex min-w-0 grow flex-col gap-1">
      <span v-if="selo" class="self-start rounded-full px-2.5 py-0.5 text-[13px] font-bold" :class="selo.classe">{{ selo.rotulo }}</span>
      <span class="text-[18px] leading-snug font-bold">{{ comunicado.titulo }}</span>
      <span class="text-[15px] text-texto">{{ comunicado.resumo }}</span>
      <span class="text-sm text-apoio">Enviado por {{ canal.nome }} em {{ formatarData(comunicado.enviadoEm) }}</span>
    </span>
    <Icone nome="avancar" :espessura="2.4" class="mt-3 text-roxo-icone" />
  </NuxtLink>
</template>
