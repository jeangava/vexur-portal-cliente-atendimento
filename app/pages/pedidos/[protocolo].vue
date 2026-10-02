<script setup lang="ts">
import type { Solicitacao } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })

const route = useRoute()
const protocolo = encodeURIComponent(String(route.params.protocolo))
const { data: pedido, error, refresh } = await useFetch<Solicitacao>(`/api/pedidos/${protocolo}`)
useHead({ title: () => `${pedido.value?.titulo ?? 'Pedido'} · Portal do Cliente` })

const { mostrar } = useAviso()
const situacao = computed(() => pedido.value ? SITUACAO_SOLICITACAO[pedido.value.situacao] : null)
const voltarPara = computed(() => pedido.value?.categoria === 'movimentacao' && route.query.de === 'movimentacao' ? '/movimentacao' : '/pedidos')
const usuario = useUsuario()
const novoPedido = computed(() => {
  const destino = pedido.value?.tipo === 'exclusao' ? '/movimentacao/excluir' : pedido.value?.tipo === 'inclusao' ? '/movimentacao/incluir' : pedido.value?.categoria === 'servico' ? '/servicos' : '/ajuda'
  // Se o plano não libera essa área (ex.: plano encerrado), o caminho é falar com a gente.
  const area = areaDaRota(destino)
  return area && !usuario.value?.acesso.areas.includes(area) ? '/ajuda' : destino
})
const historico = computed(() => [...(pedido.value?.historico ?? [])].reverse())

// Regularizar pendência
const documentos = ref<{ id: string, nome: string }[]>([])
const mensagem = ref('')
const erroResposta = ref('')
const respondendo = ref(false)

