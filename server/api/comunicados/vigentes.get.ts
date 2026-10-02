/** Comunicados que devem abrir em popup: vigentes e ainda não vistos neste login. */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'comunicados')
  const sessao = await usarSessao(event)
  if (sessao.data.vigentesVistos) return []
  return listarComunicadosVigentes(usuario)
})
