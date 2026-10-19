import { describe, expect, it } from 'vitest'
import { problemaNaAlteracao, regraDoCampo, tituloDaAlteracao, valoresDaAlteracao } from '../shared/utils/alteracaoCadastral'

describe('alteração de dados cadastrais (vira pedido para a administradora)', () => {
  it('por enquanto toda alteração vai para aprovação, sem documento', () => {
    expect(regraDoCampo('email')).toEqual({ campo: 'email', permitido: true, exigeAprovacao: true, exigeDocumento: false })
  })

  it('confere e-mail, telefone, CEP e estado com palavras simples', () => {
    expect(problemaNaAlteracao('email', { email: 'ana@email.com' })).toBeNull()
    expect(problemaNaAlteracao('email', { email: 'ana@email' })).toMatch(/não parece certo/)
    expect(problemaNaAlteracao('email', {})).toMatch(/Preencha/)
    expect(problemaNaAlteracao('celular', { celular: '(11) 98765-4321' })).toBeNull()
    expect(problemaNaAlteracao('celular', { celular: '9876' })).toMatch(/DDD/)
    expect(problemaNaAlteracao('outra-coisa', {})).toMatch(/Escolha/)
  })

  it('endereço exige os campos obrigatórios, mas não o complemento', () => {
    const certo = { cep: '01000-000', logradouro: 'Rua A', numero: '10', bairro: 'Centro', municipio: 'São Paulo', uf: 'sp' }
    expect(problemaNaAlteracao('endereco', certo)).toBeNull()
    expect(problemaNaAlteracao('endereco', { ...certo, cep: '123' })).toMatch(/CEP/)
    expect(problemaNaAlteracao('endereco', { ...certo, uf: 'São' })).toMatch(/sigla/)
    expect(problemaNaAlteracao('endereco', { ...certo, bairro: '' })).toMatch(/bairro/)
  })

  it('dados cadastrais: nome, nascimento, sexo, estado civil, nome da mãe e cartão do SUS', () => {
    const certo = { nome: 'Ana Souza', nascimento: '1990-05-17', sexo: 'Feminino', estadoCivil: 'Casado(a)', nomeMae: 'Maria Souza', cartaoSus: '705007208245156' }
    expect(problemaNaAlteracao('dados', certo)).toBeNull()
    expect(problemaNaAlteracao('dados', { ...certo, nome: '' })).toMatch(/nome completo/)
    expect(problemaNaAlteracao('dados', { ...certo, nascimento: '2999-01-01' })).toMatch(/não parece certa/)
    expect(problemaNaAlteracao('dados', { ...certo, nascimento: '1990-02-31' })).toMatch(/não parece certa/)
    expect(problemaNaAlteracao('dados', { ...certo, cartaoSus: '123' })).toMatch(/15 números/)
    // O estado civil que já está cadastrado vale mesmo fora da lista; o estado civil é opcional.
    expect(problemaNaAlteracao('dados', { ...certo, estadoCivil: 'Companheiro(a)' })).toBeNull()
    expect(problemaNaAlteracao('dados', { ...certo, estadoCivil: '', cartaoSus: '' })).toBeNull()
    expect(tituloDaAlteracao('dados')).toBe('Alterar dados cadastrais')
    expect(valoresDaAlteracao('dados', { ...certo, cartaoSus: '705.0072 0824 5156', intruso: 'x' }).cartaoSus).toBe('705007208245156')
  })

  it('só leva os campos combinados, limpos, e o título do pedido', () => {
    expect(valoresDaAlteracao('endereco', { cep: ' 01000-000 ', uf: 'sp', intruso: 'x', complemento: '' })).toEqual({ cep: '01000-000', uf: 'SP' })
    expect(tituloDaAlteracao('email')).toBe('Alterar e-mail')
    expect(tituloDaAlteracao('telefone')).toBe('Alterar telefone fixo')
  })
})
