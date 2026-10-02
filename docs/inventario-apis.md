# Inventário de APIs – Portal do Cliente (base: `origin/producao-tecgroup`)

Repositório analisado (somente leitura, via `git archive`/`git show` da branch `origin/producao-tecgroup`): `vexur-portal-cliente-home`. Complemento: `vexur-portal-cliente-home-nuxt/app/core` (working tree, branch `main`).
Caminhos de arquivo são relativos a `src/components/` quando não indicado. Valores de api-key, senha e token foram omitidos (`<api-key>`).

---

## 0. Infraestrutura comum (como toda chamada é montada)

| Item | Como funciona hoje | Onde |
|---|---|---|
| Base URL | `window.config.api["server-<servico>"]`. Em produção quase tudo aponta para `https://gateway-tecgroup.vexur.com.br`. `config.api` é um `Proxy` que devolve o gateway para qualquer chave inexistente. Exceções: `server-api-vexur-dominio` e `server-api-vexur-contas-pagar-prestador-avulso` → `https://temp-v2-gateway-tecgroup.vexur.com.br` | `public/app-config.js:1-160, 995-1005` |
| api-key | Uma api-key por serviço em `config.apiKey` (~131 chaves) no **`public/app-config.js`, servido ao navegador**. O interceptor do axios concatena `?api-key=<api-key>` quando a URL contém o nome do serviço (sem o prefixo `server-`) | `src/plugins/axios.js:20-37` |
| Headers de auth | `Authorization: <token cru, sem "Bearer">` + `Login: <login>` + `Content-Type: application/json`. Alguns fluxos também mandam `"await-response": true` | `src/utils/http.js`, `src/custom-components/requestApi.js`, na maioria dos componentes via inline |
| Obtenção do token do cliente | `POST /api-vexur-operacao-recepcao-proposta-adesao/login` → `result.data.token`. Fica no Vuex (`store/auth.js`), persistido com `vuex-persistedstate` + `ss-storage` (sessionStorage) | `VexurAreaClienteScript.vue:385-467` |
| `Login` enviado | `email`, se `result.data.viaLoginSenha`; senão, o **CPF do titular** | `VexurAreaClienteScript.vue:442` |
| Outros campos do store | `loginViaCpfResponsavelEmpresa` (true se algum contrato veio com essa flag), `nome` (titular, ou `nomeEmpresaResponsavel` em PME), `email` | `VexurAreaClienteScript.vue:438-446` |
| TLS | O interceptor cria `https.Agent({ rejectUnauthorized: false })` | `src/plugins/axios.js:21` |
| Serviço de IP (assinatura) | `GET https://gateway-tecgroup.vexur.com.br/ip?api-key=<api-key>` (**api-key fixa no código**) → `data.ip`, gravado em `enderecoIPAssinatura` / `enderecoIPAssinaturaCancelamento` | `VexurPortalInclusaoDependente/VexurPortalInclusaoAssinatura.vue:~108`, `VexurPortalPropostaAdesao/ExclusaoDependente.vue:~447` |

---

## 1. Login, esqueci a senha, criar/mudar senha, autorizar/validar token

| # | Serviço | Endpoint | Método | Auth | Entrada | Resposta (campos usados) | Arquivo:linha |
|---|---|---|---|---|---|---|---|
| 1.1 | api-vexur-operacao-recepcao-proposta-adesao | `/login` (**login via CPF**) | POST | api-key; Authorization/Login vazios | `{ cpfTitular }` (**só o CPF, sem senha**, vindo do dialog `VexurPortalDialogCPFTitular.vue`) | `token`, `viaLoginSenha`, `propostaAdesao[]` (ver 2.1) | `VexurAreaClienteScript.vue:411-422` (chamado por `loginCPF` 269) |
| 1.2 | idem | `/login` (**login via e-mail e senha**, responsável PME) | POST | idem | `{ email, senha }` (ou `credenciais` do cache) | idem | `VexurAreaClienteScript.vue:392-422`; form em `VexurAreaClienteComputador.vue:192-235` |
| 1.3 | api-vexur-seguranca | `/esqueci-minha-senha` (também usado em "Primeiro acesso") | POST | api-key + Authorization/Login (vazios se deslogado) | `{ cpf, email, celular }` | `protocolo` (dispara a digitação de tokens) | `VexurAreaClienteScript.vue:587-601`; `VexurAreaClienteContratos/MudarSenha.vue:232-246` |
| 1.4 | api-vexur-seguranca | `/criar-nova-senha` | POST | idem | `{ tokenSMS, tokenEmail, cpf, email, novaSenha, protocolo }` (tokens sem espaços e hífens) | `protocolo` (sucesso) | `VexurAreaClienteScript.vue:617-636`; `MudarSenha.vue:263-282` |
| 1.5 | api-vexur-seguranca | `/alterar-senha` | POST | api-key + Authorization/Login | `{ login, pwAnterior, pw, pwConfirma }` | `autenticado`, `token`, `perfis`, `permissoesViaAlcada`, `nome` | `VexurPortalAlterarSenha.vue:247-262` (**componente legado, não ligado**; o menu "Alterar Senha" abre `MudarSenha.vue`, que reusa 1.3 e 1.4) |
| 1.6 | api-vexur-seguranca | `/autorizar` | POST | Authorization/Login do cliente | `{ token, permissao, sistema: 'vexur' }` | `autorizacao` (bool). **Em exceção, faz logout** | `src/VEXUR.js:166-209`; usado no IRPF/Quitação com `permissao="vexur-relatorios#relatorio-de-ficha-financeira"` (`VexurPortalPropostaAdesao/VexurOperacaoContratoAdesaoContratoAdesaoComunicacoes.vue:141-157`) |
| 1.7 | api-vexur-workflow-process | `/iniciar-processo` "Login via portal" | POST | Authorization/Login do cliente | `{ processo:"Login via portal", protocolo, payload:{}, contexto:{tipo:"ContratoAdesao", id: idContratoAdesao} }`, um por contrato. Para responsável PME: `contexto.tipo:"ContratoConveniado"`, um por `conveniado.conveniado.id` | `workflow.protocolo` (vira `protocoloAcesso`) | `VexurAreaClienteScript.vue:468-530` |
| 1.8 | api-vexur-workflow-process | `/iniciar-processo` "Logout via portal" | POST | idem | `{ processo:"Logout via portal", protocolo, payload:{}, contexto:{tipo:"ContratoAdesao", id} }` por contrato | – | `VexurAreaClienteScript.vue:293-327` |
| 1.9 | api-vexur-portal-cliente-seguranca | `/autenticar-token` | POST | só api-key | `{ cpfTitular, tokenAssinatura, tokenAssinaturaEmail }` | `autenticado`, `token`, `idRascunho`, `uuidAssinatura`, `nome`, `corretor`, `numeroContrato` | `VexurAssinuturaProposta.vue:311-328` (legado) e `VexurPortalInclusaoDependente/VexurPortalInclusaoTransmitir.vue:265` (não ligado); **ativo no app Nuxt** (seção 10) |
| 1.10 | api-vexur-seguranca | `/autenticar` (usuário de serviço) | POST | só api-key | `{ login, pw }` **fixos no código** | `autenticado`, `token`, `perfis`, `permissoesViaAlcada`, `nome`, `corretor` | `ContratarBeneficiosEspeciais/Assefaz/index.vue:668-695`, `ContratarBeneficiosEspeciais/Sindilojas/index.vue:686-712` (ver seção BFF) |
| 1.11 | api-vexur-seguranca | `/autenticar`, `/conceder-acesso` | POST | – | login de corretor | – | `VexurAreaCorretor.vue:346-394` (fora do escopo cliente) |

