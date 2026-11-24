// Métricas — as subpáginas do hub. Cada uma devolve { html, depois(raiz) }.

import { REDES, resumo, agrupar, engaj, ganhoSeguidores, somaDias, mediaDias, valores, matrizOnline, melhoresJanelas,
  resumoConcorrente, DIAS_SEMANA, DIAS_SEMANA_LONGO, FAIXAS, faixaDe, OBJETIVOS, diaLocal, DIA, def, media } from './modelo.js';
import { esc, n, nc, pct, dec, dataCurta, sinal, linha, barras, divisao, mapaCalor } from './graficos.js';
import { resumoOdissePublico } from './leituras.js';
import { NUCLEOS, ORDEM_NUCLEOS } from '../nucleos.js';
import { modelosDo } from '../templates.js';

const info = (t) => `<span class="info" tabindex="0" data-info="${esc(t)}">i</span>`;
const bloco = (titulo, corpo, { dica, extra = '', classe = '' } = {}) => `
  <section class="met-bloco ${classe}">
    <div class="met-bloco-cab"><h2>${titulo}${dica ? ' ' + info(dica) : ''}</h2>${extra}</div>
    ${corpo}
  </section>`;
const trecho = (t, k = 80) => { const s = String(t || 'sem legenda').split('\n')[0]; return s.length > k ? s.slice(0, k - 1) + '…' : s; };
const tons = { bom: 'Destaque', atencao: 'Atenção', neutro: 'Leitura' };

export function blocoLeituras(L, pag, max = 4) {
  const lista = L.filter((l) => l.pag === pag).slice(0, max);
  if (!lista.length) return '';
  return `<section class="met-leituras">${lista.map((l) => `<p class="met-leitura ${l.tom}"><span>${tons[l.tom]}</span>${l.txt}</p>`).join('')}</section>`;
}

function semConexao(rede) {
  return `<span class="met-nada">${esc(rede)} ainda não conectado</span>`;
}

// ===========================================================================
// Visão geral

export function visaoGeral(N, c, L, ui) {
  const todas = L.slice(0, 8);
  const leituras = `<section class="met-leituras grande">${todas.map((l) => `<p class="met-leitura ${l.tom}"><span>${tons[l.tom]}</span>${l.txt}${l.pag !== 'visao' ? ` <a class="met-ir" href="#/metricas/${l.pag}">ver</a>` : ''}</p>`).join('')}</section>`;

  // comparação entre redes (métricas equivalentes)
  const linhasRede = REDES.map((r) => {
    if (r.id !== 'instagram' || !N.contas.instagram) {
      return `<tr class="sem"><td><b>${esc(r.nome)}</b></td><td colspan="7">${semConexao(r.nome)}</td></tr>`;
    }
    const est = N.contas.instagram;
    const ps = c.posts.filter((p) => p.rede === r.id);
    const atual = resumo(ps);
    const ant = resumo(c.postsAnt.filter((p) => p.rede === r.id));
    const ganho = ganhoSeguidores(N, c);
    const alcanceDia = mediaDias(c.dias.instagram, 'alcance');
    const seguiram = somaDias(c.dias.instagram, 'seguiram');
    const alcTotal = somaDias(c.dias.instagram, 'alcance');
    const porMil = seguiram != null && alcTotal ? (seguiram / alcTotal) * 1000 : atual.seguiuMil;
    const delta = (a, b, f) => (a == null || b == null || !b ? '' : `<small class="${a >= b ? 'sobe' : 'desce'}">${a >= b ? '▲' : '▼'} ${f(Math.abs(a / b - 1))}</small>`);
    return `<tr>
      <td><b>${esc(r.nome)}</b><small class="met-sub">@${esc(est.usuario || '')}</small></td>
      <td class="num">${n(est.seguidores)}<small class="met-sub">${ganho == null ? '' : sinal(ganho) + ' no período'}</small></td>
      <td class="num">${n(ps.length)}</td>
      <td class="num">${nc(alcanceDia)}</td>
      <td class="num">${n(atual.alcance)} ${c.periodo !== 'tudo' ? delta(atual.alcance, ant.alcance, (v) => pct(v, 0)) : ''}</td>
      <td class="num">${pct(atual.engaj)} ${c.periodo !== 'tudo' ? delta(atual.engaj, ant.engaj, (v) => pct(v, 0)) : ''}</td>
      <td class="num">${pct(atual.salvosTx)}</td>
      <td class="num">${dec(porMil)}</td>
    </tr>`;
  }).join('');
  const tabRedes = `<div class="tabela-wrap"><table class="tab-texto met-tab">
    <thead><tr><th>Rede</th><th class="d">Seguidores</th><th class="d">Posts</th><th class="d">Alcance/dia</th><th class="d">Alcance por post</th><th class="d">Engajamento</th><th class="d">Salvamentos</th><th class="d">Seguidores por mil alcançados</th></tr></thead>
    <tbody>${linhasRede}</tbody></table></div>`;

  // destaques do período
  const top = [...c.posts].filter((p) => p.m.alcance).sort((a, b) => (engaj(b) ?? 0) * Math.sqrt(b.m.alcance) - (engaj(a) ?? 0) * Math.sqrt(a.m.alcance)).slice(0, 5);
  const destaques = top.length ? `<div class="met-cards">${top.map((p) => `
    <a class="met-card" href="${esc(p.link)}" target="_blank" rel="noopener">
      <span class="met-mini g" data-mini="${p.mini}"></span>
      <span class="met-card-t"><small>${dataCurta(p.dia)} · ${esc(p.formato)}${p.pub ? ' · ' + esc(NUCLEOS[p.nucleo]?.nome || '') : ''}</small>${esc(trecho(p.legenda, 70))}</span>
      <span class="met-card-n"><b>${pct(engaj(p))}</b> engaj. · ${n(p.m.alcance)} alcance${p.m.seguiu ? ` · +${n(p.m.seguiu)} seg.` : ''}</span>
    </a>`).join('')}</div>` : '<p class="met-vazio">Nenhum post no período.</p>';

  return {
    html: `
      ${bloco('Leituras do período', leituras, { dica: 'Frases geradas a partir dos números, com amostra mínima. Cada uma leva para a subpágina com o detalhe.' })}
      ${bloco('Redes', tabRedes, { dica: 'Só métricas equivalentes entre redes. Engajamento = interações ÷ alcance; salvamentos e seguidores ganhos também relativos ao alcance, para comparar contas de tamanhos diferentes. Setas: comparação com o período anterior de mesma duração.' })}
      ${bloco('Melhores posts do período', destaques, { dica: 'Ordenados por engajamento ponderado pelo alcance, para não premiar posts com alcance mínimo.' })}`,
    depois() {},
  };
}

