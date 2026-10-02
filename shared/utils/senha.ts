export interface RegraSenha {
  texto: string
  ok: boolean
}

/** Regras mostradas ao vivo, com um "certinho" em cada uma que já foi cumprida. */
export function regrasDaSenha(senha: string, cpf = ''): RegraSenha[] {
  const cpfDigitos = somenteDigitos(cpf)
  return [
    { texto: 'Pelo menos 8 letras ou números', ok: senha.length >= 8 },
    { texto: 'Pelo menos uma letra', ok: /\p{L}/u.test(senha) },
    { texto: 'Pelo menos um número', ok: /\d/.test(senha) },
    { texto: 'Diferente do seu CPF', ok: senha.length > 0 && (!cpfDigitos || !senha.includes(cpfDigitos)) },
  ]
}

export function problemaNaNovaSenha(senha: string, confirmacao: string, cpf = ''): string | null {
  if (!senha) return 'Crie a sua nova senha.'
  const faltando = regrasDaSenha(senha, cpf).find(r => !r.ok)
  if (faltando) return `A senha ainda não está pronta: ${faltando.texto.toLowerCase()}.`
  if (senha !== confirmacao) return 'As duas senhas estão diferentes. Digite a mesma senha nos dois campos.'
  return null
}
