<script setup lang="ts">
definePageMeta({ layout: 'portal' })

const route = useRoute()
const servico = buscarServico(String(route.params.id))
if (!servico) throw createError({ statusCode: 404, statusMessage: 'Serviço não encontrado', fatal: true })
useHead({ title: `${servico.titulo} · Portal do Cliente` })

const { data: regras, error } = await useFetch('/api/servicos')
const regra = computed(() => regras.value?.find(r => r.id === servico.id))

const ano = ref<number | null>(null)
watch(regra, (r) => { if (r?.anos?.length && ano.value === null) ano.value = r.anos[0]! }, { immediate: true })

const enviando = ref(false)
const erro = ref('')
const enviadoPara = ref('')
const protocolo = ref('')

async function pedir() {
  if (servico!.pedeAno && !ano.value) { erro.value = 'Escolha o ano.'; return }
  erro.value = ''
  enviando.value = true
  try {
    const resposta = await $fetch(`/api/servicos/${servico!.id}`, { method: 'POST', body: { ano: ano.value ?? undefined } })
    enviadoPara.value = resposta.destino
    protocolo.value = resposta.protocolo
  } catch (e) {
    erro.value = mensagemDeErro(e)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main v-if="servico" class="flex flex-col gap-[22px] px-5 pt-6 pb-7 md:px-8 lg:gap-7 lg:px-10 lg:pt-10">
    <BotaoVoltar to="/servicos" rotulo="Serviços" />

    <div class="flex flex-col gap-[22px] lg:mx-auto lg:w-full lg:max-w-[680px]">
      <div class="flex items-center gap-4">
        <span class="flex size-16 shrink-0 items-center justify-center rounded-[20px]" :class="servico.cor">
          <Icone :nome="servico.icone" :tamanho="34" />
        </span>
        <div class="flex flex-col gap-1">
          <h1 class="m-0 font-display text-[28px] leading-[1.15] font-extrabold lg:text-[32px]">{{ servico.titulo }}</h1>
        </div>
      </div>
      <p class="m-0 text-lg text-texto">{{ servico.descricao }}</p>

      <MensagemErro v-if="error" :texto="mensagemDeErro(error, 'Não conseguimos carregar esse serviço agora.')" />

      <!-- Enviado -->
      <section v-if="enviadoPara" role="status" class="flex flex-col items-center gap-3 rounded-3xl bg-white p-7 text-center shadow-cartao">
        <span class="flex size-[76px] items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :tamanho="40" :espessura="2.6" /></span>
        <h2 class="m-0 font-display text-2xl font-extrabold">Pronto! Já está a caminho</h2>
        <p class="m-0 text-[17px] text-texto">
          Enviamos para <b class="tracking-wide text-tinta">{{ enviadoPara }}</b>. Pode levar alguns minutos. Olhe também a caixa de spam.
        </p>
        <p class="m-0 text-base text-apoio">Protocolo <b class="text-tinta">{{ protocolo }}</b>. Uma cópia fica em Meus pedidos.</p>
        <div class="mt-2 flex w-full flex-col gap-3 sm:flex-row">
          <BotaoPrincipal :to="`/pedidos/${protocolo}`">Ver em Meus pedidos</BotaoPrincipal>
          <BotaoPrincipal variante="contorno" @click="enviadoPara = ''">Pedir de novo</BotaoPrincipal>
        </div>
      </section>

      <!-- Bloqueado (ex.: quitação com conta em aberto) -->
      <section v-else-if="regra && !regra.disponivel" class="flex flex-col gap-4 rounded-3xl border-2 border-atencao-borda bg-white p-6 shadow-cartao">
        <span class="flex size-14 items-center justify-center rounded-[18px] bg-atencao-claro text-atencao"><Icone nome="alerta" :tamanho="30" :espessura="2.2" /></span>
        <div class="text-lg font-bold">Ainda não dá para emitir</div>
        <p class="m-0 text-[17px] text-texto">{{ regra.motivo }} Assim que o pagamento for confirmado, o serviço fica liberado.</p>
        <BotaoPrincipal :to="regra.faturaId ? `/contas/${regra.faturaId}` : '/contas'">
          Pagar agora
          <Icone nome="seta" :tamanho="22" :espessura="2.4" />
        </BotaoPrincipal>
      </section>

      <!-- Pedido -->
      <form v-else-if="regra" class="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-cartao lg:p-8" novalidate @submit.prevent="pedir">
        <fieldset v-if="servico.pedeAno && regra.anos?.length" class="m-0 flex flex-col gap-3 border-0 p-0">
          <legend class="mb-3 text-[17px] font-bold">{{ servico.rotuloAno }}</legend>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label
              v-for="a in regra.anos" :key="a"
              class="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl border-2 font-display text-[22px] font-extrabold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-roxo"
              :class="ano === a ? 'border-roxo bg-roxo text-white' : 'border-[#e3e4ed] bg-white text-tinta'"
            >
              <input v-model="ano" type="radio" name="ano" :value="a" class="sr-only">
              {{ a }}
            </label>
          </div>
        </fieldset>

        <div class="flex items-start gap-3 rounded-[18px] bg-roxo-fundo px-4 py-3.5">
          <Icone nome="email" :espessura="2" class="mt-0.5 text-roxo-icone" />
          <span class="text-base">O documento vai para o <b>e-mail do seu cadastro</b>, em PDF.</span>
        </div>

        <MensagemErro :texto="erro" />

        <BotaoPrincipal tipo="submit" :carregando="enviando">
          <Icone v-if="!enviando" nome="email" :tamanho="22" />
          {{ enviando ? 'Enviando…' : 'Enviar para o meu e-mail' }}
        </BotaoPrincipal>
      </form>
    </div>
  </main>
</template>
