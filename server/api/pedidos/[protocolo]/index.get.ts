export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'pedidos')
  return obterSolicitacao(usuario, getRouterParam(event, 'protocolo') ?? '')
})
