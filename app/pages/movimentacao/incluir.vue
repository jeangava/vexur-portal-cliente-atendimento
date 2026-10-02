<script setup lang="ts">
import type { DadosInclusao, DeclaracaoSaude, MinhaFamilia, OpcoesMovimentacao, RespostasDps, Solicitacao } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Incluir beneficiário · Portal do Cliente' })

const PASSOS = ['Evento', 'Cadastro', 'Declaração de saúde', 'Plano & conferência', 'Finalização']
const [{ data: opcoes, error: erroOpcoes }, { data: familia }] = await Promise.all([
  useFetch<OpcoesMovimentacao>('/api/movimentacao/opcoes'),
  useFetch<MinhaFamilia>('/api/familia'),
])

const passo = ref(1)
const dados = reactive<Omit<DadosInclusao, 'documentos' | 'aceite' | 'declaracaoSaude'>>({
  evento: '', dataEvento: '', parentesco: '', temPlanoAnterior: '',
  planoAnterior: { tipo: '', operadora: '', plano: '', meses: '', ultimoPagamento: '' },
  nome: '', cpf: '', nascimento: '',
})
const errosEvento = ref<ErrosEvento>({})
const errosPessoa = ref<ErrosPessoa>({})
const documentos = ref<{ id: string, nome: string }[]>([])
const erroDocumento = ref('')
const dps = ref<DeclaracaoSaude | null>(null)
const respostasDps = ref<RespostasDps>({})
const errosDps = ref<Record<string, string>>({})
const carregandoDps = ref(false)
const erroDpsCarga = ref('')
const aceite = ref(false)
const erroEnvio = ref('')
const enviando = ref(false)
const pronto = ref<Solicitacao | null>(null)
const topo = ref<HTMLElement | null>(null)

const hoje = new Date().toISOString().slice(0, 10)
const parentescosDoCaminho = computed(() => (opcoes.value?.parentescos ?? []).filter(p => dados.evento === 'sim' ? !!p.evento : p.paraOutros))
const parentescoEscolhido = computed(() => opcoes.value?.parentescos.find(p => p.id === dados.parentesco))
const rotuloDataEvento = computed(() => parentescoEscolhido.value?.evento ? `Data do ${parentescoEscolhido.value.evento === 'tutela' ? 'início da tutela' : parentescoEscolhido.value.evento}` : 'Informe a data do evento')
const diasDoEvento = computed(() => dados.dataEvento ? diasDesde(dados.dataEvento) : 0)
const planoTitular = computed(() => familia.value?.titular.produtos[0])
const caracteristicasPlano = computed(() => {
  const p = planoTitular.value
  if (!p) return ''
  const partes = [p.acomodacao?.toLowerCase(), p.abrangencia?.toLowerCase()]
  if (p.coparticipacao !== undefined) partes.push(`${p.coparticipacao ? 'com' : 'sem'} coparticipação`)
  return partes.filter(Boolean).join(', ')
})
const tipoPlanoRotulo = computed(() => opcoes.value?.tiposPlanoAnterior.find(t => t.id === dados.planoAnterior.tipo)?.rotulo ?? '')
const primeiroNome = computed(() => dados.nome.trim().split(' ')[0] ?? '')
const doencasDeclaradas = computed(() => dps.value?.exigida ? respostasSim(dps.value.perguntas, respostasDps.value) : [])

// Trocar de caminho limpa o que não vale mais
watch(() => dados.evento, () => {
  if (!parentescosDoCaminho.value.some(p => p.id === dados.parentesco)) dados.parentesco = ''
  errosEvento.value = {}
})

