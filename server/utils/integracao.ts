import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FLUXO_DA_ALTERACAO } from '#shared/utils/fluxosAlteracao'
import type { SimulacaoInclusao } from '#shared/types/portal'
import type { ProtocoloBruto } from '#shared/utils/protocolos'
import type { PlanoAnterior } from '#shared/utils/planoAnterior'
import { parentescosDaMovimentacao, type ParentescoAceito, type RegraDeAceitacaoBruta } from '#shared/utils/aceitacaoBeneficiario'
import type { ContratoDaSessao } from './gateway'
import type { BeneficiarioBruto, CobrancaBruta, ComunicacaoBruta, ComunicadoEnviadoBruto, ContratoBruto, LoginBruto, LoginPortalBruto, TitularPmeBruto } from './mapeamento'
import type { ContratoCliente } from '#shared/types/portal'
import type { RotaDoServico } from './servicosRotas'
import type { LinhaDaRegraServicosOnline } from '#shared/utils/regraServicosOnline'
import type { EnderecoDoCep } from '#shared/types/portal'

/**
 * Chamadas reais ao gateway Vexur — fase 1 (leitura): login, família, contas e extrato.
 * Toda chamada usa as credenciais da SESSÃO e o contrato gravado no login: o navegador
 * nunca escolhe o contrato. Isso fecha o buraco dos serviços que só validam o token
 * e não o dono do contrato (ex.: obterLancamentosPorContrato).
 */

export interface LoginNoGateway {
  pessoa: { nome: string, primeiroNome: string }
  contratos: ContratoCliente[]
  gateway: { token: string, login: string, contratos: Record<string, ContratoDaSessao> }
}

/**
 * Login do legado: POST /login só com o CPF (formato 000.000.000-00, igual ao portal antigo).
 * O backend ainda não tem CPF + senha; por isso só roda com NUXT_LOGIN_SOMENTE_CPF=true.
 */
export async function loginNoGateway(cpf: string): Promise<LoginNoGateway | null> {
  if (String(useRuntimeConfig().loginSomenteCpf) !== 'true') {
    throw createError({
      statusCode: 501,
      message: 'O login com senha ainda não existe no sistema. Para testar, ligue NUXT_LOGIN_SOMENTE_CPF=true (a senha não é conferida).',
    })
  }
  const cpfFormatado = formatarCpf(cpf)
  const leve = await loginLeve(cpfFormatado)
  const resultado = leve !== undefined ? leve : await loginCompleto(cpfFormatado)
  if (!resultado) return null
  if (import.meta.dev) acrescentarEmpresasDeTeste(resultado.mapeado, cpfFormatado)
  return {
    pessoa: resultado.mapeado.pessoa,
    contratos: resultado.mapeado.contratos.map(c => c.cliente),
    gateway: {
      token: resultado.token,
      login: cpfFormatado,
      contratos: Object.fromEntries(resultado.mapeado.contratos.map(c => [c.cliente.id, c.gateway])),
    },
  }
}

/**
 * SÓ EM DESENVOLVIMENTO: enquanto o /login/portal não está publicado na homologação, o login antigo não mostra
 * algumas empresas do responsável. O arquivo .data/empresas-teste.json (fora do git) lista, por CPF, as empresas
 * a acrescentar como "representante". Nunca roda em produção.
 */
function acrescentarEmpresasDeTeste(mapeado: NonNullable<ReturnType<typeof mapearLoginPortal>>, cpfFormatado: string) {
  const arquivo = join(process.cwd(), '.data', 'empresas-teste.json')
  if (!existsSync(arquivo)) return
  type EmpresaDeTeste = { numero: string, idContratoConveniado: number, empresa?: string, inicioVigencia?: string, numeroContratoAdesaoGrupo?: string }
  let lista: EmpresaDeTeste[] = []
  try {
    lista = (JSON.parse(readFileSync(arquivo, 'utf8')) as Record<string, EmpresaDeTeste[]>)[cpfFormatado.replace(/\D/g, '')] ?? []
  } catch { return }
  for (const e of lista) {
    if (mapeado.contratos.some(c => c.cliente.papel === 'representante' && c.cliente.numero === e.numero)) continue
    mapeado.contratos.push({
      cliente: {
        id: `c${mapeado.contratos.length + 1}`,
        numero: e.numero,
        tipo: 'empresarial',
        papel: 'representante',
        situacao: 'ativo',
        plano: 'Plano da empresa',
        empresa: e.empresa,
        contratoEmpresa: e.numero,
        inicioVigencia: e.inicioVigencia ?? '',
      },
      gateway: { idContratoAdesao: 0, idContratoConveniado: e.idContratoConveniado, numeroContrato: e.numero, tipoContratacao: 'EMPRESARIAL', numeroContratoAdesaoGrupo: e.numeroContratoAdesaoGrupo },
    })
  }
}

type ResultadoLoginGateway = { token: string, mapeado: NonNullable<ReturnType<typeof mapearLoginPortal>> } | null

/** Enquanto o /login/portal não está publicado, evita tentar a rota a cada login. */
let loginLeveIndisponivelAte = 0

/**
 * Login leve (POST /login/portal, PR #28 do api-vexur-operacao-recepcao-proposta-adesao):
 * só a lista de contratos, rápido inclusive para responsável de PME.
 * undefined = rota ainda não existe (usar o /login antigo); null = CPF sem contrato.
 */
async function loginLeve(cpfFormatado: string): Promise<ResultadoLoginGateway | undefined> {
  if (Date.now() < loginLeveIndisponivelAte) return undefined
  try {
    const resposta = await chamarGateway<LoginPortalBruto>({
      servico: 'api-vexur-operacao-recepcao-proposta-adesao',
      caminho: '/login/portal',
      metodo: 'POST',
      corpo: { cpfTitular: cpfFormatado },
    })
    const mapeado = mapearLoginPortal(resposta)
    return mapeado ? { token: String(resposta.token), mapeado } : null
  } catch (erro) {
    if (ehRotaInexistente(erro)) {
      loginLeveIndisponivelAte = Date.now() + 10 * 60_000
      return undefined
    }
    if ((erro as { statusCode?: number }).statusCode === 404) return null
    throw erro
  }
}

