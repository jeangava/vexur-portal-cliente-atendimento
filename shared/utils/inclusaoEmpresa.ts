import type { LinhaConferida, LinhaInclusaoEmpresa } from '#shared/types/portal'
import { cpfValido, formatarCpf, somenteDigitos } from './cpf'

/**
 * Inclusão no plano da empresa (responsável): uma pessoa pelo formulário ou várias pela planilha.
 * As duas usam a mesma conferência, então a regra é uma só.
 * LAYOUT PROVISÓRIO da planilha: as colunas serão definidas depois com o negócio.
 */

export const COLUNAS_PLANILHA = ['Nome completo', 'CPF', 'Data de nascimento', 'Parentesco', 'CPF do titular', 'Plano'] as const
export const LIMITE_LINHAS_PLANILHA = 500
export const PLANILHA_TAMANHO_MAX = 2 * 1024 * 1024
export const PARENTESCO_TITULAR = 'Titular'

/** Compara sem acento, maiúscula ou espaço sobrando: "conjuge" = "Cônjuge". */
export function normalizarTexto(valor: string): string {
  return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Aceita "AAAA-MM-DD" ou "DD/MM/AAAA" e devolve "AAAA-MM-DD" (ou "" se não for data de verdade). */
export function lerData(valor: string): string {
  const texto = String(valor ?? '').trim()
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return ''
  const [ano, mes, dia] = texto.includes('/') ? [m[3], m[2], m[1]] : [m[1], m[2], m[3]]
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia))
  if (d.getFullYear() !== Number(ano) || d.getMonth() !== Number(mes) - 1 || d.getDate() !== Number(dia)) return ''
  return `${ano}-${mes}-${dia}`
}

export interface ContextoInclusao {
  /** CPFs (só dígitos) de quem já está no plano */
  cpfsNoPlano: Set<string>
  /** CPFs (só dígitos) dos titulares que já estão no plano */
  titularesNoPlano: Set<string>
  planos: string[]
  /** Parentescos de dependente aceitos (sem "Titular") */
  parentescos: string[]
  hoje?: Date
}

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Confere as linhas e devolve cada uma com a lista de problemas, em linguagem simples.
 * Parentesco e plano saem escritos do jeito certo da lista (ex.: "conjuge" → "Cônjuge").
 */
export function conferirInclusoes(
  linhas: (LinhaInclusaoEmpresa & { linha: number })[],
  ctx: ContextoInclusao,
): LinhaConferida[] {
  const hoje = iso(ctx.hoje ?? new Date())
  const limiteIdade = iso(new Date(new Date(`${hoje}T12:00:00`).setFullYear(Number(hoje.slice(0, 4)) - 120)))
  const vezesCpf = new Map<string, number>()
  for (const l of linhas) {
    const d = somenteDigitos(l.cpf)
    if (d) vezesCpf.set(d, (vezesCpf.get(d) ?? 0) + 1)
  }

  // 1ª volta: cada linha sozinha.
  const conferidas = linhas.map((l): LinhaConferida => {
    const erros: string[] = []
    const nome = String(l.nome ?? '').trim().replace(/\s+/g, ' ')
    const cpf = somenteDigitos(l.cpf)
    const cpfTitular = somenteDigitos(l.cpfTitular)
    const parentesco = [PARENTESCO_TITULAR, ...ctx.parentescos].find(p => normalizarTexto(p) === normalizarTexto(l.parentesco))
    const plano = ctx.planos.find(p => normalizarTexto(p) === normalizarTexto(l.plano))
    const nascimento = lerData(l.nascimento)

    if (!nome) erros.push('Falta o nome.')
    else if (nome.split(' ').length < 2 || /[^\p{L}' -]/u.test(nome)) erros.push('Escreva o nome completo, só com letras.')

    if (!cpf) erros.push('Falta o CPF.')
    else if (!cpfValido(cpf)) erros.push('O CPF não existe. Confira os números.')
    else if ((vezesCpf.get(cpf) ?? 0) > 1) erros.push('Esse CPF aparece mais de uma vez na planilha.')
    else if (ctx.cpfsNoPlano.has(cpf)) erros.push('Essa pessoa já está no plano.')

    if (!String(l.nascimento ?? '').trim()) erros.push('Falta a data de nascimento.')
    else if (!nascimento) erros.push('A data de nascimento não está certa. Use dia/mês/ano, ex.: 25/03/1990.')
    else if (nascimento > hoje) erros.push('A data de nascimento está no futuro.')
    else if (nascimento < limiteIdade) erros.push('A data de nascimento está muito antiga. Confira o ano.')

    if (!String(l.parentesco ?? '').trim()) erros.push('Falta o parentesco (use "Titular" para o funcionário).')
    else if (!parentesco) erros.push(`Parentesco "${l.parentesco}" não é aceito. Use um da lista.`)

    if (parentesco && parentesco !== PARENTESCO_TITULAR) {
      if (!cpfTitular) erros.push('Falta o CPF do titular (o funcionário de quem a pessoa é dependente).')
      else if (!cpfValido(cpfTitular)) erros.push('O CPF do titular não existe. Confira os números.')
      else if (cpfTitular === cpf) erros.push('O CPF do titular é o da própria pessoa.')
    }

    if (!String(l.plano ?? '').trim()) erros.push('Falta o plano.')
    else if (!plano) erros.push(`Plano "${l.plano}" não existe no contrato. Use um da lista.`)

    return {
      linha: l.linha, nome, erros,
      cpf: cpf ? formatarCpf(cpf) : String(l.cpf ?? '').trim(),
      nascimento: nascimento || String(l.nascimento ?? '').trim(),
      parentesco: parentesco ?? String(l.parentesco ?? '').trim(),
      cpfTitular: cpfTitular ? formatarCpf(cpfTitular) : '',
      plano: plano ?? String(l.plano ?? '').trim(),
    }
  })

  // 2ª volta: o dependente precisa de um titular que já está no plano ou que entra nesta mesma planilha.
  const titularesDaPlanilha = new Map(
    conferidas.filter(c => c.parentesco === PARENTESCO_TITULAR).map(c => [somenteDigitos(c.cpf), c]),
  )
  for (const c of conferidas) {
    if (c.parentesco === PARENTESCO_TITULAR || !cpfValido(c.cpfTitular)) continue
    const cpfTitular = somenteDigitos(c.cpfTitular)
    if (ctx.titularesNoPlano.has(cpfTitular)) continue
    const naPlanilha = titularesDaPlanilha.get(cpfTitular)
    if (!naPlanilha) c.erros.push('O titular não está no plano nem nesta planilha.')
    else if (naPlanilha.erros.length) c.erros.push(`O titular (linha ${naPlanilha.linha}) tem problema. Corrija o titular primeiro.`)
  }
  return conferidas
}
