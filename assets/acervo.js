// Biblioteca › Acervo (#/acervo; Cid, 19/11): o banco único de imagens de projetos, objetos e coleções.
//
// Cada imagem pertence a um ou mais alvos (projeto, objeto, coleção) e tem o marcador "pública": ligado, fica
// disponível para o site e afins (o editor do site oferece as públicas do projeto; o marketing só vê as
// públicas); desligado, fica restrita ao projeto. Toda imagem nasce restrita, e só pode ser pública com
// direitos livres. Os brutos ficam no Drive: aqui sobem as três versões (2400 / 1200 / 960 px).
//
// Desenho: Trilha → título (+ "Enviar imagens" em Ocre) → Filtros (busca · alvo · Seletor Todas/Públicas/
// Restritas) → Vitrine de miniaturas (cartão inteiro abre a Gaveta; caixa de marcar sempre visível) →
// "Carregar mais" → notas no fim. Com imagens marcadas, a Barra de seleção aparece presa ao pé.
// Gaveta: onde a imagem está (etiquetas com × e "+ Acrescentar"), site e direitos, descrição; cada campo grava
// sozinho ao sair dele.
//
// Leituras: GET /api/v1/acervo (lista juntada, com os alvos de cada imagem) e GET /api/v1/acervo/alvos.

import { lerCopia, gravarCopia, igual, imagemGuardada } from './memoria.js';
import { prepararImagem } from '../base/v1/imagens.js';

const LEMBRAR = 'universo:acervo:';
const POR_PAGINA = 60;
const DIREITOS = [['', '—'], ['livre', 'Livre'], ['uso_interno', 'Uso interno'], ['aguarda_autorizacao', 'Aguarda autorização']];
const TIPO = { projeto: 'Projeto', objeto: 'Objeto', colecao: 'Coleção' };

const SVG = {
  lapis: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 2.6 13.4 5.4 5.6 13.2 2.4 13.6 2.8 10.4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  marca: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fechar: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 12 12M12 4 4 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  imagem: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="m4 17 5-5 4 4 2.5-2.5L20 18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="15.5" cy="9.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
};

