// Página "Padrões": mostra os estilos de texto e os espaçamentos do sistema
// (padroes.js) e confere o uso real deles renderizando todos os modelos.
// Por enquanto só visualização; a edição vem depois.

import { TEXTO, ESPACO, GRUPOS_ESPACO, FORMATOS, corpoMin, corpoMax } from './padroes.js';
import { NUCLEOS, ORDEM_NUCLEOS, padroesDoNucleo } from './nucleos.js';
import { modelosDo, codigoDe, renderCard, exemploDe, ajustarLayout, GRUPOS, grupoDe, LARG } from './templates.js';
import { tintaSobre } from './nucleos.js';
import { mark } from './marks.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v) => String(Math.round(v * 1000) / 1000).replace('.', ',');

const AMOSTRA = {
  capa: 'Um horizonte',
  titulo: 'Três ambientes, um ponto de fuga.',
  chamada: 'Vamos conversar.',
  citacao: 'O horror está em nunca saber o que esperar.',
  texto: 'Sem anteparos entre sala, jantar e cozinha, os três ambientes se voltam para o mesmo horizonte.',
  legenda: 'A figura sob a cobertura metálica.',
  rotulo: 'A tese',
};

/** Renderiza todos os modelos de todos os núcleos e mede o que está em uso. */
function auditar() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-30000px;top:0;width:1080px;height:1440px;pointer-events:none';
  document.body.appendChild(host);

  const porEstilo = Object.fromEntries(TEXTO.map((t) => [t.classe, { n: 0, modelos: new Set(), min: Infinity, max: 0 }]));
  const valores = new Map(); // valor de espaçamento → ocorrências
  const fora = [];
  let total = 0;

  for (const nid of ORDEM_NUCLEOS) {
    const nucleo = NUCLEOS[nid];
    const globais = padroesDoNucleo(nid);
    for (const m of modelosDo(nid)) {
      total++;
      const nomeModelo = `${nucleo.nome} · ${m.nome}`;
      host.innerHTML = `<div class="card">${renderCard({
        card: { id: 'aud', modelo: m.id, campos: exemploDe(nid, m.id), imgs: {} },
        indice: 1, total: 8, nucleo, globais, modo: 'miniatura', fonteImagem: () => null,
      })}</div>`;
      const card = host.firstElementChild;
      ajustarLayout(card);

      for (const t of TEXTO) {
        card.querySelectorAll('.' + t.classe).forEach((el) => {
          const r = porEstilo[t.classe];
          r.n++;
          r.modelos.add(nomeModelo);
          const fs = parseFloat(getComputedStyle(el).fontSize);
          r.min = Math.min(r.min, fs);
          r.max = Math.max(r.max, fs);
          const inline = el.style.fontSize;
          if (inline && !el.dataset.fit) fora.push(`${nomeModelo}: ${t.nome} com corpo próprio (${inline})`);
        });
      }
      // Corpo de texto definido fora dos estilos
      card.querySelectorAll('[style*="font-size"]').forEach((el) => {
        if (el.dataset.fit || TEXTO.some((t) => el.classList.contains(t.classe))) return;
        fora.push(`${nomeModelo}: texto com corpo próprio (${el.style.fontSize})`);
      });
      // Espaçamentos declarados nos modelos
      card.querySelectorAll('[style]').forEach((el) => {
        const st = el.getAttribute('style');
        for (const [, prop, v] of st.matchAll(/(margin(?:-top|-bottom)?|padding(?:-top|-bottom)?|row-gap|column-gap)\s*:\s*([^;]+)/g)) {
          let toks = v.trim().split(/\s+/);
          if (!prop.includes('-') && !prop.includes('gap')) toks = toks.filter((_, i) => i % 2 === 0); // atalho: só topo e base
          for (const tok of toks) {
            const n = parseFloat(tok);
            if (!tok.endsWith('px') || !n) continue;
            valores.set(n, (valores.get(n) || 0) + 1);
            if (!ESPACO.some((e) => e.v === n)) fora.push(`${nomeModelo}: ${prop} ${tok} fora dos espaçamentos`);
          }
        }
      });
      card.querySelectorAll('[data-gap]').forEach((el) => {
        const n = Number(el.dataset.gap);
        valores.set(n, (valores.get(n) || 0) + 1);
        const soma = ESPACO.some((x) => ESPACO.some((y) => x.v + y.v === n));
        if (!ESPACO.some((e) => e.v === n) && !soma) fora.push(`${nomeModelo}: distância ${n}px fora dos espaçamentos`);
      });
    }
  }
  host.remove();
  return { porEstilo, valores, fora, total };
}

