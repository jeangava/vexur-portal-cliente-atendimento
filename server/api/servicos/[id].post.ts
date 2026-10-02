export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'servicos')
  const corpo = await readBody<{ ano?: number }>(event)
  const ano = corpo?.ano ? Number(corpo.ano) : undefined
  return solicitarServico(usuario, getRouterParam(event, 'id') ?? '', ano)
})
