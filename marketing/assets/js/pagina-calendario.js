// Calendário editorial (#/calendario), nas peças da base/v2. Abas: Calendário · Pool de mídias.
//
// Calendário: cada dia mostra os encaixes que a Estratégia pede (todas as plataformas) como cartões. Preenchido,
// o cartão é a publicação (miniatura, título, situação); pauta, é a pauta; vazio, é a lacuna tracejada com +.
// Vistas Mês · Semana · Lista (no celular, só a Lista). A publicação entra no encaixe soltando-a dentro dele;
// ao arrastar, só os encaixes compatíveis (plataforma e formato) se acendem. Nas plataformas por cota (Pinterest),
// o dia tem um cartão de cota com as vagas. Ao lado, "Para agendar" (Pool e Pautas), recolhível.
// Pool de mídias (#/calendario/pool): por projeto ou em tabela (a antiga planilha de plataformas, com .csv).
// Detalhes na Gaveta. Arrastar tem o equivalente pelo teclado: os campos Dia e Encaixe da Gaveta.

import * as pool from './pool.js';
import * as pinterest from './pinterest.js';
import * as nuvem from './nuvem.js';
import * as local from './store.js';
import * as plano from './plano.js';
import { NUCLEOS, ORDEM_NUCLEOS } from './nucleos.js';
import { cabecalho, abas, numeros, segmentado, bandeja, lista, secao, quando, acao, link, etiqueta, gaveta, toque, icone, esc } from '/base/v2/componentes.js';

const $ = (s, r = document) => r.querySelector(s);
const SIG = { estudio: 'ES', arquitetos: 'AR', objetos: 'OB', elaia: 'EL' };
const DSEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const STATUS_NOME = Object.fromEntries(pool.STATUS);
const ORIGEM_NOME = Object.fromEntries(pool.ORIGENS);
const STATUS_PAUTA = Object.fromEntries(plano.STATUS_PAUTA);
const lembrar = { ler: (k, p) => { try { return localStorage.getItem(k) ?? p; } catch { return p; } }, gravar: (k, v) => { try { localStorage.setItem(k, v); } catch { /* segue */ } } };

const ui = {
  sub: '',
  vista: lembrar.ler('universo-cal-vista', 'semana'),
  ref: pool.hoje(),
  plat: 'todas',
  nuc: 'todos',
  lado: 'pool',
  ladoAberto: lembrar.ler('universo-cal-lado', '1') === '1',
  inicioDist: '',
  personalizar: false,
  poolSit: 'todos', poolOrig: 'todos', poolBusca: '', poolVista: 'projetos',
};
let raiz = null, resumos = [], ligado = false, avisar = () => {}, chaveGaveta = '';
const estreito = () => matchMedia('(max-width: 760px)').matches;
const vistaEfetiva = () => (estreito() ? 'lista' : ui.vista);

/** Monta a página. `sub`: '' (calendário), 'pool', 'pool/tabela' ou 'item/<id>' (abre o item do pool na semana
 *  dele, vindo das Publicações). `opc.aviso` mostra a mensagem do app. */
export async function renderCalendario(el, sub, opc = {}) {
  raiz = el;
  const [s, v] = String(sub || '').split('/');
  const itemPedido = s === 'item' && v ? decodeURIComponent(v) : '';
  if (itemPedido) history.replaceState(null, '', '#/calendario');
  ui.sub = s === 'pool' ? 'pool' : '';
  if (ui.sub === 'pool' && v === 'tabela') ui.poolVista = 'tabela';
  avisar = opc.aviso || avisar;
  if (!ligado) { ligar(); ligado = true; }
  await pool.abrirLocal();
  if (!resumos.length) resumos = await local.listarPubs();
  desenhar();
  const [, lista_] = await Promise.all([
    pool.carregar().catch((e) => { console.warn(e); return false; }),
    nuvem.listar().catch(() => null),
    plano.carregarEstrategia(),
    plano.carregarPautas(),
  ]);
  if (lista_) resumos = lista_;
  if (!document.body.classList.contains('vista-calendario')) return;
  const it = itemPedido && pool.item(itemPedido);
  if (it?.dia) ui.ref = it.dia;
  desenhar();
  if (it) abrir(`i:${it.id}`);
}

// ---------------------------------------------------------------------------
// Filtros e utilidades

const passaPlat = (pid) => ui.plat === 'todas' || ui.plat === pid;
const passaNuc = (n) => ui.nuc === 'todos' || !n || ui.nuc === n;
const passaItem = (it) => passaPlat(it.rede) && passaNuc(it.nucleo);
const iconePlat = (pid, tam = 12) => icone(['instagram', 'pinterest', 'tiktok'].includes(pid) ? pid : 'plataforma', tam, 1.8);
const nomeNuc = (n) => NUCLEOS[n]?.nome || '';
const dataCurta = pool.dataCurta;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const proporcao = (pid, fid) => ({ '3x4': '3 / 4', pin: '2 / 3', '9x16': '9 / 14', video: '9 / 14' }[plano.formato(pid, fid)?.peca] || '3 / 4');
const thumb = (it, cls = '') => `<span class="mk-th${cls}" style="aspect-ratio:${it?.formato === 'pin' ? '2 / 3' : '3 / 4'}">${it?.miniatura ? `<img src="${it.miniatura}" alt="" draggable="false" loading="lazy">` : ''}${it?.imagens?.length > 1 ? `<em>${it.imagens.length}</em>` : ''}</span>`;

function selos(it) {
  const s = [];
  const P = { pequeno: true };
  if (it.repete?.some((r) => r.exata)) s.push(quando('repetida', 'atraso', P));
  else if (it.repete?.length) s.push(quando('mesma foto', 'atencao', P));
  if (it.avisos?.length) s.push(quando(`${it.avisos.length} ${it.avisos.length === 1 ? 'aviso' : 'avisos'}`, 'atencao', P));
  return s.join('');
}

/** Os cartões de um dia: encaixes (com ocupantes), cotas e o que está no dia fora da grade. */
function cartoesDoDia(dia) {
  const out = [];
  const encs = plano.encaixesDoDia(dia).filter((e) => passaPlat(e.plataforma));
  const comPos = new Set(), comCota = new Set();
  for (const e of encs) {
    if (e.pos != null) {
      const o = plano.ocupantes(dia, e.plataforma, e.pos);
      const nuc = o.item?.nucleo || o.pauta?.nucleo || e.nucleo;
      comPos.add(`${e.plataforma}:${e.pos}`);
      if (!passaNuc(nuc)) continue;
      out.push({ k: 'enc', dia, e, item: o.item, pauta: o.item ? null : o.pauta, pautaJunto: o.item ? o.pauta : null, nuc });
    } else {
      comCota.add(e.plataforma);
      const itens = pool.lista().filter((x) => x.rede === e.plataforma && x.dia === dia && passaNuc(x.nucleo));
      out.push({ k: 'cota', dia, e, itens });
    }
  }
  for (const it of pool.lista()) {
    if (it.dia !== dia || !passaItem(it)) continue;
    if (comCota.has(it.rede)) continue;
    if (it.pos != null && comPos.has(`${it.rede}:${it.pos}`)) continue;
    out.push({ k: 'solto', dia, item: it });
  }
  for (const p of plano.listaPautas()) {
    const pid = plano.plataformaDaPauta(p);
    if (p.dia !== dia || !passaPlat(pid) || !passaNuc(p.nucleo)) continue;
    if (p.pos != null && comPos.has(`${pid}:${p.pos}`)) continue;
    if (comCota.has(pid) && p.pos == null && plano.plataforma(pid)?.modo === 'cota') continue;
    out.push({ k: 'pauta', dia, pauta: p });
  }
  return out;
}

/** Estado de um cartão de encaixe. */
function estadoEnc(c, hoje) {
  if (c.item) {
    if (c.item.status === 'publicado') return ['publicado', 'Publicado', 'ok'];
    if (c.dia < hoje) return ['atraso', 'Atrasado', 'atraso'];
    return ['agendado', 'Agendado', 'hora'];
  }
  if (c.pauta) return c.pauta.status === 'publicada' ? ['publicado', 'Publicada', 'ok'] : ['pauta', STATUS_PAUTA[c.pauta.status] || 'Pauta', ''];
  return c.dia < hoje ? ['vazio', 'Sem publicação', ''] : ['lacuna', 'Lacuna', ''];
}
const chaveEnc = (c) => `l:${c.dia}|${c.e.plataforma}|${c.e.pos}`;
const atributosAlvoEnc = (c) => `data-alvo="enc" data-dia="${c.dia}" data-plat="${esc(c.e.plataforma)}" data-pos="${c.e.pos}" data-formato="${esc(c.e.formato)}"`;
const arrasto = (c) => (c.item ? ` draggable="true" data-item="${esc(c.item.id)}"` : c.pauta ? ` draggable="true" data-pauta="${esc(c.pauta.id)}"` : '');
const abreDe = (c) => (c.item ? `i:${c.item.id}` : c.pauta ? `p:${c.pauta.id}` : c.k === 'enc' ? chaveEnc(c) : '');

// ---------------------------------------------------------------------------
// Página

