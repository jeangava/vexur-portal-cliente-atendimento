<script setup lang="ts">
import type { CadastroDoContrato, DadosPessoais, DecisaoDeAlteracao, MinhaFamilia } from '#shared/types/portal'

/**
 * Popup com o grupo familiar inteiro (titular e dependentes) e os dados do contrato.
 * "Alterar dados" só aparece quando a regra "Serviços online" libera alguma alteração para o ator.
 */
type PessoaDoGrupo = { id: string, nome: string, parentesco: string, numeroCarteirinha: string, dados?: DadosPessoais }
const props = defineProps<{ familia?: MinhaFamilia, pessoas?: PessoaDoGrupo[], cadastro: CadastroDoContrato | null, podeAlterar: boolean, contratoAlvo?: string }>()
const aberto = defineModel<boolean>({ default: false })

const dialogo = ref<HTMLDialogElement | null>(null)
const alterando = ref(false)
const decisoes = ref<DecisaoDeAlteracao[]>([])
const temAlteracao = computed(() => props.podeAlterar && decisoes.value.some(d => d.disponivel))
const pessoas = computed<PessoaDoGrupo[]>(() => props.pessoas ?? (props.familia ? [props.familia.titular, ...props.familia.dependentes] : []))

watch(aberto, async (v) => {
  const d = dialogo.value
  if (!d) return
  if (v && !d.open) {
    alterando.value = false
    d.showModal()
    if (props.podeAlterar) {
      const url: string = '/api/cadastro/alteracoes' + (props.contratoAlvo ? '?contrato=' + encodeURIComponent(props.contratoAlvo) : '')
      decisoes.value = await $fetch<DecisaoDeAlteracao[]>(url).catch(() => [])
    }
  }
  if (!v && d.open) d.close()
})

function aoClicarFora(e: MouseEvent) {
  if (e.target === dialogo.value) aberto.value = false
}

// Alteração feita na hora: recarrega os dados da tela para mostrar o valor novo.
async function aoConcluir() {
  await refreshNuxtData()
}
</script>

<template>
  <dialog
    ref="dialogo" aria-labelledby="grupo-titulo"
    class="m-auto w-[calc(100%-24px)] max-w-[760px] rounded-[28px] border-0 bg-white p-0 text-tinta shadow-[0_30px_80px_#1d294859] backdrop:bg-tinta/55 print:hidden"
    @close="aberto = false" @click="aoClicarFora"
  >
    <div v-if="aberto" class="flex max-h-[calc(100dvh-32px)] flex-col">
      <div class="flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-8 sm:pt-7">
        <div class="flex flex-col gap-1">
          <h2 id="grupo-titulo" class="m-0 font-display text-[26px] leading-[1.2] font-extrabold">{{ alterando ? 'Alterar dados' : 'Grupo familiar' }}</h2>
          <p v-if="!alterando" class="m-0 text-base text-texto">Todos no plano e os dados do contrato.</p>
        </div>
        <button type="button" aria-label="Fechar" class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-fundo text-texto" @click="aberto = false">
          <Icone nome="fechar" :tamanho="22" :espessura="2.4" />
        </button>
      </div>

      <div class="overflow-y-auto px-5 pt-2 pb-6 sm:px-8 sm:pb-8">
        <FluxoAlteracao v-if="alterando" :decisoes="decisoes" alvo="contrato" :contrato-alvo="contratoAlvo" :atual="cadastro ?? undefined" :pessoas="pessoas" @fechar="alterando = false" @concluido="aoConcluir" />

        <div v-else class="flex flex-col gap-4">
          <article v-for="p in pessoas" :key="p.id" class="flex flex-col gap-3 rounded-[22px] bg-fundo p-4">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 class="m-0 text-[19px] font-bold">{{ p.nome }}</h3>
              <span class="text-[15px] font-semibold text-apoio">{{ p.parentesco }}</span>
            </div>
            <span v-if="p.numeroCarteirinha" class="text-[15px] text-apoio">Carteirinha <b class="text-tinta">{{ p.numeroCarteirinha }}</b></span>
            <DadosPessoaisLinha :dados="p.dados" aberto />
          </article>

          <BlocoCadastro
            v-if="cadastro" compacto
            :contatos="cadastro.contatos" :enderecos="cadastro.enderecos" :pagamento="cadastro.pagamento" :responsaveis="cadastro.responsaveis"
          />

          <BotaoPrincipal v-if="temAlteracao" @click="alterando = true">
            <Icone nome="lista" :tamanho="22" /> Alterar dados
          </BotaoPrincipal>
          <p v-else-if="podeAlterar" class="m-0 text-center text-base text-apoio">Neste plano, os dados só podem ser alterados falando com a gente.</p>
        </div>
      </div>
    </div>
  </dialog>
</template>