function irPara(n: number) {
  passo.value = n
  erroEnvio.value = ''
  nextTick(() => topo.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function focarPrimeiroErro(erros: object, prefixo: string) {
  const campo = Object.keys(erros)[0]
  if (campo) nextTick(() => document.getElementById(`${prefixo}-${campo}`)?.focus())
}

function prosseguirEvento() {
  if (!opcoes.value) return
  errosEvento.value = validarEventoInclusao(dados, {
    parentescosEvento: opcoes.value.parentescos.filter(p => p.evento).map(p => p.id),
    parentescosOutros: opcoes.value.parentescos.filter(p => p.paraOutros).map(p => p.id),
    tiposPlanoAnterior: opcoes.value.tiposPlanoAnterior.map(t => t.id),
  })
  if (Object.keys(errosEvento.value).length) { focarPrimeiroErro(errosEvento.value, 'ev'); return }
  // Recém-nascido: a data do evento já é a data de nascimento
  if (dados.evento === 'sim' && dados.parentesco === 'filho' && !dados.nascimento) dados.nascimento = dados.dataEvento
  irPara(2)
}

function aoDigitarCpf(evento: Event) {
  const campo = evento.target as HTMLInputElement
  dados.cpf = formatarCpf(campo.value)
  campo.value = dados.cpf
  errosPessoa.value.cpf = undefined
}

function prosseguirCadastro() {
  errosPessoa.value = validarPessoaInclusao(dados)
  erroDocumento.value = documentos.value.length ? '' : 'Envie pelo menos um documento da pessoa.'
  if (Object.keys(errosPessoa.value).length) { focarPrimeiroErro(errosPessoa.value, 'pes'); return }
  if (erroDocumento.value) return
  carregarDeclaracaoSaude()
}

/** As perguntas dependem do evento e do parentesco (ex.: recém-nascido pode ser dispensado). */
async function carregarDeclaracaoSaude() {
  carregandoDps.value = true
  erroDpsCarga.value = ''
  try {
    dps.value = await $fetch<DeclaracaoSaude>('/api/movimentacao/declaracao-saude', {
      method: 'POST', body: { evento: dados.evento, parentesco: dados.parentesco, dataEvento: dados.dataEvento },
    })
    irPara(3)
  } catch (e) {
    erroDpsCarga.value = mensagemDeErro(e, 'Não conseguimos abrir a declaração de saúde agora. Tente de novo.')
  } finally {
    carregandoDps.value = false
  }
}

function responderDps(id: string, valor: string) {
  respostasDps.value[id] = valor
  if (!(id in errosDps.value)) return
  const resto = { ...errosDps.value }
  delete resto[id]
  errosDps.value = resto
}

function prosseguirDeclaracao() {
  if (dps.value?.exigida) {
    errosDps.value = validarDps(dps.value.perguntas, respostasDps.value)
    // Segue a ordem da tela: chaves numéricas ("1", "2") vêm antes das outras num objeto JS.
    const primeira = dps.value.perguntas.find(p => p.id in errosDps.value)
    if (primeira) { nextTick(() => document.getElementById(`dps-${primeira.id}`)?.focus()); return }
  }
  irPara(4)
}

async function enviar() {
  if (!aceite.value) { erroEnvio.value = 'Marque a confirmação para enviar.'; return }
  enviando.value = true
  erroEnvio.value = ''
  try {
    pronto.value = await $fetch<Solicitacao>('/api/movimentacao/inclusao', {
      method: 'POST',
      body: {
        ...dados, documentos: documentos.value.map(d => d.id),
        declaracaoSaude: dps.value?.exigida ? respostasDps.value : {}, aceite: aceite.value,
      },
    })
    irPara(5)
  } catch (e) {
    erroEnvio.value = mensagemDeErro(e)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <div ref="topo" class="flex scroll-mt-6 flex-col gap-2">
      <p class="m-0 flex items-center gap-2 text-[15px] font-semibold text-apoio">
        <NuxtLink to="/movimentacao" class="font-bold text-roxo-escuro no-underline hover:underline">Movimentação</NuxtLink>
        <Icone nome="avancar" :tamanho="14" :espessura="2.4" /> Inclusão
      </p>
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Incluir beneficiário</h1>
      <p class="m-0 text-lg text-texto">Adicione um novo dependente ao plano. Tenha os documentos em mãos.</p>
    </div>

    <MensagemErro v-if="erroOpcoes" :texto="mensagemDeErro(erroOpcoes, 'Não conseguimos abrir este pedido agora.')" />

    <template v-if="opcoes">
      <IndicadorPassos :atual="passo" :passos="PASSOS" />

      <div class="flex flex-col gap-[22px] lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-8">
        <div class="flex min-w-0 flex-col gap-[22px]">
          <!-- ===================== 1. EVENTO ===================== -->
          <template v-if="passo === 1">
            <section class="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
              <div class="flex items-start gap-3.5 border-b border-linha pb-5">
                <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-roxo-claro text-roxo-icone"><Icone nome="familia" :tamanho="26" /></span>
                <div>
                  <h2 id="ev-evento" tabindex="-1" class="m-0 text-xl font-bold">Qual tipo de inclusão você deseja fazer?</h2>
                  <p class="m-0 text-base text-texto">Informe o evento que deu origem à inclusão do novo beneficiário.</p>
                </div>
              </div>
              <fieldset class="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2">
                <legend class="sr-only">Tipo de inclusão</legend>
                <OpcaoGrande v-model="dados.evento" nome="evento" valor="sim" rotulo="Sim, é recém-nascido, casamento ou tutela" apoio="Inclua o dependente após o evento." />
                <OpcaoGrande v-model="dados.evento" nome="evento" valor="nao" rotulo="Não" apoio="Para outros tipos de dependente." />
              </fieldset>
              <MensagemErro :texto="errosEvento.evento ?? ''" />
            </section>

            <!-- Caminho "Não": pergunta se tem plano anterior (quadro da figura) -->
            <section v-if="dados.evento === 'nao'" class="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
              <div class="flex items-start gap-3.5 border-b border-linha pb-5">
                <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-roxo-claro text-roxo-icone"><Icone nome="documento" :tamanho="26" /></span>
                <h2 id="ev-temPlanoAnterior" tabindex="-1" class="m-0 self-center text-xl font-bold">O dependente possui ou já possuiu plano de saúde?</h2>
              </div>
              <fieldset class="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2">
                <legend class="sr-only">O dependente possui ou já possuiu plano de saúde?</legend>
                <OpcaoGrande v-model="dados.temPlanoAnterior" nome="tem-plano" valor="sim" rotulo="Sim, possui" @update:model-value="errosEvento.temPlanoAnterior = undefined" />
                <OpcaoGrande v-model="dados.temPlanoAnterior" nome="tem-plano" valor="nao" rotulo="Não possui" @update:model-value="errosEvento.temPlanoAnterior = undefined" />
              </fieldset>
              <MensagemErro :texto="errosEvento.temPlanoAnterior ?? ''" />
            </section>

            <form
              v-if="dados.evento === 'sim' || (dados.evento === 'nao' && dados.temPlanoAnterior)"
              class="flex flex-col gap-6 rounded-3xl bg-white p-5 shadow-cartao sm:p-7" novalidate @submit.prevent="prosseguirEvento"
            >
              <!-- Caminho "Sim": dados iniciais do evento -->
              <div v-if="dados.evento === 'sim'" class="grid gap-5 sm:grid-cols-2">
                <CampoSelecao
                  id="ev-parentesco" v-model="dados.parentesco" rotulo="Selecione o parentesco" :opcoes="parentescosDoCaminho"
                  ajuda="Parentesco é o que o dependente é do titular do plano."
                  :erro="errosEvento.parentesco" @update:model-value="errosEvento.parentesco = undefined"
                />
                <CampoTexto
                  id="ev-dataEvento" v-model="dados.dataEvento" tipo="date" :max="hoje" min="1900-01-01" :rotulo="rotuloDataEvento"
                  ajuda="A data do evento é a data de nascimento, do casamento ou da tutela."
                  :erro="errosEvento.dataEvento" @update:model-value="errosEvento.dataEvento = undefined"
                />
              </div>
              <div v-if="dados.evento === 'sim' && diasDoEvento > DIAS_INCLUSAO_POR_EVENTO" class="flex items-start gap-3 rounded-[18px] border-2 border-atencao-borda bg-atencao-claro px-4 py-3.5 text-atencao">
                <Icone nome="alerta" :espessura="2.2" class="mt-0.5" />
                <span class="text-base font-semibold">
                  Já se passaram {{ diasDoEvento }} dias do evento. Depois de {{ DIAS_INCLUSAO_POR_EVENTO }} dias, a inclusão pode ter carências, conforme o contrato.
                </span>
              </div>

              <!-- Caminho "Não": parentesco e, se tiver plano anterior, os dados dele -->
              <template v-if="dados.evento === 'nao'">
                <div class="sm:max-w-[calc(50%-10px)]">
                  <CampoSelecao
                    id="ev-parentesco" v-model="dados.parentesco" rotulo="Selecione o parentesco" :opcoes="parentescosDoCaminho"
                    ajuda="Parentesco é o que o dependente é do titular do plano."
                    :erro="errosEvento.parentesco" @update:model-value="errosEvento.parentesco = undefined"
                  />
                </div>

                <section v-if="dados.temPlanoAnterior === 'sim'" class="flex flex-col gap-5 border-t border-linha pt-6">
                  <div class="flex items-start gap-3.5">
                    <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-roxo-claro text-roxo-icone"><Icone nome="documento" :tamanho="26" /></span>
                    <div>
                      <h3 class="m-0 text-xl font-bold">Dados do plano anterior</h3>
                      <p class="m-0 text-base text-texto">Informe os dados do plano que o dependente possuiu antes de iniciar o cadastro.</p>
                    </div>
                  </div>
                  <div class="grid gap-5 sm:grid-cols-2">
                    <CampoSelecao
                      id="ev-tipoPlano" v-model="dados.planoAnterior.tipo" rotulo="Tipo do plano anterior" :opcoes="opcoes.tiposPlanoAnterior"
                      :erro="errosEvento.tipoPlano" @update:model-value="errosEvento.tipoPlano = undefined"
                    />
                    <CampoTexto id="ev-operadora" v-model="dados.planoAnterior.operadora" rotulo="Operadora anterior" placeholder="Nome da operadora" :erro="errosEvento.operadora" @update:model-value="errosEvento.operadora = undefined" />
                    <CampoTexto id="ev-plano" v-model="dados.planoAnterior.plano" rotulo="Plano anterior" placeholder="Nome do plano" :erro="errosEvento.plano" @update:model-value="errosEvento.plano = undefined" />
                    <CampoTexto id="ev-meses" v-model="dados.planoAnterior.meses" rotulo="Tempo de plano" inputmode="numeric" sufixo="meses" placeholder="Ex.: 24" :maxlength="4" :erro="errosEvento.meses" @update:model-value="errosEvento.meses = undefined" />
                    <CampoTexto id="ev-ultimoPagamento" v-model="dados.planoAnterior.ultimoPagamento" tipo="date" :max="hoje" rotulo="Data do último pagamento" :erro="errosEvento.ultimoPagamento" @update:model-value="errosEvento.ultimoPagamento = undefined" />
                  </div>
                </section>
              </template>

              <div class="sm:w-[260px]">
                <BotaoPrincipal tipo="submit">Prosseguir <Icone nome="seta" :tamanho="22" :espessura="2.4" /></BotaoPrincipal>
              </div>
            </form>
          </template>

          <!-- ===================== 2. CADASTRO ===================== -->
          <form v-else-if="passo === 2" class="flex flex-col gap-6 rounded-3xl bg-white p-5 shadow-cartao sm:p-7" novalidate @submit.prevent="prosseguirCadastro">
            <div class="flex items-start gap-3.5 border-b border-linha pb-5">
              <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-roxo-claro text-roxo-icone"><Icone nome="carteirinha" :tamanho="26" /></span>
              <div>
                <h2 class="m-0 text-xl font-bold">Dados do dependente</h2>
                <p class="m-0 text-base text-texto">Preencha como está no documento da pessoa.</p>
              </div>
            </div>

            <CampoTexto id="pes-nome" v-model="dados.nome" rotulo="Nome completo" placeholder="Nome e sobrenome" :erro="errosPessoa.nome" @update:model-value="errosPessoa.nome = undefined" />
            <div class="grid gap-5 sm:grid-cols-2">
              <div class="flex flex-col gap-2">
                <label for="pes-cpf" class="text-[17px] font-bold">CPF <span class="text-erro" aria-hidden="true">*</span></label>
                <input
                  id="pes-cpf" :value="dados.cpf" type="text" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="14"
                  :aria-invalid="!!errosPessoa.cpf" :aria-describedby="errosPessoa.cpf ? 'pes-cpf-erro' : undefined"
                  class="h-16 rounded-2xl border-2 bg-white px-5 text-xl font-semibold tracking-wide text-tinta placeholder:font-normal placeholder:text-[#8a91a8] focus:border-roxo"
                  :class="errosPessoa.cpf ? 'border-erro bg-erro-claro/40' : 'border-campo'" @input="aoDigitarCpf"
                >
                <MensagemErro id="pes-cpf-erro" :texto="errosPessoa.cpf ?? ''" />
              </div>
              <CampoTexto
                id="pes-nascimento" v-model="dados.nascimento" tipo="date" :max="hoje" min="1900-01-01" rotulo="Data de nascimento"
                :erro="errosPessoa.nascimento" @update:model-value="errosPessoa.nascimento = undefined"
              />
            </div>

            <section class="flex flex-col gap-3 border-t border-linha pt-6">
              <h3 class="m-0 text-lg font-bold">Documento da pessoa <span class="text-erro" aria-hidden="true">*</span></h3>
              <p class="m-0 text-base text-texto">
                Foto do RG, da CNH ou da certidão de nascimento.
                <template v-if="dados.parentesco === 'conjuge'">Envie também a certidão de casamento ou de união.</template>
                <template v-if="dados.parentesco === 'tutelado'">Envie também o termo de tutela.</template>
              </p>
              <EnvioDocumentos v-model="documentos" :erro="erroDocumento" @enviado="erroDocumento = ''" />
            </section>

            <div class="flex flex-col-reverse gap-3 sm:flex-row">
              <div class="sm:w-[160px]"><BotaoPrincipal variante="contorno" @click="irPara(1)">Voltar</BotaoPrincipal></div>
              <div class="sm:w-[260px]">
                <BotaoPrincipal tipo="submit" :carregando="carregandoDps">
                  {{ carregandoDps ? 'Abrindo…' : 'Prosseguir' }} <Icone v-if="!carregandoDps" nome="seta" :tamanho="22" :espessura="2.4" />
                </BotaoPrincipal>
              </div>
            </div>
            <MensagemErro :texto="erroDpsCarga" />
          </form>

          <!-- ===================== 3. DECLARAÇÃO DE SAÚDE ===================== -->
          <form v-else-if="passo === 3 && dps" class="flex flex-col gap-5" novalidate @submit.prevent="prosseguirDeclaracao">
            <div class="flex items-start gap-3.5 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
              <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-roxo-claro text-roxo-icone"><Icone nome="escudo" :tamanho="26" /></span>
              <div>
                <h2 class="m-0 text-xl font-bold">Declaração de saúde de {{ primeiroNome }}</h2>
                <p class="m-0 text-base text-texto">Algumas perguntas rápidas sobre a saúde de quem vai entrar no plano.</p>
              </div>
            </div>

            <section v-if="!dps.exigida" class="flex items-start gap-3.5 rounded-3xl bg-white p-6 shadow-cartao">
              <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :espessura="2.6" /></span>
              <div class="flex flex-col gap-1">
                <span class="text-lg font-bold">Não é preciso preencher</span>
                <span class="text-base text-texto">{{ dps.motivoDispensa }}</span>
              </div>
            </section>
            <DeclaracaoSaudeForm
              v-else :respostas="respostasDps" :perguntas="dps.perguntas" :nome-pessoa="primeiroNome" :erros="errosDps"
              @responder="responderDps"
            />

            <MensagemErro v-if="Object.keys(errosDps).length" :texto="`Faltam ${Object.keys(errosDps).length} ${Object.keys(errosDps).length === 1 ? 'resposta' : 'respostas'}. Veja os campos marcados em vermelho.`" />
            <div class="flex flex-col-reverse gap-3 sm:flex-row">
              <div class="sm:w-[160px]"><BotaoPrincipal variante="contorno" @click="irPara(2)">Voltar</BotaoPrincipal></div>
              <div class="sm:w-[260px]"><BotaoPrincipal tipo="submit">Prosseguir <Icone nome="seta" :tamanho="22" :espessura="2.4" /></BotaoPrincipal></div>
            </div>
          </form>

          <!-- ===================== 4. PLANO & CONFERÊNCIA ===================== -->
          <form v-else-if="passo === 4" class="flex flex-col gap-6 rounded-3xl bg-white p-5 shadow-cartao sm:p-7" novalidate @submit.prevent="enviar">
            <section v-if="planoTitular" class="flex flex-col gap-3 rounded-[20px] border-2 border-roxo-borda bg-roxo-fundo p-5">
              <span class="text-sm font-bold text-roxo-escuro">Plano do dependente</span>
              <div class="text-xl font-bold">{{ planoTitular.nome }}</div>
              <p class="m-0 text-base text-texto">
                O dependente entra no mesmo plano do titular<template v-if="caracteristicasPlano">: {{ caracteristicasPlano }}</template>.
              </p>
              <p class="m-0 text-base text-texto">O valor dele é calculado na análise e passa a vir na sua conta.</p>
            </section>

            <h2 class="m-0 text-xl font-bold">Confira os dados antes de enviar</h2>
            <dl class="m-0 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Tipo de inclusão</dt><dd class="m-0 text-[17px] font-bold">{{ dados.evento === 'sim' ? `Por evento (${parentescoEscolhido?.evento})` : 'Outro tipo de dependente' }}</dd></div>
              <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Parentesco</dt><dd class="m-0 text-[17px] font-bold">{{ parentescoEscolhido?.rotulo }}</dd></div>
              <div v-if="dados.evento === 'sim'" class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Data do evento</dt><dd class="m-0 text-[17px] font-bold">{{ formatarData(dados.dataEvento) }}</dd></div>
              <div v-else-if="dados.temPlanoAnterior === 'nao'" class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Plano anterior</dt><dd class="m-0 text-[17px] font-bold">Não possui</dd></div>
              <template v-else>
                <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Plano anterior</dt><dd class="m-0 text-[17px] font-bold">{{ dados.planoAnterior.plano }} · {{ dados.planoAnterior.operadora }}</dd></div>
                <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Tipo e tempo</dt><dd class="m-0 text-[17px] font-bold">{{ tipoPlanoRotulo }} · {{ dados.planoAnterior.meses }} meses</dd></div>
                <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Último pagamento</dt><dd class="m-0 text-[17px] font-bold">{{ formatarData(dados.planoAnterior.ultimoPagamento) }}</dd></div>
              </template>
              <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Nome</dt><dd class="m-0 text-[17px] font-bold">{{ dados.nome }}</dd></div>
              <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">CPF</dt><dd class="m-0 text-[17px] font-bold">{{ dados.cpf }}</dd></div>
              <div class="rounded-2xl bg-fundo p-3.5"><dt class="text-sm font-semibold text-apoio">Nascimento</dt><dd class="m-0 text-[17px] font-bold">{{ formatarData(dados.nascimento) }}</dd></div>
              <div class="rounded-2xl bg-fundo p-3.5 sm:col-span-2"><dt class="text-sm font-semibold text-apoio">Documentos</dt><dd class="m-0 text-[17px] font-bold">{{ documentos.map(d => d.nome).join(', ') }}</dd></div>
              <div class="rounded-2xl bg-fundo p-3.5 sm:col-span-2">
                <dt class="text-sm font-semibold text-apoio">Declaração de saúde</dt>
                <dd v-if="!dps?.exigida" class="m-0 text-[17px] font-bold">Dispensada</dd>
                <dd v-else-if="!doencasDeclaradas.length" class="m-0 text-[17px] font-bold">Preenchida · nenhuma doença informada</dd>
                <dd v-else class="m-0 flex flex-col gap-1 text-[17px] font-bold">
                  <span>Preenchida · {{ doencasDeclaradas.length }} {{ doencasDeclaradas.length === 1 ? 'resposta "Sim"' : 'respostas "Sim"' }}:</span>
                  <span v-for="p in doencasDeclaradas" :key="p.id" class="font-semibold text-texto">• {{ p.pergunta }}</span>
                </dd>
              </div>
            </dl>

            <label class="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-[#e3e4ed] p-4 has-[:checked]:border-roxo has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-roxo">
              <input v-model="aceite" type="checkbox" class="mt-0.5 size-6 shrink-0 accent-roxo" @change="erroEnvio = ''">
              <span class="text-[17px]">Declaro que as informações, inclusive as da declaração de saúde, são verdadeiras e autorizo a inclusão desta pessoa no meu plano.</span>
            </label>
            <MensagemErro :texto="erroEnvio" />
            <div class="flex flex-col-reverse gap-3 sm:flex-row">
              <div class="sm:w-[160px]"><BotaoPrincipal variante="contorno" @click="irPara(3)">Voltar</BotaoPrincipal></div>
              <div class="sm:w-[260px]"><BotaoPrincipal tipo="submit" :carregando="enviando">{{ enviando ? 'Enviando…' : 'Enviar pedido' }}</BotaoPrincipal></div>
            </div>
          </form>

          <!-- ===================== 5. FINALIZAÇÃO ===================== -->
          <section v-else-if="pronto" role="status" class="flex flex-col items-center gap-3 rounded-3xl bg-white p-7 text-center shadow-cartao">
            <span class="flex size-[76px] items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :tamanho="40" :espessura="2.6" /></span>
            <h2 class="m-0 font-display text-2xl font-extrabold">Pedido enviado!</h2>
            <p class="m-0 text-lg">Protocolo <b class="font-display text-xl">{{ pronto.protocolo }}</b></p>
            <p class="m-0 text-[17px] text-texto">{{ pronto.detalhe }}</p>
            <div class="mt-2 w-full max-w-[360px]"><BotaoPrincipal to="/movimentacao">Ver minhas solicitações</BotaoPrincipal></div>
          </section>
        </div>

        <!-- Painel lateral -->
        <aside class="flex flex-col gap-3 rounded-3xl bg-verde-claro p-6 text-tinta">
          <span class="flex size-11 items-center justify-center rounded-xl bg-white text-roxo-icone"><Icone nome="info" :tamanho="22" /></span>
          <h2 class="m-0 text-lg font-bold">Antes de começar</h2>
          <ul class="m-0 flex list-none flex-col gap-2.5 p-0 text-base text-texto">
            <li class="flex gap-2.5"><Icone nome="certo" :tamanho="18" :espessura="2.6" class="mt-1 text-ok" /> Tenha os documentos do dependente em mãos.</li>
            <li class="flex gap-2.5"><Icone nome="certo" :tamanho="18" :espessura="2.6" class="mt-1 text-ok" /> Confira os dados antes de enviar.</li>
            <li class="flex gap-2.5"><Icone nome="certo" :tamanho="18" :espessura="2.6" class="mt-1 text-ok" /> O protocolo é gerado no final.</li>
          </ul>
        </aside>
      </div>
    </template>
  </main>
</template>
