<script setup lang="ts">
import type { AreaPortal } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })
useHead({ title: 'Início · Portal do Cliente' })

const usuario = useUsuario()
const sair = useSair()
const pode = (area: AreaPortal) => !!usuario.value?.acesso.areas.includes(area)
const contrato = computed(() => usuario.value?.contrato)
const [{ data: faturas, error }, { data: comunicados }, { data: pedidos }] = await Promise.all([
  // Plano da empresa (titular) não tem contas: nem pede ao servidor.
  useFetch('/api/faturas', { immediate: pode('contas') }),
  useFetch('/api/comunicados', { immediate: pode('comunicados') }),
  useFetch('/api/pedidos', { immediate: pode('pedidos') }),
])
const pendentes = computed(() => (pedidos.value ?? []).filter(p => p.situacao === 'pendente'))
const atual = computed(() => faturas.value?.find(f => f.situacao !== 'paga'))
const recentes = computed(() => (comunicados.value ?? []).slice(0, 2))
const novos = computed(() => (comunicados.value ?? []).filter(c => c.novo || c.vigente).length)

const TODOS_ATALHOS: { area: AreaPortal, to: string, titulo: string, apoio: string, icone: string, cor: string }[] = [
  { area: 'contas', to: '/contas', titulo: 'Minhas contas', apoio: 'Boleto e PIX', icone: 'conta', cor: 'bg-roxo-claro text-roxo-icone' },
  { area: 'servicos', to: '/servicos', titulo: 'Serviços', apoio: 'IR, quitação e extrato', icone: 'documento', cor: 'bg-verde-claro text-verde' },
  { area: 'familia', to: '/familia', titulo: 'Minha família', apoio: 'Plano e nº da carteirinha', icone: 'familia', cor: 'bg-azul-claro text-azul' },
  { area: 'comunicados', to: '/comunicados', titulo: 'Comunicados', apoio: 'Mensagens enviadas a você', icone: 'sino', cor: 'bg-laranja-claro text-laranja' },
  { area: 'pedidos', to: '/pedidos', titulo: 'Meus pedidos', apoio: 'Acompanhe o que você pediu', icone: 'relogio', cor: 'bg-verde-claro text-verde' },
]
// Os 4 primeiros que o plano libera.
const atalhos = computed(() => TODOS_ATALHOS.filter(a => pode(a.area)).slice(0, 4).map(a => (
  a.area === 'familia' && contrato.value?.papel === 'representante'
    ? { ...a, titulo: 'Beneficiários', apoio: 'Todas as pessoas do plano' }
    : a
)))
</script>

