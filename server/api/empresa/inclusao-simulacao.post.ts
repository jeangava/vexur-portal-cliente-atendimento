/** Valor da família hoje e com a pessoa que vai entrar (tabela de preço do Vexur). */
export default defineEventHandler(async (event) => {
  const usuario = await exigirArea(event, 'movimentacao')
  const corpo = await readBody<Record<string, unknown>>(event)
  const t = (v: unknown, max = 120) => String(v ?? '').slice(0, max)
  return simularInclusaoEmpresa(usuario, {
    titularId: t(corpo?.titularId), parentesco: t(corpo?.parentesco), nome: t(corpo?.nome), sexo: t(corpo?.sexo, 20),
    estadoCivil: t(corpo?.estadoCivil, 30), nascimento: t(corpo?.nascimento, 10),
  })
})
