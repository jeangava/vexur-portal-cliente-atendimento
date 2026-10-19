<script setup lang="ts">
import type { CanalEnvio, ContatoRecuperacao } from '#shared/types/portal'

const route = useRoute()
const { loginSomenteCpf } = useRuntimeConfig().public
const cpfDigitado = useCpfDigitado()
const { mostrar } = useAviso()

const primeiroAcesso = computed(() => route.query.motivo === 'primeiro-acesso')
const textos = computed(() => primeiroAcesso.value
  ? { titulo: 'Vamos criar o seu acesso', apoio: 'Digite o seu CPF. Vamos mandar uma senha para você entrar pela primeira vez.' }
  : { titulo: 'Esqueceu a senha? Sem problema.', apoio: 'Digite o seu CPF. Vamos mandar uma senha nova para você.' })
useHead({ title: () => `${primeiroAcesso.value ? 'Primeiro acesso' : 'Esqueci minha senha'} · Portal do Cliente` })

type Etapa = 'cpf' | 'canal' | 'enviado'
const etapa = ref<Etapa>('cpf')
const cpf = ref(cpfDigitado.value)
const contatos = ref<ContatoRecuperacao[]>([])
const canal = ref<CanalEnvio | ''>('')
const enviadoPara = ref<ContatoRecuperacao | null>(null)
const erro = ref('')
const carregando = ref(false)

const NOME_CANAL: Record<CanalEnvio, { titulo: string, icone: string, onde: string }> = {
  sms: { titulo: 'Por SMS', icone: 'celular', onde: 'no SMS do celular' },
  email: { titulo: 'Por e-mail', icone: 'email', onde: 'no seu e-mail (olhe também o spam)' },
}

function aoDigitarCpf(evento: Event) {
  const campo = evento.target as HTMLInputElement
  cpf.value = formatarCpf(campo.value)
  campo.value = cpf.value
  cpfDigitado.value = cpf.value
  erro.value = ''
}

async function buscarContatos() {
  const campo = document.getElementById('cpf-recuperacao') as HTMLInputElement | null
  if (campo) {
    cpf.value = formatarCpf(campo.value)
    campo.value = cpf.value
    cpfDigitado.value = cpf.value
  }
  const problema = problemaNoCpf(cpf.value, { conferirDigitos: !loginSomenteCpf })
  if (problema) { erro.value = problema; return }
  carregando.value = true
  try {
    const resposta = await $fetch('/api/auth/contatos', { method: 'POST', body: { cpf: cpf.value } })
    contatos.value = resposta.contatos
    canal.value = resposta.contatos.length === 1 ? resposta.contatos[0]!.canal : ''
    etapa.value = 'canal'
  } catch (e) {
    erro.value = mensagemDeErro(e)
  } finally {
    carregando.value = false
  }
}

async function enviar() {
  if (!canal.value) { erro.value = 'Escolha se quer receber por SMS ou por e-mail.'; return }
  carregando.value = true
  try {
    const resposta = await $fetch('/api/auth/nova-senha', { method: 'POST', body: { canal: canal.value } })
    enviadoPara.value = { canal: resposta.canal as CanalEnvio, destino: resposta.destino }
    etapa.value = 'enviado'
  } catch (e) {
    erro.value = mensagemDeErro(e)
  } finally {
    carregando.value = false
  }
}

function voltar() {
  erro.value = ''
  if (etapa.value === 'canal') etapa.value = 'cpf'
  else if (etapa.value === 'enviado') etapa.value = 'canal'
  else navigateTo('/entrar')
}

watch(canal, () => { erro.value = '' })
</script>

