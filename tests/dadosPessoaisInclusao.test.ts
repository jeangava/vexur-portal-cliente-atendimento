import { describe, expect, it } from 'vitest'
import { limparDadosPessoais, problemaNosDadosPessoais } from '../shared/utils/dadosPessoaisInclusao'

const certo = { sexo: 'Feminino', estadoCivil: 'Solteiro(a)', nomeMae: 'Maria Souza', cartaoSus: '705007208245156' }

describe('cadastro de quem entra no plano', () => {
  it('aceita o cadastro com os obrigatórios', () => {
    expect(problemaNosDadosPessoais(certo)).toBeNull()
  })
  it('pede sexo, estado civil, nome da mãe e cartão do SUS', () => {
    expect(problemaNosDadosPessoais({ ...certo, sexo: '' })).toMatch(/sexo/)
    expect(problemaNosDadosPessoais({ ...certo, estadoCivil: '' })).toMatch(/estado civil/)
    expect(problemaNosDadosPessoais({ ...certo, nomeMae: '' })).toMatch(/nome da mãe/)
    expect(problemaNosDadosPessoais({ ...certo, nomeMae: 'Maria' })).toMatch(/completo/)
    expect(problemaNosDadosPessoais({ ...certo, cartaoSus: '' })).toMatch(/Cartão Nacional/)
    expect(problemaNosDadosPessoais({ ...certo, cartaoSus: '123' })).toMatch(/15 números/)
    expect(problemaNosDadosPessoais(null)).toMatch(/sexo/)
  })
  it('"não possui nome da mãe" dispensa o nome', () => {
    expect(problemaNosDadosPessoais({ ...certo, nomeMae: '', naoPossuiNomeMae: true })).toBeNull()
    expect(limparDadosPessoais({ ...certo, nomeMae: 'Maria Souza', naoPossuiNomeMae: true }).nomeMae).toBe('')
  })
  it('limpa o cartão do SUS e o PIS para só números', () => {
    const l = limparDadosPessoais({ ...certo, cartaoSus: '705.0072 0824 5156', pisPasep: '123.45678.90-1' })
    expect(l.cartaoSus).toBe('705007208245156')
    expect(l.pisPasep).toBe('12345678901')
  })
})