/** Login antigo (POST /login): carrega tudo de uma vez; lento para responsável de PME. */
async function loginCompleto(cpfFormatado: string): Promise<ResultadoLoginGateway> {
  const resposta = await chamarGateway<LoginBruto>({
    servico: 'api-vexur-operacao-recepcao-proposta-adesao',
    caminho: '/login',
    metodo: 'POST',
    corpo: { cpfTitular: cpfFormatado },
    // Com muitos contratos o login do legado chega a passar de 20 s.
    tempoLimiteMs: 60_000,
  }).catch((erro: { statusCode?: number }) => {
    if (erro.statusCode === 401 || erro.statusCode === 404) return null
    throw erro
  })
  if (!resposta) return null
  if (import.meta.dev) {
    // Só formato e contagens (nunca valores), para entender o que o legado manda ao responsável de PME.
    const propostas = resposta.propostaAdesao ?? []
    const digitos = cpfFormatado.replace(/\D/g, '')
    const conv = propostas.map(p => p.conveniado).filter(c => c && typeof c === 'object') as Record<string, unknown>[]
    console.info(JSON.stringify({
      origem: 'diagnostico-login',
      propostas: propostas.length,
      numerosDistintos: new Set(propostas.map(p => String(p.numeroContrato))).size,
      comTitularDoCpf: propostas.filter(p => (p.proponentes ?? []).some(x => ehTitular(x.parentesco) && String(x.cpf ?? '').replace(/\D/g, '') === digitos)).length,
      proponentesSemCpf: propostas.flatMap(p => p.proponentes ?? []).filter(x => !x.cpf).length,
      tiposConveniado: [...new Set(propostas.map(p => p.conveniado === null ? 'null' : typeof p.conveniado))],
      camposConveniado: [...new Set(conv.flatMap(c => Object.keys(c)))].sort(),
      camposConveniadoInterno: [...new Set(conv.flatMap(c => c.conveniado && typeof c.conveniado === 'object' ? Object.keys(c.conveniado) : []))].sort(),
      camposProposta: [...new Set(propostas.flatMap(p => Object.keys(p)))].sort(),
    }))
  }
  const mapeado = mapearLogin(resposta, new Date(), cpfFormatado)
  return mapeado ? { token: String(resposta.token), mapeado } : null
}

async function credenciais() {
  return acessoDaSessao(useEvent())
}

/**
 * Só em desenvolvimento: registra os NOMES dos campos que o sistema mandou (nunca os valores),
 * para descobrir o que mais dá para mostrar no portal sem expor dados de clientes.
 */
const camposJaRegistrados = new Set<string>()
function registrarCampos(origem: string, objetos: unknown[]) {
  if (!import.meta.dev || camposJaRegistrados.has(origem)) return
  const nomes = new Set<string>()
  for (const o of objetos) if (o && typeof o === 'object') Object.keys(o).forEach(k => nomes.add(k))
  if (!nomes.size) return
  camposJaRegistrados.add(origem)
  console.info(JSON.stringify({ origem: 'campos-recebidos', de: origem, campos: [...nomes].sort() }))
}

/**
 * Em qual "caixa" estão os comunicados da sessão: o titular tem a do próprio contrato; o responsável pela
 * empresa tem a do GRUPO (o que foi enviado à empresa). Assim cada um vê só o que foi para ele.
 */
const grupoDaEmpresa = new Map<number, string>()
async function numeroDosComunicados(contrato: ContratoDaSessao): Promise<string> {
  if (!contratoDaSessaoEhDaEmpresa(contrato)) return contrato.numeroContrato
  const chave = contrato.idContratoConveniado ?? 0
  const guardado = chave ? grupoDaEmpresa.get(chave) : undefined
  if (guardado) return guardado
  const entrada = contrato.numeroContratoAdesaoGrupo ?? await contratoDoGrupoPelasCobrancas(contrato)
  const grupo = entrada ? (await contratoNoGateway(entrada)).numeroContratoGrupo : undefined
  if (grupo === undefined || grupo === null || String(grupo).trim() === '') {
    throw createError({ statusCode: 501, message: 'Ainda não conseguimos achar os comunicados desta empresa. Fale com a gente se continuar.' })
  }
  if (chave) grupoDaEmpresa.set(chave, String(grupo))
  return String(grupo)
}

/**
 * Cópias dos comunicados já enviados para QUEM está logado (ver numeroDosComunicados).
 * O número vem SEMPRE da sessão: sem ele o serviço devolveria os comunicados de todos os contratos.
 */
export async function comunicadosEnviadosNoGateway(): Promise<ComunicadoEnviadoBruto[]> {
  const { acesso, contrato } = await credenciais()
  const numeroContrato = await numeroDosComunicados(contrato)
  if (!numeroContrato) throw createError({ statusCode: 400, message: 'Contrato não identificado.' })
  const resposta = await chamarGateway<{ dados?: ComunicadoEnviadoBruto[] | null } | ComunicadoEnviadoBruto[]>({
    servico: 'api-vexur-envio-comunicacao',
    caminho: '/listarComunicacao',
    metodo: 'POST',
    corpo: { numeroContrato },
    acesso,
  })
  const lista = Array.isArray(resposta) ? resposta : resposta?.dados
  registrarCampos('comunicado-enviado', Array.isArray(lista) ? lista : [])
  return Array.isArray(lista) ? lista : []
}

/**
 * Número de contrato que o serviço de comunicados entende: o do beneficiário (ContratoAdesao).
 * O responsável da empresa não tem um; usa um contrato de beneficiário do grupo, como a visão de empresa do sistema.
 */
async function numeroParaComunicacoes(contrato: ContratoDaSessao): Promise<string> {
  if (!contratoDaSessaoEhDaEmpresa(contrato)) return contrato.numeroContrato
  const entrada = contrato.numeroContratoAdesaoGrupo ?? await contratoDoGrupoPelasCobrancas(contrato)
  if (!entrada) throw createError({ statusCode: 501, message: 'Ainda não conseguimos achar os serviços desta empresa. Fale com a gente se continuar.' })
  return entrada
}

/**
 * Responsável da empresa: id de um contrato de beneficiário do grupo. Os serviços de cobrança tratam o contrato
 * como empresarial e devolvem o documento da EMPRESA inteira (extrato, quitação, anual, IR), não o dessa pessoa.
 */
const idEntradaDoGrupo = new Map<number, number>()
export async function idContratoDeEntradaDaEmpresa(): Promise<number> {
  const { contrato } = await credenciais()
  if (!contratoDaSessaoEhDaEmpresa(contrato)) throw createError({ statusCode: 403, message: 'Só o responsável pela empresa pode fazer isso.' })
  const chave = contrato.idContratoConveniado ?? 0
  if (chave && idEntradaDoGrupo.has(chave)) return idEntradaDoGrupo.get(chave)!
  const id = Number((await contratoNoGateway(await numeroParaComunicacoes(contrato))).id)
  if (!id) throw createError({ statusCode: 501, message: 'Ainda não conseguimos gerar os documentos desta empresa. Fale com a gente se continuar.' })
  if (chave) idEntradaDoGrupo.set(chave, id)
  return id
}