Observações:
- O pedido fala em "CPF + senha", mas em produção são **dois modos**: CPF sozinho (qualquer pessoa que saiba o CPF entra) e e-mail + senha (responsável da empresa, com `viaLoginSenha`). Não existe CPF + senha.
- Não há refresh de token nem controle de expiração no front. Um 401 não é tratado de forma global.

---

## 2. Contratos, grupos e beneficiários do usuário logado

| # | Serviço | Endpoint | Método | Auth | Entrada | Resposta (campos usados) | Arquivo:linha |
|---|---|---|---|---|---|---|---|
| 2.1 | api-vexur-operacao-recepcao-proposta-adesao | `/login` (o mesmo de 1.1/1.2) | POST | – | – | `propostaAdesao[]`: `numeroContrato`, `numeroContratoGrupo`, `idContratoAdesao`, `inicioVigencia`, `tipoContratacao` (`"ADESÃO"`/`"EMPRESARIAL"`), `nomeEmpresaResponsavel`, `emailEmpresaResponsavel`, `edicaoPortal`, `loginViaCpfResponsavelEmpresa`, `conveniado{ nomeFantasia, tipoContratacao, conveniado{ id, cnpj, numeroContrato, dataInicio, dataFim } }`, `proponentes[]{ parentesco, nome, cpf, dataFim, produto[]{ fornecedor, tipoContratacao, regraServicos[]{ configuracaoRegra[]{ tipo, ator[], local[] } } } }` | `VexurAreaClienteScript.vue:425-457, 531-571`; tabela `VexurAreaClienteComputador.vue:56-106` |
| 2.2 | api-vexur-operacao-recepcao-proposta-adesao | `/buscarContratosPorLogin` | POST | Authorization/Login | `{ email }` | lista no mesmo formato de `propostaAdesao` | `VexurAreaClienteScript.vue:205-222` (evento `@atualizarContratos` de `GruposContrato`) |
| 2.3 | api-vexur-operacao-implatancao-contrato-adesao | `/obter/{numeroContrato}` | GET | Authorization/Login | path `numeroContrato` | `id`, `numeroContrato`, `idContratoConveniado`, `tipoContratacao`, `tipoProduto`, `edicaoPortal`, `pdf.urlDocumento`, `meiosContatos[]{tipo, endereco}`, `dadosBancarios[]`, `beneficiarios[]{ id, parentesco, nome, cpf, dataInicio, dataFim, produto[]{ idProdutoFornecedor, fornecedor, nomePlano, nomeAmigavelProduto, codigoProdutoNoRegulador, padraoAcomodacaoProduto, numeroCartaoIdentificacao, valorVenda, tipoContratacao, dataFim, regraServicos[] } }` | `VexurPortalPropostaAdesao/index.vue:399-461` (também `VexurPortalDadosBancarios/*Alteracao*.vue:372-378`, `AlteracaoDadosCadastrais.vue:463, 611`) |

Regras de navegação no front (`VexurAreaClienteScript.vue:531-571`):
- Grupos (PME) = contratos `EMPRESARIAL` agrupados por `conveniado.conveniado.cnpj`. A tela de grupos só aparece quando o e-mail logado é igual a `emailEmpresaResponsavel`.
- Se houver só um contrato, ele já vem selecionado. Se houver mais, o usuário escolhe na tabela, com filtro por número do contrato, nome ou CPF do titular (`filtrar()`, 233-256).
- `numeroContrato` tem formato `grupo.sufixo` (por exemplo `202270671.001`). `GruposContrato.vue:284-312` calcula o maior sufixo para incluir funcionário.

---

## 3. Faturas e boletos

| # | Serviço | Endpoint | Método | Auth | Entrada | Resposta (campos usados) | Arquivo:linha |
|---|---|---|---|---|---|---|---|
| 3.1 | api-vexur-faturamento-extrato-cliente | `/obterLancamentosPorContrato` | POST | Authorization/Login | `{ idContratoAdesao }` | `[]` cobranças: `nossoNumero`, `anoMesCompetencia` (YYYYMM), `statusCobranca.tipo`, `statusBancario.tipo`, `valorCobranca`, `valorPago`, `dataEmissao`, `dataVencimento`, `dataPagamento`, `linhaDigitavel`, `cedenteNome`, `lancamentos[]{ nome, plano, parentesco, tipoLancamento, anoMesCompetencia, valorComercial }` | `VexurAreaClienteContratos/Faturas.vue:197-215`; `VexurPortalPropostaAdesao/index.vue:421-443` (só quando não é EMPRESARIAL) |
| 3.2 | api-vexur-faturamento-extrato-cliente | `/obterLancamentosPorContratoConveniado` | POST | idem | `{ idContratoConveniado }` | idem | `Faturas.vue:178-196` (PME: `tipoContratacao != 'ADESÃO'`; em `GruposContrato.vue:180`) |
| 3.3 | api-vexur-faturamento-cobranca-gerar | `/gerarBoleto` (2ª via em PDF) | POST, `responseType: blob` | idem | `{ idContratoAdesao, nossoNumero }` | PDF (blob), baixado como `boleto_<nossoNumero>.pdf` | `Faturas.vue:216-248`; `VexurPortalPropostaAdesao/VexurPortalPropostaAdesaoCobranca.vue:75-110` (painel desligado com `v-if="false"` em `index.vue:61`) |
| 3.4 | api-vexur-faturamento-cobranca-gerar | `/gerarBoletoPME` | POST, blob | idem | `{ idContratoConveniado, nossoNumero }` | PDF | `Faturas.vue:220-222` |

Regras de status no front:
- `Faturas.vue:22`: o botão "Baixar Boleto" só aparece se `statusCobranca.tipo === 'EM_COBRANCA'` e existe `linhaDigitavel`.
- `Faturas.vue:194` (PME): lista só `PAGA` e `EM_COBRANCA`. No PF (`buscarFaturasPorContrato`) não há filtro.
- `index.vue:436-442` (lista de cobranças do painel antigo): `statusBancario.tipo ∈ {REMESSA GERADA, REMESSA TRANSMITIDA}`, `statusCobranca.tipo ∈ {PAGA, EM_COBRANCA, CONCLUÍDO}` e `linhaDigitavel` preenchida.
- Cores por status (`VexurPortalPropostaAdesaoCobranca.vue:123-136`): GERADA, PAGA, EM_COBRANCA, ERRO, CANCELADA.
- "Vencido" **não é calculado no front**. A doc (`docs/docs-financeiro.md:111-119`) cita `VENCIDA` e `NEGOCIADA` como valores de `statusCobranca.tipo`.
- **PIX:** não é usado no front. A doc (`docs/docs-financeiro.md:101-103, 296-308`) diz que a cobrança traz `modalidadeCobranca` (`Boleto`/`PIX`/`Débito automático`) e `emv` (payload do QR Code PIX). Há também `server-api-vexur-pagamento-asaas` no config, sem uso no portal.

---

## 4. Carteirinha digital

| # | Origem | Dados exibidos | Arquivo:linha |
|---|---|---|---|
| 4.1 | Sem endpoint próprio. Usa `contratoAdesao.beneficiarios[].produto[]` de `/api-vexur-operacao-implatancao-contrato-adesao/obter/{numeroContrato}` (2.3) | `produto.numeroCartaoIdentificacao` (padrão "0000.0000-000"), `produto.fornecedor` (operadora), `beneficiario.nome`, `produto.codigoProdutoNoRegulador`, `produto.nomePlano`, `produto.padraoAcomodacaoProduto`, `beneficiario.dataInicio` | `VexurPortalPropostaAdesao/VexurPortalPropostaAdesaoCarteirinhas.vue:5-43`; painel em `index.vue:46`, liberado pela regra `VISUALIZAR CARTEIRINHA` |

