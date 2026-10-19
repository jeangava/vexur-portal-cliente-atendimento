<script setup lang="ts">
/**
 * Popup "Ver outro contrato": lista todos os contratos do CPF sem sair da tela em que a pessoa está.
 * Abre por useSeletorContratos(); a lista rola dentro do popup quando são muitos.
 */
const aberto = useSeletorContratos()
const dialogo = ref<HTMLDialogElement | null>(null)

watch(aberto, (valor) => {
  const d = dialogo.value
  if (!d) return
  if (valor && !d.open) d.showModal()
  if (!valor && d.open) d.close()
})

function aoClicarFora(evento: MouseEvent) {
  if (evento.target === dialogo.value) aberto.value = false
}

// Depois de trocar, recarrega tudo no Início: nada do contrato anterior fica na tela.
async function aoAbrir(_contrato: unknown, eraTroca: boolean) {
  aberto.value = false
  if (eraTroca) reloadNuxtApp({ path: '/inicio', persistState: false, ttl: 0 })
  else await navigateTo('/inicio')
}
</script>

<template>
  <dialog
    ref="dialogo" aria-labelledby="contratos-titulo"
    class="m-auto w-[calc(100%-32px)] max-w-[560px] rounded-[28px] border-0 bg-white p-0 text-tinta shadow-[0_30px_80px_#1d294859] backdrop:bg-tinta/55 print:hidden"
    @close="aberto = false" @click="aoClicarFora"
  >
    <div v-if="aberto" class="flex max-h-[calc(100dvh-48px)] flex-col">
      <div class="flex items-start justify-between gap-4 px-6 pt-6 pb-3 sm:px-8 sm:pt-8">
        <div class="flex flex-col gap-1.5">
          <h2 id="contratos-titulo" class="m-0 font-display text-[26px] leading-[1.2] font-extrabold">Ver outro contrato</h2>
          <p class="m-0 text-[17px] text-texto">Toque no contrato que você quer abrir.</p>
        </div>
        <button
          type="button" aria-label="Fechar"
          class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-fundo text-texto"
          @click="aberto = false"
        >
          <Icone nome="fechar" :tamanho="22" :espessura="2.4" />
        </button>
      </div>
      <div class="overflow-y-auto px-6 pt-2 pb-6 sm:px-8 sm:pb-8">
        <ListaContratos @aberto="aoAbrir" />
      </div>
    </div>
  </dialog>
</template>