function desenhar() {
  if (!raiz) return;
  const rolagem = raiz.scrollTop;
  raiz.innerHTML = `<div class="mk-pagina">${ui.sub === 'pool' ? paginaPool() : paginaCalendario()}</div>`;
  raiz.scrollTop = rolagem;
  if (chaveGaveta && document.querySelector('.ui-gaveta')) abrir(chaveGaveta);
}
const abasCal = () => abas('Calendário editorial', [
  { href: '#/calendario', rotulo: 'Calendário', ativa: ui.sub === '' },
  { href: '#/calendario/pool', rotulo: 'Pool de mídias', ativa: ui.sub === 'pool' },
]);

// ---- período visto ----------------------------------------------------------

function periodo() {
  const v = vistaEfetiva();
  if (v === 'mes') {
    const mes = ui.ref.slice(0, 7);
    const [a, m] = mes.split('-').map(Number);
    const primeiro = `${mes}-01`, ultimo = pool.isoDia(new Date(a, m, 0));
    const ini = pool.segundaDe(primeiro);
    const fim = pool.somarDias(pool.segundaDe(ultimo), 6);
    return { ini, fim, mes, titulo: `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} de ${a}` };
  }
  const ini = pool.segundaDe(ui.ref), fim = pool.somarDias(ini, 6);
  const [, m1, d1] = ini.split('-').map(Number), [a2, m2, d2] = fim.split('-').map(Number);
  const titulo = m1 === m2 ? `${d1} a ${d2} de ${MESES[m2 - 1]}` : `${d1} de ${MESES[m1 - 1].slice(0, 3)}. a ${d2} de ${MESES[m2 - 1].slice(0, 3)}. de ${a2}`;
  return { ini, fim, titulo };
}
function navegar(d) {
  if (d === 0) { ui.ref = pool.hoje(); return; }
  if (vistaEfetiva() === 'mes') {
    const [a, m] = ui.ref.split('-').map(Number);
    const nd = new Date(a, m - 1 + d, 1);
    ui.ref = pool.isoDia(nd);
  } else ui.ref = pool.somarDias(ui.ref, 7 * d);
}

// ---- números ----------------------------------------------------------------

function osNumeros() {
  const hoje = pool.hoje();
  const itens = pool.lista().filter(passaItem);
  const prontos = itens.filter((x) => x.status === 'pronto');
  const porPlat = (l) => plano.plataformas().map((p) => [p.nome, l.filter((x) => x.rede === p.id).length]).filter(([, n]) => n).map(([nm, n]) => `${n} ${nm}`).join(' · ');
  const agendados = itens.filter((x) => x.status === 'agendado' && x.dia >= hoje).sort((a, b) => a.dia.localeCompare(b.dia));
  const atrasados = itens.filter((x) => x.status === 'agendado' && x.dia && x.dia < hoje).sort((a, b) => a.dia.localeCompare(b.dia));
  const lac = new Map();
  for (let i = 0; i < 14; i++) {
    const dia = pool.somarDias(hoje, i);
    for (const c of cartoesDoDia(dia)) {
      const pnome = plano.nomePlataforma(c.e?.plataforma);
      if (c.k === 'enc' && !c.item && !c.pauta) lac.set(pnome, (lac.get(pnome) || 0) + 1);
      if (c.k === 'cota' && c.itens.length < c.e.cota) lac.set(pnome, (lac.get(pnome) || 0) + c.e.cota - c.itens.length);
    }
  }
  const nLac = [...lac.values()].reduce((a, b) => a + b, 0);
  return numeros([
    { rotulo: 'Para agendar', valor: prontos.length, apoio: esc(porPlat(prontos) || 'nada no pool') },
    { rotulo: 'Lacunas', valor: nLac, sufixo: 'em 2 semanas', apoio: esc([...lac].map(([k, n]) => `${n} ${k}`).join(' · ') || 'grade preenchida') },
    { rotulo: 'Agendados', valor: agendados.length, apoio: agendados.length ? `até ${dataCurta(agendados[agendados.length - 1].dia)}` : 'nada agendado' },
    { rotulo: 'Atrasados', valor: atrasados.length, tom: atrasados.length ? 'problema' : '', apoio: atrasados.length ? `desde ${dataCurta(atrasados[0].dia)}` : 'nenhum' },
  ], { estatico: true });
}

// ---- calendário -------------------------------------------------------------

function paginaCalendario() {
  const v = vistaEfetiva();
  const per = periodo();
  const ciclo = plano.semanaDoCiclo(pool.hoje());
  const plats = plano.plataformas();
  const prontos = pool.lista().filter((x) => x.status === 'pronto' && passaItem(x)).length;
  const corpo = v === 'lista' ? agenda(per) : grade(per, v);
  return `${abasCal()}
    ${cabecalho(per.titulo, esc(`${plano.fasesEmVigor()} · ciclo na semana ${ciclo.n} (${ciclo.ab})`), `<div class="mk-nav">
      <button type="button" class="mk-ico" data-nav="-1" aria-label="${v === 'mes' ? 'Mês anterior' : 'Semana anterior'}">${icone('anterior', 15, 2)}</button>
      <button type="button" class="mk-ico" data-nav="1" aria-label="${v === 'mes' ? 'Próximo mês' : 'Próxima semana'}">${icone('seta', 15, 2)}</button>
      ${acao('Hoje', { dados: { nav: '0' } })}
      ${v !== 'mes' ? acao('Baixar lote da semana', { dados: { lote: per.ini } }) : ''}</div>`)}
    ${osNumeros()}
    <div class="mk-filtros">
      ${segmentado([{ id: 'todas', rotulo: 'Todas as plataformas' }, ...plats.map((p) => ({ id: p.id, rotulo: p.nome }))], ui.plat, 'plat', 'Plataforma')}
      ${segmentado([{ id: 'todos', rotulo: 'Todos os núcleos' }, ...ORDEM_NUCLEOS.map((n) => ({ id: n, rotulo: NUCLEOS[n].nome }))], ui.nuc, 'nuc', 'Núcleo')}
      <span class="mk-filtros__fim">
        ${estreito() ? '' : segmentado([{ id: 'mes', rotulo: 'Mês' }, { id: 'semana', rotulo: 'Semana' }, { id: 'lista', rotulo: 'Lista' }], v, 'vista', 'Vista')}
        ${ui.ladoAberto ? '' : acao(`Para agendar · ${prontos}`, { dados: { 'lado-abrir': '1' } })}
      </span>
    </div>
    <div class="mk-cal-corpo${ui.ladoAberto ? ' is-com-lado' : ''}">
      <div class="mk-cal-principal">${corpo}</div>
      ${ui.ladoAberto ? lado() : ''}
    </div>
    <p class="ui-nota">Cada cartão é um encaixe da Grade (Estratégia). Cores: verde publicado, azul agendado, laranja tracejado é lacuna a preencher (o + abre a Gaveta com o que serve), areia é pauta, cinza é dia que passou sem publicação, vermelho é atraso. Solte a publicação dentro do encaixe; ao arrastar, só os encaixes compatíveis se acendem. Pelo teclado, use os campos Dia e Encaixe da Gaveta.</p>`;
}

function grade(per, v) {
  const hoje = pool.hoje();
  let h = v === 'mes' ? DSEM.map((d) => `<div class="mk-cal__dsem">${d}</div>`).join('') : '';
  for (let dia = per.ini; dia <= per.fim; dia = pool.somarDias(dia, 1)) {
    const cs = cartoesDoDia(dia);
    const fora = v === 'mes' && dia.slice(0, 7) !== per.mes;
    const lacunas = cs.filter((c) => c.k === 'enc' && !c.item && !c.pauta && dia >= hoje).length;
    const cls = ['mk-cal__dia', fora && 'is-fora', dia === hoje && 'is-hoje', dia < hoje && 'is-passado'].filter(Boolean).join(' ');
    const cab = v === 'mes'
      ? `<span class="mk-cal__num">${Number(dia.slice(8))}</span>${lacunas ? `<small>${lacunas} ${lacunas === 1 ? 'lacuna' : 'lacunas'}</small>` : ''}`
      : `<b>${DSEM[pool.dataDe(dia).getDay() === 0 ? 6 : pool.dataDe(dia).getDay() - 1]}</b><span class="mk-cal__num">${Number(dia.slice(8))}</span>`;
    h += `<div class="${cls}" data-alvo="dia" data-dia="${dia}"><div class="mk-cal__cab">${cab}</div>
      ${cs.map((c) => (v === 'mes' ? cartaoMes(c, hoje) : cartaoSemana(c, hoje))).join('')}</div>`;
  }
  return bandeja(`<div class="mk-cal is-${v}">${h}</div>`);
}

