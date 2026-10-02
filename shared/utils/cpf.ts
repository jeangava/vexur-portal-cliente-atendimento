export function somenteDigitos(valor: string): string {
  return String(valor ?? '').replace(/\D/g, '')
}

export function formatarCpf(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Valida os dígitos verificadores do CPF. */
export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const digito = (base: string) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(d.slice(0, 9)) === Number(d[9]) && digito(d.slice(0, 10)) === Number(d[10])
}

/** Mensagem simples para o cliente, ou null quando o CPF está certo. */
export function problemaNoCpf(valor: string): string | null {
  const d = somenteDigitos(valor)
  if (d.length === 0) return 'Digite o seu CPF para continuar.'
  if (d.length !== 11) return `O CPF tem 11 números. Você digitou ${d.length}.`
  if (!cpfValido(d)) return 'Esse CPF não parece certo. Confira os números e tente de novo.'
  return null
}
