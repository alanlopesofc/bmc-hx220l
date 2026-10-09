# HX220L — Hero imersiva (BMC Hyundai)

Recriação da hero de https://bmchyundai.com.br/escavadeiras-hyundai/ como scrollytelling cinematográfico da HX220L.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ estático (pode ir para qualquer host ou ser embutido no WordPress via iframe/página própria)
```

## Arquitetura
- `src/story.js` — mapa de eventos do vídeo (cortes medidos com ffmpeg `scdet`), capítulos, dados técnicos e âncoras na máquina.
- `src/frames.js` — sequência WebP com carregamento progressivo (passes 1/16 → 1/1). Telas em pé usam outro roteiro (`MOBILE` em `story.js`): vídeo vertical próprio `media-src/hx220l-mobile-720x1280.mp4` (tomada contínua de um ciclo de carga), em `frames/m` (640×1138, 12 fps, 120 quadros, ≈8,7 MB), com os capítulos reposicionados nas ações dele. `media-src/hx220l-vertical-1080x1920.mp4` é o recorte 9:16 do vídeo do desktop, guardado como alternativa; celular deitado e saveData carregam metade dos frames.
- `src/renderer.js` — Three.js (chunk carregado depois do pôster): cover com foco por plano, push-in, parallax do cursor, aberração cromática nos cortes, grão, vinheta e fusão para o azul da marca. Fallback Canvas 2D sem WebGL.
- `src/main.js` — Lenis + ScrollTrigger (pin + scrub), timeline única em segundos de vídeo, cartões 3D com contagem, linhas de conexão, trilho de capítulos clicável, `gsap.matchMedia` por breakpoint, com `prefers-reduced-motion` o vídeo continua no scroll e só os efeitos extras saem.

## Regenerar frames
```bash
V=video.mp4
ffmpeg -i $V -vf "fps=15,scale=1344:-2:flags=lanczos,hqdn3d=1.5:1.5:3:3" /tmp/d/f%03d.png   # cwebp -q 66
X="if(lt(t,2.113),0.47,if(lt(t,4.446),0.3,if(lt(t,6.246),0.36,if(lt(t,7.58),0.3,if(lt(t,8.513),0.62,if(lt(t,9.646),0.55,if(lt(t,11.613),0.62,if(lt(t,13.146),0.4,0.42))))))))"
# vídeo vertical 1080×1920 (recorte 608×1080 no foco de cada plano, sem esticar) e quadros 720×1280 para celular
ffmpeg -i $V -vf "crop=608:1080:'max(0,min(1312,($X)*1920-304))':0,scale=1080:1920:flags=lanczos,setsar=1" -c:v libx264 -crf 20 media-src/hx220l-vertical-1080x1920.mp4
ffmpeg -i media-src/hx220l-vertical-1080x1920.mp4 -vf "fps=15,scale=720:1280:flags=lanczos,hqdn3d=1.5:1.5:3:3" /tmp/v/f%03d.png  # cwebp -q 58
```
Se o vídeo mudar, refaça `SHOTS`/`CHAPTERS` em `story.js` (tempos e âncoras).

Publicado em https://alanlopesofc.github.io/bmc-hx220l/ (branch `gh-pages` = conteúdo de `dist/`).

## Fontes dos dados
Ficha oficial `PT_HX220L-T3.pdf`. O site atual mostra 22.796 kg; a ficha dá 22.720 kg (sapata 700 mm) — a página usa a ficha.
