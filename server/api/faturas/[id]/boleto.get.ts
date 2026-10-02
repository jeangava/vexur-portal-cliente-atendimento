export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'contas')
  return obterBoleto(usuario, getRouterParam(event, 'id') ?? '')
})
