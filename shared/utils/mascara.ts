/** "maria.silva@email.com" → "ma•••••••••@email.com" (mostra só as 2 primeiras letras e o domínio). */
export function mascararEmail(email: string): string {
  const [usuario = '', dominio = ''] = String(email).trim().split('@')
  if (!usuario || !dominio) return '•••••'
  const visivel = usuario.slice(0, Math.min(2, usuario.length - 1))
  return `${visivel}${'•'.repeat(Math.max(3, usuario.length - visivel.length))}@${dominio}`
}

/** "11987654321" → "(••) •••••-4321" (mostra só os 4 últimos números). */
export function mascararTelefone(telefone: string): string {
  const d = somenteDigitos(telefone)
  if (d.length < 4) return '(••) •••••-••••'
  return `(••) ${d.length >= 11 ? '•••••' : '••••'}-${d.slice(-4)}`
}
