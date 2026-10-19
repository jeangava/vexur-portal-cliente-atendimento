<script setup lang="ts">
import type { DadosPessoais } from '#shared/types/portal'

/** Dados pessoais de uma pessoa, recolhidos: abrem com um toque. Só mostra o que o sistema tem. */
const props = defineProps<{ dados?: DadosPessoais, aberto?: boolean }>()

const campos = computed(() => {
  const d = props.dados ?? {}
  return [
    d.cpf ? { rotulo: 'CPF', valor: d.cpf } : null,
    d.nascimento ? { rotulo: 'Nascimento', valor: formatarData(d.nascimento) } : null,
    d.sexo ? { rotulo: 'Sexo', valor: d.sexo } : null,
    d.estadoCivil ? { rotulo: 'Estado civil', valor: d.estadoCivil } : null,
    d.nomeMae ? { rotulo: 'Nome da mãe', valor: d.nomeMae } : null,
    d.cartaoSus ? { rotulo: 'Cartão Nacional de Saúde', valor: d.cartaoSus } : null,
    d.nacionalidade ? { rotulo: 'Nacionalidade', valor: d.nacionalidade } : null,
  ].filter((c): c is { rotulo: string, valor: string } => !!c)
})
</script>

<template>
  <details v-if="campos.length" :open="aberto" class="group rounded-2xl" :class="aberto ? 'bg-white' : 'bg-fundo'">
    <summary class="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[16px] font-bold text-roxo-escuro">
      Dados pessoais
      <Icone nome="abrir" :tamanho="20" :espessura="2.4" class="transition-transform group-open:rotate-180" />
    </summary>
    <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-2.5 px-4 pt-1 pb-4 sm:grid-cols-2">
      <div v-for="c in campos" :key="c.rotulo" class="flex flex-col">
        <dt class="text-sm text-apoio">{{ c.rotulo }}</dt>
        <dd class="m-0 text-base font-bold">{{ c.valor }}</dd>
      </div>
    </dl>
  </details>
</template>
