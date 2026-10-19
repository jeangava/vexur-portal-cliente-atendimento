/** PDF do boleto da conta (só de quem está logado, e só para quem vê contas). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'contas')
  const { nome, conteudo } = await baixarBoleto(usuario, getRouterParam(event, 'id') ?? '')
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', 'attachment; filename="' + nome + '"')
  setHeader(event, 'Cache-Control', 'no-store')
  return conteudo
})
