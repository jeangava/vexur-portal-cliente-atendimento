<script setup lang="ts">
/** Campo com rótulo sempre visível, ajuda embaixo e erro ao lado do campo. */
withDefaults(defineProps<{
  id: string
  rotulo: string
  erro?: string
  ajuda?: string
  tipo?: 'text' | 'date' | 'number'
  sufixo?: string
  placeholder?: string
  inputmode?: 'text' | 'numeric'
  max?: string
  min?: string
  maxlength?: number
}>(), { erro: '', tipo: 'text', inputmode: 'text' })

const valor = defineModel<string>({ default: '' })
</script>

<template>
  <div class="flex flex-col gap-2">
    <label :for="id" class="text-[17px] font-bold">{{ rotulo }} <span class="text-erro" aria-hidden="true">*</span></label>
    <div class="relative">
      <input
        :id="id" v-model="valor" :type="tipo" :placeholder="placeholder" :inputmode="inputmode" :max="max" :min="min" :maxlength="maxlength"
        autocomplete="off" required
        :aria-invalid="!!erro" :aria-describedby="erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined"
        class="h-16 w-full rounded-2xl border-2 bg-white px-5 text-xl font-semibold text-tinta placeholder:font-normal placeholder:text-[#8a91a8] focus:border-roxo"
        :class="[erro ? 'border-erro bg-erro-claro/40' : 'border-campo', sufixo ? 'pr-24' : '']"
      >
      <span v-if="sufixo" class="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-lg font-semibold text-apoio">{{ sufixo }}</span>
    </div>
    <MensagemErro :id="`${id}-erro`" :texto="erro" />
    <p v-if="ajuda && !erro" :id="`${id}-ajuda`" class="m-0 text-[15px] text-apoio">{{ ajuda }}</p>
  </div>
</template>
