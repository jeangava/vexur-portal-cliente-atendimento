import type { CanalEnvio } from '#shared/types/portal'

const MAX_ENVIOS = 3
const JANELA_MS = 15 * 60 * 1000

/** Passo 2 da senha nova (esqueci minha senha / primeiro acesso): envia pelo canal escolhido. */
export default defineEventHandler(async (event) => {
  const sessao = await usarSessao(event)
  const cpf = sessao.data.cpfRecuperacao
  if (!cpf) throw createError({ statusCode: 400, message: 'Comece digitando o seu CPF.' })

  const corpo = await readBody<{ canal?: string }>(event)
  const canal = corpo?.canal
  if (canal !== 'sms' && canal !== 'email') {
    throw createError({ statusCode: 400, message: 'Escolha se quer receber por SMS ou por e-mail.' })
  }

  const agora = Date.now()
  const recentes = (sessao.data.envios ?? []).filter(t => agora - t < JANELA_MS)
  if (recentes.length >= MAX_ENVIOS) {
    throw createError({ statusCode: 429, message: 'Você já pediu várias senhas agora há pouco. Espere 15 minutos e confira o SMS ou o e-mail (inclusive o spam).' })
  }

  const { destino } = await enviarNovaSenha(cpf, canal as CanalEnvio)
  await sessao.update({ envios: [...recentes, agora], tentativasLogin: 0, bloqueadoAte: undefined })
  return { canal, destino }
})