Não há imagem, PDF nem QR da carteirinha. É só um card HTML. O validador de alteração cadastral tem uma regra `carteirinha/validarRegra` (seção 7), mas esse fluxo está desligado.

---

## 5. Contrato, informe de IR, quitação anual e materiais

| # | Serviço | Endpoint | Método | Auth | Entrada | Resposta (campos usados) | Arquivo:linha |
|---|---|---|---|---|---|---|---|
| 5.1 | (sem chamada) | `contratoAdesao.pdf.urlDocumento`, vindo de 2.3 | – | – | – | link direto (S3) | `index.vue:14-33` (regra `DOWNLOAD CONTRATO` + `acessoViaLogin`) |
| 5.2 | api-vexur-faturamento-cobranca-admin | `/obter-anos-irpf/{idContratoAdesao}` | GET | **só `Content-Type`, sem Authorization/Login** (api-key pelo interceptor) | path `contratoAdesao.id` | `datasPagamento[]` (anos) | `VexurPortalPropostaAdesao/VexurOperacaoContratoAdesaoContratoAdesaoComunicacoes.vue:292-305` (o componente de Quitação é idêntico) |
| 5.3 | api-vexur-regra-venda-comunicacao | `/contrato/obterComunicacoes` | POST | Authorization/Login | `{ numeroContrato }` | `comunicacoes[]{ tipoComunicacao, codigoTemplate }`. Filtra `'IRPF'` no IR; `'DECLAÇÃO ANUAL DE DÉBITO'` ou `'ANUAL DE DÉBITO'` na quitação (a grafia "DECLAÇÃO" está assim no código) | `...Comunicacoes.vue:167-172`; `...ComunicacaoQuitacaoAnual.vue` (mesma linha) |
| 5.4 | api-vexur-faturamento-cobranca-admin | `/enviar-declaracao-imposto-renda` | POST | Authorization/Login | `{ tipoComunicacao, payload:{ idContratoAdesao, urlDocumento:null, destinatarios:'', assunto:'', gerarVisualizacao:true, documentosGerados:[], ano, visualizacaoViaPortal:true } }` | `visualizacaoDocumento[]{ urlArquivo }`, `mensagem`, `tipoMensagem` (`'ERRO'`) | `...Comunicacoes.vue:178-211` |
| 5.5 | api-vexur-faturamento-cobranca-admin | `/enviar-declaracao-anual-debito` | POST | idem | mesmo payload | idem | `...ComunicacaoQuitacaoAnual.vue` (linha equivalente, cerca de 192) |
| 5.6 | api-vexur-seguranca | `/autorizar` (permissão `vexur-relatorios#relatorio-de-ficha-financeira`) | POST | cliente | ver 1.6 | `autorizacao` | `...Comunicacoes.vue:141-157` |
| 5.7 | api-vexur-operacao-recepcao-proposta-adesao | `/buscarUrlPdf` (materiais) | POST | Authorization/Login | `{ cpfTitular }` | `[]{ tipoMaterial, urlDocumento }`. Exclui `CONTRATO DE ADESÃO` e itens sem URL; `REDE DE ATENDIMENTO` vira link "acesse" | `index.vue:480-497, 458-460`; template `index.vue:111-150` (regra `MATERIAL`) |
| 5.8 | api-vexur-venda-regra-materiais | `/obterRegraProduto` | POST | idem | `{ filtros:{ idProdutoFornecedor } }` | – | `index.vue:463-478` (**definido e não chamado**) |
| 5.9 | api-vexur-operacao-gestao-protocolos | `/pesquisarProtocolosPorContratoEFiltros` | POST | idem | `{ numeroContrato, ...filtros }` | `protocolos` | `...Comunicacoes.vue:275-281` (só para campos do tipo `protocolo`; na prática não é usado) |

---

## 6. Dependentes: inclusão e exclusão/cancelamento

### 6.A Inclusão de dependente (`VexurPortalPropostaAdesao/InclusaoDependente.vue`, painel `index.vue:157`, regra `INCLUSÃO DE DEPENDENTE` + `acessoViaLogin`)
Etapas do stepper (1 a 5): quantidade de dependentes → dados cadastrais (`VexurPortalInclusaoDependente/VexurPortalInclusaoDadosCadastrais.vue`) → documentos (`VexurPortalInclusaoDocumento.vue`) → declaração de saúde (`VexurPortalInclusaoDeclaracaoSaude.vue`) → assinatura (`VexurPortalInclusaoAssinatura.vue`) → protocolo (`VexurPortalInclusaoProtocolo.vue`).

