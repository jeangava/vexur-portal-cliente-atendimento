import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import type { LoginNoGateway } from './integracao'
import type {
  BeneficiariosEmpresa, CampoAlteravel, CampoDoServicoTela, DecisaoDeAlteracao, DecisaoDeMovimentacao, EnderecoDoCep, OpcaoSimples, ResultadoDaAlteracao, TipoDeMovimentacao, ConferenciaPlanilha, DadosExclusao, DadosExclusaoEmpresa, DadosInclusao, CadastroDaEmpresa, CadastroDoContrato, DeclaracaoSaude, DocumentoGerado, FamiliaDaEmpresa,
  LinhaConferida, LinhaInclusaoEmpresa, OpcoesMovimentacao, PainelMovimentacao, PedidoDeAlteracao, PessoaEmpresa, Solicitacao,
} from '#shared/types/portal'
import type { ContextoInclusao } from '#shared/utils/inclusaoEmpresa'
import type { CampoDoServico } from './servicosRotas'
import type { AtorDaAlteracao } from '#shared/utils/regraServicosOnline'
import type { SolicitacaoMock } from './mock'
import type { CanalEnvio, Comunicado, ContatoRecuperacao, ContratoCliente, DisponibilidadeServico, ExtratoFatura, Fatura, MinhaFamilia, PagamentoBoleto, PagamentoPix, UsuarioPortal } from '#shared/types/portal'

/**
 * Ponto único de acesso aos dados do portal: cada função escolhe mock ou gateway real.
 * A integração real fica em integracao.ts (inventário de APIs em docs/) e roda só no
 * servidor — api-keys e credenciais nunca vão para o navegador.
 * Fase 1 ligada: login (legado, só CPF), família, contas, extrato e boleto (linha digitável).
 */
function emModoMock(): boolean {
  return String(useRuntimeConfig().modoMock) !== 'false'
}

function aindaNaoIntegrado(): never {
  throw createError({
    statusCode: 501,
    message: 'Esta parte do portal ainda não está ligada ao sistema. Por enquanto ela só funciona no modo de teste.',
  })
}

export interface ResultadoLogin {
  pessoa: { nome: string, primeiroNome: string }
  /** Todos os contratos do CPF (ativos e cancelados) */
  contratos: ContratoCliente[]
  /** true quando entrou com a senha recebida por e-mail: precisa criar a própria senha. */
  precisaTrocarSenha: boolean
  /** Só no modo real: credenciais do gateway, guardadas na sessão */
  gateway?: LoginNoGateway['gateway']
}

export async function autenticar(cpf: string, senha: string): Promise<ResultadoLogin | null> {
  if (!emModoMock()) {
    const real = await loginNoGateway(cpf)
    return real ? { ...real, precisaTrocarSenha: false } : null
  }
  const contratos = contratosDeTeste(cpf)
  if (senha === SENHA_TEMPORARIA_TESTE) return { pessoa: PESSOA_TESTE, contratos, precisaTrocarSenha: true }
  const senhaValida = senhasCriadasNoMock.get(cpf) ?? SENHA_TESTE
  return senha === senhaValida ? { pessoa: PESSOA_TESTE, contratos, precisaTrocarSenha: false } : null
}

/** Só no modo de teste: CPFs prontos para ver cada situação de contratos. */
export function cenariosDeTeste(): { cpf: string, descricao: string }[] {
  if (!emModoMock()) return []
  return CENARIOS_TESTE.map(c => ({ cpf: formatarCpf(c.cpf), descricao: c.descricao }))
}

/** Id do contrato escolhido; os dados de teste mudam conforme o contrato. */
function idContrato(usuario: UsuarioPortal): string {
  return usuario.contrato?.id ?? ''
}

/** Meios de contato do cadastro para receber a senha nova, já mascarados. */
export async function listarContatos(_cpf: string): Promise<ContatoRecuperacao[]> {
  if (!emModoMock()) aindaNaoIntegrado()
  const contatos: ContatoRecuperacao[] = []
  if (CONTATOS_TESTE.celular) contatos.push({ canal: 'sms', destino: mascararTelefone(CONTATOS_TESTE.celular) })
  if (CONTATOS_TESTE.email) contatos.push({ canal: 'email', destino: mascararEmail(CONTATOS_TESTE.email) })
  return contatos
}

/** Primeiro acesso e "esqueci minha senha": gera uma senha temporária e envia pelo canal escolhido. */
export async function enviarNovaSenha(cpf: string, canal: CanalEnvio): Promise<{ destino: string }> {
  const contato = (await listarContatos(cpf)).find(c => c.canal === canal)
  if (!contato) throw createError({ statusCode: 400, message: 'Esse meio de contato não está no seu cadastro. Escolha outro.' })
  return { destino: contato.destino }
}

export async function definirSenha(cpf: string, novaSenha: string): Promise<void> {
  if (!emModoMock()) aindaNaoIntegrado()
  if (novaSenha === SENHA_TEMPORARIA_TESTE) {
    throw createError({ statusCode: 400, message: 'A senha nova precisa ser diferente da que chegou no e-mail.' })
  }
  senhasCriadasNoMock.set(cpf, novaSenha)
}

/**
 * Comunicado vigente = inadimplência/suspensão cuja mensalidade ainda não teve baixa.
 * Quando a mensalidade é paga, ele deixa de ser vigente sozinho e fica só no histórico.
 */
export async function listarComunicados(usuario: UsuarioPortal): Promise<Comunicado[]> {
  if (!emModoMock()) return mapearComunicados(await comunicadosEnviadosNoGateway())
  const faturas = await listarFaturas(usuario)
  const emAberto = new Set(faturas.filter(f => f.situacao !== 'paga').map(f => f.id))
  return comunicadosDeTeste(faturas, usuario.contrato).map(c => ({
    ...c,
    vigente: c.tipo !== 'informativo' && !!c.faturaId && emAberto.has(c.faturaId),
  }))
}

export async function listarComunicadosVigentes(usuario: UsuarioPortal): Promise<Comunicado[]> {
  return (await listarComunicados(usuario)).filter(c => c.vigente)
}