// cartão compacto (mês)
function cartaoMes(c, hoje) {
  if (c.k === 'cota') return cotaMes(c, hoje);
  const pid = c.k === 'enc' ? c.e.plataforma : c.item?.rede || plano.plataformaDaPauta(c.pauta);
  const ic = iconePlat(pid, 10);
  if (c.k === 'enc') {
    const [st, rot] = estadoEnc(c, hoje);
    const sub = `${ic}${esc(c.e.horario ? c.e.horario.split('–')[0] : '')}${c.nuc ? ` · ${SIG[c.nuc] || ''}` : ''}`;
    let corpo;
    if (c.item) corpo = `${thumb(c.item, ' is-p')}<span class="mk-ce__tx"><b>${esc(c.item.titulo || c.item.projeto || 'Sem título')}</b><small>${st === 'atraso' ? `${ic}atrasado` : sub}</small></span>`;
    else if (c.pauta) corpo = `<span class="mk-th is-p is-pauta"></span><span class="mk-ce__tx"><b>${esc(c.pauta.angulo || 'Pauta')}</b><small>${sub} · pauta</small></span>`;
    else corpo = `<span class="mk-th is-p is-vazio">${st === 'lacuna' ? icone('mais', 12, 2) : ''}</span><span class="mk-ce__tx"><b>${esc(plano.formato(pid, c.e.formato)?.nome || rot)}</b><small>${sub}</small></span>`;
    return `<div class="mk-ce is-${st}" ${atributosAlvoEnc(c)}${arrasto(c)} data-abre="${esc(abreDe(c))}" tabindex="0" title="${esc(`${c.e.rotulo} · ${rot}`)}">${corpo}</div>`;
  }
  if (c.k === 'solto') {
    const it = c.item;
    const st = it.status === 'publicado' ? 'publicado' : it.dia < hoje ? 'atraso' : 'agendado';
    return `<div class="mk-ce is-${st} is-solto" draggable="true" data-item="${esc(it.id)}" data-abre="i:${esc(it.id)}" tabindex="0" title="Fora da grade">${thumb(it, ' is-p')}<span class="mk-ce__tx"><b>${esc(it.titulo || it.projeto || 'Sem título')}</b><small>${ic}fora da grade</small></span></div>`;
  }
  const p = c.pauta;
  return `<div class="mk-ce is-pauta" draggable="true" data-pauta="${esc(p.id)}" data-abre="p:${esc(p.id)}" tabindex="0"><span class="mk-th is-p is-pauta"></span><span class="mk-ce__tx"><b>${esc(p.angulo || 'Pauta')}</b><small>${ic}pauta sem encaixe</small></span></div>`;
}
/** Estado de um cartão de cota: completo (publicado ou agendado), faltando (lacuna) ou passado sem completar. */
function estadoCota(c, hoje) {
  if (c.itens.length >= c.e.cota) return c.itens.every((x) => x.status === 'publicado') ? 'publicado' : c.dia < hoje ? 'atraso' : 'agendado';
  return c.dia < hoje ? 'vazio' : 'lacuna';
}
function cotaMes(c, hoje) {
  const n = Math.max(c.e.cota, c.itens.length);
  const vagas = Array.from({ length: n }, (_, k) => (c.itens[k] ? `<i style="background-image:url('${c.itens[k].miniatura || ''}')"></i>` : '<i class="is-vazio"></i>')).join('');
  return `<div class="mk-ce is-cota is-${estadoCota(c, hoje)}${c.itens.length > (plano.plataforma(c.e.plataforma)?.cotaMax || 3) ? ' is-excesso' : ''}" data-alvo="cota" data-dia="${c.dia}" data-plat="${esc(c.e.plataforma)}" data-abre="c:${c.dia}|${esc(c.e.plataforma)}" tabindex="0" title="${esc(`${plano.nomePlataforma(c.e.plataforma)}: ${c.itens.length} de ${c.e.cota}`)}">
    <span class="mk-ce__vagas">${vagas}</span><span class="mk-ce__tx"><small>${iconePlat(c.e.plataforma, 10)}${c.itens.length}/${c.e.cota}</small></span></div>`;
}

// cartão grande (semana)
function cartaoSemana(c, hoje) {
  if (c.k === 'cota') {
    const n = Math.max(c.e.cota, c.itens.length);
    const vagas = Array.from({ length: n }, (_, k) => (c.itens[k]
      ? `<span class="mk-vaga" draggable="true" data-item="${esc(c.itens[k].id)}" data-abre="i:${esc(c.itens[k].id)}">${thumb(c.itens[k])}</span>`
      : `<span class="mk-vaga is-vazio">${icone('mais', 14, 1.8)}</span>`)).join('');
    return `<div class="mk-cg is-cota is-${estadoCota(c, hoje)}" data-alvo="cota" data-dia="${c.dia}" data-plat="${esc(c.e.plataforma)}">
      <div class="mk-cg__topo" data-abre="c:${c.dia}|${esc(c.e.plataforma)}" tabindex="0">${iconePlat(c.e.plataforma)}<span>${esc(c.e.rotulo || 'Cota')}</span><em>${c.itens.length}/${c.e.cota}</em></div>
      <div class="mk-cg__vagas">${vagas}</div></div>`;
  }
  const pid = c.k === 'enc' ? c.e.plataforma : c.item?.rede || plano.plataformaDaPauta(c.pauta);
  const topo = (h, n) => `<div class="mk-cg__topo">${iconePlat(pid)}<span>${esc(h || '')}</span><em>${esc(SIG[n] || '')}</em></div>`;
  if (c.k === 'enc') {
    const [st, rot, tom] = estadoEnc(c, hoje);
    const fmt = plano.formato(pid, c.e.formato);
    const t = plano.tipo(pid, c.e.formato, c.e.tipo);
    const desc = `${fmt?.nome || c.e.formato}${t ? ' · ' + t.nome : ''}`;
    let corpo;
    if (c.item) corpo = `<div class="mk-cg__img" style="aspect-ratio:${proporcao(pid, c.e.formato)}">${c.item.miniatura ? `<img src="${c.item.miniatura}" alt="" draggable="false" loading="lazy">` : ''}${c.item.imagens?.length > 1 ? `<em>${c.item.imagens.length}</em>` : ''}</div>
      <div class="mk-cg__tx"><b>${esc(c.item.titulo || c.item.projeto || 'Sem título')}</b><small>${esc(desc)}</small>${quando(rot, tom, { pequeno: true })}</div>`;
    else if (c.pauta) corpo = `<div class="mk-cg__pauta">${esc(c.pauta.angulo || 'Pauta')}${c.pauta.obra ? `<small>${esc(c.pauta.obra)}</small>` : ''}</div><div class="mk-cg__tx"><small>${esc(desc)}</small>${quando(rot, tom, { pequeno: true })}</div>`;
    else corpo = `<div class="mk-cg__lacuna">${st === 'lacuna' ? icone('mais', 18, 1.6) : ''}<span>${esc(fmt?.nome || '')}</span><small>${esc(t?.nome || '')}</small><b class="mk-solte">Soltar aqui</b></div>`;
    return `<div class="mk-cg is-${st}" ${atributosAlvoEnc(c)}${arrasto(c)} data-abre="${esc(abreDe(c))}" tabindex="0" title="${esc(`${c.e.horario || ''} · ${c.e.rotulo}`)}">${topo(c.e.horario ? c.e.horario.split('–')[0] : '', c.nuc)}${corpo}</div>`;
  }
  if (c.k === 'solto') {
    const it = c.item;
    const st = it.status === 'publicado' ? 'publicado' : it.dia < hoje ? 'atraso' : 'agendado';
    return `<div class="mk-cg is-${st} is-solto" draggable="true" data-item="${esc(it.id)}" data-abre="i:${esc(it.id)}" tabindex="0">${topo('fora da grade', it.nucleo)}
      <div class="mk-cg__img" style="aspect-ratio:${it.formato === 'pin' ? '2 / 3' : '3 / 4'}">${it.miniatura ? `<img src="${it.miniatura}" alt="" draggable="false" loading="lazy">` : ''}</div>
      <div class="mk-cg__tx"><b>${esc(it.titulo || it.projeto || 'Sem título')}</b>${quando(STATUS_NOME[it.status] || '', st === 'atraso' ? 'atraso' : '', { pequeno: true })}</div></div>`;
  }
  const p = c.pauta;
  return `<div class="mk-cg is-pauta" draggable="true" data-pauta="${esc(p.id)}" data-abre="p:${esc(p.id)}" tabindex="0">${topo('sem encaixe', p.nucleo)}
    <div class="mk-cg__pauta">${esc(p.angulo || 'Pauta')}${p.obra ? `<small>${esc(p.obra)}</small>` : ''}</div><div class="mk-cg__tx"><small>${esc(plano.rotuloDaPauta(p))}</small></div></div>`;
}

