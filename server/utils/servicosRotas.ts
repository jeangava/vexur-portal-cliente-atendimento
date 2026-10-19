import type { ServicoGateway } from './gateway'

/**
 * Como o portal gera cada documento dos Serviços. Espelha a tela "Comunicações" do sistema de contratos
 * (modo "gerar visualização": devolve o link do PDF, sem enviar e-mail).
 * O nome do tipo vem da regra de comunicação do contrato; o resto sai desta tabela.
 */

export type CampoDoServico = 'ano' | 'competencia'

export interface ContextoDoServico {
  tipoComunicacao: string
  idContratoAdesao: number
  idContratoConveniado?: number
}

export interface RotaDoServico {
  /** Texto que identifica o tipo (sem acento, maiúsculo) */
  serve: RegExp
  titulo: string
  servico: ServicoGateway
  caminho: string
  /** Campos que o cliente escolhe antes de gerar */
  campos: CampoDoServico[]
  /** Documento só da empresa (ex.: boas-vindas da empresa): só o responsável pede */
  paraEmpresa?: boolean
  /**
   * Envolve valores (cobranças): o responsável pede o da EMPRESA inteira, sem escolher pessoa
   * (o serviço devolve o documento da empresa quando o contrato é empresarial).
   */
  valores?: boolean
  corpo: (c: ContextoDoServico, form: Partial<Record<CampoDoServico, string>>) => Record<string, unknown>
}

function pedido(c: ContextoDoServico, extra: Record<string, unknown> = {}) {
  return {
    tipoComunicacao: c.tipoComunicacao,
    payload: { idContratoAdesao: c.idContratoAdesao, urlDocumento: null, destinatarios: '', assunto: '', gerarVisualizacao: true, ...extra },
  }
}

/** Só os campos combinados (ano, competência): nunca repassa o que a tela mandar a mais. */
const formDe = (form: Partial<Record<CampoDoServico, string>>) => ({
  ...(form.ano ? { ano: form.ano } : {}),
  ...(form.competencia ? { competencia: form.competencia } : {}),
})

/**
 * A competência (mês) chega como "09/2026", mas o serviço de quitação a usa como DATA de referência da regra
 * (comparada com a vigência) e no modelo do PDF: precisa ser o instante do dia 1º do mês (meia-noite de Brasília), em ms.
 * Texto aí faz a regra não casar e o serviço responder 500.
 */
export function competenciaEmMs(competencia: string | undefined): number | undefined {
  const m = /^(\d{2})\/(\d{4})$/.exec(String(competencia ?? ''))
  return m ? Date.UTC(Number(m[2]), Number(m[1]) - 1, 1, 3, 0, 0) : undefined
}

/** Ordem importa: o mais específico vem antes (ex.: boas-vindas da empresa antes da boas-vindas comum). */
export const ROTAS_DE_SERVICO: RotaDoServico[] = [
  {
    serve: /BOAS.?VINDAS.*PME|PME.*BOAS.?VINDAS/, titulo: 'Carta de boas-vindas da empresa',
    servico: 'api-vexur-regra-movimentacao-alteracao-cadastral', caminho: '/carteirinha/enviar-boas-vindas-empresarial',
    campos: [], paraEmpresa: true,
    corpo: c => pedido(c, { idContratoAdesao: null, idContratoConveniado: c.idContratoConveniado ?? null }),
  },
  {
    serve: /BOAS.?VINDAS/, titulo: 'Carta de boas-vindas',
    servico: 'api-vexur-regra-movimentacao-alteracao-cadastral', caminho: '/carteirinha/enviar-boas-vindas',
    campos: [], corpo: c => pedido(c),
  },
  {
    serve: /ANUAL DE DEBITO/, titulo: 'Declaração anual de débitos',
    servico: 'api-vexur-faturamento-cobranca-admin', caminho: '/enviar-declaracao-anual-debito',
    campos: ['ano'], valores: true, corpo: (c, f) => pedido(c, formDe(f)),
  },
  {
    serve: /QUITACAO DE DEBITO/, titulo: 'Carta de quitação de débito',
    servico: 'api-vexur-faturamento-cobranca-admin', caminho: '/enviar-carta-quitacao-debito',
    campos: ['competencia'], valores: true, corpo: (c, f) => pedido(c, { competencia: competenciaEmMs(f.competencia) }),
  },
  {
    serve: /^IRPF$|IMPOSTO DE RENDA|INFORME DE RENDIMENTO/, titulo: 'Informe de rendimentos (IR)',
    servico: 'api-vexur-faturamento-cobranca-admin', caminho: '/enviar-declaracao-imposto-renda',
    campos: ['ano'], valores: true, corpo: (c, f) => pedido(c, formDe(f)),
  },
  {
    serve: /EXTRATO DE COBRANCA/, titulo: 'Extrato de cobrança',
    servico: 'api-vexur-faturamento-cobranca-admin', caminho: '/enviar-extrato-cobranca',
    campos: ['ano'], valores: true, corpo: (c, f) => pedido(c, formDe(f)),
  },
]

function semAcentoMaiusculo(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

export function rotaDoServico(tipoComunicacao: string): RotaDoServico | undefined {
  const t = semAcentoMaiusculo(tipoComunicacao)
  return ROTAS_DE_SERVICO.find(r => r.serve.test(t))
}

/** Identificador estável do serviço na tela (o mesmo para o mesmo tipo). */
export function idDoServicoDoTipo(tipoComunicacao: string): string {
  return 'sv-' + semAcentoMaiusculo(tipoComunicacao).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
