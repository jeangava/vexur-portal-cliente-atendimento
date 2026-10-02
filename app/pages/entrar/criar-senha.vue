<script setup lang="ts">
useHead({ title: 'Crie a sua senha · Portal do Cliente' })

const trocarSenha = useTrocarSenha()
const cpfDigitado = useCpfDigitado()
const sair = useSair()
const { mostrar } = useAviso()

const senha = ref('')
const confirmacao = ref('')
const erroSenha = ref('')
const erroConfirmacao = ref('')
const erroGeral = ref('')
const salvando = ref(false)

const regras = computed(() => regrasDaSenha(senha.value, cpfDigitado.value))

watch([senha, confirmacao], () => { erroSenha.value = ''; erroConfirmacao.value = ''; erroGeral.value = '' })

async function salvar() {
  const problema = problemaNaNovaSenha(senha.value, confirmacao.value, cpfDigitado.value)
  if (problema) {
    if (senha.value && regras.value.every(r => r.ok)) erroConfirmacao.value = problema
    else erroSenha.value = problema
    return
  }
  salvando.value = true
  try {
    await $fetch('/api/auth/trocar-senha', { method: 'POST', body: { senha: senha.value, confirmacao: confirmacao.value } })
    trocarSenha.value = false
    mostrar('Pronto! Sua senha nova está salva.')
    await navigateTo('/inicio', { replace: true })
  } catch (e) {
    erroGeral.value = mensagemDeErro(e)
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col gap-7 px-6 pt-10 pb-8 lg:min-h-0 lg:px-10 lg:py-10">
    <div class="flex size-[88px] items-center justify-center rounded-[28px] bg-roxo-claro text-roxo-icone">
      <Icone nome="cadeado" :tamanho="44" :espessura="1.8" />
    </div>

    <div class="flex flex-col gap-2">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold">Agora, crie uma senha só sua</h1>
      <p class="m-0 text-lg text-texto">A senha que você recebeu serve só para entrar uma vez. Troque por uma que você vai lembrar.</p>
    </div>

    <form class="flex flex-col gap-6" novalidate @submit.prevent="salvar">
      <CampoSenha id="nova-senha" v-model="senha" rotulo="Senha nova" autocomplete="new-password" descricao="regras-senha" :erro="erroSenha" />

      <ul id="regras-senha" class="m-0 flex list-none flex-col gap-2 rounded-[18px] bg-white p-4 shadow-[0_4px_14px_#353d680d]" aria-live="polite">
        <li v-for="r in regras" :key="r.texto" class="flex items-center gap-2.5 text-base" :class="r.ok ? 'font-semibold text-ok' : 'text-apoio'">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full" :class="r.ok ? 'bg-ok text-white' : 'border-2 border-campo'">
            <Icone v-if="r.ok" nome="certo" :tamanho="14" :espessura="3.2" />
          </span>
          {{ r.texto }}
          <span class="sr-only">{{ r.ok ? '(pronto)' : '(falta)' }}</span>
        </li>
      </ul>

      <CampoSenha id="confirmar-senha" v-model="confirmacao" rotulo="Digite a senha nova de novo" autocomplete="new-password" :erro="erroConfirmacao" />

      <MensagemErro :texto="erroGeral" />

      <BotaoPrincipal tipo="submit" :carregando="salvando">
        {{ salvando ? 'Salvando…' : 'Salvar minha senha' }}
      </BotaoPrincipal>
    </form>

    <button type="button" class="min-h-12 bg-transparent text-[17px] font-bold text-roxo-escuro underline underline-offset-4" @click="sair">
      Sair e fazer isso depois
    </button>
  </main>
</template>
