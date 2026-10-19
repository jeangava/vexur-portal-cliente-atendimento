import { describe, expect, it } from 'vitest'
import { nomeDoMes } from '../shared/utils/formato'
import { contratoAutomatico, simplificarContratos } from '../shared/utils/contratos'
import { somenteDigitos } from '../shared/utils/cpf'
import { COBRANCAS_FALSAS, CONTRATO_FALSO, LOGIN_FALSO } from './fakes/respostas-gateway'

// Funções de shared/utils chegam por auto-import no Nuxt; aqui injetamos manualmente.
Object.assign(globalThis, { nomeDoMes, somenteDigitos })
const m = await import('../server/utils/mapeamento')

const HOJE = new Date(2026, 8, 30, 12)
const ms = (iso: string) => new Date(`${iso}T12:00:00`).getTime()

describe('datas do backend', () => {
  it('aceita milissegundos, ISO, AAAAMMDD e DD/MM/AAAA', () => {
    expect(m.paraDataIso(new Date(2026, 9, 10, 12).getTime())).toBe('2026-10-10')
    expect(m.paraDataIso('2026-10-10T03:00:00Z')).toBe('2026-10-10')
    expect(m.paraDataIso('20261010')).toBe('2026-10-10')
    expect(m.paraDataIso('10/10/2026')).toBe('2026-10-10')
    expect(m.paraDataIso(null)).toBe('')
  })
})

describe('login', () => {
  it('traz todos os contratos do titular, ativos e cancelados', () => {
    const r = m.mapearLogin(LOGIN_FALSO, HOJE)!
    expect(r.pessoa).toEqual({ nome: 'ANA TESTE SOUZA', primeiroNome: 'Ana' })
    expect(r.contratos.map(c => [c.cliente.numero, c.cliente.situacao, c.cliente.plano])).toEqual([
      ['202200001.001', 'cancelado', 'PLANO ANTIGO'],
      ['202400002.001', 'ativo', 'Saúde Bem'],
    ])
    expect(r.contratos[0]!.cliente.fimVigencia).toBe('2020-01-01')
    expect(r.contratos[1]!.gateway).toEqual({ idContratoAdesao: 222, numeroContrato: '202400002.001', tipoContratacao: 'ADESÃO' })
  })

  it('lê o tipo do contrato pela marcação', () => {
    expect(m.tipoDoContrato('COLETIVO EMPRESARIAL')).toBe('empresarial')
    expect(m.tipoDoContrato(null, 'INDIVIDUAL/FAMILIAR')).toBe('individual')
    expect(m.tipoDoContrato('ADESÃO')).toBe('adesao')
  })

  it('sem token não entra', () => {
    expect(m.mapearLogin({ ...LOGIN_FALSO, token: null }, HOJE)).toBeNull()
  })

  it('responsável de PME: ignora contratos dos funcionários e contrato repetido', () => {
    const contrato = (numero: string, cpf: string, nome: string) => ({
      idContratoAdesao: Number(numero), numeroContrato: numero, tipoContratacao: 'COLETIVO EMPRESARIAL',
      proponentes: [{ cpf, parentesco: 'TITULAR', nome, dataFim: ms('2025-04-19'), produto: [{ nomePlano: 'Estilo' }] }],
    })
    const r = m.mapearLogin({
      token: 't',
      propostaAdesao: [
        contrato('10', '111.222.333-44', 'RESPONSAVEL'),
        contrato('10', '111.222.333-44', 'RESPONSAVEL'),
        contrato('11', '555.666.777-88', 'FUNCIONARIO'),
      ],
    }, HOJE, '111.222.333-44')!
    expect(r.contratos.map(c => c.cliente.numero)).toEqual(['10'])
    expect(r.pessoa.nome).toBe('RESPONSAVEL')
  })

  it('titular que também é responsável da empresa: ganha a entrada de responsável, sem os funcionários', () => {
    const empresa = { nomeFantasia: 'AGM TESTE', conveniado: { id: 77, numeroContrato: 'PME-1', dataInicio: ms('2020-01-01'), dataFim: null } }
    const contrato = (numero: string, cpf: string, nome: string) => ({
      idContratoAdesao: Number(numero), numeroContrato: numero, tipoContratacao: 'COLETIVO EMPRESARIAL', conveniado: empresa,
      proponentes: [{ cpf, parentesco: 'TITULAR', nome, dataFim: null, produto: [{ nomePlano: 'Estilo' }] }],
    })
    const r = m.mapearLogin({
      token: 't',
      propostaAdesao: [
        contrato('10', '111.222.333-44', 'RESPONSAVEL TESTE'),
        contrato('11', '555.666.777-88', 'FUNCIONARIO 1'),
        contrato('12', '999.888.777-66', 'FUNCIONARIO 2'),
      ],
    }, HOJE, '111.222.333-44')!
    expect(r.pessoa.nome).toBe('RESPONSAVEL TESTE')
    expect(r.contratos.map(c => [c.cliente.numero, c.cliente.papel, c.cliente.contratoEmpresa])).toEqual([
      ['10', 'titular', 'PME-1'],
      ['PME-1', 'representante', 'PME-1'],
    ])
    expect(r.contratos[1]!.gateway).toEqual({ idContratoAdesao: 0, idContratoConveniado: 77, numeroContrato: 'PME-1', tipoContratacao: 'EMPRESARIAL' })
    // Na mesma empresa, só fica a visão de responsável, e como é um contrato só ela abre direto.
    const lista = simplificarContratos(r.contratos.map(c => c.cliente))
    expect(lista.map(c => c.papel)).toEqual(['representante'])
    expect(contratoAutomatico(lista)?.papel).toBe('representante')
  })

  it('mostra o plano PRINCIPAL mesmo quando o opcional vem primeiro', () => {
    const r = m.mapearLogin({
      token: 't',
      propostaAdesao: [{
        idContratoAdesao: 1, numeroContrato: '1', tipoContratacao: 'COLETIVO EMPRESARIAL',
        proponentes: [{
          parentesco: 'TITULAR', nome: 'ANA',
          produto: [
            { nomeAmigavelProduto: 'Odonto Opcional', tipoContratacao: 'Adicional' },
            { nomeAmigavelProduto: 'Saúde Principal', caracteristicaProduto: 'Principal' },
          ],
        }],
      }],
    }, HOJE)!
    expect(r.contratos[0]!.cliente).toMatchObject({ plano: 'Saúde Principal', tipo: 'empresarial' })
  })
})

