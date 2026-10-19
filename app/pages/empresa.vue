<script setup lang="ts">
import type { CadastroDaEmpresa, DecisaoDeAlteracao } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Minha empresa · Portal do Cliente' })

const { data: cadastro, error, refresh } = await useFetch<CadastroDaEmpresa>('/api/empresa/cadastro')
// O que o responsável pode alterar (e se muda na hora ou por aprovação) vem da regra "Serviços online".
const { data: decisoes } = await useFetch<DecisaoDeAlteracao[]>('/api/cadastro/alteracoes', { default: () => [] })
const podeAlterar = computed(() => (decisoes.value ?? []).some(d => d.disponivel))
const alterando = ref(false)

function valorDe(c: { rotulo: string, valor: string }) {
  return c.rotulo === 'Contrato desde' ? formatarData(c.valor) : c.valor
}
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/inicio" rotulo="Início" class="lg:hidden" />
    <div class="flex flex-col gap-1.5">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Minha empresa</h1>
      <p class="m-0 text-lg text-texto">Os dados da empresa no contrato, o responsável e como falamos e cobramos.</p>
      <button
        v-if="podeAlterar" type="button"
        class="mt-1.5 inline-flex min-h-12 items-center gap-2 self-start rounded-2xl bg-white px-4 text-[17px] font-bold text-roxo-escuro shadow-leve"
        @click="alterando = true"
      >
        <Icone nome="lista" :tamanho="22" /> Alterar dados
      </button>
    </div>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar os dados da empresa agora.')" />

    <div v-if="cadastro" class="grid gap-3.5 lg:grid-cols-2 lg:items-start lg:gap-5">
      <section v-if="cadastro.empresa.length" class="flex flex-col gap-3 rounded-[22px] bg-white p-4 shadow-cartao">
        <h2 class="m-0 text-lg font-bold">Dados da empresa</h2>
        <dl class="m-0 flex flex-col gap-2.5">
          <div v-for="c in cadastro.empresa" :key="c.rotulo" class="flex flex-col">
            <dt class="text-sm text-apoio">{{ c.rotulo }}</dt>
            <dd class="m-0 text-base font-bold">{{ valorDe(c) }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="cadastro.representante" class="flex flex-col gap-3 rounded-[22px] bg-white p-4 shadow-cartao">
        <h2 class="m-0 text-lg font-bold">{{ cadastro.representante.papel }}</h2>
        <div class="flex flex-col gap-0.5">
          <span class="text-[19px] font-bold">{{ cadastro.representante.nome }}</span>
          <span v-for="d in cadastro.representante.detalhes" :key="d.rotulo" class="text-base"><span class="text-apoio">{{ d.rotulo }}:</span> <b>{{ d.valor }}</b></span>
        </div>
      </section>

      <BlocoCadastro :contatos="cadastro.contatos" :enderecos="cadastro.enderecos" :pagamento="cadastro.pagamento" class="lg:col-span-2" />

      <p v-if="!cadastro.empresa.length && !cadastro.representante && !cadastro.contatos.length && !cadastro.enderecos.length && !cadastro.pagamento.length" class="m-0 rounded-[22px] bg-white p-5 text-lg text-texto shadow-cartao lg:col-span-2">
        O sistema ainda não tem esses dados da empresa.
      </p>
    </div>
    <ModalAlterarDados v-model="alterando" :decisoes="decisoes ?? []" :atual="cadastro ?? undefined" alvo="empresa" @concluido="refresh()" />
  </main>
</template>
