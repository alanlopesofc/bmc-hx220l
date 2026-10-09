import 'lenis/dist/lenis.css';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { pickStory, shotAt, formatNumber, projectAnchor } from './story.js';
import { FrameStore } from './frames.js';

gsap.registerPlugin(ScrollTrigger);
// No celular a barra de endereço muda a altura ao rolar; não recalcular o pin por isso.
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, r = document) => r.querySelector(s);
const NAVY_DEEP = '#0b1640'; // #14298D escurecido: base do fechamento e da seção seguinte
// Roteiro fixo por carregamento: desktop (vídeo horizontal com cortes) ou celular em pé
// (vídeo vertical contínuo). Girar o aparelho mantém o roteiro; o "cover" se ajusta.
const story = pickStory();
const { video: VIDEO, shots: SHOTS, chapters: CHAPTERS, outroAt: OUTRO_AT } = story;
const END_HOLD = story.endHold; // segundos de timeline após o fim do vídeo (fechamento + liberação do pin)
const TOTAL = VIDEO.duration + END_HOLD;
document.querySelector('[data-hero]').dataset.story = story.key;

// Com "Reduzir movimento" (ou Modo de Pouca Energia no iPhone) o vídeo continua
// seguindo o scroll, porque é o próprio usuário que o move. Só saem os efeitos extras:
// parallax do cursor, flash nos cortes, push-in e rotação 3D dos cartões.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = navigator.connection?.saveData === true;
const lightweight = window.matchMedia('(max-width: 767px)').matches || saveData;


const hero = $('[data-hero]');
const els = {
  stage: $('[data-stage]'),
  media: $('[data-media]'),
  canvas: $('[data-canvas]'),
  poster: $('[data-poster]'),
  title: $('[data-title]'),
  titleWord: $('[data-title-word]'),
  titleLines: [...document.querySelectorAll('[data-title-line]')],
  specs: $('[data-specs]'),
  lines: $('[data-lines]'),
  outro: $('[data-outro]'),
  rail: $('[data-rail]'),
  railList: $('[data-rail-list]'),
  railFill: $('[data-rail-fill]'),
  hint: $('[data-hint]'),
  loader: $('[data-loader]'),
  loaderBar: $('[data-loader-bar]'),
  header: $('[data-header]'),
};

const frameAt = (t) => Math.min(VIDEO.frames - 1, Math.max(0, Math.round(t * VIDEO.fps)));

/* ---------------------------------------------------------------- *
 * Cartões de especificação (DOM real: legíveis por leitores de tela)
 * ---------------------------------------------------------------- */
function buildCard(ch, i) {
  const el = document.createElement('article');
  el.className = `spec spec--${ch.side}${ch.place === 'bottom' ? ' spec--bottom' : ''}`;
  el.dataset.id = ch.id;
  const pr = ch.proof;
  const proof = !pr ? '' : `
      <p class="spec__proof">
        <span class="spec__value">${pr.range
          ? `<span class="spec__num">${formatNumber(pr.range[0], pr.decimals)}</span><span class="spec__dash">–</span><span class="spec__num">${formatNumber(pr.range[1], pr.decimals)}</span>`
          : `<span class="spec__num">${formatNumber(pr.value, pr.decimals)}</span>`}<span class="spec__unit">${pr.unit}</span></span>
        <span class="spec__caption">${pr.caption}</span>
      </p>`;
  el.innerHTML = `
    <div class="spec__inner">
      <p class="spec__index">${String(i + 1).padStart(2, '0')}<span>/${String(CHAPTERS.length).padStart(2, '0')}</span> ${ch.rail}</p>
      <h3 class="spec__title">${ch.title}</h3>
      <ul class="spec__bullets">${ch.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>${proof}
    </div>`;
  return el;
}

function buildRail(onSelect) {
  const items = CHAPTERS.map((c) => ({ label: c.rail, at: c.at }));
  els.railList.innerHTML = items
    .map((it, i) => `<li><button type="button" data-i="${i}"><span class="hero__rail-n">${String(i + 1).padStart(2, '0')}</span><span class="hero__rail-label">${it.label}</span></button></li>`)
    .join('');
  const buttons = [...els.railList.querySelectorAll('button')];
  buttons.forEach((b, i) => b.addEventListener('click', () => onSelect(items[i].at + 0.35)));
  return { items, buttons };
}

/* ---------------------------------------------------------------- *
 * Experiência completa
 * ---------------------------------------------------------------- */
