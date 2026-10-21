export type SituacaoFatura = 'aberta' | 'vence-hoje' | 'atrasada' | 'paga'

/**
 * individual / adesao: o titular faz tudo (contas, serviços, movimentação).
 * empresarial: o titular (funcionário) só consulta; quem faz tudo é o representante da empresa.
 * Vem da marcação do tipo do produto no backend.
 */
export type TipoContrato = 'individual' | 'adesao' | 'empresarial'

/** Como a pessoa do CPF participa do contrato. */
export type PapelNoContrato = 'titular' | 'representante'

export type SituacaoContrato = 'ativo' | 'cancelado'

/** Um contrato do CPF logado, como aparece na tela "Qual plano você quer ver?". */
export interface ContratoCliente {
  /** Identificador opaco: só vale dentro da lista guardada na sessão */
  id: string
  numero: string
  tipo: TipoContrato
  papel: PapelNoContrato
  situacao: SituacaoContrato
  /** Nome do plano em linguagem simples */
  plano: string
  /** Só no empresarial */
  empresa?: string
  /** Número do contrato da empresa (PME): liga o titular ao contrato de que a pessoa é responsável */
  contratoEmpresa?: string
  /** AAAA-MM-DD */
  inicioVigencia: string
  /** AAAA-MM-DD, só quando cancelado */
  fimVigencia?: string
}

/** Áreas do portal que dependem do contrato escolhido. Início e Ajuda são de todos. */
export type AreaPortal = 'contas' | 'servicos' | 'comunicados' | 'familia' | 'movimentacao' | 'pedidos' | 'empresa'

/** O que o usuário pode ver e fazer no contrato escolhido (calculado no servidor). */
export interface AcessoPortal {
  areas: AreaPortal[]
  /** false no titular de empresarial: nenhum valor em reais aparece */
  mostrarValores: boolean
}

export interface UsuarioPortal {
  nome: string
  primeiroNome: string
  /** Vazio enquanto o contrato não foi escolhido */
  plano: string
  numeroContrato: string
  /** undefined = ainda precisa escolher o contrato */
  contrato?: ContratoCliente
  acesso: AcessoPortal
  /** O CPF tem mais de um contrato: mostra "Trocar de plano" */
  podeTrocarContrato: boolean
}

export type CanalEnvio = 'sms' | 'email'

/** Meio de contato para receber a senha nova, sempre com o destino já mascarado. */
export interface ContatoRecuperacao {
  canal: CanalEnvio
  destino: string
}

export type CanalComunicado = 'email' | 'sms' | 'carta'

/**
 * informativo: só fica no histórico.
 * inadimplencia / suspensao: ligado a uma mensalidade; enquanto ela não tiver baixa,
 * o comunicado é "vigente" e aparece em popup a cada login.
 */
export type TipoComunicado = 'informativo' | 'inadimplencia' | 'suspensao'

/** Cópia de um comunicado já enviado ao cliente. */
export interface Comunicado {
  id: string
  tipo: TipoComunicado
  /** Mensalidade que originou o comunicado (inadimplência/suspensão) */
  faturaId?: string
  /** Calculado no servidor: true enquanto a mensalidade ligada não tiver baixa */
  vigente: boolean
  titulo: string
  resumo: string
  canal: CanalComunicado
  /** Data no formato AAAA-MM-DD */
  enviadoEm: string
  /** Para onde foi enviado, já mascarado (ex.: "ma•••@email.com") */
  destino: string
  novo: boolean
  /** Texto em parágrafos simples (sem HTML) */
  paragrafos: string[]
}

/** Um campo a escolher antes de gerar o documento (ano ou competência), com as opções que o contrato permite. */
export interface CampoDoServicoTela {
  id: 'ano' | 'competencia'
  rotulo: string
  opcoes: { valor: string, rotulo: string }[]
}

