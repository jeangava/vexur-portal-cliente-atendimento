# Portal do Cliente Vexur

Novo portal do beneficiário, feito para ser simples de usar por qualquer pessoa
(botões grandes, uma ação por tela, linguagem do dia a dia). Responsivo:
celular (barra de baixo), tablet (duas colunas) e notebook/desktop (menu lateral).

**Stack:** Nuxt 4 (SSR) · Vue 3 · TypeScript · Tailwind 4.
O servidor do Nuxt (`server/`) funciona como BFF: é ele que conversa com o
gateway Vexur, guarda a sessão em cookie criptografado/HttpOnly e mantém
api-keys, credenciais e contatos completos fora do navegador.

## Rodar localmente

```bash
npm install
npm run dev          # http://localhost:3020
npm run dev:rede     # expõe na rede local, para abrir no celular
npm test             # testes unitários
npm run typecheck    # checagem de tipos
```

Por padrão roda em **modo mock** (dados fictícios, sem chamar nenhuma API).

### Acesso de teste (modo mock)

- **CPF:** qualquer CPF válido (ex.: `529.982.247-25`).
- **Senha de quem já tem acesso:** `Teste@123`.
- **Senha "que chegou por SMS/e-mail"** (primeiro acesso / esqueci): `Nova@2026` —
  entrar com ela obriga a criar uma senha nova. A senha criada vale até reiniciar o servidor.
- **Situação da conta do mês:** `NUXT_MOCK_SITUACAO` = `aberta`, `vence-hoje` ou `atrasada`.
  Com `atrasada` aparecem o popup de comunicado vigente e o bloqueio da quitação de débito
  (no Claude Code: configuração `vexur-portal-cliente-dev-atrasada`, porta 3021).
  Não rode os dois cenários ao mesmo tempo: eles dividem a pasta `.nuxt`.
- Em desenvolvimento a chave da sessão fica em `.data/sessao-dev.key` (fora do git), para o
  login não cair a cada recarga do servidor. Senhas criadas e pedidos de movimentação do mock
  ficam só na memória e somem ao reiniciar.

## Regras de negócio implementadas

- **Login com CPF + senha.** 5 tentativas erradas bloqueiam por 10 minutos (por sessão;
  o limite definitivo por CPF precisa existir no backend).
- **Esqueci minha senha / Ainda não tenho senha (primeiro acesso):** o cliente informa o CPF,
  escolhe **SMS ou e-mail** (os contatos aparecem mascarados, ex.: `(••) •••••-4321`,
  `ma•••@email.com`) e recebe uma senha nova. No máximo 3 envios a cada 15 minutos.
- **Troca obrigatória:** quem entra com a senha recebida só consegue criar a senha nova;
  o resto do portal (telas e APIs) fica bloqueado até trocar.
- **Comunicados:** cópias das mensagens enviadas (e-mail, SMS, carta).
- **Comunicado vigente:** inadimplência/suspensão ligada a uma mensalidade. Enquanto ela não
  tiver baixa, abre em **popup a cada login**; fechar vale só para aquele login. Quando a
  mensalidade é paga, deixa de ser vigente sozinho e fica como "Resolvido" no histórico.
- **Extrato de cada conta:** detalhe por pessoa (mensalidade, taxas), subtotais e total.
  "Imprimir ou salvar em PDF" usa a impressão do navegador, com folha A4 sem menus/botões.
- **Minha família:** titular e dependentes, cada um com o número da carteirinha (com botão
  copiar) e as características do produto: tipo de quarto, onde vale, o que cobre,
  coparticipação, início no plano, valor por mês e registro ANS. Não existe mais uma área
  "Carteirinha" separada.