| # | Serviço | Endpoint | Método | Entrada | Resposta | Arquivo:linha |
|---|---|---|---|---|---|---|
| 6.1 | api-vexur-regra-venda-aceitacao-beneficiario | `/obterRegraProduto` | POST | `{ filtros:{ idProdutoFornecedor } }` | regra de aceitação (graus de parentesco, idades etc.) | `src/utils/executarRegras.js:13-23` (chamado por `InclusaoDependente.vue:399-411`) |
| 6.2 | api-vexur-regra-aceitacao-calendario | `/obterRegraProduto` | POST | idem | – | `executarRegras.js:25-35` |
| 6.3 | api-vexur-regra-venda-carencia | `/obterRegraProduto` | POST | `{ idProdutoFornecedor }` | `configuracaoRegra[].carteira` (`possuiReducaoCarencia` quando `Carteira`/`Indiferente`) | `executarRegras.js:37-49, 98` |
| 6.4 | api-vexur-regra-aceitacao-declaracao-saude | `/obterRegraProduto` | POST | `{ filtros:{ idProdutoFornecedor } }` | – | `executarRegras.js:51-61` |
| 6.5 | api-vexur-regra-venda-tabela-preco | `/obterRegraProduto` | POST | `{ idProdutoFornecedor }` | `tabelaPreco` | `executarRegras.js:63-73` |
| 6.6 | api-vexur-venda-regra-materiais | `/obterRegraProduto` | POST | `{ filtros:{ idProdutoFornecedor } }` | `configuracaoRegra[].codigoTemplate` | `executarRegras.js:75-96` (se qualquer regra vier `{}`/`[]`, marca `erro` e esconde a inclusão) |
| 6.7 | api-vexur-dominio | `/obterListagem/EstadoCivil` | POST | `{ filtros:{ tipoDominioInformacao:"EstadoCivil", status:"Ativo" } }` | `[]{ nomeEstadoCivil }` | `InclusaoDependente.vue:872-897` |
| 6.8 | api-vexur-dominio | `/obterListagem/GrauRelacionamento` | POST | `{ filtros:{ tipoDominioInformacao:"GrauRelacionamento", status:"Ativo" } }` | `[]{ nomeGrauRelacionamento }` | `InclusaoDependente.vue:898-917` |
| 6.9 | api-vexur-regra-aceitacao-calendario | `/obterInicioVigenciaDisponiveis` | POST | payload do produto | vigências (`timestamp`) | `InclusaoDependente.vue:972-1004` |
| 6.10 | api-vexur-regra-venda-aceitacao-beneficiario | `/validarRegra` | POST | `[payloadTitular, payloadDependente]` | `resultado`, `mensagem` | `InclusaoDependente.vue:1053-1080` |
| 6.11 | api-vexur-regra-aceitacao-declaracao-saude | `/validarRegra` | POST | payload do dependente | perguntas da DPS | `InclusaoDependente.vue:1006-1050` |
| 6.12 | api-vexur-regra-venda-tabela-preco | `/validarRegra` | POST | payload do dependente + `validarPreco:false` + `anoMesCompetencia` | `valorVenda` | `InclusaoDependente.vue:611-686` |
| 6.13 | api-vexur-venda-regra-materiais (base do config-template-pdf) | `/obterRegraMateriais` | POST | `{ dataInicio, dataAssinatura:null, produtos:[produto] }` | `codigoTemplate` | `InclusaoDependente.vue:575-610`; `VexurPortalInclusaoProtocolo.vue:156-174` |
| 6.14 | api-vexur-dominio | `/obterDominioPorNome/Cid/{codigoCid}` | GET | CID digitado na DPS | `descricaoCid` | `VexurPortalInclusaoDependente/VexurPortalInclusaoDeclaracaoSaude.vue:598-610` |
| 6.15 | api-vexur-operacao-gestao-eletronica-documento (GED) | `/upload` | POST multipart | `file`, `proponente` | `Location` (URL no S3) | `VexurPortalInclusaoDocumento.vue:439-458`; `src/custom-components/v-upload-document.vue:80-95` (upload avulso na etapa de documentos, `InclusaoDependente.vue:95-100`) |
| 6.16 | GED | `/verificaExisteRosto`, `/compararRostos` (file, proponente, selfie), `/detectarTextos` | POST multipart | – | validação de selfie/documento | `VexurPortalInclusaoDocumento.vue:491-505, 553-567, 591-605` |
| 6.17 | (gateway) | `/ip` | GET | api-key fixa | `ip` | `VexurPortalInclusaoAssinatura.vue:~108` |
| 6.18 | api-vexur-configuracao-template-pdf | `/gerarPdfSalvarNuvem` | POST | `{ nomeParametroRegra: codigoTemplate, payload:{ numeroContrato } }` | `Location` (PDF da proposta, baixado) | `VexurPortalInclusaoAssinatura.vue:152-170`; `VexurPortalInclusaoProtocolo.vue:101-119` |
| 6.19 | api-vexur-workflow-process | `/iniciar-processo` **"Inclusão de beneficiário no portal"** | POST | `{ processo, protocolo:null, payload:{ ...propostaAdesao (numeroContrato, idContratoAdesao, titular, proponentes, regrasAceitacao[], declaracaoSaude, documentacao, codigoTemplate, uuidAssinatura, dataAssinatura, enderecoIPAssinatura...), documento }, agendamento:null, contexto:{ tipo:"ContratoAdesao", id } }` | `workflow.protocolo` | `InclusaoDependente.vue:797-845` |
| 6.20 | api-vexur-operacao-repositorio-documentos | `/salvarDocumento` | POST | `{ numeroContrato, documento:{ ...doc, inativo:false, tipoDominioDocumentoId:{ id: config.api["idDocumentoCancelamento"], nomeDocumento, descricaoDocumento }, descricao } }` | – | `InclusaoDependente.vue:348-375` |
| 6.21 | api-vexur-envio-comunicacao | `/enviarEmailComunicacao` | POST | `{ numeroContrato, assunto, texto }` (**HTML montado no front**) | – | `src/utils/enviarComunicacao.js:3-20`; `InclusaoDependente.vue:855-860` |
| 6.22 | api-vexur-operacao-recepcao-proposta-adesao | `/verificar-proposta-em-analise` | POST (+ `await-response`) | `{ numeroContrato }` | `protocolo` (já existe análise em andamento) | `VexurPortalInclusaoProtocolo.vue:220-238` |

A "assinatura" na inclusão é só um aceite: grava `dataAssinatura = now` e o IP, sem OTP (`VexurPortalInclusaoAssinatura.vue:~225`).

### 6.B Exclusão de dependente (`VexurPortalPropostaAdesao/ExclusaoDependente.vue`, painel `index.vue:191`, regra `EXCLUSÃO DE DEPENDENTE`, aparece quando há não titulares)

| # | Serviço | Endpoint | Método | Entrada | Resposta | Arquivo:linha |
|---|---|---|---|---|---|---|
| 6.23 | api-vexur-dominio | `/obterDominio/MotivoCancelamento/Alteração cadastral` | GET | – | motivos | `ExclusaoDependente.vue:603-621` |
| 6.24 | api-vexur-regra-aceitacao-calendario | `/obterFimVigenciaDisponiveis` | POST | `{ idsProdutoFornecedor }` (produtos do titular sem `dataFim`) | datas (`timestamp`) | `ExclusaoDependente.vue:~465-487` |
| 6.25 | (gateway) | `/ip` | GET | api-key fixa | `ip` → `enderecoIPAssinaturaCancelamento` | `ExclusaoDependente.vue:~444-462` |
| 6.26 | GED | `/upload` (documento de cancelamento) | POST multipart | – | `Location` | via `v-upload-document` |
| 6.27 | **workflow-inbound** (`server-vexur-workflow-inbound`) | `/api-vexur-workflow-process/iniciar-processo` **"Cancelamento programado de beneficiário pelo portal"** ou **"Cancelamento imediato de beneficiário pelo portal"** (conforme `formaCancelamento`) | POST | `{ processo, protocolo, payload:{ numeroContrato, idContratoAdesao, tipoCancelamento:'BENEFICIÁRIO', beneficiarios[]{...,motivoCancelamento, dataFim}, beneficiario, titular, documento }, agendamento:null, contexto:{ tipo:"Beneficiario", id } }` | `workflow.protocolo` | `ExclusaoDependente.vue:536-575, 407-441` (há um segundo caminho via `server-api-vexur-workflow-process` em 744-805) |
| 6.28 | repositorio-documentos | `/salvarDocumento` | POST | igual a 6.20 | – | `ExclusaoDependente.vue:363-389` |
| 6.29 | envio-comunicacao | `/enviarEmailComunicacao` | POST | igual a 6.21 | – | `ExclusaoDependente.vue:439` |

### 6.C PME (responsável da empresa)

| Funcionalidade | Endpoints | Arquivo:linha |
|---|---|---|
| Exclusão de titular/funcionário (`ExclusaoTitularPME.vue`, regra `EXCLUSÃO DE TITULAR` com ator `Representante`, `VexurAreaClienteScript.vue:108-119`) | `regra-venda-aceitacao-beneficiario/obterRegraProduto` (484); inbound `iniciar-processo` com "Cancelamento programado/imediato de beneficiário pelo portal" (551-586, 965-1013); "Inclusão de contributário na operadora" (632-650); `repositorio-documentos/salvarDocumento` (591-608); `regra-aceitacao-calendario/obterFimVigenciaDisponiveis` (695); `dominio/obterDominio/MotivoCancelamento/Portal` (832) | `VexurPortalPropostaAdesao/ExclusaoTitularPME.vue` |
| Cancelamento de contrato empresarial (`ExclusaoGrupoContrato.vue`, regra `CANCELAMENTO CONTRATO` com ator `Representante`, `GruposContrato.vue:261`) | `repositorio-documentos/salvarDocumento` (292); `regra-aceitacao-calendario/obterFimVigenciaDisponiveis` (322); `dominio/obterDominio/MotivoCancelamento/Portal` (350); `workflow-process/iniciar-processo` "Cancelamento de contrato empresarial pelo portal" (373-396) | `VexurPortalPropostaAdesao/ExclusaoGrupoContrato.vue` |
| Inclusão de funcionário Sindilojas (regra `INCLUSÃO DE TITULAR` com ator `Representante`, `GruposContrato.vue:258`) | `recepcao-proposta-adesao/obter-regra-servico-produto` (297); `/obter-contrato-por-cpf-e-grupo-contrato` (350); `marketplace-catalogo-produto/obterConveniadosPorProfissao` (374) e `/obterProdutos` (419); `marketplace-range-proposta/obterNumeroProposta` (523); `marketplace-proposta-rascunho/salvar-adesao-pme` (558), `/enviar-token-assinatura-sindilojas` (595), `/enviar-assinatura-sindilojas` (633); `repositorio-documentos/salvarDocumento` (666, `config.api["idDocumentoInclusao"]`); inbound `iniciar-processo` "Implantação de funcionários Sindlojas" (689-695) | `InclusaoFuncionarioSindilojas/index.vue` |

