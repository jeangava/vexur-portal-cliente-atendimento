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
  /** AAAA-MM-DD */
  inicioVigencia: string
  /** AAAA-MM-DD, só quando cancelado */
  fimVigencia?: string
}

/** Áreas do portal que dependem do contrato escolhido. Início e Ajuda são de todos. */
export type AreaPortal = 'contas' | 'servicos' | 'comunicados' | 'familia' | 'movimentacao' | 'pedidos'

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

/** Situação de um serviço para o usuário logado (calculada no servidor). */
export interface DisponibilidadeServico {
  id: string
  disponivel: boolean
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

export interface BeneficiarioPlano {
  /** Identificador interno (opaco) do beneficiário */
  id: string
  nome: string
  parentesco: string
  titular: boolean
  numeroCarteirinha: string
  produtos: ProdutoBeneficiario[]
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
export type CategoriaSolicitacao = 'movimentacao' | 'servico' | 'atendimento'
export type TipoSolicitacao = TipoMovimentacao | 'servico' | 'atendimento'

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
  quandoExcluir: (OpcaoSimples & { data: string })[]
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
  plano: string
  /** AAAA-MM-DD */
  inicioVigencia: string
  /** Cancelado = já saiu do plano (fica na lista para consulta) */
  situacao: SituacaoContrato
  /** AAAA-MM-DD, só quando cancelado */
  fimVigencia?: string
  /** Pedido de saída em andamento */
  saida?: { protocolo: string, data: string }
}

export interface TitularEmpresa extends PessoaEmpresa {
  dependentes: PessoaEmpresa[]
}

export interface BeneficiariosEmpresa {
  empresa: string
  /** Contagens de quem está ativo; `cancelados` = pessoas que já saíram */
  resumo: { titulares: number, dependentes: number, vidas: number, cancelados: number, saindo: number, inclusoesEmAnalise: number }
  /** Planos que a empresa oferece (para filtro e para a inclusão) */
  planos: string[]
  /** Parentescos aceitos no contrato (para a inclusão) */
  parentescos: string[]
  titulares: TitularEmpresa[]
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
  aceite: boolean
}

export interface LinhaExtrato {
  descricao: string
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