- **Movimentação:** lista quem está no plano; cada dependente tem "Tirar do plano" e existe
  "Incluir alguém no plano". Inclusão em 4 etapas:
  1. **Evento** — "Sim, é recém-nascido/casamento/tutela" pede parentesco e data do evento
     (avisa se passaram mais de 30 dias: pode haver carência); "Não" pergunta
     **"O dependente possui ou já possuiu plano de saúde?"** — "Sim, possui" pede parentesco e os
     **dados do plano anterior** (tipo, operadora, plano, tempo em meses, último pagamento);
     "Não possui" pede só o parentesco e segue para o cadastro. Parentesco e tipo de plano são
     listas de seleção (cada contrato pode ter muitos parentescos).
  2. **Cadastro** — nome, CPF, nascimento (recém-nascido já vem com a data do evento) e
     documento (JPG/PNG/PDF até 5 MB, validado no servidor).
  3. **Declaração de saúde** — perguntas vindas do backend (modelo de
     `regra-aceitacao-declaracao-saude`): Sim/Não, data, texto, número e campo calculado
     (IMC). Subpergunta ("1.1") só aparece e só é obrigatória após "Sim". A fórmula é
     calculada por uma calculadora própria (só números e + − × ÷ ^), sem `mathjs`.
     Validada de novo no servidor. No mock, recém-nascido incluído em até 30 dias é dispensado
     (regra a confirmar com a operadora).
  4. **Plano & conferência** — plano do dependente (o do titular), resumo (inclui as respostas
     "Sim" da DPS) e aceite.
  5. **Finalização** — protocolo.
- **Meus pedidos:** todos os pedidos (movimentação, serviços, atendimento), com filtros e
  "Precisam de você" primeiro. Movimentação continua listando só os pedidos de movimentação.
  Cada pedido tem uma tela de resultado:
  - **Falta algo seu (pendente):** mostra o que falta e o prazo; o cliente envia o documento
    ali mesmo e o pedido volta para análise.
  - **Não aprovado (indeferido):** motivo em linguagem simples + "Fazer um novo pedido" /
    "Falar com a gente".
  - **Concluído:** resultado e arquivos para baixar (ex.: carta de inclusão).
  - Histórico ("O que aconteceu") em todos. O Início avisa quando algum pedido precisa do cliente.
  - Todo serviço pedido (IR, quitação…) também vira um pedido, com cópia do documento. Exclusão: quem sai → motivo e data (fim do mês
  ou imediato) → confirmar. Titular não sai por aqui (é cancelamento); não aceita pedido de
  saída repetido para a mesma pessoa. Cada pedido gera protocolo em "Minhas solicitações".
  A declaração de saúde (DPS) da inclusão entra quando as regras vierem do backend.
- **Principais serviços:** Informe de rendimentos (IR), Quitação anual, Quitação de débito,
  Extrato de cobrança e Carta de boas-vindas, enviados para o e-mail do cadastro.
  A quitação de débito fica bloqueada enquanto houver conta **atrasada**.

## Telas e APIs do BFF

| Tela | Rota | API do BFF |
|---|---|---|
| Entrar | `/entrar` | `POST /api/auth/entrar` |
| Esqueci / primeiro acesso | `/entrar/nova-senha?motivo=esqueci\|primeiro-acesso` | `POST /api/auth/contatos`, `POST /api/auth/nova-senha` |
| Criar a própria senha | `/entrar/criar-senha` | `POST /api/auth/trocar-senha` |
| Início | `/inicio` | `GET /api/faturas`, `GET /api/comunicados`, `POST /api/auth/sair` |
| Minhas contas | `/contas` | `GET /api/faturas` |
| Detalhe / PIX / boleto | `/contas/:id`, `/pix`, `/boleto` | `GET /api/faturas/:id[/pix\|/boleto]` |
| Extrato da conta (imprimir / salvar em PDF) | `/contas/:id/extrato` | `GET /api/faturas/:id/extrato` |
| Serviços | `/servicos`, `/servicos/:id` | `GET /api/servicos`, `POST /api/servicos/:id` |
| Comunicados | `/comunicados`, `/comunicados/:id` | `GET /api/comunicados[/:id]` |
| Popup de vigentes | (todas as telas logadas) | `GET /api/comunicados/vigentes`, `POST /api/comunicados/vigentes/ciente` |
| Minha família (titular, dependentes, produtos e nº da carteirinha) | `/familia` | `GET /api/familia` |
| Movimentação (lista de beneficiários + solicitações) | `/movimentacao` | `GET /api/movimentacao` |
| Incluir beneficiário (Evento → Cadastro → Plano & conferência → Finalização) | `/movimentacao/incluir` | `GET /api/movimentacao/opcoes`, `POST /api/movimentacao/documento`, `POST /api/movimentacao/inclusao` |
| Tirar beneficiário (3 passos) | `/movimentacao/excluir?pessoa=:id` | `POST /api/movimentacao/exclusao` |
| Declaração de saúde (etapa da inclusão) | — | `POST /api/movimentacao/declaracao-saude` |
| Meus pedidos (todos os tipos) | `/pedidos` | `GET /api/pedidos` |
| Resultado e ação do pedido | `/pedidos/:protocolo` | `GET /api/pedidos/:protocolo`, `POST .../regularizar`, `GET .../anexos/:id` |
| Ajuda | `/ajuda` | — |

