import 'lenis/dist/lenis.css';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { VIDEO, SHOTS, CHAPTERS, OUTRO_AT, shotAt, formatNumber, projectAnchor } from './story.js';
import { FrameStore } from './frames.js';

gsap.registerPlugin(ScrollTrigger);
// No celular a barra de endereço muda a altura ao rolar; não recalcular o pin por isso.
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, r = document) => r.querySelector(s);
const NAVY_DEEP = '#0b1640'; // #14298D escurecido: base do fechamento e da seção seguinte
const END_HOLD = 2.2; // segundos de timeline após o fim do vídeo (fechamento + liberação do pin)
const TOTAL = VIDEO.duration + END_HOLD;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = navigator.connection?.saveData === true;
const lightweight = window.matchMedia('(max-width: 767px)').matches || saveData;

// Três conjuntos de frames:
//   d — 1344×756, desktop;
//   p — 600×800, recorte vertical já centrado na máquina em cada plano (celular/tablet em pé);
//   m — 854×480, telas pequenas na horizontal.
const FRAME_SETS = { d: 'frames/d/', p: 'frames/p/', m: 'frames/m/' };
function pickFrameSet() {
  const portrait = window.innerWidth / window.innerHeight < 0.9;
  if (portrait) return 'p';
  return lightweight ? 'm' : 'd';
}

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
  staticWrap: $('[data-static]'),
};

const frameUrl = (set, i) => `frames/${set}/f${String(i + 1).padStart(3, '0')}.webp`;
const frameAt = (t) => Math.min(VIDEO.frames - 1, Math.max(0, Math.round(t * VIDEO.fps)));

/* ---------------------------------------------------------------- *
 * Cartões de especificação (DOM real: legíveis por leitores de tela)
 * ---------------------------------------------------------------- */
