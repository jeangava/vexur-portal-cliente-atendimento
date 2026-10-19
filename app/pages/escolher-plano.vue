<script setup lang="ts">
useHead({ title: 'Escolha o contrato · Portal do Cliente' })

// Primeiro acesso com mais de um contrato: a escolha abre num popup por cima desta tela.
// Depois de logado, o mesmo popup abre pelo botão "Ver outro contrato".
const usuario = useUsuario()
const sair = useSair()
const seletor = useSeletorContratos()
const trocando = computed(() => !!usuario.value?.contrato)

onMounted(() => { seletor.value = true })
onBeforeUnmount(() => { seletor.value = false })
</script>

<template>
  <main class="flex min-h-dvh flex-col gap-7 px-6 pt-10 pb-8 lg:min-h-0 lg:px-10 lg:py-10">
    <BotaoVoltar v-if="trocando" to="/inicio" rotulo="Voltar" />

    <div class="flex flex-col gap-2">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold">
        {{ trocando ? 'Ver outro contrato' : `${usuario?.primeiroNome}, qual contrato você quer ver?` }}
      </h1>
      <p class="m-0 text-lg text-texto">Seu CPF tem mais de um contrato. Escolha o que você quer abrir. Dá para trocar depois.</p>
    </div>

    <BotaoPrincipal @click="seletor = true">
      Escolher o contrato
      <Icone nome="seta" :tamanho="22" :espessura="2.4" />
    </BotaoPrincipal>

    <div class="grow lg:hidden" />

    <button
      v-if="!trocando" type="button"
      class="flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-transparent text-[17px] font-bold text-roxo-escuro"
      @click="sair"
    >
      <Icone nome="sair" :tamanho="22" />
      Sair
    </button>

    <ModalContratos v-if="usuario?.podeTrocarContrato" />
  </main>
</template>
