// Início (#/) — v3 (Cid, 23–24/11): uma coluna larga, no padrão novo (base/v2/componentes.js).
//
// Uma leitura só (GET /api/inicio, worker/inicio.js). De cima para baixo:
//   1. Números lado a lado: Pedem você hoje · Propostas aguardando (recorte) · Entregas da semana (recorte) · Fora da meta (→ KPIs)
//   2. Hoje: uma lista só, em três grupos, filtrada por área (Segmentado):
//        Atrasados   credenciais vencidas, follow-up de proposta sem resposta há 7 dias ou mais, publicações atrasadas
//        Com horário publicações de hoje com horário (Confirmar publicação)
//        Para fazer  eventos com o cliente hoje e entregas que vencem até amanhã (Escopo), assinaturas de contrato,
//                    publicações sem horário, o aviso do balanço do mês
//      Clicar na linha abre a Gaveta com o detalhe; o círculo marca como feito NESTE computador, no dia (não grava no servidor).
//   3. Projetos em andamento: etapa de hoje, próximo marco e entregas feitas/total (calendário do Escopo, no servidor)
//   4. Fora da meta (indicadores abaixo do mínimo, pela projeção do mês) | Novo no Radar, lado a lado
// Abre na hora com a última cópia (memoria.js), confere a cada abertura e a cada 2 h. As contagens do menu saem daqui.

import { lerCopia, gravarCopia, igual } from './memoria.js';
import { abrirBalanco } from './kpis.js';
import { pedirSubstituicao } from './credenciais.js';
import { cabecalho, numeros, segmentado, recorte, secao, bandeja, lista, nome, etiqueta, quando, acao, medidor, marcador, link, gaveta, icone, esc }
  from '../base/v2/componentes.js';

const COPIA = 'inicio';
const INTERVALO = 2 * 3600 * 1000;
const RADAR = 'https://radar.odisse.com.br';
const CALENDARIO = 'https://marketing.odisse.com.br/#/calendario';
const VENDAS = '/vendas/';
const PROJETO = 'https://projetos.odisse.com.br/projeto.html#';
const FOLLOW_UP = 7; // dias sem resposta para a proposta pedir follow-up (sugestão do Claude, 24/11; a confirmar)

const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const REAIS = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const milReais = (v) => (v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : v >= 1e3 ? `R$ ${Math.round(v / 1e3).toLocaleString('pt-BR')} mil` : REAIS(v));
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const dataBr = (d) => (d ? d.split('-').reverse().join('/') : '');
const diasAte = (dia, hoje) => Math.round((Date.parse(dia + 'T12:00:00Z') - Date.parse(hoje + 'T12:00:00Z')) / 864e5);
function quandoDia(dia, hoje) {
  const n = diasAte(dia, hoje);
  if (n === 0) return ['hoje', 'atencao'];
  if (n === 1) return ['amanhã', 'atencao'];
  if (n > 1) return [`em ${n} dias`, n <= 3 ? 'atencao' : ''];
  return [`há ${-n} ${n === -1 ? 'dia' : 'dias'}`, 'atraso'];
}
const fmtInd = (f, v) => (v == null ? '—' : f === 'reais' ? REAIS(v) : f === 'pct' ? Math.round(v * 100) + '%' : f === 'dias' ? Math.round(v) + ' dias' : Math.round(v).toLocaleString('pt-BR'));

// Contagens do menu lateral a partir da leitura da Início (o hub chama ao abrir, com a última cópia).
export function contagensDe(d) {
  if (!d) return {};
  const r = d.radar && !d.radar.erro ? (d.radar.concursos || 0) + (d.radar.terrenos || 0) + (d.radar.licitacoes || 0) + (d.radar.contratos || 0) : 0;
  const at = d.publicacoes?.atrasadas || 0;
  return {
    inicio: itensDe(d).filter((i) => !feitos(d.hoje)[i.id]).length,
    radar: r ? { n: r, tipo: 'novo', rotulo: `${r} novos hoje` } : 0,
    calendario: at ? { n: at, tipo: 'alerta', rotulo: `${at} atrasadas` } : 0,
  };
}
export const arvoreDe = (d) => (d?.projetos?.itens || []).map((p) => ({ nome: p.nome, cod: p.codigo.slice(-3), href: PROJETO + p.id }));