/**
 * Regra "Serviços online" que vale para o produto principal do contrato (a regra sobe pela árvore de produtos:
 * produto, contrato, conveniado, fornecedor). Só leitura. Sem produto ou sem regra: lista vazia.
 */
export async function regraServicosOnlineNoGateway(contratoDoAlvo?: ContratoBruto): Promise<LinhaDaRegraServicosOnline[]> {
  const { acesso, contrato } = await credenciais()
  // Responsável: vale o produto da família escolhida (já conferida pela empresa); senão, o contrato de entrada do grupo.
  const bruto = contratoDoAlvo
    ?? await contratoNoGateway(contratoDaSessaoEhDaEmpresa(contrato) ? await numeroParaComunicacoes(contrato) : contrato.numeroContrato)
  const titular = (bruto.beneficiarios ?? []).find(b => ehTitular(b.parentesco))
  const idProdutoFornecedor = Number(produtoPrincipal(titular?.produto ?? [])?.idProdutoFornecedor)
  if (!idProdutoFornecedor) return []
  const resposta = await chamarGateway<unknown>({
    servico: 'api-vexur-regra-servicos-online',
    caminho: '/obterRegraProduto',
    metodo: 'POST',
    corpo: { filtros: { idProdutoFornecedor } },
    acesso,
  })
  const linhas = linhasDaRegraServicosOnline(resposta)
  if (import.meta.dev) {
    // Só os textos do cadastro de domínios (ator, local, tipo, atendimento), nunca dados de cliente.
    console.info(JSON.stringify({
      origem: 'diagnostico-regra-servicos-online',
      linhas: linhas.length,
      combinacoes: [...new Set(linhas.map(l => [l.ator, l.local, l.tipo, l.atendimento].join(' | ')))],
    }))
  }
  return linhas
}

/**
 * Endereço oficial de um CEP, pelo serviço de localidades do Vexur (o mesmo das telas de cadastro).
 * Só leitura. CEP que não existe: undefined.
 */
export async function consultarCepNoGateway(cep: string): Promise<EnderecoDoCep | undefined> {
  const { acesso } = await credenciais()
  const r = await chamarGateway<Record<string, unknown> | null>({
    servico: 'api-vexur-localidades',
    caminho: '/consultar-cep/' + encodeURIComponent(cep),
    acesso,
  }).catch((e: { statusCode?: number }) => {
    if (e.statusCode === 404) return null
    throw e
  })
  const t = (v: unknown) => String(v ?? '').trim()
  if (!r || (r as { erro?: unknown }).erro || (!t(r.uf) && !t(r.localidade))) return undefined
  return { logradouro: t(r.logradouro).toUpperCase(), bairro: t(r.bairro).toUpperCase(), municipio: t(r.localidade).toUpperCase(), uf: t(r.uf).toUpperCase() }
}

/**
 * Motivos de cancelamento, do cadastro de domínios do Vexur (o mesmo da tela de cancelamento do sistema atual).
 * Só leitura. Devolve os textos; lista vazia se não houver.
 */
export async function motivosDeCancelamentoNoGateway(): Promise<string[]> {
  const { acesso } = await credenciais()
  const r = await chamarGateway<unknown>({
    servico: 'api-vexur-dominio',
    caminho: '/obterDominio/MotivoCancelamento/' + encodeURIComponent('Alteração cadastral'),
    acesso,
  })
  const itens = Array.isArray(r) ? r : []
  return [...new Set(itens.map((i) => {
    const o = i && typeof i === 'object' ? i as Record<string, unknown> : undefined
    return String(o ? (o.descricao ?? o.nome ?? o.valor ?? o.texto ?? '') : i ?? '').trim()
  }).filter(Boolean))]
}

/** Comunicados autorizados para o contrato da sessão (regras de comunicação por produto/contrato). */
export async function comunicacoesNoGateway(): Promise<ComunicacaoBruta[]> {
  const { acesso, contrato } = await credenciais()
  const resposta = await chamarGateway<{ comunicacoes?: ComunicacaoBruta[] | null }>({
    servico: 'api-vexur-regra-venda-comunicacao',
    caminho: '/contrato/obterComunicacoes',
    metodo: 'POST',
    // Sem filtro de tipo: o serviço devolve TODOS os comunicados que a regra do contrato autoriza (igual ao sistema de contratos).
    // No banco o número do contrato é NÚMERO (ex.: 202260726.001); texto não casa e o serviço devolve lista vazia.
    corpo: { numeroContrato: Number(await numeroParaComunicacoes(contrato)) },
    acesso,
  })
  const lista = Array.isArray(resposta?.comunicacoes) ? resposta.comunicacoes : []
  if (import.meta.dev) {
    // Só os TIPOS de comunicado (catálogo, não são dados pessoais).
    console.info(JSON.stringify({ origem: 'diagnostico-comunicados', tipos: [...new Set(lista.map(c => String(c.tipoComunicacao ?? '')))] }))
  }
  return lista
}

/** Resposta do modo "gerar visualização" dos serviços de documento. */
export interface VisualizacaoBruta {
  /** Cada item: o link do PDF e o nome do documento (tipoComunicacao), como o sistema de contratos mostra */
  visualizacaoDocumento?: ({ urlArquivo?: string | null, nomeArquivo?: string | null, tipoComunicacao?: string | null } | string)[] | null
  mensagem?: string | null
  tipoMensagem?: string | null
}

/** Gera o documento (sem enviar e-mail) e devolve o(s) link(s) do PDF. O corpo é montado no servidor. */
export async function gerarDocumentoNoGateway(rota: RotaDoServico, corpo: Record<string, unknown>): Promise<VisualizacaoBruta> {
  const { acesso } = await credenciais()
  return chamarGateway<VisualizacaoBruta>({
    servico: rota.servico,
    caminho: rota.caminho,
    metodo: 'POST',
    corpo,
    acesso,
    tempoLimiteMs: 60_000,
  })
}

/** Anos com pagamento no contrato (base do informe de IR e da quitação anual). Só leitura. */
export async function anosComPagamentoNoGateway(): Promise<number[]> {
  const { acesso, contrato } = await credenciais()
  const resposta = await chamarGateway<{ datasPagamento?: (number | string)[] | null }>({
    servico: 'api-vexur-faturamento-cobranca-admin',
    caminho: '/obter-anos-irpf/' + encodeURIComponent(String(contrato.idContratoAdesao)),
    acesso,
  })
  const anos = (resposta?.datasPagamento ?? []).map(d => Number(String(d).slice(0, 4))).filter(a => a > 1990)
  return [...new Set(anos)].sort((a, b) => b - a)
}

