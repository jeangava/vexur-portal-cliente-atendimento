/** Contato, endereço e pagamento do contrato do usuário logado (só leitura). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'familia')
  return obterCadastro(usuario)
})
