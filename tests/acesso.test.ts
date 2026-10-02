import { describe, expect, it } from 'vitest'
import { mascararEmail, mascararTelefone } from '../shared/utils/mascara'
import { problemaNaNovaSenha, regrasDaSenha } from '../shared/utils/senha'

// As funções de shared/utils usam somenteDigitos por auto-import do Nuxt; aqui injetamos manualmente.
import { somenteDigitos } from '../shared/utils/cpf'
Object.assign(globalThis, { somenteDigitos })

describe('mascara', () => {
  it('esconde o e-mail deixando só o começo e o domínio', () => {
    expect(mascararEmail('maria.silva@email.com')).toBe('ma•••••••••@email.com')
    expect(mascararEmail('ab@x.com')).toBe('a•••@x.com')
    expect(mascararEmail('invalido')).toBe('•••••')
  })

  it('esconde o celular deixando os 4 últimos números', () => {
    expect(mascararTelefone('11987654321')).toBe('(••) •••••-4321')
    expect(mascararTelefone('(11) 3456-7890')).toBe('(••) ••••-7890')
  })
})

describe('senha nova', () => {
  it('marca as regras cumpridas', () => {
    const regras = regrasDaSenha('abc12345', '52998224725')
    expect(regras.every(r => r.ok)).toBe(true)
    expect(regrasDaSenha('1234567', '').find(r => r.texto.includes('letra'))?.ok).toBe(false)
  })

  it('não aceita o CPF dentro da senha', () => {
    expect(problemaNaNovaSenha('a52998224725', 'a52998224725', '529.982.247-25')).toMatch(/cpf/)
  })

  it('pede para repetir a mesma senha', () => {
    expect(problemaNaNovaSenha('abc12345', 'abc12346')).toMatch(/diferentes/)
    expect(problemaNaNovaSenha('abc12345', 'abc12345')).toBeNull()
  })
})
