export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'contas')
  return obterExtrato(usuario, getRouterParam(event, 'id') ?? '')
})
