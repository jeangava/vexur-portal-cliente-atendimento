import type {
  Comunicado, ConferenciaPlanilha, ContratoCliente, Fatura, GrupoExtrato, MinhaFamilia, OpcaoParentesco, OpcaoSimples,
  PerguntaDps, PessoaEmpresa, SituacaoFatura, Solicitacao, TitularEmpresa,
} from '#shared/types/portal'

/** Senhas de teste aceitas no modo mock (documentadas no README). */
export const SENHA_TESTE = 'Teste@123'
/** Simula a senha que chega por e-mail no primeiro acesso / esqueci minha senha. */
export const SENHA_TEMPORARIA_TESTE = 'Nova@2026'

/** Senhas criadas pelo usuário no modo mock (só em memória, some ao reiniciar). */
export const senhasCriadasNoMock = new Map<string, string>()

export const PESSOA_TESTE = { nome: 'Maria da Silva', primeiroNome: 'Maria' }

// ---------------------------------------------------------------- contratos de teste

const C_ADESAO: ContratoCliente = {
  id: 'c-adesao', numero: '000123', tipo: 'adesao', papel: 'titular', situacao: 'ativo',
  plano: 'Plano Saúde Essencial', inicioVigencia: '2025-01-10',
}
const C_EMPRESA_TITULAR: ContratoCliente = {
  id: 'c-empresa', numero: '000456', tipo: 'empresarial', papel: 'titular', situacao: 'ativo',
  plano: 'Plano Empresa Saúde Mais', empresa: 'Alfa Comércio Ltda', inicioVigencia: '2024-06-01',
}
const C_EMPRESA_REPRESENTANTE: ContratoCliente = {
  id: 'c-empresa-resp', numero: '000456', tipo: 'empresarial', papel: 'representante', situacao: 'ativo',
  plano: 'Plano Empresa Saúde Mais', empresa: 'Alfa Comércio Ltda', inicioVigencia: '2024-06-01',
}
const C_INDIVIDUAL_CANCELADO: ContratoCliente = {
  id: 'c-individual-antigo', numero: '000077', tipo: 'individual', papel: 'titular', situacao: 'cancelado',
  plano: 'Plano Família Clássico', inicioVigencia: '2019-03-01', fimVigencia: '2023-12-31',
}
const C_ADESAO_CANCELADO: ContratoCliente = {
  id: 'c-adesao-antigo', numero: '000045', tipo: 'adesao', papel: 'titular', situacao: 'cancelado',
  plano: 'Plano Saúde Prata', inicioVigencia: '2016-05-10', fimVigencia: '2019-02-28',
}
const C_EMPRESA_CANCELADO: ContratoCliente = {
  id: 'c-empresa-antiga', numero: '000031', tipo: 'empresarial', papel: 'titular', situacao: 'cancelado',
  plano: 'Plano Empresa Básico', empresa: 'Beta Serviços S.A.', inicioVigencia: '2012-01-01', fimVigencia: '2016-04-30',
}

/** CPFs fictícios (válidos só no cálculo) para ver cada situação. Qualquer outro CPF: um plano por adesão. */
export const CENARIOS_TESTE: { cpf: string, descricao: string, contratos: ContratoCliente[] }[] = [
  { cpf: '11122233396', descricao: 'Dois planos ativos e um antigo', contratos: [C_ADESAO, C_EMPRESA_TITULAR, C_INDIVIDUAL_CANCELADO] },
  { cpf: '22233344405', descricao: 'Um plano ativo e dois antigos', contratos: [C_INDIVIDUAL_CANCELADO, C_ADESAO, C_ADESAO_CANCELADO] },
  { cpf: '33344455508', descricao: 'Todos os planos cancelados', contratos: [C_ADESAO_CANCELADO, C_INDIVIDUAL_CANCELADO, C_EMPRESA_CANCELADO] },
  { cpf: '44455566619', descricao: 'Só o plano da empresa (funcionário)', contratos: [C_EMPRESA_TITULAR] },
  { cpf: '55566677720', descricao: 'Responsável pela empresa (também é titular)', contratos: [C_EMPRESA_TITULAR, C_EMPRESA_REPRESENTANTE] },
]

export function contratosDeTeste(cpf: string): ContratoCliente[] {
  return CENARIOS_TESTE.find(c => c.cpf === somenteDigitos(cpf))?.contratos ?? [C_ADESAO]
}

/** Contatos fictícios do cadastro (o navegador só recebe a versão mascarada). */
export const CONTATOS_TESTE = { email: 'maria.silva@email.com', celular: '11987654321' }

