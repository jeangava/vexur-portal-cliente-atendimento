import { describe, expect, it } from 'vitest'
import { nomeDoMes } from '../shared/utils/formato'
import { COBRANCAS_FALSAS, CONTRATO_FALSO, LOGIN_FALSO } from './fakes/respostas-gateway'

// Funções de shared/utils chegam por auto-import no Nuxt; aqui injetamos manualmente.
Object.assign(globalThis, { nomeDoMes })
const m = await import('../server/utils/mapeamento')

const HOJE = new Date(2026, 8, 30, 12)

describe('datas do backend', () => {
  it('aceita milissegundos, ISO, AAAAMMDD e DD/MM/AAAA', () => {
    expect(m.paraDataIso(new Date(2026, 9, 10, 12).getTime())).toBe('2026-10-10')
    expect(m.paraDataIso('2026-10-10T03:00:00Z')).toBe('2026-10-10')
    expect(m.paraDataIso('20261010')).toBe('2026-10-10')
    expect(m.paraDataIso('10/10/2026')).toBe('2026-10-10')
    expect(m.paraDataIso(null)).toBe('')
  })
})

describe('login', () => {
  it('traz todos os contratos do titular, ativos e cancelados', () => {
    const r = m.mapearLogin(LOGIN_FALSO, HOJE)!
    expect(r.pessoa).toEqual({ nome: 'ANA TESTE SOUZA', primeiroNome: 'Ana' })
    expect(r.contratos.map(c => [c.cliente.numero, c.cliente.situacao, c.cliente.plano])).toEqual([
      ['202200001.001', 'cancelado', 'PLANO ANTIGO'],
      ['202400002.001', 'ativo', 'Saúde Bem'],
    ])
    expect(r.contratos[0]!.cliente.fimVigencia).toBe('2020-01-01')
    expect(r.contratos[1]!.gateway).toEqual({ idContratoAdesao: 222, numeroContrato: '202400002.001', tipoContratacao: 'ADESÃO' })
  })

  it('lê o tipo do contrato pela marcação', () => {
    expect(m.tipoDoContrato('COLETIVO EMPRESARIAL')).toBe('empresarial')
    expect(m.tipoDoContrato(null, 'INDIVIDUAL/FAMILIAR')).toBe('individual')
    expect(m.tipoDoContrato('ADESÃO')).toBe('adesao')
  })

  it('sem token não entra', () => {
    expect(m.mapearLogin({ ...LOGIN_FALSO, token: null }, HOJE)).toBeNull()
  })
})

describe('família', () => {
  it('traz titular e dependentes ativos, sem quem já saiu do plano', () => {
    const f = m.mapearFamilia(CONTRATO_FALSO, HOJE)
    expect(f.titular).toMatchObject({ id: '9001', parentesco: 'Titular', numeroCarteirinha: '0001.0002-003' })
    expect(f.titular.produtos[0]).toMatchObject({ nome: 'Saúde Bem', registroAns: '123456', acomodacao: 'Enfermaria', valorMensal: 300.5, inicioVigencia: '2024-02-10' })
    expect(f.dependentes.map(d => d.nome)).toEqual(['BIA TESTE SOUZA'])
  })

  it('explica o erro quando o contrato vem sem titular', () => {
    expect(() => m.mapearFamilia({ id: 1, numeroContrato: '9', beneficiarios: [] }, HOJE)).toThrow(/sem titular ativo/)
  })
})

describe('faturas', () => {
  it('calcula a situação pelo status e pelo vencimento', () => {
    const [paga, emDia, vencida] = COBRANCAS_FALSAS
    expect(m.situacaoDaCobranca(paga!, HOJE)).toBe('paga')
    expect(m.situacaoDaCobranca(emDia!, HOJE)).toBe('aberta')
    expect(m.situacaoDaCobranca(vencida!, HOJE)).toBe('atrasada')
    expect(m.situacaoDaCobranca({ ...emDia!, dataVencimento: HOJE.getTime() }, HOJE)).toBe('vence-hoje')
  })

  it('tira canceladas e lançamentos sem cobrança e ordena da mais nova para a mais antiga', () => {
    const lista = m.mapearFaturas(COBRANCAS_FALSAS, HOJE)
    expect(lista.map(f => `${f.id}:${f.mes}:${f.situacao}`)).toEqual(['5002:outubro:aberta', '5001:setembro:paga', '5003:agosto:atrasada'])
    expect(lista[1]).toMatchObject({ pagaEm: '2026-09-08', valor: 450.5 })
    expect(lista[1]!.itens).toEqual([
      { descricao: 'ANA TESTE SOUZA (titular)', valor: 300.5 },
      { descricao: 'BIA TESTE SOUZA (filho)', valor: 150 },
    ])
  })

  it('monta o extrato por pessoa, com uma linha por tipo de lançamento', () => {
    const grupos = m.mapearGruposExtrato(COBRANCAS_FALSAS[0]!)
    expect(grupos).toHaveLength(2)
    expect(grupos[0]).toMatchObject({ beneficiario: 'ANA TESTE SOUZA', subtotal: 300.5 })
    expect(grupos[0]!.linhas.map(l => l.descricao)).toEqual(['Mensalidade', 'Taxa associativa'])
  })
})
