import ExcelJS from 'exceljs'
import type { LinhaInclusaoEmpresa } from '#shared/types/portal'

/**
 * Planilha de inclusão em lote (responsável pela empresa). LAYOUT PROVISÓRIO:
 * as colunas vêm de COLUNAS_PLANILHA (shared/utils/inclusaoEmpresa.ts) e serão revistas com o negócio.
 */

const ROXO = 'FF6955C1'

/** Modelo .xlsx: aba "Pessoas" para preencher (com listas de escolha) e aba "Como preencher". */
export async function gerarModeloPlanilha(planos: string[], parentescos: string[]): Promise<Buffer> {
  const livro = new ExcelJS.Workbook()
  livro.creator = 'Portal do Cliente'

  const aba = livro.addWorksheet('Pessoas', { views: [{ state: 'frozen', ySplit: 1 }] })
  aba.columns = COLUNAS_PLANILHA.map((titulo, i) => ({
    header: titulo,
    width: [38, 18, 20, 18, 18, 30][i],
    // CPF como texto: o Excel não come o zero da frente.
    style: i === 1 || i === 4 ? { numFmt: '@' } : i === 2 ? { numFmt: 'dd/mm/yyyy' } : {},
  }))
  const cabecalho = aba.getRow(1)
  cabecalho.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cabecalho.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } }
  cabecalho.height = 22

  // Listas de escolha (Excel aceita até 255 caracteres na lista em linha).
  const lista = (itens: string[]) => [`"${itens.map(i => i.replace(/[",]/g, '')).join(',')}"`]
  for (let linha = 2; linha <= LIMITE_LINHAS_PLANILHA + 1; linha++) {
    aba.getCell(`D${linha}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: lista([PARENTESCO_TITULAR, ...parentescos]),
      showErrorMessage: true, errorTitle: 'Parentesco', error: 'Escolha um parentesco da lista.',
    }
    aba.getCell(`F${linha}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: lista(planos),
      showErrorMessage: true, errorTitle: 'Plano', error: 'Escolha um plano da lista.',
    }
  }

  const ajuda = livro.addWorksheet('Como preencher')
  ajuda.getColumn(1).width = 110
  const textos = [
    'Como preencher a planilha de inclusão',
    '',
    '1. Use a aba "Pessoas". Uma linha para cada pessoa que vai entrar no plano. Não mude os títulos das colunas.',
    '2. Funcionário: escreva "Titular" em Parentesco e deixe "CPF do titular" em branco.',
    '3. Dependente: escolha o parentesco na lista e coloque o CPF do funcionário em "CPF do titular".',
    '   O funcionário pode já estar no plano ou entrar nesta mesma planilha.',
    '4. Data de nascimento no formato dia/mês/ano. Ex.: 25/03/1990.',
    '5. Plano e Parentesco: escolha na lista (setinha da célula).',
    `6. Até ${LIMITE_LINHAS_PLANILHA} pessoas por planilha.`,
    '',
    'Depois de enviar, o portal confere tudo e mostra o que precisa corrigir antes de mandar o pedido.',
    '',
    'Exemplo:',
  ]
  textos.forEach((t, i) => {
    const c = ajuda.getCell(`A${i + 1}`)
    c.value = t
    if (i === 0) c.font = { bold: true, size: 14, color: { argb: ROXO } }
  })
  const exemplo = ajuda.addTable({
    name: 'Exemplo', ref: `A${textos.length + 1}`, style: { theme: 'TableStyleLight9', showRowStripes: true },
    columns: COLUNAS_PLANILHA.map(name => ({ name })),
    rows: [
      ['José Carlos Exemplo', '000.000.001-91', '10/05/1985', PARENTESCO_TITULAR, '', planos[0] ?? ''],
      ['Lúcia Maria Exemplo', '000.000.002-72', '22/11/1987', parentescos[0] ?? 'Cônjuge', '000.000.001-91', planos[0] ?? ''],
    ],
  })
  exemplo.commit()
  ajuda.getColumn(1).width = 110

  return Buffer.from(await livro.xlsx.writeBuffer())
}

function doisDigitos(n: number) { return String(n).padStart(2, '0') }

/** Valor de uma célula como texto simples (datas viram AAAA-MM-DD; CPF numérico ganha os zeros da frente). */
function textoDaCelula(valor: ExcelJS.CellValue, coluna: number): string {
  if (valor === null || valor === undefined) return ''
  if (valor instanceof Date) {
    // O Excel guarda a data sem fuso; o exceljs entrega em UTC.
    return `${valor.getUTCFullYear()}-${doisDigitos(valor.getUTCMonth() + 1)}-${doisDigitos(valor.getUTCDate())}`
  }
  if (typeof valor === 'number') {
    const ehCpf = coluna === 2 || coluna === 5
    return ehCpf ? String(Math.trunc(valor)).padStart(11, '0') : String(valor)
  }
  if (typeof valor === 'object') {
    if ('result' in valor) return textoDaCelula(valor.result as ExcelJS.CellValue, coluna)
    if ('richText' in valor) return valor.richText.map(r => r.text).join('')
    if ('text' in valor) return String(valor.text)
    return ''
  }
  return String(valor).trim()
}

/** Lê a aba "Pessoas" (ou a primeira) e devolve as linhas preenchidas, com o número da linha no Excel. */
export async function lerPlanilha(conteudo: Buffer): Promise<(LinhaInclusaoEmpresa & { linha: number })[]> {
  const livro = new ExcelJS.Workbook()
  try {
    await livro.xlsx.load(conteudo as unknown as ArrayBuffer)
  } catch {
    throw createError({ statusCode: 400, message: 'Não conseguimos abrir o arquivo. Envie a planilha do modelo, salva em Excel (.xlsx).' })
  }
  const aba = livro.getWorksheet('Pessoas') ?? livro.worksheets[0]
  if (!aba) throw createError({ statusCode: 400, message: 'A planilha está vazia.' })

  const titulos = COLUNAS_PLANILHA.map((_, i) => normalizarTexto(textoDaCelula(aba.getRow(1).getCell(i + 1).value, 0)))
  if (titulos.some((t, i) => t !== normalizarTexto(COLUNAS_PLANILHA[i]!))) {
    throw createError({ statusCode: 400, message: 'As colunas não estão iguais às do modelo. Baixe o modelo de novo e preencha nele.' })
  }

  const linhas: (LinhaInclusaoEmpresa & { linha: number })[] = []
  aba.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return
    const c = (i: number) => textoDaCelula(row.getCell(i).value, i)
    const valores = [c(1), c(2), c(3), c(4), c(5), c(6)]
    if (valores.every(v => !v)) return
    linhas.push({ linha: numero, nome: valores[0]!, cpf: valores[1]!, nascimento: valores[2]!, parentesco: valores[3]!, cpfTitular: valores[4]!, plano: valores[5]! })
  })
  if (!linhas.length) throw createError({ statusCode: 400, message: 'A planilha não tem nenhuma pessoa preenchida.' })
  if (linhas.length > LIMITE_LINHAS_PLANILHA) {
    throw createError({ statusCode: 400, message: `A planilha tem ${linhas.length} pessoas. O limite é ${LIMITE_LINHAS_PLANILHA} por vez: divida em mais de uma.` })
  }
  return linhas
}