function buildCard(ch, i) {
  const el = document.createElement('article');
  el.className = `spec spec--${ch.side}${ch.range ? ' spec--range' : ''}`;
  el.dataset.id = ch.id;
  const value = ch.range
    ? `<span class="spec__num" data-n="0">${formatNumber(ch.range[0], ch.decimals)}</span><span class="spec__dash">–</span><span class="spec__num" data-n="1">${formatNumber(ch.range[1], ch.decimals)}</span>`
    : `<span class="spec__num" data-n="0">${formatNumber(ch.value, ch.decimals)}</span>`;
  el.innerHTML = `
    <div class="spec__inner">
      <p class="spec__index">${String(i + 1).padStart(2, '0')}<span>/${String(CHAPTERS.length).padStart(2, '0')}</span></p>
      <h3 class="spec__label">${ch.label}</h3>
      <p class="spec__value">${value}<span class="spec__unit">${ch.unit}</span></p>
      <p class="spec__note">${ch.note}</p>
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
 * Modo de movimento reduzido: narrativa preservada, sem scrub/pin
 * ---------------------------------------------------------------- */
function initStatic() {
  hero.classList.add('is-static');
  els.header.classList.add('is-solid');
  els.staticWrap.hidden = false;
  els.staticWrap.innerHTML = CHAPTERS.map((ch, i) => {
    const t = (ch.at + ch.until) / 2;
    return `<figure class="static-chapter">
      <img src="${frameUrl('d', frameAt(t))}" alt="" loading="lazy" width="${VIDEO.width}" height="${VIDEO.height}" />
      <figcaption></figcaption>
    </figure>`;
  }).join('');
  els.staticWrap.querySelectorAll('figcaption').forEach((fc, i) => fc.appendChild(buildCard(CHAPTERS[i], i)));
  els.loader.remove();
  els.rail.remove();
  els.hint.remove();
  els.canvas.remove();
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

  // Frames: o conjunto acompanha a orientação da tela (troca ao girar o aparelho).
  let frameSet = pickFrameSet();
  const makeStore = (set) => new FrameStore({
    count: VIDEO.frames,
    path: FRAME_SETS[set],
    step: saveData ? 2 : 1,
    concurrency: lightweight ? 4 : 6,
    onProgress: (p) => {
      gsap.set(els.loaderBar, { scaleX: p });
      if (p >= 1) gsap.to(els.loader, { autoAlpha: 0, duration: 0.6, delay: 0.2 });
    },
  });
  let store = makeStore(frameSet);
  const switchFrameSet = () => {
    const next = pickFrameSet();
    if (next === frameSet) return;
    frameSet = next;
    const old = store;
    store = makeStore(next);
    gsap.set(els.loader, { autoAlpha: 1 });
    gsap.set(els.loaderBar, { scaleX: 0 });
    // Mantém o conjunto anterior na tela até o novo ter o primeiro quadro.
    store.start().then(() => { old.destroy(); draw.dirty = true; });
  };
  cleanups.push(() => store.destroy());

  // Three.js em chunk separado: pôster e título aparecem antes do WebGL.
  let renderer = null;
  let destroyed = false;
  import('./renderer.js').then(({ createRenderer }) => {
    if (destroyed) return;
    renderer = createRenderer(els.canvas, { tint: NAVY_DEEP });
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
    return { ch, el, nums, g, path: g.firstChild, ring: g.children[1], dot: g.children[2], line: { p: 0 } };
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
    switchFrameSet();
    els.lines.setAttribute('viewBox', `0 0 ${view.w} ${view.h}`);
    draw.dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(els.stage);
  resize();
  cleanups.push(() => ro.disconnect());

  // Profundidade guiada pelo cursor (apenas ponteiro fino).
  if (window.matchMedia('(pointer: fine)').matches) {
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
    const frame = frameAt(t);
    const si = shotAt(t);
    const shot = SHOTS[si];
    if (si !== draw.shot) {
      if (draw.shot !== -1) draw.cut = 1;
      draw.shot = si;
    }
    const img = store.get(frame, frameAt(shot.start), frameAt(shot.end) - 1) ?? draw.img;
    const local = Math.min(1, Math.max(0, (t - shot.start) / (shot.end - shot.start)));

    // O conjunto vertical já vem enquadrado; nos outros, o foco segue o assunto do plano.
    const framed = img && img.naturalWidth < img.naturalHeight;
    renderState.focus = framed || view.w / view.h >= 1.2 ? 0.5 : shot.focus;
    renderState.zoom = 1.05 + local * 0.045;
    renderState.cut = draw.cut;
    renderState.time = time;
    renderState.fade = state.fade;
    renderState.px = pointer.sx * 0.006;
    renderState.py = pointer.sy * 0.004;

    const changed = frame !== draw.frame || draw.cut > 0.01 || moving || draw.dirty || img !== draw.img;
    if (renderer && img && changed) {
      renderer.draw(img, renderState);
      if (draw.frame === -1) els.poster.classList.add('is-hidden');
      draw.frame = frame;
      draw.img = img;
      draw.dirty = false;
    }
    draw.cut *= 0.86;
    if (draw.cut < 0.01) draw.cut = 0;

    // Camadas de interface em outro plano: deslocam ao contrário do quadro.
    if (moving) {
      gsap.set(els.specs, { x: -pointer.sx * 14, y: -pointer.sy * 10, rotateY: pointer.sx * 3, rotateX: -pointer.sy * 2 });
      gsap.set(els.title, { x: -pointer.sx * 8, y: -pointer.sy * 6 });
    }

    updateLines(renderState);
    updateRail(t);
  };

  const updateLines = (s) => {
    for (const c of cards) {
      const anchor = Array.isArray(c.ch.anchor) ? c.ch.anchor : c.ch.anchor?.[draw.shot];
      const visible = view.desktop && anchor && c.line.p > 0.001;
      c.g.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const a = projectAnchor(anchor, view, s);
      const r = c.el.querySelector('.spec__inner').getBoundingClientRect();
      const sr = els.stage.getBoundingClientRect();
      const cx = (c.ch.side === 'right' ? r.left : r.right) - sr.left;
      const cy = r.top - sr.top + 28;
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
        end: () => `+=${window.innerHeight * TOTAL * (desktop ? 0.46 : 0.36)}`,
        pin: els.stage,
        scrub: 0.6,
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
      .to(els.titleWord, { letterSpacing: '0.06em', duration: 1.5, ease: 'power1.in' }, 0.25);

    // Fases 03/04: cada dado entra no momento do vídeo que o demonstra.
    cards.forEach(({ ch, el, nums, line }) => {
      const dir = ch.side === 'right' ? 1 : -1;
      const inner = el.querySelector('.spec__inner');
      const rows = inner.children;
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, ch.at)
        .fromTo(inner,
          { z: -320, rotateY: dir * 28, xPercent: dir * 12 },
          { z: 0, rotateY: dir * 8, xPercent: 0, duration: 0.7, ease: 'power3.out' }, ch.at)
        .from(rows, { y: 18, autoAlpha: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out' }, ch.at + 0.1)
        .to(line, { p: 1, duration: 0.6, ease: 'power2.inOut' }, ch.at + 0.15);

      // Contagem precisa até o valor oficial
      const targets = ch.range ?? [ch.value];
      targets.forEach((v, k) => {
        const o = { v: 0 };
        tl.to(o, {
          v, duration: 0.5, ease: 'power3.out',
          onUpdate: () => { nums[k].textContent = formatNumber(o.v, ch.decimals); },
        }, ch.at + 0.1);
      });

      // Saída: o cartão passa pela câmera.
      tl.to(line, { p: 0, duration: 0.3, ease: 'power2.in' }, ch.until - 0.45)
        .to(inner, { z: 160, rotateY: dir * -4, autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, ch.until - 0.4)
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

let destroy = () => {};
if (reduceMotion) initStatic();
else destroy = initExperience();

if (import.meta.hot) import.meta.hot.dispose(() => destroy());