describe('lista de beneficiários da empresa (sob demanda)', () => {
  const linhas = [
    { numeroContrato: 202200002.001, nome: 'ZELIA TESTE', dependentes: 1, produto: 'Saúde Bem', dataInicioContrato: ms('2023-01-10'), dataFimContrato: null },
    { numeroContrato: 202200001.001, nome: 'ANA TESTE', dependentes: 3, produto: 'Saúde Bem', dataInicioContrato: ms('2022-05-10'), dataFimContrato: null },
    { numeroContrato: 202200001.001, nome: 'ANA TESTE', dependentes: 3, produto: 'Saúde Bem', dataInicioContrato: ms('2022-05-10'), dataFimContrato: null },
    { numeroContrato: 202200003.001, nome: 'BETO TESTE', dependentes: 1, produto: 'Odonto', dataInicioContrato: ms('2022-05-10'), dataFimContrato: ms('2025-01-10') },
  ]

  it('aceita a resposta do serviço em qualquer forma conhecida', () => {
    expect(m.linhasDoObterPme({ dados: linhas })).toHaveLength(4)
    expect(m.linhasDoObterPme([{ dados: linhas }])).toHaveLength(4)
    expect(m.linhasDoObterPme(linhas)).toHaveLength(4)
    expect(m.linhasDoObterPme(null)).toEqual([])
  })

  it('lista só os titulares, ordenados, sem repetir, com a contagem de dependentes', () => {
    const e = m.mapearTitularesEmpresa(linhas, 'AGM TESTE', HOJE)
    expect(e.dependentesSobDemanda).toBe(true)
    expect(e.titulares.map(t => [t.nome, t.situacao, t.totalDependentes])).toEqual([
      ['ANA TESTE', 'ativo', 2], ['BETO TESTE', 'cancelado', 0], ['ZELIA TESTE', 'ativo', 0],
    ])
    expect(e.resumo).toMatchObject({ titulares: 2, dependentes: 2, vidas: 4, cancelados: 1 })
    expect(e.planos).toEqual(['Odonto', 'Saúde Bem'])
    expect(e.titulares[0]!.dependentes).toEqual([])
  })

  it('titular que saiu: as duas linhas do contrato viram uma só, cancelada, com os dependentes certos', () => {
    const e = m.mapearTitularesEmpresa([
      { numeroContrato: 202200009.001, nome: 'MONIC TESTE', dependentes: 1, produto: 'Saúde Bem', dataInicioContrato: ms('2022-05-10'), dataFimContrato: ms('2026-06-30') },
      { numeroContrato: 202200009.001, nome: 'MONIC TESTE', dependentes: 2, produto: 'Saúde Bem', dataInicioContrato: ms('2022-06-10'), dataFimContrato: null },
    ], 'AGM TESTE', HOJE)
    expect(e.titulares).toHaveLength(1)
    expect(e.titulares[0]).toMatchObject({ situacao: 'cancelado', fimVigencia: '2026-06-30', totalDependentes: 2, inicioVigencia: '2022-05-10' })
  })

  it('na família, o plano principal vem em "plano" e os demais em "opcionais"', () => {
    const f = m.mapearFamiliaDaEmpresa({
      id: 1, numeroContrato: '1',
      beneficiarios: [{
        id: 1, nome: 'ANA', parentesco: 'TITULAR',
        produto: [
          { nomePlano: 'Odonto', tipoContratacao: 'Adicional' },
          { nomePlano: 'Saúde Principal', caracteristicaProduto: 'Principal' },
        ],
      }],
    }, HOJE)
    expect(f.titular).toMatchObject({ plano: 'Saúde Principal', opcionais: ['Odonto'] })
  })

  it('família de um titular: CPF, carteirinha e dependentes ativos e cancelados', () => {
    const f = m.mapearFamiliaDaEmpresa({
      id: 1, numeroContrato: '202200001.001',
      beneficiarios: [
        { id: 1, nome: 'ANA', cpf: '52998224725', parentesco: 'TITULAR', dataInicio: ms('2022-05-10'), produto: [{ nomePlano: 'Saúde Bem', numeroCartaoIdentificacao: 'C-1' }] },
        { id: 2, nome: 'BIA', parentesco: 'FILHO(A)', dataInicio: ms('2022-05-10'), produto: [{ nomePlano: 'Saúde Bem', numeroCartaoIdentificacao: 'C-2' }] },
        { id: 3, nome: 'CAIO', parentesco: 'FILHO(A)', dataInicio: ms('2022-05-10'), dataFim: ms('2024-01-01'), produto: [{ nomePlano: 'Saúde Bem' }] },
      ],
    }, HOJE)
    expect(f.titular).toMatchObject({ nome: 'ANA', cpf: '529.982.247-25', numeroCarteirinha: 'C-1', titular: true })
    expect(f.dependentes.map(d => [d.nome, d.situacao])).toEqual([['BIA', 'ativo'], ['CAIO', 'cancelado']])
  })
})

