<script setup lang="ts">
import type { PerguntaDps, RespostasDps } from '#shared/types/portal'

/**
 * Formulário da declaração de saúde: uma pergunta por cartão, Sim/Não grandes,
 * subperguntas aparecem só depois do "Sim" e o IMC é calculado sozinho.
 */
// As respostas ficam na página; o formulário só avisa "pergunta X = resposta". Assim duas respostas
// seguidas (ex.: autopreenchimento de peso e altura) nunca sobrescrevem uma à outra.
const props = defineProps<{ perguntas: PerguntaDps[], respostas: RespostasDps, nomePessoa: string, erros: Record<string, string> }>()
const emit = defineEmits<{ responder: [id: string, valor: string] }>()

const medidas = computed(() => props.perguntas.filter(p => p.tipo === 'numero' || p.tipo === 'calculado'))
const principais = computed(() => props.perguntas.filter(p => p.tipo !== 'numero' && p.tipo !== 'calculado' && idDoPai(p.id) === null))
const subperguntasDe = (id: string) => props.perguntas.filter(p => idDoPai(p.id) === id)
const hoje = new Date().toISOString().slice(0, 10)

const respondidas = computed(() => principais.value.filter(p => (props.respostas[p.id] ?? '') !== '').length)

function responder(id: string, valor: string) {
  emit('responder', id, valor)
}