/** Documento gerado para ver na tela e baixar. */
export interface DocumentoGerado {
  /** O arquivo não vem com endereço: abre-se por /api/servicos/documento/{id} (ver ou baixar) */
  arquivos: { id: string, nome: string }[]
  /** Aviso do sistema (ex.: nada a emitir neste período) */
  aviso?: string
}

/** Situação de um serviço para o usuário logado (calculada no servidor). */
export interface DisponibilidadeServico {
  id: string
  disponivel: boolean
  /** true: o contrato não tem esse comunicado autorizado; a tela não mostra */
  oculto?: boolean
  /** Nome do comunicado quando não é um dos serviços conhecidos */
  titulo?: string
  /** O que o cliente escolhe antes de gerar o documento (só com o sistema ligado) */
  campos?: CampoDoServicoTela[]
  /** Explicação simples quando não está disponível */
  motivo?: string
  /** Mensalidade que impede o serviço (ex.: quitação com conta em aberto) */
  faturaId?: string
  /** Anos que podem ser escolhidos, do mais recente para o mais antigo */
  anos?: number[]
}

export interface ItemFatura {
  descricao: string
  valor: number
}

export interface Fatura {
  id: string
  /** Mês de referência por extenso, ex.: "outubro" */
  mes: string
  valor: number
  /** Data no formato AAAA-MM-DD */
  vencimento: string
  situacao: SituacaoFatura
  /** Data no formato AAAA-MM-DD, só quando paga */
  pagaEm?: string
  itens: ItemFatura[]
}

/** Produto (plano) de uma pessoa, com as características em linguagem simples. */
export interface ProdutoBeneficiario {
  nome: string
  /** true nos produtos opcionais; o plano principal vem sempre primeiro na lista */
  opcional?: boolean
  tipo: 'saude' | 'odonto'
  operadora: string
  registroAns: string
  /** Ex.: "Apartamento (quarto individual)" */
  acomodacao?: string
  /** Ex.: "Em todo o Brasil" (nem todo contrato traz) */
  abrangencia?: string
  /** Ex.: "Consultas, exames, internação e parto" (nem todo contrato traz) */
  cobertura?: string
  /** undefined quando o backend não informa */
  coparticipacao?: boolean
  /** Data no formato AAAA-MM-DD */
  inicioVigencia: string
  /** Não vem quando o contrato não pode exibir valores (titular de empresarial) */
  valorMensal?: number
}

/** Dados pessoais de um beneficiário (só leitura). Cada campo só vem quando o sistema tem o dado. */
export interface DadosPessoais {
  cpf?: string
  /** AAAA-MM-DD */
  nascimento?: string
  sexo?: string
  estadoCivil?: string
  nomeMae?: string
  cartaoSus?: string
  nacionalidade?: string
  naturalidade?: string
  rg?: string
  orgaoExpedidor?: string
  pisPasep?: string
  declaracaoNascidoVivo?: string
}

export interface ContatoCadastro {
  tipo: 'email' | 'telefone' | 'celular'
  rotulo: string
  valor: string
}

export interface EnderecoCadastro {
  rotulo: string
  linhas: string[]
  /** O mesmo endereço em campos separados (cep, logradouro, numero, complemento, bairro, municipio, uf): preenche o formulário de alteração */
  campos?: Record<string, string>
}

/** Meio de pagamento já com o que é sensível escondido (conta só com o final). */
export interface PagamentoCadastro {
  modalidade: string
  detalhes: { rotulo: string, valor: string }[]
}

export interface PessoaDeContato {
  papel: string
  nome: string
  detalhes: { rotulo: string, valor: string }[]
}

/** Contato, endereço e pagamento do contrato (só leitura). */
export interface CadastroDoContrato {
  contatos: ContatoCadastro[]
  enderecos: EnderecoCadastro[]
  pagamento: PagamentoCadastro[]
  responsaveis: PessoaDeContato[]
}

/** Dados da empresa para o responsável (só leitura). */
export interface CadastroDaEmpresa {
  empresa: { rotulo: string, valor: string }[]
  representante: PessoaDeContato | null
  contatos: ContatoCadastro[]
  enderecos: EnderecoCadastro[]
  pagamento: PagamentoCadastro[]
}

