import type { H3Event } from 'h3'

/** Nome do serviço no gateway → chave em runtimeConfig.apiKeys */
export const SERVICOS_GATEWAY = {
  'api-vexur-seguranca': 'seguranca',
  'api-vexur-portal-cliente-seguranca': 'portalClienteSeguranca',
  'api-vexur-operacao-recepcao-proposta-adesao': 'operacaoRecepcaoPropostaAdesao',
  'api-vexur-operacao-implatancao-contrato-adesao': 'operacaoImplantacaoContratoAdesao',
  'api-vexur-faturamento-extrato-cliente': 'faturamentoExtratoCliente',
  'api-vexur-faturamento-cobranca-gerar': 'faturamentoCobrancaGerar',
  'api-vexur-faturamento-cobranca-admin': 'faturamentoCobrancaAdmin',
  'api-vexur-regra-venda-comunicacao': 'regraVendaComunicacao',
  'api-vexur-regra-aceitacao-declaracao-saude': 'regraAceitacaoDeclaracaoSaude',
  'api-vexur-workflow-process': 'workflowProcess',
  'api-vexur-repositorio-documentos': 'repositorioDocumentos',
  'api-vexur-dominio': 'dominio',
} as const

export type ServicoGateway = keyof typeof SERVICOS_GATEWAY

/** Credenciais do cliente no gateway. Ficam só na sessão (cookie criptografado), nunca vão ao navegador. */
export interface AcessoGateway {
  token: string
  login: string
}

interface ChamadaGateway {
  servico: ServicoGateway
  /** Caminho depois do nome do serviço. Ex.: "/obterLancamentosPorContrato" */
  caminho: string
  metodo?: 'GET' | 'POST'
  corpo?: unknown
  /** Credenciais do cliente. Ausente só no login. */
  acesso?: AcessoGateway
  /** Escrita (inclui, exclui, abre processo, envia e-mail): exige NUXT_PERMITIR_ESCRITA=true. */
  escrita?: boolean
  /** "binario" para PDFs (ex.: 2ª via do boleto) */
  resposta?: 'json' | 'binario'
}

const TEMPO_LIMITE_MS = 20_000

function configuracao() {
  const config = useRuntimeConfig()
  const base = String(config.gatewayUrl ?? '').replace(/\/+$/, '')
  if (!base) throw createError({ statusCode: 503, message: 'O portal não está ligado ao sistema (NUXT_GATEWAY_URL vazio).' })
  return { base, config }
}

function chaveDoServico(servico: ServicoGateway): string {
  const { config } = configuracao()
  const nome = SERVICOS_GATEWAY[servico]
  const chave = (config.apiKeys as Record<string, string>)[nome]
  if (!chave) {
    throw createError({ statusCode: 503, message: `Falta a chave do serviço ${servico} no .env (NUXT_API_KEYS_${nome.replace(/[A-Z]/g, l => `_${l}`).toUpperCase()}).` })
  }
  return chave
}

/** Registro estruturado, sem chave, token, CPF ou corpo da requisição. */
function registrar(dados: Record<string, unknown>) {
  console.info(JSON.stringify({ origem: 'gateway', ...dados }))
}

/** Trava de escrita + trilha de auditoria de toda escrita permitida. */
function garantirEscritaPermitida(chamada: ChamadaGateway) {
  if (!chamada.escrita) return
  const permitida = String(useRuntimeConfig().permitirEscrita) === 'true'
  if (!permitida) {
    throw createError({ statusCode: 423, message: 'Este ambiente está em modo só leitura. Peça para ligar NUXT_PERMITIR_ESCRITA para enviar pedidos.' })
  }
  registrar({ tipo: 'auditoria-escrita', servico: chamada.servico, caminho: chamada.caminho, login: chamada.acesso?.login ? 'presente' : 'ausente', quando: new Date().toISOString() })
}

function erroAmigavel(status: number | undefined, servico: ServicoGateway): never {
  if (status === 401 || status === 403) {
    throw createError({ statusCode: 401, message: 'Sua sessão terminou. Entre de novo, por favor.' })
  }
  if (status === 404) throw createError({ statusCode: 404, message: 'Não encontramos essa informação.' })
  throw createError({ statusCode: 502, message: `O sistema (${servico}) não respondeu agora. Tente de novo em instantes.` })
}

/**
 * Chama um serviço do gateway Vexur a partir do servidor do portal.
 * Ex.: chamarGateway({ servico: 'api-vexur-faturamento-extrato-cliente', caminho: '/obterLancamentosPorContrato', metodo: 'POST', corpo: { idContratoAdesao }, acesso })
 */
export async function chamarGateway<T>(chamada: ChamadaGateway): Promise<T> {
  garantirEscritaPermitida(chamada)
  const { base } = configuracao()
  const url = `${base}/${chamada.servico}${chamada.caminho}`
  const inicio = Date.now()
  try {
    const resposta = await $fetch.raw(url, {
      method: chamada.metodo ?? 'GET',
      query: { 'api-key': chaveDoServico(chamada.servico) },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': chamada.acesso?.token ?? '',
        'Login': chamada.acesso?.login ?? '',
      },
      body: chamada.corpo as Record<string, unknown> | undefined,
      responseType: chamada.resposta === 'binario' ? 'arrayBuffer' : 'json',
      timeout: TEMPO_LIMITE_MS,
    })
    registrar({ servico: chamada.servico, caminho: chamada.caminho, status: resposta.status, ms: Date.now() - inicio })
    return resposta._data as T
  } catch (erro) {
    const status = (erro as { response?: { status?: number } }).response?.status
    registrar({ servico: chamada.servico, caminho: chamada.caminho, status: status ?? 'sem-resposta', ms: Date.now() - inicio })
    if ((erro as { statusCode?: number }).statusCode === 503) throw erro
    erroAmigavel(status, chamada.servico)
  }
}

/** Credenciais do gateway guardadas na sessão do cliente logado. */
export async function acessoDaSessao(event: H3Event): Promise<{ acesso: AcessoGateway, contrato: ContratoDaSessao }> {
  const sessao = await usarSessao(event)
  const g = sessao.data.gateway
  if (!g) throw createError({ statusCode: 401, message: 'Sua sessão terminou. Entre de novo, por favor.' })
  if (!g.contrato) throw createError({ statusCode: 403, message: 'Escolha qual plano você quer ver.' })
  return { acesso: { token: g.token, login: g.login }, contrato: g.contrato }
}

export interface ContratoDaSessao {
  idContratoAdesao: number
  numeroContrato: string
  tipoContratacao: string
}