/**
 * Enquanto o login não devolve o contrato de entrada do grupo: as cobranças da empresa trazem o número
 * do contrato de cada pessoa, e qualquer um deles serve de porta de entrada. Guardado em memória por empresa.
 */
const entradaDoGrupo = new Map<number, string>()
async function contratoDoGrupoPelasCobrancas(contrato: ContratoDaSessao): Promise<string | undefined> {
  const chave = contrato.idContratoConveniado ?? 0
  if (chave && entradaDoGrupo.has(chave)) return entradaDoGrupo.get(chave)
  const numero = (await cobrancasNoGateway())
    .flatMap(c => c.lancamentos ?? [])
    .map(l => l.numeroContrato)
    .find(n => n !== null && n !== undefined && String(n).trim() !== '')
  if (numero === undefined || numero === null) return undefined
  if (chave) entradaDoGrupo.set(chave, String(numero))
  return String(numero)
}

/**
 * Titulares da empresa do responsável (uma linha por titular, com a contagem de dependentes).
 * Entrada: um contrato de beneficiário do grupo, guardado na sessão no login (nunca vem da tela).
 */
export async function titularesDaEmpresaNoGateway(): Promise<TitularPmeBruto[]> {
  const { acesso, contrato } = await credenciais()
  if (!contratoDaSessaoEhDaEmpresa(contrato)) throw createError({ statusCode: 403, message: 'Só o responsável pela empresa pode ver a lista da empresa.' })
  const entrada = contrato.numeroContratoAdesaoGrupo ?? await contratoDoGrupoPelasCobrancas(contrato)
  if (!entrada) {
    throw createError({ statusCode: 501, message: 'Ainda não conseguimos listar as pessoas desta empresa. Fale com a gente se continuar.' })
  }
  const resposta = await chamarGateway<unknown>({
    servico: 'api-vexur-operacao-implatancao-contrato-adesao',
    caminho: `/obter-pme/${encodeURIComponent(entrada)}`,
    acesso,
    tempoLimiteMs: 60_000,
  })
  const linhas = linhasDoObterPme(resposta)
  registrarCampos('empresa.pessoaJuridica', linhas.slice(0, 1).map(l => l.pessoaJuridica))
  registrarCampos('empresa.dadosBancarios', linhas.slice(0, 1).flatMap(l => (l.dadosBancarios ?? []) as unknown[]))
  return linhas
}

/**
 * Família de UM titular da empresa. O número vem da tela, então só vale se for de um titular da
 * empresa da sessão (conferido na lista); sem isso, o responsável poderia abrir contratos de outras empresas.
 */
export async function contratoDeTitularDaEmpresaNoGateway(numeroContrato: string): Promise<ContratoBruto> {
  const titulares = await titularesDaEmpresaNoGateway()
  if (!titulares.some(t => String(t.numeroContrato) === numeroContrato)) {
    throw createError({ statusCode: 404, message: 'Não encontramos essa pessoa na sua empresa.' })
  }
  return contratoNoGateway(numeroContrato)
}

/**
 * Parentescos que a regra de aceitação de beneficiário aceita na MOVIMENTAÇÃO CADASTRAL (e os documentos de cada um).
 * A regra vale pelo produto principal do titular (a regra sobe pela árvore de produtos). Só leitura.
 */
export async function parentescosAceitosNoGateway(): Promise<ParentescoAceito[]> {
  const { acesso, contrato } = await credenciais()
  const bruto = await contratoNoGateway(contratoDaSessaoEhDaEmpresa(contrato) ? await numeroParaComunicacoes(contrato) : contrato.numeroContrato)
  const titular = (bruto.beneficiarios ?? []).find(b => ehTitular(b.parentesco))
  const idProdutoFornecedor = Number(produtoPrincipal(titular?.produto ?? [])?.idProdutoFornecedor)
  if (!idProdutoFornecedor) return []
  const resposta = await chamarGateway<RegraDeAceitacaoBruta | RegraDeAceitacaoBruta[] | null>({
    servico: 'api-vexur-regra-venda-aceitacao-beneficiario',
    caminho: '/obterRegraProduto',
    metodo: 'POST',
    corpo: { filtros: { idProdutoFornecedor } },
    acesso,
  })
  const regra = Array.isArray(resposta) ? resposta[0] : resposta
  registrarCampos('regra-aceitacao-beneficiario', [regra])
  const faixas = (regra?.grauRelacionamento ?? []).flatMap(l => l.regraFaixaEtaria ?? [])
  registrarCampos('regra-aceitacao-beneficiario.faixa', faixas)
  if (import.meta.dev) {
    // Só contagens (nunca valores): quantas faixas marcam movimentação cadastral e quantas opções de documento trazem.
    console.info(JSON.stringify({
      origem: 'diagnostico-aceitacao',
      linhas: (regra?.grauRelacionamento ?? []).length,
      faixas: faixas.length,
      tiposDeMovimentacao: [...new Set(faixas.flatMap(f => (Array.isArray(f.dependenteTipoMovimentacao) ? f.dependenteTipoMovimentacao : [f.dependenteTipoMovimentacao])).map(String))],
      faixasComDocumento: faixas.filter(f => (f.dependenteDocumentos ?? []).some(o => (o ?? []).length)).length,
      formaDosDocumentos: [...new Set(faixas.map(f => { const d = (f as Record<string, unknown>).dependenteDocumentos; return Array.isArray(d) ? 'lista(' + d.length + ')' + (d.length && Array.isArray(d[0]) ? 'deListas' : d.length ? typeof d[0] : '') : typeof d }))],
      comTitularDocumentos: faixas.filter(f => { const d = (f as Record<string, unknown>).titularDocumentos; return Array.isArray(d) && d.flat().length > 0 }).length,
      comContributariedade: faixas.filter(f => { const d = (f as Record<string, unknown>).documentoContributariedade; return Array.isArray(d) && d.flat().length > 0 }).length,
      comDownload: faixas.filter(f => { const d = (f as Record<string, unknown>).documentoDownload; return Array.isArray(d) && d.flat().length > 0 }).length,
    }))
  }
  return parentescosDaMovimentacao(regra)
}

/**
 * Protocolos (fluxos abertos) de um contrato, do serviço de gestão de protocolos: é de onde o portal antigo tira
 * o "Acompanhamento de solicitação". Só leitura. O número vai como NÚMERO (o grafo guarda número).
 */
