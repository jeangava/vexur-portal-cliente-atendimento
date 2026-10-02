<script setup lang="ts">
type Forma = { tag: 'path' | 'rect' | 'circle', attrs: Record<string, string | number> }

const props = withDefaults(defineProps<{ nome: string, tamanho?: number, espessura?: number }>(), {
  tamanho: 24,
  espessura: 2,
})

const p = (d: string): Forma => ({ tag: 'path', attrs: { d } })
const ICONES = {
  escudo: [p('M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z'), p('M8.5 12l2.5 2.5 4.5-5')],
  casa: [p('M3 10.5 12 3l9 7.5'), p('M5 9.5V21h14V9.5'), p('M10 21v-6h4v6')],
  conta: [p('M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z'), p('M9 8h6M9 12h6')],
  carteirinha: [
    { tag: 'rect', attrs: { x: 2.5, y: 5, width: 19, height: 14, rx: 2.5 } },
    { tag: 'circle', attrs: { cx: 8.5, cy: 11, r: 2.2 } },
    p('M5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4'), p('M14 10h4.5M14 13.5h3'),
  ],
  documento: [p('M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z'), p('M14 3v5h5'), p('M8.5 13h7M8.5 16.5h5')],
  familia: [
    { tag: 'circle', attrs: { cx: 9, cy: 8, r: 3.5 } }, p('M2.5 20c.8-3.4 3.3-5.5 6.5-5.5s5.7 2.1 6.5 5.5'),
    { tag: 'circle', attrs: { cx: 17, cy: 9, r: 2.6 } }, p('M16.5 14.6c2.4.2 4.2 2 4.9 5.4'),
  ],
  conversa: [p('M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z')],
  mensagem: [p('M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z'), p('M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01')],
  telefone: [p('M5 4h3.5l1.8 4.5-2.3 1.5a11 11 0 0 0 6 6l1.5-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4z')],
  duvida: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 9 } }, p('M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01')],
  celular: [{ tag: 'rect', attrs: { x: 6.5, y: 2.5, width: 11, height: 19, rx: 2.5 } }, p('M10.5 18.5h3'), p('M9.5 8.5h5M9.5 11.5h3.5')],
  voltar: [p('M15 5l-7 7 7 7')],
  avancar: [p('M9 5l7 7-7 7')],
  seta: [p('M5 12h14M13 6l6 6-6 6')],
  abrir: [p('M6 9l6 6 6-6')],
  copiar: [{ tag: 'rect', attrs: { x: 8.5, y: 8.5, width: 12, height: 12, rx: 2 } }, p('M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5')],
  certo: [p('M5 12.5l4.5 4.5L19 7.5')],
  pix: [
    { tag: 'rect', attrs: { x: 3.5, y: 3.5, width: 6.5, height: 6.5, rx: 1 } },
    { tag: 'rect', attrs: { x: 14, y: 3.5, width: 6.5, height: 6.5, rx: 1 } },
    { tag: 'rect', attrs: { x: 3.5, y: 14, width: 6.5, height: 6.5, rx: 1 } },
    p('M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5'),
  ],
  boleto: [p('M4 5v14M7 5v14M10.5 5v14M13 5v14M16.5 5v14M20 5v14')],
  alerta: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 9 } }, p('M12 7.5v5.5M12 16.5v.01')],
  info: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 9 } }, p('M12 11v5.5M12 7.5v.01')],
  relogio: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 9 } }, p('M12 7v5l3.5 2')],
  baixar: [p('M12 4v11M7 10.5l5 5 5-5'), p('M4.5 19.5h15')],
  sair: [p('M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14'), p('M10 16.5 5.5 12 10 7.5M5.5 12H15')],
  email: [{ tag: 'rect', attrs: { x: 3, y: 5, width: 18, height: 14, rx: 2.5 } }, p('M3.5 7l8.5 6 8.5-6')],
  cadeado: [{ tag: 'rect', attrs: { x: 4.5, y: 10.5, width: 15, height: 10, rx: 2.5 } }, p('M8 10.5V7.5a4 4 0 0 1 8 0v3'), p('M12 14.5v2')],
  olho: [p('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'), { tag: 'circle', attrs: { cx: 12, cy: 12, r: 3 } }],
  'olho-fechado': [p('M3 3l18 18'), p('M10.6 5.6A9.7 9.7 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3.1 3.9M6.5 7.4A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4.2-1'), p('M9.9 9.9a3 3 0 0 0 4.2 4.2')],
  chave: [{ tag: 'circle', attrs: { cx: 8, cy: 15, r: 4 } }, p('M11 12l9-9M16.5 6.5l2.5 2.5M14 9l2 2')],
  sino: [p('M6 9.5a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4s2-1.5 2-6.5'), p('M10 19.5a2.2 2.2 0 0 0 4 0')],
  carta: [{ tag: 'rect', attrs: { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 } }, p('M7 9h10M7 12.5h10M7 16h6')],
  fechar: [p('M6 6l12 12M18 6 6 18')],
  imprimir: [p('M7 8V3.5h10V8'), { tag: 'rect', attrs: { x: 3.5, y: 8, width: 17, height: 8.5, rx: 2 } }, p('M7 13.5h10v7H7z'), p('M16.5 11h.01')],
  lista: [p('M9 6.5h11M9 12h11M9 17.5h11'), p('M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01')],
  calendario: [{ tag: 'rect', attrs: { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2 } }, p('M3.5 10h17M8 3v4M16 3v4'), p('M9 15l2 2 4-4')],
  empresa: [p('M4 21V5.5A1.5 1.5 0 0 1 5.5 4h7A1.5 1.5 0 0 1 14 5.5V21'), p('M14 10h4.5a1.5 1.5 0 0 1 1.5 1.5V21'), p('M2.5 21h19'), p('M7.5 8h3M7.5 11.5h3M7.5 15h3M17 14.5h.01M17 17.5h.01')],
  trocar: [p('M4 8h13l-3.5-3.5'), p('M20 16H7l3.5 3.5')],
} satisfies Record<string, Forma[]>

const formas = computed<Forma[]>(() => (ICONES as Record<string, Forma[]>)[props.nome] ?? [])
</script>

<template>
  <svg
    :width="tamanho" :height="tamanho" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    :stroke-width="espessura" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"
    class="shrink-0"
  >
    <component :is="f.tag" v-for="(f, i) in formas" :key="i" v-bind="f.attrs" />
  </svg>
</template>
