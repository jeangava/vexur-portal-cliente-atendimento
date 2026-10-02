<script setup lang="ts">
import type { BeneficiariosEmpresa, ConferenciaPlanilha, Solicitacao, TitularEmpresa } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Incluir pessoas · Portal do Cliente' })

const { data: empresa, error } = await useFetch<BeneficiariosEmpresa>('/api/empresa/beneficiarios')

const modo = ref<'' | 'uma' | 'planilha'>('')
const pronto = ref<Solicitacao | null>(null)
const erro = ref('')
const enviando = ref(false)

function recomecar() {
  modo.value = ''
  pronto.value = null
  conferencia.value = null
  erro.value = ''
}

// ---------------------------------------------------------------- Uma pessoa
const quem = ref<'' | 'titular' | 'dependente'>('')
const buscaTitular = ref('')
const titular = ref<TitularEmpresa | null>(null)
const pessoa = reactive({ nome: '', cpf: '', nascimento: '', parentesco: '', plano: '' })
const hoje = new Date().toISOString().slice(0, 10)

const opcoesParentesco = computed(() => (empresa.value?.parentescos ?? []).map(p => ({ id: p, rotulo: p })))
const opcoesPlano = computed(() => (empresa.value?.planos ?? []).map(p => ({ id: p, rotulo: p })))

const sugestoesTitular = computed(() => {
  const termo = normalizarTexto(buscaTitular.value)
  const digitos = somenteDigitos(buscaTitular.value)
  if (termo.length < 2) return []
  return (empresa.value?.titulares ?? []).filter(t => t.situacao === 'ativo').filter(t =>
    normalizarTexto(t.nome).includes(termo) || (digitos.length >= 3 && somenteDigitos(t.cpf).includes(digitos)),
  ).slice(0, 6)
})

function escolherTitular(t: TitularEmpresa) {
  titular.value = t
  pessoa.plano = t.plano // dependente costuma ficar no plano do titular
  buscaTitular.value = ''
}

watch(quem, () => { titular.value = null; pessoa.parentesco = '' })
watch([quem, titular, () => ({ ...pessoa })], () => { erro.value = '' })

function aoDigitarCpf(evento: Event) {
  const campo = evento.target as HTMLInputElement
  pessoa.cpf = formatarCpf(campo.value)
  campo.value = pessoa.cpf
}

async function enviarUma() {
  if (!quem.value) { erro.value = 'Escolha se é um funcionário ou um dependente.'; return }
  if (quem.value === 'dependente' && !titular.value) { erro.value = 'Procure e escolha o funcionário (titular).'; return }
  enviando.value = true
  try {
    pronto.value = await $fetch<Solicitacao>('/api/empresa/inclusao', {
      method: 'POST',
      body: {
        ...pessoa,
        parentesco: quem.value === 'titular' ? PARENTESCO_TITULAR : pessoa.parentesco,
        cpfTitular: quem.value === 'dependente' ? titular.value?.cpf : '',
      },
    })
  } catch (e) {
    erro.value = mensagemDeErro(e)
  } finally {
    enviando.value = false
  }
}

// ---------------------------------------------------------------- Planilha
const conferencia = ref<ConferenciaPlanilha | null>(null)
const soProblemas = ref(true)
const campoArquivo = ref<HTMLInputElement | null>(null)

const linhasVisiveis = computed(() => {
  const linhas = conferencia.value?.linhas ?? []
  return soProblemas.value && conferencia.value?.comProblema ? linhas.filter(l => l.erros.length) : linhas
})

async function aoEscolherPlanilha(evento: Event) {
  const campo = evento.target as HTMLInputElement
  const arquivo = campo.files?.[0]
  campo.value = ''
  if (!arquivo) return
  erro.value = ''
  if (!/\.xlsx$/i.test(arquivo.name)) { erro.value = 'Envie a planilha em Excel (.xlsx), a mesma do modelo.'; return }
  if (arquivo.size > PLANILHA_TAMANHO_MAX) { erro.value = 'O arquivo é muito grande. O limite é 2 MB.'; return }
  enviando.value = true
  try {
    const corpo = new FormData()
    corpo.append('arquivo', arquivo)
    conferencia.value = await $fetch<ConferenciaPlanilha>('/api/empresa/planilha/conferir', { method: 'POST', body: corpo })
    soProblemas.value = conferencia.value.comProblema > 0
  } catch (e) {
    erro.value = mensagemDeErro(e)
  } finally {
    enviando.value = false
  }
}

