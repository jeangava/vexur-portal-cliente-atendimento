import { describe, expect, it } from 'vitest'
import { conferirInclusoes, lerData } from '../shared/utils/inclusaoEmpresa'

const ctx = {
  cpfsNoPlano: new Set(['52998224725']),
  titularesNoPlano: new Set(['52998224725']),
  planos: ['Plano Empresa Saúde Mais'],
  parentescos: ['Cônjuge', 'Filho(a)'],
  hoje: new Date(2026, 9, 1, 12),
}
const linha = (n: number, dados: Partial<Record<'nome' | 'cpf' | 'nascimento' | 'parentesco' | 'cpfTitular' | 'plano', string>>) => ({
  linha: n, nome: 'José Exemplo', cpf: '111.222.333-96', nascimento: '10/05/1985', parentesco: 'Titular', cpfTitular: '', plano: 'Plano Empresa Saúde Mais', ...dados,
})

describe('datas da planilha', () => {
  it('aceita dia/mês/ano e AAAA-MM-DD, recusa data que não existe', () => {
    expect(lerData('25/03/1990')).toBe('1990-03-25')
    expect(lerData('1990-03-25')).toBe('1990-03-25')
    expect(lerData('31/02/1990')).toBe('')
    expect(lerData('1990')).toBe('')
  })
})

describe('conferência da inclusão', () => {
  it('linha certa não tem erro e sai com o texto padronizado', () => {
    const [l] = conferirInclusoes([linha(2, { parentesco: 'titular', plano: 'plano empresa saude mais', cpf: '11122233396' })], ctx)
    expect(l!.erros).toEqual([])
    expect(l).toMatchObject({ parentesco: 'Titular', plano: 'Plano Empresa Saúde Mais', cpf: '111.222.333-96', nascimento: '1985-05-10' })
  })

  it('explica cada problema da linha', () => {
    const [l] = conferirInclusoes([linha(2, { nome: 'José', cpf: '123', nascimento: '2030-01-01', parentesco: 'Primo', plano: 'Ouro' })], ctx)
    expect(l!.erros).toHaveLength(5)
    expect(l!.erros.join(' ')).toMatch(/nome completo.*CPF.*futuro.*Primo.*Ouro/)
  })

  it('quem já está no plano e CPF repetido na planilha', () => {
    const r = conferirInclusoes([
      linha(2, { cpf: '529.982.247-25' }),
      linha(3, { cpf: '222.333.444-05' }),
      linha(4, { cpf: '222.333.444-05' }),
    ], ctx)
    expect(r[0]!.erros).toEqual(['Essa pessoa já está no plano.'])
    expect(r[1]!.erros[0]).toMatch(/mais de uma vez/)
  })

  it('dependente: titular no plano ou na mesma planilha', () => {
    const r = conferirInclusoes([
      linha(2, { cpf: '111.222.333-96' }),
      linha(3, { nome: 'Ana Exemplo', cpf: '222.333.444-05', parentesco: 'Filho(a)', cpfTitular: '111.222.333-96' }),
      linha(4, { nome: 'Bia Exemplo', cpf: '333.444.555-08', parentesco: 'Cônjuge', cpfTitular: '529.982.247-25' }),
      linha(5, { nome: 'Caio Exemplo', cpf: '444.555.666-19', parentesco: 'Filho(a)', cpfTitular: '555.666.777-20' }),
      linha(6, { nome: 'Davi Exemplo', cpf: '12345678909', parentesco: 'Filho(a)' }),
    ], ctx)
    expect(r.map(l => l.erros.length)).toEqual([0, 0, 0, 1, 1])
    expect(r[3]!.erros[0]).toMatch(/não está no plano nem nesta planilha/)
    expect(r[4]!.erros[0]).toMatch(/Falta o CPF do titular/)
  })

  it('dependente de titular com problema também fica de fora', () => {
    const r = conferirInclusoes([
      linha(2, { cpf: '111.222.333-96', plano: '' }),
      linha(3, { nome: 'Ana Exemplo', cpf: '222.333.444-05', parentesco: 'Filho(a)', cpfTitular: '111.222.333-96' }),
    ], ctx)
    expect(r[1]!.erros[0]).toMatch(/titular \(linha 2\) tem problema/)
  })
})
