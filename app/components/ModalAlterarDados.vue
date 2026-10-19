<script setup lang="ts">
import type { ContatoCadastro, DecisaoDeAlteracao, EnderecoCadastro } from '#shared/types/portal'

/** Popup só com o passo a passo de alterar dados (usado na tela da empresa). */
defineProps<{ decisoes: DecisaoDeAlteracao[], alvo: 'contrato' | 'empresa', atual?: { contatos: ContatoCadastro[], enderecos: EnderecoCadastro[] } }>()
const emit = defineEmits<{ concluido: [] }>()
const aberto = defineModel<boolean>({ default: false })
const dialogo = ref<HTMLDialogElement | null>(null)

watch(aberto, (v) => {
  const d = dialogo.value
  if (!d) return
  if (v && !d.open) d.showModal()
  if (!v && d.open) d.close()
})

function aoClicarFora(e: MouseEvent) {
  if (e.target === dialogo.value) aberto.value = false
}
</script>

<template>
  <dialog
    ref="dialogo" aria-labelledby="alterar-titulo"
    class="m-auto w-[calc(100%-24px)] max-w-[640px] rounded-[28px] border-0 bg-white p-0 text-tinta shadow-[0_30px_80px_#1d294859] backdrop:bg-tinta/55 print:hidden"
    @close="aberto = false" @click="aoClicarFora"
  >
    <div v-if="aberto" class="flex max-h-[calc(100dvh-32px)] flex-col">
      <div class="flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-8 sm:pt-7">
        <h2 id="alterar-titulo" class="m-0 font-display text-[26px] leading-[1.2] font-extrabold">Alterar dados</h2>
        <button type="button" aria-label="Fechar" class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-fundo text-texto" @click="aberto = false">
          <Icone nome="fechar" :tamanho="22" :espessura="2.4" />
        </button>
      </div>
      <div class="overflow-y-auto px-5 pt-2 pb-6 sm:px-8 sm:pb-8">
        <FluxoAlteracao :decisoes="decisoes" :alvo="alvo" :atual="atual" @fechar="aberto = false" @concluido="emit('concluido')" />
      </div>
    </div>
  </dialog>
</template>
