<script setup lang="ts">
import type { Comunicado } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })

const route = useRoute()
const { data: comunicado, error } = await useFetch<Comunicado>(`/api/comunicados/${encodeURIComponent(String(route.params.id))}`)
useHead({ title: () => `${comunicado.value?.titulo ?? 'Comunicado'} · Portal do Cliente` })

const canal = computed(() => comunicado.value ? CANAL_COMUNICADO[comunicado.value.canal] : null)
const selo = computed(() => comunicado.value ? seloDoComunicado(comunicado.value) : null)
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/comunicados" rotulo="Comunicados" />

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos abrir esse comunicado agora.')" />

    <div v-if="comunicado && canal" class="flex flex-col gap-[22px] lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
      <article class="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-cartao lg:p-9">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-roxo-claro px-3 py-1 text-sm font-bold text-roxo-escuro">
            <Icone :nome="canal.icone" :tamanho="16" /> {{ canal.nome }}
          </span>
          <span v-if="selo" class="rounded-full px-3 py-1 text-sm font-bold" :class="selo.classe">{{ selo.rotulo }}</span>
        </div>
        <h1 class="m-0 font-display text-[28px] leading-[1.2] font-extrabold lg:text-[32px]">{{ comunicado.titulo }}</h1>
        <p class="m-0 text-[15px] text-apoio">
          Enviado em {{ formatarData(comunicado.enviadoEm) }} para <span class="tracking-wide">{{ comunicado.destino }}</span>
        </p>
        <div class="flex flex-col gap-4 border-t border-linha pt-5 text-[18px] leading-relaxed">
          <p v-for="(p, i) in comunicado.paragrafos" :key="i" class="m-0">{{ p }}</p>
        </div>
      </article>

      <aside v-if="comunicado.vigente" class="flex flex-col gap-4 rounded-3xl border-2 border-erro-borda bg-white p-6 shadow-cartao">
        <span class="flex size-14 items-center justify-center rounded-[18px] bg-erro-claro text-erro"><Icone nome="alerta" :tamanho="30" :espessura="2.2" /></span>
        <div class="text-lg font-bold">Este aviso ainda está em vigor</div>
        <p class="m-0 text-base text-texto">Ele some sozinho assim que o pagamento for confirmado.</p>
        <BotaoPrincipal :to="comunicado.faturaId ? `/contas/${comunicado.faturaId}` : '/contas'">
          Pagar agora
          <Icone nome="seta" :tamanho="22" :espessura="2.4" />
        </BotaoPrincipal>
      </aside>

      <aside v-else-if="comunicado.tipo !== 'informativo'" class="flex items-center gap-3.5 rounded-3xl bg-white p-6 shadow-cartao">
        <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :espessura="2.6" /></span>
        <span class="text-[17px] font-semibold">Resolvido: essa conta já foi paga.</span>
      </aside>
    </div>
  </main>
</template>
