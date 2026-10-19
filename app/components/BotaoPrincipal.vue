<script setup lang="ts">
withDefaults(defineProps<{ carregando?: boolean, desabilitado?: boolean, variante?: 'roxo' | 'sucesso' | 'contorno', to?: string, tipo?: 'button' | 'submit' }>(), {
  carregando: false,
  desabilitado: false,
  tipo: 'button',
  variante: 'roxo',
})
const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    :type="to ? undefined : tipo"
    :disabled="carregando || desabilitado || undefined"
    :aria-busy="carregando || undefined"
    class="flex min-h-[62px] w-full items-center justify-center gap-2.5 rounded-2xl px-5 text-[20px] font-bold no-underline transition-colors disabled:cursor-wait disabled:opacity-80 disabled:data-[desabilitado=true]:cursor-not-allowed disabled:data-[desabilitado=true]:opacity-50"
    :data-desabilitado="desabilitado && !carregando ? 'true' : undefined"
    :class="{
      'bg-roxo text-white shadow-botao hover:bg-roxo-escuro': variante === 'roxo',
      'bg-ok text-white': variante === 'sucesso',
      'border-2 border-roxo-borda bg-white text-roxo-escuro hover:bg-roxo-fundo': variante === 'contorno',
    }"
  >
    <span v-if="carregando" class="size-6 animate-spin rounded-full border-[3px] border-white/40 border-t-white" aria-hidden="true" />
    <slot />
  </component>
</template>
