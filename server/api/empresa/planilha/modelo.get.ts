/** Baixa o modelo da planilha de inclusão, já com os planos e parentescos do contrato. */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const arquivo = await modeloPlanilhaEmpresa(usuario)
  setResponseHeaders(event, {
    'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'content-disposition': 'attachment; filename="modelo-inclusao.xlsx"',
    'cache-control': 'no-store',
  })
  return arquivo
})