<template>
  <main class="flex flex-col gap-6 px-5 pt-7 pb-7 md:px-8 lg:gap-8 lg:px-10 lg:pt-10">
    <header class="flex items-center gap-3.5">
      <div aria-hidden="true" class="flex size-14 shrink-0 items-center justify-center rounded-full bg-roxo font-display text-2xl font-extrabold text-white lg:hidden">
        {{ usuario?.primeiroNome?.[0] }}
      </div>
      <div class="min-w-0 grow">
        <h1 class="m-0 font-display text-[26px] leading-[1.15] font-extrabold lg:text-[34px]">Olá, {{ usuario?.primeiroNome }}!</h1>
        <div class="text-[15px] text-apoio lg:text-[17px]">
          {{ usuario?.plano }}<template v-if="contrato?.empresa"> · {{ contrato.empresa }}</template>
        </div>
        <NuxtLink
          v-if="usuario?.podeTrocarContrato" to="/escolher-plano"
          class="mt-0.5 inline-flex min-h-10 items-center gap-1.5 text-base font-bold text-roxo-escuro underline underline-offset-4 lg:hidden"
        >
          <Icone nome="trocar" :tamanho="18" />
          Trocar de plano
        </NuxtLink>
      </div>
      <button
        type="button" aria-label="Sair do portal"
        class="flex size-12 items-center justify-center rounded-[14px] bg-white text-texto shadow-leve lg:hidden"
        @click="sair"
      >
        <Icone nome="sair" :tamanho="22" />
      </button>
    </header>

    <!-- Plano encerrado: só consulta -->
    <section
      v-if="contrato?.situacao === 'cancelado'" aria-label="Plano encerrado"
      class="flex items-start gap-3.5 rounded-[22px] border-2 border-linha bg-white px-[18px] py-4 lg:px-6"
    >
      <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-fundo text-apoio"><Icone nome="info" :espessura="2.2" /></span>
      <span class="flex flex-col">
        <span class="text-lg font-bold">Este plano foi encerrado em {{ formatarData(contrato.fimVigencia ?? '') }}</span>
        <span class="text-[15px] text-texto">Aqui você ainda vê as contas antigas, pede documentos (como o informe de IR) e acompanha os pedidos.</span>
      </span>
    </section>

    <!-- Pedidos esperando uma ação do cliente -->
    <NuxtLink
      v-if="pendentes.length" :to="pendentes.length === 1 ? `/pedidos/${pendentes[0]!.protocolo}` : '/pedidos'"
      class="flex min-h-[76px] items-center gap-3.5 rounded-[22px] border-2 border-atencao-borda bg-atencao-claro px-[18px] py-3.5 text-tinta no-underline lg:px-6"
    >
      <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-atencao"><Icone nome="alerta" :espessura="2.2" /></span>
      <span class="flex grow flex-col">
        <span class="text-lg font-bold">
          {{ pendentes.length === 1 ? 'Um pedido precisa de você' : `${pendentes.length} pedidos precisam de você` }}
        </span>
        <span class="text-[15px] text-texto">{{ pendentes.length === 1 ? pendentes[0]!.titulo : 'Veja o que falta e resolva por aqui' }}</span>
      </span>
      <span class="hidden shrink-0 text-base font-bold text-atencao sm:inline">Resolver</span>
      <Icone nome="avancar" :tamanho="22" :espessura="2.4" class="text-atencao" />
    </NuxtLink>

    <div class="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      <!-- Titular do plano da empresa: sem contas nem valores -->
      <section
        v-if="!pode('contas')" aria-label="Seu plano pela empresa"
        class="flex flex-col gap-3.5 rounded-3xl border-2 border-info-borda bg-white p-[22px] shadow-cartao lg:p-7"
      >
        <div class="flex items-center gap-3.5">
          <span class="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-azul-claro text-azul"><Icone nome="empresa" :tamanho="30" /></span>
          <div class="min-w-0">
            <div class="text-[17px] font-bold text-texto">Seu plano pela empresa</div>
            <div class="font-display text-[22px] leading-tight font-extrabold">{{ contrato?.empresa ?? 'Plano da empresa' }}</div>
          </div>
        </div>
        <p class="m-0 text-base text-texto">
          Aqui você vê quem está no plano e o número da carteirinha de cada um.
          Valores, descontos e inclusões são tratados com o RH da sua empresa.
        </p>
        <BotaoPrincipal to="/familia">
          Ver carteirinhas da família
          <Icone nome="seta" :tamanho="22" :espessura="2.4" />
        </BotaoPrincipal>
      </section>

      <section
        v-else-if="atual" aria-label="Sua conta do mês"
        class="flex flex-col gap-3.5 rounded-3xl border-2 bg-white p-[22px] shadow-cartao lg:p-7"
        :class="VISUAL_SITUACAO[atual.situacao].borda"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-[17px] font-bold text-texto">Sua conta de {{ atual.mes }}</div>
          <SeloSituacao :situacao="atual.situacao" />
        </div>
        <div class="font-display text-[44px] leading-none font-extrabold tracking-tight lg:text-[52px]">{{ formatarMoeda(atual.valor) }}</div>
        <div class="text-[17px] font-semibold" :class="VISUAL_SITUACAO[atual.situacao].texto">{{ fraseDoVencimento(atual) }}</div>
        <BotaoPrincipal :to="`/contas/${atual.id}`">
          Pagar agora
          <Icone nome="seta" :tamanho="22" :espessura="2.4" />
        </BotaoPrincipal>
      </section>

      <section v-else-if="faturas" class="flex items-center gap-3.5 rounded-3xl bg-white p-[22px] shadow-cartao">
        <span class="flex size-14 items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :tamanho="30" :espessura="2.6" /></span>
        <div>
          <div class="text-lg font-bold">Tudo em dia!</div>
          <div class="text-base text-texto">Você não tem nenhuma conta para pagar agora.</div>
        </div>
      </section>

      <MensagemErro v-else-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar suas contas agora. Tente de novo em instantes.')" />

      <section class="flex flex-col gap-3.5">
        <h2 class="m-0 font-display text-[22px] font-extrabold lg:sr-only">O que você quer fazer?</h2>
        <div class="grid grid-cols-2 gap-3.5 md:grid-cols-4 lg:grid-cols-2 lg:gap-4">
          <NuxtLink
            v-for="a in atalhos" :key="a.to" :to="a.to"
            class="relative flex min-h-[150px] flex-col items-start justify-between gap-3 rounded-[22px] bg-white px-4 py-[18px] text-tinta no-underline shadow-cartao transition-shadow hover:shadow-[0_10px_30px_#353d681c] lg:min-h-[168px] lg:px-5"
          >
            <span class="flex size-[58px] items-center justify-center rounded-[18px]" :class="a.cor">
              <Icone :nome="a.icone" :tamanho="30" />
            </span>
            <span
              v-if="a.to === '/comunicados' && novos"
              class="absolute top-4 right-4 flex h-7 min-w-7 items-center justify-center rounded-full bg-erro px-2 text-sm font-bold text-white"
            >
              {{ novos }}<span class="sr-only"> novos</span>
            </span>
            <span class="flex flex-col">
              <span class="text-[19px] leading-tight font-bold">{{ a.titulo }}</span>
              <span class="text-[15px] text-apoio">{{ a.apoio }}</span>
            </span>
          </NuxtLink>
        </div>
      </section>
    </div>

    <section v-if="recentes.length" class="flex flex-col gap-3.5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="m-0 font-display text-[22px] font-extrabold">Últimos comunicados</h2>
        <NuxtLink to="/comunicados" class="inline-flex min-h-12 items-center text-[17px] font-bold text-roxo-escuro underline underline-offset-4">Ver todos</NuxtLink>
      </div>
      <div class="grid gap-3 lg:grid-cols-2">
        <CartaoComunicado v-for="c in recentes" :key="c.id" :comunicado="c" />
      </div>
    </section>

    <NuxtLink to="/ajuda" class="flex min-h-[76px] items-center gap-3.5 rounded-[22px] border-2 border-roxo-borda bg-roxo-fundo px-[18px] py-3.5 text-tinta no-underline lg:px-6">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-roxo text-white"><Icone nome="conversa" /></span>
      <span class="flex grow flex-col">
        <span class="text-lg font-bold">Precisa de ajuda?</span>
        <span class="text-[15px] text-apoio">Fale com a gente, é rapidinho</span>
      </span>
      <Icone nome="avancar" :tamanho="22" :espessura="2.4" class="text-roxo-icone" />
    </NuxtLink>
  </main>
</template>
