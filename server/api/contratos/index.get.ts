/** Todos os planos do CPF logado, para a tela "Qual plano você quer ver?". */
export default defineEventHandler(async (event) => {
  const sessao = await usarSessao(event)
  const { usuario, contratos } = sessao.data
  if (!usuario || !contratos) throw createError({ statusCode: 401, message: 'Sua sessão terminou. Entre de novo, por favor.' })
  if (sessao.data.trocarSenha) throw createError({ statusCode: 403, message: 'Crie a sua nova senha para continuar.' })
  return { contratos: ordenarContratos(contratos), atual: usuario.contrato?.id ?? null }
})
