<script setup lang="ts">
import type { DecisaoDeMovimentacao, PainelMovimentacao } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Movimentação · Portal do Cliente' })

const { data: painel, error } = await useFetch<PainelMovimentacao>('/api/movimentacao')
// O que o plano libera (regra "Serviços online"): o que não for liberado fica apagado, sem clique.
const { data: regras } = await useFetch<DecisaoDeMovimentacao[]>('/api/movimentacao/regras', { default: () => [] })
const libera = (...tipos: DecisaoDeMovimentacao['tipo'][]) => (regras.value ?? []).some(d => tipos.includes(d.tipo) && d.disponivel)
const podeIncluirEmpresa = computed(() => libera('incluir-titular', 'incluir-dependente'))
const podeTirarEmpresa = computed(() => libera('excluir-titular', 'excluir-dependente'))
const podeIncluir = computed(() => libera('incluir-dependente'))
// Plano encerrado só consulta: o motivo aparece nos cartões apagados.
const encerrado = computed(() => usuario.value?.contrato?.situacao === 'cancelado')
const motivoApagado = computed(() => (encerrado.value ? 'Plano encerrado: aqui só dá para consultar.' : undefined))
const usuario = useUsuario()
const responsavel = computed(() => usuario.value?.contrato?.papel === 'representante')
const emAndamento = computed(() => (painel.value?.solicitacoes ?? []).filter(s => solicitacaoEmAberto(s.situacao)).length)
</script>

<template>
  <!-- Responsável pela empresa: incluir e tirar em quantidade -->
  <main v-if="responsavel" class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/inicio" rotulo="Início" class="lg:hidden" />
    <div class="flex flex-col gap-1.5">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Movimentação</h1>
      <p class="m-0 text-lg text-texto">Inclua ou tire pessoas do plano da empresa. Cada pedido ganha um número de protocolo.</p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:max-w-[880px]">
      <CartaoMovimentacao
        to="/movimentacao/empresa/incluir" titulo="Incluir pessoas" apoio="Uma por vez ou várias com a planilha"
        icone="familia" cor="bg-verde-claro text-verde" :desabilitado="!podeIncluirEmpresa" :motivo="motivoApagado"
      />
      <CartaoMovimentacao
        to="/movimentacao/empresa/excluir" titulo="Tirar do plano" apoio="Procure e marque quem vai sair, uma ou várias pessoas"
        icone="sair" cor="bg-erro-claro text-erro" :desabilitado="!podeTirarEmpresa" :motivo="motivoApagado"
      />
    </div>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar os pedidos agora.')" />

    <section v-if="painel" class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="m-0 text-lg font-bold text-texto">
          Pedidos de movimentação <span v-if="emAndamento" class="font-semibold text-apoio">({{ emAndamento }} em andamento)</span>
        </h2>
        <NuxtLink to="/pedidos" class="inline-flex min-h-12 items-center text-[16px] font-bold text-roxo-escuro underline underline-offset-4">Ver todos os pedidos</NuxtLink>
      </div>
      <div v-if="painel.solicitacoes.length" class="grid gap-3 lg:grid-cols-2">
        <CartaoPedido v-for="s in painel.solicitacoes" :key="s.protocolo" :pedido="s" de="movimentacao" />
      </div>
      <p v-else class="m-0 rounded-[22px] bg-white p-5 text-lg text-texto shadow-cartao">Nenhum pedido de movimentação ainda.</p>
    </section>
  </main>

  <main v-else class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/inicio" rotulo="Início" class="lg:hidden" />
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div class="flex flex-col gap-1.5">
        <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Movimentação</h1>
        <p class="m-0 text-lg text-texto">Inclua ou tire pessoas do seu plano. Tudo fica registrado com um número de protocolo.</p>
      </div>
      <div class="md:w-[320px] md:shrink-0">
        <BotaoPrincipal :to="podeIncluir ? '/movimentacao/incluir' : undefined" :desabilitado="!podeIncluir">
          <Icone nome="familia" :tamanho="22" /> Incluir alguém no plano
        </BotaoPrincipal>
        <p v-if="!podeIncluir" class="m-0 mt-2 text-sm text-apoio md:text-right">O seu plano não libera incluir pessoas por aqui. Fale com a gente.</p>
      </div>
    </div>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar as pessoas do seu plano agora.')" />

    <template v-if="painel">
      <section class="flex flex-col gap-3">
        <h2 class="m-0 text-lg font-bold text-texto">Pessoas no plano</h2>
        <ul class="m-0 flex list-none flex-col gap-3 p-0">
          <li
            v-for="b in painel.beneficiarios" :key="b.id"
            class="flex flex-col gap-3 rounded-[22px] bg-white p-[18px] shadow-cartao sm:flex-row sm:items-center lg:px-6"
          >
            <div class="flex min-w-0 grow items-center gap-3.5">
              <span
                aria-hidden="true"
                class="flex size-12 shrink-0 items-center justify-center rounded-full font-display text-xl font-extrabold"
                :class="b.titular ? 'bg-roxo text-white' : 'bg-laranja-claro text-laranja'"
              >{{ b.nome[0] }}</span>
              <div class="flex min-w-0 flex-col">
                <span class="text-[19px] font-bold">{{ b.nome }}</span>
                <span class="text-[15px] text-apoio">{{ b.titular ? 'Titular (você)' : b.parentesco }}</span>
              </div>
            </div>

            <NuxtLink
              v-if="b.podeExcluir" :to="`/movimentacao/excluir?pessoa=${encodeURIComponent(b.id)}`"
              class="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-erro-borda bg-white px-4 text-[17px] font-bold text-erro no-underline hover:bg-erro-claro"
            >
              Tirar do plano
            </NuxtLink>
            <span
              v-else-if="b.exclusaoEmAndamento"
              class="inline-flex items-center gap-1.5 self-start rounded-full bg-info-claro px-3 py-1.5 text-[15px] font-bold text-info sm:self-center"
            >
              <Icone nome="relogio" :tamanho="18" /> Saída pedida · {{ b.exclusaoEmAndamento.protocolo }}
            </span>
            <span v-else-if="b.titular" class="text-[15px] text-apoio sm:max-w-[240px] sm:text-right">
              Para sair do plano como titular, <NuxtLink to="/ajuda" class="font-bold text-roxo-escuro underline">fale com a gente</NuxtLink>.
            </span>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="m-0 text-lg font-bold text-texto">Pedidos de movimentação</h2>
          <NuxtLink to="/pedidos" class="inline-flex min-h-12 items-center text-[16px] font-bold text-roxo-escuro underline underline-offset-4">Ver todos os meus pedidos</NuxtLink>
        </div>
        <div v-if="painel.solicitacoes.length" class="grid gap-3 lg:grid-cols-2">
          <CartaoPedido v-for="s in painel.solicitacoes" :key="s.protocolo" :pedido="s" de="movimentacao" />
        </div>
        <p v-else class="m-0 rounded-[22px] bg-white p-5 text-lg text-texto shadow-cartao">Você ainda não fez nenhum pedido de movimentação.</p>
      </section>
    </template>
  </main>
</template>
