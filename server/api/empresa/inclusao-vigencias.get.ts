/** Datas de início do plano liberadas pelo calendário para o titular escolhido (mesmo dia da vigência dele). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const titular = String(getQuery(event).titular ?? '').slice(0, 60)
  return vigenciasDaInclusao(usuario, titular)
})
