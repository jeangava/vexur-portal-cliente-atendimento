import { describe, expect, it } from 'vitest'
import { limparPlanoAnterior, problemaNoPlanoAnterior } from '../shared/utils/planoAnterior'

const certo = { tipo: 'Coletivo por adesão', operadora: 'Unimed', plano: 'Enfermaria', tempoMeses: '18', ultimoPagamento: '2026-09-10' }
const HOJE = new Date(2026, 9, 20)

describe('plano anterior do dependente', () => {
  it('aceita os dados completos', () => {
    expect(problemaNoPlanoAnterior(certo, HOJE)).toBeNull()
  })
  it('pede cada campo e confere tempo e data', () => {
    expect(problemaNoPlanoAnterior({ ...certo, tipo: '' }, HOJE)).toMatch(/tipo/)
    expect(problemaNoPlanoAnterior({ ...certo, operadora: '' }, HOJE)).toMatch(/operadora/)
    expect(problemaNoPlanoAnterior({ ...certo, plano: '' }, HOJE)).toMatch(/nome do plano/)
    expect(problemaNoPlanoAnterior({ ...certo, tempoMeses: '' }, HOJE)).toMatch(/meses/)
    expect(problemaNoPlanoAnterior({ ...certo, tempoMeses: '-3' }, HOJE)).toMatch(/meses/)
    expect(problemaNoPlanoAnterior({ ...certo, ultimoPagamento: '' }, HOJE)).toMatch(/último pagamento/)
    expect(problemaNoPlanoAnterior({ ...certo, ultimoPagamento: '2027-01-01' }, HOJE)).toMatch(/futuro/)
    expect(problemaNoPlanoAnterior(null, HOJE)).toMatch(/tipo/)
  })
  it('limpa os textos', () => {
    expect(limparPlanoAnterior({ ...certo, operadora: '  Unimed   Nacional ', tempoMeses: '18,5' })).toMatchObject({ operadora: 'Unimed Nacional', tempoMeses: '18.5' })
  })
})
