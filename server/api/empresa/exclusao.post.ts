import type { DadosExclusaoEmpresa } from '#shared/types/portal'

/** Tirar várias pessoas do plano da empresa de uma vez. */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const corpo = await readBody<Partial<DadosExclusaoEmpresa>>(event)
  return excluirPessoasEmpresa(usuario, {
    pessoas: Array.isArray(corpo?.pessoas) ? corpo.pessoas.slice(0, 2000).map(String) : [],
    motivo: String(corpo?.motivo ?? ''),
    quando: String(corpo?.quando ?? ''),
    data: String(corpo?.data ?? ''),
    aceite: corpo?.aceite === true,
  })
})