describe('comunicados já enviados (cópias)', () => {
  it('mapeia e-mail e SMS, mascara o destino, tira HTML e ordena do mais novo', () => {
    const lista = m.mapearComunicados([
      { id: 1, tipo: 'e-mail', destinatarios: 'maria.silva@email.com', assunto: 'Sua mensalidade', texto: '<p>Olá!</p><p>Pague até dia 10.</p>', dataEnvio: ms('2026-09-01') },
      { id: 2, tipo: 'sms', celulares: ['11987654321'], texto: 'Seu plano foi atualizado.', dataEnvio: ms('2026-09-25') },
      { id: 3, tipo: 'e-mail', assunto: '', texto: '', dataEnvio: ms('2026-09-26') },
    ], HOJE)
    expect(lista.map(c => c.id)).toEqual(['2', '1'])
    expect(lista[0]).toMatchObject({ canal: 'sms', destino: '(••) •••••-4321', novo: true, titulo: 'Seu plano foi atualizado.' })
    expect(lista[1]).toMatchObject({ canal: 'email', titulo: 'Sua mensalidade', novo: false, vigente: false })
    expect(lista[1]!.destino).toMatch(/@email\.com$/)
    expect(lista[1]!.paragrafos).toEqual(['Olá!', 'Pague até dia 10.'])
  })
})

