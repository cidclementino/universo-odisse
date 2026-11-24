// ==========================================================================
// Linha em nós — o motor comum da Linha do PGT (Plano do fluxo e das ilhas) e da Linha do Escopo do projeto
// (Cid, 20/11/2026: "a Linha do Escopo é a do PGT, com o que é do projeto por cima").
//
//   Quem chama monta os NÓS (entregas e eventos com datas) e o miolo de cada cartão; o motor faz o resto:
//   * dois modos: COMPACTO (cada data com marco tem a mesma largura; um passo em sequência ocupa uma coluna)
//     e EXTENSO (cada dia útil tem a mesma largura; o cartão se estende por todos os seus dias, o fim de semana
//     é uma fresta). No extenso, Ctrl + roda muda a largura do dia;
//   * faixas de fase e de etapa (clique recolhe num cartão-resumo), régua com o mês e os fins de semana,
//     faixa de compressão (só no compacto), hoje;
//   * camadas Estúdio · Cliente · Terceiros com a 1ª linha (interação com o cliente, e de visibilidade) e a
//     2ª linha (interação com terceiros): reuniões pousam sobre a linha dos atores; com os três, o cartão vai de
//     uma linha à outra. Dentro de cada camada, pistas para o que corre ao mesmo tempo;
//   * entregas que correm juntas numa caixa; fios da sequência e gatilhos das decisões; hiatos e pausas
//     (suspensões) atravessando as camadas;
//   * a altura de cada cartão é a do texto (medida depois de desenhada, nunca estimada);
//   * a linha ocupa a largura da janela e desce até a base; a régua e os nomes das camadas ficam presos;
//   * seleção (destaca os fios e os vizinhos), Ctrl/Shift + clique e laço para vários, + sobre o fio, minimapa.
//
//   * ajustar (Escopo, 20/11/2026): a linha cabe na tela, sem rolar a página. O que sobra abaixo da cabeça da
//     linha se divide entre Estúdio 1,5×, Cliente 1× e Terceiros 1×. Em cada faixa o cartão vai do texto inteiro
//     ao nome em até 2 linhas e, por fim, só ao código com as datas e os controles; se nem assim couber, a faixa
//     rola sozinha (barra na borda direita). Os fios e os cartões sobre as linhas acompanham. Legenda numa linha.
//
//   LinhaNos.desenhar(el, cfg) — cfg:
//     estado: objeto que o chamador guarda ({ modo, dia, sel, selecao: Set, rolagem }) · recolhidas: Set
//     nos: [{ id, ini, fim (dia útil seguinte ao último), ator: est|cli|out|l1|l2|tres, ent, fase: { id, nome, cor },
//             etapa: { id, sigla, nome }, html (miolo do cartão), cls, titulo, fantasma }]
//     passos: [[ids que correm juntos], …] na ordem · gatilhos: [{ de, para, rotulo }]
//     hiatos: [{ id, ini, fim, html }] · pausas: [{ ini, fim, html }] · hoje: dia (UTC) ou null
//     util(t): conta como dia útil (compressão) · cliente: esconde o estúdio
//     aoMudar() (recolher, modo, zoom) · aoAbrir(id) · aoSelecao() · podeNovo(idDeOnde) → id | null
//     aoNovoNoFio(id, { x, y }, tela) · aoLigar(tela) (botões dos cartões) · legenda (html, abaixo)
// ==========================================================================

