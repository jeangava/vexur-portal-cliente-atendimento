import { describe, expect, it } from 'vitest'
import { avaliarEvento, decidirDeclaracaoDoDependente, diasDesdeOEvento, eventoDoParentesco } from '../shared/utils/eventoDeInclusao'

const HOJE = new Date(2026, 9, 19)

describe('inclusão de dependente: evento e declaração de saúde', () => {
  it('relaciona o parentesco com o evento (RN, RC, RT)', () => {
    expect(eventoDoParentesco('Filho(a)')).toBe('RN')
    expect(eventoDoParentesco('Cônjuge')).toBe('RC')
    expect(eventoDoParentesco('Companheiro(a)')).toBe('RC')
    expect(eventoDoParentesco('Menor sob guarda')).toBe('RT')
    expect(eventoDoParentesco('Enteado(a)')).toBeNull()
    expect(eventoDoParentesco('Filho(a) inválido(a)')).toBeNull()
  })

  it('conta os dias desde o evento', () => {
    expect(diasDesdeOEvento('2026-10-19', HOJE)).toBe(0)
    expect(diasDesdeOEvento('2026-09-19', HOJE)).toBe(30)
    expect(diasDesdeOEvento('2026-10-25', HOJE)).toBe(-6)
    expect(diasDesdeOEvento('19/10/2026', HOJE)).toBeNaN()
  })

  it('o evento vale se não é futuro e está no prazo da regra', () => {
    expect(avaliarEvento('2026-10-10', 30, HOJE).valeComoEvento).toBe(true)
    expect(avaliarEvento('2026-10-10', undefined, HOJE).valeComoEvento).toBe(true)
    expect(avaliarEvento('2026-08-01', 30, HOJE).valeComoEvento).toBe(false)
    expect(avaliarEvento('2026-11-01', 30, HOJE).valeComoEvento).toBe(false)
    expect(avaliarEvento('', 30, HOJE).valeComoEvento).toBe(false)
  })

  it('porte 2 e 3 nunca pedem declaração', () => {
    expect(decidirDeclaracaoDoDependente('PORTE 2 ', { valeComoEvento: false, dias: 400 }).pedir).toBe(false)
    expect(decidirDeclaracaoDoDependente('PORTE 3', null).pedir).toBe(false)
  })

  it('porte 1: só o evento até 30 dias dispensa a declaração', () => {
    expect(decidirDeclaracaoDoDependente('PORTE 1', { valeComoEvento: true, dias: 10 }).pedir).toBe(false)
    expect(decidirDeclaracaoDoDependente('PORTE 1', { valeComoEvento: true, dias: 30 }).pedir).toBe(false)
    expect(decidirDeclaracaoDoDependente('PORTE 1', { valeComoEvento: true, dias: 31 }).pedir).toBe(true)
    expect(decidirDeclaracaoDoDependente('PORTE 1', { valeComoEvento: false, dias: 90 }).pedir).toBe(true)
    expect(decidirDeclaracaoDoDependente('PORTE 1', null).pedir).toBe(true)
  })

  it('sem porte conhecido, pede por segurança', () => {
    expect(decidirDeclaracaoDoDependente('Não se aplica', { valeComoEvento: true, dias: 1 }).pedir).toBe(true)
  })
})