describe('comunicados do contrato (Serviços)', () => {
  it('reconhece os serviços conhecidos e dá nome aos demais', () => {
    expect(m.idDoServicoPorComunicado('IRPF')).toBe('irpf')
    expect(m.idDoServicoPorComunicado('DECLAÇÃO ANUAL DE DÉBITO')).toBe('quitacao-anual')
    expect(m.idDoServicoPorComunicado('CARTA DE BOAS VINDAS')).toBe('boas-vindas')
    expect(m.idDoServicoPorComunicado('RN412')).toBeUndefined()
    expect(m.tituloDoComunicado('CARTA DE COBERTURA PARCIAL TEMPORÁRIA')).toBe('Carta de cobertura parcial temporária')
    expect(m.idDoComunicado('SOLICITAÇÃO DE 2 VIA BOLETO')).toBe('com-solicitacao-de-2-via-boleto')
  })

  it('a carta de tempo de permanência nunca aparece', () => {
    expect(m.comunicadoProibido('CARTA DE TEMPO DE PERMANÊNCIA')).toBe(true)
    expect(m.comunicadoProibido('carta de permanencia')).toBe(true)
    expect(m.comunicadoProibido('CARTA DE BOAS VINDAS')).toBe(false)
  })
})

describe('dados cadastrais (só leitura)', () => {
  it('separa e-mails, telefones e endereços, sem repetir, e esconde a conta', () => {
    const c = m.mapearCadastroDoContrato({
      id: 1, numeroContrato: '1',
      meiosContatos: [
        { tipo: 'e-mail', endereco: 'ana@email.com' },
        { tipo: 'e-mail', endereco: 'ana@email.com' },
        { tipo: 'telefone-celular', numero: '11987654321' },
        { tipo: 'telefone-residencial', numero: '1130000000' },
        { logradouro: 'Rua A', numero: '10', bairro: 'Centro', municipio: 'São Paulo', uf: 'SP', cep: '01000-000', enderecoCobranca: true },
      ],
      dadosBancarios: [
        { modalidadeCobranca: 'Débito automático', banco: '341', agencia: '1234', digitoAgencia: '5', conta: '246810', digitoConta: '3', tipoDadosBancarios: ['Dados para cobrança'], identificadorDebitoAutomatico: 'X' },
        { modalidadeCobranca: 'Outro', conta: '111111', tipoDadosBancarios: ['Reembolso'] },
      ],
      responsavelFinanceiro: { nome: 'ANA', cpf: '52998224725' },
    }, { pagamento: true })
    expect(c.contatos.map(x => [x.tipo, x.valor])).toEqual([['email', 'ana@email.com'], ['celular', '11987654321'], ['telefone', '1130000000']])
    expect(c.enderecos[0]).toMatchObject({ rotulo: 'Endereço de cobrança', linhas: ['Rua A, 10', 'Centro · São Paulo/SP', 'CEP 01000-000'] })
    // O mesmo endereço em campos separados, para o formulário de alteração já vir preenchido.
    expect(c.enderecos[0]!.campos).toEqual({ cep: '01000-000', logradouro: 'Rua A', numero: '10', bairro: 'Centro', municipio: 'São Paulo', uf: 'SP' })
    expect(c.pagamento).toHaveLength(1)
    expect(c.pagamento[0]!.detalhes.find(d => d.rotulo === 'Conta')?.valor).toBe('•••810-3')
    expect(JSON.stringify(c)).not.toContain('246810')
    expect(c.responsaveis[0]).toMatchObject({ papel: 'Responsável financeiro', nome: 'ANA' })
    // Titular de empresa (sem valores): nada de pagamento.
    expect(m.mapearCadastroDoContrato({ id: 1, numeroContrato: '1', dadosBancarios: [{ conta: '1' }] }, { pagamento: false }).pagamento).toEqual([])
  })

  it('dados pessoais só com o que existe; empresa e responsável a partir da linha do serviço', () => {
    expect(m.dadosPessoaisDe({ id: 1, cpf: '52998224725', dataNascimento: ms('1990-05-17'), sexo: 'FEMININO', nomeMae: 'MARIA' })).toEqual({
      cpf: '529.982.247-25', nascimento: '1990-05-17', sexo: 'Feminino', nomeMae: 'MARIA',
    })
    const e = m.mapearCadastroDaEmpresa({
      dataInicio: ms('2022-03-01'),
      pessoaJuridica: { nomeFantasia: 'AGM', cnpj: '29.277.135/0001-80', email: 'rh@agm.com', responsavelEmpresaNome: 'JOÃO', responsavelEmpresaCpf: '52998224725', responsavelEmpresaCelular: '11999990000' },
      dadosBancarios: [{ modalidadeCobranca: 'Boleto', conta: '55555' }],
    })!
    expect(e.empresa.map(x => x.rotulo)).toEqual(['Nome fantasia', 'CNPJ', 'Contrato desde'])
    expect(e.representante).toMatchObject({ nome: 'JOÃO' })
    expect(e.representante!.detalhes.map(d => d.rotulo)).toEqual(['CPF', 'Telefone'])
    expect(e.contatos[0]).toMatchObject({ tipo: 'email', valor: 'rh@agm.com' })
    expect(m.mapearCadastroDaEmpresa({})).toBeNull()
  })

  it('beneficiário suspenso: com data de suspensão e sem ter saído', () => {
    const f = m.mapearFamiliaDaEmpresa({
      id: 1, numeroContrato: '1',
      beneficiarios: [
        { id: 1, nome: 'ANA', parentesco: 'TITULAR', dataSuspensao: ms('2026-08-01'), produto: [{ nomePlano: 'X' }] },
        { id: 2, nome: 'BIA', parentesco: 'FILHO(A)', dataSuspensao: ms('2026-08-01'), dataFim: ms('2026-09-01'), produto: [{ nomePlano: 'X' }] },
      ],
    }, HOJE)
    expect(f.titular.suspenso).toBe(true)
    expect(f.dependentes[0]!.suspenso).toBeUndefined()
  })
})

