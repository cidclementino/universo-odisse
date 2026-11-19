// Página Ferramentas do hub (#/ferramentas): lista compacta por ramo (Cid, 19/11).
//   - uma linha de grupo por ramo, recolhível (seta ▸ que gira; aberto/fechado lembrado neste computador);
//   - cor do ramo da paleta da Marca: a linha do grupo no tom forte, as ferramentas no tom leve;
//   - a linha inteira leva à ferramenta, exceto o lápis e o texto em edição;
//   - lápis na descrição: edita no lugar, Enter grava, Esc desfaz. Gravada no servidor do hub
//     (tabela ferramentas_textos, 0017); sem texto gravado, vale a descrição do ferramentas.json.

import { lerCopia, gravarCopia } from './memoria.js';

const APPS = { marketing: 'marketing', vendas: 'vendas', projetos: 'Projetos', radar: 'Radar', universo: 'Universo' };
const appDe = (url) => { const h = (url || '').match(/^https?:\/\/([^./]+)\./); return h ? (APPS[h[1]] || h[1]) : '—'; };
const LAPIS = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M11.3 1.8a1.6 1.6 0 0 1 2.3 0l.6.6a1.6 1.6 0 0 1 0 2.3L5.5 13.4l-3.3.8.8-3.3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 3.1l2.9 2.9" stroke="currentColor" stroke-width="1.4"/></svg>';
const COPIA = 'ferramentas:textos';
const FECHADOS = 'universo:ferramentas:fechados';

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

export function criarFerramentas({ esc, api, toque, lerMapa }) {
  let textos = textosGuardados();
  const fechados = () => { try { return new Set(JSON.parse(localStorage.getItem(FECHADOS) || '[]')); } catch { return new Set(); } };
  const guardarFechados = (s) => { try { localStorage.setItem(FECHADOS, JSON.stringify([...s])); } catch {} };

  function linha(f) {
    const breve = f.status === 'em-breve' || !f.url;
    const nome = breve ? esc(f.nome) : `<a href="${esc(f.url)}">${esc(f.nome)}</a>`;
    return `<tr class="ferr${breve ? ' breve' : ''}" data-id="${esc(f.id)}"${breve ? '' : ` data-url="${esc(f.url)}"`}>
      <td class="nome">${nome}</td>
      <td class="oque"><span class="texto">${esc(f.descricao)}</span><button type="button" class="editar-nome" data-editar
        title="Editar descrição" aria-label="Editar a descrição de ${esc(f.nome)}">${LAPIS}</button></td>
      <td class="onde">${breve ? '—' : esc(appDe(f.url))}</td>
      <td class="estado">${breve ? '<span class="u-etiqueta suave">em breve</span>' : '<span class="no-ar">no ar</span>'}</td>
    </tr>`;
  }

  function desenhar(raiz) {
    const mapa = lerMapa();
    aplicarTextos(mapa, textos);
    const fech = fechados();
    const itens = mapa.itens.filter((f) => f.secao === 'ferramentas');
    const grupos = (mapa.ramos || []).map((r) => {
      const doRamo = itens.filter((f) => f.ramo === r.id);
      if (!doRamo.length) return '';
      const aberto = !fech.has(r.id);
      const noAr = doRamo.filter((f) => f.url && f.status !== 'em-breve').length;
      const conta = noAr === doRamo.length ? `${doRamo.length}` : noAr === 0 ? `${doRamo.length} em breve` : `${noAr} no ar · ${doRamo.length - noAr} em breve`;
      return `<tbody class="ramo${aberto ? ' aberto' : ''}" data-ramo="${esc(r.id)}" style="--ramo:var(--odisse-${esc(r.cor || 'nevoa')})">
        <tr class="ramo-linha"><th colspan="4" scope="rowgroup">
          <button type="button" class="ramo-alternar" aria-expanded="${aberto}"><span class="seta" aria-hidden="true">▸</span>${esc(r.nome)}
          <span class="conta">${conta}</span></button></th></tr>
        ${doRamo.map(linha).join('')}</tbody>`;
    }).join('');
    raiz.innerHTML = `<div class="cab"><h1 class="u-titulo">Ferramentas</h1></div>
      <section class="bloco"><div class="lista-ferramentas"><table class="u-tabela">
        <thead><tr><th>Ferramenta</th><th>O que faz</th><th>Onde</th><th>Estado</th></tr></thead>${grupos}</table></div></section>`;
  }

  function editar(td) {
    const span = td.querySelector('.texto');
    if (span.isContentEditable) return;
    const tr = td.closest('tr');
    const f = lerMapa().itens.find((x) => x.id === tr.dataset.id);
    const antes = span.textContent;
    span.contentEditable = 'plaintext-only';
    span.classList.add('is-editando');
    span.focus();
    const sel = getSelection(); sel.selectAllChildren(span); sel.collapseToEnd();
    let feito = false;
    const fim = async (gravar) => {
      if (feito) return; feito = true;
      span.contentEditable = 'false'; span.classList.remove('is-editando');
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
      const alt = ev.target.closest('.ramo-alternar');
      if (alt) {
        const tb = alt.closest('tbody');
        const aberto = tb.classList.toggle('aberto');
        alt.setAttribute('aria-expanded', String(aberto));
        const s = fechados(); aberto ? s.delete(tb.dataset.ramo) : s.add(tb.dataset.ramo); guardarFechados(s);
        return;
      }
      const lapis = ev.target.closest('[data-editar]');
      if (lapis) { ev.preventDefault(); editar(lapis.closest('td')); return; }
      if (ev.target.closest('.is-editando, a')) return; // o link do nome segue sozinho (e com Ctrl/⌘ abre em outra aba)
      const tr = ev.target.closest('tr.ferr[data-url]');
      if (!tr || getSelection().toString()) return;
      if (ev.ctrlKey || ev.metaKey) window.open(tr.dataset.url, '_blank'); else location.href = tr.dataset.url;
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
