import { describe, expect, it } from 'vitest'
import type { ContratoCliente } from '../shared/types/portal'
import { acessoDoContrato, areaDaRota, contratoAutomatico, ordenarContratos, simplificarContratos, usuarioDoContrato } from '../shared/utils/contratos'

const base: ContratoCliente = {
  id: 'a', numero: '1', tipo: 'adesao', papel: 'titular', situacao: 'ativo', plano: 'Plano A', inicioVigencia: '2025-01-01',
}
const empresa: ContratoCliente = { ...base, id: 'e', tipo: 'empresarial', empresa: 'Alfa' }
const cancelado = (id: string, fim: string): ContratoCliente => ({ ...base, id, situacao: 'cancelado', fimVigencia: fim })

describe('o que cada plano pode ver', () => {
  it('adesão e individual: tudo, com valores', () => {
    expect(acessoDoContrato(base)).toEqual({
      areas: ['contas', 'servicos', 'comunicados', 'familia', 'movimentacao', 'pedidos'], mostrarValores: true,
    })
    expect(acessoDoContrato({ ...base, tipo: 'individual' }).areas).toContain('movimentacao')
  })

  it('titular de empresarial: só família (sem valores), comunicados e pedidos', () => {
    expect(acessoDoContrato(empresa)).toEqual({ areas: ['familia', 'comunicados', 'pedidos'], mostrarValores: false })
  })

  it('representante da empresa: tudo', () => {
    expect(acessoDoContrato({ ...empresa, papel: 'representante' }).areas).toContain('movimentacao')
  })

  it('plano cancelado: consulta, sem movimentação', () => {
    const acesso = acessoDoContrato(cancelado('c', '2020-01-01'))
    expect(acesso.areas).toContain('contas')
    expect(acesso.areas).not.toContain('movimentacao')
  })
})

describe('qual plano abrir no login', () => {
  it('um plano só: entra direto, sem "Trocar de plano"', () => {
    expect(contratoAutomatico([base])).toBe(base)
    expect(usuarioDoContrato({ nome: 'A', primeiroNome: 'A' }, [base], base).podeTrocarContrato).toBe(false)
  })

  it('um ativo e outros cancelados: pergunta', () => {
    expect(contratoAutomatico([cancelado('c1', '2020-01-01'), base, cancelado('c2', '2019-01-01')])).toBeUndefined()
  })

  it('um contrato só, mesmo cancelado: entra direto', () => {
    const unico = cancelado('c1', '2020-01-01')
    expect(contratoAutomatico([unico])).toBe(unico)
  })

  it('dois ativos: pergunta', () => {
    expect(contratoAutomatico([base, empresa])).toBeUndefined()
  })

  it('todos cancelados: pergunta', () => {
    expect(contratoAutomatico([cancelado('c1', '2020-01-01'), cancelado('c2', '2019-01-01')])).toBeUndefined()
  })

  it('responsável que também é titular na mesma empresa: fica só a visão de responsável', () => {
    const responsavel: ContratoCliente = { ...empresa, id: 'r', papel: 'representante' }
    const outraEmpresa: ContratoCliente = { ...empresa, id: 'o', numero: '2' }
    const lista = simplificarContratos([empresa, responsavel, outraEmpresa, base])
    expect(lista.map(c => c.id)).toEqual(['r', 'o', 'a'])
    expect(contratoAutomatico(simplificarContratos([empresa, responsavel]))).toBe(responsavel)
  })

  it('sem plano escolhido, nenhuma área liberada', () => {
    const u = usuarioDoContrato({ nome: 'A', primeiroNome: 'A' }, [base, empresa])
    expect(u.contrato).toBeUndefined()
    expect(u.acesso.areas).toEqual([])
    expect(u.podeTrocarContrato).toBe(true)
  })

  it('ordena: ativos primeiro, depois os encerrados mais recentes', () => {
    const lista = ordenarContratos([cancelado('velho', '2015-01-01'), cancelado('novo', '2022-01-01'), base])
    expect(lista.map(c => c.id)).toEqual(['a', 'novo', 'velho'])
  })
})

describe('área de cada tela', () => {
  it('reconhece as rotas e deixa Início e Ajuda livres', () => {
    expect(areaDaRota('/contas/f-1/pix')).toBe('contas')
    expect(areaDaRota('/movimentacao/incluir')).toBe('movimentacao')
    expect(areaDaRota('/inicio')).toBeUndefined()
    expect(areaDaRota('/ajuda')).toBeUndefined()
    expect(areaDaRota('/contasx')).toBeUndefined()
  })
})
