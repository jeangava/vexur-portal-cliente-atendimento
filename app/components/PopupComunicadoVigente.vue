<script setup lang="ts">
import type { Comunicado } from '#shared/types/portal'

/**
 * Abre sozinho depois do login quando existe comunicado vigente
 * (inadimplência/suspensão cuja mensalidade ainda não teve baixa).
 * Fechar vale só para este login: no próximo, ele aparece de novo.
 */
const vigentes = ref<Comunicado[]>([])
const dialogo = ref<HTMLDialogElement | null>(null)
const principal = computed(() => vigentes.value[0])

onMounted(async () => {
  try {
    vigentes.value = await $fetch<Comunicado[]>('/api/comunicados/vigentes')
  } catch {
    vigentes.value = []
  }
  if (vigentes.value.length) {
    await nextTick()
    dialogo.value?.showModal()
  }
})

async function registrarCiente() {
  await $fetch('/api/comunicados/vigentes/ciente', { method: 'POST' }).catch(() => {})
}

async function fechar() {
  dialogo.value?.close()
}

async function aoFechar() {
  await registrarCiente()
}

async function pagar() {
  const destino = principal.value?.faturaId ? `/contas/${principal.value.faturaId}` : '/contas'
  dialogo.value?.close()
  await navigateTo(destino)
}
</script>

<template>
  <dialog
    ref="dialogo"
    aria-labelledby="vigente-titulo" aria-describedby="vigente-texto"
    class="m-auto w-[calc(100%-32px)] max-w-[520px] rounded-[28px] border-0 bg-white p-0 text-tinta shadow-[0_30px_80px_#1d294859] backdrop:bg-tinta/55"
    @close="aoFechar"
  >
    <div v-if="principal" class="flex flex-col gap-5 p-6 sm:p-8">
      <div class="flex items-start justify-between gap-4">
        <span class="flex size-16 shrink-0 items-center justify-center rounded-[22px] bg-erro-claro text-erro">
          <Icone nome="alerta" :tamanho="34" :espessura="2.2" />
        </span>
        <button
          type="button" aria-label="Fechar aviso"
          class="flex size-12 items-center justify-center rounded-2xl bg-fundo text-texto"
          @click="fechar"
        >
          <Icone nome="fechar" :tamanho="22" :espessura="2.4" />
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <span class="self-start rounded-full bg-erro-claro px-3 py-1 text-sm font-bold text-erro">Aviso importante</span>
        <h2 id="vigente-titulo" class="m-0 font-display text-[26px] leading-[1.2] font-extrabold">{{ principal.titulo }}</h2>
      </div>

      <div id="vigente-texto" class="flex flex-col gap-3 text-[17px] text-texto">
        <p v-for="(p, i) in principal.paragrafos.slice(1)" :key="i" class="m-0">{{ p }}</p>
      </div>

      <p v-if="vigentes.length > 1" class="m-0 text-[15px] font-semibold text-erro">
        Você tem mais {{ vigentes.length - 1 }} {{ vigentes.length - 1 === 1 ? 'aviso' : 'avisos' }} em vigor em Comunicados.
      </p>

      <div class="flex flex-col gap-3">
        <BotaoPrincipal @click="pagar">
          Pagar agora
          <Icone nome="seta" :tamanho="22" :espessura="2.4" />
        </BotaoPrincipal>
        <BotaoPrincipal variante="contorno" @click="fechar">Entendi, ver depois</BotaoPrincipal>
      </div>

      <p class="m-0 text-center text-sm text-apoio">Este aviso some sozinho quando o pagamento for confirmado.</p>
    </div>
  </dialog>
</template>
