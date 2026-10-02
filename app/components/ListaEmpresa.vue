<script setup lang="ts">
import type { BeneficiariosEmpresa, PessoaEmpresa, TitularEmpresa } from '#shared/types/portal'

/**
 * Lista das pessoas do plano da empresa: busca, filtros e 20 titulares por vez.
 * Com `selecionavel`, vira a lista de "quem vai sair": titular marcado leva os dependentes.
 */
const props = withDefaults(defineProps<{ empresa: BeneficiariosEmpresa, selecionavel?: boolean }>(), { selecionavel: false })
const selecionados = defineModel<string[]>('selecionados', { default: () => [] })

const POR_PAGINA = 20
const busca = ref('')
type Situacao = 'ativos' | 'cancelados' | 'todos'
// Começa em "Ativos": quem já saiu fica a um toque, sem misturar com quem está no plano.
const situacao = ref<Situacao>('ativos')
const filtro = ref<'todos' | 'saindo' | `plano:${string}`>('todos')
const quantos = ref(POR_PAGINA)
const abertos = ref(new Set<string>())

watch([busca, filtro, situacao], () => { quantos.value = POR_PAGINA })

function naSituacao(p: PessoaEmpresa, s: Situacao = situacao.value): boolean {
  return s === 'todos' || (s === 'ativos' ? p.situacao === 'ativo' : p.situacao === 'cancelado')
}

const termo = computed(() => normalizarTexto(busca.value))
const termoDigitos = computed(() => somenteDigitos(busca.value))

function bate(p: PessoaEmpresa): boolean {
  if (!termo.value) return true
  if (normalizarTexto(p.nome).includes(termo.value)) return true
  // CPF ou carteirinha: compara só os números (com 3 ou mais, para não achar todo mundo).
  return termoDigitos.value.length >= 3
    && (somenteDigitos(p.cpf).includes(termoDigitos.value) || somenteDigitos(p.numeroCarteirinha).includes(termoDigitos.value))
}

function passaNoFiltro(t: TitularEmpresa): boolean {
  if (filtro.value === 'saindo') return !!t.saida || t.dependentes.some(d => d.saida)
  if (filtro.value.startsWith('plano:')) return t.plano === filtro.value.slice(6)
  return true
}

/**
 * Titulares que aparecem, cada um com os dependentes da situação escolhida.
 * Em "Cancelados", um titular ativo aparece se algum dependente dele já saiu.
 */
const filtrados = computed(() => props.empresa.titulares.flatMap((t) => {
  if (!passaNoFiltro(t)) return []
  const dependentes = t.dependentes.filter(d => naSituacao(d))
  if (!naSituacao(t) && !(situacao.value === 'cancelados' && dependentes.length)) return []
  const depsQueBatem = dependentes.filter(bate)
  if (!bate(t) && !depsQueBatem.length) return []
  const abrir = (!!termo.value && depsQueBatem.length > 0) || (situacao.value === 'cancelados' && t.situacao === 'ativo')
  return [{ titular: t, dependentes, abrir }]
}))

function contar(s: Situacao) {
  return props.empresa.titulares
    .filter(t => naSituacao(t, s) || (s === 'cancelados' && t.dependentes.some(d => naSituacao(d, s)))).length
}
const situacoes = computed(() => [
  { id: 'ativos' as const, rotulo: `Ativos (${contar('ativos')})` },
  { id: 'cancelados' as const, rotulo: `Cancelados (${contar('cancelados')})` },
  { id: 'todos' as const, rotulo: `Todos (${props.empresa.titulares.length})` },
])
const visiveis = computed(() => filtrados.value.slice(0, quantos.value))

const saindo = computed(() => props.empresa.titulares.filter(t => t.saida || t.dependentes.some(d => d.saida)).length)
const filtros = computed(() => [
  { id: 'todos', rotulo: 'Todos os planos' },
  ...(props.empresa.planos.length > 1
    ? props.empresa.planos.map(p => ({ id: `plano:${p}`, rotulo: p }))
    : []),
  ...(saindo.value ? [{ id: 'saindo', rotulo: `Saindo do plano (${saindo.value})` }] : []),
])

