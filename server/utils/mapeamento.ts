import type {
  BeneficiarioPlano, BeneficiariosEmpresa, CadastroDaEmpresa, CadastroDoContrato, Comunicado, ContatoCadastro, ContratoCliente,
  DadosPessoais, EnderecoCadastro, FamiliaDaEmpresa, PagamentoCadastro, PessoaDeContato, Fatura, GrupoExtrato, MinhaFamilia, PessoaEmpresa,
  ProdutoBeneficiario, SituacaoFatura, TipoContrato, TitularEmpresa,
} from '#shared/types/portal'
import { formatarCpf } from '../../shared/utils/cpf'
import { mascararEmail, mascararTelefone } from '../../shared/utils/mascara'
import type { LinhaDaRegraServicosOnline } from '../../shared/utils/regraServicosOnline'
import type { ContratoDaSessao } from './gateway'

// ------------------------------------------------------------------ formato do backend
// Só os campos que o portal usa. Nomes iguais aos do backend (Neo4j via APIs Vexur).

export interface ProdutoBruto {
  idProdutoFornecedor?: number | string | null
  fornecedor?: string | null
  nomePlano?: string | null
  nomeAmigavelProduto?: string | null
  codigoProdutoNoRegulador?: string | number | null
  padraoAcomodacaoProduto?: string | null
  /** Ex.: "NACIONAL", "ESTADUAL" */
  abrangenciaAtendimentoProduto?: string | null
  /** Ex.: "AMBULATORIAL + HOSPITALAR COM OBSTETRÍCIA" */
  segmentacaoProduto?: string | null
  /** Ex.: "COPARTICIPAÇÃO", "SEM FATOR MODERADOR" */
  fatorModeradorProduto?: string | null
  numeroCartaoIdentificacao?: string | null
  valorVenda?: number | null
  dataInicio?: number | string | null
  dataFim?: number | string | null
  /** "Principal" no plano principal; outro valor (ex.: "Adicional") nos opcionais */
  tipoContratacao?: string | null
  caracteristicaProduto?: string | null
  /** Ex.: "COLETIVO EMPRESARIAL", "COLETIVO POR ADESÃO" */
  tipoContratacaoProduto?: string | null
}

/** Regra do legado (api-recepcao): principal = caracteristicaProduto ou tipoContratacao igual a "Principal". */
function marcadoComoPrincipal(p: ProdutoBruto): boolean {
  return [p.caracteristicaProduto, p.tipoContratacao].some(v => String(v ?? '').trim().toUpperCase() === 'PRINCIPAL')
}

/** Sem marcação nenhuma também conta como principal (as queries do backend tratam o nulo assim). */
function semMarcacao(p: ProdutoBruto): boolean {
  return !String(p.caracteristicaProduto ?? '').trim() && !String(p.tipoContratacao ?? '').trim()
}

/**
 * Produtos com o PRINCIPAL primeiro; os opcionais (ex.: odonto, assistências) depois, na ordem original.
 * Ex.: ordenarPorPrincipal([odonto, saude(Principal)]) → [saude, odonto]
 */
export function ordenarPorPrincipal<T extends ProdutoBruto>(produtos: T[]): T[] {
  const peso = (p: T) => marcadoComoPrincipal(p) ? 0 : semMarcacao(p) ? 1 : 2
  return produtos.map((p, i) => ({ p, i })).sort((a, b) => peso(a.p) - peso(b.p) || a.i - b.i).map(x => x.p)
}

/** O plano principal da pessoa (ou o primeiro, se nada vier marcado). */
export function produtoPrincipal<T extends ProdutoBruto>(produtos: T[] | null | undefined): T | undefined {
  return ordenarPorPrincipal(produtos ?? [])[0]
}

export interface BeneficiarioBruto {
  id: number | string
  nome?: string | null
  cpf?: string | null
  dataNascimento?: number | string | null
  sexo?: string | null
  estadoCivil?: string | null
  nomeMae?: string | null
  cartaoNacionalSaude?: string | number | null
  cartaoNacionaoSaude?: string | number | null
  nacionalidade?: string | null
  /** Quando o plano da pessoa foi suspenso (se estiver preenchida e ela não saiu, está suspensa) */
  dataSuspensao?: number | string | null
  parentesco?: string | null
  dataInicio?: number | string | null
  dataFim?: number | string | null
  produto?: ProdutoBruto[] | null
}

/** GET operacao-implatancao-contrato-adesao/obter/{numeroContrato} */
export interface ContratoBruto {
  id: number
  numeroContrato: string | number
  /** Número do grupo (empresa): os comunicados da empresa são guardados com ele */
  numeroContratoGrupo?: string | number | null
  tipoContratacao?: string | null
  beneficiarios?: BeneficiarioBruto[] | null
  /** Contatos e endereços do contrato: { tipo, endereco | numero } ou { logradouro, cep, ... } */
  meiosContatos?: unknown[] | null
  dadosBancarios?: unknown[] | null
  responsavelFinanceiro?: unknown
  responsavelLegal?: unknown
}

/** POST faturamento-extrato-cliente/obterLancamentosPorContrato (um item por cobrança) */
export interface CobrancaBruta {
  idCobranca?: number | null
  chaveAgrupamento?: string | number | null
  anoMesCompetencia?: string | number | null
  dataVencimento?: number | string | null
  dataPagamento?: number | string | null
  statusCobranca?: { tipo?: string | null } | null
  valorCobranca?: number | null
  valorPago?: number | null
  linhaDigitavel?: string | null
  nossoNumero?: string | number | null
  lancamentos?: LancamentoBruto[] | null
}

/** Um lançamento da cobrança (campos do LANCAMENTOS_POR_CONTRATO em api-vexur-faturamento-extrato-cliente). */
export interface LancamentoBruto {
  /** Contrato de beneficiário do lançamento (na cobrança da empresa, um por pessoa) */
  numeroContrato?: string | number | null
  nome?: string | null
  parentesco?: string | null
  /** Nome técnico do produto (BeneficioContrato.nomePlano) */
  plano?: string | null
  idProdutoFornecedor?: number | string | null
  tipoLancamento?: string | null
  numeroParcela?: number | null
  totalParcelas?: number | null
  valorComercial?: number | null
}

