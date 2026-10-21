/** Parentescos que podem ser incluídos pela Movimentação e os documentos de cada um (regra de aceitação de beneficiário). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  return parentescosDaInclusao(usuario)
})
