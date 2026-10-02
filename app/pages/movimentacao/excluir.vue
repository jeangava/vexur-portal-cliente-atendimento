<script setup lang="ts">
import type { OpcoesMovimentacao, PainelMovimentacao, Solicitacao } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Tirar alguém do plano · Portal do Cliente' })

const PASSOS = ['Quem vai sair', 'Motivo e data', 'Confirmar']
const route = useRoute()
const [{ data: painel, error }, { data: opcoes }] = await Promise.all([
  useFetch<PainelMovimentacao>('/api/movimentacao'),
  useFetch<OpcoesMovimentacao>('/api/movimentacao/opcoes'),
])

const podemSair = computed(() => painel.value?.beneficiarios.filter(b => b.podeExcluir) ?? [])
const preSelecionado = String(route.query.pessoa ?? '')
const quem = ref(podemSair.value.some(b => b.id === preSelecionado) ? preSelecionado : '')
const passo = ref(quem.value ? 2 : 1)
const motivo = ref('')
const quando = ref('')
const aceite = ref(false)
const erro = ref('')
const enviando = ref(false)
const pronto = ref<Solicitacao | null>(null)

const pessoa = computed(() => painel.value?.beneficiarios.find(b => b.id === quem.value))
const opcaoQuando = computed(() => opcoes.value?.quandoExcluir.find(q => q.id === quando.value))
const motivoRotulo = computed(() => opcoes.value?.motivosExclusao.find(m => m.id === motivo.value)?.rotulo ?? '')
const primeiroNome = computed(() => pessoa.value?.nome.split(' ')[0] ?? '')

watch([quem, motivo, quando, aceite], () => { erro.value = '' })

function avancar() {
  if (passo.value === 1 && !quem.value) { erro.value = 'Escolha quem vai sair do plano.'; return }
  if (passo.value === 2 && !motivo.value) { erro.value = 'Escolha o motivo.'; return }
  if (passo.value === 2 && !quando.value) { erro.value = 'Escolha a partir de quando.'; return }
  passo.value++
}

async function enviar() {
  if (!aceite.value) { erro.value = 'Marque a confirmação para enviar.'; return }
  enviando.value = true
  try {
    pronto.value = await $fetch<Solicitacao>('/api/movimentacao/exclusao', {
      method: 'POST', body: { beneficiario: quem.value, motivo: motivo.value, quando: quando.value, aceite: aceite.value },
    })
  } catch (e) {
    erro.value = mensagemDeErro(e)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar v-if="pronto || passo === 1" to="/movimentacao" rotulo="Movimentação" />
    <div v-else>
      <button type="button" class="inline-flex min-h-12 items-center gap-1.5 rounded-[14px] bg-white py-0 pr-4 pl-2.5 text-[17px] font-bold text-tinta shadow-leve" @click="passo--">
        <Icone nome="voltar" :tamanho="22" :espessura="2.4" /> Voltar
      </button>
    </div>
    <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Tirar alguém do plano</h1>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos abrir este pedido agora.')" />

    <div v-if="painel && opcoes" class="flex flex-col gap-[22px] lg:max-w-[720px]">
      <section v-if="pronto" role="status" class="flex flex-col items-center gap-3 rounded-3xl bg-white p-7 text-center shadow-cartao">
        <span class="flex size-[76px] items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :tamanho="40" :espessura="2.6" /></span>
        <h2 class="m-0 font-display text-2xl font-extrabold">Pedido enviado</h2>
        <p class="m-0 text-lg">Protocolo <b class="font-display text-xl">{{ pronto.protocolo }}</b></p>
        <p class="m-0 text-[17px] text-texto">{{ pronto.detalhe }}</p>
        <div class="mt-2 w-full max-w-[360px]"><BotaoPrincipal to="/movimentacao">Ver minhas solicitações</BotaoPrincipal></div>
      </section>

      <section v-else-if="!podemSair.length" class="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-cartao">
        <p class="m-0 text-lg">Não há dependentes que possam sair do plano pelo portal agora.</p>
        <p class="m-0 text-base text-texto">Se já existe um pedido de saída, acompanhe em Minhas solicitações. Para cancelar o plano do titular, fale com a gente.</p>
      </section>

      <template v-else>
        <IndicadorPassos :atual="passo" :passos="PASSOS" />

        <section v-if="passo === 1" class="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
          <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
            <legend class="mb-3 text-xl font-bold">Quem vai sair do plano?</legend>
            <OpcaoGrande v-for="b in podemSair" :key="b.id" v-model="quem" nome="quem" :valor="b.id" :rotulo="b.nome" :apoio="b.parentesco" />
          </fieldset>
          <MensagemErro :texto="erro" />
          <BotaoPrincipal @click="avancar">Continuar <Icone nome="seta" :tamanho="22" :espessura="2.4" /></BotaoPrincipal>
        </section>

        <section v-else-if="passo === 2" class="flex flex-col gap-6 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
          <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
            <legend class="mb-3 text-xl font-bold">Por que {{ primeiroNome }} vai sair?</legend>
            <div class="grid gap-3 sm:grid-cols-2">
              <OpcaoGrande v-for="m in opcoes.motivosExclusao" :key="m.id" v-model="motivo" nome="motivo" :valor="m.id" :rotulo="m.rotulo" :apoio="m.apoio" />
            </div>
          </fieldset>
          <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
            <legend class="mb-3 text-xl font-bold">A partir de quando?</legend>
            <OpcaoGrande v-for="q in opcoes.quandoExcluir" :key="q.id" v-model="quando" nome="quando" :valor="q.id" :rotulo="q.rotulo" :apoio="q.apoio" />
          </fieldset>
          <MensagemErro :texto="erro" />
          <BotaoPrincipal @click="avancar">Continuar <Icone nome="seta" :tamanho="22" :espessura="2.4" /></BotaoPrincipal>
        </section>

        <form v-else class="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-cartao sm:p-7" novalidate @submit.prevent="enviar">
          <h2 class="m-0 text-xl font-bold">Confira antes de enviar</h2>
          <dl class="m-0 grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Quem sai</dt><dd class="m-0 text-[17px] font-bold">{{ pessoa?.nome }}</dd></div>
            <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Motivo</dt><dd class="m-0 text-[17px] font-bold">{{ motivoRotulo }}</dd></div>
            <div class="rounded-2xl bg-fundo p-3.5 sm:col-span-2"><dt class="text-sm font-semibold text-apoio">Sai do plano em</dt><dd class="m-0 text-[17px] font-bold">{{ opcaoQuando ? formatarData(opcaoQuando.data) : '' }}</dd></div>
          </dl>
          <div class="flex items-start gap-3 rounded-[18px] border-2 border-atencao-borda bg-atencao-claro px-4 py-3.5 text-atencao">
            <Icone nome="alerta" :espessura="2.2" class="mt-0.5" />
            <span class="text-base font-semibold">Depois dessa data, {{ primeiroNome }} não terá mais atendimento pelo plano.</span>
          </div>
          <label class="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-[#e3e4ed] p-4 has-[:checked]:border-roxo has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-roxo">
            <input v-model="aceite" type="checkbox" class="mt-0.5 size-6 shrink-0 accent-roxo">
            <span class="text-[17px]">Entendi e quero tirar {{ pessoa?.nome }} do plano.</span>
          </label>
          <MensagemErro :texto="erro" />
          <BotaoPrincipal tipo="submit" :carregando="enviando">{{ enviando ? 'Enviando…' : 'Enviar pedido de saída' }}</BotaoPrincipal>
        </form>
      </template>
    </div>
  </main>
</template>
