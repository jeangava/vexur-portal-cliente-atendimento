export default defineEventHandler(async (event) => {
  const sessao = await usarSessao(event)
  // Sessão de uma versão antiga do portal (sem a lista de planos): pede para entrar de novo.
  if (sessao.data.usuario && (!sessao.data.contratos || !sessao.data.usuario.acesso)) {
    await sessao.clear()
    return { usuario: null, trocarSenha: false }
  }
  const usuario = sessao.data.usuario
  // Regras de acesso recalculadas do contrato: o menu acompanha as regras novas sem precisar entrar de novo.
  return { usuario: usuario ? { ...usuario, acesso: usuario.contrato ? acessoDoContrato(usuario.contrato) : usuario.acesso } : null, trocarSenha: !!sessao.data.trocarSenha }
})
