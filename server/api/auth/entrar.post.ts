const MAX_TENTATIVAS = 5
const BLOQUEIO_MS = 10 * 60 * 1000

export default defineEventHandler(async (event) => {
  const corpo = await readBody<{ cpf?: string, senha?: string }>(event)
  const cpf = somenteDigitos(corpo?.cpf ?? '')
  const senha = String(corpo?.senha ?? '')

  const problema = problemaNoCpf(cpf, { conferirDigitos: conferirDigitosNoAcesso() })
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
    // Sem senha no sistema (ambiente de integração) o único motivo possível é o CPF.
    const motivo = conferirDigitosNoAcesso()
      ? 'CPF ou senha não conferem. Confira e tente de novo'
      : 'Não encontramos nenhum contrato para este CPF. Confira o número e tente de novo'
    throw createError({
      statusCode: 401,
      message: bloquear
        ? 'Foram muitas tentativas. Espere 10 minutos ou peça uma senha nova.'
        : `${motivo} (${restam} ${restam === 1 ? 'tentativa' : 'tentativas'}).`,
    })
  }

  const { pessoa, precisaTrocarSenha, gateway } = resultado
  const contratos = simplificarContratos(resultado.contratos)
  if (!contratos.length) {
    throw createError({ statusCode: 404, message: 'Não encontramos nenhum plano neste CPF. Fale com a gente se precisar.' })
  }
  // Um plano só (ou um único ativo): entra direto. Senão, a tela pergunta qual abrir.
  const contrato = contratoAutomatico(contratos)
  if (import.meta.dev) {
    // Só contagens (nunca CPF, nome ou número de contrato).
    const conta = (lista: typeof contratos, filtro: (c: (typeof contratos)[number]) => boolean) => lista.filter(filtro).length
    console.info(JSON.stringify({
      origem: 'diagnostico-contratos',
      recebidos: resultado.contratos.length,
      aposSimplificar: contratos.length,
      ativos: conta(contratos, c => c.situacao === 'ativo'),
      cancelados: conta(contratos, c => c.situacao === 'cancelado'),
      representante: conta(contratos, c => c.papel === 'representante'),
      empresariaisTitular: conta(contratos, c => c.papel === 'titular' && c.tipo === 'empresarial'),
      entrouDireto: !!contrato,
    }))
  }
  const usuario = usuarioDoContrato(pessoa, contratos, contrato)
  await sessao.update({
    tentativasLogin: 0, bloqueadoAte: undefined, cpf, pessoa, contratos, usuario,
    gateway: gateway ? { ...gateway, contrato: contrato ? gateway.contratos[contrato.id] : undefined } : undefined,
    trocarSenha: precisaTrocarSenha, vigentesVistos: false,
  })
  return { usuario, trocarSenha: precisaTrocarSenha }
})
