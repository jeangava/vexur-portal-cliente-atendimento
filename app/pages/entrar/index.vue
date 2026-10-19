<script setup lang="ts">
useHead({ title: 'Entrar · Portal do Cliente' })

const usuario = useUsuario()
const trocarSenha = useTrocarSenha()
const cpfDigitado = useCpfDigitado()
const { mostrar } = useAviso()
const { modoMock, loginSomenteCpf } = useRuntimeConfig().public

// Só no modo de teste: CPFs prontos para ver cada situação de planos.
const { data: cenarios } = await useFetch('/api/teste/cenarios', { default: () => [] })

function usarCenario(valor: string) {
  cpf.value = valor
  cpfDigitado.value = valor
  erroCpf.value = ''
  erroGeral.value = ''
}

const cpf = ref(cpfDigitado.value)
const senha = ref('')
const erroCpf = ref('')
const erroSenha = ref('')
const erroGeral = ref('')
const enviando = ref(false)

function aoDigitarCpf(evento: Event) {
  const campo = evento.target as HTMLInputElement
  cpf.value = formatarCpf(campo.value)
  campo.value = cpf.value
  cpfDigitado.value = cpf.value
  erroCpf.value = ''
  erroGeral.value = ''
}

// Só limpa os erros quando a pessoa volta a digitar (não quando o campo é esvaziado após um erro).
watch(senha, (valor) => {
  if (!valor) return
  erroSenha.value = ''
  erroGeral.value = ''
})

async function entrar() {
  // Preenchimento automático do navegador e "colar" nem sempre disparam o evento de digitar:
  // lê o que está no campo e põe a máscara antes de conferir.
  const campo = document.getElementById('cpf') as HTMLInputElement | null
  if (campo) {
    cpf.value = formatarCpf(campo.value)
    campo.value = cpf.value
    cpfDigitado.value = cpf.value
  }
  // No ambiente de integração a massa de teste tem CPFs fictícios: não confere os dígitos.
  erroCpf.value = problemaNoCpf(cpf.value, { conferirDigitos: !loginSomenteCpf }) ?? ''
  erroSenha.value = senha.value ? '' : 'Digite a sua senha.'
  if (erroCpf.value || erroSenha.value) return

  enviando.value = true
  try {
    const resposta = await $fetch('/api/auth/entrar', { method: 'POST', body: { cpf: cpf.value, senha: senha.value } })
    usuario.value = resposta.usuario
    trocarSenha.value = resposta.trocarSenha
    const destino = resposta.trocarSenha ? '/entrar/criar-senha' : resposta.usuario.contrato ? '/inicio' : '/escolher-plano'
    await navigateTo(destino, { replace: true })
  } catch (e) {
    erroGeral.value = mensagemDeErro(e)
    senha.value = ''
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col gap-7 px-6 pt-14 pb-8 lg:min-h-0 lg:px-10 lg:py-11">
    <div class="flex items-center gap-3 lg:hidden">
      <div class="flex size-12 items-center justify-center rounded-[14px] bg-roxo text-white">
        <Icone nome="escudo" :tamanho="28" />
      </div>
      <div class="font-display text-2xl font-extrabold tracking-tight">Vexur</div>
    </div>

    <div class="flex flex-col gap-2">
      <h1 class="m-0 font-display text-[32px] leading-[1.15] font-extrabold">Olá! Que bom ver você.</h1>
      <p class="m-0 text-[19px] text-texto">Entre com o seu CPF e a sua senha.</p>
    </div>

    <form class="flex flex-col gap-6" novalidate @submit.prevent="entrar">
      <div class="flex flex-col gap-2.5">
        <label for="cpf" class="text-[17px] font-bold">Seu CPF</label>
        <input
          id="cpf" :value="cpf" type="text" inputmode="numeric" autocomplete="username" placeholder="000.000.000-00"
          maxlength="14" :aria-invalid="!!erroCpf" :aria-describedby="erroCpf ? 'cpf-erro' : 'cpf-ajuda'"
          class="h-16 rounded-2xl border-2 bg-white px-5 text-2xl font-semibold tracking-wide text-tinta placeholder:text-[#8a91a8] focus:border-roxo"
          :class="erroCpf ? 'border-erro' : 'border-campo'"
          @input="aoDigitarCpf" @change="aoDigitarCpf" @blur="aoDigitarCpf"
        >
        <MensagemErro id="cpf-erro" :texto="erroCpf" />
        <p v-if="!erroCpf" id="cpf-ajuda" class="m-0 text-[15px] text-apoio">Só os números. Nós colocamos os pontos para você.</p>
      </div>

      <CampoSenha id="senha" v-model="senha" rotulo="Sua senha" :erro="erroSenha" />

      <div class="-mt-2 flex justify-end">
        <NuxtLink
          to="/entrar/nova-senha?motivo=esqueci"
          class="inline-flex min-h-12 items-center px-1 text-[17px] font-bold text-roxo-escuro underline underline-offset-4"
        >
          Esqueci minha senha
        </NuxtLink>
      </div>

      <MensagemErro :texto="erroGeral" />
      <p v-if="!modoMock && loginSomenteCpf" class="m-0 rounded-xl bg-erro-claro px-3 py-2 text-[15px] font-semibold text-erro">
        Ambiente de integração: entra só com o CPF (a senha ainda não é conferida pelo sistema).
      </p>
      <div v-if="modoMock" class="flex flex-col gap-2 rounded-xl bg-atencao-claro px-3 py-2 text-[15px] text-atencao">
        <p class="m-0">Ambiente de teste: use qualquer CPF válido e a senha <b>Teste@123</b>.</p>
        <details v-if="cenarios.length">
          <summary class="min-h-8 cursor-pointer font-bold">CPFs para testar vários planos</summary>
          <ul class="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            <li v-for="c in cenarios" :key="c.cpf">
              <button type="button" class="min-h-9 text-left underline underline-offset-2" @click="usarCenario(c.cpf)">
                <b>{{ c.cpf }}</b> · {{ c.descricao }}
              </button>
            </li>
          </ul>
        </details>
      </div>

      <BotaoPrincipal tipo="submit" :carregando="enviando">
        {{ enviando ? 'Entrando…' : 'Entrar' }}
        <Icone v-if="!enviando" nome="seta" :tamanho="22" :espessura="2.4" />
      </BotaoPrincipal>
    </form>

    <NuxtLink
      to="/entrar/nova-senha?motivo=primeiro-acesso"
      class="flex min-h-[76px] items-center gap-3.5 rounded-[22px] border-2 border-roxo-borda bg-roxo-fundo px-[18px] py-3.5 text-tinta no-underline"
    >
      <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-roxo text-white"><Icone nome="chave" /></span>
      <span class="flex grow flex-col">
        <span class="text-lg font-bold">Ainda não tenho senha</span>
        <span class="text-[15px] text-apoio">É o seu primeiro acesso? Comece por aqui</span>
      </span>
      <Icone nome="avancar" :tamanho="22" :espessura="2.4" class="text-roxo-icone" />
    </NuxtLink>

    <div class="grow lg:hidden" />

    <button
      type="button"
      class="flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-transparent text-[17px] font-bold text-roxo-escuro"
      @click="mostrar('Em breve: aqui abre a conversa com o atendimento.')"
    >
      <Icone nome="conversa" :tamanho="22" />
      Preciso de ajuda para entrar
    </button>
  </main>
</template>
