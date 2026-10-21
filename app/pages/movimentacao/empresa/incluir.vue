<script setup lang="ts">
import type { PlanoAnterior } from '#shared/utils/planoAnterior'
import type { AvaliacaoDoEvento, DecisaoDeclaracaoDoDependente, TipoDeEvento } from '#shared/utils/eventoDeInclusao'
import type { BeneficiariosEmpresa, ConferenciaPlanilha, DadosPessoaisInclusao, DecisaoDeMovimentacao, FamiliaDaEmpresa, ParentescoDaInclusao, SimulacaoInclusao, Solicitacao, TitularEmpresa } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Incluir pessoas · Portal do Cliente' })

const { data: empresa, error } = await useFetch<BeneficiariosEmpresa>('/api/empresa/beneficiarios')
const { data: regras } = await useFetch<DecisaoDeMovimentacao[]>('/api/movimentacao/regras', { default: () => [] })
const libera = (tipo: DecisaoDeMovimentacao['tipo']) => (regras.value ?? []).some(d => d.tipo === tipo && d.disponivel)
const podeTitular = computed(() => libera('incluir-titular'))
const podeDependente = computed(() => libera('incluir-dependente'))

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

// Cadastro completo de quem entra (o mesmo que as pessoas atuais têm). Obrigatórios: sexo, estado civil, nome da mãe e CNS.
const cadastro = reactive<DadosPessoaisInclusao>({
  sexo: '', estadoCivil: '', nomeMae: '', naoPossuiNomeMae: false, naturalidade: '', rg: '', orgaoExpedidor: '', ufRg: '',
  pisPasep: '', cartaoSus: '', declaracaoNascidoVivo: '',
})
const opcoesSexo = SEXOS.map(s => ({ id: s, rotulo: s }))
const opcoesEstadoCivil = ESTADOS_CIVIS.map(s => ({ id: s, rotulo: s }))
const opcoesOrgao = ORGAOS_EXPEDIDORES.map(s => ({ id: s, rotulo: s }))
const opcoesUf = UFS.map(s => ({ id: s, rotulo: s }))
function aoDigitarNumeros(campo: 'cartaoSus' | 'pisPasep' | 'declaracaoNascidoVivo', tamanho: number, evento: Event) {
  const el = evento.target as HTMLInputElement
  cadastro[campo] = somenteDigitos(el.value).slice(0, tamanho)
  el.value = cadastro[campo]
}

// Quanto a família paga hoje e quanto passa a pagar com a pessoa (tabela de preço do Vexur).
const simulacao = ref<SimulacaoInclusao | null>(null)
const simulando = ref(false)
const erroSimulacao = ref('')
let ultimaSimulacao = 0
async function simular() {
  if (quem.value !== 'dependente' || !titular.value) { simulacao.value = null; return }
  const vez = ++ultimaSimulacao
  simulando.value = true
  erroSimulacao.value = ''
  try {
    const r = await $fetch<SimulacaoInclusao>('/api/empresa/inclusao-simulacao', {
      method: 'POST',
      body: { titularId: titular.value.id, parentesco: pessoa.parentesco, nome: pessoa.nome, sexo: cadastro.sexo, estadoCivil: cadastro.estadoCivil, nascimento: pessoa.nascimento },
    })
    if (vez === ultimaSimulacao) simulacao.value = r
  } catch (e) {
    if (vez === ultimaSimulacao) { simulacao.value = null; erroSimulacao.value = mensagemDeErro(e, 'Não conseguimos buscar os valores agora.') }
  } finally {
    if (vez === ultimaSimulacao) simulando.value = false
  }
}
let esperaSimulacao: ReturnType<typeof setTimeout> | undefined
watch([titular, () => pessoa.parentesco, () => pessoa.nascimento, () => cadastro.sexo, () => cadastro.estadoCivil], () => {
  clearTimeout(esperaSimulacao)
  esperaSimulacao = setTimeout(simular, 500)
})
onBeforeUnmount(() => clearTimeout(esperaSimulacao))
const reais = (n: number) => formatarMoeda(n)

