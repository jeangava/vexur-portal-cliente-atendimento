<script setup lang="ts">
const route = useRoute()
const usuario = useUsuario()
const sair = useSair()

type Item = { to: string, rotulo: string, rotuloLongo?: string, icone: string, noCelular: boolean, ativo: (p: string) => boolean }
const itens: Item[] = [
  { to: '/inicio', rotulo: 'Início', icone: 'casa', noCelular: true, ativo: p => p === '/inicio' },
  { to: '/contas', rotulo: 'Contas', rotuloLongo: 'Minhas contas', icone: 'conta', noCelular: true, ativo: p => p.startsWith('/contas') },
  { to: '/servicos', rotulo: 'Serviços', icone: 'documento', noCelular: true, ativo: p => p.startsWith('/servicos') },
  { to: '/comunicados', rotulo: 'Comunicados', icone: 'sino', noCelular: false, ativo: p => p.startsWith('/comunicados') },
  { to: '/familia', rotulo: 'Família', rotuloLongo: 'Minha família', icone: 'familia', noCelular: true, ativo: p => p === '/familia' },
  { to: '/movimentacao', rotulo: 'Movimentação', icone: 'lista', noCelular: false, ativo: p => p.startsWith('/movimentacao') },
  { to: '/pedidos', rotulo: 'Pedidos', rotuloLongo: 'Meus pedidos', icone: 'relogio', noCelular: false, ativo: p => p.startsWith('/pedidos') },
  { to: '/ajuda', rotulo: 'Ajuda', icone: 'conversa', noCelular: true, ativo: p => p === '/ajuda' },
]

// Só o que o plano escolhido libera (ex.: plano da empresa não tem Contas nem Serviços).
const visiveis = computed(() => itens.filter((i) => {
  const area = areaDaRota(i.to)
  return !area || !!usuario.value?.acesso.areas.includes(area)
}).map(i => (
  // Responsável pela empresa vê todas as pessoas do plano, não só a família.
  i.to === '/familia' && usuario.value?.contrato?.papel === 'representante'
    ? { ...i, rotulo: 'Pessoas', rotuloLongo: 'Beneficiários' }
    : i
)))

// Celular: 4 atalhos + Ajuda. Quando falta algum dos principais, entra o próximo da lista.
const itensCelular = computed(() => {
  const ajuda = visiveis.value.filter(i => i.to === '/ajuda')
  const resto = visiveis.value.filter(i => i.to !== '/ajuda')
  return [...resto.filter(i => i.noCelular), ...resto.filter(i => !i.noCelular)].slice(0, 4).concat(ajuda)
})
</script>

<template>
  <!-- Menu lateral: notebook/desktop -->
  <aside
    class="fixed inset-y-0 left-0 z-20 hidden w-[264px] flex-col gap-8 overflow-y-auto border-r border-[#eceaf5] bg-white px-5 py-7 lg:flex print:hidden"
    aria-label="Menu lateral"
  >
    <NuxtLink to="/inicio" class="flex items-center gap-3 px-2 text-tinta no-underline">
      <span class="flex size-11 items-center justify-center rounded-[13px] bg-roxo text-white"><Icone nome="escudo" :tamanho="26" /></span>
      <span class="font-display text-[22px] font-extrabold tracking-tight">Vexur</span>
    </NuxtLink>

    <nav aria-label="Menu principal" class="flex flex-col gap-1.5">
      <NuxtLink
        v-for="item in visiveis" :key="item.to" :to="item.to"
        :aria-current="item.ativo(route.path) ? 'page' : undefined"
        class="flex min-h-14 items-center gap-3.5 rounded-2xl px-4 text-[17px] font-bold no-underline transition-colors"
        :class="item.ativo(route.path) ? 'bg-roxo-claro text-roxo-escuro' : 'text-texto hover:bg-fundo'"
      >
        <Icone :nome="item.icone" :tamanho="24" />
        {{ item.rotuloLongo ?? item.rotulo }}
      </NuxtLink>
    </nav>

    <div class="grow" />

    <NuxtLink
      v-if="usuario?.podeTrocarContrato" to="/escolher-plano"
      class="-mb-5 flex min-h-12 items-center gap-2.5 rounded-2xl px-4 text-base font-bold text-roxo-escuro no-underline hover:bg-fundo"
    >
      <Icone nome="trocar" :tamanho="22" />
      Trocar de plano
    </NuxtLink>

    <div class="flex items-center gap-3 rounded-2xl bg-fundo p-3">
      <span aria-hidden="true" class="flex size-11 shrink-0 items-center justify-center rounded-full bg-roxo font-display text-lg font-extrabold text-white">
        {{ usuario?.primeiroNome?.[0] }}
      </span>
      <span class="flex min-w-0 grow flex-col">
        <span class="truncate text-base font-bold">{{ usuario?.nome }}</span>
        <span class="truncate text-sm text-apoio">{{ usuario?.plano }}</span>
      </span>
      <button
        type="button" aria-label="Sair do portal"
        class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-texto shadow-leve"
        @click="sair"
      >
        <Icone nome="sair" :tamanho="20" />
      </button>
    </div>
  </aside>

  <div class="lg:pl-[264px] print:pl-0">
    <div class="mx-auto w-full max-w-[1120px] pb-[100px] lg:pb-12 print:max-w-none print:pb-0">
      <slot />
    </div>
  </div>

  <!-- Barra de baixo: celular e tablet -->
  <nav
    aria-label="Menu principal"
    class="fixed inset-x-0 bottom-0 z-20 border-t border-[#eceaf5] bg-white px-1.5 pt-2 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden print:hidden"
  >
    <div class="mx-auto grid max-w-[600px] grid-cols-5 gap-1">
      <NuxtLink
        v-for="item in itensCelular" :key="item.to" :to="item.to"
        :aria-current="item.ativo(route.path) ? 'page' : undefined"
        class="flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl text-[12.5px] font-bold tracking-[-0.2px] no-underline"
        :class="item.ativo(route.path) ? 'bg-roxo-claro text-roxo-escuro' : 'text-apoio'"
      >
        <Icone :nome="item.icone" :tamanho="26" />
        <span class="max-w-full truncate">{{ item.rotulo }}</span>
      </NuxtLink>
    </div>
  </nav>

  <PopupComunicadoVigente />
</template>