const lembrar = {
  ler(k, padrao) { try { const v = localStorage.getItem(LEMBRAR + k); return v == null ? padrao : JSON.parse(v); } catch { return padrao; } },
  gravar(k, v) { try { localStorage.setItem(LEMBRAR + k, JSON.stringify(v)); } catch {} },
};
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mil = (n) => Number(n || 0).toLocaleString('pt-BR');
const mb = (b) => (!b ? '' : b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB');
const dia = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const nomeAlvo = (a) => [a.codigo, a.nome].filter(Boolean).join(' · ');

export function criarAcervo({ esc, api, apiBinario, toque }) {
  let raiz = null;
  let filtros = { q: '', alvo: '', publica: '', ...lembrar.ler('filtros', {}) };
  const chave = () => 'acervo:' + JSON.stringify(filtros);
  let dados = lerCopia(chave());
  let alvos = lerCopia('acervo:alvos') || { projetos: [], objetos: [], colecoes: [] };
  let estado = dados ? 'ok' : 'carregando';
  let erro = '';
  let selecionadas = new Set();
  let enviando = []; // { id, nome, url } enquanto sobem
  let aberta = null; // id da imagem na Gaveta
  let tBusca = null;

  // ---- peças
  const etq = (t, tipo = '') => `<span class="acv-etq${tipo ? ' ' + tipo : ''}">${esc(t)}</span>`;
  const seletor = (nome, opcoes, valor) => `<div class="pas-seletor" role="group" data-seletor="${nome}">${opcoes.map(([v, r]) =>
    `<button type="button" data-valor="${esc(v)}" aria-pressed="${v === valor}"${v === valor ? ' class="ativo"' : ''}>${esc(r)}</button>`).join('')}</div>`;

  function opcoesAlvo(valor, { vazio = 'Todos os projetos, objetos e coleções', comSem = true } = {}) {
    const op = (v, r) => `<option value="${esc(v)}"${v === valor ? ' selected' : ''}>${esc(r)}</option>`;
    const grupo = (rot, lista, rotulo) => (lista.length
      ? `<optgroup label="${rot}">${lista.map((x) => op(x.id, `${rotulo(x)}${x.imagens ? ` (${x.imagens})` : ''}`)).join('')}</optgroup>` : '');
    return (vazio !== null ? op('', vazio) : '') + (comSem ? op('sem', 'Sem projeto, objeto ou coleção') : '')
      + grupo('Projetos', alvos.projetos, (x) => `${x.codigo} · ${x.nome_publico || x.nome}`)
      + grupo('Objetos', alvos.objetos, (x) => x.nome_publico || x.nome)
      + grupo('Coleções', alvos.colecoes, (x) => x.nome);
  }

  function miniatura(id, variante = 's') {
    return imagemGuardada(`arq:${id}-${variante}`, () => apiBinario(`/api/v1/arquivos/${id}/conteudo?variante=${variante}`));
  }
  // as miniaturas chegam depois do desenho (cada uma pelo id, guardada no navegador)
  function encherImagens(el) {
    for (const img of el.querySelectorAll('img[data-arq]')) {
      const { arq, variante } = img.dataset;
      miniatura(arq, variante || 's').then((u) => { if (u) { img.src = u; img.closest('.acv-moldura')?.classList.add('pronta'); } });
    }
  }

  function cartao(i) {
    const marcada = selecionadas.has(i.id);
    const etqs = [
      i.publica ? etq('pública', 'ok') : etq('restrita'),
      ...i.alvos.map((a) => etq(a.codigo || a.nome, 'alvo')),
      !i.alvos.length && etq('sem projeto', 'tracejada'),
      i.direitos === 'aguarda_autorizacao' && etq('aguarda autorização', 'atencao'),
    ].filter(Boolean).join('');
    return `<article class="acv-item${marcada ? ' marcada' : ''}${i.arquivado_em ? ' arquivada' : ''}" data-id="${i.id}" tabindex="0"
        aria-label="${esc(i.texto_alternativo || i.nome_original)}">
      <div class="acv-moldura"><img data-arq="${i.id}" alt="${esc(i.texto_alternativo || '')}" loading="lazy">${SVG.imagem}</div>
      <div class="acv-cmd">
        <button type="button" class="acv-caixa${marcada ? ' on' : ''}" data-acao="marcar" aria-pressed="${marcada}" title="${marcada ? 'Desmarcar' : 'Marcar'}">${SVG.marca}</button>
        <button type="button" class="acv-caixa" data-acao="abrir" title="Editar">${SVG.lapis}</button>
      </div>
      <div class="acv-info">
        <b title="${esc(i.nome_original)}">${esc(i.texto_alternativo || i.nome_original)}</b>
        <div class="acv-etqs">${etqs}</div>
      </div>
    </article>`;
  }

  function cartaoEnviando(e) {
    return `<article class="acv-item enviando"><div class="acv-moldura pronta"><img src="${e.url}" alt=""></div>
      <div class="acv-info"><b>${esc(e.nome)}</b><div class="acv-etqs">${etq(e.erro ? 'não enviada' : 'enviando…', e.erro ? 'problema' : 'atencao')}</div></div></article>`;
  }

  function barraSelecao() {
    if (!selecionadas.size) return '';
    return `<div class="acv-barra" role="region" aria-label="Imagens marcadas">
      <span class="acv-barra-conta"><b>${selecionadas.size}</b> marcada${selecionadas.size === 1 ? '' : 's'}</span>
      <label class="acv-barra-alvo"><span class="sr">Acrescentar a</span>
        <select data-lote="alvo">${opcoesAlvo('', { vazio: 'Acrescentar a…', comSem: false })}</select></label>
      <button type="button" class="u-botao" data-lote="publicar" title="Marca os direitos como livres e liga a pública">Direitos livres e pública</button>
      <button type="button" class="u-botao" data-lote="restringir">Restringir</button>
      <button type="button" class="acv-texto" data-lote="limpar">Desmarcar todas</button>
    </div>`;
  }

  function notas() {
    return `<section class="pas-notas acv-notas">
      <div><h3 class="u-rotulo">Pública e restrita</h3>
        <p>Toda imagem nasce <b>restrita</b>: fica só com o projeto. <b>Pública</b> = disponível para o site e afins: o editor do site oferece as públicas do projeto ligado à página, e o marketing só enxerga as públicas. Só pode ser pública com direitos livres; mudar os direitos desliga a pública.</p></div>
      <div><h3 class="u-rotulo">Onde a imagem está</h3>
        <p>Uma imagem pode estar em vários projetos, objetos e coleções ao mesmo tempo. Tirar de um projeto não apaga a imagem; arquivar a tira do acervo inteiro (nada se apaga).</p>
        <p>As descrições (texto alternativo, legenda, crédito) são da imagem: valem no site, no marketing e aqui.</p></div>
      <div><h3 class="u-rotulo">Envio</h3>
        <p>Sobem três versões convertidas no navegador (2400, 1200 e 960 px pelo lado maior, WebP). O original fica no Drive. A mesma imagem não entra duas vezes. Com um projeto escolhido no filtro, as imagens enviadas entram nele.</p></div>
    </section>`;
  }

  function desenhar() {
    if (!raiz) return;
    const y = window.scrollY;
    const lado = dados ? `${mil(dados.total)} imagem${dados.total === 1 ? '' : 's'} · ${mil(dados.publicas)} pública${dados.publicas === 1 ? '' : 's'}` : '';
    const cab = `<div class="cab"><div><nav class="u-trilha" aria-label="Você está em"><a href="#/biblioteca">Biblioteca</a><span class="sep">/</span><span aria-current="page">Acervo de imagens</span></nav>
      <h1 class="u-titulo">Acervo de imagens</h1></div>
      <div class="acv-cab-lado"><span class="u-apoio">${lado}</span><button type="button" class="u-botao forte" data-acao="enviar">Enviar imagens</button></div></div>`;
    const filtrosHtml = `<div class="pas-filtros acv-filtros">
      <label class="acv-busca"><span class="sr">Buscar</span><input type="search" data-filtro="q" value="${esc(filtros.q)}" placeholder="Buscar por descrição, legenda, arquivo ou projeto"></label>
      <label class="acv-alvo"><span class="sr">Projeto, objeto ou coleção</span><select data-filtro="alvo">${opcoesAlvo(filtros.alvo)}</select></label>
      ${seletor('publica', [['', 'Todas'], ['1', 'Públicas'], ['0', 'Restritas']], filtros.publica)}
      ${filtros.q || filtros.alvo || filtros.publica ? '<button type="button" class="acv-texto" data-acao="limpar">limpar</button>' : ''}
    </div>`;
    let corpo;
    if (!dados) {
      corpo = estado === 'carregando' ? '<p class="u-apoio">Carregando…</p>' : `<div class="pas-vazio"><p>${esc(erro)}</p></div>`;
    } else if (!dados.itens.length && !enviando.length) {
      corpo = `<div class="pas-vazio acv-vazio"><p>${filtros.q || filtros.alvo || filtros.publica ? 'Nenhuma imagem com estes filtros.' : 'O acervo ainda está vazio.'}</p>
        <p>Envie imagens pelo botão ou solte os arquivos nesta página.</p></div>`;
    } else {
      corpo = `<div class="acv-grade">${enviando.map(cartaoEnviando).join('')}${dados.itens.map(cartao).join('')}</div>
        ${dados.proximo != null ? `<div class="acv-mais"><button type="button" class="u-botao" data-acao="mais">Carregar mais (${mil(dados.total - dados.itens.length)})</button></div>` : ''}`;
    }
    raiz.innerHTML = cab + filtrosHtml + corpo + barraSelecao() + notas() + gaveta()
      + '<input type="file" accept="image/*" multiple data-arquivo hidden>';
    encherImagens(raiz);
    window.scrollTo(0, y);
    const busca = raiz.querySelector('[data-filtro="q"]');
    if (desenhar.focoBusca && busca) { busca.focus(); busca.setSelectionRange(busca.value.length, busca.value.length); desenhar.focoBusca = false; }
  }

  // ---- Gaveta
  function gaveta() {
    const i = aberta && dados?.itens.find((x) => x.id === aberta);
    if (!i) return '';
    const livre = i.direitos === 'livre';
    const campo = (nome, rotulo, valor, tipo = 'text', extra = '') => `<label class="u-campo"><span>${rotulo}</span>${tipo === 'area'
      ? `<textarea data-campo="${nome}" rows="3" ${extra}>${esc(valor || '')}</textarea>`
      : `<input type="${tipo}" data-campo="${nome}" value="${esc(valor || '')}" ${extra}>`}</label>`;
    return `<div class="acv-veu" data-acao="fechar"></div>
    <aside class="acv-gaveta" role="dialog" aria-modal="true" aria-label="Imagem ${esc(i.nome_original)}">
      <div class="acv-gaveta-cab"><b title="${esc(i.nome_original)}">${esc(i.nome_original)}</b>
        <button type="button" class="acv-caixa" data-acao="fechar" title="Fechar">${SVG.fechar}</button></div>
      <div class="acv-gaveta-corpo">
        <div class="acv-previa"><img data-arq="${i.id}" data-variante="m" alt="${esc(i.texto_alternativo || '')}"></div>
        <p class="u-apoio acv-ficha">${[i.largura && `${i.largura} × ${i.altura} px`, mb(i.tamanho), `enviada em ${dia(i.criado_em)}`, i.criado_por === 'site' ? 'pelo editor do site' : '']
          .filter(Boolean).join(' · ')}</p>

        <section class="acv-bloco"><h3 class="u-subtitulo">Onde está</h3>
          <div class="acv-alvos">${i.alvos.map((a) => `<span class="acv-alvo-etq"><span class="acv-tipo">${TIPO[a.tipo]}</span>${esc(nomeAlvo(a))}
            <button type="button" class="acv-caixa mini" data-tirar="${a.galeria_id}" data-versao="${a.galeria_versao}" title="Tirar deste ${TIPO[a.tipo].toLowerCase()}">${SVG.fechar}</button></span>`).join('')
            || '<span class="u-apoio">Ainda em nenhum projeto, objeto ou coleção.</span>'}</div>
          <div class="acv-acrescentar">
            <input type="search" data-acrescentar placeholder="+ Acrescentar a projeto, objeto ou coleção" autocomplete="off">
            <div class="acv-sugestoes" data-sugestoes></div>
          </div>
        </section>

        <section class="acv-bloco"><h3 class="u-subtitulo">Site e direitos</h3>
          <div class="acv-duas">
            <label class="u-campo"><span>Direitos</span><select data-campo="direitos">${DIREITOS.map(([v, r]) =>
              `<option value="${v}"${(i.direitos || '') === v ? ' selected' : ''}>${r}</option>`).join('')}</select></label>
            <label class="u-campo acv-chave"><span>Pública</span>
              <span class="acv-switch"><input type="checkbox" data-campo="publica"${i.publica ? ' checked' : ''}${livre || i.publica ? '' : ' disabled'}><i></i>
                <em>${i.publica ? 'disponível para o site e afins' : 'restrita ao projeto'}</em></span>
              ${livre ? '' : '<small>Só com direitos livres.</small>'}</label>
          </div>
        </section>

        <section class="acv-bloco"><h3 class="u-subtitulo">Descrição</h3>
          ${campo('texto_alternativo', 'Texto alternativo', i.texto_alternativo, 'area', 'maxlength="300" placeholder="O que se vê, que parte do projeto é…"')}
          ${campo('legenda', 'Legenda', i.legenda, 'text', 'maxlength="300"')}
          <div class="acv-duas">
            ${campo('credito', 'Crédito', i.credito, 'text', 'maxlength="120" placeholder="Foto: …"')}
            ${campo('data_captura', 'Data da foto', i.data_captura, 'date')}
          </div>
          ${campo('origem_drive', 'Caminho no Drive', i.origem_drive, 'text', 'maxlength="400" placeholder="1. PROJETOS/OA-…/…"')}
        </section>
      </div>
      <div class="acv-gaveta-pe"><span class="u-apoio" data-gravado></span>
        <button type="button" class="u-botao perigo" data-acao="arquivar">${i.arquivado_em ? 'Restaurar imagem' : 'Arquivar imagem'}</button></div>
    </aside>`;
  }

  function sugestoes(texto) {
    const i = dados.itens.find((x) => x.id === aberta);
    const ja = new Set(i.alvos.map((a) => a.alvo_id));
    const t = semAcento(texto.trim());
    const todos = [
      ...alvos.projetos.map((x) => ({ id: x.id, tipo: 'projeto', rot: `${x.codigo} · ${x.nome_publico || x.nome}`, busca: [x.codigo, x.nome, x.nome_publico].join(' ') })),
      ...alvos.objetos.map((x) => ({ id: x.id, tipo: 'objeto', rot: x.nome_publico || x.nome, busca: [x.nome, x.nome_publico].join(' ') })),
      ...alvos.colecoes.map((x) => ({ id: x.id, tipo: 'colecao', rot: x.nome, busca: x.nome })),
    ].filter((x) => !ja.has(x.id) && (!t || semAcento(x.busca).includes(t))).slice(0, 8);
    const criar = texto.trim() && !todos.some((x) => semAcento(x.rot) === t)
      ? `<button type="button" data-criar="objetos" data-nome="${esc(texto.trim())}">Novo objeto «${esc(texto.trim())}»</button>
         <button type="button" data-criar="colecoes" data-nome="${esc(texto.trim())}">Nova coleção «${esc(texto.trim())}»</button>` : '';
    return todos.map((x) => `<button type="button" data-ligar="${x.id}"><span class="acv-tipo">${TIPO[x.tipo]}</span>${esc(x.rot)}</button>`).join('') + criar;
  }

  // ---- leituras
  function consulta(de = 0) {
    const p = new URLSearchParams({ limite: POR_PAGINA, de });
    if (filtros.q) p.set('q', filtros.q);
    if (filtros.alvo === 'sem') p.set('sem_alvo', '1'); else if (filtros.alvo) p.set('alvo', filtros.alvo);
    if (filtros.publica) p.set('publica', filtros.publica);
    return '/api/v1/acervo?' + p;
  }

  async function buscar() {
    const k = chave();
    let r;
    try { r = await api(consulta()); } catch (e) { r = { status: 0, error: e.message }; }
    if (k !== chave()) return; // os filtros mudaram enquanto lia
    if (r.status === 200) {
      const { status, ...d } = r;
      gravarCopia(k, d);
      if (!igual(d, dados)) { dados = d; estado = 'ok'; desenhar(); }
      return;
    }
    if (dados) return;
    estado = 'erro';
    erro = `Não foi possível ler o acervo (${r.status ? 'resposta ' + r.status : 'sem resposta'}${r.erro || r.error ? ': ' + (r.erro || r.error) : ''}).`;
    desenhar();
  }

  async function buscarAlvos() {
    const r = await api('/api/v1/acervo/alvos').catch(() => null);
    if (r?.status !== 200) return;
    const { status, ...d } = r;
    if (!igual(d, alvos)) { alvos = d; gravarCopia('acervo:alvos', d); desenhar(); }
  }

  async function mais() {
    const r = await api(consulta(dados.itens.length));
    if (r.status !== 200) { toque('Não foi possível carregar mais.'); return; }
    dados = { ...r, itens: [...dados.itens, ...r.itens] };
    delete dados.status;
    desenhar();
  }

  function mudarFiltros(novos, { foco = false } = {}) {
    filtros = { ...filtros, ...novos };
    lembrar.gravar('filtros', filtros);
    selecionadas = new Set();
    dados = lerCopia(chave());
    estado = dados ? 'ok' : 'carregando';
    desenhar.focoBusca = foco;
    desenhar();
    buscar();
  }

  // ---- gravações
  function trocarItem(reg) {
    const k = dados.itens.findIndex((x) => x.id === reg.id);
    if (k >= 0) dados.itens[k] = { ...dados.itens[k], ...reg };
  }

  async function alterar(id, campos) {
    const i = dados.itens.find((x) => x.id === id);
    const r = await api('/api/v1/arquivos/' + id, { method: 'PATCH', body: JSON.stringify({ versao: i.versao, ...campos }) });
    if (r.status === 409 && r.erro === 'conflito') { toque('Esta imagem mudou em outro lugar. Recarregando.'); await buscar(); return false; }
    if (r.status >= 400) { toque(r.erro || 'Não foi possível salvar.'); return false; }
    trocarItem(r.registro);
    return true;
  }

  async function ligar(arqId, alvoId) {
    const r = await api('/api/v1/galeria', { method: 'POST', body: JSON.stringify({ arquivo_id: arqId, alvo_id: alvoId }) });
    return r.status < 400 || r.status === 409; // 409: já estava ligada
  }

  async function recarregarTudo() {
    await Promise.all([buscar(), buscarAlvos()]);
  }

  async function lote(acao, valor) {
    const ids = [...selecionadas];
    let falhas = 0;
    for (const id of ids) {
      let ok = true;
      if (acao === 'alvo') ok = await ligar(id, valor);
      if (acao === 'publicar') ok = await alterar(id, { direitos: 'livre', publica: 1 });
      if (acao === 'restringir') ok = await alterar(id, { publica: 0 });
      if (!ok) falhas++;
    }
    toque(falhas ? `${ids.length - falhas} de ${ids.length} atualizadas.` : `${ids.length} imagem${ids.length === 1 ? '' : 's'} atualizada${ids.length === 1 ? '' : 's'}.`);
    selecionadas = new Set();
    await recarregarTudo();
    desenhar();
  }

  async function enviar(arquivos) {
    const lista = [...arquivos].filter((f) => f.type.startsWith('image/'));
    if (!lista.length) { toque('Escolha arquivos de imagem.'); return; }
    const alvo = filtros.alvo && filtros.alvo !== 'sem' ? filtros.alvo : null;
    const novos = lista.map((f) => ({ id: Math.random().toString(36).slice(2), nome: f.name, url: URL.createObjectURL(f), f }));
    enviando.push(...novos);
    desenhar();
    let ok = 0, repetidas = 0;
    for (const e of novos) {
      try {
        const x = await prepararImagem(e.f);
        let r = await api('/api/v1/arquivos', { method: 'POST', body: JSON.stringify({
          nome_original: e.f.name, tipo_mime: x.tipo, categoria: 'imagem', sha256: x.sha256, largura: x.largura, altura: x.altura }) });
        let arqId;
        if (r.status === 409 && r.registro) { arqId = r.registro.id; repetidas++; }
        else if (r.status >= 400) throw new Error(r.erro || r.status);
        else {
          arqId = r.registro.id;
          for (const v of ['g', 'm', 's']) {
            const p = await apiBinario(`/api/v1/arquivos/${arqId}/conteudo?variante=${v}`, { method: 'PUT', body: x[v].blob, headers: { 'Content-Type': x[v].blob.type } });
            if (!p.ok) throw new Error('envio da imagem: ' + p.status);
          }
        }
        if (alvo) await ligar(arqId, alvo);
        enviando = enviando.filter((y) => y !== e);
        URL.revokeObjectURL(e.url);
        ok++;
      } catch (err) {
        e.erro = err.message;
        toque(`${e.nome}: ${err.message}`);
      }
      desenhar();
    }
    toque(`${ok} imagem${ok === 1 ? '' : 's'} no acervo${repetidas ? ` (${repetidas} já estava${repetidas === 1 ? '' : 'm'})` : ''}.`);
    setTimeout(() => { enviando = enviando.filter((y) => !y.erro); desenhar(); }, 4000);
    await recarregarTudo();
  }

  function abrir(id) {
    aberta = id;
    desenhar();
    document.body.classList.add('acv-com-gaveta');
    raiz.querySelector('.acv-gaveta [data-acao="fechar"]')?.focus();
  }
  function fechar() {
    const id = aberta;
    aberta = null;
    document.body.classList.remove('acv-com-gaveta');
    desenhar();
    raiz.querySelector(`.acv-item[data-id="${id}"]`)?.focus({ preventScroll: true });
  }

  function ligarEventos() {
    raiz.addEventListener('click', async (ev) => {
      const sel = ev.target.closest('[data-seletor] button');
      if (sel) { mudarFiltros({ publica: sel.dataset.valor }); return; }
      const lt = ev.target.closest('[data-lote]');
      if (lt && lt.tagName === 'BUTTON') {
        if (lt.dataset.lote === 'limpar') { selecionadas = new Set(); desenhar(); return; }
        return lote(lt.dataset.lote);
      }
      const tirar = ev.target.closest('[data-tirar]');
      if (tirar) {
        const r = await api(`/api/v1/galeria/${tirar.dataset.tirar}/arquivar`, { method: 'POST', body: JSON.stringify({ versao: Number(tirar.dataset.versao) }) });
        if (r.status >= 400) toque(r.erro || 'Não foi possível tirar.');
        await recarregarTudo();
        return;
      }
      const lg = ev.target.closest('[data-ligar]');
      if (lg) { if (!(await ligar(aberta, lg.dataset.ligar))) toque('Não foi possível acrescentar.'); await recarregarTudo(); raiz.querySelector('[data-acrescentar]')?.focus(); return; }
      const cr = ev.target.closest('[data-criar]');
      if (cr) {
        const r = await api('/api/v1/' + cr.dataset.criar, { method: 'POST', body: JSON.stringify({ nome: cr.dataset.nome }) });
        if (r.status >= 400) { toque(r.erro || 'Não foi possível criar.'); return; }
        await ligar(aberta, r.registro.id);
        await recarregarTudo();
        return;
      }
      const acao = ev.target.closest('[data-acao]')?.dataset.acao;
      if (acao === 'enviar') { raiz.querySelector('[data-arquivo]').click(); return; }
      if (acao === 'limpar') { mudarFiltros({ q: '', alvo: '', publica: '' }); return; }
      if (acao === 'mais') { mais(); return; }
      if (acao === 'fechar') { fechar(); return; }
      if (acao === 'arquivar') {
        const i = dados.itens.find((x) => x.id === aberta);
        const arq = !i.arquivado_em;
        if (arq && !confirm('Arquivar esta imagem? Ela sai do acervo, do site e do marketing (nada se apaga; dá para restaurar).')) return;
        const r = await api(`/api/v1/arquivos/${i.id}/${arq ? 'arquivar' : 'restaurar'}`, { method: 'POST', body: JSON.stringify({ versao: i.versao }) });
        if (r.status >= 400) { toque(r.erro || 'Não foi possível.'); return; }
        toque(arq ? 'Imagem arquivada.' : 'Imagem restaurada.');
        aberta = null; document.body.classList.remove('acv-com-gaveta');
        await recarregarTudo();
        return;
      }
      const item = ev.target.closest('.acv-item:not(.enviando)');
      if (item) {
        if (acao === 'marcar' || ev.shiftKey || ev.metaKey || ev.ctrlKey) {
          selecionadas.has(item.dataset.id) ? selecionadas.delete(item.dataset.id) : selecionadas.add(item.dataset.id);
          desenhar();
          raiz.querySelector(`.acv-item[data-id="${item.dataset.id}"] [data-acao="marcar"]`)?.focus({ preventScroll: true });
          return;
        }
        if (window.getSelection()?.toString()) return;
        abrir(item.dataset.id);
      }
    });

    raiz.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && aberta) { fechar(); return; }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList?.contains('acv-item')) { ev.preventDefault(); abrir(ev.target.dataset.id); }
    });

    raiz.addEventListener('input', (ev) => {
      if (ev.target.matches('[data-filtro="q"]')) {
        clearTimeout(tBusca);
        const v = ev.target.value;
        tBusca = setTimeout(() => mudarFiltros({ q: v.trim() }, { foco: true }), 300);
      }
      if (ev.target.matches('[data-acrescentar]')) {
        raiz.querySelector('[data-sugestoes]').innerHTML = sugestoes(ev.target.value);
      }
    });
    raiz.addEventListener('focusin', (ev) => {
      if (ev.target.matches('[data-acrescentar]')) raiz.querySelector('[data-sugestoes]').innerHTML = sugestoes(ev.target.value);
    });

    raiz.addEventListener('change', async (ev) => {
      const t = ev.target;
      if (t.matches('[data-arquivo]') && t.files.length) { enviar(t.files); t.value = ''; return; }
      if (t.matches('[data-filtro="alvo"]')) { mudarFiltros({ alvo: t.value }); return; }
      if (t.matches('[data-lote="alvo"]') && t.value) { lote('alvo', t.value); return; }
      const campo = t.dataset.campo;
      if (campo && aberta) {
        const valor = t.type === 'checkbox' ? (t.checked ? 1 : 0) : t.value;
        const y = raiz.querySelector('.acv-gaveta-corpo')?.scrollTop || 0;
        if (await alterar(aberta, { [campo]: valor })) {
          if (['direitos', 'publica'].includes(campo)) { desenhar(); buscarAlvos(); }
          const g = raiz.querySelector('[data-gravado]');
          if (g) g.textContent = 'salvo';
          const corpo = raiz.querySelector('.acv-gaveta-corpo');
          if (corpo) corpo.scrollTop = y;
        } else desenhar();
      }
    });

    // soltar arquivos na página
    raiz.addEventListener('dragover', (ev) => { if ([...(ev.dataTransfer?.types || [])].includes('Files')) { ev.preventDefault(); raiz.classList.add('acv-soltando'); } });
    raiz.addEventListener('dragleave', (ev) => { if (ev.target === raiz || !raiz.contains(ev.relatedTarget)) raiz.classList.remove('acv-soltando'); });
    raiz.addEventListener('drop', (ev) => {
      if (!ev.dataTransfer?.files?.length) return;
      ev.preventDefault();
      raiz.classList.remove('acv-soltando');
      enviar(ev.dataTransfer.files);
    });
  }

  function ligarPagina(el) {
    raiz = el;
    aberta = null;
    selecionadas = new Set();
    document.body.classList.remove('acv-com-gaveta');
    desenhar();
    ligarEventos();
    buscar();
    buscarAlvos();
  }

  return { ligar: ligarPagina };
}
