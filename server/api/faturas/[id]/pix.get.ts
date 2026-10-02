export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'contas')
  return obterPix(usuario, getRouterParam(event, 'id') ?? '')
})
