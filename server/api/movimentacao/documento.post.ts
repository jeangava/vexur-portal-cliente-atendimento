/**
 * Recebe um documento (foto ou PDF) da inclusão ou de uma pendência de pedido.
 * Valida tipo e tamanho no servidor.
 */
export default defineEventHandler(async (event) => {
  // Também serve para responder pendências em "Meus pedidos" (que o titular de empresarial vê).
  await exigirArea(event, 'pedidos')
  const partes = await readMultipartFormData(event)
  const arquivo = partes?.find(p => p.name === 'arquivo' && p.filename)
  if (!arquivo) throw createError({ statusCode: 400, message: 'Escolha um arquivo para enviar.' })
  if (!DOCUMENTO_TIPOS.includes(arquivo.type ?? '')) {
    throw createError({ statusCode: 400, message: 'Envie uma foto (JPG ou PNG) ou um PDF.' })
  }
  if (arquivo.data.length > DOCUMENTO_TAMANHO_MAX) {
    throw createError({ statusCode: 400, message: 'O arquivo é muito grande. O limite é 5 MB.' })
  }
  const nome = String(arquivo.filename).replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 80) || 'documento'
  return guardarDocumento(nome)
})
