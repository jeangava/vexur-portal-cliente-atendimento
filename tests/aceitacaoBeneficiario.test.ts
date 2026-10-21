import { describe, expect, it } from 'vitest'
import { parentescosDaMovimentacao } from '../shared/utils/aceitacaoBeneficiario'

describe('regra de aceitação de beneficiário na movimentação', () => {
  const regra = {
    grauRelacionamento: [
      {
        grauRelacionamento: ['CÔNJUGE', 'COMPANHEIRO(A)'],
        regraFaixaEtaria: [{ dependenteTipoMovimentacao: ['Venda nova', 'Movimentação cadastral'], dependenteDocumentos: [['Certidão de casamento'], ['RG', 'CPF']] }],
      },
      {
        grauRelacionamento: ['FILHO(A)'],
        // Só venda nova: não pode ser incluído pela movimentação.
        regraFaixaEtaria: [{ dependenteTipoMovimentacao: ['Venda nova'], dependenteDocumentos: [['Certidão de nascimento']] }],
      },
      {
        grauRelacionamento: ['TITULAR', 'ENTEADO(A)'],
        regraFaixaEtaria: [{ dependenteTipoMovimentacao: ['Movimentação cadastral'], dependenteDocumentos: [[]] }],
      },
    ],
  }

  it('lista só os parentescos marcados como movimentação cadastral, sem o titular', () => {
    const r = parentescosDaMovimentacao(regra)
    expect(r.map(p => p.parentesco)).toEqual(['Cônjuge', 'Companheiro(a)', 'Enteado(a)'])
  })

  it('traz as opções de documentos de cada parentesco (uma opção pode pedir vários)', () => {
    const r = Object.fromEntries(parentescosDaMovimentacao(regra).map(p => [p.parentesco, p.documentos]))
    expect(r['Cônjuge']).toEqual([['Certidão de casamento'], ['RG', 'CPF']])
    // Opção vazia = sem exigência de documento.
    expect(r['Enteado(a)']).toEqual([])
  })

  it('sem regra ou sem movimentação marcada, nada é aceito', () => {
    expect(parentescosDaMovimentacao(null)).toEqual([])
    expect(parentescosDaMovimentacao({ grauRelacionamento: [{ grauRelacionamento: ['FILHO(A)'], regraFaixaEtaria: [{ dependenteTipoMovimentacao: ['Venda nova'] }] }] })).toEqual([])
  })
})