function initExperience() {
  const cleanups = [];

  // Scroll suave sincronizado ao ScrollTrigger (um único relógio: o ticker do GSAP).
  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  const lenisRaf = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(lenisRaf);
  gsap.ticker.lagSmoothing(0);
  cleanups.push(() => { gsap.ticker.remove(lenisRaf); lenis.destroy(); });

  // Frames do roteiro escolhido. Celular deitado no roteiro desktop carrega 1 a cada 2.
  const store = new FrameStore({
    count: VIDEO.frames,
    path: story.frames,
    step: saveData || (lightweight && story.key === 'desktop') ? 2 : 1,
    concurrency: lightweight ? 4 : 6,
    maxDecoded: lightweight ? 20 : 90, // 640×1138 decodificado ≈ 2,9 MB: 20 cabem com folga no iPhone
    onProgress: (p) => {
      gsap.set(els.loaderBar, { scaleX: p });
      if (p >= 1) gsap.to(els.loader, { autoAlpha: 0, duration: 0.6, delay: 0.2 });
    },
  });
  cleanups.push(() => store.destroy());

  // Three.js em chunk separado: pôster e título aparecem antes do WebGL.
  let renderer = null;
  let canvas = els.canvas;
  let destroyed = false;
  import('./renderer.js').then(({ createRenderer }) => {
    if (destroyed) return;
    const preferCanvas = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    renderer = createRenderer(canvas, {
      tint: NAVY_DEEP,
      forceCanvas: preferCanvas,
      onContextLost: () => {
        if (destroyed || renderer?.kind !== 'webgl') return;
        const oldCanvas = canvas;
        const nextCanvas = oldCanvas.cloneNode(false);
        oldCanvas.replaceWith(nextCanvas);
        renderer.destroy();
        canvas = nextCanvas;
        els.canvas = nextCanvas;
        renderer = createRenderer(canvas, { tint: NAVY_DEEP, forceCanvas: true });
        renderer.resize(view.w, view.h, view.dpr);
        hero.dataset.renderer = renderer.kind;
        draw.dirty = true;
      },
    });
    hero.dataset.renderer = renderer.kind;
    renderer.resize(view.w, view.h, view.dpr);
    draw.dirty = true;
  });
  cleanups.push(() => { destroyed = true; renderer?.destroy(); });

  // Estado compartilhado entre timeline (scroll) e loop de render.
  const state = { time: 0, fade: 0, outro: 0 };
  const view = { w: 0, h: 0, dpr: 1, desktop: true };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const draw = { frame: -1, shot: -1, cut: 0, dirty: true };

  // Cartões
  const cards = CHAPTERS.map((ch, i) => {
    const el = buildCard(ch, i);
    els.specs.appendChild(el);
    const nums = [...el.querySelectorAll('.spec__num')];
    const svgNS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(svgNS, 'g');
    g.innerHTML = '<path class="line__path" pathLength="1"/><circle class="line__ring" r="14"/><circle class="line__dot" r="4"/>';
    els.lines.appendChild(g);
    return { ch, el, inner: el.querySelector('.spec__inner'), nums, g, path: g.firstChild, ring: g.children[1], dot: g.children[2], line: { p: 0 } };
  });

  // Trilho de capítulos
  let st; // ScrollTrigger principal (definido no matchMedia)
  const rail = buildRail((t) => {
    if (!st) return;
    const y = st.start + (t / TOTAL) * (st.end - st.start);
    lenis.scrollTo(y, { duration: 1.4 });
  });

  // Tamanho
  const resize = () => {
    const r = els.stage.getBoundingClientRect();
    view.w = r.width;
    view.h = r.height;
    view.dpr = Math.min(window.devicePixelRatio || 1, lightweight ? 1.5 : 2);
    view.desktop = window.matchMedia('(min-width: 1024px)').matches;
    renderer?.resize(view.w, view.h, view.dpr);
    els.lines.setAttribute('viewBox', `0 0 ${view.w} ${view.h}`);
    draw.dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(els.stage);
  const onViewportResize = () => requestAnimationFrame(resize);
  window.visualViewport?.addEventListener('resize', onViewportResize, { passive: true });
  resize();
  cleanups.push(() => {
    ro.disconnect();
    window.visualViewport?.removeEventListener('resize', onViewportResize);
  });

  // Profundidade guiada pelo cursor (apenas ponteiro fino).
  if (!calm && window.matchMedia('(pointer: fine)').matches) {
    const onMove = (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    cleanups.push(() => window.removeEventListener('pointermove', onMove));
  }

  /* ---------------- loop de render (um por tick do GSAP) ---------------- */
  const renderState = { focus: 0.5, zoom: 1.05, cut: 0, time: 0, fade: 0, px: 0, py: 0 };
  const tick = (time) => {
    // Suaviza o cursor
    const psx = pointer.sx, psy = pointer.sy;
    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;
    const moving = Math.abs(pointer.sx - psx) + Math.abs(pointer.sy - psy) > 0.0004;

    const t = state.time;
    const si = shotAt(SHOTS, t);
    const shot = SHOTS[si];
    if (si !== draw.shot) {
      if (draw.shot !== -1 && !calm) draw.cut = 1;
      draw.shot = si;
    }
    // Crossfade entre quadros vizinhos do mesmo plano: 15 fps passam a fluir
    // como movimento contínuo, sem degraus. Nunca mistura através de um corte.
    const lo = frameAt(shot.start);
    const hi = si === SHOTS.length - 1 ? VIDEO.frames - 1 : frameAt(shot.end) - 1;
    const exact = Math.min(hi, Math.max(lo, t * VIDEO.fps));
    const frame = Math.floor(exact);
    const img = store.get(frame, lo, hi) ?? draw.img;
    const next = frame < hi ? store.peek(frame + 1) : null;
    const mix = next ? Math.round((exact - frame) * 16) / 16 : 0;
    const local = Math.min(1, Math.max(0, (t - shot.start) / (shot.end - shot.start)));

    // O conjunto vertical já vem enquadrado; nos outros, o foco segue o assunto do plano.
    const imgWidth = img && (img.width || img.naturalWidth);
    const imgHeight = img && (img.height || img.naturalHeight);
    const framed = img && imgWidth < imgHeight;
    renderState.focus = framed || view.w / view.h >= 1.2 ? 0.5 : shot.focus;
    renderState.zoom = calm ? 1.05 : 1.05 + local * 0.045;
    renderState.cut = draw.cut;
    renderState.time = time;
    renderState.fade = state.fade;
    renderState.px = pointer.sx * 0.006;
    renderState.py = pointer.sy * 0.004;

    const key = frame + mix;
    const changed = key !== draw.frame || draw.cut > 0.01 || moving || draw.dirty || img !== draw.img;
    if (renderer && img && changed) {
      renderer.draw(img, renderState, next, mix);
      if (draw.frame === -1) els.poster.classList.add('is-hidden');
      draw.frame = key;
      draw.img = img;
      draw.dirty = false;
    }
    draw.cut *= 0.86;
    if (draw.cut < 0.01) draw.cut = 0;

    // Primeiro as leituras de layout (linhas), depois as escritas: evita layout forçado.
    updateLines(renderState);
    updateRail(t);

    // Camadas de interface em outro plano: deslocam ao contrário do quadro.
    if (moving) {
      gsap.set(els.specs, { x: -pointer.sx * 14, y: -pointer.sy * 10, rotateY: pointer.sx * 3, rotateX: -pointer.sy * 2 });
      gsap.set(els.title, { x: -pointer.sx * 8, y: -pointer.sy * 6 });
    }
  };

  const updateLines = (s) => {
    for (const c of cards) {
      const anchor = Array.isArray(c.ch.anchor) ? c.ch.anchor : c.ch.anchor?.[draw.shot];
      const visible = view.desktop && anchor && c.line.p > 0.001;
      c.g.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const a = projectAnchor(anchor, view, s);
      const r = c.inner.getBoundingClientRect();
      // As linhas só aparecem com a cena fixada no topo (0,0): coordenadas da viewport bastam.
      const cx = c.ch.side === 'right' ? r.left : r.right;
      const cy = r.top + 28;
      const elbowX = a.x + (cx - a.x) * 0.45;
      c.path.setAttribute('d', `M${a.x},${a.y} L${elbowX},${cy} L${cx},${cy}`);
      c.path.style.strokeDashoffset = String(1 - c.line.p);
      c.dot.setAttribute('cx', a.x); c.dot.setAttribute('cy', a.y);
      c.ring.setAttribute('cx', a.x); c.ring.setAttribute('cy', a.y);
      c.g.style.opacity = String(Math.min(1, c.line.p * 1.5));
    }
  };

  let activeRail = -1;
  const updateRail = (t) => {
    gsap.set(els.railFill, { scaleX: Math.min(1, t / OUTRO_AT) });
    let idx = -1;
    rail.items.forEach((it, i) => { if (t >= it.at - 0.15) idx = i; });
    if (idx !== activeRail) {
      rail.buttons.forEach((b, i) => {
        b.classList.toggle('is-active', i === idx);
        b.classList.toggle('is-past', i < idx);
        if (i === idx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      activeRail = idx;
    }
  };

  gsap.ticker.add(tick);
  cleanups.push(() => gsap.ticker.remove(tick));

  /* ---------------- entrada (Fase 01: impacto) ---------------- */
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' }, paused: true });
  intro
    .from(els.media, { scale: 1.08, duration: 2.4, ease: 'power2.out' }, 0)
    .from(els.titleWord, { yPercent: 108, duration: 1.4 }, 0.25)
    .from(els.titleLines, { y: 24, autoAlpha: 0, duration: 1.1, stagger: 0.12 }, 0.55)
    .from(els.header, { y: -30, autoAlpha: 0, duration: 1 }, 0.7)
    .from(els.hint, { autoAlpha: 0, duration: 1 }, 1.1);

  store.start().then(() => { draw.dirty = true; intro.play(); });

  /* ---------------- timeline do scroll (Fases 02–05) ---------------- */
  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)' }, (ctx) => {
    const { desktop } = ctx.conditions;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: () => `+=${window.innerHeight * TOTAL * (story.key === 'mobile' ? story.scroll : desktop ? 0.46 : 0.36)}`,
        pin: els.stage,
        scrub: desktop ? true : 0.35,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    st = tl.scrollTrigger;

    // O vídeo avança proporcionalmente ao scroll.
    tl.to(state, { time: VIDEO.duration, duration: VIDEO.duration }, 0);

    // Fase 02: o título recua no espaço enquanto a máquina começa a trabalhar.
    // O trilho só aparece quando a narrativa começa e sai antes do fechamento.
    tl.fromTo(els.rail, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 1.4)
      .to(els.rail, { autoAlpha: 0, duration: 0.4 }, OUTRO_AT - 0.3);
    tl.to(els.hint, { autoAlpha: 0, y: 10, duration: 0.4 }, 0)
      .to(els.title, { autoAlpha: 0, z: -220, yPercent: -18, duration: 1.5, ease: 'power2.in' }, 0.25)
      .to(els.titleWord, { scaleX: 1.06, transformOrigin: '0% 100%', duration: 1.5, ease: 'power1.in' }, 0.25);

    // Fases 03/04: cada dado entra no momento do vídeo que o demonstra.
    cards.forEach(({ ch, el, nums, line }) => {
      const dir = calm ? 0 : ch.side === 'right' ? 1 : -1;
      const inner = el.querySelector('.spec__inner');
      const rows = inner.querySelectorAll('.spec__index, .spec__title, li, .spec__proof');
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, ch.at)
        .fromTo(inner,
          { z: calm ? 0 : -320, rotateY: dir * 28, xPercent: dir * 12 },
          { z: 0, rotateY: dir * 8, xPercent: 0, duration: 0.7, ease: 'power3.out' }, ch.at)
        .from(rows, { y: 16, autoAlpha: 0, duration: 0.4, stagger: 0.07, ease: 'power2.out' }, ch.at + 0.1)
        .to(line, { p: 1, duration: 0.6, ease: 'power2.inOut' }, ch.at + 0.15);

      // Contagem precisa até o valor oficial
      const targets = ch.proof ? ch.proof.range ?? [ch.proof.value] : [];
      targets.forEach((v, k) => {
        const o = { v: 0 };
        tl.to(o, {
          v, duration: 0.6, ease: 'power3.out',
          onUpdate: () => { nums[k].textContent = formatNumber(o.v, ch.proof.decimals); },
        }, ch.at + 0.25);
      });

      // Saída: o cartão passa pela câmera.
      tl.to(line, { p: 0, duration: 0.3, ease: 'power2.in' }, ch.until - 0.45)
        .to(inner, { z: calm ? 0 : 160, rotateY: dir * -4, autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, ch.until - 0.4)
        .set(el, { autoAlpha: 0 }, ch.until);
    });

    // Fase 05: escala da operação, fechamento e transição.
    const outroRows = els.outro.children;
    tl.fromTo(els.outro, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, OUTRO_AT)
      .from(outroRows, { y: 40, autoAlpha: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out' }, OUTRO_AT)
      .to(state, { fade: 0.62, duration: END_HOLD, ease: 'power1.inOut' }, VIDEO.duration - 0.6)
      .to(els.media, { scale: desktop ? 0.9 : 0.94, borderRadius: 28, duration: END_HOLD, ease: 'power2.inOut' }, VIDEO.duration);

    return () => { st = null; };
  });
  cleanups.push(() => mm.revert());

  // Cabeçalho sólido depois da hero
  const headerST = ScrollTrigger.create({
    trigger: '#ficha',
    start: 'top 80px',
    end: 'max',
    toggleClass: { targets: els.header, className: 'is-solid' },
  });
  cleanups.push(() => headerST.kill());

  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return () => cleanups.forEach((fn) => fn());
}

const destroy = initExperience();

if (import.meta.hot) import.meta.hot.dispose(() => destroy());