export async function obterComunicado(usuario: UsuarioPortal, id: string): Promise<Comunicado> {
  const comunicado = (await listarComunicados(usuario)).find(c => c.id === id)
  if (!comunicado) throw createError({ statusCode: 404, message: 'Não encontramos esse comunicado.' })
  return comunicado
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Anos e competências (mês/ano) em que o contrato teve cobrança: as opções dos campos "ano" e "competência". */
async function opcoesDasCobrancas(): Promise<{ anos: string[], competencias: { valor: string, rotulo: string }[] }> {
  const cobrancas = await cobrancasNoGateway().catch(() => [])
  const anoMes = new Set<string>()
  for (const c of cobrancas) {
    const texto = String(c.anoMesCompetencia ?? '').replace(/\D/g, '') || paraDataIso(c.dataVencimento).replace(/-/g, '').slice(0, 6)
    if (/^\d{6}$/.test(texto)) anoMes.add(texto)
  }
  const ordenados = [...anoMes].sort().reverse()
  return {
    anos: [...new Set(ordenados.map(t => t.slice(0, 4)))],
    competencias: ordenados.map(t => ({ valor: t.slice(4) + '/' + t.slice(0, 4), rotulo: MESES[Number(t.slice(4)) - 1] + ' de ' + t.slice(0, 4) })),
  }
}

/**
 * Real: lista os documentos AUTORIZADOS para o contrato (regra de comunicação) e só eles.
 * A carta de tempo de permanência nunca entra. O que o serviço marca como bloqueado agora também fica de fora.
 * Só entram os tipos que o portal sabe gerar (servicosRotas.ts).
 */
async function servicosDoContrato(usuario: UsuarioPortal): Promise<DisponibilidadeServico[]> {
  const comunicacoes = await comunicacoesNoGateway()
  const responsavel = usuario.contrato?.papel === 'representante'
  const aptos = comunicacoes.flatMap((c) => {
    const tipo = String(c.tipoComunicacao ?? '').trim()
    if (!tipo || comunicadoProibido(tipo) || c.bloqueiaEnvio) return []
    const rota = rotaDoServico(tipo)
    if (!rota) return []
    // Responsável: só o que é da empresa ou envolve valores (sempre da empresa inteira). Titular: o que é pessoal.
    if (responsavel ? !(rota.paraEmpresa || rota.valores) : rota.paraEmpresa) return []
    return [{ tipo, rota }]
  })
  const precisaDeOpcoes = aptos.some(a => a.rota.campos.length)
  const opcoes = precisaDeOpcoes ? await opcoesDasCobrancas() : { anos: [], competencias: [] }
  const vistos = new Set<string>()
  const itens: DisponibilidadeServico[] = []
  for (const { tipo, rota } of aptos) {
    const id = idDoServicoDoTipo(tipo)
    if (vistos.has(id)) continue
    vistos.add(id)
    const campos: CampoDoServicoTela[] = rota.campos.map(campo => campo === 'ano'
      ? { id: 'ano' as const, rotulo: 'De qual ano?', opcoes: opcoes.anos.map(a => ({ valor: a, rotulo: a })) }
      : { id: 'competencia' as const, rotulo: 'De qual mês?', opcoes: opcoes.competencias })
    const semOpcao = campos.some(c => !c.opcoes.length)
    itens.push({
      id, disponivel: !semOpcao, titulo: rota.titulo, campos,
      ...(semOpcao ? { motivo: 'Ainda não há dados neste contrato para gerar este documento.' } : {}),
    })
  }
  return itens
}

/** Gera o documento de um serviço do contrato logado e devolve o link do PDF. Não envia e-mail. */
export async function gerarDocumentoDoServico(usuario: UsuarioPortal, id: string, form: Record<string, unknown>): Promise<DocumentoGerado> {
  if (emModoMock()) throw createError({ statusCode: 501, message: 'No ambiente de teste o documento é enviado por e-mail.' })
  const servico = (await servicosDoContrato(usuario)).find(s => s.id === id)
  if (!servico) throw createError({ statusCode: 404, message: 'Esse serviço não está disponível para o seu contrato.' })
  if (!servico.disponivel) throw createError({ statusCode: 409, message: servico.motivo ?? 'Esse serviço não está disponível agora.' })
  // O tipo vem da lista do próprio contrato, nunca da tela: reencontra pelo identificador.
  const tipo = (await comunicacoesNoGateway()).map(c => String(c.tipoComunicacao ?? '').trim()).find(t => t && idDoServicoDoTipo(t) === id)
  const rota = tipo ? rotaDoServico(tipo) : undefined
  if (!tipo || !rota) throw createError({ statusCode: 404, message: 'Esse serviço não está disponível para o seu contrato.' })

  // Só aceita valores que estão nas opções do contrato.
  const escolhidos: Partial<Record<CampoDoServico, string>> = {}
  for (const campo of servico.campos ?? []) {
    const valor = String(form[campo.id] ?? '').trim()
    if (!campo.opcoes.some(o => o.valor === valor)) throw createError({ statusCode: 400, message: 'Escolha ' + (campo.id === 'ano' ? 'o ano' : 'o mês') + ' da lista.' })
    escolhidos[campo.id] = valor
  }

  const { contrato, acesso } = await acessoDaSessao(useEvent())
  // Responsável: o documento é o da EMPRESA (o serviço trata o contrato de entrada do grupo como empresarial).
  const idContratoAdesao = usuario.contrato?.papel === 'representante' && !rota.paraEmpresa
    ? await idContratoDeEntradaDaEmpresa()
    : contrato.idContratoAdesao
  const resposta = await gerarDocumentoNoGateway(rota, rota.corpo({
    tipoComunicacao: tipo,
    idContratoAdesao,
    idContratoConveniado: contrato.idContratoConveniado,
  }, escolhidos))

  const arquivos = (resposta?.visualizacaoDocumento ?? []).flatMap((d, i) => {
    const url = typeof d === 'string' ? d : String(d?.urlArquivo ?? '')
    if (!/^https:\/\//i.test(url)) return []
    // O nome é o do documento no sistema de contratos (ex.: "Aplicativo da operadora"); o título do serviço é só o último recurso.
    const dado = typeof d === 'object' && d ? String(d.tipoComunicacao ?? d.nomeArquivo ?? '').trim() : ''
    const nome = dado ? dado.charAt(0).toUpperCase() + dado.slice(1).toLowerCase() : (rota.titulo + (i ? ' ' + (i + 1) : ''))
    return [{ id: guardarDocumentoGerado(url, nome, acesso.login), nome }]
  })
  if (!arquivos.length) {
    const aviso = String(resposta?.mensagem ?? '').trim()
    throw createError({ statusCode: 422, message: aviso || 'Não há nada para emitir neste caso. Se você acha que deveria haver, fale com a gente.' })
  }
  return { arquivos, aviso: resposta?.tipoMensagem === 'ERRO' ? undefined : (String(resposta?.mensagem ?? '').trim() || undefined) }
}

/** Regras de cada serviço para o usuário logado. */
export async function disponibilidadeDosServicos(usuario: UsuarioPortal): Promise<DisponibilidadeServico[]> {
  if (!emModoMock()) return servicosDoContrato(usuario)
  const faturas = await listarFaturas(usuario)
  // Débito = conta vencida e não paga. Conta que ainda vai vencer não impede a quitação.
  const atrasada = faturas.find(f => f.situacao === 'atrasada')
  const ano = new Date().getFullYear()
  const anosFechados = [ano - 1, ano - 2, ano - 3]

  return SERVICOS.map((s): DisponibilidadeServico => {
    switch (s.id) {
      case 'quitacao-debito':
        return atrasada
          ? { id: s.id, disponivel: false, faturaId: atrasada.id, motivo: `A conta de ${atrasada.mes} está atrasada e precisa ser paga antes.` }
          : { id: s.id, disponivel: true }
      case 'extrato':
        return { id: s.id, disponivel: true, anos: [ano, ...anosFechados] }
      case 'irpf':
      case 'quitacao-anual':
        return { id: s.id, disponivel: true, anos: anosFechados }
      default:
        return { id: s.id, disponivel: true }
    }
  })
}

/** Gera o documento e envia para o e-mail do cadastro. */
export async function solicitarServico(usuario: UsuarioPortal, id: string, ano?: number): Promise<{ destino: string, protocolo: string }> {
  // O pedido gera o documento e dispara e-mail pelo fluxo de comunicados: só liga depois de testar com CPF de teste.
  if (!emModoMock()) {
    throw createError({ statusCode: 501, message: 'O envio de documentos pelo portal ainda não está ligado. Por enquanto, você pode ver quais estão disponíveis.' })
  }
  const servico = buscarServico(id)
  if (!servico) throw createError({ statusCode: 404, message: 'Não encontramos esse serviço.' })
  const regra = (await disponibilidadeDosServicos(usuario)).find(d => d.id === id)
  if (!regra?.disponivel) throw createError({ statusCode: 409, message: regra?.motivo ?? 'Esse serviço não está disponível agora.' })
  if (servico.pedeAno && (!ano || !regra.anos?.includes(ano))) {
    throw createError({ statusCode: 400, message: 'Escolha um dos anos da lista.' })
  }
  const destino = mascararEmail(CONTATOS_TESTE.email)
  const titulo = servico.pedeAno ? `${servico.titulo} ${ano}` : servico.titulo
  const agora = new Date().toISOString()
  // Todo serviço pedido vira um pedido em "Meus pedidos", com cópia do documento para baixar.
  const solicitacao: SolicitacaoMock = {
    contratoId: idContrato(usuario), protocolo: novoProtocolo(), categoria: 'servico', tipo: 'servico', titulo,
    criadaEm: isoDe(new Date()), situacao: 'concluida',
    detalhe: `Enviado para ${destino}.`,
    resultado: `${titulo} enviado para o seu e-mail. Uma cópia fica aqui para baixar.`,
    anexos: [{ id: `${servico.id}-${ano ?? 'unico'}`, nome: `${titulo}.pdf` }],
    historico: [{ quando: agora, texto: 'Pedido feito pelo portal.' }, { quando: agora, texto: 'Documento enviado por e-mail.' }],
  }
  solicitacoesMock.push(solicitacao)
  return { destino, protocolo: solicitacao.protocolo }
}

/**
 * O contrato do beneficiário dá o nome amigável de cada produto; se falhar, vale o nome técnico.
 * O contrato da empresa (responsável de PME) não tem produtos próprios: nada a buscar.
 */
async function nomesDeProdutoDoContrato(usuario: UsuarioPortal) {
  if (usuario.contrato?.papel === 'representante') return nomesDeProduto(null)
  return nomesDeProduto(await contratoNoGateway().catch(() => null))
}

export async function listarFaturas(usuario: UsuarioPortal): Promise<Fatura[]> {
  if (!emModoMock()) {
    const [cobrancas, nomes] = await Promise.all([cobrancasNoGateway(), nomesDeProdutoDoContrato(usuario)])
    return mapearFaturas(cobrancas, new Date(), nomes)
  }
  return faturasDeTeste(String(useRuntimeConfig().mockSituacao), usuario.contrato)
}

export async function obterFatura(usuario: UsuarioPortal, id: string): Promise<Fatura> {
  // A fatura sempre é buscada dentro da lista do próprio usuário logado:
  // um id de outra pessoa simplesmente não é encontrado.
  const fatura = (await listarFaturas(usuario)).find(f => f.id === id)
  if (!fatura) throw createError({ statusCode: 404, message: 'Não encontramos essa conta.' })
  return fatura
}

/** Contato, endereço, pagamento e responsáveis do contrato do usuário logado (só leitura). Pagamento só para quem vê valores. */
export async function obterCadastro(usuario: UsuarioPortal): Promise<CadastroDoContrato> {
  if (emModoMock()) return usuario.acesso.mostrarValores ? CADASTRO_TESTE : { ...CADASTRO_TESTE, pagamento: [] }
  return mapearCadastroDoContrato(await contratoNoGateway(), { pagamento: usuario.acesso.mostrarValores })
}

/** Dados da empresa, do representante, contatos e pagamento (só o responsável pela empresa). */
export async function obterCadastroDaEmpresa(usuario: UsuarioPortal): Promise<CadastroDaEmpresa> {
  exigirRepresentante(usuario)
  if (emModoMock()) return CADASTRO_EMPRESA_TESTE
  const cadastro = mapearCadastroDaEmpresa((await titularesDaEmpresaNoGateway())[0])
  if (!cadastro) throw createError({ statusCode: 404, message: 'Não encontramos os dados da empresa.' })
  return cadastro
}

function atorDe(usuario: UsuarioPortal): AtorDaAlteracao {
  return usuario.contrato?.papel === 'representante' ? 'representante' : 'titular'
}

/** Quem pode pedir alteração: o titular com direito a movimentação, ou o responsável pela empresa. */
function podePedirAlteracao(usuario: UsuarioPortal): boolean {
  return usuario.acesso.areas.includes(atorDe(usuario) === 'representante' ? 'empresa' : 'movimentacao')
}

/**
 * O que o ator logado pode alterar e como, segundo a regra "Serviços online":
 * na hora (Imediato) ou por aprovação da administradora (Sob aprovação). Sem regra, nada é oferecido.
 */
export async function decisoesDeAlteracao(usuario: UsuarioPortal, contratoAlvo?: string): Promise<DecisaoDeAlteracao[]> {
  const ator = atorDe(usuario)
  if (!podePedirAlteracao(usuario)) return decisoesDaRegra(null, ator)
  if (emModoMock()) {
    // O responsável só altera família da própria empresa.
    if (contratoAlvo && !(await beneficiariosEmpresa(usuario)).titulares.some(t => t.id === contratoAlvo)) return decisoesDaRegra(null, ator)
    return decisoesDaRegra(REGRA_SERVICOS_ONLINE_TESTE, ator)
  }
  // Se o serviço da regra não responder, o jeito seguro é não oferecer nada.
  try {
    if (contratoAlvo && ator === 'representante') {
      // A família escolhida é conferida contra a lista da empresa; a regra vale pelo produto dela.
      return decisoesDaRegra(await regraServicosOnlineNoGateway(await contratoDeTitularDaEmpresaNoGateway(contratoAlvo)), ator)
    }
    return decisoesDaRegra(await regraServicosOnlineNoGateway(), ator)
  } catch {
    return decisoesDaRegra(null, ator)
  }
}

/**
 * O que o ator pode fazer na Movimentação (incluir e tirar titular ou dependente), segundo a regra "Serviços online".
 * Sem regra, ou sem direito a movimentação, nada é liberado.
 */
export async function decisoesDeMovimentacaoDoAtor(usuario: UsuarioPortal): Promise<DecisaoDeMovimentacao[]> {
  const ator = atorDe(usuario)
  if (!usuario.acesso.areas.includes('movimentacao')) return decisoesDeMovimentacao(null, ator)
  const regra = emModoMock() ? REGRA_SERVICOS_ONLINE_TESTE : await regraServicosOnlineNoGateway().catch(() => null)
  return decisoesDeMovimentacao(regra, ator)
}

/** Recusa no servidor o que a regra não libera (a tela só esconde). */
async function exigirMovimentacao(usuario: UsuarioPortal, tipo: TipoDeMovimentacao) {
  const decisao = (await decisoesDeMovimentacaoDoAtor(usuario)).find(d => d.tipo === tipo)
  if (!decisao?.disponivel) {
    throw createError({ statusCode: 403, message: 'O seu plano não libera isso por aqui. Fale com a gente.' })
  }
}

/** Endereço oficial do CEP (mock ou serviço de localidades do Vexur). */
export async function enderecoDoCep(cep: string): Promise<EnderecoDoCep | undefined> {
  return emModoMock() ? cepDeTeste(cep) : consultarCepNoGateway(cep)
}

/** Pessoas do grupo familiar que podem ter os dados alterados: o próprio grupo do titular, ou a família escolhida pelo responsável. */
async function pessoasDoGrupoParaAlteracao(usuario: UsuarioPortal, contratoAlvo?: string): Promise<{ id: string, nome: string }[]> {
  if (atorDe(usuario) === 'representante') {
    if (!contratoAlvo) return []
    const f = await familiaDoTitularDaEmpresa(usuario, contratoAlvo)
    return [f.titular, ...f.dependentes].map(p => ({ id: p.id, nome: p.nome }))
  }
  const f = await obterFamilia(usuario)
  return [f.titular, ...f.dependentes].map(p => ({ id: p.id, nome: p.nome }))
}

/**
 * Pedido de alteração de dados. A regra decide:
 * - Imediato: o dado muda na hora, e o pedido já nasce concluído (fica registrado em Meus pedidos).
 * - Sob aprovação: o dado NÃO muda; abre um pedido para a administradora avaliar (em análise, ou pendente se pedir documento).
 * No sistema real, os dois caminhos abrem o protocolo/fluxo no Vexur (ainda não ligado: precisa do fluxo de trabalho).
 */
export async function pedirAlteracaoCadastral(usuario: UsuarioPortal, dados: Partial<PedidoDeAlteracao>): Promise<ResultadoDaAlteracao> {
  const campo = String(dados.campo ?? '')
  const problema = problemaNaAlteracao(campo, dados.valores ?? {})
  if (problema) throw createError({ statusCode: 400, message: problema })
  if (!podePedirAlteracao(usuario)) throw createError({ statusCode: 403, message: 'Você não pode alterar dados por aqui. Fale com a gente.' })
  const contratoAlvo = atorDe(usuario) === 'representante' ? String(dados.contrato ?? '').trim() || undefined : undefined
  const decisao = (await decisoesDeAlteracao(usuario, contratoAlvo)).find(d => d.campo === campo)
  if (!decisao?.disponivel) throw createError({ statusCode: 403, message: 'Esse dado não pode ser alterado por aqui. Fale com a gente.' })
  // Documento que a regra pede: tem que vir anexado junto com o pedido (um por documento exigido).
  const documentosNomes: string[] = []
  for (const exigido of decisao.documentos) {
    const grupo = (dados.anexos ?? []).find(a => a.documento === exigido)
    const ids = (grupo?.ids ?? []).slice(0, 5)
    if (!ids.length) throw createError({ statusCode: 400, message: 'Anexe o documento: ' + exigido + '.' })
    if (emModoMock() && ids.some(id => !documentosMock.has(id))) throw createError({ statusCode: 400, message: 'Um dos arquivos não foi recebido. Anexe de novo: ' + exigido + '.' })
    if (emModoMock()) documentosNomes.push(exigido + ': ' + ids.map(id => documentosMock.get(id)).join(', '))
  }
  if (!emModoMock()) {
    throw createError({ statusCode: 501, message: 'A alteração de dados pelo portal ainda não está ligada ao sistema. Por enquanto, fale com a gente.' })
  }

  // Responsável: a alteração é da FAMÍLIA escolhida (nome do titular no título); sem família, é a da própria empresa.
  const empresa = atorDe(usuario) === 'representante' && !contratoAlvo
  const familia = contratoAlvo ? (await beneficiariosEmpresa(usuario)).titulares.find(t => t.id === contratoAlvo) : undefined
  // Dados cadastrais: de uma pessoa do grupo (conferida contra o grupo do próprio ator); o nome vai no título.
  let pessoaNome = ''
  if (campo === 'dados') {
    const pessoa = (await pessoasDoGrupoParaAlteracao(usuario, contratoAlvo)).find(p => p.id === String(dados.pessoa ?? ''))
    if (!pessoa) throw createError({ statusCode: 400, message: 'Escolha de qual pessoa são os dados.' })
    pessoaNome = pessoa.nome
  }
  const titulo = tituloDaAlteracao(campo) + (pessoaNome ? ' de ' + pessoaNome : empresa ? ' da empresa' : familia ? ' de ' + familia.nome : '')
  const aberto = solicitacoesMock.some(s => s.contratoId === idContrato(usuario) && s.tipo === 'alteracao-cadastral' && s.titulo === titulo && s.situacao !== 'concluida' && s.situacao !== 'indeferida')
  if (aberto) throw createError({ statusCode: 409, message: 'Já existe um pedido assim aguardando resposta. Acompanhe em Meus pedidos.' })

  let valores = valoresDaAlteracao(campo, dados.valores ?? {})
  // Endereço: rua, bairro, cidade e estado são os do CEP (a tela não é a fonte); só número e complemento são livres.
  if (campo === 'endereco') {
    const oficial = await enderecoDoCep(valores.cep ?? '').catch(() => 'falhou' as const)
    if (oficial === 'falhou') throw createError({ statusCode: 503, message: 'Não conseguimos conferir o CEP agora. Tente de novo em instantes.' })
    if (!oficial) throw createError({ statusCode: 400, message: 'Não encontramos esse CEP. Confira os números.' })
    valores = { ...valores, logradouro: oficial.logradouro || valores.logradouro || '', bairro: oficial.bairro || valores.bairro || '', municipio: oficial.municipio, uf: oficial.uf }
  }
  const agora = new Date().toISOString()
  const base = { contratoId: idContrato(usuario), protocolo: novoProtocolo(), categoria: 'cadastro' as const, tipo: 'alteracao-cadastral' as const, titulo, criadaEm: isoDe(new Date()), anexos: [] }

  if (decisao.atendimento === 'imediato') {
    aplicarAlteracaoNoMock(empresa ? CADASTRO_EMPRESA_TESTE : contratoAlvo ? cadastroDaFamiliaTeste(contratoAlvo) : CADASTRO_TESTE, campo, valores)
    const solicitacao: SolicitacaoMock = {
      ...base, situacao: 'concluida', detalhe: 'A alteração foi feita na hora.',
      resultado: 'Alteração realizada com sucesso. O dado já está atualizado.',
      historico: [
        { quando: agora, texto: 'Pedido feito pelo portal.' },
        ...(documentosNomes.length ? [{ quando: agora, texto: 'Documentos enviados — ' + documentosNomes.join('; ') + '.' }] : []),
        { quando: agora, texto: 'Alteração realizada na hora, conforme a regra do plano.' },
      ],
    }
    solicitacoesMock.push(solicitacao)
    return { pedido: paraCliente(solicitacao), imediata: true }
  }

  const solicitacao: SolicitacaoMock = {
    ...base,
    situacao: 'em-analise',
    detalhe: 'A administradora vai avaliar o pedido. O dado só muda depois da aprovação, e você acompanha por aqui.',
    historico: [
      { quando: agora, texto: 'Pedido enviado pelo portal.' },
      ...(documentosNomes.length ? [{ quando: agora, texto: 'Documentos enviados — ' + documentosNomes.join('; ') + '.' }] : []),
    ],
  }
  solicitacoesMock.push(solicitacao)
  return { pedido: paraCliente(solicitacao), imediata: false }
}

/** Titular e dependentes do contrato do usuário logado, com os produtos de cada um. */
export async function obterFamilia(usuario: UsuarioPortal): Promise<MinhaFamilia> {
  const familia = emModoMock() ? familiaDeTeste(usuario.contrato) : mapearFamilia(await contratoNoGateway())
  if (usuario.acesso.mostrarValores) return familia
  // Titular de plano empresarial: o valor nem sai do servidor.
  const semValores = (p: MinhaFamilia['titular']) => ({ ...p, produtos: p.produtos.map(({ valorMensal: _, ...resto }) => resto) })
  return { titular: semValores(familia.titular), dependentes: familia.dependentes.map(semValores) }
}

// ---------------------------------------------------------------- Movimentação

function isoDe(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
}

function novoProtocolo(): string {
  return `${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`
}

/**
 * No sistema real, o pedido de saída precisa abrir o protocolo no Vexur (fluxo de trabalho, que grava em produção).
 * Enquanto isso não estiver ligado, recusa com clareza em vez de fingir que enviou.
 */
function semProtocoloNoSistemaReal() {
  if (!emModoMock()) {
    throw createError({ statusCode: 501, message: 'O pedido de saída ainda não está ligado ao sistema. Por enquanto, fale com a gente.' })
  }
}

/** Motivos de cancelamento do Vexur; se o cadastro não responder, a lista padrão do portal. */
async function motivosDeSaida(usuario: UsuarioPortal): Promise<OpcaoSimples[]> {
  const padrao = usuario.contrato?.tipo === 'empresarial' ? MOTIVOS_EXCLUSAO_EMPRESA_TESTE : MOTIVOS_EXCLUSAO_TESTE
  if (emModoMock()) return padrao
  const textos = await motivosDeCancelamentoNoGateway().catch(() => [] as string[])
  if (!textos.length) return padrao
  return textos.map(t => ({ id: t, rotulo: t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() }))
}

/** Data de saída: a das opções prontas, ou a que o cliente escolheu (de hoje até um ano). */
function dataDaSaida(opcao: { data: string, escolheData?: boolean }, informada?: string): string {
  if (!opcao.escolheData) return opcao.data
  const dia = String(informada ?? '').trim()
  const hojeIso = isoDe(new Date())
  const limite = isoDe(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(new Date(dia + 'T12:00:00').getTime())) {
    throw createError({ statusCode: 400, message: 'Escolha a data em que a pessoa sai do plano.' })
  }
  if (dia < hojeIso) throw createError({ statusCode: 400, message: 'A data não pode ser antes de hoje.' })
  if (dia > limite) throw createError({ statusCode: 400, message: 'A data precisa ser dentro do próximo ano.' })
  return dia
}

export async function opcoesMovimentacao(usuario: UsuarioPortal): Promise<OpcoesMovimentacao> {
  const real = !emModoMock()
  const hoje = new Date()
  const fimDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  return {
    // Incluir ainda não está ligado ao sistema real: lá essas listas ficam vazias.
    parentescos: real ? [] : PARENTESCOS_TESTE,
    tiposPlanoAnterior: real ? [] : TIPOS_PLANO_ANTERIOR_TESTE,
    motivosExclusao: await motivosDeSaida(usuario),
    quandoExcluir: [
      { id: 'fim-do-mes', rotulo: `No fim deste mês (${formatarData(isoDe(fimDoMes))})`, apoio: 'A pessoa continua com atendimento até lá.', data: isoDe(fimDoMes) },
      { id: 'imediato', rotulo: 'A partir de hoje', apoio: 'O atendimento para já hoje.', data: isoDe(hoje) },
      { id: 'outra-data', rotulo: 'Escolher uma data', apoio: 'Você informa o dia em que a pessoa sai.', data: '', escolheData: true },
    ],
  }
}

/** Todos os pedidos do cliente (área "Meus pedidos"), do mais novo para o mais antigo. */
export async function listarPedidos(usuario: UsuarioPortal): Promise<Solicitacao[]> {
  if (!emModoMock()) aindaNaoIntegrado()
  // Só os pedidos do contrato escolhido.
  return solicitacoesMock
    .filter(s => s.contratoId === idContrato(usuario))
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
    .map(paraCliente)
}

/** Tira os campos internos do mock (contrato, CPFs do lote...) antes de mandar ao navegador. */
function paraCliente(s: SolicitacaoMock): Solicitacao {
  const { contratoId: _c, beneficiarioIds: _b, dataSaida: _d, cpfsLote: _l, ...publico } = s
  return publico
}

/** Movimentação mostra exclusivamente os pedidos de movimentação. */
export async function painelMovimentacao(usuario: UsuarioPortal): Promise<PainelMovimentacao> {
  // O responsável pela empresa usa a lista da empresa (não há "família" para montar aqui): só os pedidos.
  if (atorDe(usuario) === 'representante') {
    return { beneficiarios: [], solicitacoes: (await listarPedidos(usuario)).filter(s => s.categoria === 'movimentacao') }
  }
  const familia = await obterFamilia(usuario)
  const decisoes = await decisoesDeMovimentacaoDoAtor(usuario)
  const libera = (t: TipoDeMovimentacao) => !!decisoes.find(d => d.tipo === t)?.disponivel
  const solicitacoes = (await listarPedidos(usuario)).filter(s => s.categoria === 'movimentacao')
  const pessoas = [familia.titular, ...familia.dependentes]
  return {
    beneficiarios: pessoas.map((p) => {
      const exclusaoEmAndamento = solicitacoes.find(s => s.tipo === 'exclusao' && s.beneficiarioId === p.id && solicitacaoEmAberto(s.situacao))
      return {
        id: p.id, nome: p.nome, parentesco: p.parentesco, titular: p.titular,
        podeExcluir: !exclusaoEmAndamento && libera(p.titular ? 'excluir-titular' : 'excluir-dependente'),
        exclusaoEmAndamento,
      }
    }),
    solicitacoes,
  }
}

/**
 * Declaração de saúde do dependente. A regra real vem por produto/contrato;
 * no mock, recém-nascido incluído em até 30 dias do nascimento é dispensado (a confirmar com a operadora).
 */
export async function declaracaoSaude(
  _usuario: UsuarioPortal,
  contexto: { evento: string, parentesco: string, dataEvento: string },
): Promise<DeclaracaoSaude> {
  if (!emModoMock()) aindaNaoIntegrado()
  const recemNascido = contexto.evento === 'sim' && contexto.parentesco === 'filho'
  if (recemNascido && contexto.dataEvento && diasDesde(contexto.dataEvento) <= DIAS_INCLUSAO_POR_EVENTO) {
    return {
      exigida: false,
      motivoDispensa: `Recém-nascido incluído em até ${DIAS_INCLUSAO_POR_EVENTO} dias do nascimento não precisa preencher a declaração de saúde.`,
      perguntas: [],
    }
  }
  return { exigida: true, perguntas: PERGUNTAS_DPS_TESTE }
}

export async function guardarDocumento(nome: string): Promise<{ id: string, nome: string }> {
  if (!emModoMock()) aindaNaoIntegrado()
  const id = randomUUID()
  documentosMock.set(id, nome)
  return { id, nome }
}

export async function pedirInclusao(usuario: UsuarioPortal, cpfTitular: string, dados: DadosInclusao): Promise<Solicitacao> {
  exigirTitularDaFamilia(usuario)
  await exigirMovimentacao(usuario, 'incluir-dependente')
  const opcoes = await opcoesMovimentacao(usuario)
  // Revalida as etapas 1 e 2 no servidor: a tela nunca é a única barreira.
  const errosEvento = validarEventoInclusao(dados, {
    parentescosEvento: opcoes.parentescos.filter(p => p.evento).map(p => p.id),
    parentescosOutros: opcoes.parentescos.filter(p => p.paraOutros).map(p => p.id),
    tiposPlanoAnterior: opcoes.tiposPlanoAnterior.map(t => t.id),
  })
  const errosPessoa = validarPessoaInclusao(dados)
  const primeiroErro = Object.values({ ...errosEvento, ...errosPessoa })[0]
  if (primeiroErro) throw createError({ statusCode: 400, message: primeiroErro })

  const cpf = somenteDigitos(dados.cpf)
  if (cpf === somenteDigitos(cpfTitular)) {
    throw createError({ statusCode: 400, message: 'Esse é o CPF do titular. Digite o CPF da pessoa que vai entrar.' })
  }
  const familia = await obterFamilia(usuario)
  const nomeNovo = dados.nome.trim().replace(/\s+/g, ' ').toLowerCase()
  if ([familia.titular, ...familia.dependentes].some(p => p.nome.toLowerCase() === nomeNovo)) {
    throw createError({ statusCode: 409, message: 'Essa pessoa já está no seu plano.' })
  }
  const pedidoAberto = solicitacoesMock.find(s => s.tipo === 'inclusao' && solicitacaoEmAberto(s.situacao) && s.pessoa?.toLowerCase() === dados.nome.trim().toLowerCase())
  if (pedidoAberto) throw createError({ statusCode: 409, message: `Já existe um pedido para incluir essa pessoa (protocolo ${pedidoAberto.protocolo}).` })

  if (!dados.documentos.length) throw createError({ statusCode: 400, message: 'Envie pelo menos um documento da pessoa.' })
  if (dados.documentos.some(id => !documentosMock.has(id))) {
    throw createError({ statusCode: 400, message: 'Algum documento não chegou. Envie os documentos de novo.' })
  }
  const dps = await declaracaoSaude(usuario, dados)
  if (dps.exigida) {
    const errosDps = validarDps(dps.perguntas, dados.declaracaoSaude)
    const [idComErro, mensagem] = Object.entries(errosDps)[0] ?? []
    if (idComErro) {
      const pergunta = dps.perguntas.find(p => p.id === idComErro)?.pergunta
      throw createError({ statusCode: 400, message: `Declaração de saúde: "${pergunta}" — ${mensagem}` })
    }
  }
  if (!dados.aceite) throw createError({ statusCode: 400, message: 'Confirme que as informações são verdadeiras para enviar.' })

  const solicitacao: SolicitacaoMock = {
    contratoId: idContrato(usuario), protocolo: novoProtocolo(), categoria: 'movimentacao', tipo: 'inclusao',
    titulo: `Incluir ${dados.nome.trim().replace(/\s+/g, ' ')}`, pessoa: dados.nome.trim().replace(/\s+/g, ' '),
    criadaEm: isoDe(new Date()), situacao: 'em-analise',
    anexos: [], historico: [{ quando: new Date().toISOString(), texto: 'Pedido enviado pelo portal.' }],
    detalhe: 'Vamos conferir os documentos. Você recebe a resposta em até 5 dias úteis.',
  }
  solicitacoesMock.push(solicitacao)
  return paraCliente(solicitacao)
}

/** Inclusão/saída da família é do titular; o responsável pela empresa usa as funções da empresa. */
function exigirTitularDaFamilia(usuario: UsuarioPortal) {
  if (usuario.contrato?.papel === 'representante') {
    throw createError({ statusCode: 403, message: 'Para a empresa, use "Incluir pessoas" ou "Tirar do plano" em Movimentação.' })
  }
}

export async function pedirExclusao(usuario: UsuarioPortal, dados: DadosExclusao): Promise<Solicitacao> {
  exigirTitularDaFamilia(usuario)
  const [painel, opcoes] = await Promise.all([painelMovimentacao(usuario), opcoesMovimentacao(usuario)])
  const pessoa = painel.beneficiarios.find(b => b.id === dados.beneficiario)
  if (!pessoa) throw createError({ statusCode: 400, message: 'Escolha quem vai sair do plano.' })
  await exigirMovimentacao(usuario, pessoa.titular ? 'excluir-titular' : 'excluir-dependente')
  if (pessoa.exclusaoEmAndamento) {
    throw createError({ statusCode: 409, message: `Já existe um pedido de saída para ${pessoa.nome} (protocolo ${pessoa.exclusaoEmAndamento.protocolo}).` })
  }
  if (!opcoes.motivosExclusao.some(m => m.id === dados.motivo)) throw createError({ statusCode: 400, message: 'Escolha o motivo da saída.' })
  const quando = opcoes.quandoExcluir.find(q => q.id === dados.quando)
  if (!quando) throw createError({ statusCode: 400, message: 'Escolha a partir de quando a pessoa sai do plano.' })
  const dataSaida = dataDaSaida(quando, dados.data)
  if (!dados.aceite) throw createError({ statusCode: 400, message: 'Confirme que você entendeu para enviar.' })
  semProtocoloNoSistemaReal()

  const solicitacao: SolicitacaoMock = {
    contratoId: idContrato(usuario), protocolo: novoProtocolo(), categoria: 'movimentacao', tipo: 'exclusao',
    titulo: `Tirar ${pessoa.nome} do plano`, pessoa: pessoa.nome, beneficiarioId: pessoa.id,
    criadaEm: isoDe(new Date()), situacao: 'em-analise',
    anexos: [], historico: [{ quando: new Date().toISOString(), texto: 'Pedido enviado pelo portal.' }],
    detalhe: `${pessoa.nome.split(' ')[0]} sai do plano em ${formatarData(dataSaida)}. A conta muda a partir do mês seguinte.`,
  }
  solicitacoesMock.push(solicitacao)
  return paraCliente(solicitacao)
}

export async function obterSolicitacao(usuario: UsuarioPortal, protocolo: string): Promise<Solicitacao> {
  const solicitacao = (await listarPedidos(usuario)).find(s => s.protocolo === protocolo)
  if (!solicitacao) throw createError({ statusCode: 404, message: 'Não encontramos esse pedido.' })
  return solicitacao
}

/** O cliente responde a uma pendência (hoje: enviando documento). O pedido volta para análise. */
export async function regularizarPendencia(
  usuario: UsuarioPortal,
  protocolo: string,
  resposta: { documentos: string[], mensagem: string },
): Promise<Solicitacao> {
  await obterSolicitacao(usuario, protocolo) // confere que o pedido é do contrato escolhido
  const solicitacao = solicitacoesMock.find(s => s.protocolo === protocolo && s.contratoId === idContrato(usuario))!
  if (solicitacao.situacao !== 'pendente' || !solicitacao.pendencia) {
    throw createError({ statusCode: 409, message: 'Esse pedido não tem nada pendente agora.' })
  }
  if (solicitacao.pendencia.tipo === 'documento' && !resposta.documentos.length) {
    throw createError({ statusCode: 400, message: 'Envie o documento pedido para continuar.' })
  }
  if (resposta.documentos.some(id => !documentosMock.has(id))) {
    throw createError({ statusCode: 400, message: 'Algum documento não chegou. Envie de novo.' })
  }
  if (solicitacao.pendencia.tipo === 'informacao' && resposta.mensagem.trim().length < 3) {
    throw createError({ statusCode: 400, message: 'Escreva a informação pedida para continuar.' })
  }

  const nomes = resposta.documentos.map(id => documentosMock.get(id)).join(', ')
  solicitacao.historico.push({
    quando: new Date().toISOString(),
    texto: nomes ? `Você enviou: ${nomes}.` : 'Você respondeu à pendência.',
  })
  solicitacao.situacao = 'em-analise'
  solicitacao.pendencia = undefined
  solicitacao.detalhe = 'Recebemos o que faltava. Vamos continuar a análise em até 5 dias úteis.'
  return paraCliente(solicitacao)
}

/** PDF mínimo e válido (uma página, texto simples) para os anexos do modo mock. */
function pdfSimples(titulo: string, linhas: string[]): Buffer {
  const escapar = (t: string) => t.replace(/[\\()]/g, m => `\\${m}`)
  const texto = [
    'BT /F1 16 Tf 56 780 Td', `(${escapar(titulo)}) Tj`, '/F1 11 Tf 0 -28 Td',
    ...linhas.flatMap(l => [`(${escapar(l)}) Tj`, '0 -16 Td']), 'ET',
  ].join('\n')
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(texto, 'latin1')} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  let pdf = '%PDF-1.4\n'
  const posicoes: number[] = []
  objetos.forEach((o, i) => {
    posicoes.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const inicioXref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  pdf += posicoes.map(p => `${String(p).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

export async function anexoDaSolicitacao(usuario: UsuarioPortal, protocolo: string, idAnexo: string): Promise<{ nome: string, conteudo: Buffer }> {
  const solicitacao = await obterSolicitacao(usuario, protocolo)
  const anexo = solicitacao.anexos.find(a => a.id === idAnexo)
  if (!anexo) throw createError({ statusCode: 404, message: 'Não encontramos esse arquivo.' })
  const conteudo = pdfSimples(anexo.nome.replace(/\.pdf$/i, ''), [
    `Protocolo: ${solicitacao.protocolo}`,
    `Pessoa: ${solicitacao.pessoa}`,
    `Situação: ${SITUACAO_SOLICITACAO[solicitacao.situacao].rotulo}`,
    solicitacao.resultado ?? '',
    '',
    'Documento de exemplo gerado pelo Portal do Cliente (modo de teste).',
  ])
  return { nome: anexo.nome, conteudo }
}

/** Extrato de cobrança de uma conta do usuário logado. */
export async function obterExtrato(usuario: UsuarioPortal, id: string): Promise<ExtratoFatura> {
  const fatura = await obterFatura(usuario, id)
  const grupos = emModoMock()
    ? DETALHE_TESTE
    : await Promise.all([cobrancaNoGateway(id), nomesDeProdutoDoContrato(usuario)])
      .then(([cobranca, nomes]) => mapearGruposExtrato(cobranca, nomes))
  const total = emModoMock()
    ? Math.round(grupos.reduce((soma, g) => soma + g.subtotal, 0) * 100) / 100
    : fatura.valor

  const observacoes: string[] = []
  if (fatura.situacao === 'atrasada') {
    observacoes.push('Esta conta está vencida. O pagamento após o vencimento pode ter multa e juros, conforme o contrato.')
  }
  if (fatura.situacao !== 'paga') {
    observacoes.push('Você pode pagar por PIX ou boleto no Portal do Cliente, em "Minhas contas".')
  }
  observacoes.push('Documento informativo, emitido pelo Portal do Cliente.')

  return {
    fatura,
    titular: usuario.nome,
    numeroContrato: usuario.numeroContrato,
    plano: usuario.plano,
    grupos,
    total,
    emitidoEm: new Date().toISOString(),
    observacoes,
  }
}

export async function obterPix(usuario: UsuarioPortal, id: string): Promise<PagamentoPix> {
  const fatura = await obterFatura(usuario, id)
  if (fatura.situacao === 'paga') throw createError({ statusCode: 409, message: 'Essa conta já está paga.' })
  if (!emModoMock()) {
    const nossoNumero = String((await cobrancaNoGateway(id)).nossoNumero ?? '').trim()
    if (!nossoNumero) throw createError({ statusCode: 404, message: 'O PIX desta conta ainda não foi gerado. Tente mais tarde.' })
    const estado = await pixDaCobrancaNoGateway(nossoNumero)
    if (estado.emv) {
      const copiaECola = String(estado.emv)
      return { copiaECola, qrCode: await QRCode.toDataURL(copiaECola, { margin: 1, width: 480, color: { dark: '#1d2948', light: '#ffffff' } }) }
    }
    // O portal só entrega o PIX que já existe; não pede a geração de um novo.
    throw createError({ statusCode: 404, message: 'O PIX desta conta ainda não está disponível. Use o boleto, por favor.' })
  }
  const copiaECola = PIX_TESTE
  const qrCode = await QRCode.toDataURL(copiaECola, { margin: 1, width: 480, color: { dark: '#1d2948', light: '#ffffff' } })
  return { copiaECola, qrCode }
}

export async function obterBoleto(usuario: UsuarioPortal, id: string): Promise<PagamentoBoleto> {
  const fatura = await obterFatura(usuario, id)
  if (fatura.situacao === 'paga') throw createError({ statusCode: 409, message: 'Essa conta já está paga.' })
  if (!emModoMock()) {
    const cobranca = await cobrancaNoGateway(id)
    if (!cobranca.linhaDigitavel) throw createError({ statusCode: 404, message: 'O boleto desta conta ainda não foi gerado. Tente mais tarde.' })
    return { linhaDigitavel: cobranca.linhaDigitavel, pdfDisponivel: !!String(cobranca.nossoNumero ?? '').trim() }
  }
  return { linhaDigitavel: LINHA_DIGITAVEL_TESTE, pdfDisponivel: false }
}

/** PDF do boleto de uma conta do usuário logado. A conta é buscada na lista dele; o nosso número nunca vem da tela. */
export async function baixarBoleto(usuario: UsuarioPortal, id: string): Promise<{ nome: string, conteudo: Buffer }> {
  const fatura = await obterFatura(usuario, id)
  if (fatura.situacao === 'paga') throw createError({ statusCode: 409, message: 'Essa conta já está paga.' })
  if (emModoMock()) throw createError({ statusCode: 404, message: 'O PDF do boleto só existe com o sistema ligado.' })
  const nossoNumero = String((await cobrancaNoGateway(id)).nossoNumero ?? '').trim()
  if (!nossoNumero) throw createError({ statusCode: 404, message: 'O boleto desta conta ainda não foi gerado. Tente mais tarde.' })
  return { nome: 'boleto-' + (fatura.vencimento || nossoNumero) + '.pdf', conteudo: await boletoPdfNoGateway(nossoNumero) }
}

// ---------------------------------------------------------------- Empresa (responsável)

function exigirRepresentante(usuario: UsuarioPortal) {
  if (usuario.contrato?.papel !== 'representante') {
    throw createError({ statusCode: 403, message: 'Só o responsável pela empresa pode fazer isso.' })
  }
}

function pedidosDaEmpresa(usuario: UsuarioPortal): SolicitacaoMock[] {
  return solicitacoesMock.filter(s => s.contratoId === idContrato(usuario))
}

/** Família de um titular da empresa (só o responsável). O número do contrato é conferido contra a lista da empresa. */
export async function familiaDoTitularDaEmpresa(usuario: UsuarioPortal, id: string): Promise<FamiliaDaEmpresa> {
  exigirRepresentante(usuario)
  if (!emModoMock()) return mapearFamiliaDaEmpresa(await contratoDeTitularDaEmpresaNoGateway(id))
  const titular = (await beneficiariosEmpresa(usuario)).titulares.find(t => t.id === id)
  if (!titular) throw createError({ statusCode: 404, message: 'Não encontramos essa pessoa na sua empresa.' })
  const { dependentes, totalDependentes: _, ...pessoa } = titular
  return { titular: pessoa, dependentes, cadastro: cadastroDaFamiliaTeste(id) }
}

/** Lista completa da empresa, com quem já tem pedido de saída em andamento. */
export async function beneficiariosEmpresa(usuario: UsuarioPortal): Promise<BeneficiariosEmpresa> {
  exigirRepresentante(usuario)
  // Real: só os titulares (rápido); a família de cada um vem ao abrir (familiaDoTitularDaEmpresa).
  if (!emModoMock()) return mapearTitularesEmpresa(await titularesDaEmpresaNoGateway(), usuario.contrato?.empresa ?? 'empresa')
  const pedidos = pedidosDaEmpresa(usuario).filter(s => solicitacaoEmAberto(s.situacao))
  const saidas = new Map<string, { protocolo: string, data: string }>()
  for (const s of pedidos.filter(p => p.tipo === 'exclusao')) {
    for (const id of s.beneficiarioIds ?? []) saidas.set(id, { protocolo: s.protocolo, data: s.dataSaida ?? '' })
  }
  const comSaida = <T extends PessoaEmpresa>(p: T): T => (saidas.has(p.id) ? { ...p, saida: saidas.get(p.id) } : p)
  const titulares = EMPRESA_TESTE.titulares.map(t => ({ ...comSaida(t), dependentes: t.dependentes.map(comSaida) }))
  const todas = titulares.flatMap(t => [t, ...t.dependentes])
  // O resumo conta só quem está no plano; quem já saiu aparece no filtro "Cancelados".
  const titularesAtivos = titulares.filter(t => t.situacao === 'ativo').length
  const dependentes = todas.filter(p => !p.titular && p.situacao === 'ativo').length
  return {
    empresa: usuario.contrato?.empresa ?? EMPRESA_TESTE.nome,
    resumo: {
      titulares: titularesAtivos, dependentes, vidas: titularesAtivos + dependentes,
      cancelados: todas.filter(p => p.situacao === 'cancelado').length,
      saindo: saidas.size,
      inclusoesEmAnalise: pedidos.filter(p => p.tipo === 'inclusao').reduce((n, p) => n + (p.cpfsLote?.length ?? 1), 0),
    },
    planos: PLANOS_EMPRESA_TESTE,
    parentescos: PARENTESCOS_EMPRESA_TESTE,
    titulares,
  }
}

async function contextoInclusao(usuario: UsuarioPortal): Promise<ContextoInclusao> {
  const empresa = await beneficiariosEmpresa(usuario)
  // Só quem está ativo: quem já saiu do plano pode voltar (e não recebe dependente novo como titular).
  const ativos = empresa.titulares.filter(t => t.situacao === 'ativo')
  const todos = empresa.titulares.flatMap(t => [t, ...t.dependentes]).filter(p => p.situacao === 'ativo')
  // Quem já tem inclusão em análise também conta como "já está": evita pedido duplicado.
  const emAnalise = pedidosDaEmpresa(usuario)
    .filter(s => s.tipo === 'inclusao' && solicitacaoEmAberto(s.situacao))
    .flatMap(s => s.cpfsLote ?? [])
  return {
    cpfsNoPlano: new Set([...todos.map(p => somenteDigitos(p.cpf)), ...emAnalise]),
    titularesNoPlano: new Set(ativos.map(t => somenteDigitos(t.cpf))),
    planos: empresa.planos,
    parentescos: empresa.parentescos,
  }
}

export async function modeloPlanilhaEmpresa(usuario: UsuarioPortal): Promise<Buffer> {
  const empresa = await beneficiariosEmpresa(usuario)
  return gerarModeloPlanilha(empresa.planos, empresa.parentescos)
}

const VALIDADE_CONFERENCIA_MS = 60 * 60 * 1000

/** Confere a planilha e guarda o resultado no servidor; o envio usa só o que foi conferido aqui. */
export async function conferirPlanilhaEmpresa(
  usuario: UsuarioPortal, cpfDono: string, arquivo: string, conteudo: Buffer,
): Promise<ConferenciaPlanilha> {
  exigirRepresentante(usuario)
  const linhas = conferirInclusoes(await lerPlanilha(conteudo), await contextoInclusao(usuario))
  // O que a regra não libera (ex.: incluir titular) vira problema da linha, para a pessoa corrigir antes de enviar.
  const liberado = await decisoesDeMovimentacaoDoAtor(usuario)
  for (const l of linhas) {
    const tipo: TipoDeMovimentacao = l.parentesco === PARENTESCO_TITULAR ? 'incluir-titular' : 'incluir-dependente'
    if (!l.erros.length && !liberado.find(d => d.tipo === tipo)?.disponivel) {
      l.erros.push(tipo === 'incluir-titular' ? 'O seu plano não libera incluir titular por aqui.' : 'O seu plano não libera incluir dependente por aqui.')
    }
  }
  const conferencia: ConferenciaPlanilha = {
    id: randomUUID(), arquivo, linhas,
    prontas: linhas.filter(l => !l.erros.length).length,
    comProblema: linhas.filter(l => l.erros.length).length,
  }
  for (const [id, c] of conferenciasMock) if (Date.now() - c.criadaEm > VALIDADE_CONFERENCIA_MS) conferenciasMock.delete(id)
  conferenciasMock.set(conferencia.id, { dono: `${cpfDono}:${idContrato(usuario)}`, criadaEm: Date.now(), conferencia })
  return conferencia
}

function pedidoDeInclusao(usuario: UsuarioPortal, linhas: LinhaConferida[], origem: string): SolicitacaoMock {
  const um = linhas.length === 1 ? linhas[0]! : undefined
  return {
    contratoId: idContrato(usuario), protocolo: novoProtocolo(), categoria: 'movimentacao', tipo: 'inclusao',
    titulo: um ? `Incluir ${um.nome}` : `Incluir ${linhas.length} pessoas (planilha)`,
    pessoa: um?.nome,
    criadaEm: isoDe(new Date()), situacao: 'em-analise', anexos: [],
    detalhe: 'Vamos conferir os dados. Você recebe a resposta em até 5 dias úteis.',
    historico: [{ quando: new Date().toISOString(), texto: `${origem}.` }],
    pessoasLote: um ? undefined : linhas.map(l => ({ nome: l.nome, parentesco: l.parentesco, situacao: 'em-analise' as const })),
    cpfsLote: linhas.map(l => somenteDigitos(l.cpf)),
  }
}

/** Envia só as linhas sem problema de uma conferência feita por esta mesma pessoa. */
export async function enviarPlanilhaEmpresa(usuario: UsuarioPortal, cpfDono: string, id: string): Promise<Solicitacao> {
  exigirRepresentante(usuario)
  const guardada = conferenciasMock.get(id)
  if (!guardada || guardada.dono !== `${cpfDono}:${idContrato(usuario)}` || Date.now() - guardada.criadaEm > VALIDADE_CONFERENCIA_MS) {
    throw createError({ statusCode: 404, message: 'Essa conferência expirou. Envie a planilha de novo, por favor.' })
  }
  const prontas = guardada.conferencia.linhas.filter(l => !l.erros.length)
  if (!prontas.length) throw createError({ statusCode: 400, message: 'Nenhuma pessoa está pronta para enviar. Corrija a planilha e envie de novo.' })
  const pedido = pedidoDeInclusao(usuario, prontas, `Planilha "${guardada.conferencia.arquivo}" enviada pelo portal (${prontas.length} pessoas)`)
  solicitacoesMock.push(pedido)
  conferenciasMock.delete(id)
  return paraCliente(pedido)
}

/** Uma pessoa pelo formulário: mesma conferência da planilha. */
export async function incluirPessoaEmpresa(usuario: UsuarioPortal, dados: LinhaInclusaoEmpresa): Promise<Solicitacao> {
  exigirRepresentante(usuario)
  const [linha] = conferirInclusoes([{ ...dados, linha: 1 }], await contextoInclusao(usuario))
  if (linha!.erros.length) throw createError({ statusCode: 400, message: linha!.erros[0]! })
  await exigirMovimentacao(usuario, linha!.parentesco === PARENTESCO_TITULAR ? 'incluir-titular' : 'incluir-dependente')
  const pedido = pedidoDeInclusao(usuario, [linha!], 'Pedido enviado pelo portal')
  solicitacoesMock.push(pedido)
  return paraCliente(pedido)
}

/** Tirar várias pessoas de uma vez. Titular marcado leva os dependentes junto. */
export async function excluirPessoasEmpresa(usuario: UsuarioPortal, dados: DadosExclusaoEmpresa): Promise<Solicitacao> {
  const [empresa, opcoes] = await Promise.all([beneficiariosEmpresa(usuario), opcoesMovimentacao(usuario)])
  const marcados = new Set((dados.pessoas ?? []).map(String))
  if (!marcados.size) throw createError({ statusCode: 400, message: 'Marque quem vai sair do plano.' })

  const saindo: PessoaEmpresa[] = []
  const conhecidos = new Set<string>()
  for (const t of empresa.titulares) {
    conhecidos.add(t.id)
    t.dependentes.forEach(d => conhecidos.add(d.id))
    // Titular marcado leva junto só os dependentes que ainda estão no plano.
    if (marcados.has(t.id)) saindo.push(t, ...t.dependentes.filter(d => d.situacao === 'ativo'))
    else saindo.push(...t.dependentes.filter(d => marcados.has(d.id)))
  }
  // Titular marcado exige "excluir titular"; dependente marcado sozinho exige "excluir dependente".
  const decisoesSaida = await decisoesDeMovimentacaoDoAtor(usuario)
  const liberaSaida = (t: TipoDeMovimentacao) => !!decisoesSaida.find(d => d.tipo === t)?.disponivel
  for (const t of empresa.titulares) {
    if (marcados.has(t.id)) { if (!liberaSaida('excluir-titular')) throw createError({ statusCode: 403, message: 'O seu plano não libera tirar titular por aqui. Fale com a gente.' }) }
    else if (t.dependentes.some(d => marcados.has(d.id)) && !liberaSaida('excluir-dependente')) {
      throw createError({ statusCode: 403, message: 'O seu plano não libera tirar dependente por aqui. Fale com a gente.' })
    }
  }
  if ([...marcados].some(id => !conhecidos.has(id))) {
    throw createError({ statusCode: 400, message: 'Alguma pessoa marcada não está no plano. Atualize a página e marque de novo.' })
  }
  const jaSaiu = saindo.find(p => p.situacao === 'cancelado')
  if (jaSaiu) throw createError({ statusCode: 409, message: `${jaSaiu.nome} já saiu do plano em ${formatarData(jaSaiu.fimVigencia ?? '')}.` })
  const jaSaindo = saindo.find(p => p.saida)
  if (jaSaindo) throw createError({ statusCode: 409, message: `${jaSaindo.nome} já tem pedido de saída (protocolo ${jaSaindo.saida!.protocolo}).` })
  if (!opcoes.motivosExclusao.some(m => m.id === dados.motivo)) throw createError({ statusCode: 400, message: 'Escolha o motivo da saída.' })
  const quando = opcoes.quandoExcluir.find(q => q.id === dados.quando)
  if (!quando) throw createError({ statusCode: 400, message: 'Escolha a partir de quando.' })
  const dataSaida = dataDaSaida(quando, dados.data)
  if (!dados.aceite) throw createError({ statusCode: 400, message: 'Confirme que você entendeu para enviar.' })
  semProtocoloNoSistemaReal()

  const um = saindo.length === 1 ? saindo[0] : undefined
  const pedido: SolicitacaoMock = {
    contratoId: idContrato(usuario), protocolo: novoProtocolo(), categoria: 'movimentacao', tipo: 'exclusao',
    titulo: um ? `Tirar ${um.nome} do plano` : `Tirar ${saindo.length} pessoas do plano`,
    pessoa: um?.nome, beneficiarioId: um?.id, beneficiarioIds: saindo.map(p => p.id), dataSaida,
    criadaEm: isoDe(new Date()), situacao: 'em-analise', anexos: [],
    detalhe: `Saída do plano em ${formatarData(dataSaida)}. A conta da empresa muda a partir do mês seguinte.`,
    historico: [{ quando: new Date().toISOString(), texto: 'Pedido enviado pelo portal.' }],
    pessoasLote: um ? undefined : saindo.map(p => ({ nome: p.nome, parentesco: p.parentesco, situacao: 'em-analise' as const })),
  }
  solicitacoesMock.push(pedido)
  return paraCliente(pedido)
}
