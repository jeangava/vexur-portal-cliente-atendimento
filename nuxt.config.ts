import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'Portal do Cliente',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#6955c1' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap',
        },
      ],
    },
  },

  // Tudo que é segredo fica só no servidor (sem `public`).
  // Em produção, defina por variável de ambiente: NUXT_SESSION_PASSWORD, NUXT_MODO_MOCK, NUXT_GATEWAY_URL...
  runtimeConfig: {
    sessionPassword: '',
    modoMock: true,
    mockSituacao: 'aberta',
    gatewayUrl: '',
    /**
     * Trava de segurança: enquanto for false, o portal só LÊ do gateway real.
     * Nada de incluir/excluir beneficiário, abrir processo no workflow ou disparar e-mail.
     */
    permitirEscrita: false,
    /**
     * O backend ainda não tem login CPF + senha. Para testar com dados reais, true usa o
     * login do portal antigo (só CPF) — a senha digitada NÃO é conferida. Nunca em produção.
     */
    loginSomenteCpf: false,
    /**
     * Uma chave por serviço do gateway (preencher no .env, nunca no código).
     * Ex.: NUXT_API_KEYS_FATURAMENTO_EXTRATO_CLIENTE → apiKeys.faturamentoExtratoCliente
     */
    apiKeys: {
      seguranca: '',
      portalClienteSeguranca: '',
      operacaoRecepcaoPropostaAdesao: '',
      operacaoImplantacaoContratoAdesao: '',
      faturamentoExtratoCliente: '',
      faturamentoCobrancaGerar: '',
      faturamentoCobrancaAdmin: '',
      regraVendaComunicacao: '',
      regraAceitacaoDeclaracaoSaude: '',
      workflowProcess: '',
      repositorioDocumentos: '',
      gestaoEletronicaDocumento: '',
      regraAceitacaoCalendario: '',
      gestaoProtocolos: '',
      checklistProduto: '',
      dominio: '',
      envioComunicacao: '',
      regraServicosOnline: '',
      regraVendaAceitacaoBeneficiario: '',
      regraVendaTabelaPreco: '',
      localidades: '',
      regraMovimentacaoAlteracaoCadastral: '',
    },
    public: {
      modoMock: true,
      /** Mostra na tela de login o aviso de que a senha ainda não é conferida */
      loginSomenteCpf: false,
    },
  },

  // Deixa o servidor saber "de quem é a requisição" em qualquer função (useEvent),
  // para as chamadas ao gateway usarem sempre as credenciais da sessão certa.
  nitro: {
    experimental: { asyncContext: true },
  },

  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Frame-Options': 'DENY',
      },
    },
  },
})
