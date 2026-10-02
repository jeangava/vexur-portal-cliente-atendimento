/** O cliente escolheu um dos planos dele. O servidor só aceita um id da lista da própria sessão. */
export default defineEventHandler(async (event) => {
  const corpo = await readBody<{ id?: string }>(event)
  const usuario = await escolherContratoNaSessao(event, String(corpo?.id ?? ''))
  return { usuario }
})
