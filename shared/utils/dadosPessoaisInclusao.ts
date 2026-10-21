import type { DadosPessoaisInclusao } from '../types/portal'

/**
 * Cadastro de quem entra no plano. Obrigatórios (além de nome, CPF e nascimento, que a conferência da linha já pede):
 * nome da mãe (ou marcar que não possui), sexo, estado civil e cartão nacional de saúde. O resto é opcional.
 */
export function problemaNosDadosPessoais(d: Partial<DadosPessoaisInclusao> | null | undefined): string | null {
  const x = d ?? {}
  if (!String(x.sexo ?? '').trim()) return 'Escolha o sexo.'
  if (!String(x.estadoCivil ?? '').trim()) return 'Escolha o estado civil.'
  if (!x.naoPossuiNomeMae) {
    const mae = String(x.nomeMae ?? '').trim().replace(/\s+/g, ' ')
    if (!mae) return 'Escreva o nome da mãe (ou marque que a pessoa não possui).'
    if (mae.split(' ').length < 2 || /[^\p{L}' -]/u.test(mae)) return 'Escreva o nome completo da mãe, só com letras.'
  }
  const sus = String(x.cartaoSus ?? '').replace(/\D/g, '')
  if (!sus) return 'Falta o número do Cartão Nacional de Saúde.'
  if (sus.length !== 15) return 'O Cartão Nacional de Saúde tem 15 números. Confira.'
  if (x.rg && String(x.rg).replace(/\W/g, '').length > 20) return 'O RG está muito longo. Confira.'
  return null
}

/** Só o que é combinado, limpo, para ir no pedido. */
export function limparDadosPessoais(d: Partial<DadosPessoaisInclusao> | null | undefined): DadosPessoaisInclusao {
  const t = (v: unknown, max = 80) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
  return {
    sexo: t(d?.sexo, 20), estadoCivil: t(d?.estadoCivil, 30),
    nomeMae: d?.naoPossuiNomeMae ? '' : t(d?.nomeMae, 100), naoPossuiNomeMae: !!d?.naoPossuiNomeMae || undefined,
    naturalidade: t(d?.naturalidade), rg: t(d?.rg, 20), orgaoExpedidor: t(d?.orgaoExpedidor, 20), ufRg: t(d?.ufRg, 2).toUpperCase(),
    pisPasep: String(d?.pisPasep ?? '').replace(/\D/g, '').slice(0, 11),
    cartaoSus: String(d?.cartaoSus ?? '').replace(/\D/g, '').slice(0, 15),
    declaracaoNascidoVivo: String(d?.declaracaoNascidoVivo ?? '').replace(/\D/g, '').slice(0, 15),
  }
}
