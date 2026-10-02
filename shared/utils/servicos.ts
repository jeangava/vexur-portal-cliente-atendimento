export type IdServico = 'irpf' | 'boas-vindas' | 'quitacao-debito' | 'quitacao-anual' | 'extrato'

export interface DefinicaoServico {
  id: IdServico
  titulo: string
  apoio: string
  descricao: string
  icone: string
  /** Classes de cor do ícone */
  cor: string
  /** Pede para escolher um ano antes de gerar */
  pedeAno: boolean
  rotuloAno?: string
}

/** Principais serviços do portal, na ordem em que aparecem. */
export const SERVICOS: DefinicaoServico[] = [
  {
    id: 'irpf', titulo: 'Informe de rendimentos (IR)', apoio: 'Para a declaração do Imposto de Renda',
    descricao: 'Mostra quanto você pagou de plano no ano. Use na declaração do Imposto de Renda.',
    icone: 'documento', cor: 'bg-verde-claro text-verde', pedeAno: true, rotuloAno: 'De qual ano?',
  },
  {
    id: 'quitacao-anual', titulo: 'Quitação anual de débitos', apoio: 'Comprova que o ano está todo pago',
    descricao: 'Declaração de que todas as contas de um ano foram pagas.',
    icone: 'certo', cor: 'bg-ok-claro text-ok', pedeAno: true, rotuloAno: 'De qual ano?',
  },
  {
    id: 'quitacao-debito', titulo: 'Quitação de débito', apoio: 'Comprova que você está em dia',
    descricao: 'Declaração de que não existe nenhuma conta em aberto até hoje.',
    icone: 'escudo', cor: 'bg-azul-claro text-azul', pedeAno: false,
  },
  {
    id: 'extrato', titulo: 'Extrato de cobrança', apoio: 'Tudo o que foi cobrado e pago',
    descricao: 'Lista de todas as contas do ano, com valores e datas de pagamento.',
    icone: 'conta', cor: 'bg-roxo-claro text-roxo-icone', pedeAno: true, rotuloAno: 'De qual ano?',
  },
  {
    id: 'boas-vindas', titulo: 'Carta de boas-vindas', apoio: 'As informações do seu contrato',
    descricao: 'A carta com os dados principais do seu plano e do seu contrato.',
    icone: 'carta', cor: 'bg-laranja-claro text-laranja', pedeAno: false,
  },
]

export function buscarServico(id: string): DefinicaoServico | undefined {
  return SERVICOS.find(s => s.id === id)
}
