import type { CampoAlteravel, DecisaoDeAlteracao } from '../types/portal'

/**
 * Como cada alteração cadastral anda no Vexur: quem manda é o FLUXO (workflow), não a regra "Serviços online".
 * Um fluxo só com etapas automáticas muda o dado na hora; um fluxo com etapa manual passa pela área de cadastro.
 *
 * Conferido nos modelos de fluxo da homologação (Tecgroup). Se alguém mudar um fluxo no Vexur, mude aqui também.
 * O nome do processo é o que `api-vexur-workflow-process/iniciar-processo` espera.
 */
export interface FluxoDaAlteracao {
  /** Nome exato do processo no Vexur */
  processo: string
  /** Tipo da regra de movimentação que o serviço de alteração cadastral valida */
  tipoParametroRegra: string
  /** Onde o fluxo grava o pedido */
  contexto: 'ContratoAdesao' | 'Beneficiario'
  /** imediato: só etapas automáticas · aprovacao: tem etapa manual (área de cadastro) */
  atendimento: 'imediato' | 'aprovacao'
}

export const FLUXO_DA_ALTERACAO: Record<CampoAlteravel, FluxoDaAlteracao> = {
  email: { processo: 'Alteração de e-mail', tipoParametroRegra: 'ALTERAÇÃO DE E-MAIL', contexto: 'ContratoAdesao', atendimento: 'imediato' },
  celular: { processo: 'Alteração de telefone', tipoParametroRegra: 'ALTERAÇÃO DE TELEFONE', contexto: 'ContratoAdesao', atendimento: 'imediato' },
  telefone: { processo: 'Alteração de telefone', tipoParametroRegra: 'ALTERAÇÃO DE TELEFONE', contexto: 'ContratoAdesao', atendimento: 'imediato' },
  endereco: { processo: 'Alteração de endereço', tipoParametroRegra: 'ALTERAÇÃO DE ENDEREÇO', contexto: 'ContratoAdesao', atendimento: 'imediato' },
  dados: { processo: 'Alteração cadastral - via portal', tipoParametroRegra: 'ALTERAÇÃO CADASTRAL', contexto: 'Beneficiario', atendimento: 'aprovacao' },
}

/** O mesmo que a regra liberou, mas com "na hora" ou "aprovação" vindo do fluxo. */
export function comAtendimentoDoFluxo(decisoes: DecisaoDeAlteracao[]): DecisaoDeAlteracao[] {
  return decisoes.map(d => ({ ...d, atendimento: FLUXO_DA_ALTERACAO[d.campo].atendimento }))
}