/** Panorama de todos os modelos: núcleo → grupo → cards, 4 por linha. */
function panorama() {
  return ORDEM_NUCLEOS.map((nid) => {
    const n = NUCLEOS[nid];
    const globais = padroesDoNucleo(nid);
    const lista = modelosDo(nid);
    const grupos = GRUPOS.map(([gid, gnome]) => {
      const itens = lista.map((m, i) => ({ m, i })).filter(({ m }) => grupoDe(m) === gid);
      if (!itens.length) return '';
      return `<h3>${gnome} <span class="cont-p">${itens.length}</span></h3>
        <div class="pano-grade">${itens.map(({ m, i }) => {
          const cod = codigoDe(nid, m.id);
          return `<figure class="pano-item">
            <div class="pano-mini"><div class="card">${renderCard({
              card: { id: 'pano', modelo: m.id, campos: exemploDe(nid, m.id), imgs: {} },
              indice: 1, total: 8, nucleo: n, globais, modo: 'miniatura', fonteImagem: () => null,
            })}</div></div>
            <figcaption><span class="cod">${cod}</span><b>${esc(m.nome)}</b><small>${esc(m.desc)}</small></figcaption>
          </figure>`;
        }).join('')}</div>`;
    }).join('');
    return `<div class="pano-nucleo" id="pano-${nid}">
      <div class="pano-cab"><span class="pano-selo" style="background:${n.painel};color:${tintaSobre(n.painel)}">${mark(n.selo, 22)}</span>
        <div><b>Odisse ${n.nome}</b><small>${n.conteudo} · ${lista.length} modelos</small></div></div>
      ${grupos}
    </div>`;
  }).join('');
}

function escalarPanorama(raiz) {
  raiz.querySelectorAll('.pano-mini').forEach((mini) => {
    const c = mini.firstElementChild;
    if (!c.dataset.ok) { ajustarLayout(c); c.dataset.ok = 1; }
    c.style.transform = `scale(${mini.clientWidth / LARG})`;
  });
}

