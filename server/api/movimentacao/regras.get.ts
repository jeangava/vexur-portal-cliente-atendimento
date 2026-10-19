/** O que o usuário logado pode fazer na Movimentação (incluir e tirar titular ou dependente), segundo a regra de serviços online. */
export default defineEventHandler(async (event) => {
  const usuario = await exigirUsuario(event)
  return decisoesDeMovimentacaoDoAtor(usuario)
})
