<script setup lang="ts">
definePageMeta({ layout: 'portal' })
useHead({ title: 'Pagar com boleto · Portal do Cliente' })

const route = useRoute()
const id = encodeURIComponent(String(route.params.id))
const { mostrar } = useAviso()

const [{ data: fatura }, { data: boleto, error }] = await Promise.all([
  useFetch(`/api/faturas/${id}`),
  useFetch(`/api/faturas/${id}/boleto`),
])

const copiado = ref(false)

async function copiar() {
  if (!boleto.value) return
  const ok = await copiarTexto(boleto.value.linhaDigitavel.replace(/\D/g, ''))
  copiado.value = ok
  mostrar(ok ? 'Número copiado. Agora abra o app do seu banco.' : 'Não deu para copiar. Tente baixar o boleto.')
}

function baixar() {
  mostrar('O PDF do boleto chega junto com a integração do faturamento.')
}
</script>

<template>
  <main class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar :to="`/contas/${route.params.id}`" />
    <div class="flex flex-col gap-1">
      <h1 class="m-0 font-display text-[30px] leading-[1.15] font-extrabold lg:text-[34px]">Pagar com boleto</h1>
      <p v-if="fatura" class="m-0 text-lg text-texto">
        Valor: <b class="text-tinta">{{ formatarMoeda(fatura.valor) }}</b> · Vence {{ formatarData(fatura.vencimento) }}
      </p>
    </div>

    <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos abrir o boleto agora. Tente de novo ou use o PIX.')" />

    <div v-if="boleto" class="flex flex-col gap-[22px] md:grid md:grid-cols-2 md:items-start md:gap-6 lg:gap-8">
      <div class="flex flex-col gap-[22px]">
        <div class="flex flex-col gap-2.5 rounded-[22px] bg-white p-[18px] shadow-cartao lg:p-6">
          <span class="text-base font-bold text-texto">Número do boleto</span>
          <span class="font-display text-lg leading-normal font-bold tracking-wide break-all">{{ boleto.linhaDigitavel }}</span>
        </div>

        <BotaoPrincipal :variante="copiado ? 'sucesso' : 'roxo'" @click="copiar">
          <Icone :nome="copiado ? 'certo' : 'copiar'" :espessura="copiado ? 2.8 : 2.2" />
          {{ copiado ? 'Número copiado!' : 'Copiar número do boleto' }}
        </BotaoPrincipal>

        <BotaoPrincipal variante="contorno" @click="baixar">
          <Icone nome="baixar" :tamanho="22" :espessura="2.2" />
          Baixar boleto (PDF)
        </BotaoPrincipal>
      </div>

      <div class="flex items-start gap-3 rounded-[18px] border-2 border-roxo-borda bg-roxo-fundo px-4 py-3.5 lg:p-6">
        <Icone nome="info" :espessura="2.2" class="mt-0.5 text-roxo-icone" />
        <span class="text-base">
          Quer que caia na hora?
          <NuxtLink :to="`/contas/${route.params.id}/pix`" class="font-bold text-roxo-escuro underline underline-offset-[3px]">Pague com PIX</NuxtLink>
        </span>
      </div>
    </div>
  </main>
</template>