describe('documentos dos Serviços', () => {
  it('cada tipo vai para o serviço certo, com os campos certos', async () => {
    const r = await import('../server/utils/servicosRotas')
    expect(r.rotaDoServico('CARTA DE BOAS VINDAS')?.caminho).toBe('/carteirinha/enviar-boas-vindas')
    expect(r.rotaDoServico('CARTA DE BOAS VINDAS - PME')).toMatchObject({ caminho: '/carteirinha/enviar-boas-vindas-empresarial', paraEmpresa: true })
    expect(r.rotaDoServico('DECLARAÇÃO ANUAL DE DÉBITO')).toMatchObject({ caminho: '/enviar-declaracao-anual-debito', campos: ['ano'] })
    expect(r.rotaDoServico('QUITAÇÃO DE DÉBITO')).toMatchObject({ caminho: '/enviar-carta-quitacao-debito', campos: ['competencia'] })
    // 2ª via de boleto e informe de movimentação não ficam em Serviços (são tratados em Contas e em Movimentação).
    expect(r.rotaDoServico('SOLICITAÇÃO DE 2 VIA BOLETO')).toBeUndefined()
    expect(r.rotaDoServico('INFORME DE MOVIMENTAÇÃO CADASTRAL')).toBeUndefined()
    expect(r.rotaDoServico('QUITAÇÃO DE DÉBITO')?.valores).toBe(true)
    expect(r.rotaDoServico('IRPF')?.caminho).toBe('/enviar-declaracao-imposto-renda')
    expect(r.rotaDoServico('EXTRATO DE COBRANÇA')?.caminho).toBe('/enviar-extrato-cobranca')
    // Tipos que o portal não gera (ainda): não têm rota.
    expect(r.rotaDoServico('RN412')).toBeUndefined()
    expect(r.rotaDoServico('CARTA TEMPO PERMANÊNCIA')).toBeUndefined()
  })

  it('a competência da quitação vai como instante do dia 1º do mês, não como texto', async () => {
    const r = await import('../server/utils/servicosRotas')
    expect(r.competenciaEmMs('02/2026')).toBe(Date.UTC(2026, 1, 1, 3))
    expect(r.competenciaEmMs('texto')).toBeUndefined()
    const corpo = r.rotaDoServico('QUITAÇÃO DE DÉBITO')!.corpo({ tipoComunicacao: 'QUITAÇÃO DE DÉBITO', idContratoAdesao: 5 }, { competencia: '02/2026' }) as { payload: Record<string, unknown> }
    expect(corpo.payload.competencia).toBe(Date.UTC(2026, 1, 1, 3))
  })

  it('o corpo do pedido leva só o contrato da sessão e os campos combinados', async () => {
    const r = await import('../server/utils/servicosRotas')
    const rota = r.rotaDoServico('IRPF')!
    const corpo = rota.corpo({ tipoComunicacao: 'IRPF', idContratoAdesao: 77 }, { ano: '2025', competencia: undefined, intruso: 'x' } as never) as { tipoComunicacao: string, payload: Record<string, unknown> }
    expect(corpo.payload).toMatchObject({ idContratoAdesao: 77, gerarVisualizacao: true, destinatarios: '', ano: '2025' })
    expect(corpo.payload).not.toHaveProperty('intruso')
    expect(m.comunicadoProibido('CARTA TEMPO PERMANÊNCIA')).toBe(true)
    expect(m.comunicadoProibido('DECLARAÇÃO DE PERMANÊNCIA')).toBe(true)
  })
})

