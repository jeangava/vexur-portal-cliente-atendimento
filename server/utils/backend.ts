import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import type { LoginNoGateway } from './integracao'
import type {
  BeneficiariosEmpresa, ConferenciaPlanilha, DadosExclusao, DadosExclusaoEmpresa, DadosInclusao, DeclaracaoSaude,
  LinhaConferida, LinhaInclusaoEmpresa, OpcoesMovimentacao, PainelMovimentacao, PessoaEmpresa, Solicitacao,
} from '#shared/types/portal'
import type { ContextoInclusao } from '#shared/utils/inclusaoEmpresa'
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
  if (!emModoMock()) aindaNaoIntegrado()
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

/** Regras de cada serviço para o usuário logado. */
export async function disponibilidadeDosServicos(usuario: UsuarioPortal): Promise<DisponibilidadeServico[]> {
  if (!emModoMock()) aindaNaoIntegrado()
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

export async function listarFaturas(usuario: UsuarioPortal): Promise<Fatura[]> {
  if (!emModoMock()) return mapearFaturas(await cobrancasNoGateway())
  return faturasDeTeste(String(useRuntimeConfig().mockSituacao), usuario.contrato)
}

export async function obterFatura(usuario: UsuarioPortal, id: string): Promise<Fatura> {
  // A fatura sempre é buscada dentro da lista do próprio usuário logado:
  // um id de outra pessoa simplesmente não é encontrado.
  const fatura = (await listarFaturas(usuario)).find(f => f.id === id)
  if (!fatura) throw createError({ statusCode: 404, message: 'Não encontramos essa conta.' })
  return fatura
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

export async function opcoesMovimentacao(usuario: UsuarioPortal): Promise<OpcoesMovimentacao> {
  if (!emModoMock()) aindaNaoIntegrado()
  const hoje = new Date()
  const fimDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  return {
    parentescos: PARENTESCOS_TESTE,
    tiposPlanoAnterior: TIPOS_PLANO_ANTERIOR_TESTE,
    motivosExclusao: usuario.contrato?.tipo === 'empresarial' ? MOTIVOS_EXCLUSAO_EMPRESA_TESTE : MOTIVOS_EXCLUSAO_TESTE,
    quandoExcluir: [
      { id: 'fim-do-mes', rotulo: `No fim deste mês (${formatarData(isoDe(fimDoMes))})`, apoio: 'A pessoa continua com atendimento até lá.', data: isoDe(fimDoMes) },
      { id: 'imediato', rotulo: 'A partir de hoje', apoio: 'O atendimento para já hoje.', data: isoDe(hoje) },
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
  const familia = await obterFamilia(usuario)
  const solicitacoes = (await listarPedidos(usuario)).filter(s => s.categoria === 'movimentacao')
  const pessoas = [familia.titular, ...familia.dependentes]
  return {
    beneficiarios: pessoas.map((p) => {
      const exclusaoEmAndamento = solicitacoes.find(s => s.tipo === 'exclusao' && s.beneficiarioId === p.id && solicitacaoEmAberto(s.situacao))
      return {
        id: p.id, nome: p.nome, parentesco: p.parentesco, titular: p.titular,
        podeExcluir: !p.titular && !exclusaoEmAndamento,
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
  if (pessoa.titular) throw createError({ statusCode: 400, message: 'Para tirar o titular é preciso cancelar o plano. Fale com a gente.' })
  if (pessoa.exclusaoEmAndamento) {
    throw createError({ statusCode: 409, message: `Já existe um pedido de saída para ${pessoa.nome} (protocolo ${pessoa.exclusaoEmAndamento.protocolo}).` })
  }
  if (!opcoes.motivosExclusao.some(m => m.id === dados.motivo)) throw createError({ statusCode: 400, message: 'Escolha o motivo da saída.' })
  const quando = opcoes.quandoExcluir.find(q => q.id === dados.quando)
  if (!quando) throw createError({ statusCode: 400, message: 'Escolha a partir de quando a pessoa sai do plano.' })
  if (!dados.aceite) throw createError({ statusCode: 400, message: 'Confirme que você entendeu para enviar.' })

  const solicitacao: SolicitacaoMock = {
    contratoId: idContrato(usuario), protocolo: novoProtocolo(), categoria: 'movimentacao', tipo: 'exclusao',
    titulo: `Tirar ${pessoa.nome} do plano`, pessoa: pessoa.nome, beneficiarioId: pessoa.id,
    criadaEm: isoDe(new Date()), situacao: 'em-analise',
    anexos: [], historico: [{ quando: new Date().toISOString(), texto: 'Pedido enviado pelo portal.' }],
    detalhe: `${pessoa.nome.split(' ')[0]} sai do plano em ${formatarData(quando.data)}. A conta muda a partir do mês seguinte.`,
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
  const grupos = emModoMock() ? DETALHE_TESTE : mapearGruposExtrato(await cobrancaNoGateway(id))
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
    // O extrato do faturamento não traz o código PIX (emv). Precisa de endpoint próprio.
    throw createError({ statusCode: 501, message: 'O PIX ainda não está disponível para esta conta. Use o boleto, por favor.' })
  }
  const copiaECola = PIX_TESTE
  const qrCode = await QRCode.toDataURL(copiaECola, { margin: 1, width: 480, color: { dark: '#1d2948', light: '#ffffff' } })
  return { copiaECola, qrCode }
}

export async function obterBoleto(usuario: UsuarioPortal, id: string): Promise<PagamentoBoleto> {
  const fatura = await obterFatura(usuario, id)
  if (fatura.situacao === 'paga') throw createError({ statusCode: 409, message: 'Essa conta já está paga.' })
  if (!emModoMock()) {
    const linha = (await cobrancaNoGateway(id)).linhaDigitavel
    if (!linha) throw createError({ statusCode: 404, message: 'O boleto desta conta ainda não foi gerado. Tente mais tarde.' })
    return { linhaDigitavel: linha, pdfDisponivel: false }
  }
  return { linhaDigitavel: LINHA_DIGITAVEL_TESTE, pdfDisponivel: false }
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

/** Lista completa da empresa, com quem já tem pedido de saída em andamento. */
export async function beneficiariosEmpresa(usuario: UsuarioPortal): Promise<BeneficiariosEmpresa> {
  exigirRepresentante(usuario)
  if (!emModoMock()) aindaNaoIntegrado()
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
  if (!dados.aceite) throw createError({ statusCode: 400, message: 'Confirme que você entendeu para enviar.' })

  const um = saindo.length === 1 ? saindo[0] : undefined
  const pedido: SolicitacaoMock = {
    contratoId: idContrato(usuario), protocolo: novoProtocolo(), categoria: 'movimentacao', tipo: 'exclusao',
    titulo: um ? `Tirar ${um.nome} do plano` : `Tirar ${saindo.length} pessoas do plano`,
    pessoa: um?.nome, beneficiarioId: um?.id, beneficiarioIds: saindo.map(p => p.id), dataSaida: quando.data,
    criadaEm: isoDe(new Date()), situacao: 'em-analise', anexos: [],
    detalhe: `Saída do plano em ${formatarData(quando.data)}. A conta da empresa muda a partir do mês seguinte.`,
    historico: [{ quando: new Date().toISOString(), texto: 'Pedido enviado pelo portal.' }],
    pessoasLote: um ? undefined : saindo.map(p => ({ nome: p.nome, parentesco: p.parentesco, situacao: 'em-analise' as const })),
  }
  solicitacoesMock.push(pedido)
  return paraCliente(pedido)
}
