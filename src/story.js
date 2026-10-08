// Mapa de eventos do vídeo (202610081844.mp4 · 1920×1080 · 30 fps · 15,45 s).
// Cortes medidos com ffmpeg scdet; conteúdo de cada plano verificado quadro a quadro.
// Dados técnicos: ficha oficial Hyundai PT_HX220L-T3.

export const VIDEO = {
  duration: 15.4,
  fps: 15, // fps da sequência de frames exportada
  frames: 232,
  width: 1344,
  height: 756,
};

// Planos do vídeo. `focus` = centro horizontal do assunto (0–1), usado no
// enquadramento em telas verticais; `push` = zoom lento dentro do plano.
export const SHOTS = [
  { start: 0.0, end: 2.113, focus: 0.47, name: 'Plano aberto: escavação' },
  { start: 2.113, end: 4.446, focus: 0.3, name: 'Close: caçamba rompendo o solo' },
  { start: 4.446, end: 6.246, focus: 0.36, name: 'Plano aberto: caçamba carregada' },
  { start: 6.246, end: 7.58, focus: 0.3, name: 'Close: caçamba cheia contra o céu' },
  { start: 7.58, end: 8.513, focus: 0.62, name: 'Plano aberto: carregando o caminhão' },
  { start: 8.513, end: 9.646, focus: 0.55, name: 'Close: material caindo na báscula' },
  { start: 9.646, end: 11.613, focus: 0.62, name: 'Contra-plongée: caçamba vazia' },
  { start: 11.613, end: 13.146, focus: 0.4, name: 'Traseira: contrapeso HX220' },
  { start: 13.146, end: 15.45, focus: 0.42, name: 'Aéreo: a máquina na escala da mina' },
];

export const CUTS = SHOTS.slice(1).map((s) => s.start);

// Capítulos que entram na timeline. `at`/`until` em segundos de vídeo.
// `anchor` = ponto da máquina no quadro original (0–1), ligado ao cartão por linha;
// pode ser um mapa { índiceDoPlano: [x, y] } quando o capítulo atravessa um corte.
export const CHAPTERS = [
  {
    id: 'potencia',
    rail: 'Potência',
    at: 2.25,
    until: 4.4,
    side: 'right',
    anchor: [0.29, 0.6],
    label: 'Potência bruta',
    value: 166,
    decimals: 0,
    unit: 'HP',
    note: 'a 2.050 rpm · motor Cummins QSB 6.7, 6 cilindros em linha',
  },
  {
    id: 'hidraulica',
    rail: 'Força',
    at: 4.55,
    until: 6.2,
    side: 'left',
    anchor: [0.31, 0.5],
    label: 'Pressão com Power Boost',
    value: 400,
    decimals: 0,
    unit: 'kgf/cm²',
    note: 'na lança, no braço e na caçamba · 350 kgf/cm² em operação normal',
  },
  {
    id: 'cacamba',
    rail: 'Carga',
    at: 6.3,
    until: 7.55,
    side: 'right',
    anchor: [0.36, 0.38],
    label: 'Capacidade da caçamba',
    range: [0.92, 1.46],
    decimals: 2,
    unit: 'm³',
    note: 'escolha conforme o material e a aplicação',
  },
  {
    id: 'descarga',
    rail: 'Descarga',
    at: 7.65,
    until: 9.6,
    side: 'left',
    anchor: { 4: [0.66, 0.33], 5: [0.6, 0.5] },
    label: 'Altura máxima de descarregamento',
    value: 6780,
    decimals: 0,
    unit: 'mm',
    note: 'com braço de 2.920 mm · alcance máximo de 9.980 mm',
  },
  {
    id: 'giro',
    rail: 'Giro',
    at: 9.75,
    until: 11.55,
    side: 'left',
    anchor: null,
    label: 'Velocidade de giro',
    value: 11.7,
    decimals: 1,
    unit: 'rpm',
    note: 'motor de giro de pistões axiais com freio automático',
  },
  {
    id: 'peso',
    rail: 'Peso',
    at: 11.7,
    until: 13.1,
    side: 'right',
    anchor: [0.18, 0.4],
    label: 'Peso operacional',
    value: 22720,
    decimals: 0,
    unit: 'kg',
    note: 'com sapata de 700 mm, braço de 2.920 mm e contrapeso de 3.800 kg',
  },
];

export const OUTRO_AT = 13.3;

export function shotAt(time) {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (time >= SHOTS[i].start) return i;
  return 0;
}

const nf = new Map();
export function formatNumber(v, decimals) {
  if (!nf.has(decimals)) {
    nf.set(decimals, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  }
  return nf.get(decimals).format(v);
}

/** Mesma conta do shader: ponto do quadro original → coordenada na tela (CSS px). */
export function projectAnchor([ax, ay], view, s) {
  const { w, h } = view;
  const scale = Math.max(w / ASPECT_W, h / ASPECT_H) * s.zoom;
  const dw = ASPECT_W * scale, dh = ASPECT_H * scale;
  const ox = Math.min(0, Math.max(w - dw, w / 2 - s.focus * dw));
  const oy = (h - dh) / 2;
  return { x: ox + (ax - s.px) * dw, y: oy + (ay + s.py) * dh };
}
const ASPECT_W = 16, ASPECT_H = 9;
