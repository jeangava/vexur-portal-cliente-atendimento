export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'familia')
  return obterFamilia(usuario)
})