// Antes dos dados: é inclusão por EVENTO (recém-nascido, recém-casado, recém-tutelado)? Passou do prazo vira inclusão comum.
type Avaliacao = { tipoDeEvento: TipoDeEvento | null, evento: AvaliacaoDoEvento | null, declaracao: DecisaoDeclaracaoDoDependente }
const tipoInclusao = ref<'' | 'evento' | 'comum'>('')
const dataDoEvento = ref('')
const avaliacao = ref<Avaliacao | null>(null)
const avaliando = ref(false)
const erroAvaliacao = ref('')
const parentescosComEvento = computed(() => opcoesParentesco.value.filter(p => eventoDoParentesco(p.id)))
const rotuloDoEvento = computed(() => ROTULO_DO_EVENTO[eventoDoParentesco(pessoa.parentesco) ?? 'RN'])
// Inclusão comum (ou evento fora do prazo): pergunta se a pessoa teve plano de saúde antes, como o CRM.
const comoComum = computed(() => tipoInclusao.value === 'comum' || (tipoInclusao.value === 'evento' && !!avaliacao.value?.evento && !avaliacao.value.evento.valeComoEvento))
const possuiPlanoAnterior = ref<'' | 'sim' | 'nao'>('')
const planoAnterior = reactive<PlanoAnterior>({ tipo: '', operadora: '', plano: '', tempoMeses: '', ultimoPagamento: '' })
const opcoesTipoPlanoAnterior = TIPOS_DE_PLANO_ANTERIOR.map(s => ({ id: s, rotulo: s }))
const planoAnteriorResolvido = computed(() => !comoComum.value || possuiPlanoAnterior.value === 'nao' || (possuiPlanoAnterior.value === 'sim' && !problemaNoPlanoAnterior(planoAnterior)))
// Os dados da pessoa abrem depois de responder o tipo de inclusão (e o plano anterior, quando perguntado).
const etapaPronta = computed(() => !!avaliacao.value && planoAnteriorResolvido.value)
// A declaração de saúde ainda não existe no portal: dá para preencher, mas o envio fica travado.
const bloqueadoPorDeclaracao = computed(() => !!avaliacao.value?.declaracao.pedir)
const mostrarDados = computed(() => quem.value === 'titular' || (quem.value === 'dependente' && !!titular.value && etapaPronta.value))
const eventoDaInclusao = computed(() => (avaliacao.value?.evento?.valeComoEvento ? dataDoEvento.value : undefined))
async function avaliar() {
  if (!titular.value) return
  erroAvaliacao.value = ''
  if (tipoInclusao.value === 'evento') {
    if (!pessoa.parentesco) { erroAvaliacao.value = 'Escolha o parentesco.'; return }
    if (!dataDoEvento.value || dataDoEvento.value > hoje) { erroAvaliacao.value = 'Informe a data do evento (não pode ser no futuro).'; return }
  }
  avaliando.value = true
  try {
    avaliacao.value = await $fetch<Avaliacao>('/api/empresa/inclusao-avaliacao', {
      method: 'POST',
      body: { titularId: titular.value.id, parentesco: tipoInclusao.value === 'evento' ? pessoa.parentesco : '', evento: tipoInclusao.value === 'evento', dataEvento: dataDoEvento.value },
    })
  } catch (e) {
    avaliacao.value = null
    erroAvaliacao.value = mensagemDeErro(e, 'Não conseguimos conferir agora. Tente de novo.')
  } finally {
    avaliando.value = false
  }
}
watch(tipoInclusao, (v) => { avaliacao.value = null; erroAvaliacao.value = ''; possuiPlanoAnterior.value = ''; if (v === 'comum') void avaliar() })
watch(titular, () => { tipoInclusao.value = ''; avaliacao.value = null; dataDoEvento.value = ''; erroAvaliacao.value = ''; possuiPlanoAnterior.value = '' })

// Início do plano: datas do calendário do Vexur, sempre no mesmo dia da vigência do titular.
const vigencias = ref<{ dia?: number, datas: { iso: string, rotulo: string }[] } | null>(null)
const inicioEscolhido = ref('')
const erroVigencias = ref('')
async function carregarVigencias() {
  vigencias.value = null
  inicioEscolhido.value = ''
  erroVigencias.value = ''
  if (quem.value !== 'dependente' || !titular.value) return
  try {
    vigencias.value = await $fetch<{ dia?: number, datas: { iso: string, rotulo: string }[] }>(`/api/empresa/inclusao-vigencias?titular=${encodeURIComponent(titular.value.id)}`)
    if (vigencias.value?.datas.length === 1) inicioEscolhido.value = vigencias.value.datas[0]!.iso
  } catch (e) {
    erroVigencias.value = mensagemDeErro(e, 'Não conseguimos buscar as datas de início agora.')
  }
}
watch(titular, carregarVigencias)
const opcoesInicio = computed(() => (vigencias.value?.datas ?? []).map(d => ({ id: d.iso, rotulo: d.rotulo })))

