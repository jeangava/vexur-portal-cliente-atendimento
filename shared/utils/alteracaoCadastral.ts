import type { CampoAlteravel, RegraDaAlteracao } from '../types/portal'

/**
 * Alteração de dados cadastrais pelo cliente.
 * Cada alteração segue a regra "Serviços online": muda na hora (Imediato) ou vira um PEDIDO que a
 * administradora avalia (Sob aprovação). Quem decide é `decidirAlteracao` (regraServicosOnline.ts);
 * `regraDoCampo` fica só como a regra padrão quando não houver a da API.
 */

export interface CampoDoFormulario {
  id: string
  rotulo: string
  /** Texto de ajuda curto */
  dica?: string
  tipo: 'texto' | 'email' | 'telefone' | 'cep' | 'uf' | 'data' | 'selecao' | 'sus'
  obrigatorio: boolean
  maximo: number
  minimo?: number
  /** Para "selecao": as opções. Com `aceitaOutro`, o valor que já está cadastrado também vale. */
  opcoes?: string[]
  aceitaOutro?: boolean
}

export interface DefinicaoDeAlteracao {
  id: CampoAlteravel
  rotulo: string
  descricao: string
  campos: CampoDoFormulario[]
}

export const SEXOS = ['Feminino', 'Masculino']
export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Separado(a)', 'Viúvo(a)', 'União estável']

export const ALTERACOES_POSSIVEIS: DefinicaoDeAlteracao[] = [
  {
    id: 'dados', rotulo: 'Dados cadastrais', descricao: 'Nome, data de nascimento, sexo, estado civil e nome da mãe.',
    campos: [
      { id: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true, maximo: 120, minimo: 3 },
      { id: 'nascimento', rotulo: 'Data de nascimento', tipo: 'data', obrigatorio: true, maximo: 10 },
      { id: 'sexo', rotulo: 'Sexo', tipo: 'selecao', obrigatorio: true, maximo: 20, opcoes: SEXOS, aceitaOutro: true },
      { id: 'estadoCivil', rotulo: 'Estado civil', tipo: 'selecao', obrigatorio: false, maximo: 30, opcoes: ESTADOS_CIVIS, aceitaOutro: true },
      { id: 'nomeMae', rotulo: 'Nome da mãe', tipo: 'texto', obrigatorio: true, maximo: 120, minimo: 3 },
      { id: 'cartaoSus', rotulo: 'Cartão Nacional de Saúde', dica: '15 números, se tiver', tipo: 'sus', obrigatorio: false, maximo: 15 },
    ],
  },
  {
    id: 'email', rotulo: 'E-mail', descricao: 'Para onde mandamos avisos e documentos.',
    campos: [{ id: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, maximo: 120 }],
  },
  {
    id: 'celular', rotulo: 'Celular', descricao: 'O número que recebe SMS e mensagens.',
    campos: [{ id: 'celular', rotulo: 'Celular', dica: 'Com DDD', tipo: 'telefone', obrigatorio: true, maximo: 16 }],
  },
  {
    id: 'telefone', rotulo: 'Telefone fixo', descricao: 'Um telefone de contato alternativo.',
    campos: [{ id: 'telefone', rotulo: 'Telefone', dica: 'Com DDD', tipo: 'telefone', obrigatorio: true, maximo: 16 }],
  },
  {
    id: 'endereco', rotulo: 'Endereço', descricao: 'Digite o CEP: rua, bairro, cidade e estado vêm sozinhos. Você ajusta o número e o complemento.',
    campos: [
      { id: 'cep', rotulo: 'CEP', tipo: 'cep', obrigatorio: true, maximo: 9 },
      { id: 'logradouro', rotulo: 'Rua, avenida...', tipo: 'texto', obrigatorio: true, maximo: 120 },
      { id: 'numero', rotulo: 'Número', tipo: 'texto', obrigatorio: true, maximo: 12 },
      { id: 'complemento', rotulo: 'Complemento', dica: 'Opcional', tipo: 'texto', obrigatorio: false, maximo: 60 },
      { id: 'bairro', rotulo: 'Bairro', tipo: 'texto', obrigatorio: true, maximo: 80 },
      { id: 'municipio', rotulo: 'Cidade', tipo: 'texto', obrigatorio: true, maximo: 80 },
      { id: 'uf', rotulo: 'Estado (sigla)', tipo: 'uf', obrigatorio: true, maximo: 2 },
    ],
  },
]

export function definicaoDaAlteracao(campo: string): DefinicaoDeAlteracao | undefined {
  return ALTERACOES_POSSIVEIS.find(a => a.id === campo)
}

/** Regra padrão: pode pedir, vai para aprovação, sem documento. A decisão de verdade vem da regra "Serviços online". */
export function regraDoCampo(campo: CampoAlteravel): RegraDaAlteracao {
  return { campo, permitido: true, exigeAprovacao: true, exigeDocumento: false }
}

const somenteNumeros = (v: string) => v.replace(/\D/g, '')

function dataValida(iso: string, hoje = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return false
  return iso >= '1900-01-01' && d.getTime() <= hoje.getTime()
}

/** Confere o que o cliente digitou. Devolve a explicação em linguagem simples, ou null se está certo. */
export function problemaNaAlteracao(campo: string, valores: Record<string, unknown>): string | null {
  const def = definicaoDaAlteracao(campo)
  if (!def) return 'Escolha o que você quer alterar.'
  for (const c of def.campos) {
    const valor = String(valores[c.id] ?? '').trim()
    if (!valor) {
      if (c.obrigatorio) return `Preencha: ${c.rotulo.toLowerCase()}.`
      continue
    }
    if (valor.length > c.maximo) return `${c.rotulo} está grande demais.`
    if (c.minimo && valor.length < c.minimo) return `${c.rotulo} está curto demais.`
    if (c.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) return 'Esse e-mail não parece certo. Confira e tente de novo.'
    if (c.tipo === 'telefone') {
      const n = somenteNumeros(valor)
      if (n.length < 10 || n.length > 11) return `${c.rotulo} precisa ter o DDD e o número (10 ou 11 números).`
    }
    if (c.tipo === 'cep' && somenteNumeros(valor).length !== 8) return 'O CEP tem 8 números.'
    if (c.tipo === 'uf' && !/^[A-Za-z]{2}$/.test(valor)) return 'Digite a sigla do estado, com 2 letras (ex.: SP).'
    if (c.tipo === 'data' && !dataValida(valor)) return `${c.rotulo} não parece certa.`
    if (c.tipo === 'sus' && somenteNumeros(valor).length !== 15) return 'O Cartão Nacional de Saúde tem 15 números.'
    if (c.tipo === 'selecao' && c.opcoes && !c.aceitaOutro && !c.opcoes.includes(valor)) return `Escolha uma das opções de ${c.rotulo.toLowerCase()}.`
  }
  return null
}

/** Só os campos combinados, limpos (nada a mais que a tela mande). */
export function valoresDaAlteracao(campo: string, valores: Record<string, unknown>): Record<string, string> {
  const def = definicaoDaAlteracao(campo)
  const limpo: Record<string, string> = {}
  for (const c of def?.campos ?? []) {
    const v = String(valores[c.id] ?? '').trim()
    if (v) limpo[c.id] = c.tipo === 'uf' ? v.toUpperCase() : c.tipo === 'sus' ? somenteNumeros(v) : v
  }
  return limpo
}

/** Título curto do pedido. Ex.: "Alterar e-mail". */
export function tituloDaAlteracao(campo: string): string {
  return `Alterar ${(definicaoDaAlteracao(campo)?.rotulo ?? 'dados').toLowerCase()}`
}
