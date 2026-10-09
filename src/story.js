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
// Copy orientada a conversão: benefício no título, ganhos em bullets e o dado
// técnico como prova. Toda afirmação vem da ficha oficial PT_HX220L-T3.
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
    title: 'Força para romper solo duro sem perder o ritmo',
    bullets: [
      'Três modos de trabalho: potência máxima no pesado, economia no leve',
      'Controle inteligente ajusta a vazão de cada bomba à tarefa',
    ],
    proof: { value: 166, decimals: 0, unit: 'HP', caption: 'potência bruta · Cummins QSB 6.7' },
  },
  {
    id: 'economia',
    rail: 'Economia',
    at: 4.55,
    until: 6.2,
    side: 'left',
    place: 'bottom', // no plano aberto, o terço inferior esquerdo é só terra
    anchor: [0.66, 0.42], // cabine: é onde fica o medidor ECO
    title: 'Mais terra movida por litro de diesel',
    bullets: ['Medidor ECO mostra na cabine o consumo por hora e por dia'],
    proof: { value: 12, decimals: 0, unit: '%', caption: 'mais eficiência diária de combustível que a geração Robex' },
  },
  {
    id: 'carga',
    rail: 'Carga',
    at: 6.3,
    until: 7.55,
    side: 'right',
    anchor: [0.36, 0.38],
    title: 'Caçamba cheia a cada ciclo',
    bullets: [
      'Caçamba dimensionada para o seu material',
      'Novo material na caçamba, mais resistente ao desgaste',
    ],
    proof: { range: [0.92, 1.46], decimals: 2, unit: 'm³', caption: 'opções de capacidade da caçamba' },
  },
  {
    id: 'descarga',
    rail: 'Carregamento',
    at: 7.65,
    until: 9.6,
    side: 'left',
    anchor: { 4: [0.66, 0.33], 5: [0.6, 0.5] },
    title: 'Carrega o caminhão por cima da báscula',
    bullets: [
      'Giro de 11,7 rpm para ciclos curtos entre a frente e o caminhão',
      'Alcance de até 9,98 m sem reposicionar a máquina',
    ],
    proof: { value: 6780, decimals: 0, unit: 'mm', caption: 'altura máxima de descarregamento' },
  },
  {
    id: 'durabilidade',
    rail: 'Durabilidade',
    at: 9.75,
    until: 11.55,
    side: 'left',
    anchor: null,
    title: 'Feita para turno longo no trecho mais duro',
    bullets: [
      'Pinos, buchas e calços de polímero reforçados: menos folga, mais vida útil',
      'Mangueiras de alta pressão e resfriamento reforçado contra o calor',
      'Placa antidesgaste na junção do braço com a caçamba',
    ],
  },
  {
    id: 'operacao',
    rail: 'Operação',
    at: 11.7,
    until: 13.1,
    side: 'right',
    anchor: [0.18, 0.4],
    title: 'Estabilidade na frente de serviço, conforto na cabine',
    bullets: [
      'Cabine 13% mais espaçosa, com suspensão que reduz ruído e vibração',
      'Telemetria Hi MATE (opcional): horas, consumo e localização no celular',
    ],
    proof: { value: 22720, decimals: 0, unit: 'kg', caption: 'peso operacional · contrapeso de 3.800 kg' },
  },
];

export const OUTRO_AT = 13.3;

/* ------------------------------------------------------------------ *
 * Celular em pé: vídeo próprio, já vertical (omni-v1 · 720×1280 · 24 fps · 10 s,
 * em media-src/hx220l-mobile-720x1280.mp4). Tomada contínua, sem cortes, de um
 * ciclo completo de carga. Eventos medidos numa contact sheet a 4 fps:
 *   0–1,6 s descarrega no caminhão · 1,6–3,0 gira até a frente · 3,0–4,4 escava
 *   4,5–5,8 enche e ergue a caçamba · 5,9–7,3 gira carregada · 7,4–9,0 descarrega
 * Mesma copy do desktop, reordenada para acompanhar a ação deste vídeo.
 * ------------------------------------------------------------------ */
const MOBILE_TIMING = [
  ['economia', 1.7, 2.95],
  ['potencia', 3.05, 4.4],
  ['carga', 4.5, 5.8],
  ['durabilidade', 5.9, 7.3],
  ['descarga', 7.4, 8.9],
  ['operacao', 9.0, 9.95],
];

const MOBILE = {
  key: 'mobile',
  frames: 'frames/m/',
  video: { duration: 10, fps: 12, frames: 120, width: 640, height: 1138 },
  shots: [{ start: 0, end: 10.01, focus: 0.5, name: 'Ciclo de carga contínuo' }],
  chapters: MOBILE_TIMING.map(([id, at, until]) => ({
    ...CHAPTERS.find((c) => c.id === id), at, until, anchor: null,
  })),
  outroAt: 10,
  endHold: 2.6,
  scroll: 0.62, // telas de rolagem por segundo de timeline
};

const DESKTOP = {
  key: 'desktop',
  frames: 'frames/d/',
  video: VIDEO,
  shots: SHOTS,
  chapters: CHAPTERS,
  outroAt: OUTRO_AT,
  endHold: 2.2,
  scroll: 0.46,
};

/** Roteiro escolhido no carregamento: tela em pé usa o vídeo vertical. */
export function pickStory() {
  return window.innerWidth / window.innerHeight < 0.9 ? MOBILE : DESKTOP;
}

export function shotAt(shots, time) {
  for (let i = shots.length - 1; i >= 0; i--) if (time >= shots[i].start) return i;
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