---

## 7. Alteração de dados cadastrais e bancários

### 7.A Dados bancários PF (`VexurPortalPropostaAdesao/AlteracaoDadosBancarios.vue`; painel `index.vue:174`: `acessoViaLogin`, não EMPRESARIAL, regra `ALTERAÇÃO DE DADOS BANCÁRIOS`)

| # | Serviço | Endpoint | Método | Entrada | Resposta | Arquivo:linha |
|---|---|---|---|---|---|---|
| 7.1 | api-vexur-dados-bancarios | `/obterDadosBancariosContratoAdesao` | POST | `{ numeroContrato }` | `dadosBancarios[]` | `AlteracaoDadosBancarios.vue:279-312` |
| 7.2 | api-vexur-dados-bancarios | `/obterModalidadeCobranca` | POST | `{ idsProdutoFornecedor }` | modalidades | `AlteracaoDadosBancarios.vue:246-275` |
| 7.3 | api-vexur-dados-bancarios | `/buscarInstituicaoFinanceira/{codigoBanco}` | GET | código do banco | `nomeInstituicaoFinanceira` | `VexurPortalDadosBancarios/VexurPortalDadosBancariosAlteracao.vue:313-325` |
| 7.4 | api-vexur-operacao-implatancao-contrato-adesao | `/obter/{numeroContrato}` | GET | – | contrato | `VexurPortalDadosBancariosAlteracao.vue:371-388` |
| 7.5 | workflow-inbound | `/api-vexur-workflow-process/iniciar-processo` **"Alteração de dados bancários pelo Portal"** | POST | `{ processo, protocolo:null, payload:{ numeroContrato, regrasMovimentacao:[], dadosBancariosManutencao:[{ modalidadeCobranca, banco, nomeBanco, agencia, digitoAgencia, conta, digitoConta, tipoDadosBancarios:["Dados para cobrança"] }], historicoAlteracao:[{ tipoDadoAlterado, dadoAtual, dadoNovo }] }, agendamento:null, contexto:{ tipo:"ContratoAdesao", id } }` | `workflow.protocolo` | `AlteracaoDadosBancarios.vue:162-235` |

Atenção: `historicoAlteracao.dadoAtual` é montado com um texto fixo ("Boleto - Banco: VAZIO..."), não com o dado real (linha 170).

### 7.B Dados bancários PME (`AlteracaoDadosBancarioEmpresarial/index.vue`), **desligado** (comentado em `GruposContrato.vue:146-228`)
`dados-bancarios/obterDadosBancariosPME` `{ codigoContratoConveniado }` (293-310), `/obterModalidadeCobranca` (258-275), inbound `iniciar-processo` "Alteração de dados bancários de PME pelo Portal" com `contexto:{tipo:"ContratoConveniado"}` (170-222).

### 7.C Dados cadastrais: **desligado** (`v-if="false"` em `index.vue:208` e em `VexurAreaClienteComputador.vue:145`)
Componentes `VexurPortalPropostaAdesao/AlteracaoDadosCadastrais.vue` → `VexurOperacaoAlteracaoCadastral.vue` + `VexurOperacaoValidacaoRegraAlteracaoCadastral.vue`:
- Validação: `api-vexur-regra-movimentacao-alteracao-cadastral/validarRegra` e as sub-regras `/vencimento`, `/negociacao-retencao`, `/carteirinha`, `/carencia`, `/telefone`, `/email`, `/endereco`, `/autorizacao-envio-informacao` + `/validarRegra`; `dados-bancarios/validarRegra`; `regra-movimentacao-responsavel-financeiro/validarRegra`; `regra-movimentacao-responsavel-legal/validarRegra` (`VexurOperacaoValidacaoRegraAlteracaoCadastral.vue:494-553`).
- Token de confirmação (SMS/e-mail): `regra-movimentacao-alteracao-cadastral/autenticar-token` com `{ processo: tipoDadoAlterado, idContratoAdesao, tokenInformado }` → `autenticado` (`...ValidacaoRegra...vue:205-237`).
- Abertura: inbound `iniciar-processo` com um processo por tipo: "Alteração cadastral - via portal", "Alteração vencimento", "Negociação para retenção", "Alteração carteirinha", "Alteração carência", "Alteração de telefone", "Alteração de e-mail", "Alteração de endereço", "Alteração de dados bancários", "Alteração de responsavel financeiro", "Alteração de responsavel legal", "Alteração de autorização para envio de informações" (`VexurOperacaoAlteracaoCadastral.vue:350-511, 590-672`).
- Apoio: `regra-venda-carencia/validarRegra` (`AlteracaoDadosCadastrais.vue:663`), `marketplace-catalogo-produto/obterProfissoes` (700), localidades (`VexurPortalPropostaAdesaoMeiosContatos.vue:542, 581`).

---

## 8. Solicitações: abertura e acompanhamento

| # | Serviço | Endpoint | Método | Entrada | Resposta (campos usados) | Arquivo:linha |
|---|---|---|---|---|---|---|
| 8.1 | api-vexur-workflow-process **ou** workflow-inbound (mesmo path, `server-vexur-workflow-inbound` em produção = gateway) | `/api-vexur-workflow-process/iniciar-processo` | POST | `{ processo, protocolo, payload, agendamento, contexto:{ tipo: ContratoAdesao, ContratoConveniado ou Beneficiario, id } }` | `workflow.protocolo`, `workflow.uuid` | todos os fluxos (lista de processos abaixo) |
| 8.2 | api-vexur-operacao-gestao-protocolos | `/portal/obterProtocolosPorNumeroContrato` | POST | `{ numeroContrato }` | `[]{ id, uuid, protocolo, processo, statusAtual, dataCriacao, numeroIdentificacao, loginCriacao, componentName, detalhe, payload }`, agrupados no front por `processo` contendo INCLUSÃO, ALTERAÇÃO ou EXCLUSÃO | `VexurPortalPropostaAdesao/AcompanhamentoSolicitacao.vue:385-412` (painel `index.vue:242`, regra `ACOMPANHAMENTO DE SOLICITAÇÕES`) |
| 8.3 | api-vexur-operacao-gestao-protocolos | `/obterPayload` | POST | `{ idWorkflow }` | `payload` (string JSON) → `notasAnalise[]{ id, assunto, texto, statusAtual, urlDocumento }` | `AcompanhamentoSolicitacao.vue:241-257, 430-455` |
| 8.4 | workflow-inbound | `/api-vexur-workflow-process/iniciar-processo` (reenvio de pendência) | POST | `{ processo: solicitacao.processo, protocolo: solicitacao.protocolo, payload: payloadProtocolo (nota marcada `statusAtual='Reenviado'` e com anexo), contexto:{ tipo:"ContratoAdesao", id } }` | – | `AcompanhamentoSolicitacao.vue:202-240` |
| 8.5 | workflow-inbound | `/api-vexur-workflow-process/proxima-tarefa` (PUT) e `/tarefa-excecao` (PUT) | PUT | `{ workflow:{ uuid, payload }, task:{ uuid } }` | – | `VexurOperacaoAlteracaoCadastral.vue:205-244` (fluxo desligado) |