let observador;
export function renderPadroes(raiz) {
  const a = auditar();
  const formatos = FORMATOS.map((f) => `<span class="fmt ${f.ativo ? 'ativo' : ''}">${f.nome} <small>${f.larg} × ${f.alt}</small>${f.ativo ? '' : ' <i>em breve</i>'}</span>`).join('');

  const linhasTexto = TEXTO.map((t) => {
    const u = a.porEstilo[t.classe];
    const faixa = Array.isArray(t.tamanho);
    const corpo = faixa ? `${corpoMin(t)}–${corpoMax(t)} px <span class="nota">ajusta para caber</span>` : `${t.tamanho} px`;
    const real = u.n && faixa ? `<span class="nota">nos modelos: ${Math.round(u.min)}–${Math.round(u.max)} px</span>` : '';
    const estilo = `font-size:${corpoMax(t)}px;font-weight:${t.peso};line-height:${t.entrelinha};letter-spacing:${t.tracking}em;${t.caixaAlta ? 'text-transform:uppercase;' : ''}`;
    return `<tr>
      <td class="amostra-tx"><div class="esp-amostra" style="${estilo}">${esc(AMOSTRA[t.id] || t.nome)}</div></td>
      <td><b>${t.nome}</b><code>.${t.classe}</code><p>${esc(t.uso)}</p></td>
      <td class="num">${corpo}${real}</td>
      <td class="num">${t.peso}</td>
      <td class="num">${num(t.entrelinha)}</td>
      <td class="num">${num(t.tracking)} em</td>
      <td class="num">${t.caixaAlta ? 'Alta' : '—'}</td>
      <td class="num" title="${esc([...u.modelos].join('\n'))}">${u.n ? `${u.modelos.size} ${u.modelos.size === 1 ? 'modelo' : 'modelos'}` : '<span class="alerta">sem uso</span>'}</td>
    </tr>`;
  }).join('');

  const blocosEspaco = GRUPOS_ESPACO.map(([gid, gnome, gdesc]) => {
    const itens = ESPACO.filter((e) => e.grupo === gid);
    return `<div class="esp-grupo">
      <h3>${gnome} <span class="info" tabindex="0" data-info="${esc(gdesc)}">i</span></h3>
      ${itens.map((e) => `<div class="esp-linha">
        <div class="esp-barra"><span style="width:${e.v}px"></span></div>
        <div class="esp-v">${e.v} px</div>
        <div><b>${e.nome}</b><code>${e.id}</code><p>${esc(e.uso)}</p></div>
      </div>`).join('')}
    </div>`;
  }).join('');

  // Pilha de demonstração: o ritmo vertical aplicado, em 50%.
  const E = Object.fromEntries(ESPACO.map((e) => [e.id, e.v]));
  const gap = (k) => `<div class="demo-gap" style="height:${E[k]}px"><span>${ESPACO.find((e) => e.id === k).nome} · ${E[k]}</span></div>`;
  const demo = `<div class="demo-wrap"><div class="card demo">
      <div class="t-rotulo">A tese</div>${gap('proximo')}
      <div class="t-titulo" style="font-size:104px">Três ambientes, um ponto de fuga.</div>${gap('bloco')}
      <div class="t-texto" style="margin-left:${(1080 - 104) / 2 + 8}px">Sem anteparos entre sala, jantar e cozinha, os três ambientes se voltam para o mesmo horizonte.</div>${gap('bloco')}
      <div class="demo-img">Imagem</div>
    </div></div>`;

  // Um valor vale se for um espaçamento ou a soma de dois (ex.: bloco + corte sob um painel).
  const nomeDe = (v) => {
    const t = ESPACO.find((e) => e.grupo === 'ritmo' && e.v === v) || ESPACO.find((e) => e.v === v);
    if (t) return t.nome;
    for (const x of [...ESPACO].sort((p, q) => q.v - p.v)) for (const y of ESPACO) if (x.grupo === 'ritmo' && x.v + y.v === v) return `${x.nome} + ${y.nome}`;
    return null;
  };
  const ocorr = [...a.valores.entries()].sort((x, y) => x[0] - y[0])
    .map(([v, n]) => { const nm = nomeDe(v); return `<span class="chip-v ${nm ? '' : 'alerta'}">${v} px <em>${nm || 'fora do padrão'}</em> <small>× ${n}</small></span>`; }).join('');

  raiz.innerHTML = `
    <section>
      <a class="voltar" href="#/">← Publicações</a>
      <div class="sec-cab linha">
        <div>
          <h1>Padrões <span class="info" tabindex="0" data-info="Estilos de texto e espaçamentos comuns a todos os modelos. Valem para todos os formatos: as medidas são em px sobre a largura de 1080, igual no 3:4 e no 9:16. Por enquanto só para conferir; a edição vem depois.">i</span></h1>
          <div class="formatos">${formatos}</div>
        </div>
        <div class="resumo">
          <span><b>${TEXTO.length}</b> estilos de texto</span>
          <span><b>${ESPACO.length}</b> espaçamentos</span>
          <a href="javascript:void 0" class="ir-pano" data-ir-pano><b>${a.total}</b> modelos conferidos</a>
          <span class="${a.fora.length ? 'alerta' : 'ok'}"><b>${a.fora.length}</b> fora do padrão</span>
        </div>
      </div>
    </section>

    <section>
      <h2>Texto <span class="cont">${TEXTO.length}</span> <span class="info" tabindex="0" data-info="Amostras em tamanho real: 1 px do card = 1 px da tela. Passe o mouse sobre a contagem de modelos para ver quais usam o estilo.">i</span></h2>
      <div class="tabela-wrap"><table class="tab-texto">
        <thead><tr><th>Amostra</th><th>Estilo</th><th>Corpo</th><th>Peso</th><th>Entrelinha</th><th>Tracking</th><th>Caixa</th><th>Uso</th></tr></thead>
        <tbody>${linhasTexto}</tbody>
      </table></div>
    </section>

    <section class="esp-sec">
      <div>
        <h2>Espaçamento <span class="cont">${ESPACO.length}</span> <span class="info" tabindex="0" data-info="Barras em tamanho real (1 px do card = 1 px da tela).">i</span></h2>
        ${blocosEspaco}
      </div>
      <div>
        <h2>Ritmo aplicado <span class="info" tabindex="0" data-info="Rótulo, título, texto de apoio e imagem, como num card de corpo. Título → texto e texto → imagem usam o mesmo Bloco. Em 50%.">i</span></h2>
        ${demo}
        <h3 class="sub">Valores encontrados nos modelos</h3>
        <div class="chips-v">${ocorr}</div>
      </div>
    </section>

    <section class="panorama" id="pano">
      <h2>Modelos <span class="cont">${a.total}</span> <span class="info" tabindex="0" data-info="Todos os modelos de post, por núcleo e grupo, com o texto de exemplo. Use o código (ex.: OA-05) para pedir ajustes num modelo específico.">i</span></h2>
      ${panorama()}
    </section>

    <section>
      <h2>Conferência</h2>
      ${a.fora.length
        ? `<ul class="fora">${a.fora.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`
        : '<p class="tudo-ok">Todos os modelos usam apenas os estilos de texto e os espaçamentos acima.</p>'}
    </section>`;
  escalarPanorama(raiz);
  raiz.querySelector('[data-ir-pano]').onclick = () => raiz.querySelector('#pano').scrollIntoView({ behavior: 'smooth' });
  observador?.disconnect();
  observador = new ResizeObserver(() => escalarPanorama(raiz));
  observador.observe(raiz);
}
