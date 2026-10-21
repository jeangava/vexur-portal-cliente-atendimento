import { describe, expect, it } from 'vitest'
import { categoriaDoProcesso, situacaoDoStatus, solicitacaoDoProtocolo } from '../shared/utils/protocolos'

describe('protocolos do Vexur em Meus pedidos', () => {
  it('reconhece inclusão, saída e alteração; o resto não aparece', () => {
    expect(categoriaDoProcesso('Inclusão de beneficiário no portal')).toEqual({ categoria: 'movimentacao', tipo: 'inclusao' })
    expect(categoriaDoProcesso('Exclusão de dependente')).toEqual({ categoria: 'movimentacao', tipo: 'exclusao' })
    expect(categoriaDoProcesso('Alteração de e-mail')).toEqual({ categoria: 'cadastro', tipo: 'alteracao-cadastral' })
    expect(categoriaDoProcesso('Alteração de senha')).toBeNull()
    expect(categoriaDoProcesso('Envio de boleto por e-mail')).toBeNull()
  })

  it('traduz o status do fluxo; o desconhecido vira "em análise"', () => {
    expect(situacaoDoStatus('Sucesso')).toBe('concluida')
    expect(situacaoDoStatus('Reprovada')).toBe('pendente')
    expect(situacaoDoStatus('Cancelada')).toBe('indeferida')
    expect(situacaoDoStatus('Em andamento')).toBe('em-analise')
    expect(situacaoDoStatus(undefined)).toBe('em-analise')
  })

  it('monta o pedido com o nome da pessoa e a data', () => {
    const s = solicitacaoDoProtocolo({ id: 1, protocolo: '202610-0001-00000001', processo: 'Inclusão de beneficiário no portal', dataCriacao: new Date(2026, 9, 19, 12).getTime(), statusAtual: 'Pendente' }, 'Ana Souza')!
    expect(s.titulo).toBe('Incluir Ana Souza')
    expect(s.criadaEm).toBe('2026-10-19')
    expect(s.situacao).toBe('em-analise')
    expect(solicitacaoDoProtocolo({ id: 2, protocolo: '', processo: 'Inclusão' })).toBeNull()
  })
})