export async function protocolosDoContratoNoGateway(numeroContrato: string): Promise<ProtocoloBruto[]> {
  const { acesso } = await credenciais()
  const numero = Number(numeroContrato)
  if (!Number.isFinite(numero)) return []
  const lista = await chamarGateway<ProtocoloBruto[] | null>({
    servico: 'api-vexur-operacao-gestao-protocolos',
    caminho: '/portal/obterProtocolosPorNumeroContrato',
    metodo: 'POST',
    corpo: { numeroContrato: numero },
    acesso,
  })
  registrarCampos('protocolo', Array.isArray(lista) ? lista : [])
  return Array.isArray(lista) ? lista : []
}

/** Nome de quem entra ou sai, tirado do payload do protocolo (só o nome; o resto do payload não sai do servidor). */
export async function pessoaDoProtocoloNoGateway(idWorkflow: number | string): Promise<string | undefined> {
  const { acesso } = await credenciais()
  const r = await chamarGateway<{ payload?: unknown } | null>({
    servico: 'api-vexur-operacao-gestao-protocolos',
    caminho: '/obterPayload',
    metodo: 'POST',
    corpo: { idWorkflow },
    acesso,
  }).catch(() => null)
  let payload: Record<string, unknown> | undefined
  try { payload = typeof r?.payload === 'string' ? JSON.parse(r.payload) : (r?.payload as Record<string, unknown> | undefined) } catch { return undefined }
  const primeiro = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { nome?: unknown } | undefined
  const nome = primeiro(payload?.proponentes)?.nome ?? primeiro(payload?.beneficiarios)?.nome ?? primeiro(payload?.beneficiario)?.nome
  return typeof nome === 'string' && nome.trim() ? nome.trim() : undefined
}

/**
 * Porte da empresa ("PORTE 1", "PORTE 2 ", "PORTE 3" ou "Não se aplica"): campo `contratacaoPorte` do CONTRATO DO
 * FORNECEDOR ao qual o plano do titular pertence (cadastro de contrato fornecedor). Só leitura.
 */
export async function porteDoContratoNoGateway(contrato: ContratoBruto): Promise<string | undefined> {
  const { acesso } = await credenciais()
  const titular = (contrato.beneficiarios ?? []).find(b => ehTitular(b.parentesco))
  const id = Number(produtoPrincipal(titular?.produto ?? [])?.idContratoFornecedor)
  if (!id) return undefined
  const resposta = await chamarGateway<Record<string, unknown> | Record<string, unknown>[] | null>({
    servico: 'api-vexur-checklist-produto',
    caminho: '/obterContratoFornecedor',
    metodo: 'POST',
    corpo: { filtros: [{ id }] },
    acesso,
    tempoLimiteMs: 40_000,
  })
  const cf = Array.isArray(resposta) ? resposta[0] : resposta
  registrarCampos('contrato-fornecedor', [cf])
  // O cadastro devolve a pessoa jurídica com o(s) contrato(s) dentro de contratoDoFornecedor; vale o do plano do titular.
  const interno = cf?.contratoDoFornecedor
  const contratos = (Array.isArray(interno) ? interno : interno ? [interno] : []) as Record<string, unknown>[]
  registrarCampos('contrato-fornecedor.contrato', contratos)
  const doPlano = contratos.find(c => Number(c.id) === id) ?? contratos[0]
  // contratacaoPorte nem sempre está preenchido: sem ele, vale o nome do contrato e a faixa de vidas (porteDoCadastro).
  return porteDoCadastro({ ...cf, ...doPlano })
}

/** Dia do mês em que a vigência do titular começa (01, 10, 15 ou 20): o dependente entra sempre nesse mesmo dia. */
function diaDaVigenciaDoTitular(contrato: ContratoBruto): number | undefined {
  const titular = (contrato.beneficiarios ?? []).find(b => ehTitular(b.parentesco))
  const doTermo = Number(produtoPrincipal(titular?.produto ?? [])?.diaInicioVigencia)
  if (doTermo >= 1 && doTermo <= 31) return doTermo
  const inicio = paraDataIso(titular?.dataInicio)
  const dia = inicio ? Number(inicio.slice(8, 10)) : 0
  return dia >= 1 ? dia : undefined
}

/**
 * Datas de início do plano que o calendário do Vexur libera para o titular, só as que caem no MESMO DIA da vigência
 * dele (o dependente nunca muda o dia de vigência). Só leitura.
 */
export async function iniciosDeVigenciaNoGateway(contrato: ContratoBruto): Promise<{ dia?: number, datas: { iso: string, rotulo: string }[] }> {
  const { acesso } = await credenciais()
  const titular = (contrato.beneficiarios ?? []).find(b => ehTitular(b.parentesco))
  const ids = (titular?.produto ?? []).filter(p => !p.dataFim).map(p => p.idProdutoFornecedor).filter(Boolean)
  if (!ids.length) return { datas: [] }
  const lista = await chamarGateway<Record<string, unknown>[] | null>({
    servico: 'api-vexur-regra-aceitacao-calendario',
    caminho: '/obterInicioVigenciaDisponiveis',
    metodo: 'POST',
    corpo: { idsProdutoFornecedor: ids },
    acesso,
  })
  registrarCampos('calendario.inicio-vigencia', Array.isArray(lista) ? lista : [])
  const dia = diaDaVigenciaDoTitular(contrato)
  const vistas = new Set<string>()
  const datas = (Array.isArray(lista) ? lista : []).flatMap((item) => {
    // O serviço manda a data em milissegundos (dataInicioVigencia) e/ou já formatada (dd/mm/aaaa).
    const bruto = item.dataInicioVigencia ?? item.dataInicio
    const formatada = String(item.dataInicioVigenciaFormatada ?? '')
    const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(formatada) ? formatada.split('/').reverse().join('-') : paraDataIso(bruto as number | string | null)
    if (!iso || vistas.has(iso) || (dia && Number(iso.slice(8, 10)) !== dia)) return []
    vistas.add(iso)
    return [{ iso, rotulo: formatada || iso.split('-').reverse().join('/') }]
  }).sort((a, b) => a.iso.localeCompare(b.iso))
  return { dia, datas }
}

/**
 * Preço de cada plano do titular para o dependente, pela tabela de preço do Vexur (um por plano).
 * undefined = não achou o preço de algum plano.
 */