describe('extrato da empresa (PME)', () => {
  it('agrupa por pessoa e chama a taxa da empresa de "Empresa"', () => {
    const grupos = m.mapearGruposExtrato({
      lancamentos: [
        { nome: 'ANA', parentesco: 'TITULAR', plano: 'Saúde', tipoLancamento: 'Mensalidade', valorComercial: 100 },
        { nome: 'BIA', parentesco: 'FILHO(A)', plano: 'Saúde', tipoLancamento: 'Mensalidade', valorComercial: 50.5 },
        { nome: 'AGM TESTE', parentesco: '', plano: '', tipoLancamento: 'Taxa administrativa', valorComercial: 20 },
      ],
    })
    expect(grupos.map(g => [g.beneficiario, g.parentesco, g.subtotal])).toEqual([
      ['ANA', 'Titular', 100], ['BIA', 'Filho(a)', 50.5], ['AGM TESTE', 'Empresa', 20],
    ])
  })
})

describe('plano principal', () => {
  it('principal primeiro (por caracteristicaProduto ou tipoContratacao); sem marcação antes dos opcionais', () => {
    const lista = [
      { nomePlano: 'opcional', tipoContratacao: 'Adicional' },
      { nomePlano: 'sem marca' },
      { nomePlano: 'principal', tipoContratacao: 'PRINCIPAL' },
    ]
    expect(m.ordenarPorPrincipal(lista).map(p => p.nomePlano)).toEqual(['principal', 'sem marca', 'opcional'])
    expect(m.produtoPrincipal([{ nomePlano: 'x', tipoContratacao: 'Adicional' }])?.nomePlano).toBe('x')
    expect(m.produtoPrincipal(null)).toBeUndefined()
  })

  it('na família o principal vem primeiro, dá a carteirinha, e os outros ficam como opcionais', () => {
    const f = m.mapearFamilia({
      id: 1, numeroContrato: '1',
      beneficiarios: [{
        id: 1, nome: 'ANA', parentesco: 'TITULAR',
        produto: [
          { nomePlano: 'Odonto', tipoContratacao: 'Adicional', numeroCartaoIdentificacao: 'OD-1' },
          { nomePlano: 'Saúde', caracteristicaProduto: 'Principal', numeroCartaoIdentificacao: 'SA-1' },
        ],
      }],
    }, HOJE)
    expect(f.titular.produtos.map(p => [p.nome, p.opcional])).toEqual([['Saúde', undefined], ['Odonto', true]])
    expect(f.titular.numeroCarteirinha).toBe('SA-1')
  })
})

describe('família', () => {
  it('traz titular e dependentes ativos, sem quem já saiu do plano', () => {
    const f = m.mapearFamilia(CONTRATO_FALSO, HOJE)
    expect(f.titular).toMatchObject({ id: '9001', parentesco: 'Titular', numeroCarteirinha: '0001.0002-003' })
    expect(f.titular.produtos[0]).toMatchObject({ nome: 'Saúde Bem', registroAns: '123456', acomodacao: 'Enfermaria', valorMensal: 300.5, inicioVigencia: '2024-02-10' })
    expect(f.dependentes.map(d => d.nome)).toEqual(['BIA TESTE SOUZA'])
  })

  it('explica o erro quando o contrato vem sem titular', () => {
    expect(() => m.mapearFamilia({ id: 1, numeroContrato: '9', beneficiarios: [] }, HOJE)).toThrow(/sem titular; esperado parentesco contendo "TITULAR"/)
  })

  it('reconhece o titular escrito de outro jeito', () => {
    expect(['TITULAR', 'Titular', 'TITULAR(A)', ' títular '].every(t => m.ehTitular(t))).toBe(true)
    expect(m.ehTitular('FILHO')).toBe(false)
  })

  it('contrato encerrado: mostra a família como era, com os produtos daquele tempo', () => {
    const fim = new Date(2025, 0, 31, 12).getTime()
    const f = m.mapearFamilia({
      id: 1, numeroContrato: '9', beneficiarios: [
        { id: 1, nome: 'ANA', parentesco: 'Titular', dataFim: fim, produto: [{ nomePlano: 'PLANO X', dataFim: fim }] },
        { id: 2, nome: 'BIA', parentesco: 'FILHA', dataFim: fim, produto: [{ nomePlano: 'PLANO X', dataFim: fim }] },
      ],
    }, HOJE)
    expect(f.titular.nome).toBe('ANA')
    expect(f.titular.produtos.map(p => p.nome)).toEqual(['PLANO X'])
    expect(f.dependentes.map(d => d.nome)).toEqual(['BIA'])
  })

  it('lê abrangência, cobertura e coparticipação do produto', () => {
    const f = m.mapearFamilia({
      id: 1, numeroContrato: '9', beneficiarios: [{
        id: 1, nome: 'ANA', parentesco: 'TITULAR',
        produto: [{ nomePlano: 'P', abrangenciaAtendimentoProduto: 'NACIONAL', segmentacaoProduto: 'AMBULATORIAL + HOSPITALAR', fatorModeradorProduto: 'COPARTICIPAÇÃO' }],
      }],
    }, HOJE)
    expect(f.titular.produtos[0]).toMatchObject({ abrangencia: 'Nacional', cobertura: 'Ambulatorial + hospitalar', coparticipacao: true })
  })

  it('entende o texto da coparticipação', () => {
    expect(m.temCoparticipacao('COPARTICIPAÇÃO')).toBe(true)
    expect(m.temCoparticipacao('SEM FATOR MODERADOR')).toBe(false)
    expect(m.temCoparticipacao('NÃO')).toBe(false)
    expect(m.temCoparticipacao('')).toBeUndefined()
    expect(m.temCoparticipacao('OUTRA COISA')).toBeUndefined()
  })
})

