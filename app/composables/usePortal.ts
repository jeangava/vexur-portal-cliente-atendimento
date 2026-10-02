import type { UsuarioPortal } from '#shared/types/portal'

export function useUsuario() {
  return useState<UsuarioPortal | null>('usuario', () => null)
}

/** true enquanto o usuário entrou com a senha do e-mail e ainda não criou a dele. */
export function useTrocarSenha() {
  return useState<boolean>('trocarSenha', () => false)
}

/** CPF digitado no login, reaproveitado em "esqueci minha senha" (fica só na memória, nunca na URL). */
export function useCpfDigitado() {
  return useState<string>('cpfDigitado', () => '')
}

export function useSair() {
  const usuario = useUsuario()
  const trocarSenha = useTrocarSenha()
  return async () => {
    await $fetch('/api/auth/sair', { method: 'POST' }).catch(() => {})
    usuario.value = null
    trocarSenha.value = false
    // Não deixa dados do plano anterior na memória da tela.
    clearNuxtData()
    await navigateTo('/entrar', { replace: true })
  }
}

/** Aviso curto no rodapé da tela (ex.: "Código copiado"). */
export function useAviso() {
  const texto = useState<string>('aviso', () => '')
  let timer: ReturnType<typeof setTimeout> | undefined
  function mostrar(mensagem: string) {
    texto.value = mensagem
    clearTimeout(timer)
    timer = setTimeout(() => { texto.value = '' }, 3000)
  }
  return { texto, mostrar }
}

/** Extrai a mensagem amigável que o servidor mandou, sem mostrar detalhes técnicos. */
export function mensagemDeErro(erro: unknown, padrao = 'Algo deu errado. Tente de novo em instantes.'): string {
  const e = erro as { data?: { message?: string }, statusCode?: number }
  if (e?.statusCode && e.statusCode >= 500 && e.statusCode !== 501) return padrao
  return e?.data?.message || padrao
}

/** Copia texto; funciona também em http na rede local (onde a Clipboard API é bloqueada). */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch { /* tenta o jeito antigo abaixo */ }
  const area = document.createElement('textarea')
  area.value = texto
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(area)
  return ok
}