/** idProdutoFornecedor → nome amigável do produto, montado a partir do contrato. */
export type NomesDeProduto = Map<string, string>

/** Ex.: nomesDeProduto(contratoDoBackend).get('123') → "Saúde Bem" */
export function nomesDeProduto(contrato: ContratoBruto | null | undefined): NomesDeProduto {
  const nomes: NomesDeProduto = new Map()
  for (const b of contrato?.beneficiarios ?? []) {
    for (const p of b.produto ?? []) {
      const nome = p.nomeAmigavelProduto ?? p.nomePlano
      if (p.idProdutoFornecedor !== null && p.idProdutoFornecedor !== undefined && nome) nomes.set(String(p.idProdutoFornecedor), String(nome).trim())
    }
  }
  return nomes
}

/** Nome do produto do lançamento: o amigável (do contrato) quando existir; senão o técnico. */
export function produtoDoLancamento(l: LancamentoBruto, nomes?: NomesDeProduto): string | undefined {
  const amigavel = l.idProdutoFornecedor !== null && l.idProdutoFornecedor !== undefined ? nomes?.get(String(l.idProdutoFornecedor)) : undefined
  const nome = amigavel ?? l.plano
  return nome ? String(nome).trim() : undefined
}

function detalheDoLancamento(l: LancamentoBruto): string | undefined {
  return l.totalParcelas && l.totalParcelas > 1 && l.numeroParcela ? `parcela ${l.numeroParcela} de ${l.totalParcelas}` : undefined
}

/** POST operacao-recepcao-proposta-adesao/login */
export interface LoginBruto {
  token?: string | null
  propostaAdesao?: {
    idContratoAdesao: number
    numeroContrato: string | number
    tipoContratacao?: string | null
    /** PME: empresa (nome fantasia) e o contrato dela (ContratoConveniado) */
    conveniado?: {
      nomeFantasia?: string | null
      conveniado?: {
        id?: number | null
        numeroContrato?: string | number | null
        dataInicio?: number | string | null
        dataFim?: number | string | null
      } | null
    } | string | null
    proponentes?: {
      cpf?: string | null
      parentesco?: string | null
      nome?: string | null
      dataInicio?: number | string | null
      dataFim?: number | string | null
      produto?: ProdutoBruto[] | null
    }[] | null
  }[] | null
}

// ------------------------------------------------------------------ utilitários

function doisDigitos(n: number) { return String(n).padStart(2, '0') }