function aoDigitarNumero(id: string, evento: Event) {
  const campo = evento.target as HTMLInputElement
  const limpo = campo.value.replace(/[^\d,.]/g, '').slice(0, 6)
  campo.value = limpo
  responder(id, limpo)
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-start gap-3 rounded-[18px] border-2 border-roxo-borda bg-roxo-fundo px-4 py-3.5">
      <Icone nome="info" class="mt-0.5 text-roxo-icone" />
      <span class="text-base">
        Responda sobre a saúde de <b>{{ nomePessoa }}</b> com atenção e sinceridade: essas respostas fazem parte do contrato.
        Se a pessoa for menor de idade, você responde por ela.
      </span>
    </div>

    <!-- Peso, altura e IMC -->
    <section v-if="medidas.length" class="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
      <h3 class="m-0 text-lg font-bold">Medidas</h3>
      <div class="grid gap-5 sm:grid-cols-3">
        <div v-for="p in medidas" :key="p.id" class="flex flex-col gap-2">
          <label :for="`dps-${p.id}`" class="text-[17px] font-bold">
            {{ p.pergunta }} <span v-if="p.tipo !== 'calculado'" class="text-erro" aria-hidden="true">*</span>
          </label>
          <div v-if="p.tipo === 'calculado'" :id="`dps-${p.id}`" class="flex h-16 items-center rounded-2xl bg-fundo px-5 text-xl font-bold" aria-live="polite">
            {{ valorCalculado(p, respostas) || '—' }}
          </div>
          <div v-else class="relative">
            <input
              :id="`dps-${p.id}`" :value="respostas[p.id] ?? ''" type="text" inputmode="decimal" autocomplete="off"
              :aria-invalid="!!erros[p.id]" :aria-describedby="erros[p.id] ? `dps-${p.id}-erro` : p.ajuda ? `dps-${p.id}-ajuda` : undefined"
              class="h-16 w-full rounded-2xl border-2 bg-white pr-16 pl-5 text-xl font-semibold text-tinta focus:border-roxo"
              :class="erros[p.id] ? 'border-erro bg-erro-claro/40' : 'border-campo'"
              @input="aoDigitarNumero(p.id, $event)"
            >
            <span v-if="p.unidade" class="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-lg font-semibold text-apoio">{{ p.unidade }}</span>
          </div>
          <MensagemErro :id="`dps-${p.id}-erro`" :texto="erros[p.id] ?? ''" />
          <p v-if="p.ajuda && !erros[p.id]" :id="`dps-${p.id}-ajuda`" class="m-0 text-[15px] text-apoio">{{ p.ajuda }}</p>
        </div>
      </div>
    </section>

    <p class="m-0 text-base font-bold text-roxo-escuro" aria-live="polite">{{ respondidas }} de {{ principais.length }} perguntas respondidas</p>

    <!-- Perguntas principais, cada uma com suas subperguntas -->
    <section
      v-for="(p, i) in principais" :key="p.id"
      class="flex flex-col gap-4 rounded-3xl border-2 bg-white p-5 shadow-cartao sm:p-6"
      :class="erros[p.id] ? 'border-erro-borda' : 'border-transparent'"
    >
      <fieldset v-if="p.tipo === 'sim-nao'" class="m-0 flex flex-col gap-3 border-0 p-0 sm:flex-row sm:items-center sm:justify-between">
        <legend :id="`dps-${p.id}`" tabindex="-1" class="float-left mb-1 text-[18px] font-bold sm:mb-0 sm:max-w-[60%]">
          <span class="text-apoio">{{ i + 1 }}.</span> {{ p.pergunta }}
        </legend>
        <div class="grid shrink-0 grid-cols-2 gap-2.5 sm:w-[240px]">
          <label
            v-for="op in [{ v: 'sim', r: 'Sim' }, { v: 'nao', r: 'Não' }]" :key="op.v"
            class="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border-2 text-lg font-bold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-roxo"
            :class="respostas[p.id] === op.v ? 'border-roxo bg-roxo text-white' : 'border-[#e3e4ed] bg-white text-tinta'"
          >
            <input type="radio" :name="`dps-${p.id}`" :value="op.v" :checked="respostas[p.id] === op.v" class="sr-only" @change="responder(p.id, op.v)">
            {{ op.r }}
          </label>
        </div>
      </fieldset>

      <div v-else class="flex flex-col gap-2">
        <label :for="`dps-${p.id}`" class="text-[18px] font-bold"><span class="text-apoio">{{ i + 1 }}.</span> {{ p.pergunta }}</label>
        <input
          :id="`dps-${p.id}`" :value="respostas[p.id] ?? ''" :type="p.tipo === 'data' ? 'date' : 'text'" :max="p.tipo === 'data' ? hoje : undefined"
          class="h-16 rounded-2xl border-2 bg-white px-5 text-xl font-semibold text-tinta focus:border-roxo"
          :class="erros[p.id] ? 'border-erro' : 'border-campo'"
          @input="responder(p.id, ($event.target as HTMLInputElement).value)"
        >
      </div>
      <MensagemErro :texto="erros[p.id] ?? ''" />

      <div v-for="s in subperguntasDe(p.id)" v-show="perguntaVisivel(s, respostas)" :key="s.id" class="flex flex-col gap-2 border-l-4 border-roxo-borda pl-4">
        <label :for="`dps-${s.id}`" class="text-[17px] font-bold">{{ s.pergunta }} <span class="text-erro" aria-hidden="true">*</span></label>
        <textarea
          v-if="s.tipo === 'texto'" :id="`dps-${s.id}`" :value="respostas[s.id] ?? ''" rows="2" maxlength="500"
          :aria-invalid="!!erros[s.id]"
          class="min-h-20 rounded-2xl border-2 bg-white px-5 py-3 text-lg text-tinta focus:border-roxo"
          :class="erros[s.id] ? 'border-erro' : 'border-campo'"
          @input="responder(s.id, ($event.target as HTMLTextAreaElement).value)"
        />
        <input
          v-else :id="`dps-${s.id}`" :value="respostas[s.id] ?? ''" :type="s.tipo === 'data' ? 'date' : 'text'" :max="s.tipo === 'data' ? hoje : undefined"
          :aria-invalid="!!erros[s.id]"
          class="h-16 rounded-2xl border-2 bg-white px-5 text-xl font-semibold text-tinta focus:border-roxo sm:max-w-[320px]"
          :class="erros[s.id] ? 'border-erro' : 'border-campo'"
          @input="responder(s.id, ($event.target as HTMLInputElement).value)"
        >
        <MensagemErro :texto="erros[s.id] ?? ''" />
      </div>
    </section>
  </div>
</template>
