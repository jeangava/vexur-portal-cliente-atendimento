<script setup lang="ts">
const { texto } = useAviso()
const route = useRoute()
const comMenu = computed(() => !route.path.startsWith('/entrar'))
</script>

<template>
  <div class="min-h-dvh bg-fundo">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <div
      role="status" aria-live="polite"
      class="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-5 print:hidden"
      :class="comMenu ? 'bottom-[104px] lg:bottom-8 lg:left-[264px]' : 'bottom-7'"
    >
      <div v-if="texto" class="max-w-[440px] rounded-2xl bg-tinta px-[18px] py-3.5 text-center text-base font-semibold text-white shadow-[0_10px_30px_#1d294840]">
        {{ texto }}
      </div>
    </div>
  </div>
</template>
