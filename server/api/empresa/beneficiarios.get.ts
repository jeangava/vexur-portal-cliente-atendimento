/** Todas as pessoas do plano da empresa (só o responsável). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'familia')
  return beneficiariosEmpresa(usuario)
})
