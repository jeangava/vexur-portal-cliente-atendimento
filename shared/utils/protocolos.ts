import type { PendenciaSolicitacao, SituacaoSolicitacao, Solicitacao } from '../types/portal'

/** Um protocolo do Vexur (gestão de protocolos): só os campos que o portal usa. */
export interface ProtocoloBruto {
  id: number | string
  protocolo: string
  processo: string
  dataCriacao?: number | string | null
  /** Ex.: "Pendente", "Em andamento", "Sucesso", "Reprovada", "Cancelada" (o texto exato vem do fluxo) */
  statusAtual?: string | null
}

function normalizar(t: unknown): string {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

/** O que o cliente vê: movimentação, alteração de dados; o resto dos fluxos (boleto, e-mail...) não aparece. */
export function categoriaDoProcesso(processo: string): Pick<Solicitacao, 'categoria' | 'tipo'> | null {
  const p = normalizar(processo)
  if (/INCLUS/.test(p)) return { categoria: 'movimentacao', tipo: 'inclusao' }
  if (/EXCLUS|CANCELAMENTO/.test(p)) return { categoria: 'movimentacao', tipo: 'exclusao' }
  if (/ALTERACAO/.test(p) && !/SENHA|PLANO|VENCIMENTO|CARTEIRINHA|CARENCIA/.test(p)) return { categoria: 'cadastro', tipo: 'alteracao-cadastral' }
  return null
}

/** Texto do status do fluxo → situação que o cliente entende. O desconhecido é "em análise" (o mais seguro de dizer). */
export function situacaoDoStatus(status: string | null | undefined): SituacaoSolicitacao {
  const s = normalizar(status)
  if (/SUCESSO|CONCLU|FINALIZ|APLICAD|APROVAD/.test(s)) return 'concluida'
  if (/REPROV/.test(s)) return 'pendente'
  if (/CANCEL|RECUS|NEGAD|INDEFER|EXCECAO|ERRO/.test(s)) return 'indeferida'
  return 'em-analise'
}

function isoDoDia(valor: number | string | null | undefined): string {
  const t = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor
  const d = new Date(t ?? NaN)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const DETALHE: Record<SituacaoSolicitacao, string> = {
  'em-analise': 'O pedido está sendo analisado. Você acompanha por aqui.',
  'pendente': 'A análise pediu algo a mais. Fale com a gente para regularizar.',
  'indeferida': 'O pedido não foi aceito.',
  'concluida': 'O pedido foi concluído.',
}

/**
 * Protocolo do Vexur → pedido do portal. `pessoa` (nome de quem entra ou sai) vem do payload, quando disponível.
 * Devolve null para fluxos que não são do cliente (ex.: envio de boleto por e-mail).
 */
export function solicitacaoDoProtocolo(p: ProtocoloBruto, pessoa?: string): Solicitacao | null {
  const tipo = categoriaDoProcesso(p.processo)
  if (!tipo || !p.protocolo) return null
  const situacao = situacaoDoStatus(p.statusAtual)
  const criadaEm = isoDoDia(p.dataCriacao)
  const nomeDoProcesso = String(p.processo ?? '').trim()
  const titulo = tipo.tipo === 'inclusao' ? (pessoa ? `Incluir ${pessoa}` : 'Incluir beneficiário')
    : tipo.tipo === 'exclusao' ? (pessoa ? `Tirar ${pessoa} do plano` : 'Tirar beneficiário do plano')
      : nomeDoProcesso.charAt(0).toUpperCase() + nomeDoProcesso.slice(1).toLowerCase()
  const pendencia: PendenciaSolicitacao | undefined = situacao === 'pendente'
    ? { tipo: 'informacao', descricao: 'A análise pediu uma correção ou um documento. Fale com a gente para regularizar.' }
    : undefined
  return {
    protocolo: p.protocolo, ...tipo, titulo, pessoa, criadaEm, situacao, detalhe: DETALHE[situacao], pendencia, anexos: [],
    historico: [
      ...(criadaEm ? [{ quando: criadaEm + 'T00:00:00', texto: 'Pedido registrado.' }] : []),
      ...(p.statusAtual ? [{ quando: new Date().toISOString(), texto: `Situação no sistema: ${p.statusAtual}.` }] : []),
    ],
  }
}
