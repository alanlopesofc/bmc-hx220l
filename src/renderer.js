// Renderização do vídeo em canvas. WebGL (Three.js) quando disponível para
// grade cinematográfica, profundidade (push-in por plano + parallax do cursor)
// e transição óptica nos cortes. Fallback 2D sem WebGL.
import {
  WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, Mesh, ShaderMaterial,
  Texture, Vector2, Color, NoColorSpace, LinearFilter,
} from 'three';

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform sampler2D uTex2;
  uniform float uMix;
  uniform vec2 uRes;
  uniform vec2 uTexSize;
  uniform vec2 uParallax;
  uniform float uFocus;
  uniform float uZoom;
  uniform float uCut;
  uniform float uTime;
  uniform float uFade;
  uniform float uFlip;
  uniform vec3 uTint;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  vec2 coverUv(vec2 frag) {
    float s = max(uRes.x / uTexSize.x, uRes.y / uTexSize.y) * uZoom;
    vec2 size = uTexSize * s;
    float ox = clamp(uRes.x * 0.5 - uFocus * size.x, uRes.x - size.x, 0.0);
    float oy = (uRes.y - size.y) * 0.5;
    return (frag - vec2(ox, oy)) / size;
  }

  void main() {
    vec2 frag = vUv * uRes;
    vec2 uv = coverUv(frag) + uParallax;
    // ImageBitmap não respeita UNPACK_FLIP_Y no WebGL: a inversão vertical é feita aqui.
    uv.y = mix(uv.y, 1.0 - uv.y, uFlip);
    vec2 dir = uv - 0.5;
    float ca = uCut * 0.012 + 0.0008;
    vec3 col;
    col.r = texture2D(uTex, uv + dir * ca).r;
    col.g = texture2D(uTex, uv).g;
    col.b = texture2D(uTex, uv - dir * ca).b;
    if (uMix > 0.0) {
      vec3 col2;
      col2.r = texture2D(uTex2, uv + dir * ca).r;
      col2.g = texture2D(uTex2, uv).g;
      col2.b = texture2D(uTex2, uv - dir * ca).b;
      col = mix(col, col2, uMix);
    }

    // Exposição no corte: leve "flash" que decai, como uma lente reagindo.
    col += uCut * 0.06;

    // Vinheta e grão para unificar os planos.
    float vig = smoothstep(1.15, 0.35, length((vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0)));
    col *= mix(0.72, 1.0, vig);
    col += (hash(frag + fract(uTime) * 100.0) - 0.5) * 0.035;

    // Fechamento: o quadro se funde ao azul da marca.
    col = mix(col, uTint, uFade);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

export function createRenderer(canvas, { tint, forceCanvas = false, onContextLost }) {
  return !forceCanvas && webglAvailable() ? new GLRenderer(canvas, tint, onContextLost) : new CanvasRenderer(canvas, tint);
}

function makeTexture() {
  const t = new Texture();
  // Sem conversão de cor: o shader trabalha direto nos valores sRGB do frame.
  t.colorSpace = NoColorSpace;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

function setImage(texture, img) {
  if (!img || texture.image === img) return;
  texture.image = img;
  texture.flipY = typeof img.close !== 'function';
  texture.needsUpdate = true;
}

class GLRenderer {
  constructor(canvas, tint, onContextLost) {
    this.kind = 'webgl';
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.texture = makeTexture();
    this.texture2 = makeTexture();
    this.uniforms = {
      uTex: { value: this.texture },
      uTex2: { value: this.texture2 },
      uMix: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
      uTexSize: { value: new Vector2(16, 9) },
      uParallax: { value: new Vector2() },
      uFocus: { value: 0.5 },
      uZoom: { value: 1.04 },
      uCut: { value: 0 },
      uTime: { value: 0 },
      uFade: { value: 0 },
      uFlip: { value: 0 },
      uTint: { value: new Color(tint) },
    };
    this.material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: this.uniforms, depthTest: false });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.scene.add(this.mesh);
    this.lost = false;
    this.onLost = (e) => {
      e.preventDefault();
      this.lost = true;
      onContextLost?.();
    };
    canvas.addEventListener('webglcontextlost', this.onLost);
  }

  resize(w, h, dpr) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.uniforms.uRes.value.set(w * dpr, h * dpr);
  }

  /** `next`/`mix`: quadro seguinte e quanto dele aparece (crossfade). */
  draw(img, s, next = null, mix = 0) {
    if (this.lost || !img) return;
    const u = this.uniforms;
    setImage(this.texture, img);
    u.uFlip.value = typeof img.close === 'function' ? 1 : 0;
    u.uTexSize.value.set(img.width || img.naturalWidth, img.height || img.naturalHeight);
    if (next && mix > 0) setImage(this.texture2, next);
    u.uMix.value = next ? mix : 0;
    u.uFocus.value = s.focus;
    u.uZoom.value = s.zoom;
    u.uCut.value = s.cut;
    u.uTime.value = s.time;
    u.uFade.value = s.fade;
    u.uParallax.value.set(s.px, s.py);
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.texture.dispose();
    this.texture2.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.renderer.dispose();
  }
}

class CanvasRenderer {
  constructor(canvas, tint) {
    this.kind = '2d';
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.tint = tint;
  }

  resize(w, h, dpr) {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  draw(img, s, next = null, mix = 0) {
    const { ctx, canvas } = this;
    if (!img) return;
    const W = canvas.width, H = canvas.height;
    const iw = img.width || img.naturalWidth;
    const ih = img.height || img.naturalHeight;
    const scale = Math.max(W / iw, H / ih) * s.zoom;
    const dw = iw * scale, dh = ih * scale;
    const dx = Math.min(0, Math.max(W - dw, W / 2 - s.focus * dw)) - s.px * dw;
    const dy = (H - dh) / 2 + s.py * dh;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, dx, dy, dw, dh);
    if (next && mix > 0) {
      ctx.globalAlpha = mix;
      ctx.drawImage(next, dx, dy, dw, dh);
      ctx.globalAlpha = 1;
    }
    if (s.fade > 0) {
      ctx.globalAlpha = s.fade;
      ctx.fillStyle = this.tint;
      ctx.fillRect(0, 0, W, H);
    }
  }

  destroy() {}
}