const PRODUTO_SAUDE_TESTE = {
  nome: 'Plano Saúde Essencial',
  tipo: 'saude' as const,
  operadora: 'Operadora Exemplo',
  registroAns: '000000',
  acomodacao: 'Enfermaria (quarto dividido)',
  abrangencia: 'No seu estado',
  cobertura: 'Consultas, exames, internação e parto',
  coparticipacao: true,
}

/** Titular e dependentes fictícios; os valores batem com DETALHE_TESTE (mensalidades). */
export const FAMILIA_TESTE: MinhaFamilia = {
  titular: {
    id: 'ben-maria', nome: 'Maria da Silva', parentesco: 'Titular', titular: true, numeroCarteirinha: '0 000 000000000001 0',
    produtos: [{ ...PRODUTO_SAUDE_TESTE, inicioVigencia: '2025-01-10', valorMensal: 229.9 }],
  },
  dependentes: [
    {
      id: 'ben-joao', nome: 'João da Silva', parentesco: 'Filho', titular: false, numeroCarteirinha: '0 000 000000000002 0',
      produtos: [{ ...PRODUTO_SAUDE_TESTE, inicioVigencia: '2025-03-10', valorMensal: 130 }],
    },
  ],
}

const PRODUTO_EMPRESA_TESTE = {
  nome: 'Plano Empresa Saúde Mais',
  tipo: 'saude' as const,
  operadora: 'Operadora Exemplo',
  registroAns: '000000',
  acomodacao: 'Apartamento (quarto individual)',
  abrangencia: 'Em todo o Brasil',
  cobertura: 'Consultas, exames, internação e parto',
  coparticipacao: false,
}

/** Família no plano da empresa (o valor existe aqui, mas o servidor tira antes de mandar ao titular). */
const FAMILIA_EMPRESA_TESTE: MinhaFamilia = {
  titular: {
    id: 'ben-maria-empresa', nome: 'Maria da Silva', parentesco: 'Titular', titular: true, numeroCarteirinha: '0 000 000000000101 0',
    produtos: [{ ...PRODUTO_EMPRESA_TESTE, inicioVigencia: '2024-06-01', valorMensal: 610 }],
  },
  dependentes: [
    {
      id: 'ben-pedro-empresa', nome: 'Pedro da Silva', parentesco: 'Cônjuge', titular: false, numeroCarteirinha: '0 000 000000000102 0',
      produtos: [{ ...PRODUTO_EMPRESA_TESTE, inicioVigencia: '2024-06-01', valorMensal: 610 }],
    },
  ],
}

export function familiaDeTeste(contrato?: ContratoCliente): MinhaFamilia {
  if (contrato?.tipo === 'empresarial') return FAMILIA_EMPRESA_TESTE
  if (contrato?.situacao === 'cancelado') {
    // Plano antigo: mesmo grupo familiar, com o nome do plano que existia na época.
    const antigo = (p: MinhaFamilia['titular']) => ({
      ...p, produtos: p.produtos.map(pr => ({ ...pr, nome: contrato.plano, inicioVigencia: contrato.inicioVigencia })),
    })
    return { titular: antigo(FAMILIA_TESTE.titular), dependentes: FAMILIA_TESTE.dependentes.map(antigo) }
  }
  return FAMILIA_TESTE
}

export const PARENTESCOS_TESTE: OpcaoParentesco[] = [
  { id: 'filho', rotulo: 'Filho ou filha', evento: 'nascimento', paraOutros: true },
  { id: 'conjuge', rotulo: 'Marido, esposa ou companheiro(a)', evento: 'casamento ou união', paraOutros: true },
  { id: 'tutelado', rotulo: 'Tutelado(a)', evento: 'tutela', paraOutros: false },
  { id: 'enteado', rotulo: 'Enteado ou enteada', paraOutros: true },
  { id: 'pai-mae', rotulo: 'Pai ou mãe', paraOutros: true },
]

export const TIPOS_PLANO_ANTERIOR_TESTE: OpcaoSimples[] = [
  { id: 'individual', rotulo: 'Individual ou familiar' },
  { id: 'adesao', rotulo: 'Coletivo por adesão' },
  { id: 'empresarial', rotulo: 'Coletivo empresarial (da empresa)' },
]

// ---------------------------------------------------------------- Empresa (visão do responsável)

