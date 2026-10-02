export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'comunicados')
  return listarComunicados(usuario)
})
