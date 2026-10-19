<script setup lang="ts">
import type { ContratoCliente } from '#shared/types/portal'

/**
 * Lista dos contratos do CPF, para escolher qual abrir. Usada na tela cheia (primeiro acesso
 * com vários contratos) e no popup "Ver outro contrato". Quem usa decide o que fazer depois de abrir.
 */
const emit = defineEmits<{ aberto: [contrato: ContratoCliente, eraTroca: boolean] }>()

const usuario = useUsuario()

const { data, error, refresh } = useFetch<{ contratos: ContratoCliente[], atual: string | null }>('/api/contratos')
// Busca de novo ao abrir: a lista pode ter mudado desde a última vez (e garante que apareça no popup).
onMounted(() => { void refresh() })

// Com muitos contratos aparece uma busca (nome do plano, empresa ou número).
const LIMITE_SEM_BUSCA = 8
const busca = ref('')
const total = computed(() => data.value?.contratos.length ?? 0)
function semAcento(t: string) { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }
const filtrados = computed(() => {
  const termo = semAcento(busca.value.trim())
  const todos = data.value?.contratos ?? []
  return termo ? todos.filter(c => semAcento(`${c.plano} ${c.empresa ?? ''} ${c.numero}`).includes(termo)) : todos
})
const ativos = computed(() => filtrados.value.filter(c => c.situacao === 'ativo'))
const encerrados = computed(() => filtrados.value.filter(c => c.situacao === 'cancelado'))

// Último contrato aberto neste aparelho (só uma conveniência; o servidor confere tudo de novo).
const CHAVE_ULTIMO = 'vexur-ultimo-contrato'
const ultimo = ref('')
onMounted(() => { try { ultimo.value = localStorage.getItem(CHAVE_ULTIMO) ?? '' } catch { /* sem armazenamento: segue sem lembrar */ } })

// Com plano ativo, os encerrados ficam guardados num botão; sem nenhum ativo, aparecem direto.
const verEncerrados = ref(false)
const mostrarEncerrados = computed(() => verEncerrados.value || !ativos.value.length || !!busca.value.trim())

const abrindo = ref('')
const erroGeral = ref('')

async function abrir(contrato: ContratoCliente) {
  if (abrindo.value) return
  const eraTroca = !!usuario.value?.contrato
  if (contrato.id === data.value?.atual) return emit('aberto', contrato, false)
  abrindo.value = contrato.id
  erroGeral.value = ''
  try {
    const resposta = await $fetch('/api/contratos/escolher', { method: 'POST', body: { id: contrato.id } })
    usuario.value = resposta.usuario
    try { localStorage.setItem(CHAVE_ULTIMO, contrato.numero) } catch { /* sem armazenamento: segue sem lembrar */ }
    // Limpa o que foi carregado do plano anterior (contas, família, pedidos...).
    clearNuxtData()
    emit('aberto', contrato, eraTroca)
  } catch (e) {
    erroGeral.value = mensagemDeErro(e)
  } finally {
    abrindo.value = ''
  }
}

function icone(c: ContratoCliente) {
  return c.tipo === 'empresarial' ? 'empresa' : c.tipo === 'individual' ? 'familia' : 'escudo'
}

function linhaDoTipo(c: ContratoCliente) {
  return c.empresa ? `${ROTULO_TIPO_CONTRATO[c.tipo]} · ${c.empresa}` : ROTULO_TIPO_CONTRATO[c.tipo]
}

function linhaDaData(c: ContratoCliente) {
  return c.situacao === 'cancelado'
    ? `Encerrado em ${formatarData(c.fimVigencia ?? '')}`
    : `Desde ${formatarData(c.inicioVigencia)}`
}

defineExpose({ ativos, total })
</script>