describe('faturas', () => {
  it('calcula a situação pelo status e pelo vencimento', () => {
    const [paga, emDia, vencida] = COBRANCAS_FALSAS
    expect(m.situacaoDaCobranca(paga!, HOJE)).toBe('paga')
    expect(m.situacaoDaCobranca(emDia!, HOJE)).toBe('aberta')
    expect(m.situacaoDaCobranca(vencida!, HOJE)).toBe('atrasada')
    expect(m.situacaoDaCobranca({ ...emDia!, dataVencimento: HOJE.getTime() }, HOJE)).toBe('vence-hoje')
  })

  it('tira canceladas e lançamentos sem cobrança e ordena da mais nova para a mais antiga', () => {
    const lista = m.mapearFaturas(COBRANCAS_FALSAS, HOJE)
    expect(lista.map(f => `${f.id}:${f.mes}:${f.situacao}`)).toEqual(['5002:outubro:aberta', '5001:setembro:paga', '5003:agosto:atrasada'])
    expect(lista[1]).toMatchObject({ pagaEm: '2026-09-08', valor: 450.5 })
    expect(lista[1]!.itens).toEqual([
      { descricao: 'ANA TESTE SOUZA (titular)', valor: 300.5 },
      { descricao: 'BIA TESTE SOUZA (filho)', valor: 150 },
    ])
  })

  it('monta o extrato por pessoa, com uma linha por tipo de lançamento', () => {
    const grupos = m.mapearGruposExtrato(COBRANCAS_FALSAS[0]!)
    expect(grupos).toHaveLength(2)
    expect(grupos[0]).toMatchObject({ beneficiario: 'ANA TESTE SOUZA', subtotal: 300.5 })
    expect(grupos[0]!.linhas.map(l => l.descricao)).toEqual(['Mensalidade', 'Taxa associativa'])
  })
})

