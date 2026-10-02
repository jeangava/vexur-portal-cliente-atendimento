<script setup lang="ts">
/**
 * Envio de documentos (foto ou PDF): valida tipo e tamanho antes de subir, mostra a lista
 * e deixa remover. Usado na inclusão e na regularização de pendências.
 */
withDefaults(defineProps<{ erro?: string, rotulo?: string }>(), { erro: '', rotulo: 'Tirar foto ou escolher arquivo' })
const documentos = defineModel<{ id: string, nome: string }[]>({ required: true })
const emit = defineEmits<{ enviado: [] }>()

const enviando = ref(false)
const erroEnvio = ref('')

async function enviarArquivo(evento: Event) {
  const campo = evento.target as HTMLInputElement
  const arquivo = campo.files?.[0]
  campo.value = ''
  if (!arquivo) return
  erroEnvio.value = ''
  if (!DOCUMENTO_TIPOS.includes(arquivo.type)) { erroEnvio.value = 'Envie uma foto (JPG ou PNG) ou um PDF.'; return }
  if (arquivo.size > DOCUMENTO_TAMANHO_MAX) { erroEnvio.value = 'O arquivo é muito grande. O limite é 5 MB.'; return }
  enviando.value = true
  try {
    const corpo = new FormData()
    corpo.append('arquivo', arquivo)
    const salvo = await $fetch<{ id: string, nome: string }>('/api/movimentacao/documento', { method: 'POST', body: corpo })
    documentos.value = [...documentos.value, salvo]
    emit('enviado')
  } catch (e) {
    erroEnvio.value = mensagemDeErro(e, 'Não conseguimos receber o arquivo. Tente de novo.')
  } finally {
    enviando.value = false
  }
}

function remover(id: string) {
  documentos.value = documentos.value.filter(d => d.id !== id)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-roxo-borda bg-roxo-fundo p-5 text-center has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-roxo">
      <input type="file" accept="image/jpeg,image/png,application/pdf" class="sr-only" :disabled="enviando" @change="enviarArquivo">
      <Icone nome="baixar" :tamanho="32" class="rotate-180 text-roxo-icone" />
      <span class="text-lg font-bold text-roxo-escuro">{{ enviando ? 'Enviando…' : rotulo }}</span>
      <span class="text-sm text-apoio">JPG, PNG ou PDF, até 5 MB</span>
    </label>
    <MensagemErro :texto="erroEnvio || erro" />
    <ul v-if="documentos.length" class="m-0 flex list-none flex-col gap-2 p-0">
      <li v-for="d in documentos" :key="d.id" class="flex items-center gap-3 rounded-2xl bg-fundo px-4 py-3">
        <Icone nome="documento" :tamanho="22" class="text-ok" />
        <span class="min-w-0 grow truncate text-base font-semibold">{{ d.nome }}</span>
        <button type="button" :aria-label="`Remover ${d.nome}`" class="flex size-11 items-center justify-center rounded-xl bg-white text-texto" @click="remover(d.id)">
          <Icone nome="fechar" :tamanho="20" :espessura="2.4" />
        </button>
      </li>
    </ul>
  </div>
</template>