Processos disparados pelo portal (nomes exatos, que precisam existir no motor de workflow): "Login via portal", "Logout via portal", "Inclusão de beneficiário no portal", "Cancelamento programado de beneficiário pelo portal", "Cancelamento imediato de beneficiário pelo portal", "Cancelamento de contrato empresarial pelo portal", "Inclusão de contributário na operadora", "Alteração de dados bancários pelo Portal", "Alteração de dados bancários de PME pelo Portal", "Implantação de funcionários Sindlojas", "Transferência de planos", as 12 variações de alteração cadastral (7.C) e "Solicitação de informe de rendimentos" (`VexurPortalOutrasSolicitacoes`, não ligado).

---

## 9. Alteração de plano (link com token), rota pública `/#/alteracao-plano?<guid>`

Arquivo `src/components/AlteracaoPlano/index.vue`. Roda **sem login**; `Authorization`/`Login` vão vazios, então vale só a api-key.

| # | Serviço | Endpoint | Método | Entrada | Resposta | Linha |
|---|---|---|---|---|---|---|
| 9.1 | api-vexur-regra-movimentacao-transferencia-plano | `/obterAlteracaoPlano` | POST | `{ urlPdf: guid }` | `[0]{ nomeTitular, email, processo (JSON do workflow em string), deAcordo, urlPdf, urlPdfAssinada }` | 387-412 |
| 9.2 | (visualização) | `config.visualizadorPdf.prefixo + "/" + guid + ".pdf"`; iframe via `api-vexur-configuracao-template-pdf/gerarTemplate/{url}` | GET | – | PDF | 151, 161-164 |
| 9.3 | idem transferencia-plano | `/validarTokenRegraAlteracaoPlano` | POST | `{ urlPdf: guid, token }` | `[0].numeroContrato` (array vazio = token inválido) | 243-269 |
| 9.4 | api-vexur-envio-comunicacao | `/enviarEmailAlteracaoPlano` | POST | `{ titular:{dados:{nome}}, destinatarios: email, empresa:"tec-saude", tipoAlteracao:"analise" }` | – | 222-241 |
| 9.5 | transferencia-plano | `/inserirDeAcordoAlteracaoPlano` | POST | `{ urlPdf, token, uuidAssinatura (uuid v4 gerado no front), urlPdfAssinada }` | – | 270-291 |
| 9.6 | api-vexur-workflow-process | `/iniciar-processo` com **`this.processo` recebido em 9.1** ("Transferência de planos") | POST | objeto de workflow devolvido pelo backend | – | 292-306 |
| 9.7 | api-vexur-configuracao-template-pdf | `/gerarPdfSalvarNuvem` | POST | `{ nomeParametroRegra:"Alteracao de Plano", payload:{ numeroContrato, uuidAssinatura, token } }` | `Location` | 307-340 |
| 9.8 | api-vexur-operacao-repositorio-documentos | `/salvarDocumento` (+ `await-response`, `Login: emailTitular`) | POST | `{ numeroContrato, documento:{ urlDocumento, tipoDominioDocumentoId:-1, descricao:"Carta de acordo - Alteração de plano", inativo:false } }` | – | 361-386 |
| 9.9 | transferencia-plano | `/inserirUrlPdfAssinadoAlteracaoPlano` | POST | `{ urlPdf, token, urlPdfAssinada }` | – | 341-359 |

Ordem no `confirmarAlteracao` (184-220): validar token (9.3) → e-mail (9.4) → de acordo (9.5) → workflow (9.6) → PDF (9.7) → repositório (9.8) → URL assinada (9.9). Não é atômico e é todo orquestrado pelo navegador.

---

## 10. Assinatura de proposta e declaração de saúde (app Nuxt `vexur-portal-cliente-home-nuxt/app/core`)

Base `GATEWAY = https://hml-api-gateway.vexur.com.br` (HML) e `API_KEYS` fixas em `app/core/api-endpoints.ts`. As chamadas usam `?api-key=` e, salvo onde indicado, **não mandam Authorization**.

| # | Serviço | Endpoint | Método | Auth | Entrada | Resposta | Arquivo:linha |
|---|---|---|---|---|---|---|---|
| 10.1 | api-vexur-portal-cliente-seguranca | `/autenticar-token` | POST | api-key | `{ cpfTitular, tokenAssinaturaEmail }` (código enviado por e-mail) | `AuthResponse{ token, autenticado, idRascunho, uuidAssinatura, corretor{id,nome}, nome, numeroContrato }` | `core/auth/auth.api.ts:8-35`; `components/auth/LoginForm.vue:40-48` |
| 10.2 | api-vexur-seguranca | `/autenticar` (**usuário sistêmico**) | POST | api-key | `{ login, pw }` fixos em `stores/auth.store.ts:13-14` | `token` usado em 10.7 | `core/auth/auth.api.ts:37-72`; disparado logo após 10.1 (`LoginForm.vue:45`) |
| 10.3 | api-vexur-marketplace-proposta-rascunho | `/obter-rascunho-id` | POST | api-key | `{ idRascunho }` | `PropostaAdesao` (`codigoTemplate`, `numeroContratoGrupo`, `proponentes[].produto[]{tipoContratacao, idProdutoFornecedor}`...) | `core/proposta/proposta-adesao.api.ts:8-35` |
| 10.4 | idem | `/verificar-proposta-tarefa-andamento` | POST | api-key | `{ nomeTarefa, numeroContrato }`, chamado uma vez por tarefa: "Assinatura declaração de saúde", "Assinatura da proposta", "Assinatura responsável empresa", "Assinatura funcionários" | `TaskAdesao[]{ task{ statusAtual, nome, uuid }, workflow{ processo, protocolo, uuid, dataCriacao, payload{ ...PropostaAdesao, regrasAceitacao[], declaracaoSaude[]{ regra, proponente, declaracaoSaude[]{ ordemQuestao, pergunta, tipoResposta, resposta } }, opcaoOrientacaoMedicao, cartaOrientacaoBeneficiario } } }`; pega a task com `statusAtual === "Pendente"` | `proposta-adesao.api.ts:37-74`; `pages/area-cliente/index.vue:40-66` |
| 10.5 | api-vexur-regra-aceitacao-declaracao-saude | `/obterRegraProduto` | POST | api-key | `{ filtros:{ idProdutoFornecedor } }` (produto `Principal` do 1º proponente) | perguntas e regras da DPS | `core/regras/declaracao-saude.api.ts:7-35`; `pages/area-cliente/declaracao-saude.vue:57-80` |
| 10.6 | api-vexur-venda-regra-materiais + api-vexur-configuracao-template-pdf | `/obterTemplatePME` `{ nomeParametroRegra: codigoTemplate }` → `/gerarPdfContrato` `{ ...template, payload:{ numeroContrato } }` | POST | api-key | – | `Location` (PDF do contrato; com poucas páginas cai em "fallback") | `core/regras/configuracao-template.api.ts:8-58`; `pages/area-cliente/contrato-viewer.vue:60-100` |
| 10.7 | api-vexur-workflow-process | `/proxima-tarefa` | PUT | api-key + **`login`/`authorization` do usuário sistêmico** | `TaskAdesao` | – | `core/workflow/workflow.api.ts:34-66`; `composables/workflow/use-proxima-tarefa.ts:11-15` |
| 10.8 | api-vexur-marketplace-proposta-rascunho | `/salvar-adesao` | POST | api-key | `task.workflow.payload` (com a DPS respondida) | – | `proposta-adesao.api.ts:106-131` |
| 10.9 | idem | `/validar-assinatura-funcionario-pme` | POST | api-key | `{ numeroContratoGrupo }` | o backend avança o workflow | `proposta-adesao.api.ts:78-104` |
| 10.10 | api-vexur-workflow-process | `/iniciar-processo` | POST | api-key | workflow | – | `workflow.api.ts:7-33` (disponível; não confirmei chamador na página) |

