import type { Fatura, SituacaoFatura } from '#shared/types/portal'

interface VisualSituacao {
  rotulo: string
  icone: 'relogio' | 'alerta' | 'certo'
  selo: string
  borda: string
  texto: string
}

/** Cor + ícone + palavra: a situação nunca depende só da cor. */
export const VISUAL_SITUACAO: Record<SituacaoFatura, VisualSituacao> = {
  'aberta': { rotulo: 'Para pagar', icone: 'relogio', selo: 'bg-info-claro text-info', borda: 'border-info-borda', texto: 'text-texto' },
  'vence-hoje': { rotulo: 'Vence hoje', icone: 'alerta', selo: 'bg-atencao-claro text-atencao', borda: 'border-atencao-borda', texto: 'text-atencao' },
  'atrasada': { rotulo: 'Atrasada', icone: 'alerta', selo: 'bg-erro-claro text-erro', borda: 'border-erro-borda', texto: 'text-erro' },
  'paga': { rotulo: 'Paga', icone: 'certo', selo: 'bg-ok-claro text-ok', borda: 'border-linha', texto: 'text-ok' },
}

export function fraseDoVencimento(f: Fatura): string {
  switch (f.situacao) {
    case 'vence-hoje': return `Vence hoje, ${dataPorExtenso(f.vencimento)}`
    case 'atrasada': return `Venceu em ${dataPorExtenso(f.vencimento)}. Pague hoje para ficar em dia.`
    case 'paga': return `Paga em ${formatarData(f.pagaEm ?? f.vencimento)}`
    default: return `Vence em ${dataPorExtenso(f.vencimento)}`
  }
}
