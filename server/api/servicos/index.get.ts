export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'servicos')
  return disponibilidadeDosServicos(usuario)
})