Mapa de tarefa para ação (`core/proposta/services-proposta.ts:11-30`, `contrato-viewer.vue:128-165`):
- "Assinatura da proposta" (PF) e "Assinatura responsável empresa" (PME): `proxima-tarefa`.
- "Assinatura funcionários": `validar-assinatura-funcionario-pme`.
- "Assinatura declaração de saúde" e demais: `salvar-adesao`, depois `proxima-tarefa`.

No Vue legado (inclusão via marketplace), o fluxo equivalente usa `marketplace-proposta-rascunho/enviar-token-assinatura`, `/enviar-assinatura`, `/verificar-assinatura`, `/obter-tarefa-assinatura-responsavel-empresa`, `/validar-assinatura-funcionario-pme` (`InclusaoFuncionario/VexurMarketplacePropostaAdesaoAssinatura.vue` e outros).

---

## 11. Apoio: domínio, localidades/CEP, GED, repositório, template

| # | Serviço | Endpoint | Método | Entrada | Resposta | Arquivo:linha |
|---|---|---|---|---|---|---|
| 11.1 | api-vexur-dominio (**temp-v2-gateway**) | `/obterListagem/EstadoCivil`, `/obterListagem/GrauRelacionamento`, `/obterListagem/Documento` | POST | `{ filtros:{ tipoDominioInformacao, status:"Ativo" } }` | `nomeEstadoCivil`, `nomeGrauRelacionamento` | `InclusaoDependente.vue:872-917` |
| 11.2 | api-vexur-dominio | `/obterDominio/MotivoCancelamento/{Portal ou Alteração cadastral}`, `/obterDominio/EstadoCivil/...`, `/obterDominio/GrauRelacionamento/...`, `/obterDominio/OrgaoExpedidor/dominio` | GET | path | lista | `ExclusaoDependente.vue:609-611`; `ExclusaoGrupoContrato.vue:350` |
| 11.3 | api-vexur-dominio | `/obterDominioPorNome/Cid/{codigoCid}` | GET | – | `descricaoCid` | `VexurPortalInclusaoDeclaracaoSaude.vue:601-608` |
| 11.4 | api-vexur-localidades | `/consultar-cep/{cep}` | GET | – | `uf`, `localidade`, `bairro`, `logradouro`, `complemento`, `ibge` | `src/utils/funcoesDeEndereco.js:50-62`; `VexurPortalPropostaAdesaoMeiosContatos.vue:542` |
| 11.5 | api-vexur-localidades | `/consultar-municipio-uf/{uf}` | GET | – | `[]{ nome }` | `funcoesDeEndereco.js:91-100` |
| 11.6 | api-vexur-dados-bancarios | `/buscarInstituicaoFinanceira/{codigo}` | GET | – | `nomeInstituicaoFinanceira` | 7.3 |
| 11.7 | GED (api-vexur-operacao-gestao-eletronica-documento) | `/upload`, `/verificaExisteRosto`, `/compararRostos`, `/detectarTextos` (também `/detectarCelebridade` e `/detectarCategorias` no marketplace) | POST multipart | `file`, `proponente`, `selfie` | `Location` | 6.15, 6.16 |
| 11.8 | api-vexur-operacao-repositorio-documentos | `/salvarDocumento`, `/salvarDocumentos` (também `/listarDocumentos` e `/editarDocumentos` em outros fluxos) | POST | `{ numeroContrato, documento{...} }` | – | 6.20; `src/utils/salvarRepositorio.js:11-21` |
| 11.9 | api-vexur-configuracao-template-pdf | `/gerarPdfSalvarNuvem`, `/gerarTemplate/{url}` | POST, GET | `{ nomeParametroRegra, payload }` | `Location` | 6.18, 9.2, 9.7 |
| 11.10 | api-vexur-envio-comunicacao | `/enviarEmailComunicacao`, `/enviarEmailAlteracaoPlano` | POST | `{ numeroContrato, assunto, texto }` | – | 6.21, 9.4 |

---

## 12. Regras de negócio no front (precisam ir para o novo portal ou, melhor, para o backend/BFF)

1. **Regras de serviço do produto liberam os painéis** (`VexurPortalPropostaAdesao/index.vue:371-387`, `validarRegraServico(acao)`): junta `beneficiarios[].produto[].regraServicos[].configuracaoRegra[]` e libera se existir `regra.ator.includes(ator) && regra.local.includes("Portal") && regra.tipo.toUpperCase() === acao`. O ator é `"Representante"` quando `loginViaCpfResponsavelEmpresa`, senão `"Titular"`.
   - Tipos usados: `DOWNLOAD CONTRATO`, `VISUALIZAR CARTEIRINHA`, `INFORME DE RENDIMENTOS`, `QUITAÇÃO ANUAL DE DÉBITO`, `MATERIAL`, `INCLUSÃO DE DEPENDENTE`, `ALTERAÇÃO DE DADOS BANCÁRIOS`, `EXCLUSÃO DE DEPENDENTE`, `ALTERAÇÃO DE DADOS CADASTRAIS`, `ACOMPANHAMENTO DE SOLICITAÇÕES`, `FATURAS`.
   - PME: `EXCLUSÃO DE TITULAR`, `INCLUSÃO DE TITULAR`, `CANCELAMENTO CONTRATO`, só com ator `Representante` (`VexurAreaClienteScript.vue:108-119`; `GruposContrato.vue:251-269`).
   - O botão "Abrir contrato" aparece se houver ao menos uma regra válida da lista (`VexurAreaClienteScript.vue:79-102`).
   - A doc cita também `AGENDAMENTO DE ENTREVISTA QUALIFICADA` (`docs/docs-login.md`).
2. **`acessoViaLogin`** (login por e-mail e senha) é pré-requisito para: download do contrato, inclusão/exclusão de dependente, dados bancários e acompanhamento. **Quem entra só com CPF vê apenas** carteirinha, IR, quitação, materiais e faturas (`index.vue:14, 157, 174, 191, 242`).
3. `edicaoPortal` → `empresaExclusao = "SINDILOJAS"` (`index.vue:418`; `VexurAreaClienteScript.vue:106`). Um comentário no código diz que só a Sindilojas exclui funcionário.
4. As faturas do painel antigo só consultam o extrato quando `tipoContratacao != "EMPRESARIAL"` (`index.vue:420`). Os filtros de status estão na seção 3.
5. Dados bancários são bloqueados para EMPRESARIAL (`index.vue:174`). Exclusão de dependente exige ao menos um não titular (`index.vue:191`). Inclusão e cancelamento PME exigem grupo sem `dataFim` (`GruposContrato.vue:120, 188`).
6. A representação da empresa é decidida por `emailEmpresaResponsavel === email logado` (`VexurAreaClienteScript.vue:105, 469, 547`).
7. Inclusão de dependente: se qualquer uma das 6 regras de produto vier vazia, a inclusão é escondida (`executarRegras.js:86-94`). Os produtos do dependente copiam os produtos ativos do titular, sem `numeroCartaoIdentificacao`/`codigoCarencia`/`id` (`InclusaoDependente.vue:413-452`).

