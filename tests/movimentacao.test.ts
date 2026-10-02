import { describe, expect, it } from 'vitest'
import { problemaNoCpf, somenteDigitos } from '../shared/utils/cpf'
import { diasDesde, validarEventoInclusao, validarPessoaInclusao, type DadosEvento } from '../shared/utils/movimentacao'

// Funções de shared/utils chegam por auto-import no Nuxt; aqui injetamos manualmente.
Object.assign(globalThis, { somenteDigitos, problemaNoCpf })

const HOJE = new Date(2026, 8, 30)
const OPCOES = { parentescosEvento: ['filho', 'conjuge', 'tutelado'], parentescosOutros: ['filho', 'enteado'], tiposPlanoAnterior: ['individual'] }
const planoVazio = { tipo: '', operadora: '', plano: '', meses: '', ultimoPagamento: '' }

describe('etapa 1: evento', () => {
  it('pede para escolher o tipo de inclusão', () => {
    expect(validarEventoInclusao({ evento: '', dataEvento: '', parentesco: '', temPlanoAnterior: '', planoAnterior: planoVazio }, OPCOES, HOJE).evento).toBeDefined()
  })

  it('caminho "sim" exige data do evento e parentesco de evento', () => {
    const base: DadosEvento = { evento: 'sim', dataEvento: '2026-09-20', parentesco: 'filho', temPlanoAnterior: '', planoAnterior: planoVazio }
    expect(validarEventoInclusao(base, OPCOES, HOJE)).toEqual({})
    expect(validarEventoInclusao({ ...base, dataEvento: '' }, OPCOES, HOJE).dataEvento).toBe('Informe a data do evento.')
    expect(validarEventoInclusao({ ...base, dataEvento: '2026-10-05' }, OPCOES, HOJE).dataEvento).toMatch(/futuro/)
    expect(validarEventoInclusao({ ...base, parentesco: 'enteado' }, OPCOES, HOJE).parentesco).toBeDefined()
  })

  it('caminho "não" exige os dados do plano anterior', () => {
    const erros = validarEventoInclusao({ evento: 'nao', dataEvento: '', parentesco: 'enteado', temPlanoAnterior: 'sim', planoAnterior: planoVazio }, OPCOES, HOJE)
    expect(Object.keys(erros).sort()).toEqual(['meses', 'operadora', 'plano', 'tipoPlano', 'ultimoPagamento'])
    const ok = validarEventoInclusao({
      evento: 'nao', dataEvento: '', parentesco: 'enteado', temPlanoAnterior: 'sim',
      planoAnterior: { tipo: 'individual', operadora: 'Operadora X', plano: 'Plano Y', meses: '24', ultimoPagamento: '2026-08-10' },
    }, OPCOES, HOJE)
    expect(ok).toEqual({})
  })

  it('sem plano anterior segue direto para o cadastro', () => {
    const base = { evento: 'nao' as const, dataEvento: '', parentesco: 'enteado', planoAnterior: planoVazio }
    expect(validarEventoInclusao({ ...base, temPlanoAnterior: '' }, OPCOES, HOJE).temPlanoAnterior).toBeDefined()
    expect(validarEventoInclusao({ ...base, temPlanoAnterior: 'nao' }, OPCOES, HOJE)).toEqual({})
  })

  it('tempo de plano só aceita número inteiro de meses', () => {
    const e = validarEventoInclusao({
      evento: 'nao', dataEvento: '', parentesco: 'enteado', temPlanoAnterior: 'sim',
      planoAnterior: { tipo: 'individual', operadora: 'Op', plano: 'Pl', meses: '2,5', ultimoPagamento: '2026-08-10' },
    }, OPCOES, HOJE)
    expect(e.meses).toMatch(/número de meses/)
  })

  it('conta os dias desde o evento', () => {
    expect(diasDesde('2026-08-31', HOJE)).toBe(30)
  })
})

describe('etapa 2: cadastro', () => {
  const valida = { nome: 'Ana da Silva', cpf: '111.444.777-35', nascimento: '2020-05-01' }

  it('aceita dados certos', () => {
    expect(validarPessoaInclusao(valida, HOJE)).toEqual({})
  })

  it('pede nome e sobrenome e fala do CPF da pessoa', () => {
    expect(validarPessoaInclusao({ ...valida, nome: 'Ana' }, HOJE).nome).toMatch(/sobrenome/)
    expect(validarPessoaInclusao({ ...valida, cpf: '' }, HOJE).cpf).toBe('Digite o CPF da pessoa para continuar.')
  })

  it('recusa data de nascimento inexistente', () => {
    expect(validarPessoaInclusao({ ...valida, nascimento: '2020-02-31' }, HOJE).nascimento).toMatch(/não existe/)
  })
})
