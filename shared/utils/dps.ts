import type { PerguntaDps, RespostasDps } from '#shared/types/portal'

/** "1.1" → "1"; pergunta principal → null */
export function idDoPai(id: string): string | null {
  const ponto = id.indexOf('.')
  return ponto === -1 ? null : id.slice(0, ponto)
}

/** Subperguntas só aparecem (e só são obrigatórias) quando o pai foi respondido com "Sim". */
export function perguntaVisivel(p: PerguntaDps, respostas: RespostasDps): boolean {
  const pai = idDoPai(p.id)
  return pai === null || respostas[pai] === 'sim'
}

function numero(valor: string | undefined): number | null {
  if (valor === undefined || valor.trim() === '') return null
  const n = Number(valor.replace(',', '.').trim())
  return Number.isFinite(n) ? n : null
}

// ------------------------------------------------------------------ calculadora
// Calculadora pequena e segura para as fórmulas da DPS (ex.: IMC). Substitui o mathjs
// do app antigo: só aceita números, + - * / ^ e parênteses — nada de nomes ou funções.

type Leitor = { texto: string, pos: number }

function espiar(l: Leitor): string { return l.texto[l.pos] ?? '' }

function lerNumero(l: Leitor): number {
  const inicio = l.pos
  while (/[\d.]/.test(espiar(l))) l.pos++
  const n = Number(l.texto.slice(inicio, l.pos))
  if (inicio === l.pos || !Number.isFinite(n)) throw new Error(`número inválido na posição ${inicio} de "${l.texto}"`)
  return n
}

function lerFator(l: Leitor): number {
  if (espiar(l) === '-') { l.pos++; return -lerFator(l) }
  if (espiar(l) === '(') {
    l.pos++
    const v = lerSoma(l)
    if (espiar(l) !== ')') throw new Error(`esperava ")" na posição ${l.pos} de "${l.texto}"`)
    l.pos++
    return v
  }
  return lerNumero(l)
}

function lerPotencia(l: Leitor): number {
  const base = lerFator(l)
  if (espiar(l) !== '^') return base
  l.pos++
  return base ** lerPotencia(l)
}

function lerProduto(l: Leitor): number {
  let v = lerPotencia(l)
  while (espiar(l) === '*' || espiar(l) === '/') {
    const op = l.texto[l.pos++]
    const d = lerPotencia(l)
    v = op === '*' ? v * d : v / d
  }
  return v
}

function lerSoma(l: Leitor): number {
  let v = lerProduto(l)
  while (espiar(l) === '+' || espiar(l) === '-') {
    const op = l.texto[l.pos++]
    const d = lerProduto(l)
    v = op === '+' ? v + d : v - d
  }
  return v
}

/** Avalia uma expressão só com números e + - * / ^ ( ). Ex.: calcularExpressao("70/((175/100)^2)") → 22.857… */
export function calcularExpressao(expressao: string): number {
  const texto = expressao.replace(/\s+/g, '')
  if (!/^[\d.+\-*/^()]+$/.test(texto)) throw new Error(`fórmula com caracteres não permitidos: "${expressao}"`)
  const leitor = { texto, pos: 0 }
  const resultado = lerSoma(leitor)
  if (leitor.pos !== texto.length) throw new Error(`sobrou texto na posição ${leitor.pos} de "${expressao}"`)
  return resultado
}

/** Resultado do campo calculado, com 2 casas, ou "" enquanto faltar resposta. Ex.: IMC. */
export function valorCalculado(p: PerguntaDps, respostas: RespostasDps): string {
  if (!p.formula) return ''
  let faltou = false
  const expressao = p.formula.replace(/\{([\w.]+)\}/g, (_, id: string) => {
    const n = numero(respostas[id])
    if (n === null) faltou = true
    return String(n ?? 0)
  })
  if (faltou) return ''
  try {
    const r = calcularExpressao(expressao)
    return Number.isFinite(r) ? r.toFixed(2) : ''
  } catch {
    return ''
  }
}

// ------------------------------------------------------------------ validação

function problemaNaResposta(p: PerguntaDps, valor: string | undefined, hoje: Date): string | undefined {
  const v = (valor ?? '').trim()
  if (p.tipo === 'sim-nao') return v === 'sim' || v === 'nao' ? undefined : 'Responda Sim ou Não.'
  if (!v) return p.tipo === 'data' ? 'Informe a data.' : 'Preencha esta resposta.'
  if (p.tipo === 'numero') {
    const n = numero(v)
    if (n === null) return 'Digite só números.'
    if ((p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max)) {
      return `Confira o valor: esperado entre ${p.min} e ${p.max}${p.unidade ? ` ${p.unidade}` : ''}.`
    }
  }
  if (p.tipo === 'data') {
    const [a, m, d] = v.split('-').map(Number)
    const data = new Date(a!, (m ?? 1) - 1, d)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || data.getDate() !== d) return 'Essa data não existe.'
    if (data > hoje) return 'A data não pode ser no futuro.'
  }
  return undefined
}

/** Erros por id de pergunta. Só valida o que está visível; campos calculados não são digitados. */
export function validarDps(perguntas: PerguntaDps[], respostas: RespostasDps, hoje = new Date()): Record<string, string> {
  const erros: Record<string, string> = {}
  for (const p of perguntas) {
    if (p.tipo === 'calculado' || !perguntaVisivel(p, respostas)) continue
    const e = problemaNaResposta(p, respostas[p.id], hoje)
    if (e) erros[p.id] = e
  }
  return erros
}

/** Perguntas principais respondidas com "Sim" (para o resumo da conferência). */
export function respostasSim(perguntas: PerguntaDps[], respostas: RespostasDps): PerguntaDps[] {
  return perguntas.filter(p => p.tipo === 'sim-nao' && idDoPai(p.id) === null && respostas[p.id] === 'sim')
}
