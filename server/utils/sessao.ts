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

/**
 * No acesso (login / senha nova), confere os dígitos do CPF, exceto no ambiente de
 * integração (NUXT_LOGIN_SOMENTE_CPF=true), cuja massa de teste tem CPFs fictícios.
 */
export function conferirDigitosNoAcesso(): boolean {
  return String(useRuntimeConfig().loginSomenteCpf) !== 'true'
}

/**
 * Os planos do CPF e os dados do gateway são grandes: no cookie passariam de 4 KB e o navegador
 * descartaria a sessão (CPF com muitos planos "não entra em nenhum"). Ficam no servidor, ligados
 * ao cookie por um id aleatório; o cookie só guarda o que é pequeno.
 */
const PESADOS = ['contratos', 'gateway'] as const
type SessaoNoCookie = Omit<DadosSessao, 'contratos' | 'gateway'> & { sid?: string }
const COFRE_VALE_MS = 60 * 60 * 1000
type Cofre = Map<string, { dados: Pick<DadosSessao, 'contratos' | 'gateway'>, expira: number }>
// Em globalThis para sobreviver ao recarregamento do servidor em desenvolvimento.
const global = globalThis as { __cofreSessao?: Cofre }
const cofre: Cofre = (global.__cofreSessao ??= new Map())

function limparCofre() {
  const agora = Date.now()
  for (const [id, v] of cofre) if (v.expira < agora) cofre.delete(id)
}

/** Sessão guardada em cookie criptografado e HttpOnly: o navegador não consegue ler. */
export async function usarSessao(event: H3Event) {
  const s = await useSession<SessaoNoCookie>(event, {
    name: 'portal_sessao',
    password: senhaDaSessao(),
    maxAge: 60 * 60,
    cookie: { httpOnly: true, sameSite: 'lax', secure: !import.meta.dev, path: '/' },
  })
  return {
    get data(): DadosSessao {
      const guardado = s.data.sid ? cofre.get(s.data.sid) : undefined
      const { sid: _sid, ...leves } = s.data
      return guardado && guardado.expira > Date.now() ? { ...leves, ...guardado.dados } : leves
    },
    async update(novo: Partial<DadosSessao>) {
      const leves: Partial<SessaoNoCookie> = { ...novo }
      const pesados: Partial<Pick<DadosSessao, 'contratos' | 'gateway'>> = {}
      for (const k of PESADOS) {
        if (k in novo) pesados[k] = novo[k] as never
        delete (leves as Record<string, unknown>)[k]
      }
      if (Object.keys(pesados).length) {
        limparCofre()
        const sid = s.data.sid ?? randomBytes(24).toString('hex')
        const antes = cofre.get(sid)?.dados ?? {}
        cofre.set(sid, { dados: { ...antes, ...pesados }, expira: Date.now() + COFRE_VALE_MS })
        leves.sid = sid
      }
      await s.update(leves)
    },
    async clear() {
      if (s.data.sid) cofre.delete(s.data.sid)
      await s.clear()
    },
  }
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
  // As regras de acesso são sempre recalculadas do contrato: uma regra nova vale na hora, sem entrar de novo.
  const usuario = sessao.data.usuario
  const contrato = usuario.contrato
  return { ...usuario, acesso: contrato ? acessoDoContrato(contrato) : usuario.acesso }
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
