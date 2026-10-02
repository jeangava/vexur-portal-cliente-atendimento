import type { LinhaInclusaoEmpresa } from '#shared/types/portal'

/** Incluir uma pessoa no plano da empresa (mesma conferência da planilha). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const corpo = await readBody<Partial<LinhaInclusaoEmpresa>>(event)
  const texto = (v: unknown) => String(v ?? '').slice(0, 200)
  return incluirPessoaEmpresa(usuario, {
    nome: texto(corpo?.nome), cpf: texto(corpo?.cpf), nascimento: texto(corpo?.nascimento),
    parentesco: texto(corpo?.parentesco), cpfTitular: texto(corpo?.cpfTitular), plano: texto(corpo?.plano),
  })
})
