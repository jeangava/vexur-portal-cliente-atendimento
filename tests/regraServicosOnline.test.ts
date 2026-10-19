import { describe, expect, it } from 'vitest'
import { decidirAlteracao, decidirMovimentacao, decisoesDaRegra, decisoesDeMovimentacao } from '../shared/utils/regraServicosOnline'

const REGRA = [
  { ator: 'Titular', local: 'Portal do cliente', tipo: 'Alteração de e-mail', atendimento: 'Imediato' },
  { ator: 'Titular', local: 'Portal do cliente', tipo: 'Alteração de telefone', atendimento: 'Imediato' },
  { ator: 'Titular', local: 'Portal do cliente', tipo: 'Alteração de endereço', atendimento: 'Sob aprovação', documentos: ['Comprovante de residência'], mensagem: 'Envie um comprovante recente.' },
  { ator: 'Representante', local: 'Portal do cliente', tipo: 'Alteração de e-mail', atendimento: 'Sob aprovação' },
  { ator: 'Titular', local: 'Atendimento interno', tipo: 'Alteração de endereço', atendimento: 'Imediato' },
]

describe('regra "Serviços online": o que cada ator pode alterar no portal', () => {
  it('só existe o que a regra autoriza, e a decisão é por ator', () => {
    expect(decidirAlteracao(REGRA, 'email', 'titular')).toMatchObject({ disponivel: true, atendimento: 'imediato' })
    expect(decidirAlteracao(REGRA, 'email', 'representante')).toMatchObject({ disponivel: true, atendimento: 'aprovacao' })
    // O representante não tem telefone na regra: não oferece.
    expect(decidirAlteracao(REGRA, 'celular', 'representante').disponivel).toBe(false)
  })

  it('endereço do titular vai por aprovação, com documento e mensagem, ignorando linha de outro local', () => {
    expect(decidirAlteracao(REGRA, 'endereco', 'titular')).toEqual({
      campo: 'endereco', disponivel: true, atendimento: 'aprovacao', documentos: ['Comprovante de residência'], mensagem: 'Envie um comprovante recente.',
    })
  })

  it('sem regra (ou serviço fora do ar), nada é oferecido', () => {
    expect(decisoesDaRegra(null, 'titular').every(d => !d.disponivel)).toBe(true)
    expect(decisoesDaRegra([], 'representante').every(d => !d.disponivel)).toBe(true)
  })

  it('regra antiga, sem o campo atendimento, passa por aprovação; conflito vale o mais cauteloso', () => {
    expect(decidirAlteracao([{ ator: 'Titular', tipo: 'E-mail' }], 'email', 'titular').atendimento).toBe('aprovacao')
    const conflito = [
      { ator: 'Titular', tipo: 'Alteração de e-mail', atendimento: 'Imediato' },
      { ator: 'Titular', tipo: 'Alteração de e-mail', atendimento: 'Sob aprovação' },
    ]
    expect(decidirAlteracao(conflito, 'email', 'titular').atendimento).toBe('aprovacao')
  })

  it('"dados cadastrais" libera só os dados pessoais; e-mail, telefone e endereço precisam de tipo próprio', () => {
    const regra = [{ ator: 'Representante', tipo: 'Dados cadastrais', atendimento: 'Imediato' }]
    const d = decisoesDaRegra(regra, 'representante')
    expect(d.filter(x => x.disponivel).map(x => x.campo)).toEqual(['dados'])
    expect(d.find(x => x.campo === 'dados')?.atendimento).toBe('imediato')
    expect(decisoesDaRegra(regra, 'titular').every(x => !x.disponivel)).toBe(true)
  })

  it('"fixo" não vale para celular, e "celular" não vale para telefone fixo', () => {
    const fixo = [{ ator: 'Titular', tipo: 'Alteração de telefone fixo', atendimento: 'Imediato' }]
    expect(decidirAlteracao(fixo, 'celular', 'titular').disponivel).toBe(false)
    expect(decidirAlteracao(fixo, 'telefone', 'titular').disponivel).toBe(true)
    const cel = [{ ator: 'Titular', tipo: 'Alteração de celular', atendimento: 'Imediato' }]
    expect(decidirAlteracao(cel, 'telefone', 'titular').disponivel).toBe(false)
  })
})

describe('regra "Serviços online": incluir e tirar pessoas na Movimentação', () => {
  const REGRA_MOV = [
    { ator: 'Representante', local: 'Portal', tipo: 'Inclusão de titular', atendimento: 'Sob aprovação' },
    { ator: 'Representante', local: 'Portal', tipo: 'Inclusão de dependente', atendimento: 'Imediato' },
    { ator: 'Representante', local: 'Portal', tipo: 'Exclusão de dependente', atendimento: 'Imediato' },
    { ator: 'Titular', local: 'Portal', tipo: 'Exclusão de dependente', atendimento: 'Imediato' },
  ]

  it('libera titular e dependente separadamente, por ator', () => {
    const rep = Object.fromEntries(decisoesDeMovimentacao(REGRA_MOV, 'representante').map(d => [d.tipo, d]))
    expect(rep['incluir-titular']).toMatchObject({ disponivel: true, atendimento: 'aprovacao' })
    expect(rep['incluir-dependente']).toMatchObject({ disponivel: true, atendimento: 'imediato' })
    expect(rep['excluir-dependente']!.disponivel).toBe(true)
    // Tirar titular não está na regra: o cartão fica apagado.
    expect(rep['excluir-titular']!.disponivel).toBe(false)
    const tit = Object.fromEntries(decisoesDeMovimentacao(REGRA_MOV, 'titular').map(d => [d.tipo, d]))
    expect(tit['excluir-dependente']!.disponivel).toBe(true)
    expect(tit['incluir-dependente']!.disponivel).toBe(false)
  })

  it('um tipo que não diz titular nem dependente vale para os dois; sem regra, nada', () => {
    const generica = [{ ator: 'Representante', tipo: 'Exclusão de beneficiário', atendimento: 'Imediato' }]
    expect(decidirMovimentacao(generica, 'excluir-titular', 'representante').disponivel).toBe(true)
    expect(decidirMovimentacao(generica, 'excluir-dependente', 'representante').disponivel).toBe(true)
    expect(decidirMovimentacao(generica, 'incluir-titular', 'representante').disponivel).toBe(false)
    expect(decisoesDeMovimentacao(null, 'titular').every(d => !d.disponivel)).toBe(true)
  })

  it('"dados cadastrais" e inclusão não se misturam', () => {
    const regra = [{ ator: 'Representante', tipo: 'Alteração de dados cadastrais', atendimento: 'Imediato' }]
    expect(decisoesDeMovimentacao(regra, 'representante').every(d => !d.disponivel)).toBe(true)
  })
})
