<script setup lang="ts">
import type {
  CampoAlteravel, ContatoCadastro, DadosPessoais, DecisaoDeAlteracao, EnderecoCadastro, EnderecoDoCep, ResultadoDaAlteracao,
} from '#shared/types/portal'

/**
 * Passo a passo para alterar dados: escolher o que mudar, preencher e enviar.
 * O que aparece vem da regra "Serviços online" (quem pode e documentos); se muda na hora ou passa por aprovação vem do fluxo:
 * o portal só oferece o que a regra libera para o ator, e o servidor confere de novo ao enviar.
 * O formulário sempre abre preenchido com o que está cadastrado hoje.
 */
type PessoaParaAlterar = { id: string, nome: string, dados?: DadosPessoais }
const props = defineProps<{
  decisoes: DecisaoDeAlteracao[]
  alvo: 'contrato' | 'empresa'
  contratoAlvo?: string
  /** O que está cadastrado hoje: o formulário abre preenchido com isso, e a pessoa só muda o que precisa */
  atual?: { contatos: ContatoCadastro[], enderecos: EnderecoCadastro[] }
  /** Pessoas do grupo familiar (para alterar dados cadastrais de cada uma) */
  pessoas?: PessoaParaAlterar[]
}>()
const emit = defineEmits<{ fechar: [], concluido: [] }>()

type Etapa = 'escolher' | 'pessoa' | 'form' | 'resultado'
const etapa = ref<Etapa>('escolher')
const campo = ref<CampoAlteravel | ''>('')
const pessoaId = ref('')
const valores = reactive<Record<string, string>>({})
const erro = ref('')
const enviando = ref(false)
const resultado = ref<ResultadoDaAlteracao | null>(null)

const liberadas = computed(() => ALTERACOES_POSSIVEIS.flatMap((a) => {
  const decisao = props.decisoes.find(d => d.campo === a.id && d.disponivel)
  // Dados cadastrais são de uma pessoa do grupo: só faz sentido onde há pessoas.
  if (!decisao || (a.id === 'dados' && !props.pessoas?.length)) return []
  return [{ ...a, decisao }]
}))
const escolhida = computed(() => liberadas.value.find(a => a.id === campo.value))
const pessoa = computed(() => props.pessoas?.find(p => p.id === pessoaId.value))

// ---- valores de hoje, no formato do formulário
function valoresAtuais(id: CampoAlteravel): Record<string, string> {
  if (id === 'endereco') return { ...(props.atual?.enderecos[0]?.campos ?? {}) }
  if (id === 'dados') {
    const d = pessoa.value?.dados ?? {}
    return {
      nome: pessoa.value?.nome ?? '', nascimento: d.nascimento ?? '', sexo: d.sexo ?? '', estadoCivil: d.estadoCivil ?? '',
      nomeMae: d.nomeMae ?? '', cartaoSus: d.cartaoSus ?? '',
    }
  }
  return { [id]: props.atual?.contatos.find(c => c.tipo === id)?.valor ?? '' }
}

// Documentos que a regra pede: um campo de anexo para cada um, preenchido NA HORA do pedido.
const anexos = reactive<Record<string, { id: string, nome: string }[]>>({})
function arquivosDe(doc: string) {
  if (!anexos[doc]) anexos[doc] = []
  return anexos[doc]!
}
const faltamDocumentos = computed(() => (escolhida.value?.decisao.documentos ?? []).some(d => !(anexos[d]?.length)))

const inicial = ref('')
function abrirFormulario(id: CampoAlteravel) {
  for (const k of Object.keys(anexos)) delete anexos[k]
  campo.value = id
  // Um campo de anexo (lista vazia) para cada documento que a regra exige.
  for (const d of liberadas.value.find(a => a.id === id)?.decisao.documentos ?? []) anexos[d] = []
  erro.value = ''
  for (const k of Object.keys(valores)) delete valores[k]
  Object.assign(valores, valoresAtuais(id))
  inicial.value = JSON.stringify(valoresDaAlteracao(id, valores))
  travados.value = {}
  erroCep.value = ''
  ultimoCep = ''
  etapa.value = 'form'
  if (id === 'endereco' && valores.cep) void buscarCep(valores.cep, false)
}

