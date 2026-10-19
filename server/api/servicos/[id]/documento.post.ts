/** Gera o documento de um serviço (PDF para ver e baixar). O contrato e o tipo vêm da sessão, nunca da tela. */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'servicos')
  const corpo = await readBody<Record<string, unknown>>(event)
  return gerarDocumentoDoServico(usuario, getRouterParam(event, 'id') ?? '', corpo ?? {})
})