async function precosDoDependente(
  contrato: ContratoBruto,
  dependente: { parentesco: string, nome: string, sexo: string, estadoCivil: string, nascimentoMs: number },
  inicioMs: number,
): Promise<{ plano: NonNullable<BeneficiarioBruto['produto']>[number], valor: number }[] | undefined> {
  const { acesso } = await credenciais()
  const agora = Date.now()
  const vigente = (fim: unknown) => !fim || Number(fim) > agora
  const titular = (contrato.beneficiarios ?? []).find(b => ehTitular(b.parentesco))
  const planos = (titular?.produto ?? []).filter(p => vigente(p.dataFim))
  const inicio = new Date(inicioMs)
  const competencia = inicio.getFullYear() * 100 + inicio.getMonth() + 1
  const precos: { plano: (typeof planos)[number], valor: number }[] = []
  for (const plano of planos) {
    const resposta = await chamarGateway<{ resultado?: string, valores?: { valorComercial?: number | null } } | null>({
      servico: 'api-vexur-regra-venda-tabela-preco',
      caminho: '/validarRegra',
      metodo: 'POST',
      corpo: {
        parentesco: dependente.parentesco, profissao: undefined, nome: dependente.nome, genero: dependente.sexo,
        estadoCivil: dependente.estadoCivil, idadeFinalUniversitario: null, dataInicio: inicioMs, dataNascimento: dependente.nascimentoMs,
        produtos: [{ ...plano, dataInicio: inicioMs }], validarPreco: false, anoMesCompetencia: String(competencia),
      },
      acesso,
    }).catch(() => null)
    const valor = resposta?.valores?.valorComercial
    if (typeof valor !== 'number') return undefined
    precos.push({ plano, valor })
  }
  return precos
}

/**
 * Inclusão de dependente pelo FLUXO do Vexur: o mesmo "Inclusão de beneficiário no portal" do portal antigo
 * (recepção automática, análise técnica e administrativa manuais, e a inclusão). Grava no sistema: só roda com
 * NUXT_PERMITIR_ESCRITA=true. Por ora sem assinatura, sem PDF e sem documentos, como combinado.
 */
export async function incluirDependenteNoFluxo(
  contrato: ContratoBruto,
  dependente: {
    parentesco: string, nome: string, cpf: string, nascimento: string, sexo: string, estadoCivil: string, nomeMae: string, naoPossuiNomeMae?: boolean,
    naturalidade?: string, rg?: string, orgaoExpedidor?: string, ufRg?: string, pisPasep?: string, cartaoSus: string, declaracaoNascidoVivo?: string,
  },
  inicioIso: string,
  evento?: { data: string },
  planoAnterior?: PlanoAnterior,
  vigenciaNaAprovacao?: boolean,
): Promise<{ protocolo: string }> {
  const { acesso } = await credenciais()
  const titular = (contrato.beneficiarios ?? []).find(b => ehTitular(b.parentesco)) as Record<string, unknown> | undefined
  if (!titular) throw createError({ statusCode: 404, message: 'Não encontramos o titular deste contrato.' })
  const eventoMs = evento ? new Date(evento.data + 'T00:00:00-03:00').getTime() : undefined
  const inicioMs = new Date(inicioIso + 'T00:00:00-03:00').getTime()
  const nascimentoMs = new Date(dependente.nascimento + 'T00:00:00-03:00').getTime()
  if (Number.isNaN(inicioMs) || Number.isNaN(nascimentoMs)) throw createError({ statusCode: 400, message: 'A data de início ou de nascimento não está certa.' })

  const precos = await precosDoDependente(contrato, { parentesco: dependente.parentesco, nome: dependente.nome, sexo: dependente.sexo, estadoCivil: dependente.estadoCivil, nascimentoMs }, inicioMs)
  if (!precos) throw createError({ statusCode: 422, message: 'Não encontramos o preço desse plano na tabela. Fale com a gente para confirmar o valor.' })

  const proponente = {
    nome: dependente.nome, cpf: dependente.cpf, dataNascimento: nascimentoMs, sexo: dependente.sexo, estadoCivil: dependente.estadoCivil,
    parentesco: dependente.parentesco, nomeMae: dependente.naoPossuiNomeMae ? '' : dependente.nomeMae, naoPossuiNomeMae: !!dependente.naoPossuiNomeMae,
    naturalidade: dependente.naturalidade || undefined, Rg: dependente.rg || undefined, orgaoRg: dependente.orgaoExpedidor || undefined,
    UnidadeFederativaRg: dependente.ufRg || undefined, pisPasep: dependente.pisPasep || undefined,
    cartaoNacionaoSaude: dependente.cartaoSus, declaracaoNascidoVivo: dependente.declaracaoNascidoVivo || undefined,
    dataInicio: inicioMs,
    // Inclusão por evento (recém-nascido, recém-casado, recém-tutelado): a data do evento vai junto, como no CRM.
    dataEvento: eventoMs,
    // Plano de saúde anterior (inclusão comum), com os mesmos nomes de campo do CRM.
    possuiPlanoAtualmente: !!planoAnterior,
    modalidadePlanoAnterior: planoAnterior?.tipo,
    operadoraAnterior: planoAnterior?.operadora,
    planoAnterior: planoAnterior?.plano,
    tempoPlanoAnterior: planoAnterior ? Number(planoAnterior.tempoMeses) : undefined,
    dataUltimoPagamentoPlanoAtual: planoAnterior ? new Date(planoAnterior.ultimoPagamento + 'T00:00:00-03:00').getTime() : undefined,
    // Os mesmos planos do titular, cada um com o preço da tabela para o dependente.
    produto: precos.map(p => ({ ...p.plano, dataInicio: inicioMs, valorVenda: p.valor })),
  }
  const aberto = await chamarGateway<{ workflow?: { protocolo?: string } } | null>({
    servico: 'api-vexur-workflow-process',
    caminho: '/iniciar-processo',
    metodo: 'POST',
    corpo: {
      processo: 'Inclusão de beneficiário no portal',
      // O número do contrato no TOPO é o que o serviço de protocolos usa para achar o pedido em Meus pedidos.
      numeroContrato: Number(contrato.numeroContrato),
      protocolo: null,
      agendamento: null,
      contexto: { tipo: 'ContratoAdesao', id: contrato.id },
      payload: {
        numeroContrato: contrato.numeroContrato,
        idContratoAdesao: contrato.id,
        titular,
        tipoProduto: (contrato as { tipoProduto?: string }).tipoProduto,
        tipoContratacao: contrato.tipoContratacao,
        vigenciaEscolhida: { dataInicioVigencia: inicioMs, dataInicioVigenciaFormatada: inicioIso.split('-').reverse().join('/') },
        inclusaoRecem: !!eventoMs,
        // Evento: o plano começa na aprovação da inclusão; a data de início enviada é só a de hoje, provisória.
        vigenciaNaAprovacao: !!vigenciaNaAprovacao,
        proponentes: [proponente],
        regrasAceitacao: [{ tipoParametroRegra: 'ACEITAÇÃO DE BENEFICIÁRIO', mensagem: {}, dataValidacao: null, resultado: 'PENDENTE', proponente, documentacao: [] }],
      },
    },
    acesso,
    escrita: true,
  })
  const protocolo = String(aberto?.workflow?.protocolo ?? '').trim()
  if (!protocolo) throw createError({ statusCode: 502, message: 'O sistema recebeu o pedido, mas não devolveu o protocolo. Confira em Meus pedidos antes de tentar de novo.' })
  return { protocolo }
}

