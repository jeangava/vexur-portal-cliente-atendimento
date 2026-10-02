export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'contas')
  return listarFaturas(usuario)
})
