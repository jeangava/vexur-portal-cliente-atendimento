import type { DadosExclusao } from '#shared/types/portal'

export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const corpo = await readBody<Partial<DadosExclusao>>(event)
  return pedirExclusao(usuario, {
    beneficiario: String(corpo?.beneficiario ?? ''),
    motivo: String(corpo?.motivo ?? ''),
    quando: String(corpo?.quando ?? ''),
    aceite: corpo?.aceite === true,
  })
})
