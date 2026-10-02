import type { CanalComunicado, Comunicado } from '#shared/types/portal'

export const CANAL_COMUNICADO: Record<CanalComunicado, { nome: string, icone: string }> = {
  email: { nome: 'e-mail', icone: 'email' },
  sms: { nome: 'SMS', icone: 'celular' },
  carta: { nome: 'carta', icone: 'carta' },
}

export type SeloComunicado = { rotulo: string, classe: string } | null

/** Em vigor (vermelho) > Novo (roxo) > Resolvido (verde). */
export function seloDoComunicado(c: Comunicado): SeloComunicado {
  if (c.vigente) return { rotulo: 'Em vigor', classe: 'bg-erro-claro text-erro' }
  if (c.tipo !== 'informativo') return { rotulo: 'Resolvido', classe: 'bg-ok-claro text-ok' }
  if (c.novo) return { rotulo: 'Novo', classe: 'bg-roxo-claro text-roxo-escuro' }
  return null
}
