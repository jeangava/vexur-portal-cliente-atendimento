import type { ContratoDaSessao } from './gateway'
import type { CobrancaBruta, ContratoBruto, LoginBruto } from './mapeamento'
import type { ContratoCliente } from '#shared/types/portal'

/**
 * Chamadas reais ao gateway Vexur — fase 1 (leitura): login, família, contas e extrato.
 * Toda chamada usa as credenciais da SESSÃO e o contrato gravado no login: o navegador
 * nunca escolhe o contrato. Isso fecha o buraco dos serviços que só validam o token
 * e não o dono do contrato (ex.: obterLancamentosPorContrato).
 */

export interface LoginNoGateway {
  pessoa: { nome: string, primeiroNome: string }
  contratos: ContratoCliente[]
  gateway: { token: string, login: string, contratos: Record<string, ContratoDaSessao> }
}

/**
 * Login do legado: POST /login só com o CPF (formato 000.000.000-00, igual ao portal antigo).
 * O backend ainda não tem CPF + senha; por isso só roda com NUXT_LOGIN_SOMENTE_CPF=true.
 */
export async function loginNoGateway(cpf: string): Promise<LoginNoGateway | null> {
  if (String(useRuntimeConfig().loginSomenteCpf) !== 'true') {
    throw createError({
      statusCode: 501,
      message: 'O login com senha ainda não existe no sistema. Para testar, ligue NUXT_LOGIN_SOMENTE_CPF=true (a senha não é conferida).',
    })
  }
  const cpfFormatado = formatarCpf(cpf)
  const resposta = await chamarGateway<LoginBruto>({
    servico: 'api-vexur-operacao-recepcao-proposta-adesao',
    caminho: '/login',
    metodo: 'POST',
    corpo: { cpfTitular: cpfFormatado },
  }).catch((erro: { statusCode?: number }) => {
    if (erro.statusCode === 401 || erro.statusCode === 404) return null
    throw erro
  })
  if (!resposta) return null
  const mapeado = mapearLogin(resposta)
  if (!mapeado) return null
  return {
    pessoa: mapeado.pessoa,
    contratos: mapeado.contratos.map(c => c.cliente),
    gateway: {
      token: String(resposta.token),
      login: cpfFormatado,
      contratos: Object.fromEntries(mapeado.contratos.map(c => [c.cliente.id, c.gateway])),
    },
  }
}

async function credenciais() {
  return acessoDaSessao(useEvent())
}

export async function contratoNoGateway(): Promise<ContratoBruto> {
  const { acesso, contrato } = await credenciais()
  return chamarGateway<ContratoBruto>({
    servico: 'api-vexur-operacao-implatancao-contrato-adesao',
    caminho: `/obter/${encodeURIComponent(contrato.numeroContrato)}`,
    acesso,
  })
}

/** Cobranças do contrato da sessão (PF). PME usa o endpoint do conveniado — próxima fase. */
export async function cobrancasNoGateway(): Promise<CobrancaBruta[]> {
  const { acesso, contrato } = await credenciais()
  if (contrato.tipoContratacao === 'EMPRESARIAL') {
    throw createError({ statusCode: 501, message: 'Contas de plano empresarial (PME) ainda não estão ligadas ao portal.' })
  }
  const lista = await chamarGateway<CobrancaBruta[]>({
    servico: 'api-vexur-faturamento-extrato-cliente',
    caminho: '/obterLancamentosPorContrato',
    metodo: 'POST',
    corpo: { idContratoAdesao: contrato.idContratoAdesao },
    acesso,
  })
  return Array.isArray(lista) ? lista : []
}

export async function cobrancaNoGateway(id: string): Promise<CobrancaBruta> {
  const cobranca = (await cobrancasNoGateway()).find(c => idDaCobranca(c) === id)
  if (!cobranca) throw createError({ statusCode: 404, message: 'Não encontramos essa conta.' })
  return cobranca
}
