/** Baixa um anexo do resultado do pedido. O nome do arquivo vai só no cabeçalho, nunca na URL. */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'pedidos')
  const { nome, conteudo } = await anexoDaSolicitacao(usuario, getRouterParam(event, 'protocolo') ?? '', getRouterParam(event, 'id') ?? '')
  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="anexo.pdf"; filename*=UTF-8''${encodeURIComponent(nome)}`,
    'Cache-Control': 'private, no-store',
  })
  return conteudo
})
