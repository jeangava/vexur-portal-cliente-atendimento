/** Passo 1 da senha nova: recebe o CPF e devolve os meios de contato do cadastro, mascarados. */
export default defineEventHandler(async (event) => {
  const corpo = await readBody<{ cpf?: string }>(event)
  const cpf = somenteDigitos(corpo?.cpf ?? '')
  const problema = problemaNoCpf(cpf)
  if (problema) throw createError({ statusCode: 400, message: problema })

  const contatos = await listarContatos(cpf)
  if (!contatos.length) {
    throw createError({ statusCode: 404, message: 'Não achamos um celular ou e-mail no seu cadastro. Fale com a gente para atualizar.' })
  }

  const sessao = await usarSessao(event)
  await sessao.update({ cpfRecuperacao: cpf })
  return { contatos }
})
