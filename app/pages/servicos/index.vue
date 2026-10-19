<script setup lang="ts">
definePageMeta({ layout: 'portal' })
useHead({ title: 'Serviços · Portal do Cliente' })

const { data: regras, error } = await useFetch('/api/servicos')
// Só os serviços autorizados para o contrato (os conhecidos, na ordem do portal, e depois os demais comunicados).
const servicos = computed(() => {
  const lista = (regras.value ?? []).filter(r => !r.oculto)
  const conhecidos = SERVICOS.flatMap((s) => { const regra = lista.find(r => r.id === s.id); return regra ? [{ ...s, regra }] : [] })
  const outros = lista.filter(r => !buscarServico(r.id)).map(r => ({
    id: r.id, titulo: r.titulo ?? 'Documento', apoio: 'Documento do seu contrato', icone: 'documento', cor: 'bg-roxo-claro text-roxo-icone', regra: r,
  }))
  return [...conhecidos, ...outros]
})
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/inicio" rotulo="Início" class="lg:hidden" />
    <div class="flex flex-col gap-1.5">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Principais serviços</h1>
      <p class="m-0 text-lg text-texto">Peça seus documentos. A gente manda para o seu e-mail.</p>
    </div>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar os serviços agora.')" />

    <p v-if="regras && !servicos.length" class="m-0 rounded-[22px] bg-white p-5 text-lg text-texto shadow-cartao">Nenhum serviço está disponível para o seu contrato.</p>

    <div class="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      <NuxtLink
        v-for="s in servicos" :key="s.id" :to="s.id === 'extrato' || s.id === 'sv-extrato-de-cobranca' ? '/contas' : `/servicos/${s.id}`"
        class="flex min-h-[112px] items-center gap-4 rounded-[22px] bg-white p-[18px] text-tinta no-underline shadow-cartao transition-shadow hover:shadow-[0_10px_30px_#353d681c] lg:min-h-[190px] lg:flex-col lg:items-start lg:justify-between lg:p-6"
      >
        <span class="flex size-[58px] shrink-0 items-center justify-center rounded-[18px]" :class="s.cor">
          <Icone :nome="s.icone" :tamanho="30" />
        </span>
        <span class="flex min-w-0 grow flex-col gap-0.5">
          <span class="text-[19px] leading-tight font-bold">{{ s.titulo }}</span>
          <span class="text-[15px] text-apoio">{{ s.apoio }}</span>
          <span
            v-if="s.regra && !s.regra.disponivel"
            class="mt-1.5 inline-flex items-center gap-1.5 self-start rounded-full bg-atencao-claro px-2.5 py-0.5 text-[13px] font-bold text-atencao"
          >
            <Icone nome="alerta" :tamanho="14" :espessura="2.6" /> Precisa de uma ação sua
          </span>
        </span>
        <Icone nome="avancar" :espessura="2.4" class="text-roxo-icone lg:hidden" />
      </NuxtLink>
    </div>
  </main>
</template>
