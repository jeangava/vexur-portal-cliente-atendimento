<script setup lang="ts">
definePageMeta({ layout: 'portal' })
useHead({ title: 'Minhas contas · Portal do Cliente' })

const { data: faturas, error } = await useFetch('/api/faturas')
const paraPagar = computed(() => faturas.value?.filter(f => f.situacao !== 'paga') ?? [])
const pagas = computed(() => faturas.value?.filter(f => f.situacao === 'paga') ?? [])
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/inicio" rotulo="Início" class="lg:hidden" />
    <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Minhas contas</h1>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar suas contas agora. Tente de novo em instantes.')" />

    <div class="flex flex-col gap-[22px] md:grid md:grid-cols-2 md:items-start md:gap-6 lg:gap-8">
      <section class="flex flex-col gap-3">
        <h2 class="m-0 text-lg font-bold text-texto">Para pagar</h2>
        <NuxtLink
          v-for="f in paraPagar" :key="f.id" :to="`/contas/${f.id}`"
          class="flex items-center gap-3.5 rounded-[22px] border-2 bg-white p-[18px] text-tinta no-underline shadow-cartao transition-shadow hover:shadow-[0_10px_30px_#353d681c] lg:p-6"
          :class="VISUAL_SITUACAO[f.situacao].borda"
        >
          <span class="flex size-14 shrink-0 items-center justify-center rounded-[18px]" :class="VISUAL_SITUACAO[f.situacao].selo">
            <Icone nome="conta" :tamanho="28" />
          </span>
          <span class="flex grow flex-col items-start gap-1">
            <span class="text-lg font-bold">Conta de {{ f.mes }}</span>
            <span class="font-display text-2xl font-extrabold">{{ formatarMoeda(f.valor) }}</span>
            <SeloSituacao :situacao="f.situacao" />
          </span>
          <Icone nome="avancar" :espessura="2.4" class="text-roxo-icone" />
        </NuxtLink>
        <div v-if="faturas && !paraPagar.length" class="flex items-center gap-3.5 rounded-[22px] bg-white p-[18px] shadow-cartao">
          <span class="flex size-12 items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :espessura="2.6" /></span>
          <span class="text-[17px] font-semibold">Tudo em dia! Nenhuma conta para pagar.</span>
        </div>
      </section>

      <section v-if="pagas.length" class="flex flex-col gap-3">
        <h2 class="m-0 text-lg font-bold text-texto">Já pagas</h2>
        <ul class="m-0 flex list-none flex-col rounded-[22px] bg-white p-0 shadow-cartao">
          <li v-for="(f, i) in pagas" :key="f.id" :class="{ 'border-t border-linha': i > 0 }">
            <NuxtLink
              :to="`/contas/${f.id}/extrato`" :aria-label="`Ver extrato da conta de ${f.mes}, ${formatarMoeda(f.valor)}, paga`"
              class="flex items-center gap-3.5 px-[18px] py-4 text-tinta no-underline hover:bg-fundo lg:px-6"
            >
              <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-ok-claro text-ok">
                <Icone nome="certo" :espessura="2.6" />
              </span>
              <span class="flex grow flex-col">
                <span class="text-[17px] font-bold first-letter:uppercase">{{ f.mes }}</span>
                <span class="text-[15px] font-semibold text-ok">{{ fraseDoVencimento(f) }}</span>
              </span>
              <span class="flex flex-col items-end">
                <span class="text-[17px] font-bold">{{ formatarMoeda(f.valor) }}</span>
                <span class="text-sm font-bold text-roxo-escuro">Ver extrato</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
        <NuxtLink to="/servicos/extrato" class="inline-flex min-h-12 items-center gap-2 self-start text-[17px] font-bold text-roxo-escuro underline underline-offset-4">
          <Icone nome="documento" :tamanho="20" /> Pedir o extrato completo
        </NuxtLink>
      </section>
    </div>
  </main>
</template>