<template>
  <div class="flex flex-col gap-5">
    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar os seus planos agora.')" />
    <MensagemErro :texto="erroGeral" />

    <div v-if="total > LIMITE_SEM_BUSCA" class="flex flex-col gap-2">
      <label for="busca-plano" class="text-[17px] font-bold">Procurar um contrato</label>
      <input
        id="busca-plano" v-model="busca" type="search" placeholder="Nome do plano, empresa ou número"
        class="h-14 rounded-2xl border-2 border-campo bg-white px-5 text-lg text-tinta placeholder:text-[#8a91a8] focus:border-roxo"
      >
    </div>
    <p v-if="busca.trim() && !filtrados.length" class="m-0 text-lg text-texto">Nenhum contrato encontrado para "{{ busca.trim() }}".</p>

    <section v-if="ativos.length" class="flex flex-col gap-3">
      <h2 class="m-0 text-lg font-bold text-texto">Planos ativos <span class="font-semibold text-apoio">({{ ativos.length }})</span></h2>
      <ul class="m-0 flex list-none flex-col gap-3 p-0">
        <li v-for="c in ativos" :key="c.id">
          <button
            type="button" :disabled="!!abrindo"
            class="flex w-full items-center gap-3.5 rounded-[22px] border-2 bg-white px-[18px] py-4 text-left text-tinta shadow-cartao transition-colors hover:border-roxo disabled:opacity-60"
            :class="c.id === data?.atual ? 'border-roxo bg-roxo-fundo' : 'border-transparent'"
            @click="abrir(c)"
          >
            <span class="flex size-14 shrink-0 items-center justify-center rounded-[18px]" :class="c.tipo === 'empresarial' ? 'bg-azul-claro text-azul' : 'bg-roxo-claro text-roxo-icone'">
              <Icone :nome="icone(c)" :tamanho="28" />
            </span>
            <span class="flex min-w-0 grow flex-col gap-0.5">
              <span class="text-[19px] leading-tight font-bold">{{ c.plano }}</span>
              <span class="text-[15px] text-texto">{{ linhaDoTipo(c) }}</span>
              <span class="text-[15px] font-semibold" :class="c.papel === 'representante' ? 'text-azul' : 'text-apoio'">{{ papelLegivel(c) }}</span>
              <span class="text-sm text-apoio">Contrato {{ c.numero }} · {{ linhaDaData(c) }}</span>
              <span v-if="c.id === data?.atual" class="mt-1 self-start rounded-full bg-roxo px-2.5 py-0.5 text-sm font-bold text-white">Você está aqui</span>
              <span v-else-if="c.numero === ultimo" class="mt-1 self-start rounded-full bg-roxo-claro px-2.5 py-0.5 text-sm font-bold text-roxo-escuro">Último que você abriu</span>
            </span>
            <Icone v-if="abrindo !== c.id" nome="avancar" :tamanho="24" :espessura="2.4" class="shrink-0 text-roxo-icone" />
            <span v-else class="shrink-0 text-sm font-bold text-roxo-escuro">Abrindo…</span>
          </button>
        </li>
      </ul>
    </section>

    <section v-if="encerrados.length" class="flex flex-col gap-3">
      <button
        v-if="ativos.length && !mostrarEncerrados" type="button"
        class="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-campo bg-white text-[17px] font-bold text-texto"
        @click="verEncerrados = true"
      >
        Ver planos encerrados ({{ encerrados.length }})
      </button>

      <template v-if="mostrarEncerrados">
        <h2 class="m-0 text-lg font-bold text-texto">Planos encerrados <span class="font-semibold text-apoio">({{ encerrados.length }})</span></h2>
        <ul class="m-0 flex list-none flex-col gap-3 p-0">
          <li v-for="c in encerrados" :key="c.id">
            <button
              type="button" :disabled="!!abrindo"
              class="flex w-full items-center gap-3.5 rounded-[22px] border-2 bg-fundo px-[18px] py-4 text-left text-tinta transition-colors hover:border-campo disabled:opacity-60"
              :class="c.id === data?.atual ? 'border-roxo' : 'border-linha'"
              @click="abrir(c)"
            >
              <span class="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-white text-apoio">
                <Icone :nome="icone(c)" :tamanho="28" />
              </span>
              <span class="flex min-w-0 grow flex-col gap-0.5">
                <span class="text-[18px] leading-tight font-bold text-texto">{{ c.plano }}</span>
                <span class="text-[15px] text-apoio">{{ linhaDoTipo(c) }}</span>
                <span class="text-sm font-semibold text-erro">{{ linhaDaData(c) }}</span>
                <span v-if="c.id === data?.atual" class="mt-1 self-start rounded-full bg-roxo px-2.5 py-0.5 text-sm font-bold text-white">Você está aqui</span>
                <span v-else-if="c.numero === ultimo" class="mt-1 self-start rounded-full bg-roxo-claro px-2.5 py-0.5 text-sm font-bold text-roxo-escuro">Último que você abriu</span>
              </span>
              <Icone v-if="abrindo !== c.id" nome="avancar" :tamanho="24" :espessura="2.4" class="shrink-0 text-apoio" />
              <span v-else class="shrink-0 text-sm font-bold text-roxo-escuro">Abrindo…</span>
            </button>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
