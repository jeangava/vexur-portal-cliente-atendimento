export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  return opcoesMovimentacao(usuario)
})
