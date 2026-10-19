import type { CampoAlteravel, DecisaoDeAlteracao, DecisaoDeMovimentacao, TipoDeMovimentacao } from '../types/portal'

/**
 * Decide, com a regra "Serviços online" do Vexur, o que cada ator pode alterar no portal e como:
 * na hora (Imediato) ou por aprovação da administradora (Sob aprovação).
 *
 * Cada linha da regra tem: ator (quem usa), local (onde), tipo (o que faz), atendimento, documentos e mensagem.
 * Os textos de ator/local/tipo vêm do cadastro de domínios do Vexur; aqui eles são reconhecidos por palavras-chave,
 * sem depender de acento ou de maiúsculas.
 */

export type AtorDaAlteracao = 'titular' | 'representante'

export interface LinhaDaRegraServicosOnline {
  ator?: string | null
  local?: string | null
  tipo?: string | null
  atendimento?: string | null
  documentos?: string[] | string | null
  mensagem?: string | null
}

function normalizar(t: unknown): string {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

const DO_ATOR: Record<AtorDaAlteracao, RegExp> = {
  titular: /TITULAR|BENEFICIARIO|CLIENTE/,
  representante: /REPRESENT|RESPONSAVEL|EMPRESA/,
}

/**
 * Palavras que identificam, no texto do "O que faz?", cada alteração que o portal sabe fazer.
 * "Dados cadastrais" libera SÓ os dados pessoais (nome, nascimento...): e-mail, telefone e endereço
 * só valem se a regra tiver um tipo para cada um.
 */
const DO_CAMPO: Record<CampoAlteravel, RegExp> = {
  dados: /CADASTR|DADOS PESSOAIS|PESSOAL/,
  email: /E-?MAIL/,
  celular: /CELULAR|TELEFONE/,
  telefone: /TELEFONE|FIXO/,
  endereco: /ENDERECO/,
}

/** O serviço pode ser de qualquer lugar; só fica de fora o que diz expressamente que é de outro (ex.: atendimento interno). */
function localAceito(local: unknown): boolean {
  const t = normalizar(local)
  return !t || /PORTAL|CLIENTE|ONLINE|SITE|APP/.test(t)
}

function atendimentoDe(valor: unknown): 'imediato' | 'aprovacao' {
  // Regra antiga, sem o campo preenchido: o jeito seguro é passar por aprovação.
  return /IMEDIAT/.test(normalizar(valor)) ? 'imediato' : 'aprovacao'
}

function listaDeDocumentos(valor: LinhaDaRegraServicosOnline['documentos']): string[] {
  const lista = Array.isArray(valor) ? valor : String(valor ?? '').split(/[;,]/)
  return lista.map(d => String(d).trim()).filter(Boolean)
}

/**
 * Decisão para um ator e uma alteração. Sem linha na regra (ou sem regra): NÃO disponível.
 * Se duas linhas valem para o mesmo caso, vale a mais cautelosa (por aprovação) e os documentos se somam.
 */
export function decidirAlteracao(
  regra: LinhaDaRegraServicosOnline[] | null | undefined,
  campo: CampoAlteravel,
  ator: AtorDaAlteracao,
): DecisaoDeAlteracao {
  const linhas = (regra ?? []).filter(l =>
    DO_ATOR[ator].test(normalizar(l.ator)) && DO_CAMPO[campo].test(normalizar(l.tipo)) && localAceito(l.local),
  )
  // "Telefone" e "celular" podem ser a mesma linha da regra; um tipo que cita só um deles não vale para o outro.
  const especificas = linhas.filter((l) => {
    const t = normalizar(l.tipo)
    if (campo === 'celular') return !/FIXO/.test(t)
    if (campo === 'telefone') return !/CELULAR/.test(t)
    return true
  })
  if (!especificas.length) return { campo, disponivel: false, atendimento: 'aprovacao', documentos: [] }
  return {
    campo,
    disponivel: true,
    atendimento: especificas.some(l => atendimentoDe(l.atendimento) === 'aprovacao') ? 'aprovacao' : 'imediato',
    documentos: [...new Set(especificas.flatMap(l => listaDeDocumentos(l.documentos)))],
    mensagem: especificas.map(l => String(l.mensagem ?? '').trim()).find(Boolean) || undefined,
  }
}

const CAMPOS: CampoAlteravel[] = ['dados', 'email', 'celular', 'telefone', 'endereco']

export function decisoesDaRegra(regra: LinhaDaRegraServicosOnline[] | null | undefined, ator: AtorDaAlteracao): DecisaoDeAlteracao[] {
  return CAMPOS.map(c => decidirAlteracao(regra, c, ator))
}

// ---------------------------------------------------------------- Movimentação (incluir e tirar pessoas)

const ACAO_DA_MOVIMENTACAO: Record<'incluir' | 'excluir', RegExp> = {
  incluir: /INCLU/,
  excluir: /EXCLU|CANCEL|SAIDA|RETIRAD|REMOCAO/,
}

/**
 * O texto do tipo diz se vale para titular, dependente ou os dois. Sem citar nenhum dos dois
 * ("Inclusão de beneficiário"), vale para ambos.
 */
function cobreQuem(tipo: string, quem: 'titular' | 'dependente'): boolean {
  const titular = /TITULAR/.test(tipo)
  const dependente = /DEPENDENTE/.test(tipo)
  if (!titular && !dependente) return true
  return quem === 'titular' ? titular : dependente
}

/** Pode o ator incluir/tirar titular ou dependente? E como (na hora ou por aprovação)? Sem linha na regra: não. */
export function decidirMovimentacao(
  regra: LinhaDaRegraServicosOnline[] | null | undefined,
  tipo: TipoDeMovimentacao,
  ator: AtorDaAlteracao,
): DecisaoDeMovimentacao {
  const [acao, quem] = tipo.split('-') as ['incluir' | 'excluir', 'titular' | 'dependente']
  const linhas = (regra ?? []).filter((l) => {
    const t = normalizar(l.tipo)
    return DO_ATOR[ator].test(normalizar(l.ator)) && localAceito(l.local) && ACAO_DA_MOVIMENTACAO[acao].test(t) && cobreQuem(t, quem)
  })
  if (!linhas.length) return { tipo, disponivel: false, atendimento: 'aprovacao', documentos: [] }
  return {
    tipo,
    disponivel: true,
    atendimento: linhas.some(l => atendimentoDe(l.atendimento) === 'aprovacao') ? 'aprovacao' : 'imediato',
    documentos: [...new Set(linhas.flatMap(l => listaDeDocumentos(l.documentos)))],
    mensagem: linhas.map(l => String(l.mensagem ?? '').trim()).find(Boolean) || undefined,
  }
}

const MOVIMENTACOES: TipoDeMovimentacao[] = ['incluir-titular', 'incluir-dependente', 'excluir-titular', 'excluir-dependente']

export function decisoesDeMovimentacao(regra: LinhaDaRegraServicosOnline[] | null | undefined, ator: AtorDaAlteracao): DecisaoDeMovimentacao[] {
  return MOVIMENTACOES.map(t => decidirMovimentacao(regra, t, ator))
}
