// Métricas — leituras automáticas: frases curtas que dizem o que os números mostram.
// Cada regra só fala quando há amostra suficiente; com poucos posts, diz isso.
//
// Uma leitura: { pag, tom: 'bom'|'atencao'|'neutro', txt (HTML), peso }

import { resumo, agrupar, ganhoSeguidores, somaDias, matrizOnline, melhoresJanelas, resumoConcorrente,
  DIAS_SEMANA_LONGO, FAIXAS, faixaDe, OBJETIVOS, diaLocal, DIA, def } from './modelo.js';
import { n, pct, dec, esc, sinal } from './graficos.js';
import { NUCLEOS, ORDEM_NUCLEOS } from '../nucleos.js';

const MIN_GRUPO = 3; // posts mínimos em um grupo para comparar com a média
const vezes = (r) => `${dec(r, 1)}×`;
const hora = (h) => `${String(h).padStart(2, '0')}h`;

export function gerarLeituras(N, c) {
  const L = [];
  const add = (pag, tom, txt, peso = 1) => L.push({ pag, tom, txt, peso });
  const posts = c.posts;
  const geral = resumo(posts);
  const est = N.contas.instagram || {};

  // ---- Crescimento
  const ganho = ganhoSeguidores(N, c);
  const seguiram = somaDias(c.dias.instagram, 'seguiram');
  const deixaram = somaDias(c.dias.instagram, 'deixaram');
  if (ganho != null) {
    const det = seguiram != null ? ` (${n(seguiram)} começaram a seguir, ${n(deixaram || 0)} deixaram)` : '';
    add('crescimento', ganho > 0 ? 'bom' : ganho < 0 ? 'atencao' : 'neutro',
      `Saldo de <b>${sinal(ganho)} seguidores</b> no período${det}.`, 2);
  }
  const alcSeg = somaDias(c.dias.instagram, 'alcSeg');
  const alcNao = somaDias(c.dias.instagram, 'alcNao');
  if (alcSeg != null && alcNao != null && alcSeg + alcNao > 0) {
    const pn = alcNao / (alcSeg + alcNao);
    const antS = somaDias(c.diasAnt.instagram, 'alcSeg');
    const antN = somaDias(c.diasAnt.instagram, 'alcNao');
    const pAnt = antS != null && antN != null && antS + antN > 0 ? antN / (antS + antN) : null;
    const comp = pAnt != null && Math.abs(pn - pAnt) >= 0.05 ? `, ${pn > pAnt ? 'mais' : 'menos'} que no período anterior (${pct(pAnt, 0)})` : '';
    add('crescimento', pn >= 0.5 ? 'bom' : 'neutro',
      `<b>${pct(pn, 0)} do alcance</b> foi de quem ainda não segue o Odisse${comp}. ${pn < 0.3 ? 'Os posts estão circulando pouco fora da base atual.' : ''}`, 2);
  }
  const comSeguiu = posts.filter((p) => p.m.seguiu > 0).sort((a, b) => b.m.seguiu - a.m.seguiu);
  if (comSeguiu.length) {
    const p = comSeguiu[0];
    add('crescimento', 'bom', `O post que mais trouxe seguidores foi ${rotPost(p)}: <b>${n(p.m.seguiu)}</b> ${p.m.seguiu === 1 ? 'novo seguidor' : 'novos seguidores'}.`, 1.5);
  }

  // ---- Conteúdo
  if (posts.length < MIN_GRUPO) {
    add('conteudo', 'neutro', `Só ${posts.length} post${posts.length === 1 ? '' : 's'} no período: ainda é cedo para comparar núcleos, formatos e temas.`, 0.5);
  } else {
    const nuc = agrupar(posts, (p) => (p.nucleo === 'sem' ? null : p.nucleo), (k) => NUCLEOS[k]?.nome || k)
      .linhas.filter((l) => l.n >= MIN_GRUPO && l.ind != null).sort((a, b) => b.ind - a.ind);
    if (nuc.length >= 2 && nuc[0].ind >= 1.15) {
      add('conteudo', 'bom', `Posts de <b>${esc(nuc[0].nome)}</b> engajam <b>${vezes(nuc[0].ind)}</b> a média (${pct(nuc[0].engaj)} contra ${pct(geral.engaj)}, ${nuc[0].n} posts).`, 2);
      const pior = nuc.at(-1);
      if (pior.ind <= 0.85) add('conteudo', 'atencao', `<b>${esc(pior.nome)}</b> fica abaixo da média de engajamento (${vezes(pior.ind)}, ${pior.n} posts).`, 1);
    }
    const fmt = agrupar(posts, (p) => p.formato).linhas.filter((l) => l.n >= 2 && l.indAlc != null).sort((a, b) => b.indAlc - a.indAlc);
    if (fmt.length >= 2 && fmt[0].indAlc / fmt.at(-1).indAlc >= 1.3) {
      add('conteudo', 'neutro', `<b>${esc(fmt[0].nome)}</b> alcança em média <b>${n(fmt[0].alcance)}</b> contas por post; <b>${esc(fmt.at(-1).nome)}</b>, ${n(fmt.at(-1).alcance)}.`, 1.5);
    }
    const tem = agrupar(posts, (p) => p.tema).linhas.filter((l) => l.n >= 2 && l.ind != null).sort((a, b) => b.ind - a.ind);
    if (tem.length >= 2 && tem[0].ind >= 1.15) add('conteudo', 'bom', `O tema <b>${esc(tem[0].nome)}</b> engaja ${vezes(tem[0].ind)} a média (${tem[0].n} posts).`, 1.5);
    const salvos = posts.filter((p) => p.m.alcance >= 50 && def(p.m.salvos)).sort((a, b) => b.m.salvos / b.m.alcance - a.m.salvos / a.m.alcance);
    if (salvos.length >= 3 && geral.salvosTx) {
      const p = salvos[0];
      const r = p.m.salvos / p.m.alcance / geral.salvosTx;
      if (r >= 1.8) add('conteudo', 'bom', `${rotPost(p)} foi salvo por ${pct(p.m.salvos / p.m.alcance)} de quem viu, <b>${vezes(r)}</b> a média — salvamento indica conteúdo de referência.`, 1.5);
    }
    const semTag = posts.filter((p) => !p.tema).length;
    if (semTag / posts.length > 0.5) add('conteudo', 'neutro', `${semTag} dos ${posts.length} posts estão sem tema. Marque os temas na tabela de posts para o Universo comparar o que funciona.`, 0.6);
  }

  // ---- Frequência por núcleo (alerta)
  if (c.rede === 'todas' || c.rede === 'instagram') {
    const hoje = Date.now();
    const ultimoPorNuc = {};
    for (const p of N.posts) if (p.nucleo !== 'sem' && (!ultimoPorNuc[p.nucleo] || p.dia > ultimoPorNuc[p.nucleo])) ultimoPorNuc[p.nucleo] = p.dia;
    for (const id of ORDEM_NUCLEOS) {
      const u = ultimoPorNuc[id];
      if (!u) continue;
      const dias = Math.round((hoje - Date.parse(u)) / DIA);
      if (dias >= 14) add('visao', 'atencao', `<b>${esc(NUCLEOS[id].nome)}</b> está há ${dias} dias sem post no Instagram.`, 1.2);
    }
  }

  // ---- Horários
  const mat = matrizOnline(N.online.instagram, diaLocal(Date.now() - 42 * DIA));
  if (mat.ndias >= 3) {
    const top = melhoresJanelas(mat, 3);
    if (top.length) {
      add('horarios', 'neutro', `Picos de seguidores online: <b>${top.map((t) => `${DIAS_SEMANA_LONGO[t.dow]} às ${hora(t.h)}`).join(', ')}</b> (média de ${mat.ndias} dias, hora de Brasília).`, 1.5);
      // posts publicados fora das melhores horas do respectivo dia
      const melhorHoraDia = mat.m.map((linha) => {
        const vals = linha.map((v, h) => ({ v, h })).filter((x) => def(x.v)).sort((a, b) => b.v - a.v);
        return new Set(vals.slice(0, 4).map((x) => x.h));
      });
      const avaliados = posts.filter((p) => melhorHoraDia[p.dow]?.size);
      if (avaliados.length >= 3) {
        const dentro = avaliados.filter((p) => melhorHoraDia[p.dow].has(p.hora) || melhorHoraDia[p.dow].has(p.hora + 1));
        const pdentro = dentro.length / avaliados.length;
        if (pdentro < 0.5) add('horarios', 'atencao', `Só ${pct(pdentro, 0)} dos posts saíram perto das 4 horas de pico do dia. Vale testar publicar nesses horários.`, 1.2);
      }
    }
  }
  if (posts.length >= 6) {
    const fx = agrupar(posts, (p) => faixaDe(p.hora), (k) => FAIXAS.find((f) => f[0] === k)?.[1] || k).linhas.filter((l) => l.n >= 2 && l.indAlc != null).sort((a, b) => b.indAlc - a.indAlc);
    if (fx.length >= 2 && fx[0].indAlc >= 1.2) add('horarios', 'neutro', `Posts publicados de <b>${esc(fx[0].nome.toLowerCase())}</b> tiveram alcance médio ${vezes(fx[0].indAlc)} a média (${fx[0].n} posts).`, 1);
  }

  // ---- Público
  const pub = N.publico.instagram || {};
  const idSeg = pub.seguidores?.idade;
  const idEng = pub.engajados?.idade;
  if (idSeg && Object.keys(idSeg).length) {
    const tot = Object.values(idSeg).reduce((a, b) => a + b, 0);
    const [faixa, v] = Object.entries(idSeg).sort((a, b) => b[1] - a[1])[0];
    add('publico', 'neutro', `A maior faixa entre os seguidores é <b>${esc(faixa)} anos</b> (${pct(v / tot, 0)}).`, 1);
    if (idEng && Object.keys(idEng).length) {
      const totE = Object.values(idEng).reduce((a, b) => a + b, 0);
      const difs = Object.keys({ ...idSeg, ...idEng }).map((k) => ({ k, d: (idEng[k] || 0) / totE - (idSeg[k] || 0) / tot })).sort((a, b) => b.d - a.d);
      if (difs[0].d >= 0.05) add('publico', 'bom', `Quem mais interage está na faixa de <b>${esc(difs[0].k)} anos</b>: são ${pct((idEng[difs[0].k] || 0) / totE, 0)} dos engajados, contra ${pct((idSeg[difs[0].k] || 0) / tot, 0)} dos seguidores.`, 1.2);
    }
  }
  const cid = pub.seguidores?.cidade;
  if (cid && Object.keys(cid).length) {
    const tot = Object.values(cid).reduce((a, b) => a + b, 0);
    const [nome, v] = Object.entries(cid).sort((a, b) => b[1] - a[1])[0];
    add('publico', 'neutro', `<b>${esc(nome.split(',')[0])}</b> concentra ${pct(v / tot, 0)} dos seguidores com cidade informada.`, 0.8);
  }

  // ---- Concorrentes
  const contas = (N.concorrentes.contas || []).filter((x) => x.perfil);
  if (contas.length) {
    const odisse = resumoOdissePublico(N, est);
    const rs = contas.map((x) => ({ x, r: resumoConcorrente(x) })).filter((y) => y.r.engMediana != null && y.r.nVisiveis >= 10);
    if (rs.length) {
      const melhor = rs.sort((a, b) => b.r.engMediana - a.r.engMediana)[0];
      const comp = odisse.engMediana != null ? ` O Odisse está em ${pct(odisse.engMediana, 2)}.` : '';
      add('concorrentes', 'neutro', `Entre os concorrentes, <b>@${esc(melhor.x.usuario)}</b> tem o maior engajamento público por post (mediana de ${pct(melhor.r.engMediana, 2)} dos seguidores).${comp}`, 1.2);
    }
    const semana = diaLocal(Date.now() - 8 * DIA);
    const destaques = [];
    for (const x of contas) {
      const r = resumoConcorrente(x);
      for (const p of x.posts.filter((q) => q.dia >= semana)) {
        const f = r.fator(p);
        if (f != null && f >= 2) destaques.push({ x, p, f });
      }
    }
    destaques.sort((a, b) => b.f - a.f);
    if (destaques[0]) {
      const { x, p, f } = destaques[0];
      add('concorrentes', 'neutro', `<b>@${esc(x.usuario)}</b> teve um post fora da curva nesta semana (${vezes(f)} a mediana dele): <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(trecho(p.legenda))}</a>.`, 1.4);
    }
    const freq = contas.map((x) => ({ x, r: resumoConcorrente(x) })).sort((a, b) => b.r.porSemana - a.r.porSemana)[0];
    const freqOd = c.posts.length / (c.ndias / 7);
    if (freq && c.periodo !== 'tudo' && freq.r.porSemana >= freqOd * 1.5 && freq.r.porSemana >= 2) {
      add('concorrentes', 'neutro', `<b>@${esc(freq.x.usuario)}</b> publica ${dec(freq.r.porSemana)} posts por semana; o Odisse, ${dec(freqOd)} no período.`, 1);
    }
  }

  if (!L.length) add('visao', 'neutro', 'As leituras aparecem conforme os dados se acumulam. A coleta roda todo dia às 6h.', 0.1);
  return L.sort((a, b) => b.peso - a.peso);
}

/** Engajamento público do Odisse (curtidas + comentários ÷ seguidores), comparável com concorrentes. */
export function resumoOdissePublico(N, est) {
  const seg = est?.seguidores;
  const ultimos = [...N.posts].filter((p) => p.rede === 'instagram').sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30);
  const taxas = ultimos.map((p) => (seg && p.m.curtidas != null ? ((p.m.curtidas || 0) + (p.m.comentarios || 0)) / seg : null)).filter(def).sort((a, b) => a - b);
  const coms = ultimos.map((p) => p.m.comentarios).filter(def).sort((a, b) => a - b);
  return { engMediana: taxas.length ? taxas[Math.floor(taxas.length / 2)] : null, comMediana: coms.length ? coms[Math.floor(coms.length / 2)] : null, ultimos };
}

const trecho = (t) => { const s = String(t || 'sem legenda').split('\n')[0]; return s.length > 60 ? s.slice(0, 58) + '…' : s; };
const rotPost = (p) => `<a href="${esc(p.link)}" target="_blank" rel="noopener">“${esc(trecho(p.legenda))}”</a>`;

export { OBJETIVOS };