// ===========================================================================
// Conteúdo

const AGRUPAR = [
  ['nucleo', 'Núcleo'], ['formato', 'Formato'], ['tema', 'Tema'], ['objetivo', 'Objetivo'],
  ['modelo', 'Modelo de capa'], ['dia', 'Dia da semana'], ['faixa', 'Horário'],
];

function codigoModelo(nucleo, modeloId) {
  const lista = modelosDo(nucleo);
  const i = lista.findIndex((m) => m.id === modeloId);
  return i < 0 ? null : `${NUCLEOS[nucleo].sigla.toUpperCase()}-${String(i + 1).padStart(2, '0')} ${lista[i].nome}`;
}

const chaveGrupo = {
  nucleo: [(p) => (p.nucleo === 'sem' ? null : p.nucleo), (k) => NUCLEOS[k]?.nome || k],
  formato: [(p) => p.formato, (k) => k],
  tema: [(p) => p.tema || null, (k) => k],
  objetivo: [(p) => p.objetivo || null, (k) => OBJETIVOS.find((o) => o[0] === k)?.[1] || k],
  modelo: [(p) => (p.pub?.capa ? `${p.pub.nucleo}|${p.pub.capa}` : null), (k) => { const [nu, ca] = k.split('|'); return codigoModelo(nu, ca) || ca; }],
  dia: [(p) => String(p.dow), (k) => DIAS_SEMANA_LONGO[k]],
  faixa: [(p) => faixaDe(p.hora), (k) => FAIXAS.find((f) => f[0] === k)?.[1] || k],
};

export function conteudo(N, c, L, ui) {
  const [chave, nome] = chaveGrupo[ui.agrupar] || chaveGrupo.nucleo;
  const { geral, linhas } = agrupar(c.posts, chave, nome);
  const ordenadas = ui.agrupar === 'dia'
    ? linhas.sort((a, b) => ((Number(a.k) + 6) % 7) - ((Number(b.k) + 6) % 7))
    : ui.agrupar === 'faixa' ? linhas.sort((a, b) => FAIXAS.findIndex((f) => f[0] === a.k) - FAIXAS.findIndex((f) => f[0] === b.k))
      : linhas.sort((a, b) => b.n - a.n);
  const semGrupo = c.posts.length - linhas.reduce((s, l) => s + l.n, 0);
  const ind = (v) => (v == null ? '' : `<span class="met-ind ${v >= 1.15 ? 'sobe' : v <= 0.85 ? 'desce' : ''}">${dec(v, 1)}×</span>`);
  const maxAlc = Math.max(1, ...ordenadas.map((l) => l.alcance || 0));
  const tabGrupos = ordenadas.length ? `<div class="tabela-wrap"><table class="tab-texto met-tab">
    <thead><tr><th>${esc(AGRUPAR.find((a) => a[0] === ui.agrupar)?.[1] || '')}</th><th class="d">Posts</th><th class="d">Alcance médio</th><th class="d">Engajamento</th><th class="d">vs média</th><th class="d">Salvamentos</th><th class="d">Compart.</th><th class="d">Seguidores / mil</th></tr></thead>
    <tbody>${ordenadas.map((l) => `<tr class="${l.n < 3 ? 'pouco' : ''}">
      <td><b>${esc(l.nome)}</b>${l.n < 3 ? ' <small class="met-sub in">amostra pequena</small>' : ''}</td>
      <td class="num">${n(l.n)}</td>
      <td class="num barra-c"><span class="met-barra"><i style="width:${((l.alcance || 0) / maxAlc) * 100}%"></i></span>${n(l.alcance)}</td>
      <td class="num">${pct(l.engaj)}</td><td class="num">${ind(l.ind)}</td>
      <td class="num">${pct(l.salvosTx)}</td><td class="num">${pct(l.compartTx)}</td><td class="num">${dec(l.seguiuMil)}</td>
    </tr>`).join('')}
    <tr class="sem"><td>Média geral</td><td class="num">${n(geral.n)}</td><td class="num">${n(geral.alcance)}</td><td class="num">${pct(geral.engaj)}</td><td></td><td class="num">${pct(geral.salvosTx)}</td><td class="num">${pct(geral.compartTx)}</td><td class="num">${dec(geral.seguiuMil)}</td></tr>
    </tbody></table></div>${semGrupo > 0 ? `<p class="met-nota">${semGrupo} post${semGrupo > 1 ? 's' : ''} sem ${esc((AGRUPAR.find((a) => a[0] === ui.agrupar)?.[1] || '').toLowerCase())} ficam fora desta comparação.</p>` : ''}`
    : `<p class="met-vazio">${ui.agrupar === 'tema' || ui.agrupar === 'objetivo' ? 'Marque tema e objetivo na tabela de posts abaixo para comparar.' : ui.agrupar === 'modelo' || ui.agrupar === 'nucleo' ? 'Ligue posts a publicações do Universo (tabela abaixo) para comparar.' : 'Nenhum post no período.'}</p>`;

  const seletor = `<div class="seg met-seg" data-grupo="agrupar">${AGRUPAR.map(([k, r]) => `<button data-v="${k}" class="${k === ui.agrupar ? 'ativo' : ''}">${r}</button>`).join('')}</div>`;

  return {
    html: `
      ${blocoLeituras(L, 'conteudo')}
      ${bloco('O que funciona', tabGrupos, { extra: seletor, dica: 'Compara grupos de posts do período. Engajamento = interações ÷ alcance (soma do grupo). “vs média” = engajamento do grupo ÷ engajamento médio. Grupos com menos de 3 posts aparecem esmaecidos: a diferença pode ser acaso.' })}
      ${bloco(`Posts <span class="cont">${c.posts.length}</span>`, tabelaPosts(N, c, ui), { dica: 'Tema e objetivo são seus: escreva um tema (o Universo sugere os já usados) e escolha o objetivo. A publicação do Universo liga o post ao núcleo e ao modelo de capa; quando só há uma publicação na mesma data, a ligação é automática (auto).' })}
      <datalist id="metTemas">${[...new Set(N.posts.map((p) => p.tema).filter(Boolean))].sort().map((t) => `<option value="${esc(t)}">`).join('')}</datalist>`,
    depois() {},
  };
}

