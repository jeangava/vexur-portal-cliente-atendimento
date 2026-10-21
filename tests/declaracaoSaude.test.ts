import { describe, expect, it } from 'vitest'
import { decidirDeclaracaoSaude, porteDeTexto, porteDoCadastro } from '../shared/utils/declaracaoSaude'

const HOJE = new Date(2026, 9, 18)

describe('declaração de saúde na inclusão de titular PME', () => {
  it('lê o porte do cadastro, inclusive "PORTE 2 " com espaço', () => {
    expect(porteDeTexto('PORTE 1')).toBe(1)
    expect(porteDeTexto('PORTE 2 ')).toBe(2)
    expect(porteDeTexto('porte 3')).toBe(3)
    expect(porteDeTexto('Não se aplica')).toBeNull()
    expect(porteDeTexto(undefined)).toBeNull()
  })

  it('porte 2 e 3 nunca pedem, em qualquer data', () => {
    expect(decidirDeclaracaoSaude('PORTE 2 ', '2020-01-01', HOJE).pedir).toBe(false)
    expect(decidirDeclaracaoSaude('PORTE 3', '2020-01-01', HOJE).pedir).toBe(false)
    expect(decidirDeclaracaoSaude('PORTE 2 ', '2026-10-10', HOJE).pedir).toBe(false)
  })

  it('porte 1 não pede até 30 dias e pede depois', () => {
    expect(decidirDeclaracaoSaude('PORTE 1', '2026-09-18', HOJE).pedir).toBe(false) // 30 dias
    expect(decidirDeclaracaoSaude('PORTE 1', '2026-09-17', HOJE).pedir).toBe(true) // 31 dias
    expect(decidirDeclaracaoSaude('PORTE 1', '2026-10-18', HOJE).pedir).toBe(false)
  })

  it('porte 1 sem data de início: pede (cauteloso); sem porte: não pede e avisa', () => {
    expect(decidirDeclaracaoSaude('PORTE 1', null, HOJE).pedir).toBe(true)
    const sem = decidirDeclaracaoSaude('Não se aplica', '2020-01-01', HOJE)
    expect(sem.pedir).toBe(false)
    expect(sem.porte).toBeNull()
    expect(sem.motivo).toMatch(/Porte da empresa não informado/)
  })
})

describe('porte do cadastro do contrato fornecedor', () => {
  it('usa o campo, depois o nome do contrato, depois a faixa de vidas', () => {
    expect(porteDoCadastro({ contratacaoPorte: 'PORTE 2 ' })).toBe('PORTE 2')
    expect(porteDoCadastro({ codigoContratoFornecedor: 'CNU PME LIVRE ADESÃO - PORTE 3 BAHIA - 01.08.2020' })).toBe('PORTE 3')
    expect(porteDoCadastro({ quantidadeVidasDe: 100, quantidadeVidasAte: 199 })).toBe('PORTE 3')
    expect(porteDoCadastro({ quantidadeVidasDe: 30, quantidadeVidasAte: 99 })).toBe('PORTE 2')
    expect(porteDoCadastro({ quantidadeVidasDe: 2, quantidadeVidasAte: 29 })).toBe('PORTE 1')
  })
  it('o campo preenchido manda mesmo que o nome diga outra coisa', () => {
    expect(porteDoCadastro({ contratacaoPorte: 'PORTE 1', codigoContratoFornecedor: '... PORTE 3 ...' })).toBe('PORTE 1')
  })
  it('sem nada que indique o porte, não inventa', () => {
    expect(porteDoCadastro({ contratacaoPorte: 'Não se aplica' })).toBeUndefined()
    expect(porteDoCadastro({})).toBeUndefined()
    expect(porteDoCadastro(null)).toBeUndefined()
  })
})
