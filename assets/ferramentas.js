// Página Ferramentas do hub (#/ferramentas): cartões empilhados por ramo, no desenho dos cartões do PGT (Cid, 19/11).
//   - uma faixa de título por ramo, recolhível (seta › em SVG que gira; aberto/fechado lembrado neste computador);
//   - cor do ramo da paleta da Marca: bloco com fundo no tom claro, faixa de título no tom forte, cartões brancos; SEM barra à esquerda;
//   - a linha inteira leva à ferramenta, exceto o lápis e o texto em edição;
//   - lápis na descrição: edita no lugar, Enter grava, Esc desfaz. Gravada no servidor do hub
//     (tabela ferramentas_textos, 0017); sem texto gravado, vale a descrição do ferramentas.json.

import { lerCopia, gravarCopia } from './memoria.js';

const APPS = { marketing: 'marketing', vendas: 'vendas', projetos: 'Projetos', radar: 'Radar', universo: 'Universo' };
const appDe = (url) => { const h = (url || '').match(/^https?:\/\/([^./]+)\./); return h ? (APPS[h[1]] || h[1]) : '—'; };
const LAPIS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.6 13.4 5.2 6 12.6 3 13 3.4 10Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>'; // o mesmo do PGT
const COPIA = 'ferramentas:textos';
// seta do grupo em SVG: o caractere ▸ é um triângulo pequeno por definição e a Inter não o tem (saía minúsculo)
const SETA = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FECHADOS = 'universo:ferramentas:fechados';
const ESCURAS = new Set(['ardosia', 'terra', 'grafite']); // como no PGT: cor escura entra clareada (45%)

// descrições editadas por cima do mapa (também usadas no Início)
export function aplicarTextos(mapa, textos) {
  const por = new Map((textos || []).map((t) => [t.chave, t]));
  for (const f of mapa.itens) {
    if (f.descricao_mapa === undefined) f.descricao_mapa = f.descricao;
    const t = por.get(f.id);
    f.descricao = t ? t.descricao : f.descricao_mapa;
  }
}
export const textosGuardados = () => lerCopia(COPIA) || [];

// Ferramentas (padrão): um grupo por ramo, com os itens da seção Ferramentas do mapa.
const FERRAMENTAS = {
  titulo: 'Ferramentas', colunas: ['Ferramenta', 'O que faz', 'Onde', 'Estado'], fechados: FECHADOS, unidade: ['ferramenta', 'ferramentas'],
  grupos: (mapa) => (mapa.ramos || []).map((r) => ({ id: r.id, nome: r.nome, cor: r.cor, itens: mapa.itens.filter((f) => f.secao === 'ferramentas' && f.ramo === r.id) })),
};

// Canais (O Estúdio › Canais): sites do mapa e redes do odisse.json, no mesmo desenho da lista de Ferramentas.
const NOMES_REDES = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', substack: 'Substack', pinterest: 'Pinterest', linkedin: 'LinkedIn', behance: 'Behance' };
const DESC_REDES = { instagram: 'Perfil do estúdio: projetos, objetos e bastidores', tiktok: 'Vídeos curtos do estúdio', youtube: 'Vídeos e podcast',
  substack: 'Elaia: ensaios e podcast', pinterest: 'Pastas de referência e projetos' };
const semProtocolo = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
export function configCanais(lerOdisse) {
  return {
    titulo: 'Canais', classe: 'lista-canais', colunas: ['Canal', 'O que é', 'Endereço', 'Estado'], fechados: 'universo:canais:fechados', unidade: ['canal', 'canais'],
    grupos: (mapa, textos) => {
      const desc = (id, padrao) => (textos.find((t) => t.chave === id)?.descricao) || padrao;
      const redes = Object.entries(lerOdisse()?.redes || {}).map(([k, url]) => ({
        id: 'rede-' + k, nome: NOMES_REDES[k] || k, url, status: url ? 'no-ar' : 'em-breve', descricao: desc('rede-' + k, DESC_REDES[k] || ''),
      }));
      return [
        { id: 'sites', nome: 'Sites', cor: 'ardosia', itens: mapa.itens.filter((f) => f.secao === 'canais') },
        { id: 'redes', nome: 'Redes e publicações', cor: 'ambar', itens: redes },
      ];
    },
    onde: (f) => semProtocolo(f.url).replace(/\/admin$/, ''),
  };
}

