const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function formatarMoeda(valor: number): string {
  return moeda.format(valor)
}

/** "2026-10-10" → "10/10/2026" (sem passar por Date, para não mudar o dia por fuso). */
export function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** "2026-10-10" → "10 de outubro" */
export function dataPorExtenso(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} de ${MESES[Number(m) - 1]}`
}

export function nomeDoMes(indice: number): string {
  return MESES[((indice % 12) + 12) % 12]!
}
