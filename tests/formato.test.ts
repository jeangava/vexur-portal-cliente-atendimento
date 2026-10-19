import { describe, expect, it } from 'vitest'
import { cpfValido, formatarCpf, problemaNoCpf } from '../shared/utils/cpf'
import { dataPorExtenso, formatarData } from '../shared/utils/formato'

describe('cpf', () => {
  it('formata enquanto digita', () => {
    expect(formatarCpf('529')).toBe('529')
    expect(formatarCpf('5299822')).toBe('529.982.2')
    expect(formatarCpf('52998224725')).toBe('529.982.247-25')
    expect(formatarCpf('529.982.247-2599')).toBe('529.982.247-25')
  })

  it('valida os dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('529.982.247-24')).toBe(false)
    expect(cpfValido('111.111.111-11')).toBe(false)
  })

  it('explica o problema com palavras simples', () => {
    expect(problemaNoCpf('')).toBe('Digite o seu CPF para continuar.')
    expect(problemaNoCpf('529982247')).toBe('O CPF tem 11 números. Você digitou 9.')
    expect(problemaNoCpf('52998224724')).toMatch(/não parece certo/)
    expect(problemaNoCpf('52998224725')).toBeNull()
  })

  it('no ambiente de integração aceita CPF fictício (dígitos inválidos), mas exige 11 números', () => {
    expect(problemaNoCpf('52998224724', { conferirDigitos: false })).toBeNull()
    expect(problemaNoCpf('529982247', { conferirDigitos: false })).toBe('O CPF tem 11 números. Você digitou 9.')
    expect(problemaNoCpf('', { conferirDigitos: false })).toBe('Digite o seu CPF para continuar.')
  })
})

describe('formato', () => {
  it('formata datas sem depender de fuso', () => {
    expect(formatarData('2026-10-01')).toBe('01/10/2026')
    expect(dataPorExtenso('2026-10-01')).toBe('1 de outubro')
  })
})
