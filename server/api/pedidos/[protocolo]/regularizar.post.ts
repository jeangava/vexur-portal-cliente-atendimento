/** O cliente resolve a pendência de um pedido (ex.: envia o documento que faltava). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'pedidos')
  const corpo = await readBody<{ documentos?: unknown, mensagem?: unknown }>(event)
  return regularizarPendencia(usuario, getRouterParam(event, 'protocolo') ?? '', {
    documentos: Array.isArray(corpo?.documentos) ? corpo.documentos.map(String).slice(0, 10) : [],
    mensagem: String(corpo?.mensagem ?? '').slice(0, 1000),
  })
})