// lista (agenda)
function agenda(per) {
  const hoje = pool.hoje();
  const grupos = [];
  for (let dia = per.ini; dia <= per.fim; dia = pool.somarDias(dia, 1)) {
    const linhas = [];
    for (const c of cartoesDoDia(dia)) {
      const pid = c.k === 'enc' || c.k === 'cota' ? c.e.plataforma : c.item?.rede || plano.plataformaDaPauta(c.pauta);
      const plat = `<span class="mk-plat">${iconePlat(pid, 13)}${esc(plano.nomePlataforma(pid))}</span>`;
      if (c.k === 'cota') {
        const falta = c.e.cota - c.itens.length;
        linhas.push({ abre: `c:${dia}|${pid}`, celulas: [
          { html: '' }, { html: '' }, { html: plat, celular: false },
          { html: `<span class="mk-tit"><b>${esc(c.e.rotulo || 'Cota')} · ${c.itens.length} de ${c.e.cota}</b><small>cota do dia</small></span>` },
          { html: '', celular: false },
          { html: falta > 0 && dia >= hoje ? acao('Preencher', { dados: { abre: `c:${dia}|${pid}` } }) : quando(falta > 0 ? 'Incompleta' : 'Completa', falta > 0 ? 'atencao' : 'ok'), fim: true },
        ] });
        continue;
      }
      const it = c.item, p = c.pauta;
      let st = ['', '', ''], titulo, sub, nuc, hora = '';
      if (c.k === 'enc') { st = estadoEnc(c, hoje); sub = c.e.rotulo; nuc = c.nuc; hora = c.e.horario?.split('–')[0] || ''; }
      else { sub = c.k === 'solto' ? 'fora da grade' : `${plano.rotuloDaPauta(p)} · sem encaixe`; nuc = it?.nucleo || p?.nucleo; st = it ? [it.status, STATUS_NOME[it.status], it.status === 'publicado' ? 'ok' : it.dia < hoje ? 'atraso' : 'hora'] : ['pauta', STATUS_PAUTA[p.status], '']; }
      titulo = it ? it.titulo || it.projeto || 'Sem título' : p ? p.angulo || 'Pauta' : 'Lacuna';
      const fim = st[0] === 'lacuna' ? acao('Preencher', { dados: { abre: abreDe(c) } }) : quando(st[1], st[2]);
      linhas.push({ abre: abreDe(c), celulas: [
        { html: it ? thumb(it, ' is-l') : `<span class="mk-th is-l ${p ? 'is-pauta' : 'is-vazio'}"></span>` },
        { html: `<b>${esc(hora)}</b>` }, { html: plat, celular: false },
        { html: `<span class="mk-tit"><b>${esc(titulo)}</b><small>${esc(sub)}</small></span>` },
        { html: esc(nomeNuc(nuc)), celular: false }, { html: fim, fim: true },
      ] });
    }
    const dt = pool.dataDe(dia);
    grupos.push({ nome: `${DIAS[(dt.getDay() + 6) % 7]}, ${dataCurta(dia)}${dia === hoje ? ' · hoje' : ''}`, n: linhas.length, linhas });
  }
  return bandeja(lista({ colunas: '24px 40px 112px minmax(0,1fr) 96px 120px', colunasCelular: '24px 36px minmax(0,1fr) 92px', grupos, vazio: 'Nada nesta semana.' }), { cartao: true });
}

// ---- lado: Para agendar ------------------------------------------------------

function lado() {
  const prontos = pool.lista().filter((x) => x.status === 'pronto' && passaItem(x)).sort((a, b) => (a.criado || '').localeCompare(b.criado || ''));
  const semDia = plano.listaPautas().filter((p) => !p.dia && p.status !== 'publicada' && passaPlat(plano.plataformaDaPauta(p)) && passaNuc(p.nucleo));
  const tile = (it) => `<div class="mk-tile" draggable="true" data-item="${esc(it.id)}" data-abre="i:${esc(it.id)}" tabindex="0">
    ${thumb(it)}<span class="mk-tile__tx"><b>${esc(it.titulo || 'Sem título')}</b><small>${esc([it.projeto, it.pin?.pastaNome].filter(Boolean).join(' · '))}</small><span class="mk-selos">${selos(it)}</span></span></div>`;
  let corpo = '';
  if (ui.lado === 'pautas') {
    corpo = semDia.map((p) => `<div class="mk-tile is-pauta" draggable="true" data-pauta="${esc(p.id)}" data-abre="p:${esc(p.id)}" tabindex="0">
      <span class="mk-th is-pauta"></span><span class="mk-tile__tx"><b>${esc(p.angulo || 'Pauta')}</b><small>${esc(`${plano.nomePlataforma(plano.plataformaDaPauta(p))} · ${plano.rotuloDaPauta(p)}`)}</small><small>${esc(p.obra || '')}</small></span></div>`).join('')
      || `<p class="mk-vazio">Nenhuma pauta sem dia. ${link('Banco de pautas', '#/estrategia/pautas')}</p>`;
  } else {
    corpo = distribuicoes();
    for (const p of plano.plataformas()) {
      const l = prontos.filter((x) => x.rede === p.id);
      if (l.length) corpo += `<div class="mk-lado__grupo">${iconePlat(p.id)}${esc(p.nome)} <small>${l.length}</small></div>${l.map(tile).join('')}`;
    }
    const outros = prontos.filter((x) => !plano.plataforma(x.rede));
    if (outros.length) corpo += `<div class="mk-lado__grupo">Outras <small>${outros.length}</small></div>${outros.map(tile).join('')}`;
    if (!prontos.length) corpo += '<p class="mk-vazio">Nada no pool. No editor, use “Enviar ao pool”, ao lado da exportação.</p>';
  }
  return `<aside class="mk-lado" data-alvo="pool" aria-label="Para agendar">${bandeja(`
    <div class="mk-lado__cab"><b>Para agendar</b>
      <button type="button" class="mk-ico" data-lado-fechar aria-label="Recolher o lado" title="Recolher">${icone('recolher', 15, 1.8)}</button></div>
    <div class="mk-lado__seg">${segmentado([{ id: 'pool', rotulo: 'Pool', n: prontos.length }, { id: 'pautas', rotulo: 'Pautas', n: semDia.length }], ui.lado, 'lado')}</div>
    <div class="mk-lado__corpo">${corpo}</div>`)}</aside>`;
}