// Parentescos e documentos vêm da regra de aceitação de beneficiário (o que está marcado como movimentação cadastral).
const { data: aceitos } = await useFetch<ParentescoDaInclusao[]>('/api/empresa/inclusao-regras', { default: () => [] })
const opcoesParentesco = computed(() => (aceitos.value ?? []).map(p => ({ id: p.parentesco, rotulo: p.parentesco })))
const opcoesDeDocumentos = computed(() => (aceitos.value ?? []).find(p => p.parentesco === pessoa.parentesco)?.documentos ?? [])
// A pessoa cumpre UMA opção de documentos; cada documento da opção é anexado na hora do pedido.
const opcaoDeDocumentos = ref('0')
const documentosDaOpcao = computed(() => opcoesDeDocumentos.value[Number(opcaoDeDocumentos.value)] ?? [])
const anexosPorDocumento = reactive<Record<string, { id: string, nome: string }[]>>({})
watch([() => pessoa.parentesco, opcaoDeDocumentos], () => {
  if (!opcoesDeDocumentos.value[Number(opcaoDeDocumentos.value)]) opcaoDeDocumentos.value = '0'
  for (const d of documentosDaOpcao.value) anexosPorDocumento[d] ??= []
}, { immediate: true })
const faltaDocumento = computed(() => quem.value === 'dependente' && !!pessoa.parentesco && documentosDaOpcao.value.some(d => !anexosPorDocumento[d]?.length))

// O botão de enviar só aparece com tudo preenchido; até lá, a tela diz o que falta.
const faltando = computed(() => {
  const f: string[] = []
  if (!quem.value) return f
  const dep = quem.value === 'dependente'
  if (dep && !pessoa.parentesco) f.push('o parentesco')
  if (pessoa.nome.trim().split(/\s+/).filter(Boolean).length < 2) f.push('o nome completo')
  if (!cpfValido(somenteDigitos(pessoa.cpf))) f.push('um CPF válido')
  if (!pessoa.nascimento) f.push('a data de nascimento')
  if (!dep && !pessoa.plano) f.push('o plano')
  if (dep && !eventoDaInclusao.value && !inicioEscolhido.value) f.push('o início do plano')
  if (!cadastro.sexo) f.push('o sexo')
  if (!cadastro.estadoCivil) f.push('o estado civil')
  if (!cadastro.naoPossuiNomeMae && !cadastro.nomeMae.trim()) f.push('o nome da mãe')
  if (somenteDigitos(cadastro.cartaoSus).length !== 15) f.push('o Cartão Nacional de Saúde (15 números)')
  if (dep && faltaDocumento.value) f.push('os documentos')
  return f
})
const opcoesPlano = computed(() => (empresa.value?.planos ?? []).map(p => ({ id: p, rotulo: p })))

// Lista dos titulares ativos, sempre visível; a busca só afunila (nome, ou CPF quando o sistema já trouxe).
const POR_PAGINA_TITULAR = 30
const quantosTitulares = ref(POR_PAGINA_TITULAR)
const titularesAtivos = computed(() => (empresa.value?.titulares ?? []).filter(t => t.situacao === 'ativo'))
const titularesFiltrados = computed(() => {
  const termo = normalizarTexto(buscaTitular.value)
  const digitos = somenteDigitos(buscaTitular.value)
  if (!termo) return titularesAtivos.value
  return titularesAtivos.value.filter(t =>
    normalizarTexto(t.nome).includes(termo) || (digitos.length >= 3 && somenteDigitos(t.cpf).includes(digitos)),
  )
})
const titularesVisiveis = computed(() => titularesFiltrados.value.slice(0, quantosTitulares.value))
watch(buscaTitular, () => { quantosTitulares.value = POR_PAGINA_TITULAR })