export interface BeneficiarioPlano {
  /** Identificador interno (opaco) do beneficiário */
  id: string
  nome: string
  parentesco: string
  titular: boolean
  numeroCarteirinha: string
  produtos: ProdutoBeneficiario[]
  dados?: DadosPessoais
}

export interface MinhaFamilia {
  titular: BeneficiarioPlano
  dependentes: BeneficiarioPlano[]
}

export type TipoMovimentacao = 'inclusao' | 'exclusao'
export type SituacaoSolicitacao = 'em-analise' | 'pendente' | 'indeferida' | 'concluida'

/** O que o cliente precisa fazer para destravar um pedido pendente. */
export interface PendenciaSolicitacao {
  tipo: 'documento' | 'informacao'
  /** O que falta, em linguagem simples. Ex.: "Envie a certidão de nascimento legível." */
  descricao: string
  /** Prazo para regularizar, AAAA-MM-DD */
  prazo?: string
}

export interface EventoHistorico {
  /** Data e hora (ISO) */
  quando: string
  texto: string
}

/** De onde o pedido veio. "movimentacao" também aparece na área Movimentação. */
export type CategoriaSolicitacao = 'movimentacao' | 'servico' | 'atendimento' | 'cadastro'
export type TipoSolicitacao = TipoMovimentacao | 'servico' | 'atendimento' | 'alteracao-cadastral'

/** O que o cliente pode pedir para alterar nos dados do contrato. */
export type CampoAlteravel = 'dados' | 'email' | 'celular' | 'telefone' | 'endereco'

/** Regra de uma alteração cadastral. Hoje fixa; depois vem da API "Regra de alteração cadastral". */
export interface RegraDaAlteracao {
  campo: CampoAlteravel
  permitido: boolean
  /** Vai para a administradora aprovar antes de valer */
  exigeAprovacao: boolean
  /** Precisa enviar documento junto */
  exigeDocumento: boolean
}

/** O que o ator pode fazer com uma alteração, segundo a regra "Serviços online". */
export interface DecisaoDeAlteracao {
  campo: CampoAlteravel
  disponivel: boolean
  /** imediato: o dado muda na hora; aprovacao: a administradora avalia antes */
  atendimento: 'imediato' | 'aprovacao'
  /** Documentos que a regra pede para esse caso */
  documentos: string[]
  mensagem?: string
}

/** Resultado do pedido de alteração: imediata (já feita) ou por aprovação (pedido aberto). */
export interface ResultadoDaAlteracao {
  pedido: Solicitacao
  imediata: boolean
}

/** O que o ator pode fazer na Movimentação (incluir ou tirar pessoas), segundo a regra "Serviços online". */
export type TipoDeMovimentacao = 'incluir-titular' | 'incluir-dependente' | 'excluir-titular' | 'excluir-dependente'

export interface DecisaoDeMovimentacao {
  tipo: TipoDeMovimentacao
  disponivel: boolean
  atendimento: 'imediato' | 'aprovacao'
  documentos: string[]
  mensagem?: string
}

/** O que a tela manda para pedir uma alteração. */
export interface PedidoDeAlteracao {
  campo: CampoAlteravel
  valores: Record<string, string>
  /** Responsável pela empresa: de qual família (número do contrato do titular, da própria empresa) é a alteração */
  contrato?: string
  /** Dados cadastrais: de qual pessoa do grupo familiar (id do beneficiário) */
  pessoa?: string
  /** Documentos que a regra pede, anexados NA HORA do pedido (um grupo de arquivos por documento exigido) */
  anexos?: { documento: string, ids: string[] }[]
}

/** Endereço oficial de um CEP (a consulta do Vexur às bases de localidades). */
export interface EnderecoDoCep {
  logradouro: string
  bairro: string
  municipio: string
  uf: string
}

