<script setup lang="ts">
import type { Solicitacao } from '#shared/types/portal'

/** `de` = tela de origem, para o "Voltar" do detalhe levar de volta ao lugar certo. */
const props = defineProps<{ pedido: Solicitacao, de?: 'movimentacao' }>()
const situacao = computed(() => SITUACAO_SOLICITACAO[props.pedido.situacao])
const CATEGORIA = { movimentacao: 'Movimentação', servico: 'Serviço', atendimento: 'Atendimento', cadastro: 'Dados cadastrais' } as const
</script>

<template>
  <NuxtLink
    :to="{ path: `/pedidos/${pedido.protocolo}`, query: de ? { de } : undefined }"
    class="flex flex-col gap-2 rounded-[22px] border-2 bg-white p-[18px] text-tinta no-underline shadow-cartao transition-shadow hover:shadow-[0_10px_30px_#353d681c] lg:p-6"
    :class="situacao.borda"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-sm font-bold text-apoio">{{ CATEGORIA[pedido.categoria] }}</span>
      <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold" :class="situacao.classe">
        <Icone :nome="situacao.icone" :tamanho="16" :espessura="2.4" /> {{ situacao.rotulo }}
      </span>
    </div>
    <span class="text-[18px] leading-snug font-bold">{{ pedido.titulo }}</span>
    <span class="text-base text-texto">{{ pedido.pendencia?.descricao ?? pedido.detalhe }}</span>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-sm text-apoio">Protocolo {{ pedido.protocolo }} · {{ formatarData(pedido.criadaEm) }}</span>
      <span v-if="pedido.situacao === 'pendente'" class="inline-flex items-center gap-1 text-[16px] font-bold text-atencao">
        Resolver agora <Icone nome="avancar" :tamanho="18" :espessura="2.6" />
      </span>
      <span v-else-if="pedido.anexos.length" class="inline-flex items-center gap-1 text-[15px] font-bold text-roxo-escuro">
        <Icone nome="documento" :tamanho="17" /> {{ pedido.anexos.length }} {{ pedido.anexos.length === 1 ? 'arquivo' : 'arquivos' }}
      </span>
    </div>
  </NuxtLink>
</template>
