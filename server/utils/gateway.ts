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
  'api-vexur-envio-comunicacao': 'envioComunicacao',
  'api-vexur-regra-servicos-online': 'regraServicosOnline',
  'api-vexur-localidades': 'localidades',
  'api-vexur-regra-movimentacao-alteracao-cadastral': 'regraMovimentacaoAlteracaoCadastral',
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
  /** Tempo máximo de espera (padrão 20 s). O login do legado às vezes passa disso. */
  tempoLimiteMs?: number
}

const TEMPO_LIMITE_MS = 20_000

function configuracao() {
  const config = useRuntimeConfig()
  const base = String(config.gatewayUrl ?? '').replace(/\/+$/, '')
  if (!base) throw createError({ statusCode: 503, message: 'O portal não está ligado ao sistema (NUXT_GATEWAY_URL vazio).' })
  return { base, config }
}

/**
 * Serviços que o sistema Vexur já chama SEM api-key na URL (conferido no navegador do sistema atual).
 * Se não houver chave configurada, o portal faz igual: chama sem ela. Se houver, usa.
 */
const SERVICOS_CHAMADOS_SEM_CHAVE = new Set<ServicoGateway>(['api-vexur-regra-venda-comunicacao'])

function chaveDoServico(servico: ServicoGateway): string | undefined {
  const { config } = configuracao()
  const nome = SERVICOS_GATEWAY[servico]
  const chave = (config.apiKeys as Record<string, string>)[nome]
  if (!chave && SERVICOS_CHAMADOS_SEM_CHAVE.has(servico)) return undefined
  if (!chave) {
    // Só os NOMES das chaves vazias (nunca os valores): ajuda a achar erro de digitação no .env.
    const vazias = Object.entries(config.apiKeys as Record<string, string>).filter(([, v]) => !v).map(([k]) => k)
    console.info(JSON.stringify({ origem: 'chaves-vazias', procurada: nome, vazias }))
    throw createError({ statusCode: 503, message: `Falta a chave do serviço ${servico} no .env (NUXT_API_KEYS_${nome.replace(/[A-Z]/g, l => `_${l}`).toUpperCase()}).` })
  }
  // Colar no .env às vezes traz espaço ou aspas junto: limpa antes de usar.
  return String(chave).trim().replace(/^['"]|['"]$/g, '')
}

/**
 * Motivo curto que o gateway/serviço devolveu no erro (ex.: "Invalid API key").
 * Só campos de mensagem, no máximo 160 caracteres, sem números longos (evita CPF/token no log).
 */
function motivoDoErro(erro: unknown): string | undefined {
  const dados = (erro as { response?: { _data?: unknown } }).response?._data
  const bruto = typeof dados === 'string'
    ? dados
    : dados && typeof dados === 'object'
      ? ['message', 'mensagem', 'error', 'erro', 'statusMessage'].map(k => (dados as Record<string, unknown>)[k]).find(v => typeof v === 'string')
      : undefined
  if (typeof bruto !== 'string') return undefined
  return bruto.replace(/<[^>]+>/g, ' ').replace(/\d{6,}/g, '[número]').replace(/\s+/g, ' ').trim().slice(0, 160) || undefined
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

/** Rota que ainda não existe no serviço (Express responde "Cannot POST /..."). Usado para cair no plano B. */
export function ehRotaInexistente(erro: unknown): boolean {
  const e = erro as { statusCode?: number, data?: { motivo?: string } }
  return e.statusCode === 404 && /cannot (post|get)/i.test(e.data?.motivo ?? '')
}

function erroAmigavel(status: number | undefined, servico: ServicoGateway, motivo?: string): never {
  if (status === 401 || status === 403) {
    throw createError({ statusCode: 401, message: 'Sua sessão terminou. Entre de novo, por favor.' })
  }
  // O motivo curto (sem dados pessoais) vai em data, para quem chamou decidir o plano B.
  if (status === 404) throw createError({ statusCode: 404, message: 'Não encontramos essa informação.', data: { motivo } })
  if (status === undefined) {
    throw createError({ statusCode: 504, message: 'O sistema está demorando para responder. Espere um pouquinho e tente de novo.' })
  }
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
      query: chaveDoServico(chamada.servico) ? { 'api-key': chaveDoServico(chamada.servico) } : undefined,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': chamada.acesso?.token ?? '',
        'Login': chamada.acesso?.login ?? '',
      },
      body: chamada.corpo as Record<string, unknown> | undefined,
      responseType: chamada.resposta === 'binario' ? 'arrayBuffer' : 'json',
      timeout: chamada.tempoLimiteMs ?? TEMPO_LIMITE_MS,
    })
    registrar({ servico: chamada.servico, caminho: chamada.caminho, status: resposta.status, ms: Date.now() - inicio })
    return resposta._data as T
  } catch (erro) {
    const status = (erro as { response?: { status?: number } }).response?.status
    const motivo = motivoDoErro(erro)
    registrar({ servico: chamada.servico, caminho: chamada.caminho, status: status ?? 'sem-resposta', motivo, ms: Date.now() - inicio })
    if ((erro as { statusCode?: number }).statusCode === 503) throw erro
    erroAmigavel(status, chamada.servico, motivo)
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
  /** 0 quando o contrato é o da empresa (responsável de PME): nesse caso vale idContratoConveniado */
  idContratoAdesao: number
  /** Só para o responsável da empresa (login leve /login/portal) */
  idContratoConveniado?: number
  /** Só para o responsável da empresa: um contrato de beneficiário do grupo (porta de entrada do obter-pme) */
  numeroContratoAdesaoGrupo?: string
  numeroContrato: string
  tipoContratacao: string
}