/** Distribuir: as plataformas por cota com itens prontos; a cota de cada dia vem da Estratégia. */
function planoDe(p) {
  const prontos = pool.lista().filter((x) => x.status === 'pronto' && x.rede === p.id && passaNuc(x.nucleo));
  const inicio = ui.inicioDist || pool.somarDias(pool.hoje(), 1);
  return { prontos, inicio, plano: prontos.length ? pool.planejarDistribuicao(prontos, inicio, (d) => plano.cotaDoDia(d, p.id), { umProjeto: p.regras?.umProjetoPorDia, pastas: p.regras?.pastasAlternadas }) : [] };
}
function distribuicoes() {
  return plano.plataformas().filter((p) => p.modo === 'cota' && passaPlat(p.id)).map((p) => {
    const d = planoDe(p);
    if (!d.prontos.length) return '';
    const dias = d.plano.map((x) => x.dia).sort();
    const regras = [p.regras?.umProjetoPorDia && 'um projeto por dia', p.regras?.pastasAlternadas && 'pastas alternadas'].filter(Boolean).join(', ');
    return `<div class="mk-dist">
      <p><b>${d.prontos.length} ${esc(p.formatos[0]?.nome?.toLowerCase() || 'itens')}${d.prontos.length === 1 ? '' : 's'} prontos</b> ${d.plano.length ? `para as cotas de <b>${dataCurta(dias[0])} a ${dataCurta(dias[dias.length - 1])}</b>` : 'sem cota livre nos próximos dias'}${regras ? ` · ${esc(regras)}` : ''}</p>
      ${ui.personalizar ? `<label class="mk-campo"><span>A partir de</span><input type="date" data-dist-inicio value="${d.inicio}"></label>` : ''}
      <div class="mk-dist__acoes">${acao('Distribuir', { principal: true, dados: { distribuir: p.id }, desligada: !d.plano.length })}
        ${ui.personalizar ? '' : `<button type="button" class="mk-link" data-personalizar>Personalizar</button>`}</div></div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Pool de mídias

function projetos() {
  const mapa = new Map();
  for (const it of pool.lista()) {
    if (!mapa.has(it.pub)) mapa.set(it.pub, { pub: it.pub, nucleo: it.nucleo, projeto: it.projeto, rede: it.rede, itens: [] });
    mapa.get(it.pub).itens.push(it);
  }
  for (const r of resumos) {
    if ((r.formato || '3x4') !== 'pin' || mapa.has(r.id)) continue;
    mapa.set(r.id, { pub: r.id, nucleo: r.nucleo, projeto: r.titulo || 'Sem título', rede: 'pinterest', itens: [] });
  }
  for (const p of mapa.values()) {
    const r = resumos.find((x) => x.id === p.pub);
    p.formato = r?.formato || p.itens[0]?.formato || '3x4';
    p.rede = p.itens[0]?.rede || (p.formato === 'pin' ? 'pinterest' : 'instagram');
    p.noEditor = r ? (p.formato === 'pin' ? Math.max(0, (r.ncards || 0) - p.itens.length) : (p.itens.length ? 0 : 1)) : 0;
    p.ultimo = p.itens.filter((x) => x.status === 'publicado').map((x) => x.publicadoEm || x.dia).sort().pop() || '';
    p.proximo = p.itens.filter((x) => x.status === 'agendado').map((x) => x.dia).sort()[0] || '';
    p.atualizado = p.itens.map((x) => x.atualizado || '').sort().pop() || '';
  }
  return [...mapa.values()].filter((p) => passaPlat(p.rede) && passaNuc(p.nucleo));
}

function paginaPool() {
  const busca = ui.poolBusca.trim().toLowerCase();
  const passa = (it) => passaItem(it) && (ui.poolSit === 'todos' || it.status === ui.poolSit) && (ui.poolOrig === 'todos' || it.origem === ui.poolOrig)
    && (!busca || `${it.titulo} ${it.projeto} ${it.pin?.pastaNome || ''}`.toLowerCase().includes(busca));
  const todos = pool.lista().filter(passaItem);
  const ps = projetos();
  const conta = (st) => todos.filter((x) => x.status === st).length;
  const ag = todos.filter((x) => x.status === 'agendado').map((x) => x.dia).sort();
  const pub = todos.filter((x) => x.status === 'publicado').map((x) => x.publicadoEm || x.dia).sort();
  const cab = cabecalho('Pool de mídias', `${todos.length} ${todos.length === 1 ? 'mídia' : 'mídias'} · ${ps.length} ${ps.length === 1 ? 'projeto' : 'projetos'}`,
    ui.poolVista === 'tabela' ? acao('Baixar .csv', { dados: { csv: '1' } }) : '');
  const nums = numeros([
    { rotulo: 'Só no editor', valor: ps.reduce((s, p) => s + p.noEditor, 0), apoio: 'ainda não enviados ao pool' },
    { rotulo: 'No pool', valor: conta('pronto'), apoio: 'sem dia' },
    { rotulo: 'Agendados', valor: conta('agendado'), apoio: ag.length ? `próximo ${dataCurta(ag[0])}` : 'nenhum' },
    { rotulo: 'Publicados', valor: conta('publicado'), apoio: pub.length ? `último ${dataCurta(pub[pub.length - 1])}` : 'nenhum' },
  ], { estatico: true });
  const filtros = `<div class="mk-filtros">
    <input type="search" class="mk-busca" data-pool-busca value="${esc(ui.poolBusca)}" placeholder="Buscar título, projeto ou pasta" aria-label="Buscar no pool">
    ${segmentado([{ id: 'todos', rotulo: 'Todas' }, ...pool.STATUS.map(([v, r]) => ({ id: v, rotulo: r, n: conta(v) }))], ui.poolSit, 'pool-sit', 'Situação')}
    ${segmentado([{ id: 'todos', rotulo: 'Todas as origens' }, ...pool.ORIGENS.map(([v, r]) => ({ id: v, rotulo: r }))], ui.poolOrig, 'pool-orig', 'Origem')}
    ${segmentado([{ id: 'todas', rotulo: 'Todas as plataformas' }, ...plano.plataformas().map((p) => ({ id: p.id, rotulo: p.nome }))], ui.plat, 'plat', 'Plataforma')}
    <span class="mk-filtros__fim">${segmentado([{ id: 'projetos', rotulo: 'Por projeto' }, { id: 'tabela', rotulo: 'Tabela' }], ui.poolVista, 'pool-vista', 'Vista')}</span>
  </div>`;
  if (ui.poolVista === 'tabela') {
    const ls = linhasTabela();
    return `${abasCal()}${cab}${nums}${filtros}<div class="mk-espaco">${bandeja(lista({
      colunas: 'minmax(0,1.6fr) 96px 96px 64px 64px 72px 72px minmax(0,1.2fr) 72px 72px',
      colunasCelular: 'minmax(0,1fr) 64px 64px',
      regua: ['Projeto', 'Núcleo', 'Plataforma', 'Editor', 'Pool', 'Agendados', 'Publicados', 'Pastas', 'Último', 'Próximo']
        .map((t, i) => ({ texto: t, celular: ![0, 5, 6].includes(i), fim: [3, 4, 5, 6].includes(i) })),
      linhas: ls.map((l) => ({ href: `#/p/${l.pub}`, celulas: [
        { html: `<b>${esc(l.projeto)}</b>` }, { html: esc(l.nucleo), celular: false }, { html: esc(l.plataforma), celular: false },
        { html: l.editor || '', celular: false, fim: true }, { html: l.pool || '', celular: false, fim: true }, { html: l.agendados || '', fim: true },
        { html: `<b>${l.publicados || ''}</b>`, fim: true }, { html: `<small class="mk-mudo">${esc(l.pastas)}</small>`, celular: false },
        { html: dataCurta(l.ultimo), celular: false }, { html: dataCurta(l.proximo), celular: false },
      ] })),
      vazio: 'Nada no pool ainda.',
    }))}</div>
    <p class="ui-nota">Uma linha por projeto e plataforma, calculada a partir do pool (substitui a planilha odisse-plataformas-de-publicacao.xlsx). Último = o dia publicado mais recente.</p>`;
  }
  const secoes = ps.map((p) => ({ ...p, vis: p.itens.filter(passa) }))
    .filter((p) => p.vis.length || (ui.poolSit === 'todos' && ui.poolOrig === 'todos' && !busca))
    .sort((a, b) => b.atualizado.localeCompare(a.atualizado))
    .map((p) => {
      const pastas = new Map();
      for (const it of p.itens) if (it.pin?.pastaNome) pastas.set(it.pin.pastaNome, (pastas.get(it.pin.pastaNome) || 0) + 1);
      const resumo = [...[...pastas].map(([k, n]) => `${k} ${n}`), p.noEditor ? `${p.noEditor} só no editor` : ''].filter(Boolean).join(' · ');
      const linhas = p.vis.map((it) => ({ abre: `i:${it.id}`, celulas: [
        { html: thumb(it, ' is-l') },
        { html: `<span class="mk-tit"><b>${esc(it.titulo || 'Sem título')}</b><small>${esc([it.pin?.pastaNome, it.pin?.idioma === 'en' ? 'EN' : ''].filter(Boolean).join(' · ') || plano.nomePlataforma(it.rede))}</small></span>` },
        { html: quando(STATUS_NOME[it.status] || '', it.status === 'publicado' ? 'ok' : it.status === 'agendado' ? (it.dia < pool.hoje() ? 'atraso' : 'hora') : '') },
        { html: it.dia ? dataCurta(it.dia) : '—', celular: false },
        { html: esc(ORIGEM_NOME[it.origem] || '—'), celular: false },
        { html: `<span class="mk-selos">${selos(it)}</span>`, fim: true },
      ] }));
      return secao({
        titulo: p.projeto || 'Sem título',
        n: `${p.itens.length} · ${nomeNuc(p.nucleo)} · ${plano.nomePlataforma(p.rede)}`,
        lado: `${resumo ? `<small class="mk-mudo">${esc(resumo)}</small>` : ''}${link('Abrir no editor', `#/p/${p.pub}`)}`,
        corpo: bandeja(lista({ colunas: '24px minmax(0,1fr) 96px 64px 110px 120px', colunasCelular: '24px minmax(0,1fr) 90px',
          regua: [{ texto: '' }, { texto: 'Mídia' }, { texto: 'Situação' }, { texto: 'Dia', celular: false }, { texto: 'Origem', celular: false }, { texto: '', fim: true }],
          linhas, vazio: 'Nada no pool deste projeto ainda.' })),
      });
    }).join('');
  return `${abasCal()}${cab}${nums}${filtros}${secoes || '<p class="mk-vazio mk-espaco">Nada no pool com esses filtros.</p>'}`;
}

function linhasTabela() {
  return projetos().map((p) => {
    const pastas = new Map();
    for (const it of p.itens) if (it.pin?.pastaNome) pastas.set(it.pin.pastaNome, (pastas.get(it.pin.pastaNome) || 0) + 1);
    const c = (st) => p.itens.filter((x) => x.status === st).length;
    return {
      projeto: p.projeto, nucleo: nomeNuc(p.nucleo), plataforma: plano.nomePlataforma(p.rede), pub: p.pub,
      editor: p.noEditor, pool: c('pronto'), agendados: c('agendado'), publicados: c('publicado'),
      pastas: [...pastas].map(([k, q]) => `${k} (${q})`).join(', '), ultimo: p.ultimo, proximo: p.proximo,
    };
  }).sort((a, b) => a.plataforma.localeCompare(b.plataforma) || (b.ultimo || b.proximo).localeCompare(a.ultimo || a.proximo) || a.projeto.localeCompare(b.projeto));
}
function baixarCsv() {
  const cab = ['Projeto', 'Núcleo', 'Plataforma', 'Só no editor', 'No pool', 'Agendados', 'Publicados', 'Pastas', 'Último lote', 'Próximo'];
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = linhasTabela().map((l) => [l.projeto, l.nucleo, l.plataforma, l.editor, l.pool, l.agendados, l.publicados, l.pastas, l.ultimo, l.proximo]);
  baixar(new Blob(['﻿' + [cab, ...linhas].map((r) => r.map(cel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `odisse-plataformas-de-publicacao-${pool.hoje()}.csv`);
}

// ---------------------------------------------------------------------------
// Gaveta

function abrir(chave) {
  const [k, resto] = [chave.slice(0, 1), chave.slice(2)];
  let g = null;
  if (k === 'i') g = gavetaItem(resto);
  else if (k === 'p') g = gavetaPauta(resto);
  else if (k === 'l') g = gavetaLacuna(...resto.split('|'));
  else if (k === 'c') g = gavetaCota(...resto.split('|'));
  if (!g) { chaveGaveta = ''; return; }
  chaveGaveta = chave; // depois de abrir: a gaveta anterior, ao fechar, limpa a chave
  gaveta.aoFechar = () => { chaveGaveta = ''; };
  g.addEventListener('click', cliqueGaveta);
  g.addEventListener('change', mudancaGaveta);
}

/** Opções do campo Encaixe: os encaixes do dia que servem ao item (ou à pauta). */
function opcoesEncaixe(dia, serve, atual) {
  if (!dia) return '<option value="">Escolha o dia</option>';
  const encs = plano.encaixesDoDia(dia).filter((e) => e.pos != null && serve(e));
  return `<option value="">Fora da grade</option>${encs.map((e) => {
    const o = plano.ocupacao(dia, e.plataforma, e.pos);
    const v = `${e.plataforma}|${e.pos}`;
    return `<option value="${esc(v)}"${atual === v ? ' selected' : ''}>${esc(`${e.horario || ''} · ${e.rotulo}${o && `${e.plataforma}|${e.pos}` !== atual ? ' (ocupado)' : ''}`)}</option>`;
  }).join('')}`;
}
const campoData = (nome, v) => `<input type="date" class="mk-campo-in" data-g="${nome}" value="${esc(v || '')}">`;
const seletor = (nome, html) => `<select class="mk-campo-in" data-g="${nome}">${html}</select>`;

function gavetaItem(id) {
  const it = pool.item(id);
  if (!it) return null;
  const reps = (it.repete || []).map((r) => {
    const o = pool.item(r.id);
    return o ? `<li>${r.exata ? '<b>Mesma imagem e mesmo recorte</b>' : 'Mesma foto, outro recorte (permitido)'}: <button type="button" class="mk-link" data-ir="i:${esc(o.id)}">${esc(o.titulo || o.projeto)}</button> · ${esc(STATUS_NOME[o.status])}${o.dia ? ` ${dataCurta(o.dia)}` : ''}</li>` : '';
  }).join('');
  const copia = (rot, k, v) => (v ? `<div class="mk-copia"><div><span>${rot}</span>${acao('Copiar', { dados: { copiar: k } })}</div><p>${esc(v)}</p></div>` : '');
  const campos = [
    ['Imagem', `<span class="mk-gv-img" style="aspect-ratio:${it.formato === 'pin' ? '2 / 3' : '3 / 4'}"><img src="${it.miniatura || ''}" alt="" data-g-img></span>${it.imagens?.length > 1 ? `<small class="mk-mudo">${it.imagens.length} imagens</small>` : ''}`],
    ['Projeto', esc(`${it.projeto || '—'} · Odisse ${nomeNuc(it.nucleo)}`)],
    ['Plataforma', esc([plano.nomePlataforma(it.rede), it.pin?.pastaNome].filter(Boolean).join(' · '))],
    ['Dia', campoData('dia', it.dia)],
    ['Encaixe', seletor('enc', opcoesEncaixe(it.dia, (e) => plano.itemServe(e, it), it.pos != null ? `${it.rede}|${it.pos}` : ''))],
    ['Situação', segmentado(pool.STATUS.map(([v, r]) => ({ id: v, rotulo: r })), it.status, 'g-sit')],
    ['Origem', segmentado(pool.ORIGENS.map(([v, r]) => ({ id: v, rotulo: r })), it.origem, 'g-orig')],
  ];
  if (reps) campos.push(['Repetição', `<ul class="mk-gv-lista">${reps}</ul>`]);
  if (it.avisos?.length) campos.push(['Avisos', `<ul class="mk-gv-lista">${it.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`]);
  if (it.pin) campos.push(['Textos do pin', `${copia('Título', 'titulo', it.pin.titulo)}${copia('Descrição', 'descricao', it.pin.descricao)}${copia('Texto alternativo', 'alt', it.pin.alt)}${copia('Link', 'link', it.pin.link)}${it.pin.tipo === 'video' ? '<p class="mk-mudo">Capa de pin de vídeo: suba com o master limpo do vídeo.</p>' : ''}`]);
  const g = gaveta.abrir({
    etiqueta: `${etiqueta(plano.nomePlataforma(it.rede), 'marketing')} ${quando(STATUS_NOME[it.status] || '', it.status === 'publicado' ? 'ok' : it.status === 'agendado' ? 'hora' : '')}`,
    titulo: it.titulo || 'Sem título',
    campos,
    acoes: `${acao(it.imagens?.length > 1 ? 'Baixar imagens (.zip)' : 'Baixar imagem', { principal: true, dados: { 'g-acao': 'baixar' } })}
      ${acao('Abrir no editor', { href: `#/p/${it.pub}${it.card ? '/' + it.card : ''}` })}
      ${it.dia && it.status !== 'publicado' ? acao('Voltar para o pool', { dados: { 'g-acao': 'devolver' } }) : ''}
      ${acao('Remover do pool', { dados: { 'g-acao': 'remover' } })}`,
  });
  g.dataset.item = it.id;
  nuvem.baixarBlob(it.imagens?.[0]?.ref).then((b) => {
    if (g.dataset.item !== it.id || !g.isConnected) return;
    const im = $('[data-g-img]', g);
    if (im) { const u = URL.createObjectURL(b); im.src = u; im.onload = () => setTimeout(() => URL.revokeObjectURL(u), 1000); }
  }).catch(() => {});
  return g;
}

function gavetaPauta(id) {
  const p = plano.pauta(id);
  if (!p) return null;
  const pid = plano.plataformaDaPauta(p);
  const g = gaveta.abrir({
    etiqueta: `${etiqueta(plano.nomePlataforma(pid), 'marketing')} ${quando(STATUS_PAUTA[p.status] || '')}`,
    titulo: p.angulo || 'Pauta',
    texto: [p.obra, plano.FONTE_POR_ID[p.fonte]?.[1]].filter(Boolean).join(' · '),
    campos: [
      ['Formato', esc(plano.rotuloDaPauta(p))],
      ['Núcleo', esc(nomeNuc(p.nucleo))],
      ['Dia', campoData('dia', p.dia)],
      ['Encaixe', seletor('enc', opcoesEncaixe(p.dia, (e) => plano.pautaServe(e, p), p.pos != null ? `${pid}|${p.pos}` : ''))],
      ['Situação', segmentado(plano.STATUS_PAUTA.map(([v, r]) => ({ id: v, rotulo: r })), p.status, 'g-psit')],
      ...(p.notas ? [['Notas', esc(p.notas)]] : []),
    ],
    acoes: `${p.dia ? acao('Tirar do calendário', { dados: { 'g-acao': 'tirar' } }) : ''}${acao('Banco de pautas', { href: '#/estrategia/pautas' })}`,
  });
  g.dataset.pauta = p.id;
  return g;
}

function gavetaLacuna(dia, pid, pos) {
  const e = plano.encaixesDe(dia, pid).find((x) => x.pos === Number(pos));
  if (!e) return null;
  const itens = pool.lista().filter((x) => x.status === 'pronto' && plano.itemServe(e, x));
  const pts = plano.listaPautas().filter((p) => !p.dia && p.status !== 'publicada' && plano.pautaServe(e, p));
  const escolha = (html, dados) => `<button type="button" class="mk-escolha"${Object.entries(dados).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}>${html}</button>`;
  const g = gaveta.abrir({
    etiqueta: `${etiqueta(plano.nomePlataforma(pid), 'marketing')} ${quando('Lacuna')}`,
    titulo: e.rotulo,
    texto: `${pool.dataLonga(dia)} · ${e.horario || 'sem horário'} · ${nomeNuc(e.nucleo) || 'qualquer núcleo'}`,
    campos: [
      ['Do pool', itens.length ? itens.map((it) => escolha(`${thumb(it, ' is-l')}<span class="mk-tit"><b>${esc(it.titulo || 'Sem título')}</b><small>${esc(`${it.projeto || ''} · ${nomeNuc(it.nucleo)}`)}</small></span>`, { 'g-item': it.id })).join('') : '<span class="mk-mudo">Nada no pool serve a este encaixe.</span>'],
      ['Pautas', pts.length ? pts.map((p) => escolha(`<span class="mk-th is-l is-pauta"></span><span class="mk-tit"><b>${esc(p.angulo || 'Pauta')}</b><small>${esc(`${p.obra || ''} · ${nomeNuc(p.nucleo)}`)}</small></span>`, { 'g-pauta': p.id })).join('') : '<span class="mk-mudo">Nenhuma pauta sem dia para este formato.</span>'],
    ],
    acoes: acao('Nova pauta no banco', { href: '#/estrategia/pautas' }),
  });
  g.dataset.lacuna = `${dia}|${pid}|${pos}`;
  return g;
}

function gavetaCota(dia, pid) {
  const cota = plano.cotaDoDia(dia, pid);
  const no = pool.lista().filter((x) => x.rede === pid && x.dia === dia);
  const prontos = pool.lista().filter((x) => x.rede === pid && x.status === 'pronto');
  const escolha = (it, dados) => `<button type="button" class="mk-escolha"${Object.entries(dados).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}>${thumb(it, ' is-l')}<span class="mk-tit"><b>${esc(it.titulo || 'Sem título')}</b><small>${esc([it.projeto, it.pin?.pastaNome].filter(Boolean).join(' · '))}</small></span></button>`;
  const g = gaveta.abrir({
    etiqueta: `${etiqueta(plano.nomePlataforma(pid), 'marketing')} ${quando(`${no.length} de ${cota}`, no.length >= cota ? 'ok' : 'atencao')}`,
    titulo: `${plano.plataforma(pid)?.formatos?.[0]?.nome || 'Cota'} · ${pool.dataLonga(dia)}`,
    campos: [
      ['No dia', no.length ? no.map((it) => escolha(it, { ir: `i:${it.id}` })).join('') : '<span class="mk-mudo">Nada agendado neste dia.</span>'],
      ...(no.length < cota ? [['Do pool', prontos.length ? prontos.map((it) => escolha(it, { 'g-item-dia': it.id })).join('') : '<span class="mk-mudo">Nada pronto no pool.</span>']] : []),
    ],
  });
  g.dataset.cota = `${dia}|${pid}`;
  return g;
}

async function cliqueGaveta(ev) {
  const g = ev.currentTarget;
  const t = ev.target;
  if (t.closest('a[href]')) { gaveta.fechar(true); chaveGaveta = ''; return; }
  const ir = t.closest('[data-ir]');
  if (ir) { abrir(ir.dataset.ir); return; }
  const seg = t.closest('[data-segmentado]');
  if (g.dataset.item) {
    const it = pool.item(g.dataset.item);
    if (!it) return;
    if (seg?.dataset.segmentado === 'g-sit') {
      it.status = seg.dataset.valor;
      if (it.status === 'publicado') { if (!it.dia) it.dia = pool.hoje(); it.publicadoEm = it.dia; }
      else { it.publicadoEm = ''; if (it.status === 'pronto') { it.dia = ''; it.pos = null; } if (it.status === 'agendado' && !it.dia) it.dia = pool.hoje(); }
      await salvarItem(it);
      return;
    }
    if (seg?.dataset.segmentado === 'g-orig') { it.origem = seg.dataset.valor; await salvarItem(it); return; }
    const b = t.closest('[data-copiar], [data-g-acao]');
    if (b?.dataset.copiar) { navigator.clipboard?.writeText(it.pin?.[b.dataset.copiar] || '').then(() => toque('Copiado.'), () => toque('Não foi possível copiar.')); return; }
    const a = b?.dataset.gAcao;
    if (a === 'baixar') { baixarItem(it).catch(() => avisar('Não foi possível baixar.')); return; }
    if (a === 'devolver') { pool.definirDia(it, ''); await salvarItem(it); return; }
    if (a === 'remover') {
      if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'Confirmar: remover do pool?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.confirmar; b.textContent = 'Remover do pool'; } }, 3000); return; }
      gaveta.fechar(true); chaveGaveta = '';
      try { await pool.apagar(it.id); } catch { avisar('Não foi possível remover na nuvem.'); }
      desenhar();
      toque('Removido do pool. A publicação continua no editor.');
    }
    return;
  }
  if (g.dataset.pauta) {
    const id = g.dataset.pauta;
    if (seg?.dataset.segmentado === 'g-psit') { mudarPautas((l) => { l.find((x) => x.id === id).status = seg.dataset.valor; }); return; }
    if (t.closest('[data-g-acao="tirar"]')) { moverPauta(id, '', null); gaveta.fechar(true); chaveGaveta = ''; desenhar(); }
    return;
  }
  if (g.dataset.lacuna) {
    const [dia, pid, pos] = g.dataset.lacuna.split('|');
    const bi = t.closest('[data-g-item]'), bp = t.closest('[data-g-pauta]');
    if (bi) { const it = pool.item(bi.dataset.gItem); if (it) { colocarItem(it, dia, pid, Number(pos)); gaveta.fechar(true); chaveGaveta = ''; toque('Publicação no encaixe.'); } return; }
    if (bp) { moverPauta(bp.dataset.gPauta, dia, Number(pos)); gaveta.fechar(true); chaveGaveta = ''; desenhar(); toque('Pauta no encaixe.'); }
    return;
  }
  if (g.dataset.cota) {
    const [dia] = g.dataset.cota.split('|');
    const bi = t.closest('[data-g-item-dia]');
    if (bi) { const it = pool.item(bi.dataset.gItemDia); if (it) { pool.definirDia(it, dia); await salvarItem(it); } }
  }
}

async function mudancaGaveta(ev) {
  const g = ev.currentTarget, t = ev.target;
  if (g.dataset.item) {
    const it = pool.item(g.dataset.item);
    if (!it) return;
    if (t.dataset.g === 'dia') {
      pool.definirDia(it, t.value);
      if (it.status === 'publicado') it.publicadoEm = it.dia;
      await salvarItem(it);
    } else if (t.dataset.g === 'enc') {
      const [pid, pos] = t.value.split('|');
      if (!t.value) { pool.definirDia(it, it.dia, null); await salvarItem(it); } else colocarItem(it, it.dia, pid, Number(pos));
    }
    return;
  }
  if (g.dataset.pauta) {
    const id = g.dataset.pauta;
    if (t.dataset.g === 'dia') { moverPauta(id, t.value, null); desenhar(); }
    else if (t.dataset.g === 'enc') { const p = plano.pauta(id); moverPauta(id, p?.dia || '', t.value ? Number(t.value.split('|')[1]) : null, true); desenhar(); }
  }
}

// ---------------------------------------------------------------------------
// Gravação

function mudarPautas(fn) {
  const l = structuredClone(plano.listaPautas());
  fn(l);
  plano.gravarPautas(l).then((ok) => { if (!ok) avisar('Pautas guardadas neste computador; não foi possível salvar na nuvem.'); });
  desenhar();
}
/** Leva uma pauta para um dia e, se houver, para um encaixe (o que estava nele volta para a lista). Solta no dia
 *  (sem `exato`), vai para o primeiro encaixe livre que serve. */
function moverPauta(id, dia, pos, exato = false) {
  const l = structuredClone(plano.listaPautas());
  const p = l.find((x) => x.id === id);
  if (!p) return;
  const pid = plano.plataformaDaPauta(p);
  if (dia && pos == null && !exato) {
    const livre = plano.encaixesDe(dia, pid).find((e) => plano.pautaServe(e, p) && !plano.ocupantes(dia, pid, e.pos).pauta && !plano.ocupantes(dia, pid, e.pos).item);
    pos = livre ? livre.pos : null;
  }
  if (dia && pos != null) for (const o of l) if (o.id !== id && o.dia === dia && o.pos === pos && plano.plataformaDaPauta(o) === pid) { o.dia = ''; o.pos = null; }
  p.dia = dia || '';
  p.pos = dia && pos != null ? pos : null;
  plano.gravarPautas(l).then((ok) => { if (!ok) avisar('Pautas guardadas neste computador; não foi possível salvar na nuvem.'); });
}
/** A pauta do encaixe acompanha o item: pronta quando ele chega, publicada quando ele é publicado. */
function sincronizarPauta(it) {
  if (!it.dia || it.pos == null) return;
  const pt = plano.ocupantes(it.dia, it.rede, it.pos).pauta;
  if (!pt) return;
  const novo = it.status === 'publicado' ? 'publicada' : ['pauta', 'producao'].includes(pt.status) ? 'pronta' : pt.status;
  if (novo === pt.status) return;
  const l = structuredClone(plano.listaPautas());
  l.find((x) => x.id === pt.id).status = novo;
  plano.gravarPautas(l);
}
async function salvarItem(it) {
  sincronizarPauta(it);
  desenhar();
  try { await pool.gravar(it); } catch (e) { console.warn(e); avisar('Não foi possível salvar na nuvem.'); }
}
/** Põe o item num encaixe; o que estava nele (e não foi publicado) volta para o pool. */
function colocarItem(it, dia, pid, pos) {
  const antes = plano.ocupantes(dia, pid, pos).item;
  if (antes && antes.id !== it.id && antes.status !== 'publicado') { pool.definirDia(antes, ''); pool.gravar(antes).catch(() => {}); }
  pool.definirDia(it, dia, pos);
  if (it.status === 'publicado') it.publicadoEm = dia;
  salvarItem(it);
}

// ---------------------------------------------------------------------------
// Downloads

function baixar(blob, nome) {
  const u = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: u, download: nome });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
const slug = (s) => plano.slug(s);

async function baixarItem(it) {
  if (it.imagens.length === 1) { baixar(await nuvem.baixarBlob(it.imagens[0].ref), it.imagens[0].nome); return; }
  const zip = new window.JSZip();
  for (const m of it.imagens) zip.file(m.nome, await nuvem.baixarBlob(m.ref));
  baixar(await zip.generateAsync({ type: 'blob' }), `${slug(it.projeto) || 'carrossel'}.zip`);
}

/** Lote da semana (segunda a domingo): uma pasta por dia e o textos.txt, para agendar de uma vez. */
async function baixarLote(seg) {
  const fim = pool.somarDias(seg, 6);
  const itens = pool.lista().filter(passaItem).filter((x) => x.dia >= seg && x.dia <= fim)
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.rede.localeCompare(b.rede));
  if (!itens.length) { toque('Nada agendado nesta semana.'); return; }
  toque(`Baixando ${itens.length} ${itens.length === 1 ? 'mídia' : 'mídias'} da semana…`);
  const zip = new window.JSZip();
  const pins = [], outros = [];
  for (const it of itens) {
    const pasta = it.pin ? it.dia : `${it.dia}/${slug(it.projeto) || 'carrossel'}`;
    for (const m of it.imagens) zip.file(`${pasta}/${m.nome}`, await nuvem.baixarBlob(m.ref));
    if (it.pin) {
      pins.push({ numero: String(pins.length + 1).padStart(2, '0'), dia: it.dia, arquivo: `${pasta}/${it.imagens[0].nome}`, pasta: it.pin.pastaNome, titulo: it.pin.titulo,
        descricao: it.pin.descricao, alt: it.pin.alt, link: it.pin.link, idioma: it.pin.idioma, tipo: it.pin.tipo, avisos: it.avisos || [] });
    } else outros.push({ it, pasta });
  }
  let txt = pins.length ? pinterest.textosDoLote({ projeto: `semana de ${dataCurta(seg)} a ${dataCurta(fim)}`, nucleo: 'Pool de mídias', pins }) : '';
  if (outros.length) {
    txt += `${txt ? '\r\n\r\n' : ''}Semana de ${dataCurta(seg)} a ${dataCurta(fim)}\r\n\r\n` + outros.map(({ it, pasta }) => {
      const e = it.pos != null ? plano.encaixesDe(it.dia, it.rede).find((x) => x.pos === it.pos) : null;
      return `${pool.dataLonga(it.dia)}${e?.horario ? ` · ${e.horario}` : ''} · ${plano.nomePlataforma(it.rede)} · ${it.projeto} · ${it.imagens.length} ${it.imagens.length === 1 ? 'imagem' : 'cards'} · ${pasta}/`;
    }).join('\r\n');
  }
  zip.file('textos.txt', txt);
  baixar(await zip.generateAsync({ type: 'blob' }), `lote-${seg}.zip`);
  toque('Lote da semana baixado (.zip, com textos.txt).');
}

async function distribuir(b) {
  const p = plano.plataforma(b.dataset.distribuir);
  if (!p) return;
  const d = planoDe(p);
  if (!d.plano.length) return;
  const dias = d.plano.map((x) => x.dia).sort();
  if (!b.dataset.confirmar) {
    b.dataset.confirmar = '1';
    b.textContent = `Agendar ${d.plano.length} de ${dataCurta(dias[0])} a ${dataCurta(dias[dias.length - 1])}?`;
    setTimeout(() => { if (b.isConnected) { delete b.dataset.confirmar; b.textContent = 'Distribuir'; } }, 4000);
    return;
  }
  for (const x of d.plano) pool.definirDia(x.item, x.dia);
  ui.ref = dias[0];
  desenhar();
  const falhas = (await Promise.all(d.plano.map((x) => pool.gravar(x.item).then(() => 0, () => 1)))).reduce((a, x) => a + x, 0);
  toque(falhas ? `${falhas} itens não foram salvos na nuvem.` : `${d.plano.length} agendados de ${dataCurta(dias[0])} a ${dataCurta(dias[dias.length - 1])}.`);
}

// ---------------------------------------------------------------------------
// Eventos

function compativel(alvo, dado) {
  if (!dado) return false;
  const [tipo, id] = dado.split(/:(.+)/);
  const k = alvo.dataset.alvo;
  if (k === 'pool' || k === 'dia') return true;
  const dia = alvo.dataset.dia, pid = alvo.dataset.plat;
  if (tipo === 'item') {
    const it = pool.item(id);
    if (!it) return false;
    if (k === 'cota') return it.rede === pid;
    const e = plano.encaixesDe(dia, pid).find((x) => x.pos === Number(alvo.dataset.pos));
    return !!e && plano.itemServe(e, it);
  }
  const p = plano.pauta(id);
  if (!p || k === 'cota') return false;
  const e = plano.encaixesDe(dia, pid).find((x) => x.pos === Number(alvo.dataset.pos));
  return !!e && plano.pautaServe(e, p);
}

function ligar() {
  let arrastando = '';
  raiz.addEventListener('click', (e) => {
    const t = e.target;
    const seg = t.closest('[data-segmentado]');
    if (seg) {
      const g = seg.dataset.segmentado, v = seg.dataset.valor;
      if (g === 'plat') ui.plat = v;
      else if (g === 'nuc') ui.nuc = v;
      else if (g === 'vista') { ui.vista = v; lembrar.gravar('universo-cal-vista', v); }
      else if (g === 'lado') ui.lado = v;
      else if (g === 'pool-sit') ui.poolSit = v;
      else if (g === 'pool-orig') ui.poolOrig = v;
      else if (g === 'pool-vista') { ui.poolVista = v; history.replaceState(null, '', v === 'tabela' ? '#/calendario/pool/tabela' : '#/calendario/pool'); }
      desenhar();
      return;
    }
    const b = t.closest('button');
    if (b?.dataset.nav !== undefined) { navegar(Number(b.dataset.nav)); desenhar(); return; }
    if (b?.dataset.lote) { baixarLote(b.dataset.lote).catch((err) => { console.warn(err); avisar('Não foi possível baixar o lote.'); }); return; }
    if (b?.dataset.csv !== undefined) { baixarCsv(); return; }
    if (b?.dataset.ladoFechar !== undefined) { ui.ladoAberto = false; lembrar.gravar('universo-cal-lado', '0'); desenhar(); return; }
    if (b?.dataset.ladoAbrir !== undefined) { ui.ladoAberto = true; lembrar.gravar('universo-cal-lado', '1'); desenhar(); return; }
    if (b?.dataset.personalizar !== undefined) { ui.personalizar = true; desenhar(); return; }
    if (b?.dataset.distribuir) { distribuir(b); return; }
    if (b?.dataset.abre) { abrir(b.dataset.abre); return; }
    if (t.closest('a[href]')) return;
    if (arrastando) return;
    const el = t.closest('[data-abre]');
    if (el?.dataset.abre) abrir(el.dataset.abre);
  });
  raiz.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest?.('[data-abre][tabindex]');
    if (!el || e.target.closest('button, a, input, select')) return;
    e.preventDefault();
    abrir(el.dataset.abre);
  });
  raiz.addEventListener('change', (e) => {
    if (e.target.matches('[data-dist-inicio]')) { ui.inicioDist = e.target.value; desenhar(); }
  });
  raiz.addEventListener('input', (e) => {
    if (!e.target.matches('[data-pool-busca]')) return;
    ui.poolBusca = e.target.value;
    clearTimeout(ligar.t);
    ligar.t = setTimeout(() => { desenhar(); const c = $('[data-pool-busca]', raiz); c?.focus(); c?.setSelectionRange(c.value.length, c.value.length); }, 250);
  });
  window.addEventListener('resize', () => { clearTimeout(ligar.r); ligar.r = setTimeout(() => { if (document.body.classList.contains('vista-calendario')) desenhar(); }, 200); });

  // arrastar: do lado para o encaixe ou o dia, entre dias e de volta ao lado; só os compatíveis se acendem
  raiz.addEventListener('dragstart', (e) => {
    const el = e.target.closest?.('[draggable="true"][data-item], [draggable="true"][data-pauta]');
    if (!el) return;
    arrastando = el.dataset.item ? `item:${el.dataset.item}` : `pauta:${el.dataset.pauta}`;
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', arrastando);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('is-pego');
    const cal = $('.mk-cal', raiz);
    cal?.classList.add('is-arrastando');
    raiz.querySelectorAll('[data-alvo="enc"], [data-alvo="cota"]').forEach((a) => a.classList.toggle('is-alvo', compativel(a, arrastando)));
  });
  const fim = () => {
    raiz.querySelectorAll('.is-alvo, .is-sobre, .is-pego').forEach((x) => x.classList.remove('is-alvo', 'is-sobre', 'is-pego'));
    $('.mk-cal', raiz)?.classList.remove('is-arrastando');
    setTimeout(() => { arrastando = ''; }, 0);
  };
  document.addEventListener('dragend', fim);
  const alvoDe = (t) => {
    const a = t.closest?.('[data-alvo="enc"], [data-alvo="cota"]');
    if (a) return compativel(a, arrastando) ? a : null;
    return t.closest?.('[data-alvo="dia"], [data-alvo="pool"]');
  };
  raiz.addEventListener('dragover', (e) => {
    if (!arrastando) return;
    const a = alvoDe(e.target);
    raiz.querySelectorAll('.is-sobre').forEach((x) => x !== a && x.classList.remove('is-sobre'));
    if (!a) return;
    e.preventDefault();
    a.classList.add('is-sobre');
  });
  raiz.addEventListener('drop', async (e) => {
    const a = alvoDe(e.target);
    const dado = e.dataTransfer.getData('text/plain') || arrastando;
    if (!a || !dado) return;
    e.preventDefault();
    fim();
    const [tipo, id] = dado.split(/:(.+)/);
    const k = a.dataset.alvo, dia = a.dataset.dia || '';
    if (tipo === 'pauta') {
      if (k === 'pool') moverPauta(id, '', null);
      else if (k === 'enc') moverPauta(id, dia, Number(a.dataset.pos), true);
      else moverPauta(id, dia, null);
      desenhar();
      return;
    }
    const it = pool.item(id);
    if (!it) return;
    if (k === 'pool') {
      if (it.status === 'publicado') { avisar('Publicado não volta ao pool. Mude a situação na Gaveta, se precisar.'); return; }
      pool.definirDia(it, '');
      await salvarItem(it);
      return;
    }
    if (k === 'enc') { colocarItem(it, dia, a.dataset.plat, Number(a.dataset.pos)); return; }
    pool.definirDia(it, dia, null);
    if (it.status === 'publicado') it.publicadoEm = dia;
    await salvarItem(it);
  });
}
