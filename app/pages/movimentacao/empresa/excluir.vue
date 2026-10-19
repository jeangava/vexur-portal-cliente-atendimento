<script setup lang="ts">
import type { BeneficiariosEmpresa, DecisaoDeMovimentacao, OpcoesMovimentacao, PessoaEmpresa, Solicitacao } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Tirar do plano · Portal do Cliente' })

const PASSOS = ['Quem vai sair', 'Motivo e data', 'Confirmar']
const [{ data: empresa, error }, { data: opcoes }, { data: regras }] = await Promise.all([
  useFetch<BeneficiariosEmpresa>('/api/empresa/beneficiarios'),
  useFetch<OpcoesMovimentacao>('/api/movimentacao/opcoes'),
  useFetch<DecisaoDeMovimentacao[]>('/api/movimentacao/regras', { default: () => [] }),
])
// O que a regra do plano libera: titular e dependente são liberados separadamente.
const libera = (tipo: DecisaoDeMovimentacao['tipo']) => (regras.value ?? []).some(d => d.tipo === tipo && d.disponivel)
const podeTirarTitular = computed(() => libera('excluir-titular'))
const podeTirarDependente = computed(() => libera('excluir-dependente'))

const passo = ref(1)
const selecionados = ref<string[]>([])
const carregadas = ref<Record<string, PessoaEmpresa[]>>({})
const motivo = ref('')
const quando = ref('')
const dataEscolhida = ref('')
const hojeIso = new Date().toISOString().slice(0, 10)
const maximoIso = new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()).toISOString().slice(0, 10)
const aceite = ref(false)
const erro = ref('')
const enviando = ref(false)
const pronto = ref<Solicitacao | null>(null)

/** Todas as pessoas que saem: as marcadas e os dependentes dos titulares marcados. */
const saindo = computed(() => {
  const marcados = new Set(selecionados.value)
  const lista: (PessoaEmpresa & { junto?: boolean })[] = []
  for (const t of empresa.value?.titulares ?? []) {
    // Lista sob demanda: os dependentes só chegam quando a família é aberta.
    const dependentes = t.dependentes.length ? t.dependentes : carregadas.value[t.id] ?? []
    if (marcados.has(t.id)) lista.push(t, ...dependentes.filter(d => d.situacao === 'ativo').map(d => ({ ...d, junto: true })))
    else lista.push(...dependentes.filter(d => marcados.has(d.id)))
  }
  return lista
})
const opcaoQuando = computed(() => opcoes.value?.quandoExcluir.find(q => q.id === quando.value))
// Vem marcado "no fim do mês"; as outras datas ficam atrás de um botão.
const outrasDatas = ref(false)
const quandoVisiveis = computed(() => (outrasDatas.value ? opcoes.value?.quandoExcluir : opcoes.value?.quandoExcluir.filter(q => q.id === 'fim-do-mes')) ?? [])
watch(opcoes, (o) => { if (!quando.value && o?.quandoExcluir.some(q => q.id === 'fim-do-mes')) quando.value = 'fim-do-mes' }, { immediate: true })
/** A data da saída: a da opção pronta ou a que a pessoa escolheu. */
const dataDaSaida = computed(() => (opcaoQuando.value?.escolheData ? dataEscolhida.value : opcaoQuando.value?.data) ?? '')
const motivoRotulo = computed(() => opcoes.value?.motivosExclusao.find(m => m.id === motivo.value)?.rotulo ?? '')
const textoQtd = computed(() => (saindo.value.length === 1 ? '1 pessoa' : `${saindo.value.length} pessoas`))

watch([selecionados, motivo, quando, aceite], () => { erro.value = '' })

function avancar() {
  if (passo.value === 1 && !saindo.value.length) { erro.value = 'Marque quem vai sair do plano.'; return }
  if (passo.value === 2 && !motivo.value) { erro.value = 'Escolha o motivo.'; return }
  if (passo.value === 2 && !quando.value) { erro.value = 'Escolha a partir de quando.'; return }
  if (passo.value === 2 && opcaoQuando.value?.escolheData && (!dataEscolhida.value || dataEscolhida.value < hojeIso || dataEscolhida.value > maximoIso)) {
    erro.value = 'Escolha uma data entre hoje e o próximo ano.'
    return
  }
  passo.value++
  window.scrollTo({ top: 0 })
}

