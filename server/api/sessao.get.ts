export default defineEventHandler(async (event) => {
  const sessao = await usarSessao(event)
  // Sessão de uma versão antiga do portal (sem a lista de planos): pede para entrar de novo.
  if (sessao.data.usuario && (!sessao.data.contratos || !sessao.data.usuario.acesso)) {
    await sessao.clear()
    return { usuario: null, trocarSenha: false }
  }
  return { usuario: sessao.data.usuario ?? null, trocarSenha: !!sessao.data.trocarSenha }
})
