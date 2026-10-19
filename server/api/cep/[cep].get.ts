/** Endereço de um CEP (rua, bairro, cidade e estado) para preencher o formulário de alteração. Só para quem está logado. */
export default defineEventHandler(async (event) => {
  await exigirUsuario(event)
  const cep = String(getRouterParam(event, 'cep') ?? '').replace(/\D/g, '')
  if (cep.length !== 8) throw createError({ statusCode: 400, message: 'O CEP tem 8 números.' })
  const endereco = await enderecoDoCep(cep)
  if (!endereco) throw createError({ statusCode: 404, message: 'Não encontramos esse CEP. Confira os números.' })
  return endereco
})
