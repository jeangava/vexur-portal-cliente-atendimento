<script setup lang="ts">
import type { DadosPessoais } from '#shared/types/portal'

/** Dados pessoais de uma pessoa, recolhidos: abrem com um toque. Só mostra o que o sistema tem. */
const props = defineProps<{ dados?: DadosPessoais, aberto?: boolean }>()

const NAO_INFORMADO = 'Não informado'

// Todos os campos do cadastro aparecem: o que o sistema não tem fica "Não informado" (assim se vê o que falta).
const campos = computed(() => {
  const d = props.dados ?? {}
  const fixos: { rotulo: string, valor?: string }[] = [
    { rotulo: 'CPF', valor: d.cpf },
    { rotulo: 'Nascimento', valor: d.nascimento ? formatarData(d.nascimento) : undefined },
    { rotulo: 'Sexo', valor: d.sexo },
    { rotulo: 'Estado civil', valor: d.estadoCivil },
    { rotulo: 'Nome da mãe', valor: d.nomeMae },
    { rotulo: 'RG', valor: d.rg },
    { rotulo: 'Órgão expedidor do RG', valor: d.orgaoExpedidor },
    { rotulo: 'Nacionalidade', valor: d.nacionalidade },
    { rotulo: 'Cartão Nacional de Saúde', valor: d.cartaoSus },
    { rotulo: 'Declaração de nascido vivo', valor: d.declaracaoNascidoVivo },
  ]
  // Naturalidade e PIS/PASEP só aparecem quando o sistema tem.
  const extras = [
    d.naturalidade ? { rotulo: 'Naturalidade', valor: d.naturalidade } : null,
    d.pisPasep ? { rotulo: 'PIS/PASEP', valor: d.pisPasep } : null,
  ].filter((c): c is { rotulo: string, valor: string } => !!c)
  return [...fixos, ...extras].map(c => ({ rotulo: c.rotulo, valor: c.valor || NAO_INFORMADO, vazio: !c.valor }))
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
        <dd class="m-0 text-base" :class="c.vazio ? 'font-semibold text-apoio' : 'font-bold'">{{ c.valor }}</dd>
      </div>
    </dl>
  </details>
</template>