function escolher(id: CampoAlteravel) {
  if (id === 'dados') {
    // Uma pessoa só: já vai direto. Várias: pergunta de quem são os dados.
    if ((props.pessoas?.length ?? 0) > 1) { campo.value = id; pessoaId.value = ''; etapa.value = 'pessoa'; return }
    pessoaId.value = props.pessoas?.[0]?.id ?? ''
  }
  abrirFormulario(id)
}

function escolherPessoa(id: string) {
  pessoaId.value = id
  abrirFormulario('dados')
}

/** Opções do campo de seleção; o valor que já está cadastrado entra mesmo fora da lista. */
function opcoesDe(c: { opcoes?: string[], id: string }): string[] {
  const atual = valores[c.id]
  return [...(c.opcoes ?? []), ...(atual && !(c.opcoes ?? []).includes(atual) ? [atual] : [])]
}

// ---- CEP: rua, bairro, cidade e estado vêm do CEP; só número e complemento ficam livres
const travados = ref<Record<string, boolean>>({})
const erroCep = ref('')
const buscandoCep = ref(false)
let ultimoCep = ''

async function buscarCep(cep: string, preencher: boolean) {
  const numeros = cep.replace(/\D/g, '')
  if (numeros.length !== 8 || numeros === ultimoCep) return
  ultimoCep = numeros
  buscandoCep.value = true
  erroCep.value = ''
  try {
    const url: string = '/api/cep/' + numeros
    const e = await $fetch<EnderecoDoCep>(url)
    const oficial: Record<string, string> = { logradouro: e.logradouro, bairro: e.bairro, municipio: e.municipio, uf: e.uf }
    for (const [k, v] of Object.entries(oficial)) {
      if (!v) { travados.value[k] = false; continue }
      travados.value[k] = true
      if (preencher || !valores[k]) valores[k] = v
    }
  } catch (e) {
    ultimoCep = ''
    travados.value = {}
    const status = (e as { statusCode?: number }).statusCode
    erroCep.value = status === 404 ? 'Não encontramos esse CEP. Confira os números.' : 'Não conseguimos buscar o CEP agora. Tente de novo em instantes.'
  } finally {
    buscandoCep.value = false
  }
}

function aoDigitar(c: { tipo: string, id: string }, e: Event) {
  if (c.tipo === 'sus') valores[c.id] = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 15)
  if (c.tipo !== 'cep') return
  const n = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 8)
  valores[c.id] = n.length > 5 ? n.slice(0, 5) + '-' + n.slice(5) : n
  if (n.length === 8) {
    // CEP novo: troca rua, bairro, cidade e estado pelos do CEP.
    void buscarCep(n, true)
  } else {
    ultimoCep = ''
    travados.value = {}
    erroCep.value = ''
  }
}

const somenteLeitura = (id: string) => campo.value === 'endereco' && !!travados.value[id]

