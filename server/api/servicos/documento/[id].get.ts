/** Entrega o PDF de um documento gerado: ?modo=ver abre na tela; ?modo=baixar força o download. */
export default defineEventHandler(async (event) => {
  await exigirArea(event, 'servicos')
  const { acesso } = await acessoDaSessao(event)
  const id = String(getRouterParam(event, 'id') ?? '')
  const doc = /^[0-9a-f-]{36}$/i.test(id) ? obterDocumentoGuardado(id, acesso.login) : undefined
  if (!doc) throw createError({ statusCode: 404, message: 'Esse documento expirou. Gere de novo, por favor.' })

  const resposta = await $fetch.raw<ArrayBuffer>(doc.url, { responseType: 'arrayBuffer', timeout: 60_000 }).catch(() => null)
  if (!resposta?._data) throw createError({ statusCode: 502, message: 'Não conseguimos abrir o documento agora. Tente de novo.' })

  const baixar = getQuery(event).modo === 'baixar'
  const nomeArquivo = doc.nome.replace(/[^\p{L}\p{N} ._-]/gu, '').trim() || 'documento'
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', (baixar ? 'attachment' : 'inline') + '; filename*=UTF-8\'\'' + encodeURIComponent(nomeArquivo + '.pdf'))
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return Buffer.from(resposta._data)
})
