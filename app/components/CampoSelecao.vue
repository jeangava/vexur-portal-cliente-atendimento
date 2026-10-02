<script setup lang="ts">
import type { OpcaoSimples } from '#shared/types/portal'

/**
 * Lista de seleção nativa, grande e com rótulo visível.
 * Serve para listas que podem crescer (ex.: parentescos de cada contrato) sem poluir a tela.
 */
withDefaults(defineProps<{
  id: string
  rotulo: string
  opcoes: OpcaoSimples[]
  erro?: string
  ajuda?: string
  placeholder?: string
}>(), { erro: '', placeholder: 'Selecione' })

const valor = defineModel<string>({ default: '' })
</script>

<template>
  <div class="flex flex-col gap-2">
    <label :for="id" class="text-[17px] font-bold">{{ rotulo }} <span class="text-erro" aria-hidden="true">*</span></label>
    <div class="relative">
      <select
        :id="id" v-model="valor" required
        :aria-invalid="!!erro" :aria-describedby="erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined"
        class="h-16 w-full cursor-pointer appearance-none rounded-2xl border-2 bg-white pr-14 pl-5 text-xl font-semibold focus:border-roxo"
        :class="[erro ? 'border-erro bg-erro-claro/40' : 'border-campo', valor ? 'text-tinta' : 'text-[#8a91a8]']"
      >
        <option value="" disabled>{{ placeholder }}</option>
        <option v-for="o in opcoes" :key="o.id" :value="o.id" class="text-tinta">{{ o.rotulo }}</option>
      </select>
      <Icone nome="abrir" :tamanho="24" :espessura="2.4" class="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-roxo-icone" />
    </div>
    <MensagemErro :id="`${id}-erro`" :texto="erro" />
    <p v-if="ajuda && !erro" :id="`${id}-ajuda`" class="m-0 text-[15px] text-apoio">{{ ajuda }}</p>
  </div>
</template>
