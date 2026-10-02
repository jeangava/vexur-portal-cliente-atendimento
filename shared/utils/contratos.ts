import type { AcessoPortal, AreaPortal, ContratoCliente, TipoContrato, UsuarioPortal } from '#shared/types/portal'

/**
 * Regras de qual contrato o cliente vê e do que ele pode fazer em cada um.
 * Vale para a tela e para o servidor: a tela esconde, o servidor bloqueia.
 */

const TODAS_AS_AREAS: AreaPortal[] = ['contas', 'servicos', 'comunicados', 'familia', 'movimentacao', 'pedidos']

/**
 * - Individual / adesão (titular) e representante da empresa: tudo.
 * - Titular de empresarial (funcionário): só família (sem valores), comunicados e pedidos.
 * - Contrato cancelado: consulta contas antigas, documentos, família e pedidos; sem movimentação.
 */
export function acessoDoContrato(contrato: ContratoCliente): AcessoPortal {
  if (contrato.tipo === 'empresarial' && contrato.papel === 'titular') {
    return { areas: ['familia', 'comunicados', 'pedidos'], mostrarValores: false }
  }
  if (contrato.situacao === 'cancelado') {
    return { areas: TODAS_AS_AREAS.filter(a => a !== 'movimentacao'), mostrarValores: true }
  }
  return { areas: [...TODAS_AS_AREAS], mostrarValores: true }
}

/** Ativos primeiro (mais novos antes); depois os cancelados, do que terminou por último ao mais antigo. */
export function ordenarContratos(contratos: ContratoCliente[]): ContratoCliente[] {
  return [...contratos].sort((a, b) => {
    if (a.situacao !== b.situacao) return a.situacao === 'ativo' ? -1 : 1
    if (a.situacao === 'cancelado') return (b.fimVigencia ?? '').localeCompare(a.fimVigencia ?? '')
    return b.inicioVigencia.localeCompare(a.inicioVigencia)
  })
}

/**
 * Responsável pela empresa que também é titular no mesmo contrato: fica só a visão de responsável
 * (ela já mostra tudo). A visão de titular de empresarial é só para quem não é o responsável.
 */
export function simplificarContratos(contratos: ContratoCliente[]): ContratoCliente[] {
  const responsavelPor = new Set(contratos.filter(c => c.papel === 'representante').map(c => c.numero))
  return contratos.filter(c => c.papel === 'representante' || c.tipo !== 'empresarial' || !responsavelPor.has(c.numero))
}

/**
 * Só entra direto quando o CPF tem um contrato só (ativo ou cancelado).
 * Com mais de um, sempre pergunta — mesmo que só um esteja ativo.
 */
export function contratoAutomatico(contratos: ContratoCliente[]): ContratoCliente | undefined {
  return contratos.length === 1 ? contratos[0] : undefined
}

export function usuarioDoContrato(
  pessoa: { nome: string, primeiroNome: string },
  contratos: ContratoCliente[],
  contrato?: ContratoCliente,
): UsuarioPortal {
  return {
    nome: pessoa.nome,
    primeiroNome: pessoa.primeiroNome,
    plano: contrato?.plano ?? '',
    numeroContrato: contrato?.numero ?? '',
    contrato,
    acesso: contrato ? acessoDoContrato(contrato) : { areas: [], mostrarValores: false },
    podeTrocarContrato: contratos.length > 1,
  }
}

const AREA_POR_ROTA: [string, AreaPortal][] = [
  ['/contas', 'contas'],
  ['/servicos', 'servicos'],
  ['/comunicados', 'comunicados'],
  ['/familia', 'familia'],
  ['/movimentacao', 'movimentacao'],
  ['/pedidos', 'pedidos'],
]

/** Área do portal de uma rota da tela (undefined = livre para todos, ex.: Início e Ajuda). */
export function areaDaRota(caminho: string): AreaPortal | undefined {
  return AREA_POR_ROTA.find(([prefixo]) => caminho === prefixo || caminho.startsWith(`${prefixo}/`))?.[1]
}

export const ROTULO_TIPO_CONTRATO: Record<TipoContrato, string> = {
  individual: 'Plano individual ou familiar',
  adesao: 'Plano por adesão',
  empresarial: 'Plano da empresa',
}

/** Frase curta de como a pessoa participa do contrato, para o cartão de escolha. */
export function papelLegivel(contrato: ContratoCliente): string {
  if (contrato.papel === 'representante') return 'Você é o responsável pela empresa'
  return contrato.tipo === 'empresarial' ? 'Você é titular pela empresa' : 'Você é o titular'
}