/**
 * Quanto a família paga hoje (soma dos planos ativos de cada pessoa) e, se vier a pessoa que vai entrar, quanto ela custa
 * pela TABELA DE PREÇO do Vexur (mesmo cálculo do portal antigo: um por plano do titular, pela idade e parentesco).
 * Só leitura. O contrato é o do titular escolhido, já conferido contra a empresa.
 */
export async function simularInclusaoNoGateway(
  contrato: ContratoBruto,
  dependente?: { parentesco: string, nome: string, sexo: string, estadoCivil: string, nascimento: string },
): Promise<SimulacaoInclusao> {
  const { acesso } = await credenciais()
  const agora = Date.now()
  const vigente = (fim: unknown) => !fim || Number(fim) > agora || (typeof fim === 'string' && Number.isNaN(Number(fim)) && Date.parse(fim) > agora)
  const ativos = (contrato.beneficiarios ?? []).filter(b => vigente(b.dataFim))
  const somaDe = (b: { produto?: { valorVenda?: number | null, dataFim?: unknown }[] | null }) =>
    (b.produto ?? []).filter(p => vigente(p.dataFim)).reduce((n, p) => n + Number(p.valorVenda ?? 0), 0)
  const pessoas = ativos.map(b => ({ nome: String(b.nome ?? '').trim(), parentesco: parentescoLegivel(b.parentesco), valor: somaDe(b) }))
  const total = pessoas.reduce((n, p) => n + p.valor, 0)
  const resultado: SimulacaoInclusao = { familia: { pessoas, total } }
  if (!dependente) return resultado

  const inicio = new Date(); inicio.setHours(0, 0, 0, 0)
  const nascimento = new Date(dependente.nascimento + 'T00:00:00-03:00').getTime()
  if (Number.isNaN(nascimento)) return { ...resultado, aviso: 'Ainda não dá para simular o valor.' }
  const precos = await precosDoDependente(contrato, { parentesco: dependente.parentesco, nome: dependente.nome, sexo: dependente.sexo, estadoCivil: dependente.estadoCivil, nascimentoMs: nascimento }, inicio.getTime())
  if (!precos?.length) return { ...resultado, aviso: 'Não encontramos o preço desse plano na tabela. Fale com a gente para confirmar o valor.' }
  const produtos = precos.map(p => ({ nome: String(p.plano.nomeAmigavelProduto ?? p.plano.nomePlano ?? 'Plano'), valor: p.valor }))
  const valor = produtos.reduce((n, p) => n + p.valor, 0)
  return { ...resultado, dependente: { valor, produtos }, novoTotal: total + valor, diferenca: valor }
}

/**
 * Alteração de e-mail pelo FLUXO do Vexur (o mesmo "Alteração de e-mail" da tela do portal antigo):
 * 1) o serviço de alteração cadastral valida a regra; 2) abre o processo no workflow, que aplica na hora.
 * Grava no sistema: só roda com NUXT_PERMITIR_ESCRITA=true. O contrato vem do servidor, nunca do navegador.
 */
export async function alterarEmailNoFluxo(contrato: ContratoBruto, novoEmail: string): Promise<{ protocolo: string }> {
  const { acesso } = await credenciais()
  const fluxo = FLUXO_DA_ALTERACAO.email
  const titular = (contrato.beneficiarios ?? []).find(b => ehTitular(b.parentesco)) as Record<string, unknown> | undefined
  if (!titular) throw createError({ statusCode: 404, message: 'Não encontramos o titular deste contrato.' })
  const numeroContrato = String(contrato.numeroContrato)
  const meios = (contrato.meiosContatos ?? []) as Record<string, unknown>[]
  const atual = meios.find(m => String(m.tipo ?? '').toLowerCase() === 'e-mail') ?? {}
  const novo: Record<string, unknown> = { ...atual, tipo: 'e-mail', endereco: novoEmail }
  const nascimento = String(titular.dataNascimento ?? '')
  const beneficiario = {
    ...titular,
    dataNascimento_: nascimento.includes('/') ? Date.parse(`${nascimento.split('/').reverse().join('-')} 00:00:00 GMT-0300`) : titular.dataNascimento,
  }
  const regra: Record<string, unknown> = {
    tipoParametroRegra: fluxo.tipoParametroRegra,
    resultado: 'PENDENTE',
    tipoDadoAlterado: 'E-mail',
    nomeCampoSistemico: 'endereco',
    beneficiario,
    identificador: fluxo.tipoParametroRegra + numeroContrato,
    dados: { dadoAtual: atual.endereco, dadoNovo: novoEmail, id: novo.id, detalheDados: novo },
  }

  // 1) Regra de alteração cadastral (só confere; não grava).
  const validacao = await chamarGateway<Record<string, unknown> | null>({
    servico: 'api-vexur-regra-movimentacao-alteracao-cadastral',
    caminho: '/email/validarRegra',
    metodo: 'POST',
    corpo: {
      dataReferencia: Date.now(),
      tipoParametroRegra: fluxo.tipoParametroRegra,
      tipoDadoAlterado: regra.tipoDadoAlterado,
      beneficiario,
      dados: novo,
      responsavelFinanceiro: beneficiario,
      responsavelLegal: beneficiario,
      titular,
      numeroContrato,
      idContratoAdesao: contrato.id,
    },
    acesso,
  })
  registrarCampos('alteracao.validarRegra', [validacao])
  if (String(validacao?.resultado ?? '').toUpperCase() === 'FALHA') {
    throw createError({ statusCode: 422, message: 'O sistema não aceitou essa alteração de e-mail. Fale com a gente.' })
  }
  Object.assign(regra, validacao ?? {}, { tipoParametroRegra: fluxo.tipoParametroRegra })

  // 2) Abre o processo no workflow (o protocolo nasce aqui).
  const aberto = await chamarGateway<{ workflow?: { protocolo?: string } } | null>({
    servico: 'api-vexur-workflow-process',
    caminho: '/iniciar-processo',
    metodo: 'POST',
    corpo: {
      processo: fluxo.processo,
      numeroContrato: Number(numeroContrato),
      agendamento: null,
      contexto: { tipo: fluxo.contexto, id: contrato.id },
      payload: {
        numeroContrato,
        regrasMovimentacao: [regra],
        meiosContatosManutencao: [novo],
        historicoAlteracao: [{ tipoDadoAlterado: 'E-mail', dadoAtual: atual.endereco, dadoNovo: novoEmail }],
      },
    },
    acesso,
    escrita: true,
  })
  const protocolo = String(aberto?.workflow?.protocolo ?? '').trim()
  if (!protocolo) throw createError({ statusCode: 502, message: 'O sistema recebeu o pedido, mas não devolveu o protocolo. Confira em Meus pedidos antes de tentar de novo.' })
  return { protocolo }
}

