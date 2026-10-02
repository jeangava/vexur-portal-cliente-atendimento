<script setup lang="ts">
import type { ExtratoFatura } from '#shared/types/portal'

definePageMeta({ layout: 'portal' })

const route = useRoute()
const id = String(route.params.id)
const { data: extrato, error } = await useFetch<ExtratoFatura>(`/api/faturas/${encodeURIComponent(id)}/extrato`)
useHead({ title: () => `Extrato da conta de ${extrato.value?.fatura.mes ?? ''} · Portal do Cliente` })

const emissao = computed(() => {
  if (!extrato.value) return ''
  const d = new Date(extrato.value.emitidoEm)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
})

const dados = computed(() => {
  const e = extrato.value
  if (!e) return []
  const linhas = [
    { rotulo: 'Titular', valor: e.titular },
    { rotulo: 'Contrato', valor: e.numeroContrato },
    { rotulo: 'Plano', valor: e.plano },
    { rotulo: 'Referência', valor: e.fatura.mes.charAt(0).toUpperCase() + e.fatura.mes.slice(1) },
    { rotulo: 'Vencimento', valor: formatarData(e.fatura.vencimento) },
    { rotulo: 'Situação', valor: VISUAL_SITUACAO[e.fatura.situacao].rotulo },
  ]
  if (e.fatura.pagaEm) linhas.push({ rotulo: 'Pago em', valor: formatarData(e.fatura.pagaEm) })
  return linhas
})

function imprimir() {
  window.print()
}
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10 print:gap-0 print:p-0">
    <BotaoVoltar :to="`/contas/${route.params.id}`" rotulo="Voltar para a conta" class="print:hidden" />

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos abrir o extrato agora.')" />

    <template v-if="extrato">
      <!-- Ações: só na tela -->
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:hidden">
        <div class="flex flex-col gap-1">
          <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Extrato da conta de {{ extrato.fatura.mes }}</h1>
          <p class="m-0 text-lg text-texto">Tudo o que foi cobrado nesta conta, pessoa por pessoa.</p>
        </div>
        <div class="flex flex-col gap-2 md:w-[380px] md:shrink-0">
          <BotaoPrincipal @click="imprimir">
            <Icone nome="imprimir" :tamanho="22" />
            Imprimir ou salvar em PDF
          </BotaoPrincipal>
          <p class="m-0 text-center text-[15px] text-apoio">Para guardar, escolha <b>"Salvar como PDF"</b> na janela que abrir.</p>
        </div>
      </div>

      <!-- Documento: é isto que sai na impressão -->
      <article
        class="flex flex-col gap-6 rounded-3xl bg-white p-5 shadow-cartao sm:p-8 lg:p-10 print:gap-5 print:rounded-none print:p-0 print:shadow-none"
        aria-label="Extrato de cobrança"
      >
        <header class="flex flex-wrap items-start justify-between gap-4 border-b-2 border-linha pb-5">
          <div class="flex items-center gap-3">
            <span class="flex size-11 items-center justify-center rounded-[13px] bg-roxo text-white print:border print:border-roxo"><Icone nome="escudo" :tamanho="26" /></span>
            <div>
              <div class="font-display text-xl font-extrabold">Vexur</div>
              <div class="text-sm text-apoio">Portal do Cliente</div>
            </div>
          </div>
          <div class="text-right">
            <div class="font-display text-[22px] font-extrabold">Extrato de cobrança</div>
            <div class="text-sm text-apoio">Emitido em {{ emissao }}</div>
          </div>
        </header>

        <dl class="m-0 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 print:grid-cols-4">
          <div v-for="d in dados" :key="d.rotulo" class="flex min-w-0 flex-col">
            <dt class="text-sm font-semibold text-apoio">{{ d.rotulo }}</dt>
            <dd class="m-0 text-[17px] font-bold break-words">{{ d.valor }}</dd>
          </div>
        </dl>

        <section class="flex flex-col gap-4">
          <h2 class="m-0 text-lg font-bold">O que foi cobrado</h2>
          <table class="w-full border-collapse text-left text-base">
            <caption class="sr-only">Cobranças por pessoa</caption>
            <thead>
              <tr class="border-b-2 border-linha text-sm text-apoio">
                <th scope="col" class="py-2 pr-3 font-semibold">Descrição</th>
                <th scope="col" class="py-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody v-for="g in extrato.grupos" :key="g.beneficiario" class="break-inside-avoid">
              <tr class="bg-fundo print:bg-transparent">
                <th scope="rowgroup" colspan="2" class="px-3 py-2.5 text-[17px] font-bold">
                  {{ g.beneficiario }} <span class="font-semibold text-apoio">· {{ g.parentesco }}</span>
                </th>
              </tr>
              <tr v-for="l in g.linhas" :key="l.descricao" class="border-b border-linha">
                <td class="py-2.5 pr-3 pl-3">{{ l.descricao }}</td>
                <td class="py-2.5 text-right whitespace-nowrap">{{ formatarMoeda(l.valor) }}</td>
              </tr>
              <tr>
                <td class="py-2.5 pr-3 pl-3 font-semibold text-texto">Subtotal de {{ g.beneficiario.split(' ')[0] }}</td>
                <td class="py-2.5 text-right font-bold whitespace-nowrap">{{ formatarMoeda(g.subtotal) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t-2 border-tinta">
                <th scope="row" class="py-4 pr-3 text-xl font-extrabold">Total da conta</th>
                <td class="py-4 text-right font-display text-[26px] font-extrabold whitespace-nowrap">{{ formatarMoeda(extrato.total) }}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <ul class="m-0 flex list-none flex-col gap-1.5 border-t border-linha p-0 pt-4 text-[15px] text-apoio">
          <li v-for="o in extrato.observacoes" :key="o">{{ o }}</li>
        </ul>
      </article>

      <div v-if="extrato.fatura.situacao !== 'paga'" class="md:w-[360px] print:hidden">
        <BotaoPrincipal :to="`/contas/${extrato.fatura.id}`">
          Pagar esta conta
          <Icone nome="seta" :tamanho="22" :espessura="2.4" />
        </BotaoPrincipal>
      </div>
    </template>
  </main>
</template>