/** Qualquer pedido do cliente (movimentação, serviço, atendimento), acompanhado pelo protocolo. */
export interface Solicitacao {
  protocolo: string
  categoria: CategoriaSolicitacao
  tipo: TipoSolicitacao
  /** Nome do pedido em linguagem simples. Ex.: "Incluir Ana Clara da Silva", "Informe de IR 2025" */
  titulo: string
  /** Pessoa envolvida, quando houver */
  pessoa?: string
  /** Na exclusão: quem está saindo */
  beneficiarioId?: string
  /** Data no formato AAAA-MM-DD */
  criadaEm: string
  situacao: SituacaoSolicitacao
  /** Explicação simples do que acontece agora */
  detalhe: string
  /** Só quando situacao = "pendente" */
  pendencia?: PendenciaSolicitacao
  /** Motivo do indeferimento ou resumo do que foi feito na conclusão */
  resultado?: string
  /** Arquivos do resultado (ex.: carta de inclusão) */
  anexos: { id: string, nome: string }[]
  /** Pedido em lote (planilha ou várias saídas): a situação de cada pessoa */
  pessoasLote?: { nome: string, parentesco: string, situacao: SituacaoSolicitacao }[]
  historico: EventoHistorico[]
}

export interface OpcaoSimples {
  id: string
  rotulo: string
  apoio?: string
}

/** Parentesco e em qual caminho da inclusão ele aparece. */
export interface OpcaoParentesco extends OpcaoSimples {
  /** Nome do evento quando a inclusão é por evento (ex.: "nascimento") */
  evento?: string
  /** Aparece no caminho "Não" (outros tipos de dependente) */
  paraOutros: boolean
}

export interface OpcoesMovimentacao {
  parentescos: OpcaoParentesco[]
  tiposPlanoAnterior: OpcaoSimples[]
  motivosExclusao: OpcaoSimples[]
  /** "escolheData": o cliente informa a data (aparece um campo de data na tela); a data vem em `data` do pedido */
  quandoExcluir: (OpcaoSimples & { data: string, escolheData?: boolean })[]
}

/** Tela principal da movimentação: beneficiários com o que dá para fazer com cada um. */
export interface PainelMovimentacao {
  beneficiarios: {
    id: string
    nome: string
    parentesco: string
    titular: boolean
    /** Pode pedir a saída pelo portal (só dependentes sem pedido em aberto) */
    podeExcluir: boolean
    /** Pedido de saída já feito e ainda não concluído */
    exclusaoEmAndamento?: Solicitacao
  }[]
  solicitacoes: Solicitacao[]
}

export type TipoRespostaDps = 'sim-nao' | 'data' | 'texto' | 'numero' | 'calculado'

/**
 * Pergunta da declaração de saúde (DPS). Vem do backend por produto/contrato
 * (regra-aceitacao-declaracao-saude/obterRegraProduto) e é traduzida no BFF.
 */
export interface PerguntaDps {
  /** Ordem da questão: "1", "2"... Subpergunta usa o id do pai: "1.1" */
  id: string
  pergunta: string
  tipo: TipoRespostaDps
  /** Texto de ajuda mostrado embaixo da pergunta */
  ajuda?: string
  unidade?: string
  min?: number
  max?: number
  /** Só no tipo "calculado": fórmula com ids entre chaves, ex.: "{p}/(({a}/100)^2)" */
  formula?: string
}

export interface DeclaracaoSaude {
  /** false quando a regra dispensa a DPS (ex.: recém-nascido dentro do prazo) */
  exigida: boolean
  motivoDispensa?: string
  perguntas: PerguntaDps[]
}

export type RespostasDps = Record<string, string>

