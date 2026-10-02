<script setup lang="ts">
definePageMeta({ layout: 'portal' })
useHead({ title: 'Pagar com PIX · Portal do Cliente' })

const route = useRoute()
const id = encodeURIComponent(String(route.params.id))
const { mostrar } = useAviso()

const [{ data: fatura }, { data: pix, error }] = await Promise.all([
  useFetch(`/api/faturas/${id}`),
  useFetch(`/api/faturas/${id}/pix`),
])

const copiado = ref(false)
const verQr = ref(false)

async function copiar() {
  if (!pix.value) return
  const ok = await copiarTexto(pix.value.copiaECola)
  copiado.value = ok
  mostrar(ok ? 'Código copiado. Agora abra o app do seu banco.' : 'Não deu para copiar. Tente ler o QR Code.')
}

const passos = [
  { n: 1, texto: 'Toque em', forte: 'Copiar código PIX' },
  { n: 2, texto: 'Abra o app do seu banco e escolha', forte: 'PIX Copia e Cola' },
  { n: 3, texto: 'Cole o código e confirme.', forte: 'Pronto!' },
]
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar :to="`/contas/${route.params.id}`" />
    <div class="flex flex-col gap-1">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Pagar com PIX</h1>
      <p v-if="fatura" class="m-0 text-lg text-texto">Valor: <b class="text-tinta">{{ formatarMoeda(fatura.valor) }}</b></p>
    </div>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos gerar o PIX agora. Tente de novo ou use o boleto.')" />

    <div v-if="pix" class="flex flex-col gap-[22px] md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6 lg:gap-8">
      <div class="flex flex-col gap-[22px]">
        <ol class="m-0 flex list-none flex-col gap-3 p-0">
          <li v-for="p in passos" :key="p.n" class="flex items-center gap-3.5 rounded-[18px] bg-white px-4 py-3.5 shadow-[0_4px_14px_#353d680d]">
            <span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-roxo font-display text-xl font-extrabold text-white">{{ p.n }}</span>
            <span class="text-[17px]">{{ p.texto }} <b>{{ p.forte }}</b></span>
          </li>
        </ol>

        <BotaoPrincipal :variante="copiado ? 'sucesso' : 'roxo'" @click="copiar">
          <Icone :nome="copiado ? 'certo' : 'copiar'" :espessura="copiado ? 2.8 : 2.2" />
          {{ copiado ? 'Código copiado!' : 'Copiar código PIX' }}
        </BotaoPrincipal>

        <p class="m-0 text-center text-base text-texto md:text-left">
          Assim que o banco confirmar, a conta aparece como <b class="text-ok">Paga</b> aqui.
        </p>
      </div>

      <!-- No celular o QR fica escondido (paga-se no próprio aparelho); no computador ele já aparece. -->
      <div class="flex flex-col items-center gap-3 rounded-[22px] bg-white px-[18px] pt-1.5 pb-[18px] shadow-cartao md:pt-6">
        <button
          type="button" :aria-expanded="verQr" aria-controls="qr-pix"
          class="flex min-h-14 w-full items-center justify-between gap-2.5 bg-transparent text-left text-[17px] font-bold text-tinta md:hidden"
          @click="verQr = !verQr"
        >
          <span>Vai pagar por outro celular? {{ verQr ? '' : 'Ver QR Code' }}</span>
          <Icone nome="abrir" :tamanho="22" :espessura="2.4" class="text-roxo-icone transition-transform" :class="{ 'rotate-180': verQr }" />
        </button>
        <h2 class="m-0 hidden text-lg font-bold md:block">Ou leia o QR Code com o celular</h2>
        <div id="qr-pix" class="flex-col items-center gap-3" :class="verQr ? 'flex' : 'hidden md:flex'">
          <img :src="pix.qrCode" alt="QR Code do PIX desta conta" width="240" height="240" class="rounded-2xl border-2 border-linha">
          <p class="m-0 max-w-[300px] text-center text-[15px] text-apoio">Abra o app do banco no celular, escolha pagar com QR Code e aponte a câmera para este quadrado.</p>
        </div>
      </div>
    </div>
  </main>
</template>
