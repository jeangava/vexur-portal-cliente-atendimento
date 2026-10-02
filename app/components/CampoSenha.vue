<script setup lang="ts">
withDefaults(defineProps<{
  id: string
  rotulo: string
  erro?: string
  autocomplete?: 'current-password' | 'new-password'
  descricao?: string
}>(), { erro: '', autocomplete: 'current-password' })

const valor = defineModel<string>({ default: '' })
const visivel = ref(false)
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <label :for="id" class="text-[17px] font-bold">{{ rotulo }}</label>
    <div class="relative">
      <input
        :id="id" v-model="valor" :type="visivel ? 'text' : 'password'" :autocomplete="autocomplete"
        autocapitalize="off" spellcheck="false"
        :aria-invalid="!!erro" :aria-describedby="erro ? `${id}-erro` : descricao"
        class="h-16 w-full rounded-2xl border-2 bg-white pr-[108px] pl-5 text-[22px] font-semibold text-tinta focus:border-roxo"
        :class="erro ? 'border-erro' : 'border-campo'"
      >
      <button
        type="button" :aria-pressed="visivel" :aria-controls="id"
        class="absolute top-2 right-2 bottom-2 flex items-center gap-1.5 rounded-xl bg-roxo-claro px-3 text-[15px] font-bold text-roxo-escuro"
        @click="visivel = !visivel"
      >
        <Icone :nome="visivel ? 'olho-fechado' : 'olho'" :tamanho="20" />
        {{ visivel ? 'Esconder' : 'Mostrar' }}
      </button>
    </div>
    <MensagemErro :id="`${id}-erro`" :texto="erro" />
  </div>
</template>
