import type { CobrancaBruta, ContratoBruto, LoginBruto } from '../../server/utils/mapeamento'

/**
 * Respostas falsas do gateway, no formato das APIs reais (campos lidos do código de
 * api-vexur-operacao-implatancao-contrato-adesao e api-vexur-faturamento-extrato-cliente).
 * Dados totalmente fictícios.
 */
const ms = (iso: string) => new Date(`${iso}T12:00:00`).getTime()

export const LOGIN_FALSO: LoginBruto = {
  token: 'token-falso',
  propostaAdesao: [
    {
      idContratoAdesao: 111, numeroContrato: '202200001.001', tipoContratacao: 'ADESÃO',
      proponentes: [
        { parentesco: 'TITULAR', nome: 'ANA TESTE SOUZA', dataFim: ms('2020-01-01'), produto: [{ nomePlano: 'PLANO ANTIGO' }] },
      ],
    },
    {
      idContratoAdesao: 222, numeroContrato: '202400002.001', tipoContratacao: 'ADESÃO',
      proponentes: [
        { parentesco: 'TITULAR', nome: 'ANA TESTE SOUZA', dataFim: null, produto: [{ nomeAmigavelProduto: 'Saúde Bem', fornecedor: 'Operadora Falsa' }] },
        { parentesco: 'FILHO', nome: 'BIA TESTE SOUZA' },
      ],
    },
  ],
}

export const CONTRATO_FALSO: ContratoBruto = {
  id: 222,
  numeroContrato: 202400002.001,
  tipoContratacao: 'ADESÃO',
  beneficiarios: [
    {
      id: 9001, nome: 'ANA TESTE SOUZA', parentesco: 'TITULAR', dataInicio: ms('2024-02-10'),
      produto: [{ fornecedor: 'Operadora Falsa', nomePlano: 'SAUDE BEM ENF', nomeAmigavelProduto: 'Saúde Bem', codigoProdutoNoRegulador: 123456, padraoAcomodacaoProduto: 'ENFERMARIA', numeroCartaoIdentificacao: '0001.0002-003', valorVenda: 300.5 }],
    },
    {
      id: 9002, nome: 'BIA TESTE SOUZA', parentesco: 'FILHO', dataInicio: ms('2024-05-10'),
      produto: [{ fornecedor: 'Operadora Falsa', nomePlano: 'SAUDE BEM ENF', valorVenda: 150, numeroCartaoIdentificacao: '0001.0002-004' }],
    },
    { id: 9003, nome: 'CAIO TESTE SOUZA', parentesco: 'CONJUGE', dataFim: ms('2025-01-31'), produto: [] },
  ],
}

export const COBRANCAS_FALSAS: CobrancaBruta[] = [
  {
    idCobranca: 5001, anoMesCompetencia: '202609', dataVencimento: ms('2026-09-10'), dataPagamento: ms('2026-09-08'),
    statusCobranca: { tipo: 'PAGA' }, valorCobranca: 450.5, linhaDigitavel: '1111',
    lancamentos: [
      { nome: 'ANA TESTE SOUZA', parentesco: 'TITULAR', tipoLancamento: 'Mensalidade', valorComercial: 280.5 },
      { nome: 'ANA TESTE SOUZA', parentesco: 'TITULAR', tipoLancamento: 'Taxa associativa', valorComercial: 20 },
      { nome: 'BIA TESTE SOUZA', parentesco: 'FILHO', tipoLancamento: 'Mensalidade', valorComercial: 150 },
    ],
  },
  { idCobranca: 5002, anoMesCompetencia: 202610, dataVencimento: ms('2026-10-10'), statusCobranca: { tipo: 'EM_COBRANCA' }, valorCobranca: 450.5, linhaDigitavel: '2222', lancamentos: [] },
  { idCobranca: 5003, anoMesCompetencia: '202608', dataVencimento: ms('2026-08-10'), statusCobranca: { tipo: 'EM_COBRANCA' }, valorCobranca: 450.5, lancamentos: [] },
  { idCobranca: 5004, anoMesCompetencia: '202607', dataVencimento: ms('2026-07-10'), statusCobranca: { tipo: 'CANCELADA' }, valorCobranca: 450.5, lancamentos: [] },
  { idCobranca: null, chaveAgrupamento: null, statusCobranca: { tipo: 'SEM_COBRANCA' }, lancamentos: [] },
]