describe('login leve (/login/portal)', () => {
  const fim = new Date(2025, 0, 31, 12).getTime()
  const resposta = {
    token: 't',
    contratos: [
      { papel: 'titular', idContratoAdesao: 222, numeroContrato: 202400002.001, tipoContratacao: 'ADESÃO', nome: 'ANA TESTE SOUZA', plano: 'Saúde Bem', dataInicio: new Date(2024, 1, 10, 12).getTime() },
      { papel: 'titular', idContratoAdesao: 111, numeroContrato: '202200001.001', nome: 'ANA TESTE SOUZA', plano: 'Plano antigo', dataFim: fim },
      { papel: 'representante', idContratoConveniado: 900, numeroContrato: '202270671', conveniado: 'EMPRESA FALSA LTDA', nome: 'ANA TESTE SOUZA', dataInicio: new Date(2022, 4, 1, 12).getTime() },
    ],
  }

  it('monta titular, cancelado e o contrato da empresa para o responsável', () => {
    const r = m.mapearLoginPortal(resposta, HOJE)!
    expect(r.pessoa).toEqual({ nome: 'ANA TESTE SOUZA', primeiroNome: 'Ana' })
    expect(r.contratos.map(c => [c.cliente.numero, c.cliente.papel, c.cliente.situacao, c.cliente.tipo])).toEqual([
      ['202400002.001', 'titular', 'ativo', 'adesao'],
      ['202200001.001', 'titular', 'cancelado', 'adesao'],
      ['202270671', 'representante', 'ativo', 'empresarial'],
    ])
    expect(r.contratos[2]!.cliente.empresa).toBe('EMPRESA FALSA LTDA')
    expect(r.contratos[2]!.gateway).toEqual({ idContratoAdesao: 0, idContratoConveniado: 900, numeroContrato: '202270671', tipoContratacao: 'EMPRESARIAL' })
    expect(r.contratos[0]!.gateway).toMatchObject({ idContratoAdesao: 222, numeroContrato: '202400002.001' })
  })

  it('sem token ou sem contratos não entra', () => {
    expect(m.mapearLoginPortal({ ...resposta, token: null }, HOJE)).toBeNull()
    expect(m.mapearLoginPortal({ token: 't', contratos: [] }, HOJE)).toBeNull()
  })
})

describe('rota inexistente no serviço (plano B do login)', async () => {
  const { ehRotaInexistente } = await import('../server/utils/gateway')
  it('reconhece o "Cannot POST" do Express e não confunde com "nenhum contrato"', () => {
    expect(ehRotaInexistente({ statusCode: 404, data: { motivo: 'Error Cannot POST /api-x/login/portal' } })).toBe(true)
    expect(ehRotaInexistente({ statusCode: 404, data: { motivo: 'Nenhum contrato encontrado para o CPF informado.' } })).toBe(false)
    expect(ehRotaInexistente({ statusCode: 502 })).toBe(false)
  })
})

describe('produto em cada lançamento (duas mensalidades da mesma pessoa)', () => {
  // Caso real relatado: mesma pessoa e competência, duas "Mensalidade" com valores diferentes.
  const contrato = {
    id: 1, numeroContrato: '1', beneficiarios: [{
      id: 1, nome: 'ANA', parentesco: 'TITULAR',
      produto: [
        { idProdutoFornecedor: 10, nomePlano: 'SAUDE BEM ENF', nomeAmigavelProduto: 'Saúde Bem' },
        { idProdutoFornecedor: 20, nomePlano: 'ODONTO MAIS' },
      ],
    }],
  }
  const cobranca = {
    idCobranca: 1, statusCobranca: { tipo: 'EM_COBRANCA' }, valorCobranca: 330,
    lancamentos: [
      { nome: 'ANA', parentesco: 'TITULAR', tipoLancamento: 'Mensalidade', plano: 'SAUDE BEM ENF', idProdutoFornecedor: 10, valorComercial: 300 },
      { nome: 'ANA', parentesco: 'TITULAR', tipoLancamento: 'Mensalidade', plano: 'ODONTO MAIS', idProdutoFornecedor: 20, valorComercial: 25 },
      { nome: 'ANA', parentesco: 'TITULAR', tipoLancamento: 'Pro rata', plano: 'PLANO SEM CADASTRO', idProdutoFornecedor: 99, numeroParcela: 2, totalParcelas: 3, valorComercial: 5 },
    ],
  }

  it('cada linha do extrato mostra o produto (nome amigável quando houver)', () => {
    const [grupo] = m.mapearGruposExtrato(cobranca, m.nomesDeProduto(contrato))
    expect(grupo!.linhas.map(l => [l.descricao, l.produto, l.detalhe])).toEqual([
      ['Mensalidade', 'Saúde Bem', undefined],
      ['Mensalidade', 'ODONTO MAIS', undefined],
      ['Pro rata', 'PLANO SEM CADASTRO', 'parcela 2 de 3'],
    ])
  })

  it('o resumo da conta separa por pessoa e produto', () => {
    const [fatura] = m.mapearFaturas([cobranca], HOJE, m.nomesDeProduto(contrato))
    expect(fatura!.itens.map(i => i.descricao)).toEqual([
      'ANA (titular) · Saúde Bem', 'ANA (titular) · ODONTO MAIS', 'ANA (titular) · PLANO SEM CADASTRO',
    ])
  })

  it('sem o contrato, usa o nome técnico do produto', () => {
    expect(m.produtoDoLancamento(cobranca.lancamentos[0]!)).toBe('SAUDE BEM ENF')
  })
})
