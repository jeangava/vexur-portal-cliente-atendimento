/** Tipos de arquivo aceitos nos documentos da inclusão. */
export const DOCUMENTO_TIPOS = ['image/jpeg', 'image/png', 'application/pdf']
export const DOCUMENTO_TAMANHO_MAX = 5 * 1024 * 1024

/** Até quantos dias depois do evento (nascimento, casamento, tutela) a inclusão costuma ser sem carência. */
export const DIAS_INCLUSAO_POR_EVENTO = 30

export type ErrosEvento = Partial<Record<
  'evento' | 'dataEvento' | 'parentesco' | 'temPlanoAnterior' | 'tipoPlano' | 'operadora' | 'plano' | 'meses' | 'ultimoPagamento',
  string
>>
export type ErrosPessoa = Partial<Record<'nome' | 'cpf' | 'nascimento', string>>

export interface DadosEvento {
  evento: 'sim' | 'nao' | ''
  dataEvento: string
  parentesco: string
  /** Só no caminho "Não": o dependente tinha plano de saúde antes? */
  temPlanoAnterior: 'sim' | 'nao' | ''
  planoAnterior: { tipo: string, operadora: string, plano: string, meses: string, ultimoPagamento: string }
}

function lerData(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(a!, m! - 1, d!)
  return data.getFullYear() === a && data.getMonth() === m! - 1 && data.getDate() === d ? data : null
}

/** Mensagem para uma data que deve existir, não ser futura e não ser absurda. */
function problemaNaData(iso: string, vazio: string, hoje: Date): string | undefined {
  if (!iso) return vazio
  const data = lerData(iso)
  if (!data) return 'Essa data não existe. Confira o dia e o mês.'
  if (data > hoje) return 'A data não pode ser no futuro.'
  if (data.getFullYear() < hoje.getFullYear() - 120) return 'Confira o ano.'
  return undefined
}

/** Dias entre a data (AAAA-MM-DD) e hoje. */
export function diasDesde(iso: string, hoje = new Date()): number {
  const data = lerData(iso)
  if (!data) return 0
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((inicioHoje.getTime() - data.getTime()) / 86_400_000)
}

/** Etapa 1 (Evento). Usada na tela e no servidor. */
export function validarEventoInclusao(
  dados: DadosEvento,
  opcoes: { parentescosEvento: string[], parentescosOutros: string[], tiposPlanoAnterior: string[] },
  hoje = new Date(),
): ErrosEvento {
  const erros: ErrosEvento = {}
  if (dados.evento !== 'sim' && dados.evento !== 'nao') {
    erros.evento = 'Escolha o tipo de inclusão.'
    return erros
  }

  if (dados.evento === 'sim') {
    const e = problemaNaData(dados.dataEvento, 'Informe a data do evento.', hoje)
    if (e) erros.dataEvento = e
    if (!opcoes.parentescosEvento.includes(dados.parentesco)) erros.parentesco = 'Selecione o parentesco.'
    return erros
  }

  if (!opcoes.parentescosOutros.includes(dados.parentesco)) erros.parentesco = 'Selecione o parentesco.'
  if (dados.temPlanoAnterior !== 'sim' && dados.temPlanoAnterior !== 'nao') {
    erros.temPlanoAnterior = 'Responda se o dependente tinha plano de saúde antes.'
    return erros
  }
  // Sem plano anterior: segue direto para o cadastro.
  if (dados.temPlanoAnterior === 'nao') return erros

  const p = dados.planoAnterior
  if (!opcoes.tiposPlanoAnterior.includes(p.tipo)) erros.tipoPlano = 'Escolha o tipo do plano anterior.'
  if (p.operadora.trim().length < 2) erros.operadora = 'Informe a operadora do plano anterior.'
  if (p.plano.trim().length < 2) erros.plano = 'Informe o nome do plano anterior.'
  const meses = Number(p.meses)
  if (!p.meses) erros.meses = 'Informe por quantos meses teve o plano.'
  else if (!Number.isInteger(meses) || meses < 1 || meses > 1200) erros.meses = 'Digite só o número de meses (ex.: 24).'
  const u = problemaNaData(p.ultimoPagamento, 'Informe a data do último pagamento.', hoje)
  if (u) erros.ultimoPagamento = u
  return erros
}

/** Etapa 2 (Cadastro): dados da pessoa. Usada na tela e no servidor. */
export function validarPessoaInclusao(
  dados: { nome: string, cpf: string, nascimento: string },
  hoje = new Date(),
): ErrosPessoa {
  const erros: ErrosPessoa = {}
  const nome = dados.nome.trim().replace(/\s+/g, ' ')
  if (!nome) erros.nome = 'Digite o nome completo da pessoa.'
  else if (nome.split(' ').length < 2) erros.nome = 'Digite o nome e o sobrenome, como está no documento.'

  const problemaCpf = problemaNoCpf(dados.cpf)
  if (problemaCpf) erros.cpf = problemaCpf.replace('o seu CPF', 'o CPF da pessoa')

  const n = problemaNaData(dados.nascimento, 'Informe a data de nascimento.', hoje)
  if (n) erros.nascimento = n.replace('A data', 'A data de nascimento')
  return erros
}

export const SITUACAO_SOLICITACAO = {
  'em-analise': { rotulo: 'Em análise', classe: 'bg-info-claro text-info', borda: 'border-info-borda', icone: 'relogio' },
  'pendente': { rotulo: 'Falta algo seu', classe: 'bg-atencao-claro text-atencao', borda: 'border-atencao-borda', icone: 'alerta' },
  'indeferida': { rotulo: 'Não aprovado', classe: 'bg-erro-claro text-erro', borda: 'border-erro-borda', icone: 'fechar' },
  'concluida': { rotulo: 'Concluída', classe: 'bg-ok-claro text-ok', borda: 'border-transparent', icone: 'certo' },
} as const

/** Pedido que ainda pode mudar (conta como "em andamento", ex.: bloqueia outro pedido igual). */
export function solicitacaoEmAberto(situacao: keyof typeof SITUACAO_SOLICITACAO): boolean {
  return situacao === 'em-analise' || situacao === 'pendente'
}
