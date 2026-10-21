import { porteDeTexto, type PorteDaEmpresa } from './declaracaoSaude'

/**
 * Inclusão de dependente: antes de digitar os dados, o CRM pergunta se é um EVENTO (recém-nascido, recém-casado ou
 * recém-tutelado) e a data dele. O evento dentro do prazo entra sem carência de declaração; fora dele, a inclusão é comum.
 */
export type TipoDeEvento = 'RN' | 'RC' | 'RT'

export const ROTULO_DO_EVENTO: Record<TipoDeEvento, { nome: string, data: string }> = {
  RN: { nome: 'Recém-nascido', data: 'Data de nascimento' },
  RC: { nome: 'Recém-casado ou união estável', data: 'Data do casamento ou da união' },
  RT: { nome: 'Recém-tutelado', data: 'Data da tutela' },
}

function normalizar(t: unknown): string {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

/** Que evento cada parentesco pode ter. Os outros (enteado, filho inválido, pai/mãe...) não têm evento. */
export function eventoDoParentesco(parentesco: string): TipoDeEvento | null {
  const p = normalizar(parentesco)
  if (/INVALID/.test(p)) return null
  if (/^FILH/.test(p)) return 'RN'
  if (/CONJUGE|COMPANHEIR|ESPOS|MARIDO|UNIAO/.test(p)) return 'RC'
  if (/GUARDA|TUTEL/.test(p)) return 'RT'
  return null
}

/** Dias inteiros entre o dia do evento (AAAA-MM-DD) e hoje. Negativo = evento no futuro. */
export function diasDesdeOEvento(dataEvento: string, hoje: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataEvento)
  if (!m) return Number.NaN
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.floor((dia(hoje) - dia(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))) / 86_400_000)
}

export interface AvaliacaoDoEvento {
  /** O evento vale (existe, não é futuro e está dentro do prazo da regra de aceitação) */
  valeComoEvento: boolean
  dias: number
  /** Prazo da regra em dias, quando há */
  prazoDias?: number
  motivo: string
}

/** O evento vale se não está no futuro e, havendo prazo na regra de aceitação, ainda não passou dele. */
export function avaliarEvento(dataEvento: string, prazoInclusaoDias: number | undefined, hoje: Date = new Date()): AvaliacaoDoEvento {
  const dias = diasDesdeOEvento(dataEvento, hoje)
  if (Number.isNaN(dias)) return { valeComoEvento: false, dias, prazoDias: prazoInclusaoDias, motivo: 'A data do evento não está certa.' }
  if (dias < 0) return { valeComoEvento: false, dias, prazoDias: prazoInclusaoDias, motivo: 'A data do evento está no futuro.' }
  if (prazoInclusaoDias !== undefined && dias > prazoInclusaoDias) {
    return { valeComoEvento: false, dias, prazoDias: prazoInclusaoDias, motivo: `O evento foi há ${dias} dias e o prazo é de ${prazoInclusaoDias}. Segue como inclusão comum.` }
  }
  return { valeComoEvento: true, dias, prazoDias: prazoInclusaoDias, motivo: 'Dentro do prazo do evento.' }
}

export interface DecisaoDeclaracaoDoDependente {
  pedir: boolean
  porte: PorteDaEmpresa
  motivo: string
}

/**
 * Declaração de saúde do dependente:
 *  - porte 2 e 3: nunca;
 *  - porte 1: dispensada só quando é evento dentro de 30 dias; evento com mais de 30 dias ou inclusão comum pede.
 * Sem porte conhecido, o caso cauteloso é pedir.
 */
export const DIAS_DO_EVENTO_SEM_DECLARACAO = 30

export function decidirDeclaracaoDoDependente(
  porteTexto: unknown,
  evento: { valeComoEvento: boolean, dias: number } | null,
): DecisaoDeclaracaoDoDependente {
  const porte = porteDeTexto(porteTexto)
  if (porte === 2 || porte === 3) return { pedir: false, porte, motivo: `Empresa de porte ${porte}: não pede declaração de saúde.` }
  if (porte === null) return { pedir: true, porte, motivo: 'Porte da empresa não informado no contrato: pede declaração de saúde por segurança.' }
  if (evento?.valeComoEvento && evento.dias <= DIAS_DO_EVENTO_SEM_DECLARACAO) {
    return { pedir: false, porte, motivo: `Porte 1, evento há ${evento.dias} dias (até ${DIAS_DO_EVENTO_SEM_DECLARACAO}): não pede declaração de saúde.` }
  }
  return {
    pedir: true, porte,
    motivo: evento?.valeComoEvento
      ? `Porte 1, evento há ${evento.dias} dias (mais de ${DIAS_DO_EVENTO_SEM_DECLARACAO}): pede declaração de saúde.`
      : 'Porte 1, inclusão comum (sem evento no prazo): pede declaração de saúde.',
  }
}
