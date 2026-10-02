<script setup lang="ts">
definePageMeta({ layout: 'portal' })
useHead({ title: 'Comunicados · Portal do Cliente' })

const { data: comunicados, error } = await useFetch('/api/comunicados')
const emVigor = computed(() => comunicados.value?.filter(c => c.vigente) ?? [])
const demais = computed(() => comunicados.value?.filter(c => !c.vigente) ?? [])
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/inicio" rotulo="Início" class="lg:hidden" />
    <div class="flex flex-col gap-1.5">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Comunicados</h1>
      <p class="m-0 text-lg text-texto">Cópias das mensagens que mandamos para você por e-mail, SMS ou carta.</p>
    </div>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar os comunicados agora.')" />

    <section v-if="emVigor.length" class="flex flex-col gap-3">
      <h2 class="m-0 flex items-center gap-2 text-lg font-bold text-erro">
        <Icone nome="alerta" :tamanho="22" :espessura="2.2" /> Em vigor
      </h2>
      <div class="grid gap-3 lg:grid-cols-2">
        <CartaoComunicado v-for="c in emVigor" :key="c.id" :comunicado="c" />
      </div>
    </section>

    <section v-if="demais.length" class="flex flex-col gap-3">
      <h2 class="m-0 text-lg font-bold text-texto">Todos os comunicados</h2>
      <div class="grid gap-3 lg:grid-cols-2">
        <CartaoComunicado v-for="c in demais" :key="c.id" :comunicado="c" />
      </div>
    </section>

    <p v-if="comunicados && !comunicados.length" class="m-0 rounded-[22px] bg-white p-6 text-center text-lg text-texto shadow-cartao">
      Você ainda não recebeu nenhum comunicado.
    </p>
  </main>
</template>
