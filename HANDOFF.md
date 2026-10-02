# HANDOFF — Portal do Cliente Vexur (novo)

Última atualização: 02/10/2026 · Pasta: `Vexur/vexur-portal-cliente` ·
Repositório: https://github.com/vexur-startup/vexur-portal-cliente (branch `main`).
**Fluxo combinado:** cada entrega numa branch própria + PR para revisão; nunca commit direto em `main`.

---

## 1. Objetivo

Substituir o Portal do Cliente legado (`vexur-portal-cliente-home`, Vue 2, sem suporte) por um portal novo,
feito do zero e consumindo as APIs atuais do gateway Vexur, com duas metas:

- **Simples de usar por qualquer pessoa** ("até uma criança"): botões grandes, uma ação por tela,
  linguagem do dia a dia, erros explicados ao lado do campo.
- **Seguro**: nada de api-key ou credencial no navegador (o legado expõe ~130 chaves e uma senha de
  usuário de serviço). O servidor do Nuxt funciona como BFF.

Contexto: o repo `vexur-portal-cliente-home-nuxt` **não** é a reescrita do portal — é um app separado só de
assinatura/DPS. A avaliação completa dos dois repositórios e o inventário de APIs estão em `docs/inventario-apis.md`.

## 2. Stack e como rodar

