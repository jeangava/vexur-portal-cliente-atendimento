/** Antes dos dados da pessoa: é inclusão por evento (RN, RC, RT)? Dentro do prazo? Vai pedir declaração de saúde? */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const corpo = await readBody<Record<string, unknown>>(event)
  const t = (v: unknown, max = 60) => String(v ?? '').slice(0, max)
  return avaliarInclusaoDeDependente(usuario, {
    titularId: t(corpo?.titularId), parentesco: t(corpo?.parentesco), evento: corpo?.evento === true, dataEvento: t(corpo?.dataEvento, 10),
  })
})