<template>
  <main class="flex min-h-dvh flex-col gap-7 px-6 pt-6 pb-8 lg:min-h-0 lg:px-10 lg:py-9">
    <div>
      <button
        type="button"
        class="inline-flex min-h-12 items-center gap-1.5 rounded-[14px] bg-white py-0 pr-4 pl-2.5 text-[17px] font-bold text-tinta shadow-leve"
        @click="voltar"
      >
        <Icone nome="voltar" :tamanho="22" :espessura="2.4" />
        Voltar
      </button>
    </div>

    <!-- Passo 1: CPF -->
    <template v-if="etapa === 'cpf'">
      <div class="flex size-[88px] items-center justify-center rounded-[28px] bg-roxo-claro text-roxo-icone">
        <Icone nome="chave" :tamanho="44" :espessura="1.8" />
      </div>
      <div class="flex flex-col gap-2">
        <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold">{{ textos.titulo }}</h1>
        <p class="m-0 text-lg text-texto">{{ textos.apoio }}</p>
      </div>
      <form class="flex flex-col gap-6" novalidate @submit.prevent="buscarContatos">
        <div class="flex flex-col gap-2.5">
          <label for="cpf-recuperacao" class="text-[17px] font-bold">Seu CPF</label>
          <input
            id="cpf-recuperacao" :value="cpf" type="text" inputmode="numeric" autocomplete="username" placeholder="000.000.000-00"
            maxlength="14" :aria-invalid="!!erro" :aria-describedby="erro ? 'cpf-recuperacao-erro' : undefined"
            class="h-16 rounded-2xl border-2 bg-white px-5 text-2xl font-semibold tracking-wide text-tinta placeholder:text-[#8a91a8] focus:border-roxo"
            :class="erro ? 'border-erro' : 'border-campo'"
            @input="aoDigitarCpf" @change="aoDigitarCpf" @blur="aoDigitarCpf"
          >
          <MensagemErro id="cpf-recuperacao-erro" :texto="erro" />
        </div>
        <BotaoPrincipal tipo="submit" :carregando="carregando">
          {{ carregando ? 'Procurando…' : 'Continuar' }}
          <Icone v-if="!carregando" nome="seta" :tamanho="22" :espessura="2.4" />
        </BotaoPrincipal>
        <BotaoPrincipal variante="contorno" @click="voltar">
          <Icone nome="voltar" :tamanho="22" :espessura="2.4" />
          Voltar para o login
        </BotaoPrincipal>
      </form>
    </template>

    <!-- Passo 2: escolher SMS ou e-mail -->
    <template v-else-if="etapa === 'canal'">
      <div class="flex flex-col gap-2">
        <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold">Onde você quer receber a senha?</h1>
        <p class="m-0 text-lg text-texto">Esses são os contatos do seu cadastro. Por segurança, mostramos só uma parte.</p>
      </div>
      <form class="flex flex-col gap-6" novalidate @submit.prevent="enviar">
        <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
          <legend class="sr-only">Meio para receber a senha</legend>
          <label
            v-for="c in contatos" :key="c.canal"
            class="flex min-h-[84px] cursor-pointer items-center gap-3.5 rounded-[22px] border-2 bg-white px-[18px] py-3.5 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-roxo"
            :class="canal === c.canal ? 'border-roxo bg-roxo-fundo shadow-[0_6px_20px_#7864d01f]' : 'border-[#e3e4ed]'"
          >
            <input v-model="canal" type="radio" name="canal" :value="c.canal" class="sr-only">
            <span class="flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-roxo-claro text-roxo-icone">
              <Icone :nome="NOME_CANAL[c.canal].icone" :tamanho="28" />
            </span>
            <span class="flex min-w-0 grow flex-col">
              <span class="text-[19px] font-bold">{{ NOME_CANAL[c.canal].titulo }}</span>
              <span class="truncate text-[17px] tracking-wide text-texto">{{ c.destino }}</span>
            </span>
            <span
              aria-hidden="true"
              class="flex size-7 shrink-0 items-center justify-center rounded-full border-2"
              :class="canal === c.canal ? 'border-roxo bg-roxo text-white' : 'border-campo bg-white'"
            >
              <Icone v-if="canal === c.canal" nome="certo" :tamanho="16" :espessura="3" />
            </span>
          </label>
        </fieldset>
        <MensagemErro :texto="erro" />
        <BotaoPrincipal tipo="submit" :carregando="carregando">
          {{ carregando ? 'Enviando…' : 'Enviar senha' }}
        </BotaoPrincipal>
      </form>
      <button
        type="button" class="min-h-12 bg-transparent text-[17px] font-bold text-roxo-escuro underline underline-offset-4"
        @click="mostrar('Em breve: aqui abre a conversa para atualizar o seu cadastro.')"
      >
        Esses contatos não são mais meus
      </button>
    </template>

    <!-- Passo 3: enviado -->
    <template v-else-if="enviadoPara">
      <div class="flex size-[88px] items-center justify-center rounded-full bg-ok-claro text-ok">
        <Icone nome="certo" :tamanho="46" :espessura="2.6" />
      </div>
      <div class="flex flex-col gap-2" role="status">
        <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold">Pronto! A senha está a caminho</h1>
        <p class="m-0 text-lg text-texto">
          Mandamos para <b class="tracking-wide text-tinta">{{ enviadoPara.destino }}</b>. Ela chega {{ NOME_CANAL[enviadoPara.canal].onde }}.
        </p>
      </div>
      <ol class="m-0 flex list-none flex-col gap-3 p-0">
        <li
          v-for="(passo, i) in ['Abra a mensagem que chegou', 'Entre com o seu CPF e essa senha', 'Depois, crie uma senha só sua']" :key="passo"
          class="flex items-center gap-3.5 rounded-[18px] bg-white px-4 py-3.5 shadow-[0_4px_14px_#353d680d]"
        >
          <span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-roxo font-display text-xl font-extrabold text-white">{{ i + 1 }}</span>
          <span class="text-[17px]">{{ passo }}</span>
        </li>
      </ol>
      <BotaoPrincipal to="/entrar">Entrar agora</BotaoPrincipal>
      <button
        type="button" class="min-h-12 bg-transparent text-[17px] font-bold text-roxo-escuro underline underline-offset-4"
        @click="voltar"
      >
        Não chegou? Enviar de novo
      </button>
    </template>
  </main>
</template>
