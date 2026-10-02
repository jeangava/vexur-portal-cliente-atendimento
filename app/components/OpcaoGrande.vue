<script setup lang="ts">
/** Opção de escolha única em cartão grande (radio de verdade por baixo, para teclado e leitor de tela). */
defineProps<{ nome: string, valor: string, rotulo: string, apoio?: string }>()
const selecionado = defineModel<string>({ default: '' })
</script>

<template>
  <label
    class="flex min-h-[68px] cursor-pointer items-center gap-3.5 rounded-[20px] border-2 bg-white px-[18px] py-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-roxo"
    :class="selecionado === valor ? 'border-roxo bg-roxo-fundo shadow-[0_6px_20px_#7864d01f]' : 'border-[#e3e4ed]'"
  >
    <input v-model="selecionado" type="radio" :name="nome" :value="valor" class="sr-only">
    <span class="flex min-w-0 grow flex-col">
      <span class="text-[18px] font-bold">{{ rotulo }}</span>
      <span v-if="apoio" class="text-[15px] text-apoio">{{ apoio }}</span>
    </span>
    <span
      aria-hidden="true" class="flex size-7 shrink-0 items-center justify-center rounded-full border-2"
      :class="selecionado === valor ? 'border-roxo bg-roxo text-white' : 'border-campo bg-white'"
    >
      <Icone v-if="selecionado === valor" nome="certo" :tamanho="16" :espessura="3" />
    </span>
  </label>
</template>
