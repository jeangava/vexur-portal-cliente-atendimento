/**
 * O que o usuário logado pode alterar e como (na hora ou com aprovação), segundo a regra de serviços online.
 * Responsável pela empresa: ?contrato=<número do contrato do titular> para a regra da família escolhida.
 */
export default defineEventHandler(async (event) => {
  const usuario = await exigirUsuario(event)
  const contrato = String(getQuery(event).contrato ?? '').trim()
  return decisoesDeAlteracao(usuario, /^[0-9.]{1,20}$/.test(contrato) ? contrato : undefined)
})
