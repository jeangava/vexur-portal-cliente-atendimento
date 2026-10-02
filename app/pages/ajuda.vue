<script setup lang="ts">
definePageMeta({ layout: 'portal' })
useHead({ title: 'Ajuda · Portal do Cliente' })

const { mostrar } = useAviso()

// Contatos reais entram aqui quando forem definidos por administradora.
const canais = [
  { titulo: 'Mandar mensagem', apoio: 'Pelo WhatsApp [NÚMERO]', icone: 'mensagem', cor: 'bg-verde-claro text-verde', aviso: 'Em breve: aqui abre o WhatsApp.' },
  { titulo: 'Ligar para a central', apoio: '[TELEFONE] · [HORÁRIO]', icone: 'telefone', cor: 'bg-azul-claro text-azul', aviso: 'Em breve: aqui liga para a central.' },
  { titulo: 'Dúvidas comuns', apoio: 'Respostas rápidas', icone: 'duvida', cor: 'bg-roxo-claro text-roxo-icone', aviso: 'As dúvidas comuns entram na próxima etapa.' },
]
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/inicio" rotulo="Início" class="lg:hidden" />
    <div class="flex flex-col gap-1.5">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Como podemos ajudar?</h1>
      <p class="m-0 text-lg text-texto">Escolha o jeito mais fácil para você.</p>
    </div>
    <div class="grid gap-3 md:grid-cols-3 lg:gap-5">
      <button
        v-for="c in canais" :key="c.titulo" type="button"
        class="flex min-h-[84px] items-center gap-3.5 rounded-[22px] bg-white px-[18px] py-4 text-left text-tinta shadow-cartao transition-shadow hover:shadow-[0_10px_30px_#353d681c] md:min-h-[180px] md:flex-col md:items-start md:justify-between md:p-6"
        @click="mostrar(c.aviso)"
      >
        <span class="flex size-[54px] shrink-0 items-center justify-center rounded-2xl" :class="c.cor"><Icone :nome="c.icone" :tamanho="28" /></span>
        <span class="flex flex-col">
          <span class="text-[19px] font-bold">{{ c.titulo }}</span>
          <span class="text-[15px] text-apoio">{{ c.apoio }}</span>
        </span>
      </button>
    </div>
  </main>
</template>