// feitos neste computador, por dia
const chaveFeitos = (dia) => `universo:inicio-feitos:${dia}`;
function feitos(dia) { try { return JSON.parse(localStorage.getItem(chaveFeitos(dia)) || '{}'); } catch { return {}; } }
function gravarFeitos(dia, f) { try { localStorage.setItem(chaveFeitos(dia), JSON.stringify(f)); } catch {} }

// ---- a lista "Hoje" a partir da leitura --------------------------------------------------------------
// item: { id, grupo: atr|hora|fazer, area, tipo, titulo, contexto, quando: [texto, tom], ordem, acao: { texto, href|dados, principal }, campos, hora }
function itensDe(d) {
  const L = [];
  const hoje = d.hoje;
  for (const c of d.credenciais?.itens || []) {
    L.push({ id: 'cre:' + c.id, grupo: 'atr', area: 'gestao', tipo: 'credencial', titulo: `${c.nome}${c.titulo ? ' · ' + c.titulo : ''} vencido`,
      contexto: c.lugar_nome || 'Credenciais', quando: [`desde ${dataBr(c.vence_em)}`, 'atraso'], ordem: c.vence_em,
      acao: { texto: 'Substituir', href: c.pagina === 'empresa' ? '#/empresa' : c.pagina === 'equipe' ? `#/equipe/${c.dono_id}` : '#/credenciais', dados: { substituir: c.id } },
      campos: [['Venceu em', esc(dataBr(c.vence_em))], ['Onde', esc(c.lugar_nome || '')], ['Aviso', 'Sai quando o documento for substituído']] });
  }
  for (const p of d.propostas?.aguardando || []) {
    if (p.dias == null || p.dias < FOLLOW_UP) continue;
    L.push({ id: 'ppt:' + p.id, grupo: 'atr', area: 'comercial', tipo: 'proposta', titulo: `Follow-up da ${p.codigo}`, contexto: p.titulo,
      quando: [`sem resposta há ${p.dias} dias`, 'atraso'], ordem: p.desde, acao: { texto: 'Abrir proposta', href: VENDAS },
      campos: [['Proposta', esc(p.codigo)], ['Oportunidade', esc(p.oportunidade || '—')], ['Valor', esc(REAIS(p.valor))], ['Enviada em', esc(dataBr(p.desde))]] });
  }
  const pub = d.publicacoes || {};
  if (pub.atrasadas) {
    L.push({ id: 'pub:atrasadas', grupo: 'atr', area: 'marketing', tipo: 'post', titulo: `${pub.atrasadas} ${pub.atrasadas === 1 ? 'publicação atrasada' : 'publicações atrasadas'}`,
      contexto: 'agendadas para dias que já passaram', quando: ['antes de hoje', 'atraso'], ordem: '0',
      acao: { texto: 'Ver calendário', href: CALENDARIO, novaAba: true }, campos: [['Onde', 'Calendário editorial']] });
  }
  for (const l of pub.linhas || []) {
    const titulo = l.tipo === 'lacuna' ? 'Nada planejado ainda' : (l.titulo || 'Sem título');
    const ctx = [l.rede === 'pinterest' ? 'Pinterest' : 'Instagram', l.encaixe].filter(Boolean).join(' · ');
    const a = l.confirma ? { texto: 'Confirmar publicação', dados: { confirmar: `${l.tipo}:${l.id}` } } : { texto: l.tipo === 'lacuna' ? 'Planejar' : 'Ver calendário', href: CALENDARIO, novaAba: true };
    L.push({ id: `pub:${l.tipo}:${l.id || l.pos}`, grupo: l.horario ? 'hora' : 'fazer', area: 'marketing', tipo: 'post', titulo, contexto: ctx, hora: !!l.horario,
      quando: l.horario ? [l.horario, 'hora'] : ['hoje', ''], ordem: l.horario || '99', acao: a,
      campos: [['Rede', esc(l.rede === 'pinterest' ? 'Pinterest' : 'Instagram')], ['Situação', esc(l.tipo === 'item' ? 'pronta' : l.tipo === 'pauta' ? (l.situacao || 'pauta') : 'lacuna')], ['Encaixe', esc(l.encaixe || '—')]] });
  }
  for (const p of d.projetos?.itens || []) {
    for (const e of p.hoje || []) {
      L.push({ id: `esc:${p.id}:${e.codigo}`, grupo: 'fazer', area: 'producao', tipo: 'entrega', titulo: e.texto, contexto: `${p.nome} · ${p.codigo}`,
        quando: ['hoje', 'atencao'], ordem: '0', acao: { texto: 'Abrir escopo', href: PROJETO + p.id + '/escopo' },
        campos: [['Projeto', esc(`${p.nome} · ${p.codigo}`)], ['Evento', esc(e.codigo)], ['Com', 'o cliente']] });
    }
    for (const e of p.semana || []) {
      if (diasAte(e.dia, hoje) > 1) continue;
      L.push({ id: `ent:${p.id}:${e.codigo}`, grupo: 'fazer', area: 'producao', tipo: 'entrega', titulo: e.texto, contexto: `${p.nome} · ${e.codigo}`,
        quando: quandoDia(e.dia, hoje), ordem: e.dia, acao: { texto: 'Abrir escopo', href: PROJETO + p.id + '/escopo' },
        campos: [['Projeto', esc(`${p.nome} · ${p.codigo}`)], ['Entrega', esc(e.codigo)], ['Último dia', esc(dataBr(e.dia))]] });
    }
  }
  for (const c of d.propostas?.contratos || []) {
    L.push({ id: 'ctr:' + c.id, grupo: 'fazer', area: 'comercial', tipo: 'proposta', titulo: `Assinatura do ${c.codigo}`, contexto: c.titulo || 'contrato enviado',
      quando: [`enviado há ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}`, c.dias >= FOLLOW_UP ? 'atencao' : ''], ordem: String(1000 - c.dias),
      acao: { texto: 'Abrir contrato', href: VENDAS + 'contratos.html' }, campos: [['Contrato', esc(c.codigo)], ['Valor', esc(REAIS(c.valor))]] });
  }
  if (d.balanco?.mes) {
    const nm = NOME_MES[+d.balanco.mes.slice(5, 7) - 1];
    L.push({ id: 'bal:' + d.balanco.mes, grupo: 'fazer', area: 'gestao', tipo: 'balanco', titulo: `Balanço de ${nm} feito`, contexto: 'números do mês, retrospecto e expectativa',
      quando: ['novo', 'ok'], ordem: '1', acao: { texto: 'Ver PDF', dados: { balanco: 'ver', mes: d.balanco.mes } },
      campos: [['Fechado em', esc(new Date(d.balanco.feito_em).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }))]],
      acoes: acao('Baixar PDF', { dados: { balanco: 'baixar', mes: d.balanco.mes } }) + acao('Abrir KPIs', { href: `#/kpis?mes=${d.balanco.mes}` }) });
  }
  return L;
}