const COLS = [
  ['data', 'Data', (p) => p.data],
  ['alcance', 'Alcance', (p) => p.m.alcance],
  ['inter', 'Interações', (p) => p.m.inter],
  ['engaj', 'Engaj.', (p) => engaj(p)],
  ['salvos', 'Salvos', (p) => p.m.salvos],
  ['compart', 'Compart.', (p) => p.m.compart],
  ['seguiu', 'Seguiram', (p) => p.m.seguiu],
  ['visitas', 'Visitas', (p) => p.m.visitas],
];

function opcoesPub(p, resumos) {
  const atual = p.vinc?.pub || '';
  const lista = resumos.filter((r) => (r.formato || '3x4') !== 'pin' && (!r.arquivado || r.id === atual)).sort((a, b) => (b.criado || '').localeCompare(a.criado || ''));
  const rot = (r) => `${r.criado ? dataCurta(r.criado.slice(0, 10)) + ' · ' : ''}${NUCLEOS[r.nucleo]?.nome || ''} · ${r.titulo || 'sem título'}`;
  return `<option value="">${p.vinc && !p.vinc.pub ? 'Sem publicação' : '— ligar —'}</option>
    ${p.vinc && !p.vinc.pub ? '' : '<option value="-">Sem publicação</option>'}
    ${lista.map((r) => `<option value="${esc(r.id)}" ${r.id === atual ? 'selected' : ''}>${esc(rot(r))}</option>`).join('')}`;
}

