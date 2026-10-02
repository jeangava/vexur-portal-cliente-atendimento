/** O cliente fechou o popup: não mostra de novo até o próximo login. */
export default defineEventHandler(async (event) => {
  await exigirArea(event, 'comunicados')
  const sessao = await usarSessao(event)
  await sessao.update({ vigentesVistos: true })
  return { ok: true }
})
