/**
 * Plano de saúde anterior do dependente (inclusão comum). Reduz carência no Vexur; por isso os dados vão no pedido.
 * Como no CRM: tipo do plano anterior, operadora, nome do plano, tempo de plano (meses) e data do último pagamento.
 */
export interface PlanoAnterior {
  tipo: string
  operadora: string
  plano: string
  tempoMeses: string
  /** AAAA-MM-DD */
  ultimoPagamento: string
}

export const TIPOS_DE_PLANO_ANTERIOR = ['Individual ou familiar', 'Coletivo por adesão', 'Coletivo empresarial (da empresa)']

export function problemaNoPlanoAnterior(p: Partial<PlanoAnterior> | null | undefined, hoje: Date = new Date()): string | null {
  const x = p ?? {}
  if (!String(x.tipo ?? '').trim()) return 'Escolha o tipo do plano anterior.'
  if (!String(x.operadora ?? '').trim()) return 'Escreva a operadora do plano anterior.'
  if (!String(x.plano ?? '').trim()) return 'Escreva o nome do plano anterior.'
  const meses = Number(String(x.tempoMeses ?? '').replace(',', '.'))
  if (!String(x.tempoMeses ?? '').trim() || !Number.isFinite(meses) || meses < 0 || meses > 1200) return 'Informe há quantos meses a pessoa tem ou teve o plano.'
  const d = String(x.ultimoPagamento ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(d + 'T12:00:00').getTime())) return 'Informe a data do último pagamento do plano anterior.'
  if (new Date(d + 'T00:00:00') > hoje) return 'A data do último pagamento não pode estar no futuro.'
  return null
}

export function limparPlanoAnterior(p: Partial<PlanoAnterior> | null | undefined): PlanoAnterior {
  const t = (v: unknown, max = 80) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
  return {
    tipo: t(p?.tipo, 40), operadora: t(p?.operadora), plano: t(p?.plano),
    tempoMeses: t(p?.tempoMeses, 6).replace(',', '.'), ultimoPagamento: t(p?.ultimoPagamento, 10),
  }
}
