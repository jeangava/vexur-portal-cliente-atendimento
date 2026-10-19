/** Família de um titular da empresa, carregada quando o responsável abre a linha dele. */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'familia')
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!/^[0-9.]{1,20}$/.test(id)) throw createError({ statusCode: 400, message: 'Pessoa inválida.' })
  return familiaDoTitularDaEmpresa(usuario, id)
})
