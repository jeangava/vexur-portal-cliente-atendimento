import { randomUUID } from 'node:crypto'

/**
 * Documentos gerados nos Serviços. O navegador nunca recebe o endereço do arquivo: recebe um código
 * que só vale para quem gerou (mesmo login) e por pouco tempo. O servidor busca o PDF e entrega.
 * Fica em memória do servidor (some ao reiniciar; o cliente simplesmente gera de novo).
 */
interface Guardado { url: string, nome: string, login: string, expira: number }

const VALIDADE_MS = 30 * 60 * 1000
const MAXIMO = 500
const guardados = new Map<string, Guardado>()

function limpar() {
  const agora = Date.now()
  for (const [k, v] of guardados) if (v.expira < agora) guardados.delete(k)
  while (guardados.size > MAXIMO) guardados.delete(guardados.keys().next().value as string)
}

export function guardarDocumentoGerado(url: string, nome: string, login: string): string {
  limpar()
  const id = randomUUID()
  guardados.set(id, { url, nome, login, expira: Date.now() + VALIDADE_MS })
  return id
}

export function obterDocumentoGuardado(id: string, login: string): { url: string, nome: string } | undefined {
  limpar()
  const g = guardados.get(id)
  return g && g.login === login ? { url: g.url, nome: g.nome } : undefined
}