export const PLANOS_EMPRESA_TESTE = ['Plano Empresa Saúde Mais', 'Plano Empresa Essencial']
export const PARENTESCOS_EMPRESA_TESTE = ['Cônjuge', 'Companheiro(a)', 'Filho(a)', 'Enteado(a)']

export const MOTIVOS_EXCLUSAO_EMPRESA_TESTE: OpcaoSimples[] = [
  { id: 'desligamento', rotulo: 'Saiu da empresa', apoio: 'Demissão ou fim do contrato de trabalho' },
  { id: 'pedido', rotulo: 'A pessoa pediu para sair' },
  { id: 'separacao', rotulo: 'Separação ou divórcio' },
  { id: 'idade', rotulo: 'Dependente passou da idade' },
  { id: 'obito', rotulo: 'Falecimento', apoio: 'Sentimos muito. Vamos pedir a certidão depois.' },
  { id: 'outro', rotulo: 'Outro motivo' },
]

const PRIMEIROS_NOMES = [
  'Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Leonardo',
  'Mariana', 'Nicolas', 'Olívia', 'Paulo', 'Rafaela', 'Sérgio', 'Tatiane', 'Vinícius', 'Aline', 'Caio', 'Débora', 'Igor',
  'Juliana', 'Marcos', 'Patrícia', 'Renato', 'Simone', 'Thiago',
]
const SOBRENOMES = [
  'Almeida', 'Barbosa', 'Cardoso', 'Costa', 'Dias', 'Ferreira', 'Gomes', 'Lima', 'Martins', 'Mendes', 'Nascimento',
  'Oliveira', 'Pereira', 'Ribeiro', 'Rocha', 'Santos', 'Silva', 'Souza', 'Teixeira', 'Vieira',
]

/** CPF fictício com dígitos válidos, sempre o mesmo para o mesmo número. */
function cpfFicticio(n: number): string {
  const base = String(300_000_000 + n * 7_919).slice(0, 9).split('').map(Number)
  const dv = (d: number[]) => { const r = (d.reduce((s, x, i) => s + x * (d.length + 1 - i), 0) * 10) % 11; return r === 10 ? 0 : r }
  base.push(dv(base))
  base.push(dv(base))
  return formatarCpf(base.join(''))
}

