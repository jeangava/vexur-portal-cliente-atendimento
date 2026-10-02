const ROTAS_PUBLICAS = ['/entrar', '/entrar/nova-senha']
const CRIAR_SENHA = '/entrar/criar-senha'
const ESCOLHER_PLANO = '/escolher-plano'

export default defineNuxtRouteMiddleware(async (to) => {
  const usuario = useUsuario()
  const trocarSenha = useTrocarSenha()

  if (!usuario.value) {
    try {
      const sessao = await useRequestFetch()('/api/sessao')
      usuario.value = sessao.usuario
      trocarSenha.value = sessao.trocarSenha
    } catch {
      usuario.value = null
    }
  }

  if (!usuario.value) {
    return ROTAS_PUBLICAS.includes(to.path) ? undefined : navigateTo('/entrar')
  }

  // Entrou com a senha do e-mail: só libera o portal depois de criar a própria senha.
  if (trocarSenha.value) {
    return to.path === CRIAR_SENHA ? undefined : navigateTo(CRIAR_SENHA)
  }

  // Mais de um plano e nenhum escolhido ainda: primeiro escolhe.
  if (!usuario.value.contrato) {
    return to.path === ESCOLHER_PLANO ? undefined : navigateTo(ESCOLHER_PLANO)
  }

  if (to.path === ESCOLHER_PLANO) return usuario.value.podeTrocarContrato ? undefined : navigateTo('/inicio')
  if (to.path === '/' || to.path.startsWith('/entrar')) return navigateTo('/inicio')

  // Área que o plano escolhido não tem (ex.: contas no plano da empresa): volta ao início.
  const area = areaDaRota(to.path)
  if (area && !usuario.value.acesso.areas.includes(area)) return navigateTo('/inicio')

  // Movimentação da empresa (lista grande, planilha) é só do responsável; ele não usa a da família.
  const responsavel = usuario.value.contrato.papel === 'representante'
  if (to.path.startsWith('/movimentacao/empresa') && !responsavel) return navigateTo('/movimentacao')
  if (responsavel && ['/movimentacao/incluir', '/movimentacao/excluir'].includes(to.path)) {
    return navigateTo(to.path.replace('/movimentacao/', '/movimentacao/empresa/'))
  }
})
