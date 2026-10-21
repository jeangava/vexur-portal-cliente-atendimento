import type { LinhaInclusaoEmpresa } from '#shared/types/portal'

/** Incluir uma pessoa no plano da empresa (mesma conferência da planilha). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const corpo = await readBody<Partial<LinhaInclusaoEmpresa> & { anexos?: { documento?: string, ids?: string[] }[] }>(event)
  const texto = (v: unknown) => String(v ?? '').slice(0, 200)
  return incluirPessoaEmpresa(usuario, {
    nome: texto(corpo?.nome), cpf: texto(corpo?.cpf), nascimento: texto(corpo?.nascimento),
    parentesco: texto(corpo?.parentesco), cpfTitular: texto(corpo?.cpfTitular), plano: texto(corpo?.plano),
    titularId: texto(corpo?.titularId), dadosPessoais: limparDadosPessoais(corpo?.dadosPessoais), inicio: texto(corpo?.inicio).slice(0, 10), eventoData: texto(corpo?.eventoData).slice(0, 10),
    planoAnterior: corpo?.planoAnterior ? limparPlanoAnterior(corpo.planoAnterior) : undefined,
  }, (Array.isArray(corpo?.anexos) ? corpo.anexos : []).slice(0, 10).map(a => ({
    documento: texto(a?.documento), ids: (Array.isArray(a?.ids) ? a.ids : []).slice(0, 5).map(i => texto(i)),
  })))
})