async function enviarPlanilha() {
  if (!conferencia.value) return
  enviando.value = true
  erro.value = ''
  try {
    pronto.value = await $fetch<Solicitacao>('/api/empresa/planilha/enviar', { method: 'POST', body: { id: conferencia.value.id } })
  } catch (e) {
    erro.value = mensagemDeErro(e)
  } finally {
    enviando.value = false
  }
}

function pessoas(n: number) {
  return n === 1 ? '1 pessoa' : `${n} pessoas`
}
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar v-if="!modo || pronto" to="/movimentacao" rotulo="Movimentação" />
    <div v-else>
      <button type="button" class="inline-flex min-h-12 items-center gap-1.5 rounded-[14px] bg-white py-0 pr-4 pl-2.5 text-[17px] font-bold text-tinta shadow-leve" @click="recomecar">
        <Icone nome="voltar" :tamanho="22" :espessura="2.4" /> Voltar
      </button>
    </div>
    <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Incluir pessoas</h1>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos abrir a inclusão agora.')" />

    <div v-if="empresa" class="flex flex-col gap-[22px] lg:max-w-[880px]">
      <!-- Pronto -->
      <section v-if="pronto" role="status" class="flex flex-col items-center gap-3 rounded-3xl bg-white p-7 text-center shadow-cartao">
        <span class="flex size-[76px] items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :tamanho="40" :espessura="2.6" /></span>
        <h2 class="m-0 font-display text-2xl font-extrabold">Pedido enviado</h2>
        <p class="m-0 text-lg">Protocolo <b class="font-display text-xl">{{ pronto.protocolo }}</b></p>
        <p class="m-0 text-[17px] text-texto">{{ pronto.titulo }}. {{ pronto.detalhe }}</p>
        <div class="mt-2 grid w-full max-w-[560px] gap-3 sm:grid-cols-2">
          <BotaoPrincipal :to="`/pedidos/${pronto.protocolo}`">Acompanhar o pedido</BotaoPrincipal>
          <BotaoPrincipal variante="contorno" @click="recomecar">Incluir mais pessoas</BotaoPrincipal>
        </div>
      </section>

      <!-- Escolha do jeito -->
      <section v-else-if="!modo" class="grid gap-4 md:grid-cols-2">
        <button type="button" class="flex min-h-[150px] flex-col justify-between gap-3 rounded-[22px] border-2 border-transparent bg-white p-5 text-left text-tinta shadow-cartao hover:border-roxo" @click="modo = 'uma'">
          <span class="flex size-[58px] items-center justify-center rounded-[18px] bg-roxo-claro text-roxo-icone"><Icone nome="familia" :tamanho="30" /></span>
          <span class="flex flex-col">
            <span class="text-[20px] font-bold">Uma pessoa</span>
            <span class="text-[15px] text-apoio">Preencha os dados na tela. Bom para 1 ou 2 pessoas.</span>
          </span>
        </button>
        <button type="button" class="flex min-h-[150px] flex-col justify-between gap-3 rounded-[22px] border-2 border-transparent bg-white p-5 text-left text-tinta shadow-cartao hover:border-roxo" @click="modo = 'planilha'">
          <span class="flex size-[58px] items-center justify-center rounded-[18px] bg-verde-claro text-verde"><Icone nome="lista" :tamanho="30" /></span>
          <span class="flex flex-col">
            <span class="text-[20px] font-bold">Várias pessoas (planilha)</span>
            <span class="text-[15px] text-apoio">Baixe o modelo, preencha no Excel e envie. O portal confere tudo antes.</span>
          </span>
        </button>
      </section>

      <!-- Uma pessoa -->
      <form v-else-if="modo === 'uma'" class="flex flex-col gap-6 rounded-3xl bg-white p-5 shadow-cartao sm:p-7" novalidate @submit.prevent="enviarUma">
        <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
          <legend class="mb-3 text-xl font-bold">Quem vai entrar no plano?</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <OpcaoGrande v-model="quem" nome="quem" valor="titular" rotulo="Um funcionário" apoio="Ele será o titular" />
            <OpcaoGrande v-model="quem" nome="quem" valor="dependente" rotulo="Dependente de um funcionário" apoio="Cônjuge, filho(a)…" />
          </div>
        </fieldset>

        <template v-if="quem === 'dependente'">
          <div v-if="titular" class="flex items-center gap-3 rounded-2xl border-2 border-roxo bg-roxo-fundo p-4">
            <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-roxo font-display text-lg font-extrabold text-white">{{ titular.nome[0] }}</span>
            <span class="flex min-w-0 grow flex-col">
              <span class="text-sm font-semibold text-apoio">Dependente de</span>
              <span class="text-[18px] font-bold">{{ titular.nome }}</span>
              <span class="text-sm text-apoio">CPF {{ titular.cpf }}</span>
            </span>
            <button type="button" class="min-h-11 shrink-0 rounded-xl px-3 font-bold text-roxo-escuro underline" @click="titular = null">Trocar</button>
          </div>
          <div v-else class="flex flex-col gap-2">
            <label for="busca-titular" class="text-[17px] font-bold">De qual funcionário? <span class="text-erro" aria-hidden="true">*</span></label>
            <input
              id="busca-titular" v-model="buscaTitular" type="search" autocomplete="off" placeholder="Digite o nome ou o CPF do titular"
              class="h-14 rounded-2xl border-2 border-campo bg-white px-5 text-lg text-tinta placeholder:text-[#8a91a8] focus:border-roxo"
            >
            <ul v-if="sugestoesTitular.length" class="m-0 flex list-none flex-col gap-2 p-0">
              <li v-for="t in sugestoesTitular" :key="t.id">
                <button type="button" class="flex w-full flex-col rounded-2xl border-2 border-linha bg-white px-4 py-2.5 text-left hover:border-roxo" @click="escolherTitular(t)">
                  <span class="text-[17px] font-bold">{{ t.nome }}</span>
                  <span class="text-sm text-apoio">CPF {{ t.cpf }} · {{ t.dependentes.length }} dependente(s)</span>
                </button>
              </li>
            </ul>
            <p v-else-if="buscaTitular.length >= 2" class="m-0 text-base text-apoio">Nenhum titular encontrado. Se o funcionário também vai entrar agora, inclua os dois pela planilha.</p>
          </div>
        </template>

        <template v-if="quem && (quem === 'titular' || titular)">
          <CampoTexto id="nome" v-model="pessoa.nome" rotulo="Nome completo" />
          <div class="grid gap-5 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <label for="cpf-pessoa" class="text-[17px] font-bold">CPF <span class="text-erro" aria-hidden="true">*</span></label>
              <input
                id="cpf-pessoa" :value="pessoa.cpf" type="text" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"
                class="h-14 rounded-2xl border-2 border-campo bg-white px-5 text-lg text-tinta placeholder:text-[#8a91a8] focus:border-roxo"
                @input="aoDigitarCpf"
              >
            </div>
            <CampoTexto id="nascimento" v-model="pessoa.nascimento" rotulo="Data de nascimento" tipo="date" :max="hoje" />
          </div>
          <div class="grid gap-5 sm:grid-cols-2">
            <CampoSelecao v-if="quem === 'dependente'" id="parentesco" v-model="pessoa.parentesco" rotulo="Parentesco" :opcoes="opcoesParentesco" />
            <CampoSelecao id="plano" v-model="pessoa.plano" rotulo="Plano" :opcoes="opcoesPlano" />
          </div>
        </template>

        <MensagemErro :texto="erro" />
        <BotaoPrincipal v-if="quem" tipo="submit" :carregando="enviando">{{ enviando ? 'Enviando…' : 'Enviar pedido de inclusão' }}</BotaoPrincipal>
      </form>

      <!-- Planilha -->
      <template v-else>
        <template v-if="!conferencia">
          <ol class="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            <li class="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-cartao sm:p-6">
              <span class="flex size-10 items-center justify-center rounded-full bg-roxo font-display text-lg font-extrabold text-white">1</span>
              <h2 class="m-0 text-xl font-bold">Baixe o modelo</h2>
              <p class="m-0 grow text-base text-texto">
                Uma linha para cada pessoa. Parentesco e plano já vêm com a lista para escolher.
                A aba "Como preencher" explica tudo.
              </p>
              <a
                href="/api/empresa/planilha/modelo" download="modelo-inclusao.xlsx"
                class="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-roxo bg-white text-[17px] font-bold text-roxo-escuro no-underline hover:bg-roxo-fundo"
              >
                <Icone nome="baixar" :tamanho="22" /> Baixar modelo (Excel)
              </a>
            </li>
            <li class="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-cartao sm:p-6">
              <span class="flex size-10 items-center justify-center rounded-full bg-roxo font-display text-lg font-extrabold text-white">2</span>
              <h2 class="m-0 text-xl font-bold">Envie a planilha preenchida</h2>
              <p class="m-0 grow text-base text-texto">
                Antes de mandar o pedido, o portal confere linha por linha e mostra o que precisa corrigir.
                Até {{ LIMITE_LINHAS_PLANILHA }} pessoas por vez.
              </p>
              <input
                ref="campoArquivo" type="file" class="sr-only" aria-label="Escolher a planilha"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="aoEscolherPlanilha"
              >
              <BotaoPrincipal :carregando="enviando" @click="campoArquivo?.click()">
                <Icone v-if="!enviando" nome="documento" :tamanho="22" /> {{ enviando ? 'Conferindo…' : 'Escolher a planilha' }}
              </BotaoPrincipal>
            </li>
          </ol>
          <MensagemErro :texto="erro" />
        </template>

        <!-- Conferência -->
        <section v-else class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="m-0 text-xl font-bold">Conferimos a planilha "{{ conferencia.arquivo }}"</h2>
            <p class="m-0 text-base text-apoio">{{ pessoas(conferencia.linhas.length) }} na planilha</p>
          </div>
          <div class="grid grid-cols-2 gap-3 lg:max-w-[560px]">
            <div class="flex flex-col rounded-[20px] border-2 border-ok/30 bg-ok-claro p-4 text-ok">
              <span class="font-display text-[32px] leading-none font-extrabold">{{ conferencia.prontas }}</span>
              <span class="text-[15px] font-bold">prontas para enviar</span>
            </div>
            <div class="flex flex-col rounded-[20px] border-2 p-4" :class="conferencia.comProblema ? 'border-erro-borda bg-erro-claro text-erro' : 'border-linha bg-white text-apoio'">
              <span class="font-display text-[32px] leading-none font-extrabold">{{ conferencia.comProblema }}</span>
              <span class="text-[15px] font-bold">com problema</span>
            </div>
          </div>

          <p v-if="conferencia.comProblema" class="m-0 rounded-2xl bg-atencao-claro px-4 py-3 text-base text-atencao">
            As linhas com problema <b>não vão no pedido</b>. Você pode enviar as prontas agora e mandar as outras
            depois, numa nova planilha já corrigida. Ou corrigir tudo e enviar a planilha de novo.
          </p>

          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="m-0 text-lg font-bold">Linha por linha</h3>
            <label v-if="conferencia.comProblema && conferencia.prontas" class="flex min-h-11 cursor-pointer items-center gap-2 text-base font-semibold">
              <input v-model="soProblemas" type="checkbox" class="size-5 accent-roxo"> Mostrar só as com problema
            </label>
          </div>
          <ul class="m-0 flex max-h-[520px] list-none flex-col gap-2 overflow-y-auto p-0">
            <li
              v-for="l in linhasVisiveis" :key="l.linha"
              class="flex gap-3 rounded-2xl border-2 bg-white p-3.5"
              :class="l.erros.length ? 'border-erro-borda' : 'border-linha'"
            >
              <span class="flex h-8 min-w-12 shrink-0 items-center justify-center rounded-lg bg-fundo px-2 text-sm font-bold text-apoio">L{{ l.linha }}</span>
              <div class="flex min-w-0 grow flex-col gap-0.5">
                <span class="flex flex-wrap items-baseline gap-x-2">
                  <span class="text-[17px] font-bold">{{ l.nome || '(sem nome)' }}</span>
                  <span class="text-[15px] text-apoio">{{ l.parentesco }}<template v-if="l.cpfTitular"> de {{ l.cpfTitular }}</template></span>
                </span>
                <span class="text-sm text-apoio">CPF {{ l.cpf || '—' }} · {{ l.plano || 'sem plano' }}</span>
                <ul v-if="l.erros.length" class="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">
                  <li v-for="(e, i) in l.erros" :key="i" class="flex items-start gap-1.5 text-[15px] font-semibold text-erro">
                    <Icone nome="alerta" :tamanho="16" :espessura="2.4" class="mt-0.5 shrink-0" /> {{ e }}
                  </li>
                </ul>
              </div>
              <Icone v-if="!l.erros.length" nome="certo" :tamanho="22" :espessura="2.6" class="shrink-0 text-ok" />
            </li>
          </ul>

          <MensagemErro :texto="erro" />
          <div class="grid gap-3 sm:grid-cols-2 lg:max-w-[640px]">
            <BotaoPrincipal v-if="conferencia.prontas" :carregando="enviando" @click="enviarPlanilha">
              {{ enviando ? 'Enviando…' : `Enviar ${pessoas(conferencia.prontas)}` }}
            </BotaoPrincipal>
            <BotaoPrincipal variante="contorno" @click="conferencia = null; erro = ''">Enviar outra planilha</BotaoPrincipal>
          </div>
        </section>
      </template>
    </div>
  </main>
</template>
