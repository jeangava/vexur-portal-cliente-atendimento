<script setup lang="ts">
const vantagens = [
  { icone: 'conta', texto: 'Veja suas contas e o que falta pagar' },
  { icone: 'pix', texto: 'Pague com PIX e a conta é confirmada na hora' },
  { icone: 'conversa', texto: 'Ajuda sempre por perto quando precisar' },
]
</script>

<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] xl:grid-cols-2">
    <!-- Painel da marca: só no notebook/desktop -->
    <aside class="relative hidden overflow-hidden bg-roxo p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
      <div aria-hidden="true" class="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/10" />
      <div aria-hidden="true" class="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-white/[0.07]" />

      <div class="relative flex items-center gap-3">
        <div class="flex size-12 items-center justify-center rounded-[14px] bg-white text-roxo">
          <Icone nome="escudo" :tamanho="28" />
        </div>
        <div class="font-display text-2xl font-extrabold tracking-tight">Vexur</div>
      </div>

      <div class="relative flex max-w-[520px] flex-col gap-8">
        <h2 class="m-0 font-display text-[44px] leading-[1.1] font-extrabold xl:text-[52px]">
          Seu plano de saúde, simples de cuidar.
        </h2>
        <ul class="m-0 flex list-none flex-col gap-4 p-0">
          <li v-for="v in vantagens" :key="v.texto" class="flex items-center gap-4 text-[19px] font-semibold">
            <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <Icone :nome="v.icone" :tamanho="26" />
            </span>
            {{ v.texto }}
          </li>
        </ul>
      </div>

      <p class="relative m-0 text-base text-white/85">Portal do Cliente</p>
    </aside>

    <!-- Formulário -->
    <div class="flex justify-center lg:items-center lg:px-10 lg:py-10">
      <div class="w-full max-w-[480px] lg:max-w-[460px] lg:rounded-[28px] lg:bg-white lg:shadow-cartao">
        <slot />
      </div>
    </div>
  </div>
</template>
