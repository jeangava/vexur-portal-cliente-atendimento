/** Recebe a planilha preenchida e devolve linha por linha o que está certo e o que precisa corrigir. */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const partes = await readMultipartFormData(event)
  const arquivo = partes?.find(p => p.name === 'arquivo' && p.filename)
  if (!arquivo) throw createError({ statusCode: 400, message: 'Escolha a planilha para enviar.' })
  if (!/\.xlsx$/i.test(arquivo.filename ?? '')) {
    throw createError({ statusCode: 400, message: 'Envie a planilha em Excel (.xlsx), a mesma do modelo.' })
  }
  if (arquivo.data.length > PLANILHA_TAMANHO_MAX) {
    throw createError({ statusCode: 400, message: 'O arquivo é muito grande. O limite é 2 MB.' })
  }
  const { cpf } = (await usarSessao(event)).data
  const nome = String(arquivo.filename).replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 80) || 'planilha.xlsx'
  return conferirPlanilhaEmpresa(usuario, cpf ?? '', nome, arquivo.data)
})
