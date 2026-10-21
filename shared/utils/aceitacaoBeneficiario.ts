/**
 * Regra de aceitação de beneficiário (api-vexur-regra-venda-aceitacao-beneficiario, `obterRegraProduto`).
 * Para a Movimentação, o que vale é o que a regra marca como "Movimentação cadastral":
 *  - os graus de parentesco que podem ser incluídos;
 *  - os documentos exigidos, em "opções": a pessoa cumpre UMA opção, e cada opção pode pedir vários documentos.
 */
export interface RegraDeAceitacaoBruta {
  grauRelacionamento?: {
    /** Parentescos que esta linha da regra cobre (ex.: ["FILHO(A)", "ENTEADO(A)"]) */
    grauRelacionamento?: string[] | null
    regraFaixaEtaria?: {
      dependenteTipoMovimentacao?: string[] | string | null
      /** Dias após o evento (nascimento, casamento, tutela) em que a inclusão ainda vale como evento */
      prazoInclusao?: number | string | null
      /** Opções de documentação: cada uma é uma lista de documentos */
      dependenteDocumentos?: (string[] | null)[] | null
    }[] | null
  }[] | null
}

export interface ParentescoAceito {
  /** Como o parentesco aparece no cadastro (ex.: "Filho(a)") */
  parentesco: string
  /** Opções de documentos; vazio = não exige documento */
  documentos: string[][]
  /** Prazo (dias) para incluir depois do evento; sem prazo na regra, não há limite */
  prazoInclusaoDias?: number
}

function normalizar(t: unknown): string {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

function ehMovimentacaoCadastral(tipos: string[] | string | null | undefined): boolean {
  const lista = Array.isArray(tipos) ? tipos : tipos ? [tipos] : []
  return lista.some(t => /MOVIMENTACAO\s+CADASTRAL/.test(normalizar(t)))
}

/** "FILHO(A)" → "Filho(a)", "CÔNJUGE" → "Cônjuge" */
function legivel(t: string): string {
  const x = t.trim().toLowerCase()
  return x.charAt(0).toUpperCase() + x.slice(1)
}

/**
 * Dependentes que a regra aceita na movimentação cadastral, com as opções de documentos de cada um.
 * O titular não entra (a inclusão de titular segue outro caminho). Sem regra marcada: lista vazia.
 */
export function parentescosDaMovimentacao(regra: RegraDeAceitacaoBruta | null | undefined): ParentescoAceito[] {
  const achados = new Map<string, ParentescoAceito>()
  for (const linha of regra?.grauRelacionamento ?? []) {
    const faixas = (linha.regraFaixaEtaria ?? []).filter(f => ehMovimentacaoCadastral(f.dependenteTipoMovimentacao))
    if (!faixas.length) continue
    // Opções de todas as faixas marcadas, sem repetir.
    const opcoes: string[][] = []
    const vistas = new Set<string>()
    for (const f of faixas) {
      for (const o of f.dependenteDocumentos ?? []) {
        const docs = [...new Set((o ?? []).map(d => String(d).trim()).filter(Boolean))]
        const chave = docs.map(normalizar).sort().join('|')
        if (docs.length && !vistas.has(chave)) { vistas.add(chave); opcoes.push(docs) }
      }
    }
    const prazos = faixas.map(f => Number(f.prazoInclusao)).filter(n => Number.isFinite(n) && n >= 0)
    const prazoInclusaoDias = prazos.length ? Math.max(...prazos) : undefined
    for (const g of linha.grauRelacionamento ?? []) {
      if (/TITULAR/.test(normalizar(g))) continue
      const chave = normalizar(g)
      if (!achados.has(chave)) achados.set(chave, { parentesco: legivel(String(g)), documentos: opcoes, prazoInclusaoDias })
    }
  }
  return [...achados.values()]
}
