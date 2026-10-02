export default defineEventHandler(async (event) => {
  const sessao = await usarSessao(event)
  await sessao.clear()
  return { ok: true }
})
