<script setup lang="ts">
/**
 * Cartão de ação da Movimentação. Quando a regra do plano não libera, o cartão continua na tela,
 * mas apagado e sem clique, com o motivo.
 */
defineProps<{ to: string, titulo: string, apoio: string, icone: string, cor: string, desabilitado?: boolean, motivo?: string }>()
const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <component
    :is="desabilitado ? 'div' : NuxtLink"
    :to="desabilitado ? undefined : to"
    :aria-disabled="desabilitado || undefined"
    class="flex min-h-[132px] flex-col justify-between gap-3 rounded-[22px] p-5 no-underline"
    :class="desabilitado ? 'cursor-not-allowed border-2 border-dashed border-campo bg-white/60 text-apoio' : 'border-2 border-transparent bg-white text-tinta shadow-cartao transition-shadow hover:shadow-[0_10px_30px_#353d681c]'"
  >
    <span class="flex size-[58px] items-center justify-center rounded-[18px]" :class="desabilitado ? 'bg-linha text-apoio opacity-70' : cor"><Icone :nome="icone" :tamanho="30" /></span>
    <span class="flex flex-col">
      <span class="text-[20px] font-bold">{{ titulo }}<span v-if="desabilitado" class="ml-2 rounded-full bg-linha px-2.5 py-0.5 align-middle text-sm font-semibold text-apoio">Indisponível</span></span>
      <span class="text-[15px] text-apoio">{{ desabilitado ? (motivo ?? 'Não liberado para o seu plano. Fale com a gente.') : apoio }}</span>
    </span>
  </component>
</template>