async function enviar() {
  if (!aceite.value) { erro.value = 'Marque a confirmação para enviar.'; return }
  enviando.value = true
  try {
    pronto.value = await $fetch<Solicitacao>('/api/empresa/exclusao', {
      method: 'POST', body: { pessoas: selecionados.value, motivo: motivo.value, quando: quando.value, data: opcaoQuando.value?.escolheData ? dataEscolhida.value : undefined, aceite: aceite.value },
    })
  } catch (e) {
    erro.value = mensagemDeErro(e)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10" :class="passo === 1 && !pronto ? 'pb-36 lg:pb-32' : ''">
    <BotaoVoltar v-if="pronto || passo === 1" to="/movimentacao" rotulo="Movimentação" />
    <div v-else>
      <button type="button" class="inline-flex min-h-12 items-center gap-1.5 rounded-[14px] bg-white py-0 pr-4 pl-2.5 text-[17px] font-bold text-tinta shadow-leve" @click="passo--">
        <Icone nome="voltar" :tamanho="22" :espessura="2.4" /> Voltar
      </button>
    </div>
    <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Tirar do plano</h1>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos abrir este pedido agora.')" />

    <div v-if="empresa && opcoes" class="flex flex-col gap-[22px] lg:max-w-[880px]">
      <section v-if="pronto" role="status" class="flex flex-col items-center gap-3 rounded-3xl bg-white p-7 text-center shadow-cartao">
        <span class="flex size-[76px] items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :tamanho="40" :espessura="2.6" /></span>
        <h2 class="m-0 font-display text-2xl font-extrabold">Pedido enviado</h2>
        <p class="m-0 text-lg">Protocolo <b class="font-display text-xl">{{ pronto.protocolo }}</b></p>
        <p class="m-0 text-[17px] text-texto">{{ pronto.titulo }}. {{ pronto.detalhe }}</p>
        <div class="mt-2 grid w-full max-w-[560px] gap-3 sm:grid-cols-2">
          <BotaoPrincipal :to="`/pedidos/${pronto.protocolo}`">Acompanhar o pedido</BotaoPrincipal>
          <BotaoPrincipal variante="contorno" to="/movimentacao">Voltar à movimentação</BotaoPrincipal>
        </div>
      </section>

      <template v-else>
        <IndicadorPassos :atual="passo" :passos="PASSOS" />

        <section v-if="passo === 1" class="flex flex-col gap-4">
          <p class="m-0 text-lg text-texto">
            Procure e marque quem vai sair. Ao marcar um <b>titular</b>, os dependentes dele saem junto.
          </p>
          <ListaEmpresa v-model:selecionados="selecionados" v-model:carregadas="carregadas":empresa="empresa" selecionavel situacao-inicial="ativos" :permite-tirar-titular="podeTirarTitular" :permite-tirar-dependente="podeTirarDependente" />
        </section>

        <section v-else-if="passo === 2" class="flex flex-col gap-6 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
          <p class="m-0 rounded-2xl bg-fundo px-4 py-3 text-[17px] font-semibold">Saindo do plano: {{ textoQtd }}</p>
          <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
            <legend class="mb-3 text-xl font-bold">Por que {{ saindo.length === 1 ? 'a pessoa vai' : 'as pessoas vão' }} sair?</legend>
            <p class="-mt-1 mb-1 text-base text-apoio">Se forem motivos diferentes, faça um pedido para cada motivo.</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <OpcaoGrande v-for="m in opcoes.motivosExclusao" :key="m.id" v-model="motivo" nome="motivo" :valor="m.id" :rotulo="m.rotulo" :apoio="m.apoio" />
            </div>
          </fieldset>
          <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
            <legend class="mb-3 text-xl font-bold">A partir de quando?</legend>
            <OpcaoGrande v-for="q in quandoVisiveis" :key="q.id" v-model="quando" nome="quando" :valor="q.id" :rotulo="q.rotulo" :apoio="q.apoio" />
            <button
              v-if="!outrasDatas && opcoes.quandoExcluir.length > 1" type="button"
              class="self-start rounded-xl px-2 py-2 text-base font-semibold text-roxo-escuro underline"
              @click="outrasDatas = true"
            >
              Precisa de outra data?
            </button>
            <div v-if="opcaoQuando?.escolheData" class="flex flex-col gap-1.5 rounded-2xl bg-fundo p-4">
              <label for="data-saida" class="text-[17px] font-bold">Dia em que sai do plano</label>
              <input
                id="data-saida" v-model="dataEscolhida" type="date" :min="hojeIso" :max="maximoIso"
                class="h-14 rounded-2xl border-2 border-campo bg-white px-4 text-lg text-tinta focus:border-roxo"
              >
            </div>
          </fieldset>
          <MensagemErro :texto="erro" />
          <BotaoPrincipal @click="avancar">Continuar <Icone nome="seta" :tamanho="22" :espessura="2.4" /></BotaoPrincipal>
        </section>

        <form v-else class="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-cartao sm:p-7" novalidate @submit.prevent="enviar">
          <h2 class="m-0 text-xl font-bold">Confira antes de enviar</h2>
          <dl class="m-0 grid gap-3 sm:grid-cols-3">
            <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Quantas pessoas</dt><dd class="m-0 text-[17px] font-bold">{{ textoQtd }}</dd></div>
            <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Motivo</dt><dd class="m-0 text-[17px] font-bold">{{ motivoRotulo }}</dd></div>
            <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Saem do plano em</dt><dd class="m-0 text-[17px] font-bold">{{ dataDaSaida ? formatarData(dataDaSaida) : '' }}</dd></div>
          </dl>
          <div>
            <h3 class="m-0 mb-2 text-base font-bold text-texto">Quem sai</h3>
            <ul class="m-0 flex max-h-[320px] list-none flex-col overflow-y-auto rounded-2xl border-2 border-linha p-0">
              <li v-for="p in saindo" :key="p.id" class="flex flex-wrap items-baseline gap-x-2 border-b border-linha px-4 py-2.5 last:border-b-0" :class="p.junto ? 'pl-8' : ''">
                <span class="text-[17px] font-bold">{{ p.nome }}</span>
                <span class="text-[15px] text-apoio">{{ p.parentesco }}<template v-if="p.junto"> · sai junto com o titular</template></span>
              </li>
            </ul>
          </div>
          <div class="flex items-start gap-3 rounded-[18px] border-2 border-atencao-borda bg-atencao-claro px-4 py-3.5 text-atencao">
            <Icone nome="alerta" :espessura="2.2" class="mt-0.5" />
            <span class="text-base font-semibold">Depois dessa data, essas pessoas não terão mais atendimento pelo plano.</span>
          </div>
          <label class="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-[#e3e4ed] p-4 has-[:checked]:border-roxo has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-roxo">
            <input v-model="aceite" type="checkbox" class="mt-0.5 size-6 shrink-0 accent-roxo">
            <span class="text-[17px]">Entendi e quero tirar {{ textoQtd }} do plano.</span>
          </label>
          <MensagemErro :texto="erro" />
          <BotaoPrincipal tipo="submit" :carregando="enviando">{{ enviando ? 'Enviando…' : 'Enviar pedido de saída' }}</BotaoPrincipal>
        </form>
      </template>
    </div>

    <!-- Barra fixa com o total marcado (passo 1) -->
    <div
      v-if="empresa && !pronto && passo === 1"
      class="fixed inset-x-0 bottom-[86px] z-10 border-t border-linha bg-white/95 px-5 py-3 backdrop-blur lg:bottom-0 lg:left-[264px] lg:px-10"
    >
      <div class="mx-auto flex max-w-[880px] flex-col gap-2 sm:flex-row sm:items-center lg:mx-0">
        <div class="grow text-[17px] font-bold" aria-live="polite">
          {{ saindo.length ? `${textoQtd} para sair` : 'Ninguém marcado ainda' }}
          <MensagemErro :texto="erro" />
        </div>
        <div class="sm:w-[260px]"><BotaoPrincipal @click="avancar">Continuar <Icone nome="seta" :tamanho="22" :espessura="2.4" /></BotaoPrincipal></div>
      </div>
    </div>
  </main>
</template>