// Na lista sob demanda, o CPF do titular só vem com a família aberta: busca ao escolher.
const abrindoTitular = ref('')
async function escolherTitular(t: TitularEmpresa) {
  if (abrindoTitular.value) return
  erro.value = ''
  let escolhido = t
  if (!t.cpf) {
    abrindoTitular.value = t.id
    try {
      escolhido = (await $fetch<FamiliaDaEmpresa>(`/api/empresa/familia/${encodeURIComponent(t.id)}`)).titular as TitularEmpresa
      // O id da lista (número do contrato) é o que o servidor reconhece; o da família é de outra coisa.
      escolhido = { ...t, ...escolhido, id: t.id }
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não conseguimos abrir esse funcionário agora. Tente de novo.')
      return
    } finally {
      abrindoTitular.value = ''
    }
  }
  titular.value = escolhido
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
  if (faltaDocumento.value) { erro.value = 'Anexe todos os documentos pedidos antes de enviar.'; return }
  const problemaCadastro = problemaNosDadosPessoais(cadastro)
  if (problemaCadastro) { erro.value = problemaCadastro; return }
  if (quem.value === 'dependente' && !eventoDaInclusao.value && !inicioEscolhido.value) { erro.value = 'Escolha a data de início do plano.'; return }
  enviando.value = true
  try {
    pronto.value = await $fetch<Solicitacao>('/api/empresa/inclusao', {
      method: 'POST',
      body: {
        ...pessoa,
        parentesco: quem.value === 'titular' ? PARENTESCO_TITULAR : pessoa.parentesco,
        cpfTitular: quem.value === 'dependente' ? titular.value?.cpf : '',
        titularId: quem.value === 'dependente' ? titular.value?.id : undefined,
        inicio: quem.value === 'dependente' && !eventoDaInclusao.value ? inicioEscolhido.value : undefined,
        eventoData: quem.value === 'dependente' ? eventoDaInclusao.value : undefined,
        planoAnterior: quem.value === 'dependente' && comoComum.value && possuiPlanoAnterior.value === 'sim' ? { ...planoAnterior } : undefined,
        dadosPessoais: { ...cadastro },
        anexos: quem.value === 'dependente' ? documentosDaOpcao.value.map(d => ({ documento: d, ids: (anexosPorDocumento[d] ?? []).map(a => a.id) })) : [],
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
            <OpcaoGrande v-if="podeTitular" v-model="quem" nome="quem" valor="titular" rotulo="Um funcionário" apoio="Ele será o titular" />
            <div v-else class="flex min-h-[76px] cursor-not-allowed flex-col justify-center rounded-[22px] bg-fundo px-5 py-3 opacity-70" aria-disabled="true">
              <span class="text-[18px] font-bold text-apoio">Um funcionário</span>
              <span class="text-[15px] text-apoio">Não liberado para o seu plano. Fale com a gente.</span>
            </div>
            <OpcaoGrande v-if="podeDependente" v-model="quem" nome="quem" valor="dependente" rotulo="Dependente de um funcionário" apoio="Cônjuge, filho(a)…" />
            <div v-else class="flex min-h-[76px] cursor-not-allowed flex-col justify-center rounded-[22px] bg-fundo px-5 py-3 opacity-70" aria-disabled="true">
              <span class="text-[18px] font-bold text-apoio">Dependente de um funcionário</span>
              <span class="text-[15px] text-apoio">Não liberado para o seu plano. Fale com a gente.</span>
            </div>
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
          <!-- Antes dos dados: tipo de inclusão (evento ou comum) -->
          <fieldset v-if="titular" class="m-0 flex flex-col gap-4 rounded-[22px] border-2 border-roxo-borda bg-roxo-fundo p-5">
            <legend class="mb-1 px-1 text-xl font-bold">Qual tipo de inclusão?</legend>
            <p class="m-0 text-base text-apoio">Informe se a pessoa entra por um fato novo: nascimento, casamento ou tutela.</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <OpcaoGrande v-model="tipoInclusao" nome="tipo-inclusao" valor="evento" rotulo="Sim, é recém-nascido, casado ou tutelado" apoio="Inclua o dependente logo após o evento." />
              <OpcaoGrande v-model="tipoInclusao" nome="tipo-inclusao" valor="comum" rotulo="Não" apoio="Para outros tipos de dependente." />
            </div>
            <template v-if="tipoInclusao === 'evento'">
              <div class="grid gap-5 sm:grid-cols-2">
                <CampoSelecao id="parentesco-evento" v-model="pessoa.parentesco" rotulo="Parentesco *" :opcoes="parentescosComEvento" />
                <CampoTexto id="data-evento" v-model="dataDoEvento" :rotulo="rotuloDoEvento.data + ' *'" tipo="date" :max="hoje" />
              </div>
              <BotaoPrincipal :carregando="avaliando" @click="avaliar">{{ avaliando ? 'Conferindo…' : 'Prosseguir' }}</BotaoPrincipal>
            </template>
            <Carregando v-if="avaliando && tipoInclusao === 'comum'" texto="Conferindo…" apoio="" />
            <MensagemErro :texto="erroAvaliacao" />
            <template v-if="avaliacao">
              <p v-if="tipoInclusao === 'evento' && avaliacao.evento" class="m-0 rounded-2xl px-4 py-3 text-base font-semibold" :class="avaliacao.evento.valeComoEvento ? 'bg-ok-claro text-ok' : 'bg-atencao-claro text-atencao'">
                {{ avaliacao.evento.motivo }}
              </p>
              <p v-if="avaliacao.declaracao.pedir" class="m-0 rounded-2xl bg-atencao-claro px-4 py-3 text-base font-semibold text-atencao">
                Esta inclusão pede declaração de saúde (empresa de porte 1). Você pode preencher os dados, mas o envio só será liberado quando esse passo existir no portal.
              </p>
              <p v-else class="m-0 text-sm text-apoio">Sem declaração de saúde para esta inclusão.</p>
            </template>
          </fieldset>

          <!-- Inclusão comum: a pessoa tem ou já teve plano de saúde? -->
          <fieldset v-if="titular && avaliacao && comoComum" class="m-0 flex flex-col gap-4 rounded-[22px] border-2 border-roxo-borda bg-roxo-fundo p-5">
            <legend class="mb-1 px-1 text-xl font-bold">A pessoa possui ou já possuiu plano de saúde?</legend>
            <div class="grid gap-3 sm:grid-cols-2">
              <OpcaoGrande v-model="possuiPlanoAnterior" nome="plano-anterior" valor="sim" rotulo="Sim, possui ou já possuiu" apoio="Informe os dados do plano anterior." />
              <OpcaoGrande v-model="possuiPlanoAnterior" nome="plano-anterior" valor="nao" rotulo="Não possui" apoio="Siga para os dados da pessoa." />
            </div>
            <template v-if="possuiPlanoAnterior === 'sim'">
              <div class="grid gap-5 sm:grid-cols-2">
                <CampoSelecao id="tipo-plano-anterior" v-model="planoAnterior.tipo" rotulo="Tipo do plano anterior *" :opcoes="opcoesTipoPlanoAnterior" />
                <CampoTexto id="operadora-anterior" v-model="planoAnterior.operadora" rotulo="Operadora *" />
                <CampoTexto id="nome-plano-anterior" v-model="planoAnterior.plano" rotulo="Nome do plano *" />
                <CampoTexto id="tempo-plano-anterior" v-model="planoAnterior.tempoMeses" rotulo="Tempo de plano (meses) *" tipo="number" />
                <CampoTexto id="ultimo-pagamento" v-model="planoAnterior.ultimoPagamento" rotulo="Data do último pagamento *" tipo="date" :max="hoje" />
              </div>
              <p v-if="problemaNoPlanoAnterior(planoAnterior)" class="m-0 text-sm text-apoio">{{ problemaNoPlanoAnterior(planoAnterior) }}</p>
            </template>
          </fieldset>

          <div v-if="!titular" class="flex flex-col gap-2">
            <label for="busca-titular" class="text-[17px] font-bold">De qual funcionário? <span class="text-erro" aria-hidden="true">*</span></label>
            <input
              id="busca-titular" v-model="buscaTitular" type="search" autocomplete="off" placeholder="Procurar pelo nome ou CPF"
              class="h-14 rounded-2xl border-2 border-campo bg-white px-5 text-lg text-tinta placeholder:text-[#8a91a8] focus:border-roxo"
            >
            <p class="m-0 text-base text-apoio">
              {{ buscaTitular.trim() ? `${titularesFiltrados.length} de ${titularesAtivos.length} funcionários ativos` : `${titularesAtivos.length} funcionários ativos. Toque no que vai receber o dependente.` }}
            </p>
            <ul v-if="titularesVisiveis.length" class="m-0 flex max-h-[420px] list-none flex-col gap-2 overflow-y-auto p-0">
              <li v-for="t in titularesVisiveis" :key="t.id">
                <button
                  type="button" :disabled="!!abrindoTitular"
                  class="flex w-full items-center gap-3 rounded-2xl border-2 border-linha bg-white px-4 py-3 text-left hover:border-roxo disabled:opacity-60"
                  @click="escolherTitular(t)"
                >
                  <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-roxo-claro font-display text-lg font-extrabold text-roxo-escuro">{{ t.nome[0] }}</span>
                  <span class="flex min-w-0 grow flex-col">
                    <span class="text-[17px] font-bold">{{ t.nome }}</span>
                    <span class="text-sm text-apoio">{{ t.plano }}{{ t.cpf ? ` · CPF ${t.cpf}` : '' }}{{ (t.totalDependentes ?? t.dependentes.length) ? ` · ${t.totalDependentes ?? t.dependentes.length} dependente(s)` : '' }}</span>
                  </span>
                  <span v-if="abrindoTitular === t.id" class="shrink-0 text-sm font-bold text-roxo-escuro">Abrindo…</span>
                  <Icone v-else nome="avancar" :tamanho="22" :espessura="2.4" class="shrink-0 text-roxo-icone" />
                </button>
              </li>
            </ul>
            <button
              v-if="titularesFiltrados.length > quantosTitulares" type="button"
              class="min-h-12 self-start rounded-2xl bg-fundo px-5 text-[17px] font-bold text-roxo-escuro"
              @click="quantosTitulares += POR_PAGINA_TITULAR"
            >
              Ver mais ({{ titularesFiltrados.length - quantosTitulares }})
            </button>
            <p v-if="!titularesFiltrados.length" class="m-0 text-base text-apoio">
              {{ titularesAtivos.length ? 'Nenhum funcionário encontrado. Se ele também vai entrar agora, inclua os dois pela planilha.' : 'Não há funcionários ativos nesta empresa.' }}
            </p>
          </div>
        </template>

        <template v-if="quem === 'titular' || (titular && etapaPronta)">
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
            <CampoSelecao v-if="quem === 'titular'" id="plano" v-model="pessoa.plano" rotulo="Plano" :opcoes="opcoesPlano" />
            <div v-else class="flex flex-col gap-2">
              <span class="text-[17px] font-bold">Plano</span>
              <div class="flex min-h-14 items-center gap-2.5 rounded-2xl border-2 border-linha bg-fundo px-5 text-lg font-semibold text-tinta">
                <Icone nome="escudo" :tamanho="22" class="text-roxo-icone" /> {{ pessoa.plano }}
              </div>
              <span class="text-sm text-apoio">É o mesmo plano do titular. Não dá para trocar.</span>
            </div>
          </div>

          <!-- Início do plano: evento no prazo começa na aprovação; inclusão comum escolhe no calendário -->
          <p v-if="quem === 'dependente' && eventoDaInclusao" class="m-0 flex items-start gap-2.5 rounded-2xl bg-fundo p-4 text-base text-texto">
            <Icone nome="calendario" :tamanho="22" class="mt-0.5 shrink-0 text-roxo-icone" />
            <span><b>Início do plano:</b> no dia em que a inclusão for aprovada. Não precisa escolher uma data.</span>
          </p>
          <div v-else-if="quem === 'dependente'" class="flex flex-col gap-2">
            <CampoSelecao v-if="opcoesInicio.length" id="inicio-plano" v-model="inicioEscolhido" rotulo="Início do plano *" :opcoes="opcoesInicio" />
            <Carregando v-else-if="!vigencias && !erroVigencias" texto="Buscando as datas de início…" apoio="" />
            <MensagemErro v-if="erroVigencias" :texto="erroVigencias" />
            <p v-else-if="vigencias && !opcoesInicio.length" class="m-0 rounded-2xl bg-fundo p-4 text-base text-texto">O calendário não tem data de início liberada agora. Fale com a gente.</p>
            <span v-if="vigencias?.dia" class="text-sm text-apoio">O plano começa sempre no dia {{ String(vigencias.dia).padStart(2, '0') }}, o mesmo do titular.</span>
          </div>

          <!-- Cadastro completo de quem entra -->
          <fieldset class="m-0 flex flex-col gap-5 border-0 p-0">
            <legend class="mb-1 text-xl font-bold">Dados da pessoa</legend>
            <div class="grid gap-5 sm:grid-cols-2">
              <CampoSelecao id="sexo" v-model="cadastro.sexo" rotulo="Sexo *" :opcoes="opcoesSexo" />
              <CampoSelecao id="estado-civil" v-model="cadastro.estadoCivil" rotulo="Estado civil *" :opcoes="opcoesEstadoCivil" />
            </div>
            <div class="flex flex-col gap-3">
              <CampoTexto v-if="!cadastro.naoPossuiNomeMae" id="nome-mae" v-model="cadastro.nomeMae" rotulo="Nome da mãe *" />
              <label class="flex min-h-12 cursor-pointer items-center gap-3 text-base font-semibold">
                <input v-model="cadastro.naoPossuiNomeMae" type="checkbox" class="size-6 shrink-0 accent-roxo">
                A pessoa não possui o nome da mãe
              </label>
            </div>
            <div class="grid gap-5 sm:grid-cols-2">
              <div class="flex flex-col gap-2">
                <label for="sus" class="text-[17px] font-bold">Cartão Nacional de Saúde *</label>
                <input
                  id="sus" :value="cadastro.cartaoSus" type="text" inputmode="numeric" maxlength="15" placeholder="15 números"
                  class="h-14 rounded-2xl border-2 border-campo bg-white px-5 text-lg text-tinta placeholder:text-[#8a91a8] focus:border-roxo"
                  @input="aoDigitarNumeros('cartaoSus', 15, $event)"
                >
              </div>
              <CampoTexto id="naturalidade" v-model="cadastro.naturalidade" rotulo="Naturalidade" />
            </div>
            <div class="grid gap-5 sm:grid-cols-3">
              <CampoTexto id="rg" v-model="cadastro.rg" rotulo="RG" />
              <CampoSelecao id="orgao-rg" v-model="cadastro.orgaoExpedidor" rotulo="Órgão expedidor" :opcoes="opcoesOrgao" />
              <CampoSelecao id="uf-rg" v-model="cadastro.ufRg" rotulo="UF do RG" :opcoes="opcoesUf" />
            </div>
            <div class="grid gap-5 sm:grid-cols-2">
              <div class="flex flex-col gap-2">
                <label for="pis" class="text-[17px] font-bold">PIS/PASEP</label>
                <input
                  id="pis" :value="cadastro.pisPasep" type="text" inputmode="numeric" maxlength="11"
                  class="h-14 rounded-2xl border-2 border-campo bg-white px-5 text-lg text-tinta focus:border-roxo"
                  @input="aoDigitarNumeros('pisPasep', 11, $event)"
                >
              </div>
              <div class="flex flex-col gap-2">
                <label for="dnv" class="text-[17px] font-bold">Declaração de nascido vivo</label>
                <input
                  id="dnv" :value="cadastro.declaracaoNascidoVivo" type="text" inputmode="numeric" maxlength="15"
                  class="h-14 rounded-2xl border-2 border-campo bg-white px-5 text-lg text-tinta focus:border-roxo"
                  @input="aoDigitarNumeros('declaracaoNascidoVivo', 15, $event)"
                >
              </div>
            </div>
          </fieldset>

          <!-- Valor da família hoje e com a pessoa que entra -->
          <section v-if="quem === 'dependente' && (simulacao || simulando || erroSimulacao)" class="flex flex-col gap-3 rounded-[22px] border-2 border-roxo-borda bg-roxo-fundo p-5">
            <h3 class="m-0 text-xl font-bold">Quanto fica por mês</h3>
            <Carregando v-if="simulando && !simulacao" texto="Buscando os valores…" apoio="" />
            <MensagemErro v-if="erroSimulacao" :texto="erroSimulacao" />
            <template v-if="simulacao">
              <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
                <li v-for="(p, i) in simulacao.familia.pessoas" :key="i" class="flex items-baseline justify-between gap-3 text-base">
                  <span class="min-w-0 truncate">{{ p.nome }} <span class="text-apoio">· {{ p.parentesco }}</span></span>
                  <span class="shrink-0 font-bold">{{ reais(p.valor) }}</span>
                </li>
              </ul>
              <div class="flex items-baseline justify-between border-t-2 border-roxo-borda pt-2 text-lg font-bold">
                <span>A família paga hoje</span><span>{{ reais(simulacao.familia.total) }}</span>
              </div>
              <template v-if="simulacao.dependente">
                <div class="flex items-baseline justify-between text-lg font-bold text-roxo-escuro">
                  <span>+ {{ pessoa.nome || 'Dependente' }} ({{ pessoa.parentesco }})</span><span>+ {{ reais(simulacao.dependente.valor) }}</span>
                </div>
                <div class="flex items-baseline justify-between rounded-2xl bg-white px-4 py-3 text-xl font-extrabold">
                  <span>Passa a pagar</span><span>{{ reais(simulacao.novoTotal ?? 0) }}</span>
                </div>
                <p class="m-0 text-sm text-apoio">Valor da tabela de preço de hoje. Pode mudar na data de início do plano.</p>
              </template>
              <p v-else-if="simulacao.aviso" class="m-0 text-base text-texto">{{ simulacao.aviso }}</p>
              <p v-else class="m-0 text-base text-apoio">Preencha parentesco, nascimento e sexo para ver quanto a inclusão custa.</p>
            </template>
          </section>
          <p v-if="quem === 'dependente' && !opcoesParentesco.length" class="m-0 rounded-2xl bg-fundo p-4 text-base text-texto">
            O seu plano não libera nenhum parentesco para inclusão por aqui. Fale com a gente.
          </p>

          <!-- Documentos que a regra de aceitação exige para esse parentesco -->
          <fieldset v-if="quem === 'dependente' && pessoa.parentesco && opcoesDeDocumentos.length" class="m-0 flex flex-col gap-4 border-0 p-0">
            <legend class="mb-1 text-xl font-bold">Documentos de {{ pessoa.parentesco }}</legend>
            <template v-if="opcoesDeDocumentos.length > 1">
              <p class="m-0 text-base text-apoio">Escolha uma das opções e anexe os documentos dela.</p>
              <div class="grid gap-3 sm:grid-cols-2">
                <OpcaoGrande
                  v-for="(o, i) in opcoesDeDocumentos" :key="i" v-model="opcaoDeDocumentos" nome="opcao-documentos"
                  :valor="String(i)" :rotulo="`Opção ${i + 1}`" :apoio="o.join(' + ')"
                />
              </div>
            </template>
            <div v-for="d in documentosDaOpcao" :key="d" class="flex flex-col gap-2">
              <span class="text-[17px] font-bold">{{ d }} <span class="text-erro" aria-hidden="true">*</span></span>
              <EnvioDocumentos v-model="anexosPorDocumento[d]!" :rotulo="`Anexar ${d}`" />
            </div>
          </fieldset>
        </template>

        <template v-if="mostrarDados">
          <MensagemErro :texto="erro" />
          <div v-if="faltando.length" class="flex flex-col gap-2 rounded-2xl bg-fundo p-4">
            <span class="text-base font-bold">Para enviar, falta preencher:</span>
            <ul class="m-0 flex list-disc flex-col gap-0.5 pl-5 text-base text-texto"><li v-for="x in faltando" :key="x">{{ x }}</li></ul>
          </div>
          <p v-else-if="quem === 'dependente' && bloqueadoPorDeclaracao" class="m-0 rounded-2xl bg-atencao-claro p-4 text-base font-semibold text-atencao">
            Tudo preenchido, mas esta inclusão pede declaração de saúde, que ainda não está disponível pelo portal. Fale com a gente para concluir.
          </p>
          <BotaoPrincipal v-else tipo="submit" :carregando="enviando">{{ enviando ? 'Enviando…' : 'Enviar pedido de inclusão' }}</BotaoPrincipal>
        </template>
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
