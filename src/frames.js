// Sequência de frames para scrubbing: evita seek em MP4 comprimido.
// Carrega em passes progressivos (1 a cada 16, depois 8, 4, 2, 1), assim
// qualquer posição do scroll tem um frame próximo disponível desde o início.

export class FrameStore {
  constructor({ count, path, step = 1, concurrency = 6, onProgress }) {
    this.count = count;
    this.path = path;
    this.step = step; // mobile carrega 1 a cada 2 frames (metade da memória)
    this.concurrency = concurrency;
    this.onProgress = onProgress;
    this.images = new Array(count).fill(null);
    this.loaded = 0;
    this.total = Math.ceil(count / step);
    this.aborted = false;
    this.queue = this.#buildQueue();
  }

  #buildQueue() {
    const seen = new Set();
    const order = [];
    for (const stride of [16, 8, 4, 2, 1]) {
      const s = Math.max(stride, this.step);
      for (let i = 0; i < this.count; i += s) {
        if (!seen.has(i)) { seen.add(i); order.push(i); }
      }
    }
    if (!seen.has(this.count - 1)) order.push(this.count - 1);
    return order;
  }

  url(i) {
    return `${this.path}f${String(i + 1).padStart(3, '0')}.webp`;
  }

  /** Resolve quando o primeiro frame está decodificado. */
  start() {
    let firstResolve;
    const first = new Promise((r) => (firstResolve = r));
    let cursor = 0;
    const next = () => {
      if (this.aborted || cursor >= this.queue.length) return;
      const i = this.queue[cursor++];
      const img = new Image();
      img.decoding = 'async';
      img.src = this.url(i);
      img
        .decode()
        .then(() => {
          if (this.aborted) return;
          this.images[i] = img;
          this.loaded++;
          if (i === 0) firstResolve();
          this.onProgress?.(this.loaded / this.total);
        })
        .catch(() => {})
        .finally(next);
    };
    for (let c = 0; c < this.concurrency; c++) next();
    return first;
  }

  /**
   * Frame mais próximo já carregado. Procura primeiro dentro do plano
   * [lo, hi] para não exibir um quadro de outro plano durante o carregamento.
   */
  get(i, lo = 0, hi = this.count - 1) {
    i = Math.max(0, Math.min(this.count - 1, i));
    if (this.images[i]) return this.images[i];
    for (const [a, b] of [[lo, hi], [0, this.count - 1]]) {
      for (let d = 1; d < this.count; d++) {
        const p = i - d, n = i + d;
        if (p < a && n > b) break;
        if (p >= a && this.images[p]) return this.images[p];
        if (n <= b && this.images[n]) return this.images[n];
      }
    }
    return null;
  }

  destroy() {
    this.aborted = true;
    this.images.fill(null);
  }
}