const GRUPOS = [['atr', 'Atrasados'], ['hora', 'Com horário'], ['fazer', 'Para fazer']];
const AREAS = [['tudo', 'Tudo'], ['comercial', 'Comercial'], ['producao', 'Produção'], ['marketing', 'Marketing'], ['gestao', 'Gestão']];
const RECORTES = { proposta: 'Só propostas', entrega: 'Só entregas' };

export function criarInicio({ api, toque, lerCasca = () => null }) {
  let raiz = null;
  let dados = lerCopia(COPIA);
  let timer = null;
  let buscando = null;
  let area = 'tudo';
  let corte = null;

  // ---- partes ----------------------------------------------------------------------
  function osNumeros(d, L, F) {
    const pend = L.filter((i) => !F[i.id]);
    const atr = pend.filter((i) => i.grupo === 'atr').length;
    const hr = pend.filter((i) => i.grupo === 'hora').length;
    const P = d.propostas && !d.propostas.erro ? d.propostas : null;
    const ag = P?.aguardando || [];
    const velha = ag.reduce((m, p) => Math.max(m, p.dias || 0), 0);
    const fu = ag.filter((p) => p.dias >= FOLLOW_UP).length;
    const sem = (d.projetos?.itens || []).flatMap((p) => p.semana.map((e) => ({ ...e, projeto: p })));
    sem.sort((a, b) => a.dia.localeCompare(b.dia));
    const prox = sem[0];
    const M = d.metas && !d.metas.erro ? d.metas : null;
    return numeros([
      { id: 'tudo', rotulo: 'Pedem você hoje', valor: pend.length, ativo: !corte,
        apoio: [atr ? `<span class="ui-quando is-atraso">${atr} ${atr === 1 ? 'atrasado' : 'atrasados'}</span>` : 'nada atrasado', hr ? `${hr} com horário` : ''].filter(Boolean).join(' · ') },
      { id: 'proposta', rotulo: 'Propostas aguardando', valor: P ? ag.length : null, sufixo: ag.length ? `${milReais(P.valor)} em jogo` : '', ativo: corte === 'proposta',
        apoio: !P ? 'sem leitura do vendas' : ag.length ? `a mais antiga há ${velha} ${velha === 1 ? 'dia' : 'dias'}${fu ? ` · ${fu} ${fu === 1 ? 'pede' : 'pedem'} follow-up` : ''}` : 'nenhuma esperando resposta' },
      { id: 'entrega', rotulo: 'Entregas da semana', valor: d.projetos && !d.projetos.erro ? sem.length : null, ativo: corte === 'entrega',
        apoio: prox ? (() => { const [t, tom] = quandoDia(prox.dia, d.hoje); return `a próxima <span class="ui-quando${tom ? ' is-' + tom : ''}">${esc(t)}</span> · ${esc(prox.codigo || prox.texto)}`; })() : 'nenhuma nos próximos 7 dias' },
      { id: 'metas', rotulo: 'Fora da meta', valor: M ? M.itens.length : null, sufixo: M ? `de ${M.total}` : '', href: '#/kpis',
        apoio: M ? (M.itens.length ? esc(M.itens.map((i) => i.nome.toLowerCase()).slice(0, 2).join(' e ')) + (M.itens.length > 2 ? ` e mais ${M.itens.length - 2}` : '') : 'todos no mínimo ou acima') : 'metas não lidas' },
    ]);
  }

  function hoje(d, L, F) {
    const passa = (i) => (area === 'tudo' || i.area === area) && (!corte || i.tipo === corte);
    const contaArea = (a) => L.filter((i) => !F[i.id] && (a === 'tudo' || i.area === a) && (!corte || i.tipo === corte)).length;
    const areas = AREAS.filter(([a]) => a === 'tudo' || L.some((i) => i.area === a)).map(([id, rotulo]) => ({ id, rotulo, n: contaArea(id) }));
    const vis = L.filter(passa);
    const grupos = GRUPOS.map(([g, nomeG]) => {
      const its = vis.filter((i) => i.grupo === g).sort((a, b) => (F[a.id] ? 1 : 0) - (F[b.id] ? 1 : 0) || String(a.ordem).localeCompare(String(b.ordem)));
      const primeiro = g === 'atr' ? its.find((i) => !F[i.id]) : null;
      return { nome: nomeG, n: its.filter((i) => !F[i.id]).length, linhas: its.map((i) => {
        const f = !!F[i.id];
        return { abre: i.id, feita: f, celulas: [
          { html: marcador(f, { hora: i.hora, rotulo: i.titulo, id: i.id }) },
          { html: nome(i.titulo, { area: i.area, contexto: i.contexto }) },
          { html: quando(...(f ? ['feito', ''] : i.quando)) },
          { html: f ? '' : acao(i.acao.texto, { ...i.acao, principal: i === primeiro }), fim: true, celular: false },
        ] };
      }) };
    });
    const lado = segmentado(areas, area, 'area', 'Filtrar a lista Hoje por área') + (corte ? recorte(RECORTES[corte], { 'tirar-recorte': '1' }) : '');
    return secao({ titulo: 'Hoje', n: contaArea(area), lado, corpo: bandeja(lista({
      colunas: '22px minmax(0,1fr) 132px 168px', colunasCelular: '22px minmax(0,1.4fr) minmax(0,1fr)',
      regua: [{ texto: '' }, { texto: 'Item' }, { texto: 'Quando' }, { texto: 'Ação', fim: true, celular: false }],
      grupos, vazio: corte || area !== 'tudo' ? 'Nada pendente neste recorte.' : 'Nada pendente hoje.',
    })) });
  }

  function projetos(d) {
    if (d.projetos?.erro) return secao({ titulo: 'Projetos em andamento', corpo: '<p class="ui-carregando">Não foi possível ler os projetos agora.</p>' });
    const its = d.projetos?.itens || [];
    return secao({ titulo: 'Projetos em andamento', n: its.length, lado: link('Abrir Projetos', 'https://projetos.odisse.com.br/'), corpo: bandeja(lista({
      colunas: 'minmax(0,1.6fr) minmax(0,1fr) minmax(0,1.4fr) 112px 120px', colunasCelular: 'minmax(0,1fr) 96px',
      regua: [{ texto: 'Projeto' }, { texto: 'Etapa', celular: false }, { texto: 'Próximo marco', celular: false }, { texto: 'Quando' }, { texto: 'Entregas', celular: false }],
      vazio: 'Nenhum projeto ativo com escopo gerado.',
      linhas: its.map((p) => {
        const q = p.suspenso ? ['suspenso', 'atencao'] : p.marco ? quandoDia(p.marco.dia, d.hoje) : ['—', ''];
        return { href: PROJETO + p.id, celulas: [
          { html: nome(p.nome, { contexto: p.codigo }) },
          { html: p.etapa ? etiqueta(p.etapa.nome) : '—', celular: false },
          { html: `<span class="ui-nome"><small style="color:var(--ui-texto)">${esc(p.marco ? p.marco.texto : 'Sem marco à frente')}</small></span>`, celular: false },
          { html: quando(...q) },
          { html: medidor(p.entregas.feitas, p.entregas.total), celular: false },
        ] };
      }),
    })) });
  }

  function metas(d, classe) {
    const M = d.metas;
    const corpo = M?.erro || !M ? '<div class="ui-lista__vazio">Não foi possível ler as metas agora.</div>' : lista({
      colunas: 'minmax(0,1fr) auto', vazio: `Os ${M.total} indicadores do mês estão no mínimo ou acima.`,
      linhas: M.itens.map((i) => ({ href: '#/kpis', celulas: [
        { html: nome(i.nome, { contexto: i.projecao != null ? `${fmtInd(i.formato, i.valor)} até hoje` : '' }) },
        { html: `<span class="ui-quando">${i.projecao != null ? 'projeção ' + esc(fmtInd(i.formato, i.projecao)) : esc(fmtInd(i.formato, i.valor))} · <span class="ui-quando is-atraso">mínimo ${esc(fmtInd(i.formato, i.minimo))}</span></span>`, fim: true },
      ] })),
    });
    return secao({ titulo: 'Fora da meta', n: M?.mes ? NOME_MES[+M.mes.slice(5, 7) - 1] : null, lado: link('KPIs', '#/kpis'), id: 'fora-da-meta', classe, corpo: bandeja(corpo) });
  }

  function radar(d, classe) {
    const r = d.radar || {};
    const q = `novos=${encodeURIComponent(d.hoje)}`;
    const tipos = r.erro ? [] : [
      [r.terrenos, 'Terrenos', `${RADAR}/terrenos?${q}`],
      [r.licitacoes, 'Licitações abertas', `${RADAR}/licitacoes?${q}&fase=abertas`],
      [r.contratos, 'Contratos de obra', `${RADAR}/licitacoes?${q}&fase=contratadas`],
      [r.concursos, 'Concursos', `${RADAR}/?${q}`],
    ].filter(([n]) => n > 0);
    const total = tipos.reduce((s, [n]) => s + n, 0);
    const corpo = lista({ colunas: '28px minmax(0,1fr) 16px', vazio: r.erro ? 'Não foi possível ler o Radar agora.' : 'Nada novo hoje no Radar.',
      linhas: tipos.map(([n, rot, url]) => ({ href: url, celulas: [{ html: `<span class="ui-num-linha">${n}</span>` }, { html: nome(rot, { contexto: 'entraram hoje' }) }, { html: icone('seta', 14, 2) }] })) });
    return secao({ titulo: 'Novo no Radar', n: total, lado: link('Radar', RADAR + '/'), classe, corpo: bandeja(corpo) });
  }

  // ---- página ------------------------------------------------------------------------
  function desenhar() {
    if (!raiz) return;
    const dia = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const dado = esc(dia.charAt(0).toUpperCase() + dia.slice(1)) + (dados?.em ? ` · atualizado às ${esc(hora(dados.em))}` : '');
    if (!dados) { raiz.innerHTML = `<div class="ui-coluna">${cabecalho('Início', dado)}<p class="ui-carregando">Carregando o panorama do dia…</p></div>`; return; }
    const L = itensDe(dados);
    const F = feitos(dados.hoje);
    raiz.innerHTML = `<div class="ui-coluna">${cabecalho('Início', dado)}${osNumeros(dados, L, F)}${hoje(dados, L, F)}${projetos(dados)}
      <div class="ui-secao ui-metades">${metas(dados, '')}${radar(dados, '')}</div></div>`;
    lerCasca()?.contar(contagensDe(dados));
    lerCasca()?.arvore('projetos', arvoreDe(dados));
  }

  async function buscar() {
    if (buscando) return buscando;
    buscando = (async () => {
      const r = await api('/api/inicio').catch((e) => ({ status: 0, error: e.message }));
      if (r.status !== 200) {
        if (!dados && raiz) raiz.querySelector('.ui-carregando')?.replaceChildren('Não foi possível falar com o servidor do Universo. Tente de novo em instantes.');
        return;
      }
      const { status, ...novo } = r;
      const mudou = !igual({ ...novo, em: null }, dados ? { ...dados, em: null } : null);
      dados = novo;
      gravarCopia(COPIA, dados);
      if (mudou) desenhar();
      else raiz?.querySelector('.ui-cab__dado')?.replaceChildren(document.createTextNode(raiz.querySelector('.ui-cab__dado').textContent.replace(/atualizado às .*$/, `atualizado às ${hora(dados.em)}`)));
    })().finally(() => { buscando = null; });
    return buscando;
  }

  async function confirmar(botao) {
    const [tipo, id] = botao.dataset.confirmar.split(':');
    botao.disabled = true;
    const r = await api('/api/inicio/publicar', { method: 'POST', body: JSON.stringify({ tipo, id }) }).catch(() => ({ status: 0 }));
    if (r.status !== 200) { botao.disabled = false; toque(r.error ? `Não confirmou: ${r.error}` : 'Não foi possível confirmar agora'); return; }
    const p = dados?.publicacoes;
    if (p?.linhas) { p.linhas = p.linhas.filter((l) => !(l.tipo === tipo && l.id === id)); p.publicadas = (p.publicadas || 0) + 1; gravarCopia(COPIA, dados); }
    gaveta.fechar(true);
    desenhar();
    toque('Publicação confirmada no calendário');
    buscar();
  }

  function abrirItem(id) {
    const i = itensDe(dados).find((x) => x.id === id);
    if (!i) return;
    raiz.querySelectorAll('.is-sel').forEach((el) => el.classList.remove('is-sel'));
    raiz.querySelector(`[data-abre="${CSS.escape(id)}"]`)?.classList.add('is-sel');
    gaveta.aoFechar = () => raiz?.querySelectorAll('.is-sel').forEach((el) => el.classList.remove('is-sel'));
    const principal = i.acao.href
      ? `<a class="ui-botao-largo" href="${esc(i.acao.href)}"${i.acao.novaAba ? ' target="_blank" rel="noopener"' : ''}${Object.entries(i.acao.dados || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}>${esc(i.acao.texto)}</a>`
      : `<button type="button" class="ui-botao-largo"${Object.entries(i.acao.dados || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}>${esc(i.acao.texto)}</button>`;
    const g = gaveta.abrir({ etiqueta: etiqueta('', i.area), titulo: i.titulo, texto: i.contexto,
      campos: [['Quando', quando(...i.quando)], ...(i.campos || [])], acoes: (i.acoes || '') + principal });
    g.addEventListener('click', aoClicar);
  }

  function aoClicar(ev) {
    const m = ev.target.closest('[data-marcar]');
    if (m) {
      ev.stopPropagation();
      const F = feitos(dados.hoje);
      if (F[m.dataset.marcar]) delete F[m.dataset.marcar]; else F[m.dataset.marcar] = 1;
      gravarFeitos(dados.hoje, F);
      desenhar();
      return;
    }
    const sub = ev.target.closest('[data-substituir]');
    if (sub) { pedirSubstituicao(sub.dataset.substituir); gaveta.fechar(true); return; }
    const bal = ev.target.closest('[data-balanco]');
    if (bal) {
      bal.disabled = true;
      abrirBalanco(api, bal.dataset.mes, { baixar: bal.dataset.balanco === 'baixar' })
        .catch((e) => toque('Não foi possível montar o PDF: ' + e.message)).finally(() => { bal.disabled = false; });
      return;
    }
    const c = ev.target.closest('[data-confirmar]');
    if (c) { ev.preventDefault(); ev.stopPropagation(); confirmar(c); return; }
    const seg = ev.target.closest('[data-segmentado="area"]');
    if (seg) { area = seg.dataset.valor; desenhar(); return; }
    const num = ev.target.closest('[data-numero]');
    if (num) { const v = num.dataset.numero; corte = v === 'tudo' || corte === v ? null : v; if (v === 'tudo') area = 'tudo'; desenhar(); return; }
    if (ev.target.closest('[data-tirar-recorte]')) { corte = null; desenhar(); return; }
    if (ev.target.closest('a, button')) return;
    const linha = ev.target.closest('[data-abre]');
    if (linha && raiz.contains(linha) && !getSelection().toString()) abrirItem(linha.dataset.abre);
  }
  function aoTeclar(ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const linha = ev.target.closest('[data-abre]');
    if (linha && ev.target === linha) { ev.preventDefault(); abrirItem(linha.dataset.abre); }
  }
  function aoVoltar() {
    if (document.visibilityState !== 'visible' || !raiz?.isConnected) return;
    if (Date.now() - (dados?.em ? Date.parse(dados.em) : 0) >= INTERVALO) buscar();
  }

  function ligar(el) {
    raiz = el;
    clearInterval(timer);
    raiz.addEventListener('click', aoClicar);
    raiz.addEventListener('keydown', aoTeclar);
    desenhar();
    buscar();
    timer = setInterval(() => { if (raiz?.isConnected) buscar(); else clearInterval(timer); }, INTERVALO);
    if (!ligar.feito) { document.addEventListener('visibilitychange', aoVoltar); ligar.feito = true; }
  }

  return { ligar };
}
