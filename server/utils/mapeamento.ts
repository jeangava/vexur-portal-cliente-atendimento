import type {
  BeneficiarioPlano, ContratoCliente, Fatura, GrupoExtrato, MinhaFamilia, ProdutoBeneficiario, SituacaoFatura, TipoContrato,
} from '#shared/types/portal'
import type { ContratoDaSessao } from './gateway'

// ------------------------------------------------------------------ formato do backend
// Só os campos que o portal usa. Nomes iguais aos do backend (Neo4j via APIs Vexur).

export interface ProdutoBruto {
  fornecedor?: string | null
  nomePlano?: string | null
  nomeAmigavelProduto?: string | null
  codigoProdutoNoRegulador?: string | number | null
  padraoAcomodacaoProduto?: string | null
  numeroCartaoIdentificacao?: string | null
  valorVenda?: number | null
  dataInicio?: number | string | null
  dataFim?: number | string | null
  tipoContratacao?: string | null
}

export interface BeneficiarioBruto {
  id: number | string
  nome?: string | null
  parentesco?: string | null
  dataInicio?: number | string | null
  dataFim?: number | string | null
  produto?: ProdutoBruto[] | null
}

/** GET operacao-implatancao-contrato-adesao/obter/{numeroContrato} */
export interface ContratoBruto {
  id: number
  numeroContrato: string | number
  tipoContratacao?: string | null
  beneficiarios?: BeneficiarioBruto[] | null
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
  lancamentos?: { nome?: string | null, parentesco?: string | null, tipoLancamento?: string | null, valorComercial?: number | null }[] | null
}

/** POST operacao-recepcao-proposta-adesao/login */
export interface LoginBruto {
  token?: string | null
  propostaAdesao?: {
    idContratoAdesao: number
    numeroContrato: string | number
    tipoContratacao?: string | null
    proponentes?: {
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
export function mapearLogin(login: LoginBruto, hoje = new Date()) {
  const hojeTexto = hojeIso(hoje)
  if (!login.token) return null
  const contratos = (login.propostaAdesao ?? []).flatMap((c, i) => {
    const titular = (c.proponentes ?? []).find(p => p.parentesco?.toUpperCase() === 'TITULAR')
    if (!titular) return []
    const produto = titular.produto?.[0]
    const ativo = ativoEm(titular.dataFim, hojeTexto)
    const cliente: ContratoCliente = {
      id: `c${i + 1}`,
      numero: String(c.numeroContrato),
      tipo: tipoDoContrato(produto?.tipoContratacao, c.tipoContratacao),
      papel: 'titular',
      situacao: ativo ? 'ativo' : 'cancelado',
      plano: String(produto?.nomeAmigavelProduto ?? produto?.nomePlano ?? produto?.fornecedor ?? 'Plano'),
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
  if (!contratos.length) return null
  const nome = (contratos.find(c => c.cliente.situacao === 'ativo') ?? contratos[0]!).nome || 'Cliente'
  const primeiro = nome.split(/\s+/)[0]!
  return {
    pessoa: { nome, primeiroNome: primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() },
    contratos: contratos.map(({ cliente, gateway }) => ({ cliente, gateway })),
  }
}

// ------------------------------------------------------------------ família

function mapearProduto(p: ProdutoBruto, dataInicioPessoa: string): ProdutoBeneficiario {
  return {
    nome: String(p.nomeAmigavelProduto ?? p.nomePlano ?? 'Plano'),
    tipo: /odont/i.test(`${p.nomePlano ?? ''} ${p.nomeAmigavelProduto ?? ''}`) ? 'odonto' : 'saude',
    operadora: String(p.fornecedor ?? ''),
    registroAns: p.codigoProdutoNoRegulador ? String(p.codigoProdutoNoRegulador) : '',
    acomodacao: p.padraoAcomodacaoProduto ? parentescoLegivel(p.padraoAcomodacaoProduto) : undefined,
    inicioVigencia: paraDataIso(p.dataInicio) || dataInicioPessoa,
    valorMensal: Number(p.valorVenda ?? 0),
  }
}

function mapearPessoa(b: BeneficiarioBruto, hojeTexto: string): BeneficiarioPlano {
  const produtos = (b.produto ?? []).filter(p => ativoEm(p.dataFim, hojeTexto))
  const inicio = paraDataIso(b.dataInicio)
  return {
    id: String(b.id),
    nome: String(b.nome ?? '').trim(),
    parentesco: parentescoLegivel(b.parentesco),
    titular: b.parentesco?.toUpperCase() === 'TITULAR',
    numeroCarteirinha: String(produtos.find(p => p.numeroCartaoIdentificacao)?.numeroCartaoIdentificacao ?? ''),
    produtos: produtos.map(p => mapearProduto(p, inicio)),
  }
}

/** Titular e dependentes ATIVOS do contrato. Ex.: mapearFamilia(contratoDoBackend) */
export function mapearFamilia(contrato: ContratoBruto, hoje = new Date()): MinhaFamilia {
  const hojeTexto = hojeIso(hoje)
  const pessoas = (contrato.beneficiarios ?? []).filter(b => ativoEm(b.dataFim, hojeTexto)).map(b => mapearPessoa(b, hojeTexto))
  const titular = pessoas.find(p => p.titular)
  if (!titular) throw new Error(`contrato ${contrato.numeroContrato} sem titular ativo; esperado um beneficiário com parentesco "TITULAR"`)
  return { titular, dependentes: pessoas.filter(p => !p.titular) }
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

function itensPorPessoa(c: CobrancaBruta) {
  const porPessoa = new Map<string, number>()
  for (const l of c.lancamentos ?? []) {
    const chave = `${String(l.nome ?? 'Beneficiário').trim()} (${parentescoLegivel(l.parentesco).toLowerCase()})`
    porPessoa.set(chave, (porPessoa.get(chave) ?? 0) + Number(l.valorComercial ?? 0))
  }
  return [...porPessoa].map(([descricao, valor]) => ({ descricao, valor: Math.round(valor * 100) / 100 }))
}

/** Lista do portal: sem canceladas/erro, da mais nova para a mais antiga. */
export function mapearFaturas(cobrancas: CobrancaBruta[], hoje = new Date()): Fatura[] {
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
        itens: itensPorPessoa(c),
      }
    })
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento))
}

/** Detalhe por pessoa para o extrato: cada tipo de lançamento vira uma linha. */
export function mapearGruposExtrato(c: CobrancaBruta): GrupoExtrato[] {
  const grupos = new Map<string, GrupoExtrato>()
  for (const l of c.lancamentos ?? []) {
    const nome = String(l.nome ?? 'Beneficiário').trim()
    const grupo = grupos.get(nome) ?? { beneficiario: nome, parentesco: parentescoLegivel(l.parentesco), linhas: [], subtotal: 0 }
    const valor = Number(l.valorComercial ?? 0)
    grupo.linhas.push({ descricao: String(l.tipoLancamento ?? 'Mensalidade'), valor })
    grupo.subtotal = Math.round((grupo.subtotal + valor) * 100) / 100
    grupos.set(nome, grupo)
  }
  return [...grupos.values()]
}