async function enviar() {
  if (!campo.value) return
  erro.value = problemaNaAlteracao(campo.value, valores) ?? ''
  if (!erro.value && campo.value === 'endereco' && (erroCep.value || buscandoCep.value)) erro.value = erroCep.value || 'Aguarde a busca do CEP.'
  if (erro.value) return
  if (faltamDocumentos.value) { erro.value = 'Anexe todos os documentos pedidos para enviar.'; return }
  if (JSON.stringify(valoresDaAlteracao(campo.value, valores)) === inicial.value) {
    erro.value = 'Você ainda não mudou nada. Altere o dado ou volte.'
    return
  }
  enviando.value = true
  try {
    const url: string = '/api/cadastro/alteracao'
    resultado.value = await $fetch<ResultadoDaAlteracao>(url, {
      method: 'POST',
      body: {
        campo: campo.value, valores: { ...valores }, contrato: props.contratoAlvo, pessoa: campo.value === 'dados' ? pessoaId.value : undefined,
        anexos: (escolhida.value?.decisao.documentos ?? []).map(documento => ({ documento, ids: arquivosDe(documento).map(a => a.id) })),
      },
    })
    etapa.value = 'resultado'
    if (resultado.value.imediata) emit('concluido')
  } catch (e) {
    erro.value = mensagemDeErro(e)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- O que alterar -->
    <template v-if="etapa === 'escolher'">
      <p v-if="liberadas.length" class="m-0 text-lg text-texto">{{ alvo === 'empresa' ? 'O que você quer alterar na empresa?' : 'O que você quer alterar?' }}</p>
      <p v-else class="m-0 rounded-[18px] bg-fundo p-4 text-lg text-texto">Nenhuma alteração está liberada para o seu plano por aqui. Fale com a gente.</p>
      <button
        v-for="a in liberadas" :key="a.id" type="button"
        class="flex min-h-[76px] items-center justify-between gap-3 rounded-[20px] border-2 border-campo bg-white px-4 py-3 text-left transition-colors hover:border-roxo"
        @click="escolher(a.id)"
      >
        <span class="flex flex-col gap-0.5">
          <span class="text-[18px] font-bold">{{ a.rotulo }}</span>
          <span class="text-[15px] text-apoio">{{ a.descricao }}</span>
          <span
            class="mt-1 self-start rounded-full px-2.5 py-0.5 text-sm font-bold"
            :class="a.decisao.atendimento === 'imediato' ? 'bg-ok-claro text-ok' : 'bg-atencao-claro text-atencao'"
          >{{ a.decisao.atendimento === 'imediato' ? 'Muda na hora' : 'Precisa de aprovação' }}</span>
        </span>
        <Icone nome="avancar" :tamanho="22" :espessura="2.4" class="shrink-0 text-roxo-icone" />
      </button>
      <BotaoPrincipal variante="contorno" @click="emit('fechar')">Voltar</BotaoPrincipal>
    </template>

    <!-- De quem são os dados -->
    <template v-else-if="etapa === 'pessoa'">
      <p class="m-0 text-lg text-texto">De quem são os dados?</p>
      <button
        v-for="p in pessoas" :key="p.id" type="button"
        class="flex min-h-[64px] items-center justify-between gap-3 rounded-[20px] border-2 border-campo bg-white px-4 py-3 text-left transition-colors hover:border-roxo"
        @click="escolherPessoa(p.id)"
      >
        <span class="text-[18px] font-bold">{{ p.nome }}</span>
        <Icone nome="avancar" :tamanho="22" :espessura="2.4" class="shrink-0 text-roxo-icone" />
      </button>
      <BotaoPrincipal variante="contorno" @click="etapa = 'escolher'">Voltar</BotaoPrincipal>
    </template>

    <!-- Formulário -->
    <form v-else-if="etapa === 'form' && escolhida" class="flex flex-col gap-4" novalidate @submit.prevent="enviar">
      <p class="m-0 text-lg font-bold">{{ escolhida.rotulo }}<template v-if="campo === 'dados' && pessoa"> · {{ pessoa.nome }}</template></p>
      <div v-for="c in escolhida.campos" :key="c.id" class="flex flex-col gap-1.5">
        <label :for="'alt-' + c.id" class="text-[17px] font-bold">
          {{ c.rotulo }}
          <span v-if="c.dica" class="font-normal text-apoio">({{ c.dica }})</span>
          <span v-if="somenteLeitura(c.id)" class="font-normal text-apoio">(vem do CEP)</span>
        </label>
        <select
          v-if="c.tipo === 'selecao'" :id="'alt-' + c.id" v-model="valores[c.id]"
          class="h-14 rounded-2xl border-2 border-campo bg-white px-4 text-lg text-tinta focus:border-roxo"
        >
          <option v-if="!c.obrigatorio" value="">Não informar</option>
          <option v-for="o in opcoesDe(c)" :key="o" :value="o">{{ o }}</option>
        </select>
        <input
          v-else
          :id="'alt-' + c.id" v-model="valores[c.id]"
          :type="c.tipo === 'email' ? 'email' : c.tipo === 'telefone' ? 'tel' : c.tipo === 'data' ? 'date' : 'text'"
          :inputmode="c.tipo === 'telefone' || c.tipo === 'cep' || c.tipo === 'sus' ? 'numeric' : undefined"
          :maxlength="c.tipo === 'data' ? undefined : c.maximo" autocomplete="off"
          :readonly="somenteLeitura(c.id)"
          class="h-14 rounded-2xl border-2 px-4 text-lg text-tinta focus:border-roxo"
          :class="somenteLeitura(c.id) ? 'border-linha bg-fundo text-texto' : (c.tipo === 'cep' && erroCep ? 'border-erro bg-white' : 'border-campo bg-white')"
          @input="aoDigitar(c, $event)"
        >
        <span v-if="c.tipo === 'cep' && buscandoCep" class="text-sm text-apoio" role="status">Buscando o endereço…</span>
        <MensagemErro v-if="c.tipo === 'cep'" :texto="erroCep" />
      </div>

      <div
        v-if="escolhida.decisao.atendimento === 'imediato'"
        class="flex items-start gap-3 rounded-[18px] border-2 border-roxo-borda bg-roxo-fundo px-4 py-3.5" role="note"
      >
        <Icone nome="info" :espessura="2.2" class="mt-0.5 shrink-0 text-roxo-icone" />
        <span class="text-base">Essa alteração é feita <b>na hora</b>. Fica registrada em Meus pedidos.</span>
      </div>
      <div v-else class="flex items-start gap-3 rounded-[18px] border-2 border-atencao-borda bg-atencao-claro px-4 py-3.5" role="note">
        <Icone nome="alerta" :espessura="2.2" class="mt-0.5 shrink-0 text-atencao" />
        <span class="text-base text-atencao"><b>Atenção:</b> esse pedido será avaliado pela administradora. O dado só será alterado quando houver a aprovação. Você acompanha em Meus pedidos.</span>
      </div>
      <section v-for="doc in escolhida.decisao.documentos" :key="doc" class="flex flex-col gap-2.5 rounded-[22px] bg-fundo p-4">
        <h3 class="m-0 text-[17px] font-bold">Documento: {{ doc }} <span class="font-normal text-erro">(obrigatório)</span></h3>
        <EnvioDocumentos v-model="anexos[doc]!" :rotulo="'Anexar ' + doc.toLowerCase()" />
      </section>
      <p v-if="faltamDocumentos" class="m-0 text-base text-apoio">O botão de enviar libera depois que você anexar {{ escolhida.decisao.documentos.length > 1 ? 'todos os documentos' : 'o documento' }}.</p>
      <p v-if="escolhida.decisao.mensagem" class="m-0 text-base text-texto">{{ escolhida.decisao.mensagem }}</p>

      <MensagemErro :texto="erro" />
      <BotaoPrincipal tipo="submit" :carregando="enviando" :desabilitado="faltamDocumentos">
        {{ enviando ? 'Enviando…' : escolhida.decisao.atendimento === 'imediato' ? 'Alterar agora' : 'Enviar para aprovação' }}
      </BotaoPrincipal>
      <BotaoPrincipal variante="contorno" @click="etapa = campo === 'dados' && (pessoas?.length ?? 0) > 1 ? 'pessoa' : 'escolher'">Voltar</BotaoPrincipal>
    </form>

    <!-- Resultado -->
    <div v-else-if="etapa === 'resultado' && resultado" role="status" class="flex flex-col items-center gap-3 text-center">
      <span class="flex size-[76px] items-center justify-center rounded-full bg-ok-claro text-ok"><Icone nome="certo" :tamanho="40" :espessura="2.6" /></span>
      <template v-if="resultado.imediata">
        <h3 class="m-0 font-display text-2xl font-extrabold">Alteração realizada com sucesso!</h3>
        <p class="m-0 text-[17px] text-texto">O dado já está atualizado.</p>
      </template>
      <template v-else>
        <h3 class="m-0 font-display text-2xl font-extrabold">Pedido enviado!</h3>
        <p class="m-0 text-[17px] text-texto">A administradora vai avaliar. <b>O dado só muda depois da aprovação.</b></p>
      </template>
      <p class="m-0 text-base text-apoio">Protocolo <b class="text-tinta">{{ resultado.pedido.protocolo }}</b></p>
      <div class="flex w-full flex-col gap-3 sm:flex-row">
        <BotaoPrincipal :to="'/pedidos/' + resultado.pedido.protocolo">Ver em Meus pedidos</BotaoPrincipal>
        <BotaoPrincipal variante="contorno" @click="emit('fechar')">Fechar</BotaoPrincipal>
      </div>
    </div>
  </div>
</template>