- Nuxt 4.5 (SSR) · Vue 3.5 · TypeScript 5.9 (o 7 quebra o `vue-tsc`) · Tailwind 4 · Vitest · `qrcode`.
- Identidade visual Vexur (roxo `#6955c1`, DM Sans + Manrope), tokens em `app/assets/css/main.css`.
- `npm install` · `npm run dev` (http://localhost:3020) · `npm test` · `npm run typecheck`.
- No Claude Code: configurações `vexur-portal-cliente-dev` (porta 3020) e `vexur-portal-cliente-dev-atrasada`
  (porta 3021, conta atrasada) em `Vexur/.claude/launch.json`. **Não rodar os dois juntos** (dividem `.nuxt`).
- Acesso de teste (modo mock): qualquer CPF válido (ex.: 529.982.247-25) + senha `Teste@123`.
  Senha "recebida por SMS/e-mail" no mock: `Nova@2026` (força a troca de senha).
- Protótipo visual inicial (canvas): https://claude.ai/artifact/R5cwcy7BnhtWedRrwVRmh3

Último estado verificado: **33 testes passando**, typecheck sem erros, servidor de teste respondendo.

## 3. O que já foi feito

Tudo funciona em **modo mock** (dados fictícios). A fase 1 da integração real está escrita, mas
**ainda não foi testada contra o gateway** (falta o `.env`).

| Área | Rota | Situação |
|---|---|---|
| Login CPF + senha (5 tentativas → bloqueio 10 min) | `/entrar` | mock ✔ · real: login legado só com CPF (flag) |
| Esqueci minha senha / Primeiro acesso: CPF → escolhe **SMS ou e-mail** (contatos mascarados) → senha temporária | `/entrar/nova-senha` | mock ✔ |
| Troca obrigatória da senha temporária (resto do portal bloqueado até trocar) | `/entrar/criar-senha` | mock ✔ |
| Início (conta do mês, atalhos, avisos de pedidos pendentes, últimos comunicados) | `/inicio` | mock ✔ |
| Minhas contas, detalhe, PIX (QR real) e boleto (copiar linha) | `/contas`, `/contas/:id`, `/pix`, `/boleto` | mock ✔ · real: contas e linha digitável |
| Extrato de cada conta, imprimir / salvar em PDF (folha A4 limpa) | `/contas/:id/extrato` | mock ✔ · real ✔ (escrito) |
| Minha família: titular + dependentes, produto e **nº da carteirinha** (área "Carteirinha" foi removida a pedido) | `/familia` | mock ✔ · real ✔ (escrito) |
| Comunicados + **comunicado vigente** (inadimplência/suspensão em popup a cada login até a baixa da mensalidade) | `/comunicados` | mock ✔ |
| Principais serviços: IR, quitação anual, quitação de débito (bloqueada com conta atrasada), extrato, carta de boas-vindas | `/servicos` | mock ✔ |
| Movimentação: lista de beneficiários com incluir / tirar do plano; pedidos de movimentação | `/movimentacao` | mock ✔ |
| Inclusão em 5 etapas: Evento → Cadastro → **Declaração de saúde** → Plano & conferência → Finalização | `/movimentacao/incluir` | mock ✔ |
| Exclusão em 3 passos (quem sai → motivo e data → confirmar) | `/movimentacao/excluir` | mock ✔ |
| Meus pedidos (todos os tipos) + tela de resultado: pendência regularizável (envio de documento), indeferido com motivo, concluído com anexos, histórico | `/pedidos`, `/pedidos/:protocolo` | mock ✔ |
| Responsivo: celular (barra de baixo), tablet (2 colunas), notebook (menu lateral, login em tela dividida) | — | ✔ |

Detalhe das regras de cada área no `README.md`.

### 3.1 Vários contratos por CPF e perfis de acesso (01/10/2026, nova conta)

- **Escolha do plano** (`/escolher-plano`): só entra direto com 1 contrato (ativo ou não); com 2+ contratos
  sempre pergunta. Ativos primeiro; encerrados guardados em "Ver planos encerrados" (abertos direto quando
  não há ativo). "Trocar de plano" no menu lateral e no Início (celular).
- **Perfis** (`shared/utils/contratos.ts`, testado em `tests/contratos.test.ts`):
  adesão/individual titular e **representante** da empresa → tudo; **titular de empresarial** → só Família
  (sem valores, o servidor nem envia), Comunicados e Pedidos do contrato dele; **plano cancelado** → tudo menos
  Movimentação. Menu, atalhos e Início se adaptam; servidor bloqueia com `exigirArea` (403).
- Mock: CPFs de cenário na tela de login (`CENARIOS_TESTE` em `server/utils/mock.ts`). Pedidos, família,
  contas e comunicados mudam por contrato.
- Real: `mapearLogin` agora devolve todos os contratos; tipo pela marcação (`tipoDoContrato`, campo a confirmar).
  **Falta no backend**: indicar representante da empresa e nome da empresa no login.

### 3.2 Responsável pela empresa: lista grande e movimentação em lote (01/10/2026)

- **Beneficiários** (`/familia` quando `papel = representante`; componente `ListaEmpresa`): resumo
  (titulares/dependentes/total), busca por nome, CPF ou carteirinha, filtros (plano, "saindo do plano"),
  20 titulares por vez + "Ver mais", dependentes abrem por titular. Mock: empresa com 90 titulares.
- **Tirar do plano** (`/movimentacao/empresa/excluir`): mesma lista com marcação; titular marcado leva os
  dependentes; barra fixa com o total; motivo e data uma vez para todos; um protocolo por lote.
- **Incluir** (`/movimentacao/empresa/incluir`): "Uma pessoa" (funcionário ou dependente → busca o titular) ou
  "Várias (planilha)": baixar modelo .xlsx (listas de parentesco/plano) → enviar → conferência linha a linha
  → envia só as prontas (um protocolo, `pessoasLote` no detalhe do pedido). A conferência fica no servidor
  (o navegador só manda o id). Regras em `shared/utils/inclusaoEmpresa.ts` (testadas); leitura/geração em
  `server/utils/planilha.ts` (`exceljs`, com `overrides.uuid` para fechar o alerta do npm audit).
- Decisões do usuário: planilha **sem declaração de saúde** e **só para o responsável (empresarial)**.
  **Layout da planilha é provisório** (`COLUNAS_PLANILHA`) — será definido depois, junto com matrícula/setor
  e com "cancelamento por planilha".
- 02/10: responsável que também é titular na mesma empresa vê **só a visão de responsável**
  (`simplificarContratos`, aplicado no login). Beneficiários ganhou filtro **Ativos / Cancelados / Todos**
  (começa em Ativos; resumo conta só ativos). Cancelado não pode ser marcado para sair e pode ser incluído de novo.
- Falta: baixar a lista em Excel; integração real (endpoints de beneficiários da empresa e de lote).
- A confirmar com o usuário: o que o representante vê em Família/Contas/Movimentação (empresa inteira?);
  regras do plano cancelado; "contrato dele vs. do outro titular da empresa" em Pedidos.

## 4. Arquivos (todos novos — projeto criado do zero)

```
nuxt.config.ts            runtimeConfig (segredos só no servidor), travas, asyncContext
.env.example              modelo das variáveis (sem valores) — o .env real NÃO existe ainda
README.md                 como rodar, regras de negócio, tabela de rotas/APIs
docs/inventario-apis.md   inventário de APIs do legado (sem chaves/CPFs)
app/
  pages/                  telas (entrar/, inicio, contas/, familia, comunicados/, servicos/,
                          movimentacao/, pedidos/, ajuda)
  layouts/                default (login em tela dividida) · portal (menu lateral / barra de baixo)
  components/             Botões, campos (CampoTexto, CampoSelecao, CampoSenha), OpcaoGrande,
                          IndicadorPassos, DeclaracaoSaudeForm, EnvioDocumentos, Cartao*,
                          PopupComunicadoVigente, Icone (SVG inline)
  composables/usePortal.ts  estado de usuário, aviso (toast), sair, copiar texto
  middleware/auth.global.ts sessão, troca obrigatória de senha, rotas públicas
server/
  api/                    BFF: auth/, faturas/, familia, comunicados/, servicos/, movimentacao/, pedidos/
  utils/backend.ts        PONTO ÚNICO: cada função escolhe mock ou gateway real
  utils/integracao.ts     chamadas reais (fase 1: login, contrato, cobranças)
  utils/gateway.ts        cliente do gateway (api-key, token, timeout, log sem segredos, trava de escrita)
  utils/mapeamento.ts     tradução backend → portal (funções puras, testadas)
  utils/mock.ts           dados fictícios
  utils/sessao.ts         sessão em cookie criptografado/HttpOnly
shared/
  types/portal.ts         tipos compartilhados
  utils/                  cpf, senha, máscara, formato, dps (calculadora segura), movimentação, serviços
tests/                    5 arquivos de teste + fakes/respostas-gateway.ts
```

Fora do projeto: `Vexur/.claude/launch.json` (2 entradas novas). Memória do assistente:
`portal_cliente_avaliacao.md`.

## 5. Decisões tomadas

1. **Projeto novo** (não evoluir o legado nem o app Nuxt de assinatura). Nuxt 4 com SSR para ter BFF.
2. **Marca Vexur**, mobile-first e depois responsivo para notebook (pedido do usuário).
3. **Login CPF + senha** (substituiu o código por SMS do protótipo). Senha nova por SMS **ou** e-mail à escolha,
   com contatos mascarados no servidor. Troca obrigatória após senha temporária.
4. **Carteirinha** deixou de ser área própria: o número fica em Minha família.
5. **Meus pedidos** reúne tudo; **Movimentação** mostra exclusivamente os pedidos de movimentação.
6. **Inclusão**: parentesco e tipo de plano anterior em **lista de seleção** (contratos podem ter muitos
   parentescos); caminho "Não" pergunta "O dependente possui ou já possuiu plano de saúde?" — "Não possui" vai
   direto ao cadastro.
7. **DPS** no formato do backend (`ordemQuestao` 1, 1.1; tipos Sim/Não, data, texto, número, calculado).
   Fórmula (IMC) com **calculadora própria** — o `mathjs` do app antigo tem vulnerabilidade conhecida.
8. **Ambiente de integração: stage Tecgroup** (`gateway-tecgroup.vexur.com.br` — mesmo host do `producao-tecgroup`,
   portanto provavelmente **dados reais**).
9. **Trava de escrita** (`NUXT_PERMITIR_ESCRITA`, padrão `false`): o usuário quer testar "na vera"; ele liga quando
   quiser e toda escrita permitida gera log de auditoria.
10. **Chaves de API** só no `.env` (preenchido pelo usuário; o assistente não lê `.env` nem copia chaves do legado).
11. **Segurança do BFF**: o contrato consultado é sempre o gravado na sessão no login — o navegador nunca escolhe
    `idContratoAdesao`/protocolo de outra pessoa.
12. **CPFs de teste**: o usuário escolhe na tela; o assistente não extrai CPFs da base.

## 6. Pendências

**Para testar a fase 1 com dados reais (ação do usuário):**
- Criar `.env` a partir do `.env.example` com: `NUXT_GATEWAY_URL=https://gateway-tecgroup.vexur.com.br`,
  `NUXT_MODO_MOCK=false`, `NUXT_PUBLIC_MODO_MOCK=false`, `NUXT_LOGIN_SOMENTE_CPF=true`,
  `NUXT_PUBLIC_LOGIN_SOMENTE_CPF=true` e as chaves `NUXT_API_KEYS_OPERACAO_RECEPCAO_PROPOSTA_ADESAO`,
  `..._OPERACAO_IMPLANTACAO_CONTRATO_ADESAO`, `..._FATURAMENTO_EXTRATO_CLIENTE`.

**A confirmar com backend / negócio:**
- Login **CPF + senha** e marca de "senha temporária" (hoje o legado entra só com CPF).
- Endpoint que liste contatos do cadastro e envie senha temporária por SMS/e-mail.
- **PIX**: o extrato (`obterLancamentosPorContrato`) não traz `emv` — precisa de endpoint próprio.
- PDF da 2ª via (`faturamento-cobranca-gerar/gerarBoleto`).
- Comunicados: se `regra-venda-comunicacao/obterComunicacoes` guarda cópia do conteúdo, tipo
  (inadimplência/suspensão) e mensalidade de origem (base do popup vigente).
- Regras reais de parentesco por contrato, DPS por produto e dispensa de DPS para recém-nascido (mock usa 30 dias).
- Prazo de 30 dias do evento para inclusão sem carência (aviso exibido; confirmar no contrato).
- Se a pergunta de plano anterior também vale no caminho "recém-nascido/casamento/tutela".
- Se `gateway-tecgroup` é produção e se existe um gateway de homologação da Tecgroup.
- Limites de tentativa/envio hoje são por sessão; o definitivo por CPF precisa ficar no backend.

**Segurança no backend (reportar ao time):**
- `autorizar` de `api-vexur-faturamento-extrato-cliente` (controller.js:28-29) e de
  `api-vexur-operacao-implatancao-contrato-adesao` (controller.js:1524-1525) **logam a API_KEY e o token**.
- Esses serviços só validam o token, **não o dono do contrato** (IDOR) — o portal novo compensa no BFF, o legado não.
- Legado (já avaliado): senha de usuário de serviço e ~130 api-keys no bundle público — rotacionar.

**Técnico:**
- Iniciar repositório git e decidir o remoto/branch (nada foi commitado).
- PME (contratos empresariais) e cliente com **mais de um contrato** (hoje usa o contrato ativo em que é titular).
- Dados do mock ficam em memória (pedidos, senhas criadas somem ao reiniciar).
- Contatos reais da Ajuda (WhatsApp, telefone, horário) estão como `[NÚMERO]`, `[TELEFONE]`.
- Botão "Baixar boleto (PDF)" ainda é placeholder.

## 7. Próximos passos (ordem sugerida)

1. Usuário cria o `.env` → reiniciar o servidor → testar login real com um CPF escolhido por ele → conferir no log do
   servidor família, contas e extrato. Ajustar `mapeamento.ts` conforme os dados reais.
2. **Fase 2 — pagamento**: PDF do boleto (`gerarBoleto`/`gerarBoletoPME`) e PIX (quando houver endpoint).
3. **Fase 3 — serviços**: IR (`obter-anos-irpf`, `enviar-declaracao-imposto-renda`), quitação anual
   (`enviar-declaracao-anual-debito`), comunicados (`obterComunicacoes`).
4. **Fase 4 — movimentação e DPS**: parentescos e DPS por produto (`regra-aceitacao-declaracao-saude/obterRegraProduto`),
   upload no GED/`repositorio-documentos`, processos no `workflow-process/iniciar-processo`; pedidos via
   `operacao-gestao-protocolos`. Ligar `NUXT_PERMITIR_ESCRITA` só quando o usuário decidir.
5. **Fase 5 — acesso**: login CPF + senha, senha temporária e troca obrigatória, quando o backend suportar.
6. Git, CI (lint + typecheck + testes + build), deploy e plano de convivência/desligamento do legado.
