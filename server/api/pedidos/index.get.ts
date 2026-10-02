/** Todos os pedidos do cliente: movimentação, serviços e atendimento. */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'pedidos')
  return listarPedidos(usuario)
})
