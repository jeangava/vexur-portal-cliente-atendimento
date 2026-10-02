import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { H3Event } from 'h3'
import type { AreaPortal, ContratoCliente, UsuarioPortal } from '#shared/types/portal'
import type { ContratoDaSessao } from './gateway'

export interface DadosSessao {
  tentativasLogin?: number
  bloqueadoAte?: number
  envios?: number[]
  /** CPF que está pedindo senha nova (fica no servidor; o navegador só escolhe o canal). */
  cpfRecuperacao?: string
  cpf?: string
  /** Nome da pessoa do CPF (vale para todos os contratos dela) */
  pessoa?: { nome: string, primeiroNome: string }
  /** Todos os contratos do CPF. O navegador só escolhe um id desta lista. */
  contratos?: ContratoCliente[]
  usuario?: UsuarioPortal
  /** Já viu o popup dos comunicados vigentes neste login (volta a false a cada login). */
  vigentesVistos?: boolean
  /** Só no modo real: token do gateway e o contrato do cliente. Nunca vai para o navegador. */
  gateway?: {
    token: string
    login: string
    /** Contrato escolhido (o que as chamadas usam) */
    contrato?: ContratoDaSessao
    /** Dados do gateway de cada contrato, pelo id de ContratoCliente */
    contratos: Record<string, ContratoDaSessao>
  }
  /** Entrou com a senha do e-mail: só pode criar a senha nova, mais nada. */
  trocarSenha?: boolean
}

let senhaDev: string | undefined

/**
 * Só em desenvolvimento: chave aleatória gravada em .data/ (fora do git), para a sessão
 * não cair a cada recarga do servidor enquanto o código é editado.
 */
function senhaDeDesenvolvimento(): string {
  if (senhaDev) return senhaDev
  const arquivo = join(process.cwd(), '.data', 'sessao-dev.key')
  try {
    const salva = readFileSync(arquivo, 'utf8').trim()
    if (salva.length >= 32) return (senhaDev = salva)
  } catch { /* ainda não existe */ }
  senhaDev = randomBytes(32).toString('hex')
  try {
    mkdirSync(dirname(arquivo), { recursive: true })
    writeFileSync(arquivo, senhaDev, { mode: 0o600 })
  } catch { /* sem disco: vale só até reiniciar */ }
  return senhaDev
}

function senhaDaSessao(): string {
  const { sessionPassword } = useRuntimeConfig()
  if (sessionPassword && sessionPassword.length >= 32) return sessionPassword
  if (!import.meta.dev) {
    throw createError({ statusCode: 500, message: 'NUXT_SESSION_PASSWORD não configurada (mínimo de 32 caracteres).' })
  }
  return senhaDeDesenvolvimento()
}

/** Sessão guardada em cookie criptografado e HttpOnly: o navegador não consegue ler. */
export function usarSessao(event: H3Event) {
  return useSession<DadosSessao>(event, {
    name: 'portal_sessao',
    password: senhaDaSessao(),
    maxAge: 60 * 60,
    cookie: { httpOnly: true, sameSite: 'lax', secure: !import.meta.dev, path: '/' },
  })
}

export async function exigirUsuario(event: H3Event): Promise<UsuarioPortal> {
  const sessao = await usarSessao(event)
  // Sem usuário, ou sessão de uma versão antiga do portal (sem as regras de acesso).
  if (!sessao.data.usuario?.acesso) {
    throw createError({ statusCode: 401, message: 'Sua sessão terminou. Entre de novo, por favor.' })
  }
  if (sessao.data.trocarSenha) {
    throw createError({ statusCode: 403, message: 'Crie a sua nova senha para continuar.' })
  }
  if (!sessao.data.usuario.contrato) {
    throw createError({ statusCode: 403, message: 'Escolha qual plano você quer ver.' })
  }
  return sessao.data.usuario
}

/**
 * Como exigirUsuario, e ainda confere se o contrato escolhido libera essa área.
 * Ex.: titular de plano empresarial não vê contas nem faz movimentação.
 */
export async function exigirArea(event: H3Event, area: AreaPortal): Promise<UsuarioPortal> {
  const usuario = await exigirUsuario(event)
  if (!usuario.acesso.areas.includes(area)) {
    throw createError({ statusCode: 403, message: 'Essa parte do portal não está disponível para este plano.' })
  }
  return usuario
}

/** Grava o contrato escolhido (só um da lista do próprio CPF) e monta o usuário dele. */
export async function escolherContratoNaSessao(event: H3Event, id: string): Promise<UsuarioPortal> {
  const sessao = await usarSessao(event)
  const { pessoa, contratos, gateway } = sessao.data
  if (!sessao.data.usuario || !pessoa || !contratos) {
    throw createError({ statusCode: 401, message: 'Sua sessão terminou. Entre de novo, por favor.' })
  }
  if (sessao.data.trocarSenha) throw createError({ statusCode: 403, message: 'Crie a sua nova senha para continuar.' })
  const contrato = contratos.find(c => c.id === id)
  if (!contrato) throw createError({ statusCode: 404, message: 'Não encontramos esse plano. Escolha um da lista.' })
  const usuario = usuarioDoContrato(pessoa, contratos, contrato)
  await sessao.update({
    usuario,
    gateway: gateway ? { ...gateway, contrato: gateway.contratos[id] } : undefined,
    // Comunicados vigentes são por contrato: o popup volta a aparecer no plano novo.
    vigentesVistos: false,
  })
  return usuario
}
