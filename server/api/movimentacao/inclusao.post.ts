import type { DadosInclusao } from '#shared/types/portal'

const texto = (v: unknown, max = 120) => String(v ?? '').slice(0, max)

/** Aceita só pares id → texto curto (no máximo 60 respostas). */
function lerRespostasDps(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {}
  const pares = Object.entries(valor as Record<string, unknown>)
    .filter(([id]) => /^[\w.]{1,20}$/.test(id))
    .slice(0, 60)
    .map(([id, resposta]) => [id, texto(resposta, 500)])
  return Object.fromEntries(pares)
}

export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const sessao = await usarSessao(event)
  const corpo = await readBody<Partial<DadosInclusao>>(event)
  const plano = corpo?.planoAnterior
  return pedirInclusao(usuario, sessao.data.cpf ?? '', {
    evento: corpo?.evento === 'sim' || corpo?.evento === 'nao' ? corpo.evento : '',
    dataEvento: texto(corpo?.dataEvento, 10),
    parentesco: texto(corpo?.parentesco, 40),
    temPlanoAnterior: corpo?.temPlanoAnterior === 'sim' || corpo?.temPlanoAnterior === 'nao' ? corpo.temPlanoAnterior : '',
    planoAnterior: {
      tipo: texto(plano?.tipo, 40),
      operadora: texto(plano?.operadora),
      plano: texto(plano?.plano),
      meses: texto(plano?.meses, 5),
      ultimoPagamento: texto(plano?.ultimoPagamento, 10),
    },
    nome: texto(corpo?.nome),
    cpf: texto(corpo?.cpf, 14),
    nascimento: texto(corpo?.nascimento, 10),
    documentos: Array.isArray(corpo?.documentos) ? corpo.documentos.map(String).slice(0, 10) : [],
    declaracaoSaude: lerRespostasDps(corpo?.declaracaoSaude),
    aceite: corpo?.aceite === true,
  })
})
