<script setup lang="ts">
import type { BeneficiarioPlano } from '#shared/types/portal'

defineProps<{ pessoa: BeneficiarioPlano }>()
const { mostrar } = useAviso()

async function copiarCarteirinha(numero: string) {
  const ok = await copiarTexto(numero.replace(/\s/g, ''))
  mostrar(ok ? 'Número da carteirinha copiado.' : 'Não deu para copiar. Anote o número na tela.')
}
</script>

<template>
  <article class="flex flex-col gap-5 rounded-3xl border-2 bg-white p-5 shadow-cartao lg:p-7" :class="pessoa.titular ? 'border-roxo-borda' : 'border-transparent'">
    <header class="flex items-center gap-3.5">
      <span
        aria-hidden="true"
        class="flex size-14 shrink-0 items-center justify-center rounded-full font-display text-2xl font-extrabold"
        :class="pessoa.titular ? 'bg-roxo text-white' : 'bg-laranja-claro text-laranja'"
      >
        {{ pessoa.nome[0] }}
      </span>
      <div class="flex min-w-0 flex-col">
        <h3 class="m-0 text-[21px] leading-tight font-bold">{{ pessoa.nome }}</h3>
        <span class="self-start rounded-full px-2.5 py-0.5 text-sm font-bold" :class="pessoa.titular ? 'bg-roxo-claro text-roxo-escuro' : 'bg-fundo text-texto'">
          {{ pessoa.titular ? 'Titular (você)' : pessoa.parentesco }}
        </span>
      </div>
    </header>

    <!-- Número da carteirinha: é o que se mostra no atendimento -->
    <div class="flex flex-col gap-2 rounded-[18px] bg-gradient-to-br from-roxo to-roxo-escuro p-4 text-white sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 flex-col">
        <span class="flex items-center gap-1.5 text-sm font-semibold text-white/85"><Icone nome="carteirinha" :tamanho="18" /> Número da carteirinha</span>
        <span class="font-display text-[22px] font-extrabold tracking-wider break-all">{{ pessoa.numeroCarteirinha }}</span>
      </div>
      <button
        type="button" :aria-label="`Copiar número da carteirinha de ${pessoa.nome}`"
        class="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white/15 px-4 text-base font-bold text-white hover:bg-white/25"
        @click="copiarCarteirinha(pessoa.numeroCarteirinha)"
      >
        <Icone nome="copiar" :tamanho="20" /> Copiar
      </button>
    </div>

    <DadosPessoaisLinha :dados="pessoa.dados" />

    <section v-for="p in pessoa.produtos" :key="p.nome" class="flex flex-col gap-3">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h4 class="m-0 text-lg font-bold">
          {{ p.nome }}
          <span v-if="p.opcional" class="ml-1.5 rounded-full bg-fundo px-2.5 py-0.5 align-middle text-sm font-semibold text-apoio">Opcional</span>
        </h4>
        <span class="text-[15px] text-apoio">{{ p.tipo === 'odonto' ? 'Odontológico' : 'Saúde' }} · {{ p.operadora }}</span>
      </div>
      <dl class="m-0 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div v-if="p.acomodacao" class="flex items-start gap-3 rounded-2xl bg-fundo p-3.5">
          <Icone nome="casa" :tamanho="22" class="mt-0.5 text-roxo-icone" />
          <div><dt class="text-sm font-semibold text-apoio">Tipo de quarto</dt><dd class="m-0 text-base font-bold">{{ p.acomodacao }}</dd></div>
        </div>
        <div v-if="p.abrangencia" class="flex items-start gap-3 rounded-2xl bg-fundo p-3.5">
          <Icone nome="escudo" :tamanho="22" class="mt-0.5 text-roxo-icone" />
          <div><dt class="text-sm font-semibold text-apoio">Onde vale</dt><dd class="m-0 text-base font-bold">{{ p.abrangencia }}</dd></div>
        </div>
        <div v-if="p.cobertura" class="flex items-start gap-3 rounded-2xl bg-fundo p-3.5 sm:col-span-2">
          <Icone nome="certo" :tamanho="22" class="mt-0.5 text-roxo-icone" />
          <div><dt class="text-sm font-semibold text-apoio">O que cobre</dt><dd class="m-0 text-base font-bold">{{ p.cobertura }}</dd></div>
        </div>
        <div v-if="p.coparticipacao !== undefined" class="flex items-start gap-3 rounded-2xl bg-fundo p-3.5">
          <Icone nome="info" :tamanho="22" class="mt-0.5 text-roxo-icone" />
          <div>
            <dt class="text-sm font-semibold text-apoio">Coparticipação</dt>
            <dd class="m-0 text-base font-bold">{{ p.coparticipacao ? 'Sim: você paga uma parte de consultas e exames' : 'Não' }}</dd>
          </div>
        </div>
        <div class="flex items-start gap-3 rounded-2xl bg-fundo p-3.5">
          <Icone nome="calendario" :tamanho="22" class="mt-0.5 text-roxo-icone" />
          <div><dt class="text-sm font-semibold text-apoio">No plano desde</dt><dd class="m-0 text-base font-bold">{{ formatarData(p.inicioVigencia) }}</dd></div>
        </div>
        <div v-if="p.valorMensal !== undefined" class="flex items-start gap-3 rounded-2xl bg-fundo p-3.5">
          <Icone nome="conta" :tamanho="22" class="mt-0.5 text-roxo-icone" />
          <div><dt class="text-sm font-semibold text-apoio">Valor por mês</dt><dd class="m-0 text-base font-bold">{{ formatarMoeda(p.valorMensal) }}</dd></div>
        </div>
        <div class="flex items-start gap-3 rounded-2xl bg-fundo p-3.5">
          <Icone nome="documento" :tamanho="22" class="mt-0.5 text-roxo-icone" />
          <div><dt class="text-sm font-semibold text-apoio">Registro na ANS</dt><dd class="m-0 text-base font-bold">{{ p.registroAns }}</dd></div>
        </div>
      </dl>
    </section>
  </article>
</template>
