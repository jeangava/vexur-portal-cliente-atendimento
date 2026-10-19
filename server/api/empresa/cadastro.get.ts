/** Dados da empresa para o responsável (só leitura). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'empresa')
  return obterCadastroDaEmpresa(usuario)
})