## Ligar no ambiente real (stage Tecgroup)

1. Copie `.env.example` para `.env` e preencha `NUXT_GATEWAY_URL` e as chaves `NUXT_API_KEYS_*`.
2. `NUXT_MODO_MOCK=false` e `NUXT_PUBLIC_MODO_MOCK=false`.
3. Para entrar: `NUXT_LOGIN_SOMENTE_CPF=true` e `NUXT_PUBLIC_LOGIN_SOMENTE_CPF=true`
   (o backend ainda não tem CPF + senha; a senha digitada não é conferida).
4. Escritas (inclusão, exclusão, processos, e-mails) só com `NUXT_PERMITIR_ESCRITA=true`;
   toda escrita permitida gera uma linha de auditoria no log do servidor.

**Fase 1 ligada (leitura):** login (legado, só CPF), Minha família, Minhas contas, detalhe,
extrato e linha digitável do boleto. Chamadas em `server/utils/integracao.ts`, tradução em
`server/utils/mapeamento.ts` (testada com respostas falsas em `tests/fakes/`).
O resto responde "ainda não está ligada ao sistema" até a próxima fase.

Segurança: o contrato consultado é sempre o gravado na sessão no login — o navegador não
escolhe `idContratoAdesao`. (Os serviços do backend só validam o token, não o dono do contrato.)

## Próximo passo: integração com o gateway

Toda a troca de mock → API real acontece em `server/utils/backend.ts`
(inventário completo em `docs/inventario-apis.md`). A confirmar com o backend:

- **Login:** hoje o legado entra só com CPF (`operacao-recepcao-proposta-adesao/login`).
  Precisa de um login CPF + senha e de uma marca de "senha temporária" para forçar a troca.
- **Senha nova:** o legado usa `seguranca/esqueci-minha-senha` + `/criar-nova-senha`
  (token por SMS/e-mail). Falta um endpoint que liste os contatos do cadastro e envie a
  senha temporária pelo canal escolhido.
- **Faturas:** `faturamento-extrato-cliente/obterLancamentosPorContrato[Conveniado]`;
  2ª via `faturamento-cobranca-gerar/gerarBoleto[PME]`; PIX: confirmar o campo `emv`.
- **Comunicados:** `regra-venda-comunicacao/contrato/obterComunicacoes` — confirmar se guarda
  a cópia do conteúdo, o tipo (inadimplência/suspensão) e a mensalidade de origem.
- **Serviços:** IR `faturamento-cobranca-admin/obter-anos-irpf` + `/enviar-declaracao-imposto-renda`;
  quitação anual `/enviar-declaracao-anual-debito`; faltam quitação de débito, extrato e carta.

Regra: o BFF sempre busca os dados **a partir do usuário da sessão** — nunca
confia em ids de contrato/fatura/comunicado vindos do navegador.
