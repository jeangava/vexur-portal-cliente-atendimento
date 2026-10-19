<script setup lang="ts">
import type { ContatoCadastro, EnderecoCadastro, PagamentoCadastro, PessoaDeContato } from '#shared/types/portal'

/**
 * Contato, endereço, pagamento e responsáveis, só para ler. Cada bloco só aparece quando tem dado.
 * Usado no contrato do titular, na família aberta pelo responsável e na tela da empresa.
 */
defineProps<{
  contatos?: ContatoCadastro[]
  enderecos?: EnderecoCadastro[]
  pagamento?: PagamentoCadastro[]
  responsaveis?: PessoaDeContato[]
  /** Compacto: sem cartões brancos, para dentro de outro cartão */
  compacto?: boolean
}>()

const ICONE: Record<ContatoCadastro['tipo'], string> = { email: 'email', telefone: 'telefone', celular: 'celular' }
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <section v-if="contatos?.length" class="flex flex-col gap-2.5 rounded-[22px] p-4" :class="compacto ? 'bg-fundo' : 'bg-white shadow-cartao'">
      <h3 class="m-0 text-lg font-bold">Meios de contato</h3>
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="c in contatos" :key="c.tipo + c.valor" class="flex items-center gap-3">
          <Icone :nome="ICONE[c.tipo]" :tamanho="22" class="shrink-0 text-roxo-icone" />
          <span class="flex min-w-0 flex-col">
            <span class="text-sm text-apoio">{{ c.rotulo }}</span>
            <span class="text-base font-bold break-all">{{ c.valor }}</span>
          </span>
        </li>
      </ul>
    </section>

    <section v-if="enderecos?.length" class="flex flex-col gap-2.5 rounded-[22px] p-4" :class="compacto ? 'bg-fundo' : 'bg-white shadow-cartao'">
      <h3 class="m-0 text-lg font-bold">Endereço</h3>
      <div v-for="e in enderecos" :key="e.linhas.join('|')" class="flex items-start gap-3">
        <Icone nome="casa" :tamanho="22" class="mt-0.5 shrink-0 text-roxo-icone" />
        <span class="flex min-w-0 flex-col">
          <span class="text-sm text-apoio">{{ e.rotulo }}</span>
          <span v-for="l in e.linhas" :key="l" class="text-base font-semibold">{{ l }}</span>
        </span>
      </div>
    </section>

    <section v-if="pagamento?.length" class="flex flex-col gap-2.5 rounded-[22px] p-4" :class="compacto ? 'bg-fundo' : 'bg-white shadow-cartao'">
      <h3 class="m-0 text-lg font-bold">Forma de pagamento</h3>
      <div v-for="p in pagamento" :key="p.modalidade + p.detalhes.map(d => d.valor).join()" class="flex items-start gap-3">
        <Icone nome="conta" :tamanho="22" class="mt-0.5 shrink-0 text-roxo-icone" />
        <span class="flex min-w-0 flex-col">
          <span class="text-base font-bold">{{ p.modalidade }}</span>
          <span v-for="d in p.detalhes" :key="d.rotulo" class="text-[15px]"><span class="text-apoio">{{ d.rotulo }}:</span> <b>{{ d.valor }}</b></span>
        </span>
      </div>
      <p class="m-0 text-sm text-apoio">Por segurança, a conta aparece só com o final.</p>
    </section>

    <section v-if="responsaveis?.length" class="flex flex-col gap-2.5 rounded-[22px] p-4" :class="compacto ? 'bg-fundo' : 'bg-white shadow-cartao'">
      <h3 class="m-0 text-lg font-bold">Responsáveis</h3>
      <div v-for="r in responsaveis" :key="r.papel + r.nome" class="flex items-start gap-3">
        <Icone nome="familia" :tamanho="22" class="mt-0.5 shrink-0 text-roxo-icone" />
        <span class="flex min-w-0 flex-col">
          <span class="text-sm text-apoio">{{ r.papel }}</span>
          <span class="text-base font-bold">{{ r.nome }}</span>
          <span v-for="d in r.detalhes" :key="d.rotulo" class="text-[15px]"><span class="text-apoio">{{ d.rotulo }}:</span> {{ d.valor }}</span>
        </span>
      </div>
    </section>
  </div>
</template>