export interface DadosInclusao {
  /** Etapa 1: "sim" = recém-nascido/casado/tutelado; "nao" = outros tipos de dependente */
  evento: 'sim' | 'nao' | ''
  /** AAAA-MM-DD — nascimento, casamento ou tutela (só quando evento = "sim") */
  dataEvento: string
  parentesco: string
  /** Só quando evento = "nao": tinha plano de saúde antes? */
  temPlanoAnterior: 'sim' | 'nao' | ''
  /** Só quando evento = "nao" e temPlanoAnterior = "sim" */
  planoAnterior: { tipo: string, operadora: string, plano: string, meses: string, ultimoPagamento: string }
  /** Etapa 2 */
  nome: string
  cpf: string
  /** AAAA-MM-DD */
  nascimento: string
  documentos: string[]
  /** Etapa 3: respostas da declaração de saúde, por id da pergunta */
  declaracaoSaude: RespostasDps
  /** Etapa 4 */
  aceite: boolean
}

export interface DadosExclusao {
  beneficiario: string
  motivo: string
  quando: string
  /** Só quando "quando" é a opção de escolher a data (AAAA-MM-DD) */
  data?: string
  aceite: boolean
}

// ---------------------------------------------------------------- Empresa (visão do responsável)

/** Uma pessoa do plano da empresa, como o responsável vê na lista. */
export interface PessoaEmpresa {
  /** Identificador interno (opaco) */
  id: string
  nome: string
  /** CPF formatado (000.000.000-00): o responsável é quem cadastra e precisa conferir */
  cpf: string
  parentesco: string
  titular: boolean
  numeroCarteirinha: string
  /** Plano PRINCIPAL da pessoa */
  plano: string
  /** Planos opcionais (adicionais) que a pessoa também tem; vêm ao abrir a família */
  opcionais?: string[]
  /** Dados pessoais; vêm ao abrir a família */
  dados?: DadosPessoais
  /** AAAA-MM-DD */
  inicioVigencia: string
  /** Cancelado = já saiu do plano (fica na lista para consulta) */
  situacao: SituacaoContrato
  /** Continua no plano, mas com o plano suspenso (ex.: inadimplência). Só vale com situacao "ativo". */
  suspenso?: boolean
  /** AAAA-MM-DD, só quando cancelado */
  fimVigencia?: string
  /** Pedido de saída em andamento */
  saida?: { protocolo: string, data: string }
}

export interface TitularEmpresa extends PessoaEmpresa {
  dependentes: PessoaEmpresa[]
  /** Só quando a lista vem sem os dependentes (sob demanda): quantos ele tem */
  totalDependentes?: number
}

/** Família de um titular da empresa, carregada ao abrir a linha dele. */
export interface FamiliaDaEmpresa {
  titular: PessoaEmpresa
  dependentes: PessoaEmpresa[]
  /** Contato e endereço do contrato dessa família (o pagamento é da empresa e não entra aqui) */
  cadastro?: CadastroDoContrato
}

export interface BeneficiariosEmpresa {
  /** true: a lista traz só os titulares; os dependentes (e CPF/carteirinha) vêm ao abrir cada família */
  dependentesSobDemanda?: boolean
  empresa: string
  /** Contagens de quem está ativo; `cancelados` = pessoas que já saíram */
  resumo: { titulares: number, dependentes: number, vidas: number, cancelados: number, saindo: number, inclusoesEmAnalise: number }
  /** Planos que a empresa oferece (para filtro e para a inclusão) */
  planos: string[]
  /** Parentescos aceitos no contrato (para a inclusão) */
  parentescos: string[]
  titulares: TitularEmpresa[]
}

/** O que a regra de aceitação de beneficiário aceita incluir pela Movimentação cadastral. */
export interface ParentescoDaInclusao {
  parentesco: string
  /** Opções de documentos: a pessoa cumpre UMA opção, e cada opção pode pedir vários documentos. Vazio = sem documento. */
  documentos: string[][]
  /** Prazo (dias) depois do evento em que ainda vale como evento; sem valor = sem limite */
  prazoInclusaoDias?: number
  /** Evento que esse parentesco pode ter: RN (recém-nascido), RC (recém-casado) ou RT (recém-tutelado) */
  evento?: 'RN' | 'RC' | 'RT'
}

