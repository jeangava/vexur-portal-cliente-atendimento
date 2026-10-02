export default defineEventHandler(async (event) => {
  const sessao = await usarSessao(event)
  const { usuario, cpf } = sessao.data
  if (!usuario || !cpf) throw createError({ statusCode: 401, message: 'Sua sessão terminou. Entre de novo, por favor.' })

  const corpo = await readBody<{ senha?: string, confirmacao?: string }>(event)
  const senha = String(corpo?.senha ?? '')
  const problema = problemaNaNovaSenha(senha, String(corpo?.confirmacao ?? ''), cpf)
  if (problema) throw createError({ statusCode: 400, message: problema })

  await definirSenha(cpf, senha)
  await sessao.update({ trocarSenha: false })
  return { ok: true }
})
