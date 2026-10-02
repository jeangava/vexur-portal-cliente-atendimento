<script setup lang="ts">
defineProps<{ atual: number, passos: string[] }>()
</script>

<template>
  <nav aria-label="Etapas do pedido" class="flex flex-col gap-2.5">
    <!-- Celular: texto + barra -->
    <p class="m-0 text-base font-bold text-roxo-escuro md:hidden">Etapa {{ atual }} de {{ passos.length }}: {{ passos[atual - 1] }}</p>
    <div class="grid gap-1.5 md:hidden" :style="{ gridTemplateColumns: `repeat(${passos.length}, minmax(0, 1fr))` }" aria-hidden="true">
      <span v-for="(p, i) in passos" :key="p" class="h-2 rounded-full" :class="i < atual ? 'bg-roxo' : 'bg-roxo-borda'" />
    </div>

    <!-- Tablet/notebook: círculos numerados ligados por linha -->
    <ol class="m-0 hidden list-none items-center gap-3 p-0 md:flex">
      <template v-for="(p, i) in passos" :key="p">
        <li class="flex shrink-0 items-center gap-2.5" :aria-current="i + 1 === atual ? 'step' : undefined">
          <span
            class="flex size-10 items-center justify-center rounded-full font-display text-base font-extrabold"
            :class="i + 1 < atual ? 'bg-ok text-white' : i + 1 === atual ? 'bg-roxo text-white shadow-botao' : 'bg-[#e6e7ef] text-apoio'"
          >
            <Icone v-if="i + 1 < atual" nome="certo" :tamanho="18" :espessura="3" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span class="text-[16px] font-bold" :class="i + 1 <= atual ? 'text-tinta' : 'text-apoio'">{{ p }}</span>
        </li>
        <li v-if="i < passos.length - 1" aria-hidden="true" class="h-0.5 min-w-6 grow rounded-full" :class="i + 1 < atual ? 'bg-ok' : 'bg-[#e3e4ed]'" />
      </template>
    </ol>
  </nav>
</template>
