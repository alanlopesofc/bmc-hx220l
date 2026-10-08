// Sequência de frames para scrubbing sem manter centenas de imagens decodificadas.
// Os WebPs ficam como Blob (compactados) e só a janela necessária é decodificada.

export class FrameStore {
  constructor({ count, path, step = 1, concurrency = 6, maxDecoded = 90, onProgress }) {
    this.count = count;
    this.path = path;
    this.step = step; // mobile carrega 1 a cada 2 frames (metade da memória)
    this.concurrency = concurrency;
    this.onProgress = onProgress;
    this.maxDecoded = maxDecoded;
    this.blobs = new Array(count).fill(null);
    this.decoded = new Map();
    this.pending = new Map();
    this.loaded = 0;
    this.total = Math.ceil(count / step);
    this.aborted = false;
    this.lastIndex = 0;
    this.direction = 1;
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
      fetch(this.url(i))
        .then((response) => {
          if (!response.ok) throw new Error(`Frame ${response.status}`);
          return response.blob();
        })
        .then((blob) => {
          if (this.aborted) return;
          this.blobs[i] = blob;
          this.loaded++;
          this.onProgress?.(this.loaded / this.total);
          return this.#ensureDecoded(i).then(() => { if (i === 0) firstResolve(); });
        })
        .catch(() => { if (i === 0) firstResolve(); })
        .finally(next);
    };
    for (let c = 0; c < this.concurrency; c++) next();
    return first;
  }

  #touch(i, image) {
    this.decoded.delete(i);
    this.decoded.set(i, image);
    while (this.decoded.size > this.maxDecoded) {
      const [oldIndex, oldImage] = this.decoded.entries().next().value;
      this.decoded.delete(oldIndex);
      if (typeof oldImage?.close === 'function') oldImage.close();
      else if (oldImage) oldImage.src = '';
    }
  }

  #decodeBlob(blob) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(blob);
    }
    const image = new Image();
    image.decoding = 'async';
    const objectUrl = URL.createObjectURL(blob);
    image.src = objectUrl;
    return image.decode().then(() => {
      URL.revokeObjectURL(objectUrl);
      return image;
    }, (error) => {
      URL.revokeObjectURL(objectUrl);
      throw error;
    });
  }

  #ensureDecoded(i) {
    if (this.decoded.has(i)) {
      const image = this.decoded.get(i);
      this.#touch(i, image);
      return Promise.resolve(image);
    }
    if (!this.blobs[i]) return Promise.resolve(null);
    if (!this.pending.has(i)) {
      const promise = this.#decodeBlob(this.blobs[i]).then((image) => {
        this.pending.delete(i);
        if (this.aborted) {
          if (typeof image?.close === 'function') image.close();
          else if (image) image.src = '';
          return null;
        }
        this.#touch(i, image);
        return image;
      }).catch(() => { this.pending.delete(i); return null; });
      this.pending.set(i, promise);
    }
    return this.pending.get(i);
  }

  #scheduleWindow(i, lo, hi) {
    const indices = [];
    for (let d = 0; d <= 12; d++) {
      const forward = i + d * this.direction;
      const backward = i - d * this.direction;
      if (forward >= lo && forward <= hi) indices.push(forward);
      if (d && backward >= lo && backward <= hi) indices.push(backward);
    }
    indices.forEach((index) => this.#ensureDecoded(index));
  }

  /**
   * Frame mais próximo já carregado. Procura primeiro dentro do plano
   * [lo, hi] para não exibir um quadro de outro plano durante o carregamento.
   */
  get(i, lo = 0, hi = this.count - 1) {
    i = Math.max(0, Math.min(this.count - 1, i));
    lo = Math.max(0, lo); hi = Math.min(this.count - 1, hi);
    this.direction = i >= this.lastIndex ? 1 : -1;
    this.lastIndex = i;
    this.#scheduleWindow(i, lo, hi);
    if (this.decoded.has(i)) return this.#touchAndGet(i);
    for (let d = 1; d < this.count; d++) {
      const p = i - d, n = i + d;
      if (p >= lo && this.decoded.has(p)) return this.#touchAndGet(p);
      if (n <= hi && this.decoded.has(n)) return this.#touchAndGet(n);
    }
    return null;
  }

  /** Frame exato, só se já estiver decodificado (não procura vizinhos). */
  peek(i) {
    return this.decoded.has(i) ? this.#touchAndGet(i) : null;
  }

  #touchAndGet(i) {
    const image = this.decoded.get(i);
    this.#touch(i, image);
    return image;
  }

  destroy() {
    this.aborted = true;
    for (const image of this.decoded.values()) {
      if (typeof image?.close === 'function') image.close();
      else if (image) image.src = '';
    }
    this.decoded.clear();
    this.pending.clear();
    this.blobs.fill(null);
  }
}
