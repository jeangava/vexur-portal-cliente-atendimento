<script setup lang="ts">
definePageMeta({ layout: 'portal' })

const route = useRoute()
const id = String(route.params.id)
const { data: fatura, error } = await useFetch(`/api/faturas/${encodeURIComponent(id)}`)
useHead({ title: () => `Conta de ${fatura.value?.mes ?? ''} · Portal do Cliente` })

const verItens = ref(false)
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/contas" rotulo="Minhas contas" />

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos abrir essa conta agora.')" />

    <div v-if="fatura" class="flex flex-col gap-[22px] md:grid md:grid-cols-2 md:items-start md:gap-6 lg:gap-8">
      <section class="flex flex-col items-center gap-2.5 rounded-3xl bg-white p-[22px] text-center shadow-cartao lg:p-8">
        <h1 class="m-0 text-lg font-bold text-texto">Conta de {{ fatura.mes }}</h1>
        <div class="font-display text-5xl leading-[1.05] font-extrabold tracking-tight lg:text-[56px]">{{ formatarMoeda(fatura.valor) }}</div>
        <SeloSituacao :situacao="fatura.situacao" />
        <div class="text-[17px] font-semibold" :class="VISUAL_SITUACAO[fatura.situacao].texto">{{ fraseDoVencimento(fatura) }}</div>
        <button
          type="button" :aria-expanded="verItens" aria-controls="itens-conta"
          class="mt-1 min-h-12 bg-transparent px-3 text-base font-bold text-roxo-escuro underline underline-offset-4"
          @click="verItens = !verItens"
        >
          {{ verItens ? 'Esconder detalhes' : 'Ver o que tem nesta conta' }}
        </button>
        <ul v-if="verItens" id="itens-conta" class="m-0 flex w-full list-none flex-col gap-2.5 border-t border-linha p-0 pt-3 text-left text-base">
          <li v-for="item in fatura.itens" :key="item.descricao" class="flex justify-between gap-3">
            <span>{{ item.descricao }}</span><b>{{ formatarMoeda(item.valor) }}</b>
          </li>
        </ul>
        <NuxtLink
          :to="`/contas/${fatura.id}/extrato`"
          class="mt-2 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-roxo-borda bg-roxo-fundo px-4 text-[17px] font-bold text-roxo-escuro no-underline"
        >
          <Icone nome="lista" :tamanho="22" :espessura="2.2" />
          Ver extrato detalhado
        </NuxtLink>
      </section>

      <section v-if="fatura.situacao !== 'paga'" class="flex flex-col gap-3">
        <h2 class="m-0 font-display text-[22px] font-extrabold">Como você quer pagar?</h2>

        <NuxtLink
          :to="`/contas/${fatura.id}/pix`"
          class="flex items-center gap-3.5 rounded-[22px] border-2 border-roxo bg-white p-[18px] text-tinta no-underline shadow-[0_6px_20px_#7864d01f] lg:p-6"
        >
          <span class="flex size-[60px] shrink-0 items-center justify-center rounded-[18px] bg-roxo-claro text-roxo-icone"><Icone nome="pix" :tamanho="32" /></span>
          <span class="flex grow flex-col gap-0.5">
            <span class="flex flex-wrap items-center gap-2">
              <span class="text-xl font-extrabold">PIX</span>
              <span class="rounded-full bg-roxo px-2.5 py-0.5 text-[13px] font-bold text-white">Mais fácil</span>
            </span>
            <span class="text-[15px] text-texto">O pagamento é confirmado na hora.</span>
          </span>
          <Icone nome="avancar" :espessura="2.4" class="text-roxo-icone" />
        </NuxtLink>

        <NuxtLink
          :to="`/contas/${fatura.id}/boleto`"
          class="flex items-center gap-3.5 rounded-[22px] border-2 border-[#e3e4ed] bg-white p-[18px] text-tinta no-underline lg:p-6"
        >
          <span class="flex size-[60px] shrink-0 items-center justify-center rounded-[18px] bg-[#f1f2f7] text-tinta"><Icone nome="boleto" :tamanho="32" /></span>
          <span class="flex grow flex-col gap-0.5">
            <span class="text-xl font-extrabold">Boleto</span>
            <span class="text-[15px] text-texto">Pode levar até 3 dias úteis para confirmar.</span>
          </span>
          <Icone nome="avancar" :espessura="2.4" class="text-roxo-icone" />
        </NuxtLink>
      </section>
    </div>
  </main>
</template>