/** 90 titulares fictícios com 0 a 3 dependentes cada (sorteio fixo: a lista é sempre igual). */
function montarEmpresaTeste(): TitularEmpresa[] {
  let semente = 42
  // Usa os bits altos: os baixos desse gerador se repetem e deixariam poucos sobrenomes.
  const sorteio = (n: number) => { semente = (semente * 1_103_515_245 + 12_345) % 2_147_483_648; return Math.floor(semente / 65_536) % n }
  let seq = 0
  const carteirinha = () => `0 000 ${String(100_000 + ++seq).padStart(12, '0')} 0`
  const pessoa = (nome: string, parentesco: string, plano: string, inicio: string): PessoaEmpresa => ({
    id: `emp-${seq + 1}`, nome, cpf: cpfFicticio(seq + 1), parentesco, titular: parentesco === 'Titular',
    numeroCarteirinha: carteirinha(), plano, inicioVigencia: inicio, situacao: 'ativo',
  })
  const cancelar = (p: PessoaEmpresa, fim: string) => Object.assign(p, { situacao: 'cancelado' as const, fimVigencia: fim })

  const maria: TitularEmpresa = {
    ...pessoa('Maria da Silva', 'Titular', PLANOS_EMPRESA_TESTE[0]!, '2024-06-01'),
    dependentes: [],
  }
  maria.dependentes.push(pessoa('Pedro da Silva', 'Cônjuge', PLANOS_EMPRESA_TESTE[0]!, '2024-06-01'))
  const lista = [maria]

  for (let i = 1; i < 90; i++) {
    const sobrenome = SOBRENOMES[sorteio(SOBRENOMES.length)]!
    const nome = `${PRIMEIROS_NOMES[sorteio(PRIMEIROS_NOMES.length)]} ${SOBRENOMES[sorteio(SOBRENOMES.length)]} ${sobrenome}`
    const plano = PLANOS_EMPRESA_TESTE[sorteio(3) === 0 ? 1 : 0]!
    const inicio = `20${22 + sorteio(4)}-${String(1 + sorteio(12)).padStart(2, '0')}-01`
    const titular: TitularEmpresa = { ...pessoa(nome, 'Titular', plano, inicio), dependentes: [] }
    const qtd = [0, 0, 1, 1, 2, 2, 3][sorteio(7)]!
    for (let d = 0; d < qtd; d++) {
      const parentesco = d === 0 && sorteio(3) > 0 ? 'Cônjuge' : 'Filho(a)'
      titular.dependentes.push(pessoa(`${PRIMEIROS_NOMES[sorteio(PRIMEIROS_NOMES.length)]} ${sobrenome}`, parentesco, plano, inicio))
    }
    // Quem já saiu do plano continua na lista para consulta: ~1 em 10 funcionários e alguns dependentes.
    const fim = `2026-0${1 + sorteio(8)}-${['10', '20', '28'][sorteio(3)]}`
    if (i % 10 === 3) {
      cancelar(titular, fim)
      titular.dependentes.forEach(d => cancelar(d, fim))
    } else if (titular.dependentes.length > 1 && i % 4 === 1) {
      cancelar(titular.dependentes.at(-1)!, fim)
    }
    lista.push(titular)
  }
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export const EMPRESA_TESTE = { nome: 'Alfa Comércio Ltda', titulares: montarEmpresaTeste() }

/** Planilhas conferidas e ainda não enviadas (só em memória). A chave liga ao CPF de quem enviou. */
export const conferenciasMock = new Map<string, { dono: string, criadaEm: number, conferencia: ConferenciaPlanilha }>()

export const MOTIVOS_EXCLUSAO_TESTE: OpcaoSimples[] = [
  { id: 'nao-quer', rotulo: 'Não quer mais o plano' },
  { id: 'outro-plano', rotulo: 'Vai ter outro plano' },
  { id: 'separacao', rotulo: 'Separação ou divórcio' },
  { id: 'obito', rotulo: 'Falecimento', apoio: 'Sentimos muito. Vamos pedir a certidão depois.' },
  { id: 'outro', rotulo: 'Outro motivo' },
]

/**
 * Declaração de saúde fictícia, no mesmo formato que o BFF vai montar a partir de
 * regra-aceitacao-declaracao-saude/obterRegraProduto (ordemQuestao "1", "1.1"...).
 */
export const PERGUNTAS_DPS_TESTE: PerguntaDps[] = [
  { id: 'peso', pergunta: 'Qual é o peso da pessoa?', tipo: 'numero', unidade: 'kg', min: 1, max: 400, ajuda: 'Pode ser aproximado. Ex.: 68' },
  { id: 'altura', pergunta: 'Qual é a altura?', tipo: 'numero', unidade: 'cm', min: 30, max: 250, ajuda: 'Em centímetros. Ex.: 165' },
  { id: 'imc', pergunta: 'IMC (calculado sozinho)', tipo: 'calculado', formula: '{peso}/(({altura}/100)^2)', ajuda: 'Índice de massa corporal, feito com o peso e a altura.' },
  { id: '1', pergunta: 'Tem ou já teve doença do coração ou pressão alta?', tipo: 'sim-nao' },
  { id: '1.1', pergunta: 'Qual doença e desde quando?', tipo: 'texto' },
  { id: '2', pergunta: 'Tem diabetes?', tipo: 'sim-nao' },
  { id: '2.1', pergunta: 'Desde quando tem diabetes?', tipo: 'data' },
  { id: '3', pergunta: 'Tem ou já teve câncer?', tipo: 'sim-nao' },
  { id: '3.1', pergunta: 'Qual tipo e qual o tratamento?', tipo: 'texto' },
  { id: '4', pergunta: 'Fez cirurgia ou ficou internado(a) nos últimos 5 anos?', tipo: 'sim-nao' },
  { id: '4.1', pergunta: 'O que foi e quando?', tipo: 'texto' },
  { id: '5', pergunta: 'Toma algum remédio todos os dias?', tipo: 'sim-nao' },
  { id: '5.1', pergunta: 'Quais remédios?', tipo: 'texto' },
  { id: '6', pergunta: 'Tem alguma doença nos rins, no fígado ou nos pulmões?', tipo: 'sim-nao' },
  { id: '6.1', pergunta: 'Qual doença?', tipo: 'texto' },
]

function diasAtrasIso(n: number, hora = '10:00'): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${iso(d)}T${hora}:00`
}

function diasAFrente(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return iso(d)
}

/**
 * Pedidos de movimentação do modo mock (só em memória, some ao reiniciar).
 * Já nascem com um exemplo de cada situação: concluído com anexo, pendente e indeferido.
 */
/** Pedido do modo mock, marcado com o contrato a que pertence. */
export type SolicitacaoMock = Solicitacao & {
  contratoId: string
  /** Saída em lote (empresa): quem está saindo e quando */
  beneficiarioIds?: string[]
  dataSaida?: string
  /** Inclusão (empresa): CPFs (só dígitos) de quem entra, para não pedir duas vezes */
  cpfsLote?: string[]
}

export const solicitacoesMock: SolicitacaoMock[] = [
  {
    contratoId: 'c-adesao', protocolo: '2025-000987', categoria: 'movimentacao', tipo: 'inclusao', titulo: 'Incluir João da Silva', pessoa: 'João da Silva',
    criadaEm: '2025-03-02', situacao: 'concluida', detalhe: 'João entrou no plano em 10/03/2025.',
    resultado: 'Inclusão aprovada. A carta com os dados do plano do João está disponível para baixar.',
    anexos: [{ id: 'carta-inclusao-joao', nome: 'Carta de inclusão - João da Silva.pdf' }],
    historico: [
      { quando: '2025-03-02T09:12:00', texto: 'Pedido enviado pelo portal.' },
      { quando: '2025-03-04T15:40:00', texto: 'Documentos conferidos.' },
      { quando: '2025-03-06T11:05:00', texto: 'Inclusão aprovada. Início no plano em 10/03/2025.' },
    ],
  },
  {
    contratoId: 'c-adesao', protocolo: '2026-000412', categoria: 'movimentacao', tipo: 'inclusao', titulo: 'Incluir Ana Clara da Silva', pessoa: 'Ana Clara da Silva',
    criadaEm: diasAtrasIso(6).slice(0, 10), situacao: 'pendente',
    detalhe: 'Precisamos de um documento seu para continuar a análise.',
    pendencia: {
      tipo: 'documento',
      descricao: 'A foto da certidão de nascimento ficou escura e não dá para ler. Envie uma foto nova, com boa luz e sem cortes.',
      prazo: diasAFrente(10),
    },
    anexos: [],
    historico: [
      { quando: diasAtrasIso(6, '08:30'), texto: 'Pedido enviado pelo portal.' },
      { quando: diasAtrasIso(2, '14:10'), texto: 'Pendência: certidão de nascimento ilegível.' },
    ],
  },
  {
    contratoId: 'c-adesao', protocolo: '2026-000388', categoria: 'movimentacao', tipo: 'inclusao', titulo: 'Incluir Carlos da Silva', pessoa: 'Carlos da Silva',
    criadaEm: diasAtrasIso(20).slice(0, 10), situacao: 'indeferida',
    detalhe: 'O pedido não foi aprovado.',
    resultado: 'O seu contrato não permite incluir irmão ou irmã como dependente. Se tiver dúvidas, fale com a gente.',
    anexos: [{ id: 'parecer-carlos', nome: 'Resposta do pedido - Carlos da Silva.pdf' }],
    historico: [
      { quando: diasAtrasIso(20, '10:00'), texto: 'Pedido enviado pelo portal.' },
      { quando: diasAtrasIso(17, '16:25'), texto: 'Pedido não aprovado: parentesco não permitido no contrato.' },
    ],
  },
  {
    contratoId: 'c-adesao', protocolo: '2026-000301', categoria: 'servico', tipo: 'servico', titulo: 'Informe de rendimentos (IR) 2025',
    criadaEm: diasAtrasIso(40).slice(0, 10), situacao: 'concluida',
    detalhe: 'Enviado para o e-mail do cadastro.',
    resultado: 'O informe de rendimentos de 2025 foi enviado para o seu e-mail. Uma cópia fica aqui para baixar.',
    anexos: [{ id: 'informe-ir-2025', nome: 'Informe de rendimentos 2025.pdf' }],
    historico: [
      { quando: diasAtrasIso(40, '19:02'), texto: 'Pedido feito pelo portal.' },
      { quando: diasAtrasIso(40, '19:03'), texto: 'Documento enviado por e-mail.' },
    ],
  },
  {
    contratoId: 'c-adesao', protocolo: '2026-000455', categoria: 'atendimento', tipo: 'atendimento', titulo: 'Atualizar endereço de cobrança',
    criadaEm: diasAtrasIso(3).slice(0, 10), situacao: 'pendente',
    detalhe: 'Falta um documento para concluir.',
    pendencia: { tipo: 'documento', descricao: 'Envie um comprovante de endereço recente (conta de luz, água ou telefone dos últimos 3 meses).', prazo: diasAFrente(7) },
    anexos: [],
    historico: [
      { quando: diasAtrasIso(3, '11:20'), texto: 'Pedido aberto pela central de atendimento.' },
      { quando: diasAtrasIso(1, '09:45'), texto: 'Pendência: comprovante de endereço.' },
    ],
  },
  // Titular do plano da empresa: só os pedidos dele.
  {
    contratoId: 'c-empresa', protocolo: '2026-000501', categoria: 'atendimento', tipo: 'atendimento', titulo: 'Segunda via da carteirinha',
    criadaEm: diasAtrasIso(12).slice(0, 10), situacao: 'concluida',
    detalhe: 'A carteirinha nova foi enviada.',
    resultado: 'A segunda via da carteirinha de Maria foi emitida. O número continua o mesmo.',
    anexos: [{ id: 'carteirinha-maria', nome: 'Carteirinha - Maria da Silva.pdf' }],
    historico: [
      { quando: diasAtrasIso(12, '10:15'), texto: 'Pedido aberto pela central de atendimento.' },
      { quando: diasAtrasIso(10, '16:00'), texto: 'Carteirinha emitida.' },
    ],
  },
  // Responsável pela empresa: pedidos do contrato da empresa.
  {
    contratoId: 'c-empresa-resp', protocolo: '2026-000520', categoria: 'movimentacao', tipo: 'inclusao', titulo: 'Incluir Lucas Pereira', pessoa: 'Lucas Pereira',
    criadaEm: diasAtrasIso(4).slice(0, 10), situacao: 'em-analise',
    detalhe: 'Vamos conferir os documentos. Você recebe a resposta em até 5 dias úteis.',
    anexos: [],
    historico: [{ quando: diasAtrasIso(4, '14:30'), texto: 'Pedido enviado pelo portal.' }],
  },
  // Planos cancelados: o pedido de cancelamento fica no histórico.
  ...[C_INDIVIDUAL_CANCELADO, C_ADESAO_CANCELADO, C_EMPRESA_CANCELADO].map((c, i): SolicitacaoMock => ({
    contratoId: c.id, protocolo: `${c.fimVigencia!.slice(0, 4)}-00010${i}`, categoria: 'atendimento', tipo: 'atendimento', titulo: 'Cancelamento do plano',
    criadaEm: `${c.fimVigencia!.slice(0, 7)}-01`, situacao: 'concluida',
    detalhe: `O plano terminou em ${formatarData(c.fimVigencia!)}.`,
    resultado: 'Cancelamento concluído. A carta de confirmação está disponível para baixar.',
    anexos: [{ id: `cancelamento-${c.id}`, nome: 'Carta de cancelamento.pdf' }],
    historico: [
      { quando: `${c.fimVigencia!.slice(0, 7)}-01T10:00:00`, texto: 'Pedido de cancelamento recebido.' },
      { quando: `${c.fimVigencia}T18:00:00`, texto: 'Plano cancelado.' },
    ],
  })),
]

/** Documentos enviados no modo mock (guarda só o id e o nome; o arquivo é descartado). */
export const documentosMock = new Map<string, string>()

/** Detalhe da cobrança por pessoa; a soma de cada grupo bate com ITENS. */
export const DETALHE_TESTE: GrupoExtrato[] = [
  {
    beneficiario: 'Maria da Silva', parentesco: 'Titular (você)', subtotal: 259.9,
    linhas: [
      { descricao: 'Mensalidade do plano', valor: 229.9 },
      { descricao: 'Taxa associativa', valor: 30 },
    ],
  },
  {
    beneficiario: 'João da Silva', parentesco: 'Filho', subtotal: 130,
    linhas: [
      { descricao: 'Mensalidade do plano', valor: 130 },
    ],
  },
]

const ITENS = [
  { descricao: 'Maria (você)', valor: 259.9 },
  { descricao: 'João (filho)', valor: 130 },
]
const VALOR = 389.9

function iso(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
}

function comDia(ano: number, mes: number, dia: number): Date {
  return new Date(ano, mes, dia)
}

/**
 * Monta as faturas de teste relativas a hoje, para a situação escolhida
 * em NUXT_MOCK_SITUACAO (aberta | vence-hoje | atrasada).
 */
export function faturasDeTeste(situacao: string, contrato?: ContratoCliente): Fatura[] {
  if (contrato?.situacao === 'cancelado' && contrato.fimVigencia) return faturasEncerradas(contrato.fimVigencia)
  const hoje = new Date()
  const alvo = (['aberta', 'vence-hoje', 'atrasada'] as SituacaoFatura[]).includes(situacao as SituacaoFatura)
    ? (situacao as SituacaoFatura)
    : 'aberta'

  let vencimentoAtual: Date
  if (alvo === 'vence-hoje') vencimentoAtual = comDia(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  else if (alvo === 'atrasada') vencimentoAtual = comDia(hoje.getFullYear(), hoje.getMonth() - 1, 10)
  else vencimentoAtual = comDia(hoje.getFullYear(), hoje.getMonth() + 1, 10)

  const lista: Fatura[] = [{
    id: 'f-' + iso(vencimentoAtual),
    mes: nomeDoMes(vencimentoAtual.getMonth()),
    valor: VALOR,
    vencimento: iso(vencimentoAtual),
    situacao: alvo,
    itens: ITENS,
  }]

  for (let i = 1; i <= 3; i++) {
    const venc = comDia(vencimentoAtual.getFullYear(), vencimentoAtual.getMonth() - i, 10)
    const paga = comDia(venc.getFullYear(), venc.getMonth(), 8)
    lista.push({
      id: 'f-' + iso(venc),
      mes: nomeDoMes(venc.getMonth()),
      valor: VALOR,
      vencimento: iso(venc),
      situacao: 'paga',
      pagaEm: iso(paga),
      itens: ITENS,
    })
  }
  return lista
}

/** Plano cancelado: só as últimas contas, todas pagas, até o mês em que terminou. */
function faturasEncerradas(fimVigencia: string): Fatura[] {
  const [ano, mes] = fimVigencia.split('-').map(Number) as [number, number]
  return [0, 1, 2].map((i) => {
    const venc = comDia(ano, mes - 1 - i, 10)
    return {
      id: 'f-' + iso(venc), mes: nomeDoMes(venc.getMonth()), valor: VALOR, vencimento: iso(venc),
      situacao: 'paga' as const, pagaEm: iso(comDia(venc.getFullYear(), venc.getMonth(), 8)), itens: ITENS,
    }
  })
}

function diasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return iso(d)
}

/**
 * Comunicados fictícios, datados em relação a hoje.
 * Os de inadimplência/suspensão apontam para uma mensalidade; o backend decide se estão vigentes.
 */
export function comunicadosDeTeste(faturas: Fatura[], contrato?: ContratoCliente): Omit<Comunicado, 'vigente'>[] {
  const email = mascararEmail(CONTATOS_TESTE.email)
  const celular = mascararTelefone(CONTATOS_TESTE.celular)

  // Titular do plano da empresa: só o que foi mandado para ele (sem conta nem cobrança).
  if (contrato?.tipo === 'empresarial' && contrato.papel === 'titular') {
    return [
      {
        id: 'c-empresa-carteirinha', tipo: 'informativo',
        titulo: 'Sua carteirinha digital está pronta',
        resumo: 'O número da carteirinha de cada pessoa da família está em "Minha família".',
        canal: 'email', enviadoEm: diasAtras(5), destino: email, novo: true,
        paragrafos: [
          'Olá, Maria!',
          `Você faz parte do plano de saúde da ${contrato.empresa ?? 'sua empresa'}.`,
          'O número da carteirinha de cada pessoa da sua família está no Portal do Cliente, em "Minha família". Mostre esse número no atendimento.',
        ],
      },
      {
        id: 'c-empresa-boas-vindas', tipo: 'informativo',
        titulo: 'Boas-vindas ao plano da empresa',
        resumo: 'Tudo o que você precisa saber para começar a usar o plano.',
        canal: 'email', enviadoEm: diasAtras(90), destino: email, novo: false,
        paragrafos: [
          'Olá, Maria! Que bom ter você com a gente.',
          'Seu plano já está ativo. Dúvidas sobre valores e descontos em folha são tratadas com o RH da sua empresa.',
        ],
      },
    ]
  }

  if (contrato?.situacao === 'cancelado') {
    return [{
      id: `c-cancelamento-${contrato.id}`, tipo: 'informativo',
      titulo: 'Confirmação do cancelamento do plano',
      resumo: `O ${contrato.plano} terminou em ${formatarData(contrato.fimVigencia ?? '')}.`,
      canal: 'carta', enviadoEm: contrato.fimVigencia ?? '', destino: 'Endereço do cadastro', novo: false,
      paragrafos: [
        'Prezada Maria,',
        `Confirmamos o cancelamento do ${contrato.plano}, com término em ${formatarData(contrato.fimVigencia ?? '')}.`,
        'Os documentos desse plano, como o informe de IR, continuam disponíveis no Portal do Cliente.',
      ],
    }]
  }
  const atrasada = faturas.find(f => f.situacao === 'atrasada')
  const antigaPaga = faturas.filter(f => f.situacao === 'paga').at(-1)

  const lista: Omit<Comunicado, 'vigente'>[] = []

  if (atrasada) {
    lista.push({
      id: 'c-inadimplencia-' + atrasada.id,
      tipo: 'inadimplencia', faturaId: atrasada.id,
      titulo: `Sua conta de ${atrasada.mes} está em atraso`,
      resumo: 'Pague o quanto antes para continuar usando o plano sem interrupção.',
      canal: 'email', enviadoEm: diasAtras(3), destino: email, novo: true,
      paragrafos: [
        'Olá, Maria.',
        `Não identificamos o pagamento da sua conta de ${atrasada.mes}, que venceu em ${dataPorExtenso(atrasada.vencimento)}.`,
        'Para evitar a suspensão do atendimento, pague o quanto antes. Pelo PIX, o pagamento é confirmado na hora.',
        'Se você já pagou, desconsidere esta mensagem: a confirmação pode levar até 3 dias úteis para boletos.',
      ],
    })
  }

  lista.push(
    {
      id: 'c-boleto', tipo: 'informativo',
      titulo: 'Sua conta do mês já está disponível',
      resumo: 'A conta do plano já pode ser paga por PIX ou boleto aqui no portal.',
      canal: 'email', enviadoEm: diasAtras(6), destino: email, novo: !atrasada,
      paragrafos: [
        'Olá, Maria!',
        'A conta do seu plano já está disponível. Você pode pagar por PIX, que é confirmado na hora, ou por boleto.',
        'Para pagar, entre no Portal do Cliente e toque em "Minhas contas".',
        'Se já pagou, pode desconsiderar esta mensagem.',
      ],
    },
    {
      id: 'c-reajuste', tipo: 'informativo',
      titulo: 'Aviso de reajuste anual do plano',
      resumo: 'Informamos o novo valor do plano a partir do próximo mês.',
      canal: 'carta', enviadoEm: diasAtras(20), destino: 'Endereço do cadastro', novo: false,
      paragrafos: [
        'Prezada Maria,',
        'Informamos que o seu plano terá o reajuste anual previsto em contrato a partir do próximo mês.',
        'O novo valor já aparece nas suas próximas contas. Em caso de dúvida, fale com a gente pelos canais de atendimento.',
      ],
    },
    {
      id: 'c-senha', tipo: 'informativo',
      titulo: 'Senha nova enviada',
      resumo: 'Enviamos uma senha para você entrar no portal.',
      canal: 'sms', enviadoEm: diasAtras(45), destino: celular, novo: false,
      paragrafos: [
        'Portal do Cliente: sua senha para entrar foi enviada. Depois de entrar, crie uma senha só sua.',
        'Se não foi você quem pediu, fale com a gente.',
      ],
    },
  )

  if (antigaPaga) {
    lista.push({
      id: 'c-inadimplencia-' + antigaPaga.id,
      tipo: 'inadimplencia', faturaId: antigaPaga.id,
      titulo: `Lembrete: conta de ${antigaPaga.mes} em aberto`,
      resumo: 'Aviso de atraso de uma conta que já foi paga.',
      canal: 'sms', enviadoEm: diasAtras(95), destino: celular, novo: false,
      paragrafos: [
        `Portal do Cliente: a sua conta de ${antigaPaga.mes} ainda estava em aberto. Pague pelo portal com PIX ou boleto.`,
      ],
    })
  }

  lista.push({
    id: 'c-boas-vindas', tipo: 'informativo',
    titulo: 'Boas-vindas ao seu plano',
    resumo: 'Tudo o que você precisa saber para começar a usar o plano.',
    canal: 'email', enviadoEm: diasAtras(120), destino: email, novo: false,
    paragrafos: [
      'Olá, Maria! Que bom ter você com a gente.',
      'Seu plano já está ativo. No Portal do Cliente você acompanha suas contas e fala com o atendimento sempre que precisar.',
      'Guarde este e-mail: ele tem as informações principais do seu contrato.',
    ],
  })

  return lista
}

export const PIX_TESTE = '00020126360014BR.GOV.BCB.PIX0114+5500000000000520400005303986540638990' +
  '5802BR5920PORTAL TESTE VEXUR6009SAO PAULO62070503***6304ABCD'

export const LINHA_DIGITAVEL_TESTE = '00000.00000 00000.000000 00000.000000 0 00000000000000'
