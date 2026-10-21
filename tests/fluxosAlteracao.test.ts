import { describe, expect, it } from 'vitest'
import { comAtendimentoDoFluxo, FLUXO_DA_ALTERACAO } from '../shared/utils/fluxosAlteracao'
import { decisoesDaRegra } from '../shared/utils/regraServicosOnline'

describe('alterações pelos fluxos do Vexur', () => {
  it('e-mail, telefone e endereço andam na hora; dados pessoais passam pela área de cadastro', () => {
    expect(FLUXO_DA_ALTERACAO.email.atendimento).toBe('imediato')
    expect(FLUXO_DA_ALTERACAO.celular.atendimento).toBe('imediato')
    expect(FLUXO_DA_ALTERACAO.telefone.atendimento).toBe('imediato')
    expect(FLUXO_DA_ALTERACAO.endereco.atendimento).toBe('imediato')
    expect(FLUXO_DA_ALTERACAO.dados.atendimento).toBe('aprovacao')
  })

  it('a regra continua dizendo quem pode e quais documentos; o fluxo diz se é na hora ou por aprovação', () => {
    // A regra mandava aprovação para e-mail; agora vale o fluxo (na hora). O documento da regra continua.
    const regra = [{ ator: 'Titular', tipo: 'Alteração de e-mail', atendimento: 'Sob aprovação', documentos: ['Comprovante'] }]
    const d = comAtendimentoDoFluxo(decisoesDaRegra(regra, 'titular'))
    const email = d.find(x => x.campo === 'email')!
    expect(email.disponivel).toBe(true)
    expect(email.atendimento).toBe('imediato')
    expect(email.documentos).toEqual(['Comprovante'])
    // O que a regra não libera continua indisponível.
    expect(d.find(x => x.campo === 'dados')!.disponivel).toBe(false)
  })
})
