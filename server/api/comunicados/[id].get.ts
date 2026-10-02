export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'comunicados')
  return obterComunicado(usuario, getRouterParam(event, 'id') ?? '')
})