---

## Chamadas que precisam de BFF (credencial de serviço ou api-key sensível)

1. **Usuário de serviço fixo no código** (`api-vexur-seguranca/autenticar` com login e senha literais, homologação "<usuário de serviço>"):
   - `ContratarBeneficiosEspeciais/Assefaz/index.vue:668-695` e `ContratarBeneficiosEspeciais/Sindilojas/index.vue:686-712` (rota pública `/contratar-beneficios`). O token de serviço vai para o store e passa a autorizar **todas** as chamadas seguintes desses fluxos: `regra-venda-eleg-empresarial/validarRegra`, `marketplace-range-proposta/obterNumeroProposta`, `marketplace-proposta-rascunho/salvar-adesao` e `/salvar-adesao-pme`, `/enviar-token-assinatura-sindilojas`, `/enviar-assinatura-sindilojas`, `configuracao-template-pdf/gerarPdfSalvarNuvem`, inbound `iniciar-processo` ("Implantação de proposta Sindlojas" e "Implantação de proposta de serviços Assefaz").
   - **Nuxt:** `stores/auth.store.ts:13-14` (`AUTH_USER_SISTEMICO_LOGIN`/`_PW`) → `seguranca/autenticar` → token usado em `workflow-process/proxima-tarefa` (assinatura da proposta/DPS). Tudo isso tem de ir para o servidor.
2. **Todas as api-keys** (cerca de 131 em `public/app-config.js`, as de `app/core/api-endpoints.ts` no Nuxt e a api-key fixa do `/ip` em `VexurPortalInclusaoAssinatura.vue` e `ExclusaoDependente.vue`). Hoje ficam expostas no navegador. O BFF deve anexá-las no servidor.
3. Endpoints sem token do cliente (só api-key), que precisam de sessão validada no BFF:
   - `recepcao-proposta-adesao/login` com **CPF sem senha**.
   - `faturamento-cobranca-admin/obter-anos-irpf/{id}` (sem Authorization).
   - Toda a rota `/alteracao-plano` (9.1–9.9, protegida só por GUID + token).
   - `portal-cliente-seguranca/autenticar-token`.
   - No Nuxt, `obter-rascunho-id`, `verificar-proposta-tarefa-andamento`, `salvar-adesao`, `validar-assinatura-funcionario-pme` e `gerarPdfContrato` vão sem Authorization.
4. Operações em que o front hoje monta dados que o backend deveria controlar:
   - `workflow-process/iniciar-processo` e `proxima-tarefa`: o front escolhe o `processo`, o `contexto.id` e o `payload` inteiro. Em 9.6 reenvia um `processo` que veio do backend.
   - `envio-comunicacao/enviarEmailComunicacao`: assunto e HTML livres, ou seja, qualquer token de cliente dispara e-mail.
   - `enviar-token-assinatura-sindilojas`: devolve `tokenAssinatura` ao front, que compara localmente (`Sindilojas/index.vue:641, 864`).
   - `seguranca/autorizar` usado pelo cliente para uma permissão de relatório interno (`vexur-relatorios#relatorio-de-ficha-financeira`).
5. Download de boleto (`gerarBoleto`/`gerarBoletoPME`) e `obterLancamentos*`: o BFF deve validar que `idContratoAdesao`/`idContratoConveniado`/`nossoNumero` pertencem ao usuário da sessão, porque hoje os IDs vêm do cliente.

## Lacunas e dúvidas para confirmar com o backend

1. **Modelo de login:** o CPF sozinho ainda deve dar acesso, ou o novo portal passa a exigir CPF + senha/OTP? `recepcao-proposta-adesao/login` aceita as duas formas; confirmar o contrato e o campo `viaLoginSenha`.
2. **Token do cliente:** formato (JWT?), expiração, refresh e se o gateway valida o par `Authorization` + `Login` (CPF ou e-mail) contra o dono do contrato. Existe endpoint de logout real, além do processo "Logout via portal"?
3. `api-key` é por serviço e validada pelo gateway? Dá para ter uma única chave para o BFF?
4. **PIX/`emv` e `modalidadeCobranca`**: vêm de fato em `obterLancamentosPorContrato`? Há endpoint para gerar PIX ou copia-e-cola sob demanda (`pagamento-asaas`)? Quais valores reais de `statusCobranca.tipo` existem (`VENCIDA`, `NEGOCIADA`, `CONCLUÍDO`, `GERADA`, `ERRO`)? O "vencido" é calculado no backend?
5. **Carteirinha:** existe carteirinha em imagem ou PDF (operadora, `numeroCartaoIdentificacao`, QR)? Hoje é só HTML com os dados do contrato.
6. `config.api["idDocumentoCancelamento"]` e `["idDocumentoInclusao"]` **não existem no config**. Pelo `Proxy`, `tipoDominioDocumentoId.id` recebe a URL do gateway. Qual é o id correto do domínio de documento para inclusão e cancelamento? A alteração de plano usa `-1`.
7. `server-vexur-workflow-inbound` e `server-api-vexur-workflow-process` apontam para o mesmo gateway e o mesmo path. Qual o certo para o novo portal (inbound com fila? `await-response`)?
8. Nomes de processo (seção 8), inclusive a grafia "Sindlojas"/"DECLAÇÃO": confirmar a lista oficial e o payload esperado de cada um, principalmente "Inclusão de beneficiário no portal", que hoje recebe o objeto `propostaAdesao` inteiro.
9. `obter-anos-irpf` responde sem Authorization. Isso é intencional? E `enviar-declaracao-imposto-renda`/`-anual-debito` com `visualizacaoViaPortal:true` só gera a visualização ou também envia e-mail?
10. `buscarUrlPdf` recebe `cpfTitular` e está na base do faturamento-extrato, mas o path é do recepcao-proposta. Qual api-key vale? A regra `MATERIAL` combinada com `tipoMaterial` é suficiente?
11. **Alteração cadastral e dados bancários PME estão desligados** (`v-if="false"` ou comentados). Entram no escopo do novo portal? Os endpoints `regra-movimentacao-alteracao-cadastral/*` e `autenticar-token` estão estáveis?
12. Assinatura na inclusão e exclusão de dependente é só aceite + IP, sem OTP. É juridicamente suficiente ou deve seguir o `portal-cliente-seguranca/autenticar-token` usado no Nuxt?
13. `dominio` em produção aponta para `temp-v2-gateway-tecgroup`. Isso é definitivo?
14. Nuxt: `api-endpoints.ts` aponta para HML (`hml-api-gateway`). Confirmar os hosts de produção e se o fluxo `verificar-proposta-tarefa-andamento` → `proxima-tarefa` pode ser executado com o token do próprio cliente, sem o usuário sistêmico.
15. `historicoAlteracao.dadoAtual` fixo na alteração bancária PF (`AlteracaoDadosBancarios.vue:170`): o backend usa esse campo?
16. `docs/*.md` e `.tests/*.http` no repositório têm api-keys de produção e CPFs/nomes aparentemente reais, um risco de LGPD. Precisam ser saneados antes de reutilizar como referência.
