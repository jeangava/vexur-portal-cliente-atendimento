<script setup lang="ts">
import type { ContratoCliente } from '#shared/types/portal'

useHead({ title: 'Escolha o plano · Portal do Cliente' })

const usuario = useUsuario()
const sair = useSair()
const { mostrar } = useAviso()

const { data, error } = await useFetch<{ contratos: ContratoCliente[], atual: string | null }>('/api/contratos')
const ativos = computed(() => (data.value?.contratos ?? []).filter(c => c.situacao === 'ativo'))
const encerrados = computed(() => (data.value?.contratos ?? []).filter(c => c.situacao === 'cancelado'))
const trocando = computed(() => !!usuario.value?.contrato)

// Com plano ativo, os encerrados ficam guardados num botão; sem nenhum ativo, aparecem direto.
const verEncerrados = ref(false)
const mostrarEncerrados = computed(() => verEncerrados.value || !ativos.value.length)

const abrindo = ref('')
const erroGeral = ref('')

async function abrir(contrato: ContratoCliente) {
  if (abrindo.value) return
  if (contrato.id === data.value?.atual) return navigateTo('/inicio')
  const eraTroca = trocando.value
  abrindo.value = contrato.id
  erroGeral.value = ''
  try {
    const resposta = await $fetch('/api/contratos/escolher', { method: 'POST', body: { id: contrato.id } })
    usuario.value = resposta.usuario
    // Limpa o que foi carregado do plano anterior (contas, família, pedidos...).
    clearNuxtData()
    if (eraTroca) mostrar(`Agora você está vendo: ${contrato.plano}`)
    await navigateTo('/inicio', { replace: true })
  } catch (e) {
    erroGeral.value = mensagemDeErro(e)
  } finally {
    abrindo.value = ''
  }
}

function icone(c: ContratoCliente) {
  return c.tipo === 'empresarial' ? 'empresa' : c.tipo === 'individual' ? 'familia' : 'escudo'
}

function linhaDoTipo(c: ContratoCliente) {
  return c.empresa ? `${ROTULO_TIPO_CONTRATO[c.tipo]} · ${c.empresa}` : ROTULO_TIPO_CONTRATO[c.tipo]
}

function linhaDaData(c: ContratoCliente) {
  return c.situacao === 'cancelado'
    ? `Encerrado em ${formatarData(c.fimVigencia ?? '')}`
    : `Desde ${formatarData(c.inicioVigencia)}`
}
</script>

<template>
  <main class="flex min-h-dvh flex-col gap-7 px-6 pt-10 pb-8 lg:min-h-0 lg:px-10 lg:py-10">
    <BotaoVoltar v-if="trocando" to="/inicio" rotulo="Voltar" />

    <div class="flex flex-col gap-2">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold">
        {{ trocando ? 'Trocar de plano' : `${usuario?.primeiroNome}, qual plano você quer ver?` }}
      </h1>
      <p class="m-0 text-lg text-texto">
        <template v-if="!ativos.length">Todos os seus planos estão encerrados. Você ainda pode ver contas antigas, documentos e pedidos.</template>
        <template v-else>Seu CPF tem mais de um plano. Toque no plano que você quer abrir. Dá para trocar depois.</template>
      </p>
    </div>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar os seus planos agora.')" />
    <MensagemErro :texto="erroGeral" />

    <section v-if="ativos.length" class="flex flex-col gap-3">
      <h2 class="m-0 text-lg font-bold text-texto">Planos ativos <span class="font-semibold text-apoio">({{ ativos.length }})</span></h2>
      <ul class="m-0 flex list-none flex-col gap-3 p-0">
        <li v-for="c in ativos" :key="c.id">
          <button
            type="button" :disabled="!!abrindo"
            class="flex w-full items-center gap-3.5 rounded-[22px] border-2 bg-white px-[18px] py-4 text-left text-tinta shadow-cartao transition-colors hover:border-roxo disabled:opacity-60"
            :class="c.id === data?.atual ? 'border-roxo bg-roxo-fundo' : 'border-transparent'"
            @click="abrir(c)"
          >
            <span class="flex size-14 shrink-0 items-center justify-center rounded-[18px]" :class="c.tipo === 'empresarial' ? 'bg-azul-claro text-azul' : 'bg-roxo-claro text-roxo-icone'">
              <Icone :nome="icone(c)" :tamanho="28" />
            </span>
            <span class="flex min-w-0 grow flex-col gap-0.5">
              <span class="text-[19px] leading-tight font-bold">{{ c.plano }}</span>
              <span class="text-[15px] text-texto">{{ linhaDoTipo(c) }}</span>
              <span class="text-[15px] font-semibold" :class="c.papel === 'representante' ? 'text-azul' : 'text-apoio'">{{ papelLegivel(c) }}</span>
              <span class="text-sm text-apoio">Contrato {{ c.numero }} · {{ linhaDaData(c) }}</span>
              <span v-if="c.id === data?.atual" class="mt-1 self-start rounded-full bg-roxo px-2.5 py-0.5 text-sm font-bold text-white">Você está aqui</span>
            </span>
            <Icone v-if="abrindo !== c.id" nome="avancar" :tamanho="24" :espessura="2.4" class="shrink-0 text-roxo-icone" />
            <span v-else class="shrink-0 text-sm font-bold text-roxo-escuro">Abrindo…</span>
          </button>
        </li>
      </ul>
    </section>

    <section v-if="encerrados.length" class="flex flex-col gap-3">
      <button
        v-if="ativos.length && !verEncerrados" type="button"
        class="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-campo bg-white text-[17px] font-bold text-texto"
        @click="verEncerrados = true"
      >
        Ver planos encerrados ({{ encerrados.length }})
      </button>

      <template v-if="mostrarEncerrados">
        <h2 class="m-0 text-lg font-bold text-texto">Planos encerrados <span class="font-semibold text-apoio">({{ encerrados.length }})</span></h2>
        <ul class="m-0 flex list-none flex-col gap-3 p-0">
          <li v-for="c in encerrados" :key="c.id">
            <button
              type="button" :disabled="!!abrindo"
              class="flex w-full items-center gap-3.5 rounded-[22px] border-2 bg-fundo px-[18px] py-4 text-left text-tinta transition-colors hover:border-campo disabled:opacity-60"
              :class="c.id === data?.atual ? 'border-roxo' : 'border-linha'"
              @click="abrir(c)"
            >
              <span class="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-white text-apoio">
                <Icone :nome="icone(c)" :tamanho="28" />
              </span>
              <span class="flex min-w-0 grow flex-col gap-0.5">
                <span class="text-[18px] leading-tight font-bold text-texto">{{ c.plano }}</span>
                <span class="text-[15px] text-apoio">{{ linhaDoTipo(c) }}</span>
                <span class="text-sm font-semibold text-erro">{{ linhaDaData(c) }}</span>
                <span v-if="c.id === data?.atual" class="mt-1 self-start rounded-full bg-roxo px-2.5 py-0.5 text-sm font-bold text-white">Você está aqui</span>
              </span>
              <Icone v-if="abrindo !== c.id" nome="avancar" :tamanho="24" :espessura="2.4" class="shrink-0 text-apoio" />
              <span v-else class="shrink-0 text-sm font-bold text-roxo-escuro">Abrindo…</span>
            </button>
          </li>
        </ul>
      </template>
    </section>

    <div class="grow lg:hidden" />

    <button
      v-if="!trocando" type="button"
      class="flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-transparent text-[17px] font-bold text-roxo-escuro"
      @click="sair"
    >
      <Icone nome="sair" :tamanho="22" />
      Sair
    </button>
  </main>
</template>
