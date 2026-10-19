import type { PedidoDeAlteracao } from '#shared/types/portal'

/**
 * Pede a alteração de um dado. A regra "Serviços online" decide se muda na hora ou vai para a administradora aprovar.
 * Titular: contrato dele. Responsável pela empresa: dados da empresa.
 */
export default defineEventHandler(async (event) => {
  const usuario = await exigirUsuario(event)
  const corpo = await readBody<Partial<PedidoDeAlteracao>>(event)
  return pedirAlteracaoCadastral(usuario, {
    campo: corpo?.campo,
    valores: (corpo?.valores ?? {}) as Record<string, string>,
    contrato: /^[0-9.]{1,20}$/.test(String(corpo?.contrato ?? '')) ? String(corpo?.contrato) : undefined,
    pessoa: String(corpo?.pessoa ?? '').slice(0, 40) || undefined,
    anexos: (Array.isArray(corpo?.anexos) ? corpo.anexos : []).slice(0, 10).map(a => ({
      documento: String(a?.documento ?? '').slice(0, 120),
      ids: (Array.isArray(a?.ids) ? a.ids : []).slice(0, 5).map(String),
    })),
  })
})
