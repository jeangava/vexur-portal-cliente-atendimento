<script setup lang="ts">
import type { BeneficiariosEmpresa, MinhaFamilia } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })

const usuario = useUsuario()
// Responsável pela empresa vê todas as pessoas do plano; os outros, a própria família.
const responsavel = computed(() => usuario.value?.contrato?.papel === 'representante')
useHead({ title: responsavel.value ? 'Beneficiários · Portal do Cliente' : 'Minha família · Portal do Cliente' })

const [{ data: familia, error }, { data: empresa, error: erroEmpresa }] = await Promise.all([
  useFetch<MinhaFamilia>('/api/familia', { immediate: !responsavel.value }),
  useFetch<BeneficiariosEmpresa>('/api/empresa/beneficiarios', { immediate: responsavel.value }),
])
const podeMovimentar = computed(() => !!usuario.value?.acesso.areas.includes('movimentacao'))
</script>

<template>
  <main v-if="responsavel" class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/inicio" rotulo="Início" class="lg:hidden" />
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div class="flex flex-col gap-1.5">
        <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Beneficiários</h1>
        <p class="m-0 text-lg text-texto">Todas as pessoas no plano da {{ empresa?.empresa ?? 'empresa' }}, com o número da carteirinha.</p>
      </div>
      <div class="md:w-[300px] md:shrink-0">
        <BotaoPrincipal to="/movimentacao"><Icone nome="lista" :tamanho="22" /> Incluir ou tirar pessoas</BotaoPrincipal>
      </div>
    </div>

    <MensagemErro v-if="erroEmpresa" :texto="mensagemDeErro(erroEmpresa, 'Não conseguimos carregar a lista da empresa agora.')" />

    <template v-if="empresa">
      <dl class="m-0 grid grid-cols-3 gap-3 lg:max-w-[720px]">
        <div class="flex flex-col rounded-[20px] bg-white p-4 shadow-cartao">
          <dt class="order-2 text-[15px] text-apoio">Titulares</dt>
          <dd class="order-1 m-0 font-display text-[30px] leading-none font-extrabold">{{ empresa.resumo.titulares }}</dd>
        </div>
        <div class="flex flex-col rounded-[20px] bg-white p-4 shadow-cartao">
          <dt class="order-2 text-[15px] text-apoio">Dependentes</dt>
          <dd class="order-1 m-0 font-display text-[30px] leading-none font-extrabold">{{ empresa.resumo.dependentes }}</dd>
        </div>
        <div class="flex flex-col rounded-[20px] bg-roxo p-4 text-white shadow-cartao">
          <dt class="order-2 text-[15px] text-white/85">Pessoas no total</dt>
          <dd class="order-1 m-0 font-display text-[30px] leading-none font-extrabold">{{ empresa.resumo.vidas }}</dd>
        </div>
      </dl>
      <ListaEmpresa :empresa="empresa" />
    </template>
  </main>

  <main v-else class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/inicio" rotulo="Início" class="lg:hidden" />
    <div class="flex flex-col gap-1.5">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Minha família</h1>
      <p class="m-0 text-lg text-texto">Quem está no plano, o que cada um tem e o número da carteirinha para mostrar no atendimento.</p>
    </div>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar os dados da sua família agora.')" />

    <template v-if="familia">
      <section class="flex flex-col gap-3">
        <h2 class="m-0 text-lg font-bold text-texto">Titular</h2>
        <CartaoBeneficiario :pessoa="familia.titular" />
      </section>

      <section class="flex flex-col gap-3">
        <h2 class="m-0 text-lg font-bold text-texto">
          Dependentes <span v-if="familia.dependentes.length" class="font-semibold text-apoio">({{ familia.dependentes.length }})</span>
        </h2>
        <div v-if="familia.dependentes.length" class="grid gap-4 xl:grid-cols-2">
          <CartaoBeneficiario v-for="d in familia.dependentes" :key="d.numeroCarteirinha" :pessoa="d" />
        </div>
        <p v-else class="m-0 rounded-[22px] bg-white p-5 text-lg text-texto shadow-cartao">Você não tem dependentes no plano.</p>
      </section>

      <NuxtLink
        v-if="podeMovimentar" to="/movimentacao"
        class="flex min-h-[76px] items-center gap-3.5 rounded-[22px] border-2 border-roxo-borda bg-roxo-fundo px-[18px] py-3.5 text-tinta no-underline md:max-w-[520px]"
      >
        <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-roxo text-white"><Icone nome="familia" /></span>
        <span class="flex grow flex-col">
          <span class="text-lg font-bold">Incluir ou tirar alguém do plano</span>
          <span class="text-[15px] text-apoio">Faça o pedido e acompanhe pelo protocolo</span>
        </span>
        <Icone nome="avancar" :tamanho="22" :espessura="2.4" class="text-roxo-icone" />
      </NuxtLink>
    </template>
  </main>
</template>