function estaAberto(item: { titular: TitularEmpresa, abrir: boolean }) {
  return item.abrir || abertos.value.has(item.titular.id)
}
function alternar(id: string) {
  const s = new Set(abertos.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  abertos.value = s
}

// Seleção
const marcados = computed(() => new Set(selecionados.value))
function marcar(p: PessoaEmpresa, titular?: TitularEmpresa) {
  const s = new Set(selecionados.value)
  if (s.has(p.id)) s.delete(p.id)
  else s.add(p.id)
  // Titular marcado: os dependentes saem junto, então não ficam marcados separados.
  if (!titular && s.has(p.id)) (p as TitularEmpresa).dependentes.forEach(d => s.delete(d.id))
  selecionados.value = [...s]
}
function saiJunto(t: TitularEmpresa) {
  return marcados.value.has(t.id)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <label for="busca-empresa" class="text-[17px] font-bold">Procurar pessoa</label>
      <div class="relative">
        <input
          id="busca-empresa" v-model="busca" type="search" autocomplete="off"
          placeholder="Nome, CPF ou nº da carteirinha"
          class="h-14 w-full rounded-2xl border-2 border-campo bg-white pr-12 pl-5 text-lg text-tinta placeholder:text-[#8a91a8] focus:border-roxo"
        >
        <button
          v-if="busca" type="button" aria-label="Limpar a busca"
          class="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-apoio hover:bg-fundo"
          @click="busca = ''"
        >
          <Icone nome="fechar" :tamanho="20" />
        </button>
      </div>
    </div>

    <div role="group" aria-label="Situação no plano" class="flex flex-wrap gap-2">
      <button
        v-for="s in situacoes" :key="s.id" type="button" :aria-pressed="situacao === s.id"
        class="min-h-11 rounded-full border-2 px-4 text-[15px] font-bold transition-colors"
        :class="situacao === s.id ? 'border-tinta bg-tinta text-white' : 'border-campo bg-white text-texto hover:border-tinta'"
        @click="situacao = s.id"
      >
        {{ s.rotulo }}
      </button>
    </div>

    <div role="group" aria-label="Filtrar por plano" class="-mt-1 flex flex-wrap gap-2">
      <button
        v-for="f in filtros" :key="f.id" type="button" :aria-pressed="filtro === f.id"
        class="min-h-11 rounded-full border-2 px-4 text-[15px] font-bold transition-colors"
        :class="filtro === f.id ? 'border-roxo bg-roxo text-white' : 'border-campo bg-white text-texto hover:border-roxo'"
        @click="filtro = f.id as typeof filtro"
      >
        {{ f.rotulo }}
      </button>
    </div>

    <p class="m-0 text-[15px] text-apoio" aria-live="polite">
      <template v-if="!filtrados.length">Ninguém encontrado. Confira o que foi digitado.</template>
      <template v-else>Mostrando {{ visiveis.length }} de {{ filtrados.length }} {{ filtrados.length === 1 ? 'titular' : 'titulares' }}</template>
    </p>

    <ul class="m-0 flex list-none flex-col gap-3 p-0">
      <li v-for="item in visiveis" :key="item.titular.id" class="overflow-hidden rounded-[22px] bg-white shadow-cartao">
        <!-- Titular -->
        <div class="flex items-center gap-3 p-4 lg:px-5" :class="saiJunto(item.titular) ? 'bg-erro-claro/50' : ''">
          <label v-if="selecionavel" class="flex size-11 shrink-0 cursor-pointer items-center justify-center" :class="item.titular.saida || item.titular.situacao === 'cancelado' ? 'cursor-not-allowed opacity-40' : ''">
            <input
              type="checkbox" class="size-6 accent-roxo" :disabled="!!item.titular.saida || item.titular.situacao === 'cancelado'"
              :checked="marcados.has(item.titular.id)" :aria-label="`Tirar ${item.titular.nome} (e dependentes) do plano`"
              @change="marcar(item.titular)"
            >
          </label>
          <span v-else aria-hidden="true" class="flex size-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold" :class="item.titular.situacao === 'cancelado' ? 'bg-linha text-apoio' : 'bg-roxo text-white'">
            {{ item.titular.nome[0] }}
          </span>
          <div class="flex min-w-0 grow flex-col">
            <span class="text-[18px] leading-tight font-bold">{{ item.titular.nome }}</span>
            <span class="text-sm text-apoio">CPF {{ item.titular.cpf }} · Carteirinha {{ item.titular.numeroCarteirinha }}</span>
            <span class="mt-1 flex flex-wrap gap-1.5">
              <span v-if="empresa.planos.length > 1" class="rounded-full bg-roxo-claro px-2.5 py-0.5 text-sm font-semibold text-roxo-escuro">{{ item.titular.plano }}</span>
              <span v-if="item.titular.situacao === 'cancelado'" class="rounded-full bg-erro-claro px-2.5 py-0.5 text-sm font-bold text-erro">
                Cancelado em {{ formatarData(item.titular.fimVigencia ?? '') }}
              </span>
              <span v-else-if="item.titular.saida" class="rounded-full bg-info-claro px-2.5 py-0.5 text-sm font-bold text-info">
                Sai em {{ formatarData(item.titular.saida.data) }} · {{ item.titular.saida.protocolo }}
              </span>
            </span>
          </div>
          <button
            v-if="item.dependentes.length" type="button" :aria-expanded="estaAberto(item)"
            class="flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[15px] font-bold text-roxo-escuro hover:bg-fundo"
            @click="alternar(item.titular.id)"
          >
            +{{ item.dependentes.length }}<span class="hidden sm:inline">&nbsp;{{ item.dependentes.length === 1 ? 'dependente' : 'dependentes' }}</span>
            <Icone nome="avancar" :tamanho="18" :espessura="2.4" class="transition-transform" :class="estaAberto(item) ? 'rotate-90' : ''" />
          </button>
          <span v-else class="hidden shrink-0 text-sm text-apoio sm:inline">Sem dependentes</span>
        </div>

        <!-- Dependentes -->
        <ul v-if="estaAberto(item)" class="m-0 flex list-none flex-col border-t border-linha p-0">
          <li
            v-for="d in item.dependentes" :key="d.id"
            class="flex items-center gap-3 border-b border-linha py-3 pr-4 pl-4 last:border-b-0 lg:pl-8"
            :class="saiJunto(item.titular) || marcados.has(d.id) ? 'bg-erro-claro/50' : ''"
          >
            <label v-if="selecionavel" class="flex size-11 shrink-0 cursor-pointer items-center justify-center" :class="d.saida || d.situacao === 'cancelado' || saiJunto(item.titular) ? 'cursor-not-allowed opacity-40' : ''">
              <input
                type="checkbox" class="size-6 accent-roxo" :disabled="!!d.saida || d.situacao === 'cancelado' || saiJunto(item.titular)"
                :checked="(saiJunto(item.titular) && d.situacao === 'ativo') || marcados.has(d.id)" :aria-label="`Tirar ${d.nome} do plano`"
                @change="marcar(d, item.titular)"
              >
            </label>
            <span v-else aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center rounded-full bg-laranja-claro font-display font-extrabold text-laranja">{{ d.nome[0] }}</span>
            <div class="flex min-w-0 grow flex-col">
              <span class="text-[17px] font-bold">{{ d.nome }} <span class="font-semibold text-apoio">· {{ d.parentesco }}</span></span>
              <span class="text-sm text-apoio">CPF {{ d.cpf }} · Carteirinha {{ d.numeroCarteirinha }}</span>
              <span v-if="d.situacao === 'cancelado'" class="mt-1 self-start rounded-full bg-erro-claro px-2.5 py-0.5 text-sm font-bold text-erro">Cancelado em {{ formatarData(d.fimVigencia ?? '') }}</span>
              <span v-else-if="d.saida" class="mt-1 self-start rounded-full bg-info-claro px-2.5 py-0.5 text-sm font-bold text-info">Sai em {{ formatarData(d.saida.data) }}</span>
              <span v-else-if="selecionavel && saiJunto(item.titular) && d.situacao === 'ativo'" class="text-sm font-semibold text-erro">Sai junto com o titular</span>
            </div>
          </li>
        </ul>
      </li>
    </ul>

    <button
      v-if="visiveis.length < filtrados.length" type="button"
      class="flex min-h-14 items-center justify-center rounded-2xl border-2 border-campo bg-white text-[17px] font-bold text-texto hover:border-roxo"
      @click="quantos += POR_PAGINA"
    >
      Ver mais {{ Math.min(POR_PAGINA, filtrados.length - visiveis.length) }}
    </button>
  </div>
</template>
