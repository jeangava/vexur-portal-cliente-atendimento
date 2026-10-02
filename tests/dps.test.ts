import { describe, expect, it } from 'vitest'
import type { PerguntaDps } from '../shared/types/portal'
import { calcularExpressao, perguntaVisivel, respostasSim, validarDps, valorCalculado } from '../shared/utils/dps'

const PERGUNTAS: PerguntaDps[] = [
  { id: 'peso', pergunta: 'Peso', tipo: 'numero', unidade: 'kg', min: 1, max: 400 },
  { id: 'altura', pergunta: 'Altura', tipo: 'numero', unidade: 'cm', min: 30, max: 250 },
  { id: 'imc', pergunta: 'IMC', tipo: 'calculado', formula: '{peso}/(({altura}/100)^2)' },
  { id: '1', pergunta: 'Tem doença do coração?', tipo: 'sim-nao' },
  { id: '1.1', pergunta: 'Qual e desde quando?', tipo: 'texto' },
  { id: '2', pergunta: 'Data da última cirurgia', tipo: 'data' },
]
const HOJE = new Date(2026, 8, 30)

describe('calculadora da DPS', () => {
  it('respeita precedência, parênteses e potência', () => {
    expect(calcularExpressao('2+3*4')).toBe(14)
    expect(calcularExpressao('(2+3)*4')).toBe(20)
    expect(calcularExpressao('2^3^2')).toBe(512)
    expect(calcularExpressao('-3+5')).toBe(2)
  })

  it('recusa qualquer coisa que não seja conta', () => {
    expect(() => calcularExpressao('constructor')).toThrow(/não permitidos/)
    expect(() => calcularExpressao('1+')).toThrow()
    expect(() => calcularExpressao('(1+2')).toThrow(/\)/)
  })

  it('calcula o IMC quando peso e altura estão preenchidos', () => {
    expect(valorCalculado(PERGUNTAS[2]!, { peso: '70', altura: '175' })).toBe('22.86')
    expect(valorCalculado(PERGUNTAS[2]!, { peso: '70,5', altura: '175' })).toBe('23.02')
    expect(valorCalculado(PERGUNTAS[2]!, { peso: '70' })).toBe('')
  })
})

describe('validação da DPS', () => {
  it('subpergunta só aparece e só é obrigatória quando o pai é "Sim"', () => {
    expect(perguntaVisivel(PERGUNTAS[4]!, { 1: 'nao' })).toBe(false)
    const base = { peso: '70', altura: '175', 2: '2020-01-10' }
    expect(validarDps(PERGUNTAS, { ...base, 1: 'nao' }, HOJE)).toEqual({})
    expect(validarDps(PERGUNTAS, { ...base, 1: 'sim' }, HOJE)['1.1']).toBe('Preencha esta resposta.')
  })

  it('explica o limite esperado nos números', () => {
    const erros = validarDps(PERGUNTAS, { peso: '700', altura: '175', 1: 'nao', 2: '2020-01-10' }, HOJE)
    expect(erros.peso).toBe('Confira o valor: esperado entre 1 e 400 kg.')
  })

  it('pede Sim ou Não e recusa data no futuro', () => {
    const erros = validarDps(PERGUNTAS, { peso: '70', altura: '175', 2: '2027-01-01' }, HOJE)
    expect(erros[1]).toBe('Responda Sim ou Não.')
    expect(erros[2]).toMatch(/futuro/)
  })

  it('lista as respostas "Sim" para o resumo', () => {
    expect(respostasSim(PERGUNTAS, { 1: 'sim' }).map(p => p.id)).toEqual(['1'])
  })
})
