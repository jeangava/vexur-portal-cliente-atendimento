<script setup lang="ts">
import type { CategoriaSolicitacao, Solicitacao } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Meus pedidos · Portal do Cliente' })

const { data: pedidos, error } = await useFetch<Solicitacao[]>('/api/pedidos')

type Filtro = 'todos' | CategoriaSolicitacao
const FILTROS: { id: Filtro, rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'movimentacao', rotulo: 'Movimentação' },
  { id: 'servico', rotulo: 'Serviços' },
  { id: 'atendimento', rotulo: 'Atendimento' },
]
const filtro = ref<Filtro>('todos')

const doFiltro = computed(() => (pedidos.value ?? []).filter(p => filtro.value === 'todos' || p.categoria === filtro.value))
const precisamDeVoce = computed(() => doFiltro.value.filter(p => p.situacao === 'pendente'))
const demais = computed(() => doFiltro.value.filter(p => p.situacao !== 'pendente'))
const quantos = (f: Filtro) => (pedidos.value ?? []).filter(p => f === 'todos' || p.categoria === f).length
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/inicio" rotulo="Início" class="lg:hidden" />
    <div class="flex flex-col gap-1.5">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Meus pedidos</h1>
      <p class="m-0 text-lg text-texto">Tudo o que você pediu, com o andamento e o resultado de cada um.</p>
    </div>

    <div role="group" aria-label="Filtrar pedidos" class="flex flex-wrap gap-2">
      <button
        v-for="f in FILTROS" :key="f.id" type="button" :aria-pressed="filtro === f.id"
        class="min-h-12 rounded-full border-2 px-4 text-base font-bold transition-colors"
        :class="filtro === f.id ? 'border-roxo bg-roxo text-white' : 'border-[#e3e4ed] bg-white text-texto hover:border-roxo-borda'"
        @click="filtro = f.id"
      >
        {{ f.rotulo }} <span class="font-semibold opacity-80">({{ quantos(f.id) }})</span>
      </button>
    </div>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar seus pedidos agora.')" />

    <section v-if="precisamDeVoce.length" class="flex flex-col gap-3">
      <h2 class="m-0 flex items-center gap-2 text-lg font-bold text-atencao">
        <Icone nome="alerta" :tamanho="22" :espessura="2.2" /> Precisam de você ({{ precisamDeVoce.length }})
      </h2>
      <div class="grid gap-3 lg:grid-cols-2">
        <CartaoPedido v-for="p in precisamDeVoce" :key="p.protocolo" :pedido="p" />
      </div>
    </section>

    <section v-if="demais.length" class="flex flex-col gap-3">
      <h2 class="m-0 text-lg font-bold text-texto">{{ precisamDeVoce.length ? 'Outros pedidos' : 'Pedidos' }}</h2>
      <div class="grid gap-3 lg:grid-cols-2">
        <CartaoPedido v-for="p in demais" :key="p.protocolo" :pedido="p" />
      </div>
    </section>

    <p v-if="pedidos && !doFiltro.length" class="m-0 rounded-[22px] bg-white p-6 text-center text-lg text-texto shadow-cartao">
      Nenhum pedido por aqui ainda.
    </p>
  </main>
</template>