/** Uma pessoa a incluir: mesmo formato da linha da planilha (layout provisório). */
export interface LinhaInclusaoEmpresa {
  nome: string
  cpf: string
  /** AAAA-MM-DD */
  nascimento: string
  /** "Titular" para o funcionário; senão o parentesco com o titular */
  parentesco: string
  /** Só para dependente */
  cpfTitular: string
  plano: string
  /** Só no formulário de uma pessoa: o titular escolhido na lista (o servidor confere contra a empresa) */
  titularId?: string
  /** Só no dependente: a inclusão é por evento (RN, RC ou RT) e a data dele (AAAA-MM-DD) */
  eventoData?: string
  /** Só no dependente, inclusão comum: o plano de saúde que a pessoa teve antes (quando tem) */
  planoAnterior?: { tipo: string, operadora: string, plano: string, tempoMeses: string, ultimoPagamento: string }
  /** Só no dependente: início do plano (AAAA-MM-DD), uma das datas do calendário, no mesmo dia da vigência do titular */
  inicio?: string
  /** Só no formulário de uma pessoa: o resto do cadastro */
  dadosPessoais?: DadosPessoaisInclusao
}

/** Cadastro completo de quem entra: o mesmo que as pessoas atuais têm. */
export interface DadosPessoaisInclusao {
  sexo: string
  estadoCivil: string
  nomeMae: string
  naoPossuiNomeMae?: boolean
  naturalidade: string
  rg: string
  orgaoExpedidor: string
  ufRg: string
  pisPasep: string
  cartaoSus: string
  declaracaoNascidoVivo: string
}

/** Quanto a família paga hoje e quanto passa a pagar com a pessoa que vai entrar (tabela de preço do Vexur). */
export interface SimulacaoInclusao {
  familia: { pessoas: { nome: string, parentesco: string, valor: number }[], total: number }
  /** Só quando já dá para simular (parentesco, nascimento e sexo preenchidos) */
  dependente?: { valor: number, produtos: { nome: string, valor: number }[] }
  novoTotal?: number
  diferenca?: number
  /** Quando não foi possível achar o preço */
  aviso?: string
}

/** Resultado da conferência de uma linha da planilha. */
export interface LinhaConferida extends LinhaInclusaoEmpresa {
  /** Número da linha no Excel (o cabeçalho é a linha 1) */
  linha: number
  erros: string[]
}

export interface ConferenciaPlanilha {
  /** Guardado no servidor: o envio usa as linhas conferidas, não o que o navegador mandar */
  id: string
  arquivo: string
  linhas: LinhaConferida[]
  prontas: number
  comProblema: number
}

export interface DadosExclusaoEmpresa {
  /** Pessoas marcadas na lista (titular marcado leva os dependentes junto) */
  pessoas: string[]
  motivo: string
  quando: string
  /** Só quando "quando" é a opção de escolher a data (AAAA-MM-DD) */
  data?: string
  aceite: boolean
}

export interface LinhaExtrato {
  /** Tipo do lançamento. Ex.: "Mensalidade", "Taxa associativa" */
  descricao: string
  /** Produto a que o lançamento se refere (nome amigável). Evita duas "Mensalidade" sem explicação. */
  produto?: string
  /** Complemento curto. Ex.: "parcela 2 de 3" */
  detalhe?: string
  valor: number
}

/** Cobranças de uma pessoa dentro da conta. */
export interface GrupoExtrato {
  beneficiario: string
  parentesco: string
  linhas: LinhaExtrato[]
  subtotal: number
}

/** Extrato de cobrança de uma conta (mensalidade), pronto para ver e imprimir. */
export interface ExtratoFatura {
  fatura: Fatura
  titular: string
  numeroContrato: string
  plano: string
  grupos: GrupoExtrato[]
  total: number
  /** Data e hora da emissão (ISO) */
  emitidoEm: string
  observacoes: string[]
}

export interface PagamentoPix {
  copiaECola: string
  qrCode: string
}

export interface PagamentoBoleto {
  linhaDigitavel: string
  pdfDisponivel: boolean
}
