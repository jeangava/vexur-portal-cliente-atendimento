<script setup lang="ts">
/**
 * Ao trocar de tela, se a busca demorar mais que um instante, avisa que está carregando.
 * Telas rápidas não piscam nada; as lentas deixam de parecer travadas.
 */
const { isLoading } = useLoadingIndicator()
const visivel = ref(false)
let espera: ReturnType<typeof setTimeout> | undefined

watch(isLoading, (carregando) => {
  clearTimeout(espera)
  if (carregando) espera = setTimeout(() => { visivel.value = true }, 350)
  else visivel.value = false
}, { immediate: true })

onBeforeUnmount(() => clearTimeout(espera))
</script>

<template>
  <Transition name="aviso-carregando">
    <div v-if="visivel" class="pointer-events-none fixed inset-x-0 top-6 z-40 flex justify-center px-5 print:hidden">
      <div role="status" aria-live="polite" class="flex items-center gap-3 rounded-2xl bg-tinta px-5 py-3.5 text-base font-semibold text-white shadow-[0_10px_30px_#1d294840]">
        <span class="size-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true" />
        Buscando as informações…
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.aviso-carregando-enter-active, .aviso-carregando-leave-active { transition: opacity .2s; }
.aviso-carregando-enter-from, .aviso-carregando-leave-to { opacity: 0; }
</style>