export async function contratoNoGateway(numeroContrato?: string): Promise<ContratoBruto> {
  const { acesso, contrato } = await credenciais()
  const resposta = await chamarGateway<ContratoBruto>({
    servico: 'api-vexur-operacao-implatancao-contrato-adesao',
    caminho: `/obter/${encodeURIComponent(numeroContrato ?? contrato.numeroContrato)}`,
    acesso,
  })
  registrarCampos('contrato', [resposta])
  registrarCampos('contrato.beneficiario', resposta?.beneficiarios ?? [])
  registrarCampos('contrato.beneficiario.produto', (resposta?.beneficiarios ?? []).flatMap(b => b.produto ?? []))
  registrarCampos('contrato.meiosContatos', (resposta?.meiosContatos ?? []))
  registrarCampos('contrato.dadosBancarios', (resposta?.dadosBancarios ?? []))
  registrarCampos('contrato.responsavelFinanceiro', [resposta?.responsavelFinanceiro])
  registrarCampos('contrato.responsavelLegal', [resposta?.responsavelLegal])
  if (import.meta.dev) {
    // Só o parentesco e se há data de fim (sem nome, CPF ou datas) — para entender quem é o titular.
    console.info(JSON.stringify({
      origem: 'diagnostico-familia',
      pessoas: (resposta?.beneficiarios ?? []).map(b => ({ parentesco: b.parentesco ?? null, temDataFim: !!b.dataFim, produtos: (b.produto ?? []).length })),
      // Características do produto (catálogo, não são dados pessoais)
      produtos: [...new Map((resposta?.beneficiarios ?? []).flatMap(b => b.produto ?? []).map(p => [
        `${p.fatorModeradorProduto}|${p.abrangenciaAtendimentoProduto}|${p.segmentacaoProduto}`,
        { fatorModerador: p.fatorModeradorProduto ?? null, abrangencia: p.abrangenciaAtendimentoProduto ?? null, segmentacao: p.segmentacaoProduto ?? null },
      ])).values()],
    }))
  }
  return resposta
}

/** O contrato da sessão é o da EMPRESA (responsável de PME), não um contrato de beneficiário. */
export function contratoDaSessaoEhDaEmpresa(contrato: { tipoContratacao: string }): boolean {
  return contrato.tipoContratacao === 'EMPRESARIAL'
}

/**
 * Cobranças do contrato da sessão. Pessoa física: pelo contrato de adesão. Responsável de PME:
 * pelo contrato da empresa, que traz as cobranças de todos os beneficiários (um lançamento por pessoa).
 * O contrato vem sempre da sessão, nunca do pedido da tela.
 */
export async function cobrancasNoGateway(): Promise<CobrancaBruta[]> {
  const { acesso, contrato } = await credenciais()
  const daEmpresa = contratoDaSessaoEhDaEmpresa(contrato)
  if (daEmpresa && !contrato.idContratoConveniado) {
    throw createError({ statusCode: 500, message: 'Não identificamos o contrato da empresa. Saia e entre de novo.' })
  }
  const lista = await chamarGateway<CobrancaBruta[]>({
    servico: 'api-vexur-faturamento-extrato-cliente',
    caminho: daEmpresa ? '/obterLancamentosPorContratoConveniado' : '/obterLancamentosPorContrato',
    metodo: 'POST',
    corpo: daEmpresa ? { idContratoConveniado: contrato.idContratoConveniado } : { idContratoAdesao: contrato.idContratoAdesao },
    // A empresa tem muitos lançamentos: dá mais tempo.
    tempoLimiteMs: daEmpresa ? 60_000 : undefined,
    acesso,
  })
  const cobrancas = Array.isArray(lista) ? lista : []
  registrarCampos('cobranca', cobrancas)
  registrarCampos('cobranca.lancamento', cobrancas.flatMap(c => c.lancamentos ?? []))
  return cobrancas
}

/** Código PIX (copia e cola) que já existe para a cobrança. O portal só ENTREGA o que existe; nunca gera. */
export interface PixDaCobranca { emv?: string | null, gerouInfosProcessamento?: boolean }

/** Só leitura. Aceita a resposta direta ou embrulhada em data/array. */
export async function pixDaCobrancaNoGateway(nossoNumero: string): Promise<PixDaCobranca> {
  const { acesso } = await credenciais()
  const resposta = await chamarGateway<PixDaCobranca | { data?: PixDaCobranca } | PixDaCobranca[] | null>({
    servico: 'api-vexur-faturamento-cobranca-gerar',
    caminho: '/verificarCodigoPixGerado',
    metodo: 'POST',
    // No banco o nosso número é um NÚMERO: texto não casa com a cobrança (o serviço responde 500).
    corpo: { nossoNumero: Number.isSafeInteger(Number(nossoNumero)) ? Number(nossoNumero) : nossoNumero },
    acesso,
  })
  const d = (Array.isArray(resposta) ? resposta[0] : resposta) as (PixDaCobranca & { data?: PixDaCobranca }) | null | undefined
  return (d && d.data ? d.data : d) ?? {}
}

/** PDF do boleto da cobrança (do contrato da sessão: adesão ou empresa). O nosso número vem da lista do próprio usuário. */
export async function boletoPdfNoGateway(nossoNumero: string): Promise<Buffer> {
  const { acesso, contrato } = await credenciais()
  const daEmpresa = contratoDaSessaoEhDaEmpresa(contrato)
  const resposta = await chamarGateway<ArrayBuffer>({
    servico: 'api-vexur-faturamento-cobranca-gerar',
    caminho: daEmpresa ? '/gerarBoletoPME' : '/gerarBoleto',
    metodo: 'POST',
    corpo: daEmpresa
      ? { idContratoConveniado: contrato.idContratoConveniado, nossoNumero }
      : { idContratoAdesao: contrato.idContratoAdesao, nossoNumero },
    resposta: 'binario',
    tempoLimiteMs: 60_000,
    acesso,
  })
  return Buffer.from(resposta)
}

export async function cobrancaNoGateway(id: string): Promise<CobrancaBruta> {
  const cobranca = (await cobrancasNoGateway()).find(c => idDaCobranca(c) === id)
  if (!cobranca) throw createError({ statusCode: 404, message: 'Não encontramos essa conta.' })
  return cobranca
}