export function criarFerramentas({ esc, api, toque, lerMapa, config = FERRAMENTAS }) {
  let textos = textosGuardados();
  const atuais = new Map(); // id → item do que está desenhado (para o ✎)
  const fechados = () => { try { return new Set(JSON.parse(localStorage.getItem(config.fechados) || '[]')); } catch { return new Set(); } };
  const guardarFechados = (s) => { try { localStorage.setItem(config.fechados, JSON.stringify([...s])); } catch {} };

  // cartão de uma ferramenta: o mesmo desenho dos cartões do PGT (Projetos › Plano Geral de Trabalho)
  function cartao(f) {
    const breve = f.status === 'em-breve' || !f.url;
    const nome = breve ? `<strong>${esc(f.nome)}</strong>` : `<a class="ferr__nome" href="${esc(f.url)}"><strong>${esc(f.nome)}</strong></a>`;
    return `<div class="ferr${breve ? ' is-breve' : ''}" data-id="${esc(f.id)}"${breve ? '' : ` data-url="${esc(f.url)}"`}>
      <div class="ferr__ctl"><button type="button" class="ctl__btn" data-editar title="Editar descrição"
        aria-label="Editar a descrição de ${esc(f.nome)}">${LAPIS}</button></div>
      <div class="ferr__titulo">${nome}${(f.extra || []).map((x) => `<a class="etq etq--link" href="${esc(x.url)}">${esc(x.nome)}</a>`).join('')}</div>
      <div class="ferr__oque"><span class="texto">${esc(f.descricao || '')}</span></div>
      <div class="ferr__onde">${breve ? '<span class="vazio">—</span>' : `<span class="etq">${esc(config.onde ? config.onde(f) : appDe(f.url))}</span>`}</div>
      <div class="ferr__estado">${breve ? '<span class="etq etq--breve">em breve</span>' : '<span class="etq etq--ok">no ar</span>'}</div>
    </div>`;
  }

  function desenhar(raiz) {
    const mapa = lerMapa();
    aplicarTextos(mapa, textos);
    const fech = fechados();
    atuais.clear();
    const grupos = config.grupos(mapa, textos).map((r) => {
      const doRamo = r.itens;
      if (!doRamo.length) return '';
      doRamo.forEach((f) => atuais.set(f.id, f));
      const aberto = !fech.has(r.id);
      const noAr = doRamo.filter((f) => f.url && f.status !== 'em-breve').length;
      const [um, varios] = config.unidade;
      const conta = noAr === doRamo.length ? `${doRamo.length} ${doRamo.length === 1 ? um : varios}`
        : noAr === 0 ? `${doRamo.length} em breve` : `${noAr} no ar · ${doRamo.length - noAr} em breve`;
      const cor = `var(--odisse-${esc(r.cor || 'nevoa')})`;
      const forca = ESCURAS.has(r.cor) ? '45%' : '100%';
      return `<section class="ramo${aberto ? ' aberto' : ''}" data-ramo="${esc(r.id)}" style="--g:color-mix(in srgb, ${cor} ${forca}, white)">
        <button type="button" class="ramo__faixa" aria-expanded="${aberto}"><span class="seta" aria-hidden="true">${SETA}</span>${esc(r.nome)}
          <span>${conta}</span></button>
        <div class="ramo__pilha">${doRamo.map(cartao).join('')}</div>
      </section>`;
    }).join('');
    raiz.innerHTML = `<div class="cab"><h1 class="u-titulo">${esc(config.titulo)}</h1></div>
      <div class="lista-ferramentas ${esc(config.classe || '')}">
        <div class="ferr-cab"><span></span>${config.colunas.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
        ${grupos}
      </div>`;
  }

  function editar(card) {
    const span = card.querySelector('.texto');
    if (span.isContentEditable) return;
    const f = atuais.get(card.dataset.id);
    card.querySelector('[data-editar]').classList.add('is-on');
    const antes = span.textContent;
    span.contentEditable = 'plaintext-only';
    span.classList.add('is-editando');
    span.focus();
    const sel = getSelection(); sel.selectAllChildren(span); sel.collapseToEnd();
    let feito = false;
    const fim = async (gravar) => {
      if (feito) return; feito = true;
      span.contentEditable = 'false'; span.classList.remove('is-editando');
      card.querySelector('[data-editar]').classList.remove('is-on');
      const novo = span.textContent.replace(/\s+/g, ' ').trim();
      if (!gravar || novo === antes) { span.textContent = antes; return; }
      if (!novo) { span.textContent = antes; toque('A descrição não pode ficar vazia'); return; }
      if (novo.length > 120) { span.textContent = antes; toque('No máximo 120 caracteres'); return; }
      span.textContent = novo;
      const t = textos.find((x) => x.chave === f.id);
      const r = t
        ? await api(`/api/v1/ferramentas-textos/${t.id}`, { method: 'PATCH', body: JSON.stringify({ versao: t.versao, descricao: novo }) })
        : await api('/api/v1/ferramentas-textos', { method: 'POST', body: JSON.stringify({ chave: f.id, descricao: novo }) });
      if (r.status >= 400) {
        span.textContent = antes;
        toque(r.status === 409 ? 'Alguém mudou esta descrição: recarregue a página' : 'Não foi possível salvar: ' + (r.erro || r.status));
        return;
      }
      textos = [...textos.filter((x) => x.chave !== f.id), r.registro];
      gravarCopia(COPIA, textos);
      aplicarTextos(lerMapa(), textos);
      if (!lerMapa().itens.some((x) => x.id === f.id)) f.descricao = novo;
      toque('Salvo');
    };
    span.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); fim(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); fim(false); }
    });
    span.addEventListener('blur', () => fim(true), { once: true });
  }

  function ligar(raiz) {
    desenhar(raiz);
    raiz.addEventListener('click', (ev) => {
      const alt = ev.target.closest('.ramo__faixa');
      if (alt) {
        const sec = alt.closest('.ramo');
        const aberto = sec.classList.toggle('aberto');
        alt.setAttribute('aria-expanded', String(aberto));
        const s = fechados(); aberto ? s.delete(sec.dataset.ramo) : s.add(sec.dataset.ramo); guardarFechados(s);
        return;
      }
      const lapis = ev.target.closest('[data-editar]');
      if (lapis) { ev.preventDefault(); editar(lapis.closest('.ferr')); return; }
      if (ev.target.closest('.is-editando, a')) return; // o link do nome segue sozinho (e com Ctrl/⌘ abre em outra aba)
      const card = ev.target.closest('.ferr[data-url]');
      if (!card || getSelection().toString()) return;
      if (ev.ctrlKey || ev.metaKey) window.open(card.dataset.url, '_blank'); else location.href = card.dataset.url;
    });
    // confere por baixo: só redesenha se o servidor tiver textos diferentes da cópia
    api('/api/v1/ferramentas-textos?limite=200').then((r) => {
      if (r.status !== 200 || !Array.isArray(r.itens)) return;
      if (JSON.stringify(r.itens) === JSON.stringify(textos)) return;
      textos = r.itens; gravarCopia(COPIA, textos);
      if (raiz.isConnected && !raiz.querySelector('.is-editando')) desenhar(raiz);
    }).catch(() => {});
  }

  return { ligar };
}
