# HX220L — Hero imersiva (BMC Hyundai)

Recriação da hero de https://bmchyundai.com.br/escavadeiras-hyundai/ como scrollytelling cinematográfico da HX220L.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ estático (pode ir para qualquer host ou ser embutido no WordPress via iframe/página própria)
```

## Arquitetura
- `src/story.js` — mapa de eventos do vídeo (cortes medidos com ffmpeg `scdet`), capítulos, dados técnicos e âncoras na máquina.
- `src/frames.js` — sequência WebP com carregamento progressivo (passes 1/16 → 1/1). Mobile/saveData usa 854 px e metade dos frames.
- `src/renderer.js` — Three.js (chunk carregado depois do pôster): cover com foco por plano, push-in, parallax do cursor, aberração cromática nos cortes, grão, vinheta e fusão para o azul da marca. Fallback Canvas 2D sem WebGL.
- `src/main.js` — Lenis + ScrollTrigger (pin + scrub), timeline única em segundos de vídeo, cartões 3D com contagem, linhas de conexão, trilho de capítulos clicável, `gsap.matchMedia` por breakpoint, modo estático para `prefers-reduced-motion`.

## Regenerar frames
```bash
V=video.mp4
ffmpeg -i $V -vf "fps=15,scale=1344:-2:flags=lanczos,hqdn3d=1.5:1.5:3:3" /tmp/d/f%03d.png   # cwebp -q 66
ffmpeg -i $V -vf "fps=15,scale=854:-2:flags=lanczos" /tmp/m/f%03d.png                         # cwebp -q 62
```
Se o vídeo mudar, refaça `SHOTS`/`CHAPTERS` em `story.js` (tempos e âncoras).

## Fontes dos dados
Ficha oficial `PT_HX220L-T3.pdf`. O site atual mostra 22.796 kg; a ficha dá 22.720 kg (sapata 700 mm) — a página usa a ficha.