/** Aceita milissegundos (Neo4j), "AAAA-MM-DD…", "AAAAMMDD" ou "DD/MM/AAAA". Devolve "AAAA-MM-DD" ou "". */
export function paraDataIso(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return ''
  if (typeof valor === 'number') {
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`
  }
  const texto = valor.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)
  if (/^\d{8}$/.test(texto)) return `${texto.slice(0, 4)}-${texto.slice(4, 6)}-${texto.slice(6, 8)}`
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  if (/^\d{10,13}$/.test(texto)) return paraDataIso(Number(texto))
  return ''
}

/** "TITULAR" → "Titular", "FILHO(A)" → "Filho(a)" */
export function parentescoLegivel(valor: string | null | undefined): string {
  const t = String(valor ?? '').trim().toLowerCase()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Dependente'
}

function ativoEm(dataFim: number | string | null | undefined, hojeIso: string): boolean {
  const fim = paraDataIso(dataFim)
  return !fim || fim >= hojeIso
}

function hojeIso(hoje: Date): string {
  return paraDataIso(hoje.getTime())
}

// ------------------------------------------------------------------ login

/**
 * Tipo do contrato pela marcação do produto (ou do contrato, se o produto não trouxer).
 * A CONFIRMAR com o backend: nome exato do campo e dos valores.
 */
export function tipoDoContrato(...marcacoes: (string | null | undefined)[]): TipoContrato {
  const texto = marcacoes.filter(Boolean).join(' ').toUpperCase()
  if (/EMPRESA/.test(texto)) return 'empresarial'
  if (/INDIVIDUAL|FAMILIAR/.test(texto)) return 'individual'
  return 'adesao'
}

/**
 * Todos os contratos em que o CPF é titular, ativos e cancelados, e o nome da pessoa.
 * Quem escolhe qual abrir são as regras de shared/utils/contratos.ts.
 * Ex.: mapearLogin(respostaDoLogin, new Date()) → { pessoa, contratos: [{ cliente, gateway }] } ou null.
 * Ainda falta: o login não diz se a pessoa é representante da empresa nem o nome da empresa.
 */
/** POST operacao-recepcao-proposta-adesao/login/portal (login leve, PR #28) */
export interface LoginPortalBruto {
  token?: string | null
  contratos?: {
    papel?: 'titular' | 'representante' | string | null
    idContratoAdesao?: number | null
    idContratoConveniado?: number | null
    numeroContrato?: string | number | null
    /** Titular de PME: número do contrato da empresa (ContratoConveniado) */
    numeroContratoConveniado?: string | number | null
    /** Responsável de PME: um contrato de beneficiário do grupo da empresa */
    numeroContratoAdesaoGrupo?: string | number | null
    tipoContratacao?: string | null
    conveniado?: string | null
    nome?: string | null
    dataInicio?: number | string | null
    dataFim?: number | string | null
    plano?: string | null
    fornecedor?: string | null
  }[] | null
}

function primeiroNomeDe(nome: string): string {
  const primeiro = nome.split(/\s+/)[0] ?? ''
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase()
}

/**
 * Login leve: mesma saída do mapearLogin, a partir da lista resumida de contratos.
 * O responsável de PME recebe o contrato da EMPRESA (papel "representante").
 * Ex.: mapearLoginPortal({ token, contratos: [...] }) → { pessoa, contratos: [{ cliente, gateway }] } | null
 */
export function mapearLoginPortal(login: LoginPortalBruto, hoje = new Date()) {
  const hojeTexto = hojeIso(hoje)
  if (!login.token) return null
  const contratos = (login.contratos ?? []).filter(c => c.numeroContrato !== null && c.numeroContrato !== undefined).map((c, i) => {
    const representante = c.papel === 'representante'
    const ativo = ativoEm(c.dataFim, hojeTexto)
    const cliente: ContratoCliente = {
      id: `c${i + 1}`,
      numero: String(c.numeroContrato),
      tipo: representante ? 'empresarial' : tipoDoContrato(c.tipoContratacao),
      papel: representante ? 'representante' : 'titular',
      situacao: ativo ? 'ativo' : 'cancelado',
      plano: String(c.plano ?? c.fornecedor ?? (representante ? 'Plano da empresa' : 'Plano')),
      empresa: representante || /EMPRESA/i.test(String(c.tipoContratacao)) ? String(c.conveniado ?? '') || undefined : undefined,
      contratoEmpresa: representante ? String(c.numeroContrato) : c.numeroContratoConveniado ? String(c.numeroContratoConveniado) : undefined,
      inicioVigencia: paraDataIso(c.dataInicio),
      fimVigencia: ativo ? undefined : paraDataIso(c.dataFim),
    }
    const gateway: ContratoDaSessao = {
      idContratoAdesao: representante ? 0 : Number(c.idContratoAdesao ?? 0),
      idContratoConveniado: representante ? Number(c.idContratoConveniado ?? 0) : undefined,
      numeroContratoAdesaoGrupo: representante && c.numeroContratoAdesaoGrupo ? String(c.numeroContratoAdesaoGrupo) : undefined,
      numeroContrato: String(c.numeroContrato),
      tipoContratacao: representante ? 'EMPRESARIAL' : String(c.tipoContratacao ?? 'ADESÃO').toUpperCase(),
    }
    return { cliente, gateway, nome: String(c.nome ?? '').trim() }
  })
  if (!contratos.length) return null
  const nome = (contratos.find(c => c.cliente.papel === 'titular' && c.cliente.situacao === 'ativo') ?? contratos[0]!).nome || 'Cliente'
  return {
    pessoa: { nome, primeiroNome: primeiroNomeDe(nome) },
    contratos: contratos.map(({ cliente, gateway }) => ({ cliente, gateway })),
  }
}

type PropostaBruta = NonNullable<LoginBruto['propostaAdesao']>[number]

function contratoDaEmpresa(c: PropostaBruta) {
  return typeof c.conveniado === 'object' && c.conveniado ? c.conveniado : undefined
}

/**
 * O /login do legado devolve, para o responsável de PME, os contratos de TODOS os funcionários
 * da empresa (a consulta inclui os contratos de quem tem pj.responsavelEmpresaCpf = CPF).
 * Então: contrato de outra pessoa na resposta = o CPF é o responsável daquela empresa.
 * Vira UMA entrada de responsável por empresa; os contratos dos funcionários não aparecem.
 * Limite: se o responsável for o único titular da empresa, não dá para perceber (só o /login/portal resolve).
 */
function empresasRepresentadas(propostas: PropostaBruta[], ehDoCpf: (c: PropostaBruta) => boolean, hojeTexto: string) {
  const empresas = new Map<string, { cliente: Omit<ContratoCliente, 'id'>, gateway: ContratoDaSessao }>()
  for (const c of propostas) {
    const empresa = contratoDaEmpresa(c)
    const conveniado = empresa?.conveniado
    if (ehDoCpf(c) || !conveniado?.id || !conveniado.numeroContrato) continue
    const numero = String(conveniado.numeroContrato)
    if (empresas.has(numero)) continue
    const ativo = ativoEm(conveniado.dataFim, hojeTexto)
    empresas.set(numero, {
      cliente: {
        numero,
        tipo: 'empresarial',
        papel: 'representante',
        situacao: ativo ? 'ativo' : 'cancelado',
        plano: 'Plano da empresa',
        empresa: String(empresa?.nomeFantasia ?? '').trim() || undefined,
        contratoEmpresa: numero,
        inicioVigencia: paraDataIso(conveniado.dataInicio),
        fimVigencia: ativo ? undefined : paraDataIso(conveniado.dataFim),
      },
      gateway: { idContratoAdesao: 0, idContratoConveniado: Number(conveniado.id), numeroContrato: numero, tipoContratacao: 'EMPRESARIAL' },
    })
  }
  return [...empresas.values()]
}

/**
 * Com o CPF de quem entrou: os contratos em que ESSA pessoa é a titular (um de cada, o legado
 * pode repetir) e, se ela for responsável de PME, a entrada da empresa.
 */
export function mapearLogin(login: LoginBruto, hoje = new Date(), cpfLogado?: string) {
  const hojeTexto = hojeIso(hoje)
  if (!login.token) return null
  const cpf = cpfLogado?.replace(/\D/g, '')
  const vistos = new Set<string>()
  const propostas = (login.propostaAdesao ?? []).filter((c) => {
    const numero = String(c.numeroContrato)
    if (vistos.has(numero)) return false
    vistos.add(numero)
    return true
  })
  const titularDoCpf = (c: PropostaBruta) => (c.proponentes ?? []).find(p => ehTitular(p.parentesco)
    && (!cpf || String(p.cpf ?? '').replace(/\D/g, '') === cpf))
  const titulares = propostas.flatMap((c) => {
    const titular = titularDoCpf(c)
    if (!titular) return []
    const ativo = ativoEm(titular.dataFim, hojeTexto)
    const vigentes = (titular.produto ?? []).filter(p => !ativo || ativoEm(p.dataFim, hojeTexto))
    const produto = produtoPrincipal(vigentes.length ? vigentes : titular.produto)
    const empresa = contratoDaEmpresa(c)
    const cliente: Omit<ContratoCliente, 'id'> = {
      numero: String(c.numeroContrato),
      tipo: tipoDoContrato(produto?.tipoContratacaoProduto, c.tipoContratacao),
      papel: 'titular',
      situacao: ativo ? 'ativo' : 'cancelado',
      plano: String(produto?.nomeAmigavelProduto ?? produto?.nomePlano ?? produto?.fornecedor ?? 'Plano'),
      empresa: String(empresa?.nomeFantasia ?? '').trim() || undefined,
      contratoEmpresa: empresa?.conveniado?.numeroContrato ? String(empresa.conveniado.numeroContrato) : undefined,
      inicioVigencia: paraDataIso(titular.dataInicio ?? produto?.dataInicio),
      fimVigencia: ativo ? undefined : paraDataIso(titular.dataFim),
    }
    const gateway: ContratoDaSessao = {
      idContratoAdesao: Number(c.idContratoAdesao),
      numeroContrato: String(c.numeroContrato),
      tipoContratacao: String(c.tipoContratacao ?? 'ADESÃO').toUpperCase(),
    }
    return [{ cliente, gateway, nome: String(titular.nome ?? '').trim() }]
  })
  // Sem o CPF não dá para separar o que é da pessoa do que é dos funcionários.
  const empresas = cpf ? empresasRepresentadas(propostas, c => !!titularDoCpf(c), hojeTexto) : []
  const contratos = [...titulares, ...empresas.map(e => ({ ...e, nome: '' }))]
    .map((c, i) => ({ ...c, cliente: { ...c.cliente, id: `c${i + 1}` } as ContratoCliente }))
  if (!contratos.length) return null
  const nome = (titulares.find(c => c.cliente.situacao === 'ativo') ?? titulares[0])?.nome || 'Cliente'
  return {
    pessoa: { nome, primeiroNome: primeiroNomeDe(nome) },
    contratos: contratos.map(({ cliente, gateway }) => ({ cliente, gateway })),
  }
}

// ------------------------------------------------------------------ família

/** "COPARTICIPAÇÃO" → true · "SEM FATOR MODERADOR"/"NÃO" → false · desconhecido → undefined (a tela esconde). */
export function temCoparticipacao(fatorModerador: string | null | undefined): boolean | undefined {
  const t = String(fatorModerador ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  if (!t.trim()) return undefined
  if (/SEM|NAO|NENHUM|ISENT/.test(t)) return false
  if (/COPART|FRANQU|FATOR/.test(t)) return true
  return undefined
}

function textoLegivel(valor: string | null | undefined): string | undefined {
  const t = String(valor ?? '').trim()
  return t ? parentescoLegivel(t) : undefined
}

function mapearProduto(p: ProdutoBruto, dataInicioPessoa: string, opcional: boolean): ProdutoBeneficiario {
  return {
    nome: String(p.nomeAmigavelProduto ?? p.nomePlano ?? 'Plano'),
    opcional: opcional || undefined,
    tipo: /odont/i.test(`${p.nomePlano ?? ''} ${p.nomeAmigavelProduto ?? ''} ${p.segmentacaoProduto ?? ''}`) ? 'odonto' : 'saude',
    operadora: String(p.fornecedor ?? ''),
    registroAns: p.codigoProdutoNoRegulador ? String(p.codigoProdutoNoRegulador) : '',
    acomodacao: textoLegivel(p.padraoAcomodacaoProduto),
    abrangencia: textoLegivel(p.abrangenciaAtendimentoProduto),
    cobertura: textoLegivel(p.segmentacaoProduto),
    coparticipacao: temCoparticipacao(p.fatorModeradorProduto),
    inicioVigencia: paraDataIso(p.dataInicio) || dataInicioPessoa,
    valorMensal: Number(p.valorVenda ?? 0),
  }
}

/** "Titular", "TITULAR(A)", "títular " → true. O texto do parentesco varia entre contratos. */
export function ehTitular(parentesco: string | null | undefined): boolean {
  return String(parentesco ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().includes('TITULAR')
}

/**
 * Pessoa com seus produtos. Para quem ainda está no plano, só os produtos ativos;
 * para quem já saiu (contrato encerrado), os produtos que tinha — senão a tela fica vazia.
 */
function mapearPessoa(b: BeneficiarioBruto, hojeTexto: string): BeneficiarioPlano {
  const pessoaAtiva = ativoEm(b.dataFim, hojeTexto)
  const ativos = (b.produto ?? []).filter(p => ativoEm(p.dataFim, hojeTexto))
  // Plano principal sempre primeiro: é ele que aparece em destaque e dá a carteirinha.
  const produtos = ordenarPorPrincipal(pessoaAtiva && ativos.length ? ativos : (b.produto ?? []))
  const inicio = paraDataIso(b.dataInicio)
  return {
    id: String(b.id),
    nome: String(b.nome ?? '').trim(),
    parentesco: parentescoLegivel(b.parentesco),
    titular: ehTitular(b.parentesco),
    numeroCarteirinha: String(produtos.find(p => p.numeroCartaoIdentificacao)?.numeroCartaoIdentificacao ?? ''),
    produtos: produtos.map((p, i) => mapearProduto(p, inicio, i > 0)),
    dados: dadosPessoaisDe(b),
  }
}

// ------------------------------------------------------------------ comunicados já enviados (cópias)

/** POST envio-comunicacao/listarComunicacao → dados[]: cada item é um VexurWorkFlowComunicacao. */
export interface ComunicadoEnviadoBruto {
  id?: number | string | null
  /** "e-mail" ou "sms" */
  tipo?: string | null
  destinatarios?: string | string[] | null
  celulares?: string | string[] | null
  assunto?: string | null
  texto?: string | null
  dataEnvio?: number | string | null
  status?: string | null
}

function primeiroDestino(...valores: (string | string[] | null | undefined)[]): string {
  for (const v of valores) {
    const lista = (Array.isArray(v) ? v : String(v ?? '').split(/[;,]/)).map(x => String(x).trim()).filter(Boolean)
    if (lista[0]) return lista[0]
  }
  return ''
}

function textoPuro(html: string): string {
  return html.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}

/**
 * Cópias dos comunicados enviados ao contrato, do mais novo para o mais antigo.
 * Aqui só histórico (tipo "informativo"): o "vigente" de inadimplência depende de ligar o comunicado à mensalidade.
 */
export function mapearComunicados(lista: ComunicadoEnviadoBruto[], hoje = new Date()): Comunicado[] {
  const limiteNovo = hoje.getTime() - 15 * 24 * 60 * 60 * 1000
  return lista.flatMap((c) => {
    const texto = textoPuro(String(c.texto ?? '')).trim()
    const titulo = String(c.assunto ?? '').trim() || texto.split('\n')[0]?.slice(0, 80) || ''
    if (!titulo) return []
    const sms = /sms/i.test(String(c.tipo ?? ''))
    const destino = sms ? primeiroDestino(c.celulares, c.destinatarios) : primeiroDestino(c.destinatarios)
    const quando = typeof c.dataEnvio === 'number' ? c.dataEnvio : Number(c.dataEnvio) || Date.parse(String(c.dataEnvio ?? ''))
    const paragrafos = texto.split(/\n+/).map(p => p.trim()).filter(Boolean)
    return [{
      id: String(c.id ?? ''),
      tipo: 'informativo' as const,
      vigente: false,
      titulo,
      resumo: (paragrafos[0] ?? titulo).slice(0, 140),
      canal: sms ? 'sms' as const : 'email' as const,
      enviadoEm: paraDataIso(Number.isFinite(quando) ? quando : null),
      destino: destino ? (sms ? mascararTelefone(destino) : mascararEmail(destino)) : '',
      novo: Number.isFinite(quando) && quando >= limiteNovo,
      paragrafos: paragrafos.length ? paragrafos : [titulo],
    }]
  }).filter(c => c.id).sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))
}

// ------------------------------------------------------------------ comunicados do contrato (Serviços)

/** POST regra-venda-comunicacao/contrato/obterComunicacoes: os comunicados autorizados para o contrato. */
export interface ComunicacaoBruta {
  tipoComunicacao?: string | null
  codigoTemplate?: string | number | null
  /** O serviço marca como bloqueado o comunicado que a regra do contrato não permite agora */
  bloqueiaEnvio?: boolean | null
  bloqueioMensagem?: string | null
}


function semAcentoMaiusculo(t: string | null | undefined): string {
  return String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
}

/** A carta de tempo de permanência nunca aparece no portal, mesmo autorizada no contrato. */
export function comunicadoProibido(tipo: string | null | undefined): boolean {
  return /PERMANENCIA/.test(semAcentoMaiusculo(tipo))
}

/** Tipo do comunicado → serviço conhecido do portal (os demais viram um serviço com o próprio nome). */
export function idDoServicoPorComunicado(tipo: string | null | undefined): string | undefined {
  const t = semAcentoMaiusculo(tipo)
  if (/IRPF|INFORME DE RENDIMENTO/.test(t)) return 'irpf'
  if (/ANUAL DE DEBITO/.test(t)) return 'quitacao-anual'
  if (/BOAS.?VINDAS/.test(t)) return 'boas-vindas'
  if (/QUITACAO/.test(t)) return 'quitacao-debito'
  if (/EXTRATO/.test(t)) return 'extrato'
  return undefined
}

/** "CARTA DE COBERTURA PARCIAL TEMPORÁRIA" → "Carta de cobertura parcial temporária" */
export function tituloDoComunicado(tipo: string): string {
  const t = tipo.trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Identificador estável para um comunicado sem serviço conhecido (só letras, números e hífen). */
export function idDoComunicado(tipo: string): string {
  return 'com-' + semAcentoMaiusculo(tipo).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ------------------------------------------------------------------ regra "Serviços online"

/**
 * Resposta do obterRegraProduto: uma ou mais regras, cada uma com as linhas em `configs`
 * (ator, local, tipo, atendimento, documentos, mensagem). Junta todas as linhas.
 */
export function linhasDaRegraServicosOnline(resposta: unknown): LinhaDaRegraServicosOnline[] {
  const itens = Array.isArray(resposta) ? resposta : [resposta]
  return itens.flatMap((item) => {
    const o = item && typeof item === 'object' ? item as Record<string, unknown> : undefined
    const configs = o?.configs ?? o?.configuracaoRegra
    return Array.isArray(configs)
      ? configs.flatMap(c => (c && typeof c === 'object' ? [c as LinhaDaRegraServicosOnline] : []))
      : []
  })
}

// ------------------------------------------------------------------ dados cadastrais (somente leitura)

type Obj = Record<string, unknown>
const texto = (v: unknown): string => String(v ?? '').trim()
const objeto = (v: unknown): Obj | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : undefined)

/** Conta bancária: mostra só o final. "123456" → "•••456". */
function mascararFinal(valor: string, visiveis = 3): string {
  const t = valor.replace(/\s+/g, '')
  return t.length <= visiveis ? t : '•'.repeat(Math.min(6, t.length - visiveis)) + t.slice(-visiveis)
}

function enderecoDe(m: Obj): EnderecoCadastro | undefined {
  const logradouro = texto(m.logradouro)
  const cep = texto(m.cep)
  if (!logradouro && !cep) return undefined
  const rua = [logradouro, texto(m.numero)].filter(Boolean).join(', ') + (texto(m.complemento) ? ' - ' + texto(m.complemento) : '')
  const cidade = [texto(m.bairro), [texto(m.municipio ?? m.cidade), texto(m.uf ?? m.estado)].filter(Boolean).join('/')].filter(Boolean).join(' · ')
  const cep8 = cep.replace(/\D/g, '')
  const campos = Object.fromEntries(Object.entries({
    cep: cep8.length === 8 ? cep8.slice(0, 5) + '-' + cep8.slice(5) : cep,
    logradouro,
    numero: texto(m.numero),
    complemento: texto(m.complemento),
    bairro: texto(m.bairro),
    municipio: texto(m.municipio ?? m.cidade),
    uf: texto(m.uf ?? m.estado).toUpperCase(),
  }).filter(([, v]) => v))
  return { rotulo: m.enderecoCobranca ? 'Endereço de cobrança' : 'Endereço', linhas: [rua, cidade, cep ? 'CEP ' + cep : ''].filter(Boolean), campos }
}

/** Meios de contato do contrato: e-mails, telefones e endereços, sem repetir. */
export function mapearContatosDoContrato(meios: unknown): { contatos: ContatoCadastro[], enderecos: EnderecoCadastro[] } {
  const contatos: ContatoCadastro[] = []
  const enderecos: EnderecoCadastro[] = []
  const vistos = new Set<string>()
  for (const item of Array.isArray(meios) ? meios : []) {
    const m = objeto(item)
    if (!m) continue
    const e = enderecoDe(m)
    if (e) {
      const chave = e.linhas.join('|')
      if (!vistos.has(chave)) { vistos.add(chave); enderecos.push(e) }
      continue
    }
    const tipo = texto(m.tipo).toLowerCase()
    if (/mail/.test(tipo)) {
      const valor = texto(m.endereco ?? m.email)
      if (valor && !vistos.has(valor)) { vistos.add(valor); contatos.push({ tipo: 'email', rotulo: 'E-mail', valor }) }
    } else if (/tel|cel|fone/.test(tipo)) {
      const valor = texto(m.numero ?? m.telefone ?? m.celular)
      const celular = /cel/.test(tipo)
      if (valor && !vistos.has(valor)) { vistos.add(valor); contatos.push({ tipo: celular ? 'celular' : 'telefone', rotulo: celular ? 'Celular' : 'Telefone', valor }) }
    }
  }
  return { contatos, enderecos }
}

/** Meios de pagamento: forma de cobrança e dados bancários, com a conta escondida (só o final). */
export function mapearPagamento(contas: unknown): PagamentoCadastro[] {
  const lista = (Array.isArray(contas) ? contas : []).flatMap((c) => { const o = objeto(c); return o ? [o] : [] })
  const deCobranca = lista.filter(o => /cobran/i.test([o.tipoDadosBancarios].flat().join(' ')))
  return (deCobranca.length ? deCobranca : lista).map((o) => {
    const detalhes: { rotulo: string, valor: string }[] = []
    const banco = texto(o.nomeBanco ?? o.banco)
    if (banco) detalhes.push({ rotulo: 'Banco', valor: banco })
    const agencia = texto(o.agencia)
    if (agencia) detalhes.push({ rotulo: 'Agência', valor: agencia + (texto(o.digitoAgencia) ? '-' + texto(o.digitoAgencia) : '') })
    const conta = texto(o.conta)
    if (conta) detalhes.push({ rotulo: 'Conta', valor: mascararFinal(conta) + (texto(o.digitoConta) ? '-' + texto(o.digitoConta) : '') })
    if (texto(o.identificadorDebitoAutomatico)) detalhes.push({ rotulo: 'Débito automático', valor: 'Cadastrado' })
    return { modalidade: texto(o.modalidadeCobranca) || 'Forma de pagamento', detalhes }
  })
}

function pessoaDeContato(papel: string, valor: unknown): PessoaDeContato | undefined {
  const o = objeto(valor)
  const nome = texto(o?.nome)
  if (!o || !nome) return undefined
  const detalhes: { rotulo: string, valor: string }[] = []
  if (texto(o.cpf)) detalhes.push({ rotulo: 'CPF', valor: formatarCpf(texto(o.cpf)) })
  if (texto(o.email)) detalhes.push({ rotulo: 'E-mail', valor: texto(o.email) })
  const telefone = texto(o.celular ?? o.telefone)
  if (telefone) detalhes.push({ rotulo: 'Telefone', valor: telefone })
  return { papel, nome, detalhes }
}

/** Contato, endereço, pagamento e responsáveis do contrato do beneficiário. */
export function mapearCadastroDoContrato(c: ContratoBruto, opcoes: { pagamento: boolean }): CadastroDoContrato {
  const { contatos, enderecos } = mapearContatosDoContrato(c.meiosContatos)
  return {
    contatos,
    enderecos,
    pagamento: opcoes.pagamento ? mapearPagamento(c.dadosBancarios) : [],
    responsaveis: [pessoaDeContato('Responsável financeiro', c.responsavelFinanceiro), pessoaDeContato('Responsável legal', c.responsavelLegal)]
      .filter((p): p is PessoaDeContato => !!p),
  }
}

/** Dados pessoais de um beneficiário; só entra o que o sistema tem. */
export function dadosPessoaisDe(b: BeneficiarioBruto): DadosPessoais {
  const dados: DadosPessoais = {}
  if (texto(b.cpf)) dados.cpf = formatarCpf(texto(b.cpf))
  const nascimento = paraDataIso(b.dataNascimento)
  if (nascimento) dados.nascimento = nascimento
  if (texto(b.sexo)) dados.sexo = textoLegivel(texto(b.sexo))
  if (texto(b.estadoCivil)) dados.estadoCivil = textoLegivel(texto(b.estadoCivil))
  if (texto(b.nomeMae)) dados.nomeMae = texto(b.nomeMae)
  const sus = texto(b.cartaoNacionalSaude ?? b.cartaoNacionaoSaude)
  if (sus) dados.cartaoSus = sus
  if (texto(b.nacionalidade)) dados.nacionalidade = textoLegivel(texto(b.nacionalidade))
  return dados
}

/** Dados da empresa para o responsável, a partir da linha do obter-pme (PessoaJuridica + contas). */
export function mapearCadastroDaEmpresa(linha: TitularPmeBruto | undefined): CadastroDaEmpresa | null {
  const pj = objeto(linha?.pessoaJuridica)
  if (!pj) return null
  const empresa: { rotulo: string, valor: string }[] = []
  const nome = texto(pj.nomeFantasia)
  if (nome) empresa.push({ rotulo: 'Nome fantasia', valor: nome })
  if (texto(pj.razaoSocial)) empresa.push({ rotulo: 'Razão social', valor: texto(pj.razaoSocial) })
  if (texto(pj.cnpj)) empresa.push({ rotulo: 'CNPJ', valor: texto(pj.cnpj) })
  const desde = paraDataIso(linha?.dataInicio)
  if (desde) empresa.push({ rotulo: 'Contrato desde', valor: desde })
  const meios = [
    texto(pj.email) ? { tipo: 'e-mail', endereco: pj.email } : undefined,
    texto(pj.telefone) ? { tipo: 'telefone', numero: pj.telefone } : undefined,
    texto(pj.celular) ? { tipo: 'telefone-celular', numero: pj.celular } : undefined,
  ].filter(Boolean)
  const { contatos, enderecos } = mapearContatosDoContrato(meios)
  const endereco = enderecoDe(pj)
  const representante = pessoaDeContato('Responsável pela empresa', {
    nome: pj.responsavelEmpresaNome,
    cpf: pj.responsavelEmpresaCpf,
    email: pj.responsavelEmpresaEmail ?? pj.emailResponsavelEmpresa ?? pj.emailEmpresaResponsavel,
    celular: pj.responsavelEmpresaCelular ?? pj.responsavelEmpresaTelefone,
  }) ?? null
  return { empresa, representante, contatos, enderecos: endereco ? [endereco, ...enderecos] : enderecos, pagamento: mapearPagamento(linha?.dadosBancarios) }
}

// ------------------------------------------------------------------ empresa (responsável de PME)

/** Uma linha do GET obter-pme/{numeroContrato}: um titular da empresa (campos do OBTER_CONTRATOS_PME). */
export interface TitularPmeBruto {
  /** Dados da empresa (PessoaJuridica) e contas bancárias dela: só nos campos que o portal usa */
  pessoaJuridica?: Record<string, unknown> | null
  dadosBancarios?: unknown[] | null
  dataInicio?: number | string | null
  dataFim?: number | string | null
  numeroContrato?: string | number | null
  nome?: string | null
  /** Quantos dependentes (sem contar o titular) */
  dependentes?: number | null
  produto?: string | null
  dataInicioContrato?: number | string | null
  dataFimContrato?: number | string | null
  conveniado?: string | null
}

/** O serviço devolve a lista dentro de `dados`, às vezes embrulhada em array. Aceita as formas conhecidas. */
export function linhasDoObterPme(resposta: unknown): TitularPmeBruto[] {
  const dados = (x: unknown): unknown => (x && typeof x === 'object' && !Array.isArray(x) && 'dados' in x ? (x as { dados: unknown }).dados : x)
  let atual = dados(resposta)
  if (Array.isArray(atual) && atual.length === 1 && atual[0] && typeof atual[0] === 'object' && 'dados' in atual[0]) atual = dados(atual[0])
  return Array.isArray(atual) ? (atual as TitularPmeBruto[]) : []
}

/**
 * Lista de titulares da empresa, SEM os dependentes (só a contagem): é uma chamada só e rápida.
 * Os dependentes, o CPF e a carteirinha vêm ao abrir cada família (mapearFamiliaDaEmpresa).
 */
export function mapearTitularesEmpresa(linhas: TitularPmeBruto[], empresa: string, hoje = new Date()): BeneficiariosEmpresa {
  const hojeTexto = hojeIso(hoje)
  // O serviço devolve MAIS DE UMA linha por contrato: a do titular (com a data de saída dele, contando 1)
  // e a dos dependentes (sem data, contando só eles). Junta tudo por contrato antes de decidir a situação.
  const porContrato = new Map<string, { linha: TitularPmeBruto, saida: number | string | null, inicio: string, contados: number }>()
  const repetidas = new Set<string>()
  for (const l of linhas) {
    const numero = String(l.numeroContrato ?? '')
    if (!numero) continue
    // Linha idêntica a outra já vista é só repetição do serviço.
    const chave = [numero, l.dependentes ?? '', paraDataIso(l.dataInicioContrato), paraDataIso(l.dataFimContrato)].join('|')
    if (repetidas.has(chave)) continue
    repetidas.add(chave)
    const atual = porContrato.get(numero) ?? { linha: l, saida: null, inicio: '', contados: 0 }
    const inicio = paraDataIso(l.dataInicioContrato)
    porContrato.set(numero, {
      linha: atual.linha,
      saida: atual.saida ?? (paraDataIso(l.dataFimContrato) ? (l.dataFimContrato ?? null) : null),
      inicio: atual.inicio && (!inicio || atual.inicio < inicio) ? atual.inicio : inicio,
      contados: atual.contados + Number(l.dependentes ?? 0),
    })
  }
  const titulares: TitularEmpresa[] = []
  for (const [numero, c] of porContrato) {
    const ativo = ativoEm(c.saida, hojeTexto)
    titulares.push({
      id: numero,
      nome: String(c.linha.nome ?? '').trim() || 'Sem nome',
      cpf: '',
      parentesco: 'Titular',
      titular: true,
      numeroCarteirinha: '',
      plano: String(c.linha.produto ?? '').trim(),
      inicioVigencia: c.inicio,
      situacao: ativo ? 'ativo' : 'cancelado',
      fimVigencia: ativo ? undefined : paraDataIso(c.saida),
      dependentes: [],
      // A contagem do serviço inclui o próprio titular (1): sobram só os dependentes.
      totalDependentes: Math.max(0, c.contados - 1),
    })
  }
  titulares.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const ativos = titulares.filter(t => t.situacao === 'ativo')
  const dependentes = ativos.reduce((n, t) => n + (t.totalDependentes ?? 0), 0)
  return {
    dependentesSobDemanda: true,
    empresa,
    resumo: {
      titulares: ativos.length, dependentes, vidas: ativos.length + dependentes,
      cancelados: titulares.length - ativos.length, saindo: 0, inclusoesEmAnalise: 0,
    },
    planos: [...new Set(titulares.map(t => t.plano).filter(Boolean))].sort(),
    parentescos: [],
    titulares,
  }
}

function pessoaDaEmpresa(b: BeneficiarioBruto, hojeTexto: string): PessoaEmpresa {
  const p = mapearPessoa(b, hojeTexto)
  const ativo = ativoEm(b.dataFim, hojeTexto)
  return {
    id: p.id,
    nome: p.nome,
    cpf: b.cpf ? formatarCpf(String(b.cpf)) : '',
    parentesco: p.parentesco,
    titular: p.titular,
    numeroCarteirinha: p.numeroCarteirinha,
    // O principal vem primeiro (mapearPessoa ordena); os demais são opcionais.
    plano: p.produtos[0]?.nome ?? '',
    opcionais: [...new Set(p.produtos.slice(1).map(x => x.nome))].filter(n => n !== p.produtos[0]?.nome),
    dados: dadosPessoaisDe(b),
    suspenso: ativo && !!paraDataIso(b.dataSuspensao) ? true : undefined,
    inicioVigencia: paraDataIso(b.dataInicio),
    situacao: ativo ? 'ativo' : 'cancelado',
    fimVigencia: ativo ? undefined : paraDataIso(b.dataFim),
  }
}

/** Contrato de um titular da empresa → o titular com CPF/carteirinha e os dependentes (ativos e cancelados). */
export function mapearFamiliaDaEmpresa(contrato: ContratoBruto, hoje = new Date()): FamiliaDaEmpresa {
  const hojeTexto = hojeIso(hoje)
  const todos = contrato.beneficiarios ?? []
  const titular = todos.find(b => ehTitular(b.parentesco) && ativoEm(b.dataFim, hojeTexto)) ?? todos.find(b => ehTitular(b.parentesco))
  if (!titular) throw new Error(`contrato ${contrato.numeroContrato} sem titular`)
  return {
    titular: pessoaDaEmpresa(titular, hojeTexto),
    dependentes: todos.filter(b => b !== titular && !ehTitular(b.parentesco)).map(b => pessoaDaEmpresa(b, hojeTexto)),
    cadastro: mapearCadastroDoContrato(contrato, { pagamento: false }),
  }
}

/** Titular e dependentes ATIVOS do contrato. Ex.: mapearFamilia(contratoDoBackend) */
export function mapearFamilia(contrato: ContratoBruto, hoje = new Date()): MinhaFamilia {
  const hojeTexto = hojeIso(hoje)
  const todos = contrato.beneficiarios ?? []
  const titularBruto = todos.find(b => ehTitular(b.parentesco) && ativoEm(b.dataFim, hojeTexto))
    ?? todos.find(b => ehTitular(b.parentesco))
  if (!titularBruto) {
    const parentescos = [...new Set(todos.map(b => String(b.parentesco ?? 'vazio')))].join(', ') || 'nenhum beneficiário'
    throw new Error(`contrato ${contrato.numeroContrato} sem titular; esperado parentesco contendo "TITULAR", recebido: ${parentescos}`)
  }
  // Contrato em vigor: só quem ainda está no plano. Contrato encerrado: todos, como era.
  const contratoAtivo = ativoEm(titularBruto.dataFim, hojeTexto)
  const dependentes = todos
    .filter(b => b !== titularBruto && !ehTitular(b.parentesco))
    .filter(b => !contratoAtivo || ativoEm(b.dataFim, hojeTexto))
    .map(b => mapearPessoa(b, hojeTexto))
  return { titular: mapearPessoa(titularBruto, hojeTexto), dependentes }
}

// ------------------------------------------------------------------ faturas

const STATUS_FORA_DA_LISTA = new Set(['CANCELADA', 'SEM_COBRANCA', 'ERRO'])

/** Mês da competência: 202610 / "202610" / "2026-10" → "outubro" */
export function mesDaCompetencia(anoMes: string | number | null | undefined, vencimentoIso: string): string {
  const t = String(anoMes ?? '').replace(/\D/g, '')
  const mes = t.length >= 6 ? Number(t.slice(4, 6)) : Number(vencimentoIso.slice(5, 7))
  return nomeDoMes((mes || 1) - 1)
}

/** PAGA → paga; senão compara o vencimento com hoje: atrasada / vence-hoje / aberta. */
export function situacaoDaCobranca(c: CobrancaBruta, hoje = new Date()): SituacaoFatura {
  if (c.statusCobranca?.tipo?.toUpperCase() === 'PAGA' || paraDataIso(c.dataPagamento)) return 'paga'
  const venc = paraDataIso(c.dataVencimento)
  const hojeTexto = hojeIso(hoje)
  if (venc && venc < hojeTexto) return 'atrasada'
  if (venc === hojeTexto) return 'vence-hoje'
  return 'aberta'
}

export function idDaCobranca(c: CobrancaBruta): string {
  return String(c.idCobranca ?? c.nossoNumero ?? c.chaveAgrupamento ?? '')
}

/** Total por pessoa e produto. Ex.: "ANA (titular) · Saúde Bem" → 300,50 */
function itensPorPessoa(c: CobrancaBruta, nomes?: NomesDeProduto) {
  const porPessoa = new Map<string, number>()
  for (const l of c.lancamentos ?? []) {
    const produto = produtoDoLancamento(l, nomes)
    const chave = `${String(l.nome ?? 'Beneficiário').trim()} (${parentescoLegivel(l.parentesco).toLowerCase()})${produto ? ` · ${produto}` : ''}`
    porPessoa.set(chave, (porPessoa.get(chave) ?? 0) + Number(l.valorComercial ?? 0))
  }
  return [...porPessoa].map(([descricao, valor]) => ({ descricao, valor: Math.round(valor * 100) / 100 }))
}

/** Lista do portal: sem canceladas/erro, da mais nova para a mais antiga. */
export function mapearFaturas(cobrancas: CobrancaBruta[], hoje = new Date(), nomes?: NomesDeProduto): Fatura[] {
  return cobrancas
    .filter(c => !STATUS_FORA_DA_LISTA.has(String(c.statusCobranca?.tipo ?? '').toUpperCase()) && idDaCobranca(c))
    .map((c): Fatura => {
      const vencimento = paraDataIso(c.dataVencimento)
      const situacao = situacaoDaCobranca(c, hoje)
      return {
        id: idDaCobranca(c),
        mes: mesDaCompetencia(c.anoMesCompetencia, vencimento),
        valor: Number(c.valorCobranca ?? 0),
        vencimento,
        situacao,
        pagaEm: situacao === 'paga' ? paraDataIso(c.dataPagamento) || undefined : undefined,
        itens: itensPorPessoa(c, nomes),
      }
    })
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento))
}

/** Detalhe por pessoa para o extrato: cada tipo de lançamento vira uma linha. */
export function mapearGruposExtrato(c: CobrancaBruta, nomes?: NomesDeProduto): GrupoExtrato[] {
  const grupos = new Map<string, GrupoExtrato>()
  for (const l of c.lancamentos ?? []) {
    const nome = String(l.nome ?? 'Beneficiário').trim()
    // Lançamento da própria empresa (PME) vem sem parentesco: não é "Dependente".
    const parentesco = l.parentesco === '' ? 'Empresa' : parentescoLegivel(l.parentesco)
    const grupo = grupos.get(nome) ?? { beneficiario: nome, parentesco, linhas: [], subtotal: 0 }
    const valor = Number(l.valorComercial ?? 0)
    grupo.linhas.push({
      descricao: String(l.tipoLancamento ?? 'Mensalidade'),
      produto: produtoDoLancamento(l, nomes),
      detalhe: detalheDoLancamento(l),
      valor,
    })
    grupo.subtotal = Math.round((grupo.subtotal + valor) * 100) / 100
    grupos.set(nome, grupo)
  }
  return [...grupos.values()]
}
