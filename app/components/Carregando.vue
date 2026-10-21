<script setup lang="ts">
/** Aviso de que o portal está buscando informações: roda sozinho, sem a pessoa precisar fazer nada. */
withDefaults(defineProps<{ texto?: string, apoio?: string }>(), { texto: 'Buscando as suas informações…', apoio: 'Pode levar alguns segundos.' })
</script>

<template>
  <div role="status" aria-live="polite" class="flex flex-col items-center gap-3 rounded-[22px] bg-white px-6 py-8 text-center shadow-cartao">
    <span class="size-12 animate-spin rounded-full border-4 border-roxo-claro border-t-roxo motion-reduce:animate-none" aria-hidden="true" />
    <p class="m-0 text-xl font-bold">{{ texto }}</p>
    <p v-if="apoio" class="m-0 text-base text-apoio">{{ apoio }}</p>
  </div>
</template>
