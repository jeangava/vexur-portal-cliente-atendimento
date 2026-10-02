/** Envia as pessoas sem problema de uma planilha já conferida (pelo id guardado no servidor). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const corpo = await readBody<{ id?: string }>(event)
  const { cpf } = (await usarSessao(event)).data
  return enviarPlanilhaEmpresa(usuario, cpf ?? '', String(corpo?.id ?? ''))
})