const LinhaNos = (() => {
  const DIA = 86400000;
  const LAT = 132;           // coluna dos nomes das camadas
  const X0 = 28;
  const W_COMP = 184;        // compacto: espaço entre datas
  const FRESTA = 12;         // extenso: o fim de semana inteiro (sábado leva a fresta, domingo nada)
  const GAP = 12;
  let Y_FASE = 0, Y_ETAPA = 24, Y_REGUA = 50, Y_COMP = 86, Y_CAM = 108;
  const ALTURAS = { normal: [0, 24, 50, 86, 108], ajustada: [0, 22, 44, 78, 88] };
  const NIVEIS = ['cheio', 'reduzido', 'minimo'];
  const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const dm = (t) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  const fds = (t) => { const w = new Date(t).getUTCDay(); return w === 0 || w === 6; };
  const CHEV = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4 5.5 7 8.5 10 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const DIA_PADRAO = 112, DIA_MIN = 40, DIA_MAX = 176;

  // ---------------------------------------------------------------- vista: recolhidos, como cliente, grupos
  function vista(cfg) {
    const rec = cfg.recolhidas || new Set();
    const chaveDe = (n) => (n.fantasma ? null : rec.has('f:' + n.fase.id) ? 'f:' + n.fase.id : rec.has(n.etapa.id) ? 'e:' + n.etapa.id : null);
    const porId = Object.fromEntries(cfg.nos.map((n) => [n.id, n]));
    const resumos = new Map();
    const vis = [];
    for (const n of cfg.nos) {
      const k = chaveDe(n);
      if (!k) { if (!(n.fantasma && (rec.has('f:' + n.fase.id) || rec.has(n.etapa.id)))) vis.push(n); continue; }
      let r = resumos.get(k);
      if (!r) {
        r = { id: 'sum:' + k, resumo: true, chave: k, etapa: n.etapa, fase: n.fase, ator: 'est', ini: n.ini, fim: n.fim, n: 0,
          nome: k.startsWith('f:') ? n.fase.nome : n.etapa.nome, cod: k.startsWith('f:') ? 'Fase' : n.etapa.sigla, extras: 0 };
        resumos.set(k, r); vis.push(r);
      }
      r.ini = Math.min(r.ini, n.ini); r.fim = Math.max(r.fim, n.fim); r.n++;
      if (n.destaque) r.extras++;
    }
    for (const r of resumos.values()) {
      const dias = cfg.util ? contarUteis(r.ini, r.fim, cfg.util) : Math.round((r.fim - r.ini) / DIA);
      r.html = `<div class="ln-no__cab"><span class="ln-no__cod">${esc(r.cod)}</span><span>${r.n} passo${r.n > 1 ? 's' : ''}</span></div>
        <div class="ln-no__nome">${esc(r.nome)}</div><div class="ln-no__pe"><span>${dm(r.ini)} – ${dm(r.fim - DIA)}</span><span>${dias} dia${dias > 1 ? 's' : ''}</span>${r.extras ? `<span class="ln-tag--susp">${r.extras} fora da data</span>` : ''}</div>`;
      r.titulo = `${r.nome}\nClique na faixa (ou duplo clique aqui) para abrir.`;
    }
    const mapa = (id) => { const n = porId[id]; if (!n) return id; const k = chaveDe(n); return k ? 'sum:' + k : id; };
    const visivel = (n) => !cfg.cliente || n.ator !== 'est';
    const nos = vis.filter(visivel);
    const visIds = new Set(nos.map((n) => n.id));
    let passos = (cfg.passos || []).map((ids) => [...new Set(ids.map(mapa))].filter((id) => visIds.has(id))).filter((p) => p.length);
    passos = passos.filter((p, i) => i === 0 || p.join() !== passos[i - 1].join());
    const porIdV = Object.fromEntries(nos.map((n) => [n.id, n]));
    const grupos = passos.filter((p) => p.length > 1 && p.every((id) => porIdV[id]?.ent && !porIdV[id].resumo)).map((p) => ({ id: 'grp:' + p[0], ids: p }));
    const noGrupo = {};
    for (const g of grupos) for (const id of g.ids) noGrupo[id] = g;
    return { nos, passos, grupos, noGrupo, porId: porIdV };
  }
  function contarUteis(a, b, util) { let n = 0; for (let t = a; t < b; t += DIA) if (util(t)) n++; return n; }

  // ---------------------------------------------------------------- escala: compacto (marcos) ou extenso (dias)
  function escala(cfg, V) {
    const datas = [...V.nos.flatMap((n) => [n.ini, n.fim]), ...(cfg.hiatos || []).flatMap((h) => [h.ini, h.fim]),
      ...(cfg.pausas || []).flatMap((p) => [p.ini, p.fim])];
    if (cfg.hoje != null && datas.length) {
      const lo = Math.min(...datas), hi = Math.max(...datas);
      if (cfg.hoje >= lo - 40 * DIA && cfg.hoje <= hi + 40 * DIA) datas.push(cfg.hoje);   // hoje só se está perto
    }
    const tMin = Math.min(...datas), tMax = Math.max(...datas);
    if (cfg.estado.modo === 'extenso') {
      const D = cfg.estado.dia || DIA_PADRAO;
      const pos = new Map(); let x = X0;
      const largDe = (t) => { const w = new Date(t).getUTCDay(); return w === 6 ? FRESTA : w === 0 ? (new Date(t - DIA).getUTCDay() === 6 && t - DIA >= tMin ? 0 : FRESTA) : D; };
      for (let t = tMin; t <= tMax + DIA; t += DIA) { pos.set(t, x); x += largDe(t); }
      const larg = largDe;
      const xDe = (t) => (pos.has(t) ? pos.get(t) : t < tMin ? X0 : x);
      return { modo: 'extenso', D, x: xDe, larg, tMin, tMax, largura: x + X0 + 40, marcos: null };
    }
    const marcos = [...new Set(datas)].sort((a, b) => a - b);
    const col = new Map(marcos.map((t, i) => [t, i]));
    const xDe = (t) => {
      if (col.has(t)) return X0 + col.get(t) * W_COMP;
      let k = 0; while (k < marcos.length - 1 && marcos[k + 1] < t) k++;
      const a = marcos[k], b = marcos[k + 1] ?? a + DIA;
      return X0 + k * W_COMP + W_COMP * Math.max(0, Math.min(1, (t - a) / (b - a)));
    };
    return { modo: 'compacto', x: xDe, larg: () => W_COMP, tMin, tMax, marcos, largura: X0 * 2 + Math.max(1, marcos.length - 1) * W_COMP + 40 };
  }

  // ---------------------------------------------------------------- cartão (o mesmo para medir e para desenhar)
  function cartao(n, c, V) {
    const cls = ['ln-no', n.resumo ? 'ln-no--resumo' : n.ent ? 'ln-no--ent' : 'ln-no--evt', n.cls || '',
      ['l1', 'l2', 'tres'].includes(n.ator) ? 'ln-no--linha' : '', n.ator === 'tres' ? 'ln-no--tres' : '',
      V.noGrupo[n.id] ? 'ln-no--membro' : '', n.fantasma ? 'is-fantasma' : '', c.estreito ? 'is-estreito' : '', c.nivel && c.nivel !== 'cheio' ? 'nivel-' + c.nivel : ''].filter(Boolean).join(' ');
    const pos = c.t == null ? `width:${c.w}px` : `left:${c.l}px;top:${c.t}px;width:${c.w}px${c.hFixa ? `;height:${c.hFixa}px` : ''}`;
    return `<div class="${cls}" data-no="${esc(n.id)}" style="${pos};--fase:${n.fase.cor}" title="${esc(n.titulo || '')}" tabindex="0">${n.html}</div>`;
  }

  // ---------------------------------------------------------------- geometria
  function geometria(cfg, V, S, medidor, alturaUtil) {
    const caixa = {};
    const minW = S.modo === 'extenso' ? 24 : 60;
    for (const n of V.nos) {
      const w = Math.max(minW, S.x(n.fim) - S.x(n.ini) - GAP);
      caixa[n.id] = { l: S.x(n.ini) + GAP / 2, w, estreito: S.modo === 'extenso' && w < 96 };
    }
    for (const g of V.grupos) for (const id of g.ids) { const c = caixa[id]; c.w = Math.max(minW - 4, c.w - 8); c.l += 4; }
    // alturas: medidas no próprio navegador, com a largura final
    medidor.innerHTML = V.nos.map((n) => cartao(n, { w: caixa[n.id].w, estreito: caixa[n.id].estreito }, V)).join('');
    [...medidor.children].forEach((elx, i) => { caixa[V.nos[i].id].h = Math.ceil(elx.getBoundingClientRect().height); });
    medidor.innerHTML = '';
    for (const g of V.grupos) {
      let h = 4; for (const id of g.ids) h += caixa[id].h + 4;
      const ini = Math.min(...g.ids.map((id) => V.porId[id].ini)), fim = Math.max(...g.ids.map((id) => V.porId[id].fim));
      caixa[g.id] = { l: S.x(ini) + GAP / 2, w: Math.max(minW, S.x(fim) - S.x(ini) - GAP), h };
    }
    // pistas: dentro de cada camada, o que se sobrepõe no tempo desce para a pista seguinte
    const itens = { est: [], cli: [], out: [] };
    for (const n of V.nos) if (!V.noGrupo[n.id] && itens[n.ator]) itens[n.ator].push(n.id);
    for (const g of V.grupos) itens.est.push(g.id);
    const pistas = {};
    for (const k of Object.keys(itens)) {
      const ps = []; // [{ fimX, h, ids }]
      const ord = itens[k].map((id) => ({ id, ...caixa[id] })).sort((a, b) => a.l - b.l);
      for (const it of ord) {
        let p = ps.find((x) => x.fimX <= it.l - 4);
        if (!p) { p = { fimX: 0, h: 0, ids: [] }; ps.push(p); }
        p.fimX = it.l + it.w; p.h = Math.max(p.h, it.h); p.ids.push(it.id);
      }
      pistas[k] = ps;
    }
    const alt = (k) => pistas[k].reduce((t, p) => t + p.h, 0) + Math.max(0, pistas[k].length - 1) * 8;
    const meia = (ator) => Math.max(26, ...V.nos.filter((n) => n.ator === ator).map((n) => caixa[n.id].h / 2));
    const meia1 = Math.max(meia('l1'), 26), meia2 = Math.max(meia('l2'), 26);
    const tres = Math.max(0, ...V.nos.filter((n) => n.ator === 'tres').map((n) => caixa[n.id].h));
    const cam = {};
    let y = Y_CAM;
    if (!cfg.cliente) { cam.est = { y, h: 16 + Math.max(60, alt('est')) + 14 + meia1 }; y += cam.est.h; } else y += meia1 + 14;
    const l1 = y;
    let hCli = Math.max(34, alt('cli'));
    hCli = Math.max(hCli, tres - meia1 - meia2 - 24);
    cam.cli = { y, h: meia1 + 14 + hCli + 14 + meia2 }; y += cam.cli.h;
    const l2 = y;
    cam.out = { y, h: meia2 + 14 + Math.max(34, alt('out')) + 18 }; y += cam.out.h;
    // a linha desce até a base: o que sobra fica na última camada
    if (alturaUtil && y < alturaUtil) { cam.out.h += alturaUtil - y; y = alturaUtil; }
    const topoPista = (k, base) => { const r = {}; let t = base; for (const p of pistas[k]) { for (const id of p.ids) r[id] = t; t += p.h + 8; } return r; };
    const tops = { ...(cam.est ? topoPista('est', cam.est.y + 16) : {}), ...topoPista('cli', l1 + meia1 + 14), ...topoPista('out', l2 + meia2 + 14) };
    for (const n of V.nos) {
      if (V.noGrupo[n.id]) continue;
      const c = caixa[n.id];
      if (tops[n.id] != null) c.t = tops[n.id];
      else if (n.ator === 'l1') c.t = l1 - c.h / 2;
      else if (n.ator === 'l2') c.t = l2 - c.h / 2;
      else if (n.ator === 'tres') { c.t = l1 - meia1; c.hFixa = l2 - l1 + meia1 + meia2; c.h = c.hFixa; }
      else c.t = (cam.est ? cam.est.y : Y_CAM) + 16;
    }
    for (const g of V.grupos) {
      const cg = caixa[g.id]; cg.t = tops[g.id] ?? (cam.est ? cam.est.y + 16 : Y_CAM);
      let t = cg.t + 4;
      for (const id of g.ids) { caixa[id].t = t; t += caixa[id].h + 4; }
    }
    const topo = cam.est ? cam.est.y : Y_CAM;
    return { caixa, cam, l1, l2, altura: y + 8, largura: S.largura, topo };
  }

  // ---------------------------------------------------------------- geometria que cabe na tela (ajustar)
  function geometriaAjustada(cfg, V, S, medidor, alturaUtil) {
    const caixa = {};
    const minW = S.modo === 'extenso' ? 24 : 60;
    for (const n of V.nos) {
      const w = Math.max(minW, S.x(n.fim) - S.x(n.ini) - GAP);
      caixa[n.id] = { l: S.x(n.ini) + GAP / 2, w, estreito: S.modo === 'extenso' && w < 96 };
    }
    for (const g of V.grupos) for (const id of g.ids) { const c = caixa[id]; c.w = Math.max(minW - 4, c.w - 8); c.l += 4; }
    // mede cada cartão nos três níveis de uma vez
    const alt = {};
    medidor.innerHTML = V.nos.map((n) => NIVEIS.map((nv) => cartao(n, { w: caixa[n.id].w, estreito: caixa[n.id].estreito, nivel: nv }, V)).join('')).join('');
    [...medidor.children].forEach((elx, i) => { const n = V.nos[Math.floor(i / 3)]; (alt[n.id] = alt[n.id] || {})[NIVEIS[i % 3]] = Math.ceil(elx.getBoundingClientRect().height); });
    medidor.innerHTML = '';
    const naLinha = (n) => ['l1', 'l2', 'tres'].includes(n.ator);
    // faixas: Estúdio 1,5 · Cliente 1 · Terceiros 1 (sem o estúdio, metade para cada)
    const H = Math.max(240, alturaUtil - Y_CAM);
    const pesoEst = cfg.cliente ? 0 : 1.5;
    const un = H / (pesoEst + 2);
    const cam = {};
    let y = Y_CAM;
    if (!cfg.cliente) { cam.est = { y, h: un * 1.5 }; y += cam.est.h; }
    const l1 = y; cam.cli = { y, h: un }; y += un;
    const l2 = y; cam.out = { y, h: H + Y_CAM - y };
    // cartões sobre as linhas: nome em até 2 linhas
    for (const n of V.nos) if (naLinha(n)) { caixa[n.id].nivel = 'reduzido'; caixa[n.id].h = alt[n.id].reduzido; }
    const meia = (ator) => Math.max(14, ...V.nos.filter((n) => n.ator === ator).map((n) => caixa[n.id].h / 2));
    const meia1 = meia('l1'), meia2 = meia('l2');
    // em cada faixa, o maior nível que cabe; senão, o menor e a faixa rola
    const itensDe = (k) => {
      const ids = V.nos.filter((n) => n.ator === k && !V.noGrupo[n.id]).map((n) => n.id);
      if (k === 'est') ids.push(...V.grupos.map((g) => g.id));
      return ids;
    };
    const vp = {}; const camDe = {};
    // o nível é escolhido em cada trecho onde os cartões se sobrepõem: um cartão sozinho fica com o texto inteiro,
    // uma pilha encolhe até caber; se nem só com o código couber, a faixa rola
    const faixa = (k, topo, espaco) => {
      const ext = itensDe(k).map((id) => {
        const g = V.grupos.find((x) => x.id === id);
        if (!g) return { id, l: caixa[id].l, r: caixa[id].l + caixa[id].w };
        const ini = Math.min(...g.ids.map((m) => V.porId[m].ini)), fim = Math.max(...g.ids.map((m) => V.porId[m].fim));
        const l = S.x(ini) + GAP / 2; const w = Math.max(minW, S.x(fim) - S.x(ini) - GAP);
        return { id, g, l, r: l + w, w };
      }).sort((a, b) => a.l - b.l);
      const blocos = []; let cur = null;
      for (const it of ext) {
        if (cur && it.l < cur.r - 2) { cur.itens.push(it); cur.r = Math.max(cur.r, it.r); } else { cur = { itens: [it], r: it.r }; blocos.push(cur); }
      }
      let maior = 0;
      for (const b of blocos) {
        let esc = null;
        for (const nv of NIVEIS) {
          const h = (it) => (it.g ? 4 + it.g.ids.reduce((t, m) => t + alt[m][nv] + 4, 0) : alt[it.id][nv]);
          const ps = [];
          for (const it of b.itens) {
            let p = ps.find((x) => x.fimX <= it.l - 4);
            if (!p) { p = { fimX: 0, h: 0, itens: [] }; ps.push(p); }
            p.fimX = it.r; p.h = Math.max(p.h, h(it)); p.itens.push(it);
          }
          const total = ps.reduce((t, p) => t + p.h, 0) + Math.max(0, ps.length - 1) * 6;
          esc = { nv, ps, total, h };
          if (total <= espaco) break;
        }
        let t = topo;
        for (const p of esc.ps) {
          for (const it of p.itens) {
            if (it.g) {
              caixa[it.id] = { l: it.l, w: it.w, t, h: esc.h(it) };
              let tm = t + 4;
              for (const m of it.g.ids) { Object.assign(caixa[m], { t: tm, h: alt[m][esc.nv], nivel: esc.nv }); tm += alt[m][esc.nv] + 4; camDe[m] = k; }
            } else Object.assign(caixa[it.id], { t, h: esc.h(it), nivel: esc.nv });
            camDe[it.id] = k;
          }
          t += p.h + 6;
        }
        maior = Math.max(maior, esc.total);
      }
      vp[k] = { top: topo - 4, h: espaco + 8, conteudo: maior + 8, rolagem: 0 };
    };
    if (cam.est) faixa('est', cam.est.y + 10, cam.est.h - 10 - meia1 - 10);
    faixa('cli', l1 + meia1 + 8, cam.cli.h - meia1 - meia2 - 16);
    faixa('out', l2 + meia2 + 8, cam.out.h - meia2 - 18);
    for (const n of V.nos) {
      if (!naLinha(n)) continue;
      const c = caixa[n.id];
      if (n.ator === 'l1') c.t = l1 - c.h / 2;
      else if (n.ator === 'l2') c.t = l2 - c.h / 2;
      else { c.t = l1 - meia1; c.hFixa = l2 - l1 + meia1 + meia2; c.h = c.hFixa; }
    }
    return { caixa, cam, l1, l2, altura: Y_CAM + H, largura: S.largura, topo: cam.est ? cam.est.y : Y_CAM, vp, camDe };
  }
  // posição na tela, descontada a rolagem da faixa (e presa à janela dela)
  const yNaTela = (G, id, y) => {
    const k = G.camDe && G.camDe[id]; if (!k) return y;
    const v = G.vp[k]; const r = y - v.rolagem;
    return Math.max(v.top, Math.min(v.top + v.h, r));
  };

  // ---------------------------------------------------------------- fios: sequência e gatilhos
  function fios(cfg, V, G) {
    const raiz = (id) => V.noGrupo[id]?.id || id;
    const ancora = (id, lado) => {
      const c = G.caixa[id];
      return { x: lado === 'saida' ? c.l + c.w : c.l, y: yNaTela(G, id, c.t + Math.min(c.h / 2, 24)) };
    };
    const lista = []; const visto = new Set();
    for (let i = 1; i < V.passos.length; i++) {
      const de = [...new Set(V.passos[i - 1].map(raiz))];
      const para = [...new Set(V.passos[i].map(raiz))];
      for (const a of de) for (const b of para) {
        const k = a + '>' + b; if (a === b || visto.has(k) || !G.caixa[a] || !G.caixa[b]) continue; visto.add(k);
        lista.push({ a, b, A: ancora(a, 'saida'), B: ancora(b, 'entrada') });
      }
    }
    for (const g of cfg.gatilhos || []) {
      const a = raiz(g.de), b = raiz(g.para);
      if (!G.caixa[a] || !G.caixa[b] || a === b) continue;
      const c = G.caixa[a]; const d = G.caixa[b];
      lista.push({ a, b, gatilho: true, rotulo: g.rotulo, A: { x: c.l + c.w / 2, y: yNaTela(G, a, c.t + c.h) }, B: { x: d.l + Math.min(d.w / 2, 40), y: yNaTela(G, b, d.t) } });
    }
    const caminho = (f) => {
      const { A, B } = f;
      if (f.gatilho) { const ym = (A.y + B.y) / 2 + 12; return `M${A.x} ${A.y} C${A.x} ${ym},${B.x} ${ym},${B.x} ${B.y - 3}`; }
      const mx = Math.max(18, Math.abs(B.x - A.x) / 2);
      return `M${A.x} ${A.y} C${A.x + mx} ${A.y},${B.x - mx} ${B.y},${B.x - 3} ${B.y}`;
    };
    const svg = `<svg class="ln-fios" width="${G.largura}" height="${G.altura}" aria-hidden="true">
      <defs><marker id="lnn-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#888780"/></marker>
        <marker id="lnn-seta-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#2F6FD0"/></marker></defs>
      ${lista.map((f, i) => `${f.gatilho ? '' : `<path class="ln-fio-toque" data-toque="${i}" d="${caminho(f)}"/>`}<path class="ln-fio${f.gatilho ? ' ln-fio--gatilho' : ''}" data-fio="${i}" d="${caminho(f)}" marker-end="url(#${f.gatilho ? 'lnn-seta-g' : 'lnn-seta'})"/>
        ${f.gatilho && f.rotulo ? `<text class="ln-fio__rot" x="${(f.A.x + f.B.x) / 2}" y="${(f.A.y + f.B.y) / 2 + 8}">${esc(f.rotulo)}</text>` : ''}`).join('')}
    </svg>`;
    return { lista, svg };
  }

  // faixa de compressão: fina e clara, do verde (1 dia útil até a data seguinte) ao vermelho (6 ou mais)
const TONS_SALTO = ['#9FD3B9', '#C9DE9B', '#ECC28F', '#E9A57A', '#D9826A', '#C9624F'];
const TEXTO_SALTO = ['#3E6B48', '#5E7A2E', '#8A5A2B', '#8A5A2B', '#A4473B', '#A4473B'];
const corSalto = (n) => TONS_SALTO[Math.max(0, Math.min(5, n - 1))];
const corTextoSalto = (n) => TEXTO_SALTO[Math.max(0, Math.min(5, n - 1))];
const segmento = (l, w, n, titulo) => `<div class="ln-comp" style="left:${l + 2}px;width:${Math.max(2, w - 4)}px;top:${Y_COMP}px;background:${corSalto(n)}" title="${titulo}"></div>`;

  // ---------------------------------------------------------------- cabeça: faixas, régua, compressão
  function cabeca(cfg, V, S, G) {
    const rec = cfg.recolhidas || new Set();
    const blocos = (chave) => {
      const out = [];
      for (const n of [...V.nos].sort((a, b) => a.ini - b.ini)) {
        if (n.fantasma) continue;
        const k = chave(n); const u = out[out.length - 1];
        if (u && u.k === k) { u.ini = Math.min(u.ini, n.ini); u.fim = Math.max(u.fim, n.fim); } else out.push({ k, ini: n.ini, fim: n.fim, n });
      }
      return out;
    };
    const faixa = (b, tipo, rotulo, chaveRec, titulo) => {
      const r = rec.has(chaveRec);
      return `<button type="button" class="ln-faixa ln-faixa--${tipo}${r ? ' is-recolhida' : ''}" data-recolher="${esc(chaveRec)}" title="${r ? 'Abrir' : 'Recolher'} ${esc(titulo)}"
        style="left:${S.x(b.ini) + 2}px;width:${Math.max(30, S.x(b.fim) - S.x(b.ini) - 4)}px;top:${tipo === 'fase' ? Y_FASE : Y_ETAPA}px;--fase:${b.n.fase.cor}">
        <span class="ln-faixa__seta${r ? ' is-fechada' : ''}">${CHEV}</span>${rotulo}</button>`;
    };
    const fases = blocos((n) => n.fase.id).map((b) => faixa(b, 'fase', esc(b.n.fase.nome), 'f:' + b.n.fase.id, 'a fase ' + b.n.fase.nome)).join('');
    const etapas = blocos((n) => (rec.has('f:' + n.fase.id) ? 'f:' + n.fase.id : n.etapa.id)).filter((b) => !rec.has('f:' + b.n.fase.id))
      .map((b) => faixa(b, 'etapa', `<b>${esc(b.n.etapa.sigla)}</b> ${esc(b.n.etapa.nome)}`, b.n.etapa.id, `${b.n.etapa.sigla} · ${b.n.etapa.nome}`)).join('');
    let regua = ''; let marcas = ''; let comp = '';
    const hojeCls = (t) => (cfg.hoje != null && t === cfg.hoje ? ' is-hoje' : '');
    if (S.modo === 'compacto') {
      let mesAntes = -1;
      regua = S.marcos.map((t) => {
        const d = new Date(t); const mes = d.getUTCMonth(); const novo = mes !== mesAntes; mesAntes = mes;
        return `<div class="ln-data${fds(t) ? ' is-fds' : ''}${novo ? ' is-mes' : ''}${hojeCls(t)}" style="left:${S.x(t)}px;top:${Y_REGUA}px">
          <span>${SEM[d.getUTCDay()]}${novo ? ` · <b>${MES[mes]}</b>` : ''}${cfg.hoje === t ? ' · hoje' : ''}</span>${dm(t)}</div>`;
      }).join('');
      marcas = S.marcos.map((t) => `<div class="ln-marca" style="left:${S.x(t)}px;top:${G.topo}px;height:${G.altura - G.topo}px"></div>`).join('');
      comp = S.marcos.slice(0, -1).map((t, i) => {
        const prox = S.marcos[i + 1];
        const uteis = contarUteis(t, prox, cfg.util || ((x) => !fds(x)));
        const corridos = Math.round((prox - t) / DIA);
        const n = Math.max(1, uteis);
        return segmento(S.x(t), W_COMP, n, `${dm(t)} → ${dm(prox)}: ${corridos} dia${corridos > 1 ? 's' : ''} corrido${corridos > 1 ? 's' : ''}, ${uteis} út${uteis === 1 ? 'il' : 'eis'}`)
          + (uteis > 1 ? `<div class="ln-comp__rot" style="left:${S.x(t) + W_COMP / 2}px;top:${Y_REGUA + 10}px;color:${corTextoSalto(n)}">+${uteis}d</div>` : '');
      }).join('');
    } else {
      // extenso: um rótulo por dia útil (ou por semana, quando o dia fica estreito); fresta no fim de semana
      const todos = S.D >= 64;
      let mesAntes = -1;
      for (let t = S.tMin; t <= S.tMax; t += DIA) {
        const d = new Date(t); const mes = d.getUTCMonth();
        if (fds(t)) { const w = S.larg(t); if (w) marcas += `<div class="ln-fresta" style="left:${S.x(t)}px;width:${w}px;top:${G.topo}px;height:${G.altura - G.topo}px" title="fim de semana"></div>`; continue; }
        const novo = mes !== mesAntes; mesAntes = mes;
        const mostra = todos || d.getUTCDay() === 1 || novo || t === cfg.hoje;
        marcas += `<div class="ln-marca${d.getUTCDay() === 1 ? ' is-semana' : ''}" style="left:${S.x(t)}px;top:${G.topo}px;height:${G.altura - G.topo}px"></div>`;
        comp += segmento(S.x(t), S.larg(t), cfg.util && !cfg.util(t) ? 6 : 1, `${SEM[d.getUTCDay()]} ${dm(t)}${cfg.util && !cfg.util(t) ? ' · suspenso' : ''}`);
        if (mostra) regua += `<div class="ln-data${novo ? ' is-mes' : ''}${hojeCls(t)}" style="left:${S.x(t) + S.larg(t) / 2}px;top:${Y_REGUA}px">
          <span>${SEM[d.getUTCDay()]}${novo ? ` · <b>${MES[mes]}</b>` : ''}${cfg.hoje === t ? ' · hoje' : ''}</span>${dm(t)}</div>`;
      }
    }
    return { faixas: fases + etapas, regua, marcas, comp };
  }

  // ---------------------------------------------------------------- desenhar
  let medidor = null;
  function desenhar(el, cfg) {
    if (!medidor) { medidor = document.createElement('div'); medidor.className = 'lnn-medidor'; document.body.appendChild(medidor); }
    medidor.className = `lnn-medidor lnn${cfg.ajustar ? ' lnn--ajustada' : ''}`;   // medir com a mesma letra do desenho
    const E = cfg.estado;
    if (!E.selecao) E.selecao = new Set();
    [Y_FASE, Y_ETAPA, Y_REGUA, Y_COMP, Y_CAM] = cfg.ajustar ? ALTURAS.ajustada : ALTURAS.normal;
    const antes = el.querySelector('.lnn-rolo');
    if (antes) E.rolagem = { x: antes.scrollLeft, y: antes.scrollTop, t: E.rolagem?.t };
    if (!cfg.nos.length) { el.innerHTML = cfg.vazio || '<div class="vazio"><p>Nada para mostrar.</p></div>'; return null; }
    const V = vista(cfg);
    const S = escala(cfg, V);
    // altura útil: da linha até a base da janela
    el.innerHTML = `<div class="lnn${cfg.ajustar ? ' lnn--ajustada' : ''}"><div class="lnn-quadro"><div class="lnn-rolo"></div></div></div>`;
    const quadro = el.querySelector('.lnn-quadro');
    sangrar(quadro);
    const topoDoc = quadro.getBoundingClientRect().top + window.scrollY;
    const alturaRolo = cfg.ajustar ? Math.max(360, window.innerHeight - topoDoc - 30) : Math.max(440, window.innerHeight - topoDoc - (cfg.folgaBase ?? 12));
    const G = cfg.ajustar ? geometriaAjustada(cfg, V, S, medidor, alturaRolo - 12) : geometria(cfg, V, S, medidor, alturaRolo - 14);
    const F = fios(cfg, V, G);
    const C = cabeca(cfg, V, S, G);
    const xHoje = cfg.hoje != null && cfg.hoje >= S.tMin && cfg.hoje <= S.tMax ? S.x(cfg.hoje) + (S.modo === 'extenso' ? S.larg(cfg.hoje) / 2 : 0) : null;
    const faixaCruzada = (b, cls, html) => {
      const l = S.x(b.ini) + 4; const w = Math.max(S.modo === 'extenso' ? 18 : 64, S.x(b.fim) - S.x(b.ini) - 8);
      return `<div class="${cls}" style="left:${l}px;width:${w}px;top:${G.topo + 6}px;height:${G.altura - G.topo - 14}px">${html || ''}</div>`;
    };
    const camadas = `${G.cam.est ? `<div class="ln-camada" style="top:${G.cam.est.y}px;height:${G.cam.est.h}px;width:${G.largura}px"></div>` : ''}
      <div class="ln-camada ln-camada--cli" style="top:${G.cam.cli.y}px;height:${G.cam.cli.h}px;width:${G.largura}px"></div>
      <div class="ln-camada" style="top:${G.cam.out.y}px;height:${G.cam.out.h}px;width:${G.largura}px"></div>
      <div class="ln-linha" style="top:${G.l1}px;width:${G.largura}px"></div><div class="ln-linha" style="top:${G.l2}px;width:${G.largura}px"></div>`;
    const grupos = V.grupos.map((g) => { const c = G.caixa[g.id];
      return `<div class="ln-grupo" data-no="${esc(g.id)}" style="left:${c.l}px;top:${c.t}px;width:${c.w}px;height:${c.h}px;--fase:${V.porId[g.ids[0]].fase.cor}" title="Entregas que correm juntas: contam pela mais longa"></div>`; }).join('');
    let cartoes;
    let gruposHtml = null;
    if (G.vp) {
      const porCam = { est: [], cli: [], out: [], fora: [] };
      for (const g of V.grupos) porCam[G.camDe[g.id] || 'est'].push(`<div class="ln-grupo" data-no="${esc(g.id)}" style="left:${G.caixa[g.id].l}px;top:${G.caixa[g.id].t}px;width:${G.caixa[g.id].w}px;height:${G.caixa[g.id].h}px;--fase:${V.porId[g.ids[0]].fase.cor}" title="Entregas que correm juntas: contam pela mais longa"></div>`);
      for (const n of V.nos) porCam[G.camDe[n.id] || 'fora'].push(cartao(n, G.caixa[n.id], V));
      cartoes = Object.entries(G.vp).map(([k, v]) => `<div class="lnn-vp" data-vp="${k}" style="top:${v.top}px;height:${v.h}px;width:${G.largura}px"><div class="lnn-vp__mov" style="top:${-v.top}px">${porCam[k].join('')}</div></div>`).join('') + porCam.fora.join('');
      gruposHtml = '';
    } else cartoes = V.nos.map((n) => cartao(n, G.caixa[n.id], V)).join('');
    const lat = `${cfg.cliente ? '' : `<div class="ln-rot ln-rot--cam" style="top:${G.cam.est.y + 12}px">Estúdio</div>`}
      <div class="ln-rot ln-rot--linha" style="top:${G.l1 - 9}px">1ª linha<small>interação com o cliente · visibilidade</small></div>
      <div class="ln-rot ln-rot--cam" style="top:${G.l1 + 36}px">Cliente</div>
      <div class="ln-rot ln-rot--linha" style="top:${G.l2 - 9}px">2ª linha<small>interação com terceiros</small></div>
      <div class="ln-rot ln-rot--cam" style="top:${G.l2 + 36}px">Terceiros</div>`;
    const rolo = el.querySelector('.lnn-rolo');
    rolo.style.height = `${alturaRolo}px`;
    rolo.innerHTML = `<div class="lnn-tela${E.sel ? ' tem-sel' : ''}" style="width:${LAT + G.largura}px;height:${G.altura}px">
        <div class="lnn-corpo ln-tela" style="left:${LAT}px;width:${G.largura}px;height:${G.altura}px">${camadas}${C.marcas}
          ${(cfg.pausas || []).map((p) => faixaCruzada(p, 'ln-pausa', p.html)).join('')}
          ${(cfg.hiatos || []).map((h) => faixaCruzada(h, 'ln-hiato', h.html)).join('')}
          ${xHoje != null ? `<div class="ln-hoje" style="left:${xHoje}px;top:${G.topo}px;height:${G.altura - G.topo}px"></div>` : ''}
          <div class="lnn-fios">${F.svg}</div>${gruposHtml ?? grupos}${cartoes}</div>
        <div class="lnn-cab" style="left:${LAT}px;width:${G.largura}px;height:${Y_CAM}px">${C.faixas}${C.regua}${C.comp}
          ${xHoje != null ? `<div class="ln-hoje ln-hoje--cab" style="left:${xHoje}px;top:${Y_REGUA + 30}px;height:${Y_CAM - Y_REGUA - 30}px"></div>` : ''}</div>
        <div class="lnn-lat" style="width:${LAT}px;height:${G.altura}px">${lat}</div>
        <div class="lnn-canto" style="width:${LAT}px;height:${Y_CAM}px">
          <div class="ln-rot" style="top:${Y_FASE + 3}px">fase</div><div class="ln-rot" style="top:${Y_ETAPA + 3}px">etapa</div>
          <div class="ln-rot" style="top:${Y_REGUA + 8}px">datas</div><div class="ln-rot" style="top:${Y_COMP - 5}px">compressão</div></div>
      </div>`;
    quadro.insertAdjacentHTML('beforeend', `<div class="lnn-mini" title="Clique para ir ao trecho">${mini(V, G)}</div>`);
    // barras de rolagem das faixas que não couberam (na borda direita da tela)
    if (G.vp) for (const [k, v] of Object.entries(G.vp)) {
      if (v.conteudo <= v.h + 1) continue;
      quadro.insertAdjacentHTML('beforeend', `<div class="lnn-vbar" data-vbar="${k}" style="top:${v.top}px;height:${v.h}px" title="Rolar esta faixa"><i style="height:${Math.max(24, (v.h * v.h) / v.conteudo)}px"></i></div>`);
    }
    if (cfg.legenda) (cfg.ajustar ? quadro : el.querySelector('.lnn')).insertAdjacentHTML('beforeend', `<div class="ln-legenda small${cfg.ajustar ? ' ln-legenda--linha' : ''}">${cfg.legenda}</div>`);
    const R = { V, S, G, F, xHoje };
    ligar(el, cfg, R);
    return R;
  }

  function mini(V, G) {
    const H = 52; const k = H / G.altura; const sx = 100 / G.largura;
    const cor = { est: '#5B6773', cli: '#2F6FD0', out: '#888780', l1: '#2F6FD0', l2: '#888780', tres: '#2F6FD0' };
    return `<div class="ln-mini__tela">${V.nos.map((n) => { const c = G.caixa[n.id];
      return `<i style="left:${c.l * sx}%;width:${Math.max(0.3, c.w * sx)}%;top:${c.t * k}px;height:${Math.max(2, c.h * k)}px;background:${n.resumo ? n.fase.cor : cor[n.ator] || '#5B6773'};opacity:${n.fantasma ? .3 : .7}"></i>`; }).join('')}
      <div class="ln-mini__linha" style="top:${G.l1 * k}px"></div><div class="ln-mini__linha" style="top:${G.l2 * k}px"></div>
      <div class="ln-mini__janela"></div></div>`;
  }

  // a linha ocupa a largura da janela (sai da coluna da página)
  function sangrar(quadro) {
    quadro.style.marginLeft = '0px'; quadro.style.width = '';
    const vw = document.documentElement.clientWidth;
    const r = quadro.getBoundingClientRect();
    quadro.style.width = `${vw}px`;
    quadro.style.marginLeft = `${-r.left}px`;
  }
  let redimensionar = null;
  window.addEventListener('resize', () => { clearTimeout(redimensionar); redimensionar = setTimeout(() => { document.querySelectorAll('.lnn').forEach((x) => x._redesenhar && x._redesenhar()); }, 150); });

  // ---------------------------------------------------------------- interação
  function ligar(el, cfg, R) {
    const { V, S, G } = R;
    const E = cfg.estado;
    const lnn = el.querySelector('.lnn');
    lnn._redesenhar = () => cfg.aoMudar && cfg.aoMudar();
    const rolo = el.querySelector('.lnn-rolo');
    const tela = el.querySelector('.lnn-corpo');
    const cab = el.querySelector('.lnn-cab'); const lat = el.querySelector('.lnn-lat'); const canto = el.querySelector('.lnn-canto');
    // o nome da fase e da etapa acompanha a rolagem quando a faixa começa antes da tela
    const faixas = [...cab.querySelectorAll('.ln-faixa')].map((f) => ({ f, l: parseFloat(f.style.left), w: parseFloat(f.style.width) }));
    const sincronizar = () => {
      cab.style.transform = `translateY(${rolo.scrollTop}px)`;
      lat.style.transform = `translateX(${rolo.scrollLeft}px)`;
      canto.style.transform = `translate(${rolo.scrollLeft}px, ${rolo.scrollTop}px)`;
      const sl = rolo.scrollLeft;
      for (const x of faixas) x.f.style.paddingLeft = `${8 + Math.max(0, Math.min(sl - x.l, x.w - 140))}px`;
    };
    // rolagem: a de antes; na primeira vez, o hoje a um terço da tela (ou o começo)
    if (E.rolagem && E.rolagem.x != null) { rolo.scrollLeft = E.rolagem.x; rolo.scrollTop = E.rolagem.y || 0; }
    else if (R.xHoje != null) rolo.scrollLeft = Math.max(0, R.xHoje + LAT - rolo.clientWidth / 3);
    if (E.irPara != null) { rolo.scrollLeft = Math.max(0, S.x(E.irPara) + LAT - rolo.clientWidth / 3); E.irPara = null; }
    if (E.ancora) {   // depois do zoom: a data que estava sob o mouse continua sob o mouse
      rolo.scrollLeft = Math.max(0, S.x(E.ancora.t) + LAT - E.ancora.px); E.ancora = null;
    }
    sincronizar();
    // recolher / abrir etapa ou fase
    cab.querySelectorAll('[data-recolher]').forEach((b) => b.onclick = () => {
      const k = b.dataset.recolher; const rec = cfg.recolhidas;
      rec.has(k) ? rec.delete(k) : rec.add(k);
      cfg.aoMudar && cfg.aoMudar();
    });
    // seleção: destaca os fios e os vizinhos
    const marcar = () => {
      const sel = E.sel && V.noGrupo[E.sel] ? V.noGrupo[E.sel].id : E.sel;
      tela.parentElement.classList.toggle('tem-sel', !!E.sel);
      const lig = new Set(E.sel ? [E.sel] : []);
      R.F.lista.forEach((f, i) => {
        const on = !!sel && (f.a === sel || f.b === sel);
        tela.querySelector(`[data-fio="${i}"]`)?.classList.toggle('is-lig', on);
        if (on) { lig.add(f.a); lig.add(f.b); }
      });
      for (const id of [...lig]) { const g = V.grupos.find((x) => x.id === id); if (g) g.ids.forEach((m) => lig.add(m)); }
      if (E.sel && V.noGrupo[E.sel]) lig.add(V.noGrupo[E.sel].id);
      tela.querySelectorAll('[data-no]').forEach((c) => {
        c.classList.toggle('is-sel', c.dataset.no === E.sel);
        c.classList.toggle('is-lig', lig.has(c.dataset.no));
      });
    };
    const marcarVarios = () => { tela.querySelectorAll('.ln-no').forEach((c) => c.classList.toggle('is-multi', E.selecao.has(c.dataset.no))); cfg.aoSelecao && cfg.aoSelecao(); };
    let arrastou = false;
    tela.addEventListener('click', (ev) => {
      if (ev.target.closest('button, input, select, a, .ln-novo')) return;
      if (arrastou) { arrastou = false; return; }
      const c = ev.target.closest('.ln-no, .ln-grupo');
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
        if (c) {
          const ids = c.dataset.no.startsWith('grp:') ? V.grupos.find((g) => g.id === c.dataset.no)?.ids || [] : c.dataset.no.startsWith('sum:') || V.porId[c.dataset.no]?.fantasma ? [] : [c.dataset.no];
          const todos = ids.every((id) => E.selecao.has(id));
          ids.forEach((id) => (todos ? E.selecao.delete(id) : E.selecao.add(id)));
          marcarVarios();
        }
        return;
      }
      if (!c && E.selecao.size) { E.selecao.clear(); marcarVarios(); }
      E.sel = c && E.sel !== c.dataset.no ? c.dataset.no : null;
      marcar();
      if (c && cfg.aoClicar) cfg.aoClicar(c.dataset.no);
    });
    // clicar num cartão não rola a linha até ele (o foco vem sem rolagem)
    tela.addEventListener('mousedown', (ev) => {
      const c = ev.target.closest('.ln-no');
      if (c && !ev.target.closest('button, input, select, a, textarea')) { ev.preventDefault(); c.focus({ preventScroll: true }); }
    });
    tela.addEventListener('dblclick', (ev) => {
      const c = ev.target.closest('.ln-no');
      if (!c || ev.target.closest('button, input, a')) return;
      const id = c.dataset.no;
      if (id.startsWith('sum:')) { const k = id.slice(4); cfg.recolhidas.delete(k.startsWith('e:') ? k.slice(2) : k); cfg.aoMudar && cfg.aoMudar(); return; }
      cfg.aoAbrir && cfg.aoAbrir(id);
    });
    tela.addEventListener('keydown', (ev) => {
      const c = ev.target.closest?.('.ln-no');
      if (c && ev.key === 'Enter' && !ev.target.closest('button')) { ev.preventDefault(); cfg.aoAbrir && cfg.aoAbrir(c.dataset.no); }
    });
    if (E.sel && !tela.querySelector(`[data-no="${CSS.escape(E.sel)}"]`)) E.sel = null;
    marcar(); marcarVarios();
    // laço: arrastar no vazio seleciona vários
    tela.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0 || ev.target.closest('.ln-no, .ln-grupo, button, input, select, a, .ln-novo, .ln-mais, [data-toque], .ln-hiato, .ln-pausa')) return;
      const r0 = tela.getBoundingClientRect();
      const x0 = ev.clientX - r0.left, y0 = ev.clientY - r0.top;
      const somar = ev.ctrlKey || ev.metaKey || ev.shiftKey;
      const laco = document.createElement('div'); laco.className = 'ln-laco'; tela.appendChild(laco);
      let cx = null;
      const mover = (e) => {
        const r = tela.getBoundingClientRect();
        const x1 = e.clientX - r.left, y1 = e.clientY - r.top;
        cx = { l: Math.min(x0, x1), t: Math.min(y0, y1), r: Math.max(x0, x1), b: Math.max(y0, y1) };
        Object.assign(laco.style, { left: `${cx.l}px`, top: `${cx.t}px`, width: `${cx.r - cx.l}px`, height: `${cx.b - cx.t}px` });
        const rr = rolo.getBoundingClientRect();
        if (e.clientX > rr.right - 30) rolo.scrollLeft += 20; else if (e.clientX < rr.left + LAT + 30) rolo.scrollLeft -= 20;
      };
      const soltar = () => {
        window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar);
        laco.remove();
        if (!cx || (cx.r - cx.l < 6 && cx.b - cx.t < 6)) return;
        arrastou = true;
        if (!somar) E.selecao.clear();
        for (const n of V.nos) {
          if (n.resumo || n.fantasma) continue;
          const c = G.caixa[n.id];
          const t = c.t - (G.camDe && G.camDe[n.id] ? G.vp[G.camDe[n.id]].rolagem : 0);
          if (c.l < cx.r && c.l + c.w > cx.l && t < cx.b && t + c.h > cx.t) E.selecao.add(n.id);
        }
        marcarVarios();
      };
      window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
      ev.preventDefault();
    });
    // + sobre o fio
    let ligarMais = () => {};
    if (cfg.podeNovo && cfg.aoNovoNoFio) {
      const mais = document.createElement('button');
      mais.type = 'button'; mais.className = 'ln-mais'; mais.hidden = true; mais.setAttribute('aria-label', 'Novo cartão aqui');
      mais.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      tela.appendChild(mais);
      let atual = null; let saida = null;
      const deOnde = (f) => { const g = V.grupos.find((x) => x.id === f.a); return cfg.podeNovo(g ? g.ids[g.ids.length - 1] : f.a); };
      const esconder = () => { saida = setTimeout(() => { if (!tela.querySelector('.ln-novo')) mais.hidden = true; }, 250); };
      ligarMais = () => tela.querySelectorAll('[data-toque]').forEach((p) => {
        p.addEventListener('mouseenter', () => {
          const f = R.F.lista[Number(p.dataset.toque)];
          const id = deOnde(f);
          if (!id || tela.querySelector('.ln-novo')) return;
          clearTimeout(saida);
          const pt = p.getPointAtLength(p.getTotalLength() / 2);
          atual = id; mais.style.left = `${pt.x}px`; mais.style.top = `${pt.y}px`; mais.hidden = false;
          mais.title = 'Novo cartão aqui, depois do anterior';
        });
        p.addEventListener('mouseleave', esconder);
      });
      ligarMais();
      mais.addEventListener('mouseenter', () => clearTimeout(saida));
      mais.addEventListener('mouseleave', esconder);
      mais.onclick = (ev) => { ev.stopPropagation(); mais.hidden = true; cfg.aoNovoNoFio(atual, { x: parseFloat(mais.style.left), y: parseFloat(mais.style.top) }, tela); };
    }
    // minimapa
    const m = el.querySelector('.lnn-mini'); const janela = m.querySelector('.ln-mini__janela');
    const atualizar = () => {
      const sx = 100 / (G.largura + LAT);
      janela.style.left = `${rolo.scrollLeft * sx}%`;
      janela.style.width = `${Math.min(100, rolo.clientWidth * sx)}%`;
    };
    m.onclick = (ev) => { const r = m.getBoundingClientRect(); rolo.scrollTo({ left: ((ev.clientX - r.left) / r.width) * (G.largura + LAT) - rolo.clientWidth / 2, behavior: 'smooth' }); };
    rolo.addEventListener('scroll', () => { E.rolagem = { x: rolo.scrollLeft, y: rolo.scrollTop }; sincronizar(); atualizar(); }, { passive: true });
    atualizar();
    // roda: na horizontal (Shift: vertical); Ctrl + roda no extenso muda a largura do dia
    rolo.addEventListener('wheel', (ev) => {
      if (ev.target.closest('.ln-novo')) return;
      if ((ev.ctrlKey || ev.metaKey) && S.modo === 'extenso') {
        ev.preventDefault();
        const r = rolo.getBoundingClientRect(); const px = ev.clientX - r.left;
        const xTela = rolo.scrollLeft + px - LAT;
        let t = S.tMin; for (let d = S.tMin; d <= S.tMax; d += DIA) if (S.x(d) <= xTela) t = d;
        const novo = Math.max(DIA_MIN, Math.min(DIA_MAX, (E.dia || DIA_PADRAO) + (ev.deltaY < 0 ? 8 : -8)));
        if (novo === E.dia) return;
        E.dia = novo; E.ancora = { t, px }; E.rolagem = null;
        cfg.aoMudar && cfg.aoMudar();
        return;
      }
      if (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
      const k = R.faixaSob && R.faixaSob(ev.clientY);
      if (k) {
        const v = G.vp[k]; const max = v.conteudo - v.h;
        if ((ev.deltaY > 0 && v.rolagem < max) || (ev.deltaY < 0 && v.rolagem > 0)) { R.rolarFaixa(k, v.rolagem + ev.deltaY * (ev.deltaMode === 1 ? 32 : 1)); ev.preventDefault(); return; }
      }
      const max = rolo.scrollWidth - rolo.clientWidth;
      if ((ev.deltaY > 0 && rolo.scrollLeft < max - 1) || (ev.deltaY < 0 && rolo.scrollLeft > 0)) {
        rolo.scrollLeft += ev.deltaY * (ev.deltaMode === 1 ? 32 : 1);
        ev.preventDefault();
      }
    }, { passive: false });
    // rolagem própria das faixas (modo ajustar): roda sobre a faixa, ou arrastar a barra
    if (G.vp) {
      if (!E.vrol) E.vrol = {};
      const rolarFaixa = (k, y) => {
        const v = G.vp[k]; const max = Math.max(0, v.conteudo - v.h);
        v.rolagem = Math.max(0, Math.min(max, y)); E.vrol[k] = v.rolagem;
        const mov = tela.querySelector(`[data-vp="${k}"] .lnn-vp__mov`); if (mov) mov.style.transform = `translateY(${-v.rolagem}px)`;
        const bar = el.querySelector(`[data-vbar="${k}"] i`);
        if (bar && max) bar.style.transform = `translateY(${(v.rolagem / max) * (v.h - bar.offsetHeight)}px)`;
        redesenharFios();
      };
      let quadroPendente = 0;
      const redesenharFios = () => {
        if (quadroPendente) return;
        quadroPendente = requestAnimationFrame(() => { quadroPendente = 0; R.F = fios(cfg, V, G); tela.querySelector('.lnn-fios').innerHTML = R.F.svg; ligarMais(); marcar(); });
      };
      for (const k of Object.keys(G.vp)) if (E.vrol[k]) rolarFaixa(k, E.vrol[k]);
      R.rolarFaixa = rolarFaixa;
      el.querySelectorAll('[data-vbar]').forEach((b) => {
        const k = b.dataset.vbar; const v = G.vp[k];
        b.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          const thumb = b.querySelector('i'); const r = b.getBoundingClientRect();
          const max = v.conteudo - v.h; const curso = v.h - thumb.offsetHeight;
          const ir = (e) => rolarFaixa(k, ((e.clientY - r.top - thumb.offsetHeight / 2) / curso) * max);
          ir(ev);
          const solta = () => { window.removeEventListener('mousemove', ir); window.removeEventListener('mouseup', solta); };
          window.addEventListener('mousemove', ir); window.addEventListener('mouseup', solta);
        });
      });
      R.faixaSob = (clientY) => {
        const y = clientY - rolo.getBoundingClientRect().top;
        return Object.keys(G.vp).find((k) => y >= G.vp[k].top && y <= G.vp[k].top + G.vp[k].h && G.vp[k].conteudo > G.vp[k].h + 1);
      };
    }
    cfg.aoLigar && cfg.aoLigar(tela, R);
  }

  // Seletor Compacto | Extenso (o chamador põe na barra dele)
  const seletorModo = (E) => `<span class="pg-seletor" role="radiogroup" aria-label="Escala da linha">
      <button type="button" role="radio" data-lnn-modo="compacto" aria-checked="${E.modo !== 'extenso'}" title="Cartões do mesmo tamanho; os dias se achatam">Compacto</button>
      <button type="button" role="radio" data-lnn-modo="extenso" aria-checked="${E.modo === 'extenso'}" title="Dias do mesmo tamanho; o cartão se estende por todos os seus dias (Ctrl + roda: largura do dia)">Extenso</button></span>`;
  const ligarModo = (raiz, E, aoMudar) => raiz.querySelectorAll('[data-lnn-modo]').forEach((b) => b.onclick = () => {
    if (E.modo === b.dataset.lnnModo || (!E.modo && b.dataset.lnnModo === 'compacto')) return;
    E.modo = b.dataset.lnnModo; E.rolagem = null; aoMudar();
  });

  return { desenhar, seletorModo, ligarModo, DIA_PADRAO, esc };
})();
