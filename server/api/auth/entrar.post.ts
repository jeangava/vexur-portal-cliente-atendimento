const MAX_TENTATIVAS = 5
const BLOQUEIO_MS = 10 * 60 * 1000

export default defineEventHandler(async (event) => {
  const corpo = await readBody<{ cpf?: string, senha?: string }>(event)
  const cpf = somenteDigitos(corpo?.cpf ?? '')
  const senha = String(corpo?.senha ?? '')

  const problema = problemaNoCpf(cpf)
  if (problema) throw createError({ statusCode: 400, message: problema })
  if (!senha) throw createError({ statusCode: 400, message: 'Digite a sua senha.' })

  // Proteção simples por sessão; o limite definitivo por CPF precisa existir no backend.
  const sessao = await usarSessao(event)
  if ((sessao.data.bloqueadoAte ?? 0) > Date.now()) {
    throw createError({ statusCode: 429, message: 'Foram muitas tentativas. Espere 10 minutos ou peça uma senha nova.' })
  }

  const resultado = await autenticar(cpf, senha)
  if (!resultado) {
    const tentativas = (sessao.data.tentativasLogin ?? 0) + 1
    const bloquear = tentativas >= MAX_TENTATIVAS
    await sessao.update({
      tentativasLogin: bloquear ? 0 : tentativas,
      bloqueadoAte: bloquear ? Date.now() + BLOQUEIO_MS : undefined,
    })
    const restam = MAX_TENTATIVAS - tentativas
    throw createError({
      statusCode: 401,
      message: bloquear
        ? 'Foram muitas tentativas. Espere 10 minutos ou peça uma senha nova.'
        : `CPF ou senha não conferem. Confira e tente de novo (${restam} ${restam === 1 ? 'tentativa' : 'tentativas'}).`,
    })
  }

  const { pessoa, precisaTrocarSenha, gateway } = resultado
  const contratos = simplificarContratos(resultado.contratos)
  if (!contratos.length) {
    throw createError({ statusCode: 404, message: 'Não encontramos nenhum plano neste CPF. Fale com a gente se precisar.' })
  }
  // Um plano só (ou um único ativo): entra direto. Senão, a tela pergunta qual abrir.
  const contrato = contratoAutomatico(contratos)
  const usuario = usuarioDoContrato(pessoa, contratos, contrato)
  await sessao.update({
    tentativasLogin: 0, bloqueadoAte: undefined, cpf, pessoa, contratos, usuario,
    gateway: gateway ? { ...gateway, contrato: contrato ? gateway.contratos[contrato.id] : undefined } : undefined,
    trocarSenha: precisaTrocarSenha, vigentesVistos: false,
  })
  return { usuario, trocarSenha: precisaTrocarSenha }
})