function dataHora(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

async function responderPendencia() {
  const p = pedido.value?.pendencia
  if (!p) return
  if (p.tipo === 'documento' && !documentos.value.length) { erroResposta.value = 'Envie o documento pedido.'; return }
  if (p.tipo === 'informacao' && mensagem.value.trim().length < 3) { erroResposta.value = 'Escreva a informação pedida.'; return }
  respondendo.value = true
  erroResposta.value = ''
  try {
    await $fetch(`/api/pedidos/${protocolo}/regularizar`, {
      method: 'POST', body: { documentos: documentos.value.map(d => d.id), mensagem: mensagem.value },
    })
    documentos.value = []
    mensagem.value = ''
    await refresh()
    mostrar('Pronto! Recebemos. O pedido voltou para análise.')
  } catch (e) {
    erroResposta.value = mensagemDeErro(e)
  } finally {
    respondendo.value = false
  }
}
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar :to="voltarPara" :rotulo="voltarPara === '/movimentacao' ? 'Movimentação' : 'Meus pedidos'" />

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos abrir esse pedido agora.')" />

    <template v-if="pedido && situacao">
      <div class="flex flex-col gap-2">
        <span class="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-sm font-bold" :class="situacao.classe">
          <Icone :nome="situacao.icone" :tamanho="16" :espessura="2.4" /> {{ situacao.rotulo }}
        </span>
        <h1 class="m-0 font-display text-[28px] leading-[1.15] font-extrabold lg:text-[34px]">{{ pedido.titulo }}</h1>
        <p class="m-0 text-base text-apoio">Protocolo <b class="text-tinta">{{ pedido.protocolo }}</b> · pedido em {{ formatarData(pedido.criadaEm) }}</p>
      </div>

      <div class="flex flex-col gap-[22px] lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div class="flex min-w-0 flex-col gap-[22px]">
          <!-- Pedido em lote: a situação de cada pessoa -->
          <section v-if="pedido.pessoasLote?.length" class="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
            <h2 class="m-0 text-xl font-bold">Pessoas neste pedido ({{ pedido.pessoasLote.length }})</h2>
            <ul class="m-0 flex max-h-[420px] list-none flex-col overflow-y-auto rounded-2xl border-2 border-linha p-0">
              <li v-for="(p, i) in pedido.pessoasLote" :key="i" class="flex flex-wrap items-center justify-between gap-2 border-b border-linha px-4 py-2.5 last:border-b-0">
                <span class="flex flex-col">
                  <span class="text-[17px] font-bold">{{ p.nome }}</span>
                  <span class="text-sm text-apoio">{{ p.parentesco }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold" :class="SITUACAO_SOLICITACAO[p.situacao].classe">
                  <Icone :nome="SITUACAO_SOLICITACAO[p.situacao].icone" :tamanho="16" :espessura="2.4" /> {{ SITUACAO_SOLICITACAO[p.situacao].rotulo }}
                </span>
              </li>
            </ul>
          </section>

          <!-- Pendente: o cliente age aqui mesmo -->
          <section v-if="pedido.situacao === 'pendente' && pedido.pendencia" class="flex flex-col gap-5 rounded-3xl border-2 border-atencao-borda bg-white p-5 shadow-cartao sm:p-7">
            <div class="flex items-start gap-3.5">
              <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-atencao-claro text-atencao"><Icone nome="alerta" :tamanho="26" :espessura="2.2" /></span>
              <div class="flex flex-col gap-1">
                <h2 class="m-0 text-xl font-bold">Falta algo seu para continuar</h2>
                <p class="m-0 text-[17px]">{{ pedido.pendencia.descricao }}</p>
                <p v-if="pedido.pendencia.prazo" class="m-0 text-base font-bold text-atencao">Resolva até {{ formatarData(pedido.pendencia.prazo) }}</p>
              </div>
            </div>
            <form class="flex flex-col gap-4" novalidate @submit.prevent="responderPendencia">
              <EnvioDocumentos v-if="pedido.pendencia.tipo === 'documento'" v-model="documentos" rotulo="Enviar o documento" @enviado="erroResposta = ''" />
              <div v-else class="flex flex-col gap-2">
                <label for="resposta-pendencia" class="text-[17px] font-bold">Sua resposta</label>
                <textarea id="resposta-pendencia" v-model="mensagem" rows="3" maxlength="1000" class="rounded-2xl border-2 border-campo bg-white px-5 py-3 text-lg focus:border-roxo" />
              </div>
              <MensagemErro :texto="erroResposta" />
              <div class="sm:w-[360px]">
                <BotaoPrincipal tipo="submit" :carregando="respondendo">{{ respondendo ? 'Enviando…' : 'Enviar e continuar o pedido' }}</BotaoPrincipal>
              </div>
            </form>
          </section>

          <!-- Indeferido -->
          <section v-else-if="pedido.situacao === 'indeferida'" class="flex flex-col gap-4 rounded-3xl border-2 border-erro-borda bg-white p-5 shadow-cartao sm:p-7">
            <div class="flex items-start gap-3.5">
              <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-erro-claro text-erro"><Icone nome="fechar" :tamanho="26" :espessura="2.4" /></span>
              <div class="flex flex-col gap-1">
                <h2 class="m-0 text-xl font-bold">O pedido não foi aprovado</h2>
                <p class="m-0 text-[17px]">{{ pedido.resultado }}</p>
              </div>
            </div>
            <div class="flex flex-col gap-3 sm:flex-row">
              <div class="sm:w-[290px]"><BotaoPrincipal :to="novoPedido">Fazer um novo pedido</BotaoPrincipal></div>
              <div class="sm:w-[220px]"><BotaoPrincipal variante="contorno" to="/ajuda">Falar com a gente</BotaoPrincipal></div>
            </div>
          </section>

          <!-- Concluído -->
          <section v-else-if="pedido.situacao === 'concluida'" class="flex items-start gap-3.5 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
            <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :tamanho="26" :espessura="2.6" /></span>
            <div class="flex flex-col gap-1">
              <h2 class="m-0 text-xl font-bold">Pedido concluído</h2>
              <p class="m-0 text-[17px]">{{ pedido.resultado ?? pedido.detalhe }}</p>
            </div>
          </section>

          <!-- Em análise -->
          <section v-else class="flex items-start gap-3.5 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
            <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-info-claro text-info"><Icone nome="relogio" :tamanho="26" /></span>
            <div class="flex flex-col gap-1">
              <h2 class="m-0 text-xl font-bold">Estamos analisando</h2>
              <p class="m-0 text-[17px]">{{ pedido.detalhe }}</p>
              <p class="m-0 text-base text-apoio">Se precisarmos de algo, avisamos por aqui e por e-mail.</p>
            </div>
          </section>

          <!-- Arquivos do resultado -->
          <section v-if="pedido.anexos.length" class="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-cartao sm:p-7">
            <h2 class="m-0 text-lg font-bold">Arquivos</h2>
            <a
              v-for="a in pedido.anexos" :key="a.id" :href="`/api/pedidos/${protocolo}/anexos/${encodeURIComponent(a.id)}`" download
              class="flex min-h-16 items-center gap-3.5 rounded-2xl border-2 border-roxo-borda bg-roxo-fundo px-4 py-3 text-tinta no-underline hover:bg-roxo-claro"
            >
              <Icone nome="documento" :tamanho="26" class="text-roxo-icone" />
              <span class="min-w-0 grow text-[17px] font-bold break-words">{{ a.nome }}</span>
              <span class="inline-flex shrink-0 items-center gap-1.5 text-base font-bold text-roxo-escuro"><Icone nome="baixar" :tamanho="20" /> Baixar</span>
            </a>
          </section>
        </div>

        <!-- Histórico -->
        <aside class="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-cartao sm:p-6">
          <h2 class="m-0 text-lg font-bold">O que aconteceu</h2>
          <ol class="m-0 flex list-none flex-col p-0">
            <li v-for="(h, i) in historico" :key="h.quando + i" class="relative flex gap-3 pb-5 last:pb-0">
              <span v-if="i < historico.length - 1" aria-hidden="true" class="absolute top-4 bottom-0 left-[7px] w-0.5 bg-linha" />
              <span aria-hidden="true" class="relative mt-1 size-4 shrink-0 rounded-full border-[3px]" :class="i === 0 ? 'border-roxo bg-roxo-claro' : 'border-campo bg-white'" />
              <div class="flex flex-col">
                <span class="text-base font-semibold" :class="i === 0 ? 'text-tinta' : 'text-texto'">{{ h.texto }}</span>
                <span class="text-sm text-apoio">{{ dataHora(h.quando) }}</span>
              </div>
            </li>
          </ol>
        </aside>
      </div>
    </template>
  </main>
</template>