function tabelaPosts(N, c, ui) {
  if (!c.posts.length) return '<p class="met-vazio">Nenhum post no período.</p>';
  const col = COLS.find((k) => k[0] === ui.ordem.col) || COLS[0];
  const posts = [...c.posts].sort((a, b) => {
    const va = col[2](a); const vb = col[2](b);
    if (va == null) return 1; if (vb == null) return -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * (ui.ordem.desc ? -1 : 1);
  });
  const th = ([k, r]) => `<th class="ord ${k === 'data' ? '' : 'd'} ${ui.ordem.col === k ? (ui.ordem.desc ? 'desc' : 'asc') : ''}" data-ord="${k}">${r}</th>`;
  return `<div class="tabela-wrap"><table class="tab-texto met-tab met-posts">
    <thead><tr><th></th>${th(COLS[0])}<th>Post</th><th>Tema</th><th>Objetivo</th><th>Publicação do Universo</th>${COLS.slice(1).map(th).join('')}</tr></thead>
    <tbody>${posts.map((p) => `<tr>
      <td class="mini-c"><a href="${esc(p.link)}" target="_blank" rel="noopener" class="met-mini" data-mini="${p.mini}"></a></td>
      <td class="dt">${dataCurta(p.dia)}<small class="met-sub">${DIAS_SEMANA[p.dow]} ${String(p.hora).padStart(2, '0')}h</small></td>
      <td class="leg"><span class="met-tipo">${esc(p.formato)}</span> <a href="${esc(p.link)}" target="_blank" rel="noopener" title="${esc(p.legenda)}">${esc(trecho(p.legenda, 70))}</a></td>
      <td><input class="met-tag" list="metTemas" data-tema="${esc(p.chave)}" value="${esc(p.tema)}" placeholder="tema" maxlength="40"></td>
      <td><select class="met-obj ${p.objetivo ? 'ligado' : ''}" data-objetivo="${esc(p.chave)}"><option value="">—</option>${OBJETIVOS.map(([k, r, d]) => `<option value="${k}" title="${esc(d)}" ${p.objetivo === k ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
      <td class="vinc">${p.rede === 'instagram' ? `<select data-vincular="${p.id}" class="${p.pub ? 'ligado' : ''}">${opcoesPub(p, ui.resumos)}</select>${p.vinc?.auto ? '<small class="auto" title="Ligado automaticamente pela data de publicação">auto</small>' : ''}` : ''}</td>
      <td class="num">${n(p.m.alcance)}</td><td class="num">${n(p.m.inter)}</td><td class="num">${pct(engaj(p))}</td>
      <td class="num">${n(p.m.salvos)}</td><td class="num">${n(p.m.compart)}</td><td class="num">${n(p.m.seguiu)}</td><td class="num">${n(p.m.visitas)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

// ===========================================================================
// Público

const GRUPOS_PUB = [['seguidores', 'Seguidores'], ['alcancados', 'Alcançados'], ['engajados', 'Engajados']];
const ORDEM_IDADE = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENERO = { F: 'Mulheres', M: 'Homens', U: 'Não informado' };

const dist = (obj) => { const t = Object.values(obj || {}).reduce((a, b) => a + b, 0); return { t, p: (k) => (t ? (obj[k] || 0) / t : null) }; };

export function publico(N, c, L, ui) {
  const pub = N.publico.instagram || {};
  const g = pub[ui.grupoPub] || {};
  const temAlgo = GRUPOS_PUB.some(([k]) => pub[k]?.idade || pub[k]?.cidade);
  if (!temAlgo) {
    const erro = GRUPOS_PUB.map(([k]) => pub[k]?.erro).find(Boolean);
    return { html: `${blocoLeituras(L, 'publico')}<section class="met-bloco"><p class="met-vazio">${erro ? `O Instagram respondeu: ${esc(erro)}` : 'O público é coletado aos poucos (até 6 consultas por coleta, renovadas toda semana). Use “Atualizar agora” ou espere a coleta das 6h.'}</p></section>`, depois() {} };
  }
  const seletor = `<div class="seg met-seg" data-grupo="grupoPub">${GRUPOS_PUB.map(([k, r]) => `<button data-v="${k}" class="${k === ui.grupoPub ? 'ativo' : ''}">${r}</button>`).join('')}</div>`;
  const janela = g.janela === 'this_week' ? 'semana corrente' : g.janela === 'this_month' ? 'mês corrente' : 'total';
  const di = dist(g.idade);
  const idade = barras(ORDEM_IDADE.filter((k) => g.idade?.[k] != null).map((k) => ({ rot: k, v: di.p(k), tip: `<b>${k} anos</b> ${pct(di.p(k))} · ${n(g.idade[k])} contas` })), { fmt: (v) => pct(v, 0) });
  const dg = dist(g.genero);
  const genero = g.genero ? `<div class="met-kpis tres">${['F', 'M', 'U'].filter((k) => g.genero[k] != null).map((k) => `<div class="met-kpi"><span>${GENERO[k]}</span><b>${pct(dg.p(k), 0)}</b><small>${n(g.genero[k])} contas</small></div>`).join('')}</div>` : '<p class="met-vazio">Sem dados de gênero.</p>';
  const dc = dist(g.cidade);
  const cidades = barras(Object.entries(g.cidade || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ rot: k.split(',')[0], v: dc.p(k), tip: `<b>${esc(k)}</b> ${pct(dc.p(k))} · ${n(v)} contas` })), { fmt: (v) => pct(v, 0) });
  const dp = dist(g.pais);
  const paises = barras(Object.entries(g.pais || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ rot: k, v: dp.p(k), tip: `<b>${esc(k)}</b> ${pct(dp.p(k))} · ${n(v)} contas` })), { fmt: (v) => pct(v, 0) });

  // seguidores × engajados por idade: quem interage é diferente de quem segue?
  let comp = '';
  if (pub.seguidores?.idade && pub.engajados?.idade) {
    const s = dist(pub.seguidores.idade); const e = dist(pub.engajados.idade);
    comp = bloco('Quem segue × quem interage', `<div class="tabela-wrap"><table class="tab-texto met-tab">
      <thead><tr><th>Idade</th><th class="d">Seguidores</th><th class="d">Engajados</th><th class="d">Diferença</th></tr></thead>
      <tbody>${ORDEM_IDADE.filter((k) => pub.seguidores.idade[k] != null || pub.engajados.idade[k] != null).map((k) => {
        const d = (e.p(k) || 0) - (s.p(k) || 0);
        return `<tr><td><b>${k}</b></td><td class="num">${pct(s.p(k), 0)}</td><td class="num">${pct(e.p(k), 0)}</td><td class="num"><span class="met-ind ${d >= 0.03 ? 'sobe' : d <= -0.03 ? 'desce' : ''}">${d > 0 ? '+' : ''}${dec(d * 100, 0)} p.p.</span></td></tr>`;
      }).join('')}</tbody></table></div>`, { dica: 'Positivo: a faixa interage mais do que o tamanho dela na base de seguidores faria esperar.' });
  }
  const hist = Object.keys(N.publicoHist.instagram || {}).sort();
  return {
    html: `
      ${blocoLeituras(L, 'publico')}
      <section class="met-bloco"><div class="met-bloco-cab"><h2>Perfil do público ${info('Seguidores: a base atual. Alcançados: quem viu algum conteúdo. Engajados: quem interagiu. Alcançados e engajados se referem à janela informada pelo Instagram. O Instagram só informa contas com 100 seguidores ou mais e mostra as 45 maiores cidades e países.')}</h2>${seletor}</div>
        <p class="met-nota">${GRUPOS_PUB.find((x) => x[0] === ui.grupoPub)[1]} · ${ui.grupoPub === 'seguidores' ? 'base atual' : janela}${g.em?.idade ? ` · atualizado em ${new Date(g.em.idade).toLocaleDateString('pt-BR')}` : ''}${g.erro ? ` · <span class="alerta">${esc(g.erro)}</span>` : ''}</p>
        <div class="met-grade2">
          <div><h3 class="met-h3">Idade</h3>${idade}</div>
          <div><h3 class="met-h3">Gênero</h3>${genero}<h3 class="met-h3">Países</h3>${paises}</div>
        </div>
        <h3 class="met-h3">Cidades</h3>${cidades}
      </section>
      ${comp}
      ${hist.length ? `<p class="met-nota">Histórico semanal do perfil dos seguidores guardado desde ${dataCurta(hist[0])} (${hist.length} registro${hist.length > 1 ? 's' : ''}).</p>` : ''}`,
    depois() {},
  };
}

// ===========================================================================
// Horários

export function horarios(N, c, L, ui) {
  const desde = diaLocal(Date.now() - 42 * DIA);
  const mat = matrizOnline(N.online.instagram, desde);
  const marcas = {};
  for (const p of c.posts) {
    const k = `${p.dow}-${p.hora}`;
    marcas[k] = marcas[k] ? `${marcas[k].split(' ')[0] * 1 + 1} posts publicados` : '1 post publicado';
  }
  const top = melhoresJanelas(mat, 5);
  const calor = mapaCalor(mat.m, { marcas, nome: 'seguidores online (média)' });

  // desempenho por dia da semana × faixa de horário
  const grade = Array.from({ length: 7 }, () => Object.fromEntries(FAIXAS.map((f) => [f[0], []])));
  for (const p of c.posts) grade[p.dow][faixaDe(p.hora)].push(p);
  const geral = resumo(c.posts);
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  const tabela = c.posts.length ? `<div class="tabela-wrap"><table class="tab-texto met-tab met-grade-h">
    <thead><tr><th></th>${FAIXAS.map((f) => `<th class="d">${f[1]} <small>${f[2]}–${f[3]}h</small></th>`).join('')}</tr></thead>
    <tbody>${ordem.map((dow) => `<tr><td><b>${DIAS_SEMANA[dow]}</b></td>${FAIXAS.map((f) => {
      const ps = grade[dow][f[0]];
      if (!ps.length) return '<td class="num vazio">·</td>';
      const r = resumo(ps);
      const ind = geral.alcance && r.alcance ? r.alcance / geral.alcance : null;
      return `<td class="num"><span class="met-ind ${ind >= 1.15 ? 'sobe' : ind <= 0.85 ? 'desce' : ''}" data-tip="${esc(`<b>${DIAS_SEMANA_LONGO[dow]}, ${f[1].toLowerCase()}</b><br>${ps.length} post(s) · alcance médio ${n(r.alcance)} · engajamento ${pct(r.engaj)}`)}">${n(r.alcance)}</span><small class="met-sub">${ps.length} post${ps.length > 1 ? 's' : ''}</small></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="met-vazio">Nenhum post no período.</p>';

  return {
    html: `
      ${blocoLeituras(L, 'horarios')}
      ${bloco('Quando os seguidores estão online', `<div class="met-painel">${calor}</div>
        ${top.length ? `<p class="met-nota">Pico de cada dia, do mais forte ao mais fraco: ${top.map((t) => `<b>${DIAS_SEMANA_LONGO[t.dow]} ${String(t.h).padStart(2, '0')}h</b>`).join(' · ')} · média de ${mat.ndias} dia${mat.ndias === 1 ? '' : 's'} (últimas 6 semanas), em hora de Brasília.</p>` : ''}`,
        { dica: 'Média de seguidores com o Instagram aberto, por dia da semana e hora (Brasília). Os quadrados com contorno marcam horários em que houve post publicado no período escolhido. O Instagram só mantém 30 dias deste dado; o Universo guarda o histórico.' })}
      ${bloco('Alcance dos posts por dia e horário', tabela, { dica: 'Alcance médio dos posts publicados em cada dia e faixa de horário, no período. Verde/vermelho: acima/abaixo da média do período. Com poucos posts por célula, trate como pista, não como regra.' })}`,
    depois() {},
  };
}

// ===========================================================================
// Crescimento

const SERIES_CRESC = [
  ['seguidores', 'Seguidores (total)'], ['seguiram', 'Começaram a seguir'], ['deixaram', 'Deixaram de seguir'],
  ['visitas', 'Visitas ao perfil'], ['alcNao', 'Alcance de não seguidores'], ['toques', 'Toques em links do perfil'],
];

export function crescimento(N, c, L, ui) {
  const D = c.dias.instagram;
  const alcance = somaDias(D, 'alcance');
  const alcSeg = somaDias(D, 'alcSeg');
  const alcNao = somaDias(D, 'alcNao');
  const visitas = somaDias(D, 'visitas');
  const seguiram = somaDias(D, 'seguiram');
  const deixaram = somaDias(D, 'deixaram');
  const toques = somaDias(D, 'toques');
  const ganho = ganhoSeguidores(N, c);
  const etapa = (rot, v, nota, taxaTxt) => `<div class="met-etapa"><span>${rot}</span><b>${nc(v)}</b><small>${nota}</small>${taxaTxt ? `<em>${taxaTxt}</em>` : ''}</div>`;
  const funil = `<div class="met-funil">
    ${etapa('Descoberta', alcNao ?? alcance, alcNao != null ? 'contas alcançadas que não seguem' : 'contas alcançadas (soma diária)', '')}
    ${etapa('Interesse', visitas, 'visitas ao perfil', visitas != null && alcance ? `${pct(visitas / alcance)} do alcance` : '')}
    ${etapa('Seguiram', seguiram, `${n(deixaram)} deixaram · saldo ${sinal(ganho)}`, seguiram != null && visitas ? `${pct(seguiram / visitas)} das visitas` : '')}
    ${etapa('Ação', toques, 'toques em links, e-mail, rota…', toques != null && visitas ? `${pct(toques / visitas)} das visitas` : '')}
  </div>`;
  const serie = SERIES_CRESC.find((s) => s[0] === ui.serieCresc) || SERIES_CRESC[0];
  const vals = D.map((x) => x[serie[0]] ?? null);
  const comPost = new Set(c.posts.map((p) => p.dia));
  const nPorDia = {};
  for (const p of c.posts) nPorDia[p.dia] = (nPorDia[p.dia] || 0) + 1;
  const g = linha({ eixo: c.eixo, valores: vals, nome: serie[1], zero: serie[0] !== 'seguidores', marcas: comPost, notaMarca: (d) => (nPorDia[d] ? `${nPorDia[d]} post(s) publicado(s)` : '') });
  const seletor = `<div class="seg met-seg" data-grupo="serieCresc">${SERIES_CRESC.map(([k, r]) => `<button data-v="${k}" class="${k === serie[0] ? 'ativo' : ''}">${r}</button>`).join('')}</div>`;

  const rank = (k, rot) => {
    const ps = c.posts.filter((p) => p.m[k] > 0).sort((a, b) => b.m[k] - a.m[k]).slice(0, 5);
    return ps.length ? `<ol class="met-rank">${ps.map((p) => `<li><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(trecho(p.legenda, 60))}</a><small>${dataCurta(p.dia)} · ${esc(p.formato)}</small><b>${n(p.m[k])}</b></li>`).join('')}</ol>`
      : `<p class="met-vazio">Sem dados de ${rot} por post no período (o Instagram informa só para posts do feed).</p>`;
  };
  return {
    html: `
      ${blocoLeituras(L, 'crescimento')}
      ${bloco('Do alcance ao contato', funil, { dica: 'Soma diária da conta no período. Descoberta: alcance entre quem não segue. Interesse: visitas ao perfil. Seguiram: novos seguidores. Ação: toques nos botões e links do perfil. A fase 2 liga aqui as visitas ao site.' })}
      ${bloco('Alcance: seguidores × não seguidores', divisao(alcSeg, alcNao, 'Seguidores', 'Não seguidores'), { dica: 'Quanto maior a parte de não seguidores, mais o conteúdo está saindo da bolha. Soma diária do período.' })}
      ${bloco('Por dia', g.html, { extra: seletor, dica: 'Números diários da conta. Os tracinhos ocre marcam dias com post.' })}
      <div class="met-grade2">
        ${bloco('Posts que mais trouxeram seguidores', rank('seguiu', 'seguidores'))}
        ${bloco('Posts que mais levaram ao perfil', rank('visitas', 'visitas'))}
      </div>`,
    depois(raiz) { g.ligar(raiz); },
  };
}

// ===========================================================================
// Concorrentes

export function concorrentes(N, c, L, ui) {
  const { max, contas } = N.concorrentes;
  const est = N.contas.instagram || {};
  const cheio = contas.length >= max;
  const form = `<form class="met-addconc" id="metAddConc">
      <input type="text" id="metConcUser" placeholder="@usuario ou link do perfil" autocomplete="off" ${cheio ? 'disabled' : ''}>
      <button type="submit" ${cheio ? 'disabled' : ''}>Adicionar</button>
      <span class="met-limite ${cheio ? 'cheio' : ''}">${contas.length} de ${max} contas${cheio ? ' · remova uma para trocar' : ''}</span>
      <p class="met-msg" id="metConcMsg" role="status"></p>
    </form>`;
  const od = resumoOdissePublico(N, est);
  const corteOd = diaLocal(Date.now() - 30 * DIA);
  const postsOd30 = N.posts.filter((p) => p.rede === 'instagram' && p.dia >= corteOd);
  const fmtOd = {};
  for (const p of od.ultimos) fmtOd[p.formato] = (fmtOd[p.formato] || 0) + 1;
  const formatos = (f, tot) => Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${esc(k)} ${pct(v / tot, 0)}`).join(' · ') || '—';
  const linhaOd = `<tr class="odisse">
    <td><span class="met-avatar" ${est.foto ? `style="background-image:url('${esc(est.foto)}')"` : ''}></span><b>@${esc(est.usuario || 'odisse')}</b><small class="met-sub">Odisse</small></td>
    <td class="num">${n(est.seguidores)}</td><td class="num">${sinal(ganhoSeguidores(N, { ...c, inicio: corteOd, dias: { instagram: [] } }))}</td>
    <td class="num">${dec(postsOd30.length / (30 / 7))}</td><td class="num">${pct(od.engMediana, 2)}</td><td class="num">${n(od.comMediana)}</td>
    <td>${formatos(fmtOd, od.ultimos.length)}</td><td class="num">${postsOd30[0] ? dataCurta(postsOd30.sort((a, b) => b.dia.localeCompare(a.dia))[0].dia) : '—'}</td><td></td>
  </tr>`;
  const linhas = contas.map((x) => {
    const r = resumoConcorrente(x);
    const p = x.perfil || {};
    return `<tr>
      <td><span class="met-avatar" ${p.foto ? `style="background-image:url('${esc(p.foto)}')"` : ''}></span><a href="https://www.instagram.com/${esc(x.usuario)}/" target="_blank" rel="noopener"><b>@${esc(x.usuario)}</b></a><small class="met-sub">${esc(p.nome || '')}${x.erro ? ` · <span class="alerta" title="${esc(x.erro)}">erro na última coleta</span>` : ''}</small></td>
      <td class="num">${n(r.seguidores)}</td>
      <td class="num">${r.ganho == null ? `<small class="met-sub in" title="A variação aparece depois de alguns dias acompanhando a conta">desde ${dataCurta(x.desde ? diaLocal(x.desde) : null)}</small>` : sinal(r.ganho)}</td>
      <td class="num">${dec(r.porSemana)}</td>
      <td class="num">${r.curtidasOcultas ? '<small class="met-sub in" title="A conta esconde as curtidas: compare pelos comentários">curtidas ocultas</small>' : `${pct(r.engMediana, 2)}${r.nVisiveis < r.nUltimos ? `<small class="met-sub" title="A conta esconde as curtidas nos demais posts">${r.nVisiveis} de ${r.nUltimos} posts</small>` : ''}`}</td>
      <td class="num">${n(r.comMediana)}</td>
      <td>${formatos(r.formatos, r.ultimos.length)}</td>
      <td class="num">${dataCurta(r.ultimo)}</td>
      <td class="acoes"><button class="bt-link" data-conc-atualizar="${esc(x.usuario)}" title="Buscar os números agora">atualizar</button><button class="bt-link perigo" data-conc-remover="${esc(x.usuario)}">remover</button></td>
    </tr>`;
  }).join('');
  const tabela = `<div class="tabela-wrap"><table class="tab-texto met-tab met-conc">
    <thead><tr><th>Conta</th><th class="d">Seguidores</th><th class="d">Variação 30 dias</th><th class="d">Posts / semana</th><th class="d">Engaj. público</th><th class="d">Coment. / post</th><th>Formatos</th><th class="d">Último post</th><th></th></tr></thead>
    <tbody>${linhaOd}${linhas || ''}</tbody></table></div>
    ${contas.length ? '' : '<p class="met-vazio">Adicione até ' + max + ' contas profissionais pelo @.</p>'}`;

  // posts fora da curva (acima da mediana da própria conta), no período
  const fora = [];
  for (const x of contas) {
    const r = resumoConcorrente(x);
    for (const p of x.posts) {
      if (p.dia < c.inicio) continue;
      const f = r.fator(p);
      if (f != null && f >= 1.3) fora.push({ x, p, f });
    }
  }
  fora.sort((a, b) => b.f - a.f);
  const destaques = fora.length ? `<div class="tabela-wrap"><table class="tab-texto met-tab met-posts">
    <thead><tr><th>Conta</th><th>Data</th><th>Post</th><th class="d">Curtidas</th><th class="d">Coment.</th><th class="d">Visualiz.</th><th class="d">vs mediana da conta</th></tr></thead>
    <tbody>${fora.slice(0, 12).map(({ x, p, f }) => `<tr>
      <td><b>@${esc(x.usuario)}</b></td><td class="dt">${dataCurta(p.dia)}</td>
      <td class="leg"><span class="met-tipo">${esc(p.produto === 'REELS' ? 'Reel' : { CAROUSEL_ALBUM: 'Carrossel', IMAGE: 'Imagem', VIDEO: 'Vídeo' }[p.tipo] || p.tipo)}</span> <a href="${esc(p.link)}" target="_blank" rel="noopener" title="${esc(p.legenda)}">${esc(trecho(p.legenda, 70))}</a></td>
      <td class="num">${n(p.curtidas)}</td><td class="num">${n(p.comentarios)}</td><td class="num">${n(p.views)}</td>
      <td class="num"><span class="met-ind ${f >= 1.5 ? 'sobe' : f <= 0.67 ? 'desce' : ''}">${dec(f, 1)}×</span></td>
    </tr>`).join('')}</tbody></table></div>` : '<p class="met-vazio">Nenhum post de concorrente acima de 1,3× a própria mediana no período.</p>';

  return {
    html: `
      ${blocoLeituras(L, 'concorrentes')}
      ${bloco('Contas acompanhadas', form + tabela, { dica: 'Só dados públicos de contas profissionais: seguidores e, de cada post, curtidas, comentários e visualizações (vídeos). Alcance e salvamentos de outras contas não existem na API. Engajamento público = mediana de (curtidas + comentários) ÷ seguidores nos últimos 30 posts, só entre os posts com curtidas visíveis (muitas contas escondem as curtidas; nesse caso, compare pelos comentários por post). A mesma conta é feita para o Odisse. Coleta diária às 6h; a variação de seguidores começa a contar do dia em que a conta entra na lista.' })}
      ${bloco('Posts que se destacaram', destaques, { dica: 'Posts dos concorrentes no período que superaram em 30% ou mais a mediana da própria conta, do maior para o menor. Com curtidas visíveis, compara curtidas + comentários; com curtidas ocultas, só os comentários.' })}`,
    depois() {},
  };
}

// ===========================================================================
// Instagram (o que é só desta rede)

const SERIES_IG = [['views', 'Visualizações'], ['alcance', 'Alcance'], ['interacoes', 'Interações'], ['contas', 'Contas engajadas']];

export function instagram(N, c, L, ui) {
  const D = c.dias.instagram;
  const serie = SERIES_IG.find((s) => s[0] === ui.serieIG) || SERIES_IG[0];
  const nPorDia = {};
  for (const p of c.posts) nPorDia[p.dia] = (nPorDia[p.dia] || 0) + 1;
  const g = linha({ eixo: c.eixo, valores: D.map((x) => x[serie[0]] ?? null), nome: serie[1], marcas: new Set(Object.keys(nPorDia)), notaMarca: (d) => (nPorDia[d] ? `${nPorDia[d]} post(s) publicado(s)` : '') });
  const seletor = `<div class="seg met-seg" data-grupo="serieIG">${SERIES_IG.map(([k, r]) => `<button data-v="${k}" class="${k === serie[0] ? 'ativo' : ''}">${r}</button>`).join('')}</div>`;
  const kpis = `<div class="met-kpis">
    ${[['Visualizações', nc(somaDias(D, 'views')), 'soma diária'], ['Alcance por dia', nc(mediaDias(D, 'alcance')), 'média de contas alcançadas'],
      ['Interações', nc(somaDias(D, 'interacoes')), 'curtidas, comentários, salvos, compart.'], ['Contas engajadas', nc(mediaDias(D, 'contas')), 'média diária'],
      ['Salvamentos', nc(somaDias(D, 'salvos')), 'soma diária'], ['Compartilhamentos', nc(somaDias(D, 'compart')), 'soma diária']]
      .map(([r, v, s]) => `<div class="met-kpi"><span>${r}</span><b>${v}</b><small>${s}</small></div>`).join('')}</div>`;

  const reels = c.posts.filter((p) => p.formato === 'Reel');
  const tabReels = reels.length ? `<div class="tabela-wrap"><table class="tab-texto met-tab met-posts">
    <thead><tr><th>Data</th><th>Reel</th><th class="d">Visualiz.</th><th class="d">Alcance</th><th class="d">Tempo médio assistido</th><th class="d">Compart.</th><th class="d">Engaj.</th></tr></thead>
    <tbody>${reels.map((p) => `<tr><td class="dt">${dataCurta(p.dia)}</td><td class="leg"><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(trecho(p.legenda, 70))}</a></td>
      <td class="num">${n(p.m.views)}</td><td class="num">${n(p.m.alcance)}</td><td class="num">${p.proprias.retencao == null ? '—' : dec(p.proprias.retencao) + ' s'}</td>
      <td class="num">${n(p.m.compart)}</td><td class="num">${pct(engaj(p))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="met-vazio">Nenhum Reel no período.</p>';

  const st = N.stories.filter((s) => s.dia >= c.inicio);
  const tabStories = st.length ? `<div class="tabela-wrap"><table class="tab-texto met-tab">
    <thead><tr><th>Data</th><th>Tipo</th><th class="d">Alcance</th><th class="d">Visualiz.</th><th class="d">Respostas</th><th class="d">Compart.</th><th class="d">Seguiram</th><th class="d">Visitas ao perfil</th><th class="d">Medido com</th></tr></thead>
    <tbody>${st.map((s) => `<tr><td class="dt"><a href="${esc(s.link)}" target="_blank" rel="noopener">${dataCurta(s.dia)}</a></td><td>${s.tipo === 'VIDEO' ? 'Vídeo' : 'Imagem'}</td>
      <td class="num">${n(s.m.alcance)}</td><td class="num">${n(s.m.views)}</td><td class="num">${n(s.m.respostas)}</td><td class="num">${n(s.m.compart)}</td><td class="num">${n(s.m.seguiu)}</td><td class="num">${n(s.m.visitas)}</td>
      <td class="num"><small class="met-sub in">${s.idadeH} h no ar</small></td></tr>`).join('')}</tbody></table></div>`
    : '<p class="met-vazio">Nenhum story capturado no período. Stories ficam só 24 h no ar: o Universo guarda os que estiverem publicados no momento da coleta (6h ou “Atualizar agora”).</p>';

  return {
    html: `
      ${kpis}
      ${bloco('Conta por dia', g.html, { extra: seletor, dica: 'Números diários da conta toda (inclui posts antigos, stories e reels). O dia de ontem ainda pode mudar. Os tracinhos ocre marcam dias com post.' })}
      ${bloco('Reels', tabReels, { dica: 'Tempo médio assistido por visualização. Compare com a duração do reel para saber se as pessoas chegam ao fim.' })}
      ${bloco('Stories', tabStories, { dica: 'Os números de um story só existem enquanto ele está no ar. “Medido com” indica há quantas horas ele estava publicado na última coleta — quanto mais perto de 24 h, mais completo.' })}`,
    depois(raiz) { g.ligar(raiz); },
  };
}

// ===========================================================================
// Conexões

export function conexoes(N, c, L, ui) {
  const est = N.contas.instagram || {};
  const quando = (t) => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'nunca');
  const pub = N.publico.instagram || {};
  const nOnline = Object.keys(N.online.instagram || {}).filter((d) => !d.startsWith('_')).length;
  const nDias = Object.keys(N.dias.instagram || {}).length;
  const ig = `<div class="met-conex">
    <div class="met-conex-cab"><b>Instagram</b><span class="met-ok">conectado</span></div>
    <dl>
      <dt>Conta</dt><dd>@${esc(est.usuario || '')} · ${n(est.seguidores)} seguidores</dd>
      <dt>Acesso</dt><dd>${est.modo === 'unificado' ? 'login unificado do Meta (token de usuário do sistema, não expira)' : `token do Instagram${est.expira ? `, expira em ${Math.round((est.expira - Date.now()) / DIA)} dias` : ''}`}</dd>
      <dt>Última coleta</dt><dd>${quando(est.ultimaColeta)}${est.chamadas ? ` · ${est.chamadas} consultas` : ''}</dd>
      <dt>Histórico</dt><dd>${nDias} dias da conta · ${N.posts.length} posts · ${nOnline} dias de horários · ${N.stories.length} stories</dd>
      <dt>Público</dt><dd>${GRUPOS_PUB.map(([k, r]) => `${r}: ${pub[k]?.em?.idade ? new Date(pub[k].em.idade).toLocaleDateString('pt-BR') : 'pendente'}`).join(' · ')}</dd>
      <dt>Concorrentes</dt><dd>${N.concorrentes.contas.length} de ${N.concorrentes.max} contas</dd>
    </dl>
    ${est.erro ? `<p class="met-erro">${esc(est.erro)}</p>` : ''}
    ${est.avisos?.length ? `<details class="met-alt"><summary>${est.avisos.length} aviso(s) da última coleta</summary><ul class="met-avisos">${est.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}
    <div class="met-acoes"><button class="bt-padroes" id="metAtualizar2">Atualizar agora</button><button class="bt-link" id="metDesconectar" title="Esquecer o token (o histórico fica guardado)">Desconectar</button></div>
  </div>`;
  const outras = REDES.filter((r) => r.id !== 'instagram').map((r) => `<div class="met-conex off"><div class="met-conex-cab"><b>${esc(r.nome)}</b><span>em breve</span></div><p class="met-nota">Entra na fase 2. As páginas já estão prontas para recebê-la: posts, público e horários aparecem junto com o Instagram.</p></div>`).join('');
  return {
    html: bloco('Conexões', `<div class="met-conex-grade">${ig}${outras}</div>`, { dica: 'A coleta roda todo dia às 6h (Brasília). Cada coleta faz no máximo 42 consultas ao Meta; o que não couber fica para a seguinte.' }),
    depois() {},
  };
}
