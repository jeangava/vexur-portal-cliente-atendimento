/**
 * Decide se a inclusão de um titular em empresa (PME) pede declaração de saúde.
 * O porte vem do cadastro do contrato fornecedor (`contratacaoPorte`: "PORTE 1", "PORTE 2 ", "PORTE 3", "Não se aplica").
 *
 *  - Porte 1: pede só depois de 30 dias do início do contrato da empresa.
 *  - Porte 2 e porte 3: nunca pede.
 *  - "Não se aplica" ou sem porte: não deveria haver inclusão de titular; trata como não pede e avisa.
 */
export type PorteDaEmpresa = 1 | 2 | 3 | null

export interface DecisaoDeclaracaoSaude {
  pedir: boolean
  porte: PorteDaEmpresa
  /** Motivo em português simples, para registrar no pedido. */
  motivo: string
}

export const DIAS_SEM_DECLARACAO = 30

/** "PORTE 2 " (com espaço, como está no cadastro), "porte 1" etc. → 1, 2, 3; qualquer outra coisa → null. */
export function porteDeTexto(texto: unknown): PorteDaEmpresa {
  const m = /PORTE\s*([123])\b/.exec(String(texto ?? '').toUpperCase())
  return m ? (Number(m[1]) as 1 | 2 | 3) : null
}

/** Dias inteiros entre duas datas (AAAA-MM-DD ou Date), ignorando a hora. */
function diasEntre(de: string | Date, ate: Date): number {
  // "AAAA-MM-DD" vale como dia local (new Date() o leria como UTC e voltaria um dia no Brasil).
  const iso = typeof de === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(de) : null
  const inicio = iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : new Date(de)
  if (Number.isNaN(inicio.getTime())) return Number.NaN
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.floor((dia(ate) - dia(inicio)) / 86_400_000)
}

export function decidirDeclaracaoSaude(porteTexto: unknown, inicioContratoEmpresa: string | Date | null | undefined, hoje: Date = new Date()): DecisaoDeclaracaoSaude {
  const porte = porteDeTexto(porteTexto)
  if (porte === 2 || porte === 3) return { pedir: false, porte, motivo: `Empresa de porte ${porte}: não pede declaração de saúde.` }
  if (porte === null) return { pedir: false, porte, motivo: 'Porte da empresa não informado no contrato: confira o cadastro antes de seguir.' }
  const dias = inicioContratoEmpresa ? diasEntre(inicioContratoEmpresa, hoje) : Number.NaN
  // Sem a data de início não dá para provar que passou de 30 dias: o caso mais cauteloso é pedir.
  if (Number.isNaN(dias)) return { pedir: true, porte, motivo: 'Porte 1 sem data de início do contrato: pede declaração de saúde.' }
  if (dias <= DIAS_SEM_DECLARACAO) return { pedir: false, porte, motivo: `Porte 1, contrato da empresa com ${Math.max(dias, 0)} dias (até ${DIAS_SEM_DECLARACAO}): não pede declaração de saúde.` }
  return { pedir: true, porte, motivo: `Porte 1, contrato da empresa com ${dias} dias (mais de ${DIAS_SEM_DECLARACAO}): pede declaração de saúde.` }
}
