/** Perguntas da declaração de saúde para o dependente (depende do evento e do parentesco). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const corpo = await readBody<{ evento?: string, parentesco?: string, dataEvento?: string }>(event)
  return declaracaoSaude(usuario, {
    evento: String(corpo?.evento ?? '').slice(0, 5),
    parentesco: String(corpo?.parentesco ?? '').slice(0, 40),
    dataEvento: String(corpo?.dataEvento ?? '').slice(0, 10),
  })
})
