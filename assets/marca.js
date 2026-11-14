// Página Marca do hub (#/marca): leitura, edição em PT/EN, paleta e envio de logos.
// Tudo vem do odisse.json (marca.odisse.com.br) e é gravado pela API do hub, que faz o commit
// no repositório marca-odisse. O Estúdio é a própria marca-mãe (nucleos[].marca_mae).

const FALTA = 'tradução a preencher';
const NOMES_REDES = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', substack: 'Substack' };
const NOMES_SITES = { institucional: 'Site institucional', projetos: 'Landing pages', herma: 'Herma', objetos: 'Loja' };
const NOMES_CORES = { fundo: 'Fundo', painel: 'Painel', veu: 'Véu' };
const NOMES_PAPEIS = { fundo: 'Fundo', tinta: 'Tinta', tinta_sobre_escuro: 'Tinta sobre escuro' };
const CADEADO = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const MAIS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

export function criarMarca({ esc, api, toque, MARCA, lerOdisse, gravarOdisse }) {
  let lang = 'pt';
  let edicao = null;          // { dados, sha } enquanto edita
  let aviso = '';             // mensagem acima do conteúdo (ok/erro)
  const recentes = {};        // caminho -> blob: URL de logos recém-enviados (o Pages leva 1–2 min)
  let raiz = null;

  const semProtocolo = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const src = (caminho) => recentes[caminho] || MARCA + caminho;
  const en = () => lang === 'en';

  // texto na língua escolhida; em inglês, sem tradução, devolve null
  const tr = (obj, chave) => (en() ? (obj?.[chave + '_en'] || null) : obj?.[chave]) ?? null;
  const mostraTr = (obj, chave, extra = '') => {
    const t = tr(obj, chave);
    return t ? `<span class="v ${extra}">${esc(t)}</span>` : `<span class="v falta">${FALTA}</span>`;
  };

  const paleta = (d) => Object.fromEntries((d.paleta || []).map((p) => [p.id, p]));
  const escura = (hex) => {
    const n = parseInt(String(hex || '#FFFFFF').slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] < 0.3;
  };
  const contraste = (a, b) => {
    const L = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  // ---- peças -------------------------------------------------------------

  const lingua = () => `<span class="lingua">${en() ? 'EN' : 'PT'}</span>`;
  const campoLeitura = (k, v, { largo = false, trad = false } = {}) =>
    `<div class="f${largo ? ' largo' : ''}"><span class="k">${k}${trad ? ' ' + lingua() : ''}</span>${v}</div>`;

  function peca({ caminho, nome, mono }) {
    const quadro = mono
      ? `<div class="quadro mono"><span class="mascara" style="--m:url('${esc(src(caminho))}')"></span></div>`
      : `<div class="quadro"><img src="${esc(src(caminho))}" alt="${esc(nome)}" loading="lazy"></div>`;
    return `<div class="peca">${quadro}<div class="n"><span>${esc(nome)}</span><a href="${esc(src(caminho))}" download>baixar</a></div></div>`;
  }

  const novaPeca = (n) => `<button type="button" class="nova-peca" data-acao="logo" data-nucleo="${esc(n.id)}">${MAIS}Enviar logo</button>`;

  function pecas(n) {
    const lista = (n.logos || []).map((l) => peca({ caminho: l.arquivo, nome: l.nome, mono: l.mono }));
    if (n.selo) lista.push(peca({ caminho: n.selo.arquivo, nome: 'Selo ' + n.selo.nome, mono: true }).replace('class="quadro mono"', 'class="quadro mono selo"'));
    return `<div class="pecas-grade">${lista.join('')}${novaPeca(n)}</div>`;
  }

  function coresDoNucleo(n, P) {
    return `<div class="trio">${Object.entries(n.cores || {}).map(([k, id]) => `<div class="nc"><i style="background:var(--odisse-${esc(id)}, ${esc(P[id]?.valor)})"></i>
      <div><b>${NOMES_CORES[k] || k}</b><small>${esc(P[id]?.nome || id)} · ${esc(P[id]?.valor || '')}</small></div></div>`).join('')}</div>`;
  }

  function listaLinks(pares) {
    if (!pares.length) return '<p class="u-apoio">Usa os canais da marca-mãe.</p>';
    return `<div class="links">${pares.map(([k, u]) => `<div class="lk"><span>${esc(k)}</span>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(semProtocolo(u))}</a>` : '<em>—</em>'}</div>`).join('')}</div>`;
  }

  const canaisDe = (d, n) => [
    ...(n.sites || []).map((k) => [NOMES_SITES[k] || k, d.sites?.[k]]),
    ...(n.redes || []).map((k) => [NOMES_REDES[k] || k, d.redes?.[k]]),
  ];
  const doNucleo = (d, grupo) => new Set(d.nucleos.filter((n) => !n.marca_mae).flatMap((n) => n[grupo] || []));

  function faixa(n, P, { titulo, sub, mae = false }) {
    const fundo = P[n.cores?.painel]?.valor || '#3F4B57';
    const escuro = escura(fundo);
    return `<header class="faixa${escuro ? ' escura' : ''}" style="background:var(--odisse-${esc(n.cores?.painel)}, ${esc(fundo)})">
      <div class="faixa-id">${n.selo ? `<span class="mascara selo-faixa" style="--m:url('${esc(src(n.selo.arquivo))}')"></span>` : ''}
        <div><div class="faixa-titulo${mae ? ' mae' : ''}">${titulo}</div><div class="faixa-sub">${sub}</div></div></div>
      <span class="sigla">${esc(n.sigla || '')}</span></header>`;
  }

  // ---- leitura -------------------------------------------------------------

  function leitura(d) {
    const P = paleta(d);
    const mae = d.nucleos.find((n) => n.marca_mae) || d.nucleos[0];
    const outros = d.nucleos.filter((n) => n !== mae);
    const e = d.endereco, c = d.contato;
    const sitesNuc = doNucleo(d, 'sites'), redesNuc = doNucleo(d, 'redes');
    const redesMae = Object.entries(d.redes || {}).filter(([k]) => !redesNuc.has(k)).map(([k, u]) => [NOMES_REDES[k] || k, u]);
    const sitesMae = Object.entries(d.sites || {}).filter(([k]) => !sitesNuc.has(k)).map(([k, u]) => [NOMES_SITES[k] || k, u]);
    const nomeCompleto = tr(d, 'nome_completo');

    const maeHtml = `
      <section class="bloco"><div class="bloco-cab"><span class="u-rotulo">Marca-mãe</span><span class="u-apoio">Atualizado em ${esc(d.atualizado || '')}</span></div>
      <article class="u-cartao nucleo">
        ${faixa(mae, P, { titulo: esc(d.nome), sub: nomeCompleto ? esc(nomeCompleto) : `<em>${FALTA}</em>`, mae: true })}
        <div class="nucleo-corpo">
          <div class="grupo"><h3>Identidade</h3><div class="campos">
            ${campoLeitura('Nome curto', `<span class="v grande">${esc(d.nome)}</span>`)}
            ${campoLeitura('Nome completo', mostraTr(d, 'nome_completo', 'medio'), { trad: true })}
            ${campoLeitura('Descrição', mostraTr(d, 'descricao', 'texto'), { largo: true, trad: true })}
            ${campoLeitura('Fundadores', `<span class="v">${esc((d.fundadores || []).join(' e '))}</span>`)}
          </div></div>
          <div class="divisor"></div>
          <div class="duas">
            <div class="grupo"><h3>Contato</h3><div class="campos uma">
              ${campoLeitura('E-mail', `<a class="v" href="mailto:${esc(c.email)}">${esc(c.email)}</a>`)}
              ${campoLeitura('Telefone e WhatsApp', `<a class="v" href="${esc(c.whatsapp_link)}" target="_blank" rel="noopener">${esc(c.telefone)}</a>`)}
            </div></div>
            <div class="grupo"><h3>Endereço</h3><div class="campos uma">
              ${campoLeitura('Sede', `<span class="v">${esc(e.logradouro)}<br>${esc(e.bairro)} · ${esc(e.cidade)}/${esc(e.uf)}<br>CEP ${esc(e.cep)}</span>`)}
              ${e.caixa_postal ? campoLeitura('Caixa postal', `<span class="v">${esc(e.caixa_postal)}</span>`) : ''}
            </div></div>
          </div>
          <div class="divisor"></div>
          <div class="duas">
            <div class="grupo"><h3>Redes da marca</h3>${listaLinks(redesMae)}
              <p class="u-apoio">Conta única para todos os núcleos. Redes próprias de um núcleo ficam no bloco dele.</p></div>
            <div class="grupo"><h3>Sites da marca</h3>${listaLinks(sitesMae)}</div>
          </div>
          <div class="divisor"></div>
          <div class="grupo"><h3>Núcleo ${esc(mae.nome.replace(/^Odisse /, ''))}</h3>
            <div class="duas">
              <div class="pilha">
                <div class="campos">
                  ${campoLeitura('Nome do núcleo', `<span class="v medio">${esc(mae.nome)}</span>`)}
                  ${campoLeitura('Sigla', `<span class="v"><span class="chip forte">${esc(mae.sigla)}</span></span>`)}
                  ${campoLeitura('Conteúdo', mostraTr(mae, 'conteudo'), { largo: true, trad: true })}
                </div>
                <div class="grupo pequeno"><span class="k">Cores do núcleo</span>${coresDoNucleo(mae, P)}</div>
              </div>
              <div class="grupo pequeno"><div class="linha-cab"><span class="k">Logos e selo</span><span class="u-apoio">${(mae.logos || []).length + 1} peças · SVG</span></div>
                ${pecas(mae)}<p class="u-apoio">${mae.selo ? `${esc(mae.selo.nome)}: ${esc(tr(mae.selo, 'uso') || FALTA)}` : ''}</p></div>
            </div>
          </div>
        </div>
      </article></section>`;

    const nucleosHtml = `
      <section class="bloco"><div class="bloco-cab"><span class="u-rotulo">Núcleos</span><span class="u-apoio">Nome, sigla, cores, canais, logos e selo de cada núcleo</span></div>
      <div class="pilha">${outros.map((n) => `
        <article class="u-cartao nucleo">
          ${faixa(n, P, { titulo: esc(n.nome), sub: tr(n, 'conteudo') ? esc(tr(n, 'conteudo')) : `<em>${FALTA}</em>` })}
          <div class="nucleo-corpo duas">
            <div class="pilha">
              <div class="grupo"><h3>Cores do núcleo</h3>${coresDoNucleo(n, P)}</div>
              <div class="grupo"><h3>Canais do núcleo</h3>${listaLinks(canaisDe(d, n))}</div>
            </div>
            <div class="grupo"><div class="linha-cab"><h3>Logos e selo</h3><span class="u-apoio">${(n.logos || []).length + 1} peças · SVG</span></div>
              ${pecas(n)}<p class="u-apoio">${n.selo ? `${esc(n.selo.nome)}: ${esc(tr(n.selo, 'uso') || FALTA)}` : ''}</p></div>
          </div>
        </article>`).join('')}</div></section>`;

    const papeis = Object.entries(d.papeis || {}).map(([k, id]) => `<div class="nc"><i style="background:${esc(P[id]?.valor)}"></i>
      <div><b>${NOMES_PAPEIS[k] || k}</b><small>${esc(P[id]?.nome || id)} · ${esc(P[id]?.valor || '')}</small></div></div>`).join('');
    const paletaHtml = `
      <section class="bloco"><div class="bloco-cab"><span class="u-rotulo">Paleta e tipografia</span><span class="u-apoio">Clique numa cor para copiar o código</span></div>
      <div class="u-cartao painel-largo pilha">
        <div class="grupo"><h3>Papéis</h3><div class="trio">${papeis}</div></div>
        <div class="grupo"><h3>Cores</h3><div class="cores">${(d.paleta || []).map((p) => `
          <button type="button" class="cor" data-c="${esc(p.valor)}"><span class="amostra" style="background:${esc(p.valor)}"></span>
            <span class="cor-nome"><b>${esc(p.nome)}</b>${p.principal ? '<span class="chip forte">Principal</span>' : ''}</span>
            <small>${esc(p.valor)} · --odisse-${esc(p.id)}</small>
            ${tr(p, 'funcao') ? `<span class="funcao">${esc(tr(p, 'funcao'))}</span>` : `<span class="funcao falta">${FALTA}</span>`}</button>`).join('')}</div>
          <p class="u-apoio">Texto corrido só a partir de 4,5:1 de contraste.</p></div>
        <div class="grupo tipo"><h3>Tipografia</h3>
          <div class="g">Arquitetura e design entre memória e potencialidade</div>
          <div class="pesos"><span style="font-weight:300">Inter Leve 300</span><span>Regular 400</span><span style="font-weight:500">Médio 500</span><span style="font-weight:600">Seminegrito 600</span><span style="font-weight:700">Negrito 700</span></div></div>
      </div></section>`;

    return maeHtml + nucleosHtml + paletaHtml;
  }

  // ---- edição --------------------------------------------------------------
  // Cada campo tem data-k com o caminho no odisse.json. Em inglês, os traduzíveis apontam para a
  // chave `_en` e o resto fica travado (igual nas duas línguas).

  function inp(k, rotulo, valor, { trad = false, tipo = 'text', area = false, largo = false, dica = '', trava = false } = {}) {
    const chave = trad && en() ? k + '_en' : k;
    const travado = trava || (en() && !trad);
    const val = trad && en() ? valorEm(edicao.dados, chave) : valor;
    const id = 'c-' + chave.replace(/[^a-z0-9]/gi, '-');
    const ctrl = area
      ? `<textarea id="${id}" data-k="${esc(chave)}" rows="3"${travado ? ' readonly' : ''}>${esc(val)}</textarea>`
      : `<input id="${id}" type="${tipo}" data-k="${esc(chave)}" value="${esc(val)}"${travado ? ' readonly' : ''}${trad && en() && !val ? ' class="vazio" placeholder="Sem tradução ainda"' : ''}>`;
    const marca = trad ? ` <span class="lingua${en() ? ' en' : ''}">${en() ? 'EN' : 'PT'}</span>`
      : travado ? ` <span class="trava">${CADEADO}${trava ? 'fixo' : 'igual nas duas línguas'}</span>` : '';
    const orig = trad && en() && valor ? `<span class="orig">PT · ${esc(valor)}</span>` : '';
    return `<div class="c${largo ? ' largo' : ''}${travado ? ' travado' : ''}"><label for="${id}">${esc(rotulo)}${marca}</label>${ctrl}${orig}${dica ? `<small>${esc(dica)}</small>` : ''}</div>`;
  }

  function seletorCor(k, rotulo, atual, P) {
    const id = 'c-' + k.replace(/[^a-z0-9]/gi, '-');
    return `<div class="c${en() ? ' travado' : ''}"><label for="${id}">${esc(rotulo)}${en() ? ` <span class="trava">${CADEADO}igual nas duas línguas</span>` : ''}</label>
      <div class="sel-cor"><i style="background:${esc(P[atual]?.valor)}"></i><select id="${id}" data-k="${esc(k)}"${en() ? ' disabled' : ''}>
      ${Object.values(P).map((p) => `<option value="${esc(p.id)}"${p.id === atual ? ' selected' : ''}>${esc(p.nome)} · ${esc(p.valor)}</option>`).join('')}</select></div></div>`;
  }

  function edicaoHtml() {
    const d = edicao.dados, P = paleta(d), c = d.contato, e = d.endereco;
    const mae = d.nucleos.find((n) => n.marca_mae) || d.nucleos[0];
    const outros = d.nucleos.filter((n) => n !== mae);
    const sitesNuc = doNucleo(d, 'sites'), redesNuc = doNucleo(d, 'redes');
    const grupo = (t, html, cls = '') => `<div class="grupo"><h3>${t}</h3><div class="campos ${cls}">${html}</div></div>`;
    const nucleoCampos = (n) =>
      inp(`nucleos.${n.id}.nome`, n.marca_mae ? 'Nome do núcleo' : 'Nome', n.nome) +
      inp(`nucleos.${n.id}.sigla`, 'Sigla', n.sigla, { trava: true }) +
      inp(`nucleos.${n.id}.conteudo`, 'Conteúdo', n.conteudo, { trad: true, largo: true }) +
      Object.entries(n.cores || {}).map(([k, id]) => seletorCor(`nucleos.${n.id}.cores.${k}`, NOMES_CORES[k] || k, id, P)).join('') +
      (n.selo ? inp(`nucleos.${n.id}.selo.uso`, `Uso do selo ${n.selo.nome}`, n.selo.uso, { trad: true, largo: true }) : '') +
      (n.sites || []).map((k) => inp(`sites.${k}`, NOMES_SITES[k] || k, d.sites[k], { tipo: 'url' })).join('') +
      (n.redes || []).map((k) => inp(`redes.${k}`, NOMES_REDES[k] || k, d.redes[k], { tipo: 'url' })).join('');

    return `<form class="edicao" data-form="marca" novalidate>
      <section class="bloco"><div class="bloco-cab"><span class="u-rotulo">Marca-mãe</span></div>
      <div class="u-cartao painel-largo pilha">
        ${grupo('Identidade',
          inp('nome', 'Nome curto', d.nome) +
          inp('nome_completo', 'Nome completo', d.nome_completo, { trad: true }) +
          inp('descricao', 'Descrição', d.descricao, { trad: true, area: true, largo: true }) +
          inp('fundadores', 'Fundadores', (d.fundadores || []).join(', '), { dica: en() ? '' : 'Separados por vírgula.' }))}
        <div class="divisor"></div>
        ${grupo('Contato',
          inp('contato.email', 'E-mail', c.email, { tipo: 'email' }) +
          inp('contato.telefone', 'Telefone', c.telefone, { tipo: 'tel', dica: en() ? '' : 'O WhatsApp sai deste número.' }))}
        ${grupo('Endereço',
          inp('endereco.logradouro', 'Logradouro, número e sala', e.logradouro, { largo: true }) +
          inp('endereco.bairro', 'Bairro', e.bairro) + inp('endereco.cidade', 'Cidade', e.cidade) +
          inp('endereco.uf', 'UF', e.uf) + inp('endereco.cep', 'CEP', e.cep) + inp('endereco.caixa_postal', 'Caixa postal', e.caixa_postal))}
        <div class="divisor"></div>
        ${grupo('Redes da marca', Object.keys(d.redes || {}).filter((k) => !redesNuc.has(k)).map((k) => inp(`redes.${k}`, NOMES_REDES[k] || k, d.redes[k], { tipo: 'url' })).join(''))}
        ${grupo('Sites da marca', Object.keys(d.sites || {}).filter((k) => !sitesNuc.has(k)).map((k) => inp(`sites.${k}`, NOMES_SITES[k] || k, d.sites[k], { tipo: 'url' })).join(''))}
        <div class="divisor"></div>
        ${grupo(`Núcleo ${esc(mae.nome.replace(/^Odisse /, ''))}`, nucleoCampos(mae))}
      </div></section>

      <section class="bloco"><div class="bloco-cab"><span class="u-rotulo">Núcleos</span></div>
      <div class="pilha">${outros.map((n) => `<article class="u-cartao nucleo">
        ${faixa(n, P, { titulo: esc(n.nome), sub: esc(tr(n, 'conteudo') || '') })}
        <div class="nucleo-corpo"><div class="campos">${nucleoCampos(n)}</div></div></article>`).join('')}</div></section>

      <section class="bloco"><div class="bloco-cab"><span class="u-rotulo">Paleta</span>
        <span class="u-apoio">O nome da cor é fixo (os sites leem --odisse-&lt;nome&gt;); valor, função e principal mudam.</span></div>
      <div class="u-cartao painel-largo pilha">
        <div class="linhas-cor">
          <div class="linha-cor cab"><span></span><span>Cor</span><span>Valor</span><span>Função</span><span>Principal</span></div>
          ${(d.paleta || []).map((p) => {
            const fk = en() ? `paleta.${p.id}.funcao_en` : `paleta.${p.id}.funcao`;
            const fv = en() ? (p.funcao_en || '') : (p.funcao || '');
            return `<div class="linha-cor" data-cor="${esc(p.id)}">
              <i class="amostra-viva" style="background:${esc(p.valor)}"></i>
              <b>${esc(p.nome)}</b>
              <div class="valor-cor"><input type="color" aria-label="Escolher ${esc(p.nome)}" value="${esc(p.valor.toLowerCase())}"${en() ? ' disabled' : ''}>
                <input type="text" aria-label="Código de ${esc(p.nome)}" data-k="paleta.${esc(p.id)}.valor" value="${esc(p.valor)}"${en() ? ' readonly' : ''}></div>
              <div><input type="text" aria-label="Função de ${esc(p.nome)}" data-k="${fk}" value="${esc(fv)}"${en() && !fv ? ' class="vazio" placeholder="Sem tradução ainda"' : ''}>
                ${en() && p.funcao ? `<span class="orig">PT · ${esc(p.funcao)}</span>` : ''}</div>
              <label class="principal"><input type="checkbox" data-k="paleta.${esc(p.id)}.principal"${p.principal ? ' checked' : ''}${en() ? ' disabled' : ''}><span class="sr">Principal</span></label>
              <small class="contraste">${contrasteTexto(p.valor, P)}</small>
            </div>`;
          }).join('')}
        </div>
        <div class="grupo"><h3>Papéis</h3><div class="campos tres">
          ${Object.entries(d.papeis || {}).map(([k, id]) => seletorCor(`papeis.${k}`, NOMES_PAPEIS[k] || k, id, P)).join('')}</div></div>
      </div></section>

      <div class="barra-salvar">
        ${aviso}
        <span class="u-apoio">Salvar grava no repositório marca-odisse, com histórico. Os sites atualizam em 1 a 2 minutos.</span>
        <button class="u-botao" type="button" data-acao="cancelar">Cancelar</button>
        <button class="u-botao forte" type="submit">Salvar</button>
      </div>
    </form>`;
  }

  function contrasteTexto(valor, P) {
    if (!/^#[0-9A-F]{6}$/i.test(valor)) return '';
    const papel = P.papel?.valor || '#FAFAF7', ardosia = P.ardosia?.valor || '#3F4B57';
    const a = contraste(valor, papel), b = contraste(valor, ardosia);
    const f = (x) => x.toFixed(1).replace('.', ',');
    return `sobre papel ${f(a)}:1 · com ardósia ${f(b)}:1`;
  }

  // caminho "nucleos.elaia.cores.painel" -> valor (nucleos e paleta são listas com id)
  function alvo(d, caminho, criar = false) {
    const partes = caminho.split('.');
    let o = d;
    for (let i = 0; i < partes.length - 1; i++) {
      const p = partes[i];
      if (Array.isArray(o)) o = o.find((x) => x.id === p);
      else { if (o[p] == null && criar) o[p] = {}; o = o[p]; }
      if (o == null) return [null, null];
    }
    return [o, partes.at(-1)];
  }
  function valorEm(d, caminho) { const [o, k] = alvo(d, caminho); return o ? (o[k] ?? '') : ''; }

  function colher(form) {
    form.querySelectorAll('[data-k]').forEach((el) => {
      if (el.readOnly || el.disabled) return;
      const [o, k] = alvo(edicao.dados, el.dataset.k, true);
      if (!o) return;
      if (el.type === 'checkbox') o[k] = el.checked;
      else if (el.dataset.k === 'fundadores') o[k] = el.value.split(',').map((s) => s.trim()).filter(Boolean);
      else o[k] = el.value;
    });
  }

  // ---- montagem --------------------------------------------------------------

  function cabecalho() {
    const b = (l) => `<button type="button" data-lang="${l}" class="${lang === l ? 'on' : ''}" aria-pressed="${lang === l}">${l.toUpperCase()}</button>`;
    const texto = edicao
      ? (en() ? 'Editando a versão em inglês. Só os textos que se traduzem ficam abertos; o resto é igual nas duas línguas. O português fica embaixo de cada campo, de referência.'
        : 'Editando. Troque para EN para preencher as traduções.')
      : (en() ? 'Vendo o conteúdo em inglês. O que não tem tradução aparece marcado; e-mail, telefone, endereço, links e nomes são os mesmos nas duas línguas.'
        : 'Quem somos: a marca-mãe, os núcleos, a paleta e a tipografia. Todos os sites e ferramentas leem daqui.');
    const acoes = edicao ? '' : `<a class="u-botao" href="${MARCA}" target="_blank" rel="noopener">Arquivos públicos ↗</a>
      <button class="u-botao forte" type="button" data-acao="editar">Editar</button>`;
    return `<div class="cab"><div><div class="titulo-linha"><h1 class="u-titulo">${edicao ? 'Marca · editando' : 'Marca'}</h1>
      <div class="chave-lingua" role="group" aria-label="Língua do conteúdo">${b('pt')}${b('en')}</div></div>
      <p class="u-apoio">${texto}</p></div><div class="lado acoes-cab">${acoes}</div></div>`;
  }

  function desenhar() {
    if (!raiz) return;
    const d = lerOdisse();
    let corpo;
    if (edicao) corpo = edicaoHtml();
    else if (!d) corpo = '<p class="u-apoio">Não foi possível ler os dados da marca.</p>';
    else corpo = (aviso ? `<div class="aviso-marca">${aviso}</div>` : '') + leitura(d);
    raiz.innerHTML = cabecalho() + corpo;
  }

  async function abrirEdicao() {
    aviso = '';
    raiz.querySelector('[data-acao="editar"]')?.setAttribute('disabled', '');
    let r;
    try { r = await api('/api/marca'); } catch { r = { status: 0 }; }
    if (r.status !== 200) {
      aviso = `<p class="erro">${r.status === 401 ? 'Senha incorreta: saia e entre de novo.' : esc(r.error || 'Não foi possível falar com o servidor do Universo.')}</p>`;
      return desenhar();
    }
    edicao = { dados: r.dados, sha: r.sha };
    gravarOdisse(r.dados);
    desenhar();
  }

  async function salvar(form) {
    colher(form);
    const botao = form.querySelector('[type=submit]');
    botao.disabled = true; botao.textContent = 'Salvando…';
    let r;
    try { r = await api('/api/marca', { method: 'PUT', body: JSON.stringify({ dados: edicao.dados, sha: edicao.sha }) }); }
    catch { r = { status: 0, error: 'Não foi possível falar com o servidor do Universo.' }; }
    if (r.status === 200) {
      gravarOdisse(r.dados); edicao = null;
      aviso = r.semMudanca ? '<p class="ok">Nada mudou.</p>'
        : `<p class="ok">Salvo: ${esc((r.mudou || []).join(', '))}. Os sites atualizam em 1 a 2 minutos.${r.commit ? ` <a href="${esc(r.commit)}" target="_blank" rel="noopener">ver alteração</a>` : ''}</p>`;
      desenhar(); window.scrollTo(0, 0); return;
    }
    if (r.status === 409) {
      edicao = { dados: r.dados, sha: r.sha };
      aviso = '<p class="erro">Alguém salvou a marca enquanto você editava. O formulário foi recarregado com a versão atual; refaça sua alteração.</p>';
    } else {
      aviso = `<p class="erro">${esc(r.error || 'Não foi possível salvar.')}</p>`;
    }
    desenhar();
    raiz.querySelector('.barra-salvar')?.scrollIntoView({ block: 'end' });
  }

  // ---- envio de logo ---------------------------------------------------------

  const envio = { nucleo: null, svg: '', nomeArquivo: '', sha: null, dados: null, modo: 'novo', alvo: '', nome: '' };

  function svgSeguroLocal(s) {
    const t = String(s || '');
    if (!/<svg[\s>]/i.test(t)) return 'não parece um SVG';
    if (/<script|<foreignObject|<(image|iframe|object|embed)[\s>/]|\son[a-z]+\s*=|javascript:/i.test(t)) return 'tem scripts, eventos ou imagens embutidas';
    return '';
  }
  const coresDo = (svg) => [...new Set([...String(svg).matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b(?![\w-])/gi)]
    .map((m) => '#' + (m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]).toUpperCase()))];
  const ehMono = (svg) => /currentColor/i.test(svg) && coresDo(svg).length === 0;
  const proporcao = (svg) => {
    const vb = String(svg).match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    return vb ? [+vb[1], +vb[2]] : null;
  };
  const distancia = (a, b) => {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    return Math.hypot((x >> 16) - (y >> 16), ((x >> 8) & 255) - ((y >> 8) & 255), (x & 255) - (y & 255));
  };

  function dialogoHtml() {
    const d = envio.dados, P = paleta(d), n = d.nucleos.find((x) => x.id === envio.nucleo);
    const temSvg = !!envio.svg;
    const mono = temSvg && ehMono(envio.svg);
    const url = temSvg ? URL.createObjectURL(new Blob([envio.svg], { type: 'image/svg+xml' })) : '';
    if (dialogoHtml.url) URL.revokeObjectURL(dialogoHtml.url);
    dialogoHtml.url = url;
    const painel = P[n.cores?.painel]?.valor || '#E3D9C6', veu = P[n.cores?.veu]?.valor || '#3F4B57';
    const fundos = [['Papel · fundo', P.papel?.valor || '#FAFAF7'], [`${P[n.cores?.painel]?.nome || 'Painel'} · painel`, painel],
      [`${P[n.cores?.veu]?.nome || 'Véu'} · véu`, veu], ['Transparência', null]];
    const previa = fundos.map(([rot, cor]) => {
      const tinta = cor && escura(cor) ? '#FAFAF7' : '#3F4B57';
      const desenho = !temSvg ? '' : mono
        ? `<span class="mascara" style="--m:url('${url}');color:${tinta}"></span>`
        : `<img src="${url}" alt="">`;
      return `<div class="pv"><div class="pv-q${cor ? '' : ' xadrez'}" style="${cor ? `background:${cor}` : ''}">${desenho}</div><span>${esc(rot)}</span></div>`;
    }).join('');

    const conferencia = [];
    if (temSvg) {
      const ruim = svgSeguroLocal(envio.svg);
      conferencia.push(ruim ? ['erro', `Não pode ser enviado: ${ruim}.`] : ['ok', 'SVG só com desenho (sem scripts nem imagens embutidas)']);
      const pr = proporcao(envio.svg);
      if (pr) conferencia.push(Math.abs(pr[0] - pr[1]) < 0.5 ? ['ok', `Proporção quadrada (${pr[0]} × ${pr[1]})`] : ['info', `Proporção ${pr[0]} × ${pr[1]} (não quadrada)`]);
      else conferencia.push(['erro', 'Sem viewBox: exporte de novo com viewBox']);
      if (mono) conferencia.push(['ok', 'Uma cor só (currentColor): assume a cor do fundo, como o Estúdio 01 e os selos']);
      const fora = coresDo(envio.svg).filter((h) => !Object.values(P).some((p) => p.valor.toUpperCase() === h));
      for (const h of fora) {
        const perto = Object.values(P).sort((a, b) => distancia(a.valor, h) - distancia(b.valor, h))[0];
        conferencia.push(['aviso', `Usa ${h}, que não está na paleta (mais perto: ${esc(perto.nome)} ${esc(perto.valor)}). <button type="button" class="link" data-trocar="${h}" data-por="${esc(perto.valor)}">trocar por ${esc(perto.nome)}</button>`]);
      }
    }
    const icone = { ok: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2F6FAF" stroke-width="2.4" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
      aviso: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A5A2B" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>',
      info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B6773" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
      erro: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A4473B" stroke-width="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' };
    const bloqueado = !temSvg || conferencia.some(([t]) => t === 'erro');
    const alvos = [...(n.logos || []).map((l) => [l.arquivo, l.nome]), ...(n.selo ? [[n.selo.arquivo, 'Selo ' + n.selo.nome]] : [])];

    return `<form method="dialog" class="dialogo-logo" data-form="logo">
      <div class="dl-cab"><div><span class="u-rotulo">${esc(n.nome)}</span><h2 class="u-subtitulo">Enviar logo</h2></div>
        <button type="button" class="u-botao" data-acao="fechar-logo" aria-label="Fechar">✕</button></div>
      <label class="arquivo${temSvg ? ' cheio' : ''}">
        <input type="file" accept=".svg,image/svg+xml" data-acao="arquivo-logo">
        <span><b>${temSvg ? esc(envio.nomeArquivo) : 'Escolher um arquivo SVG'}</b><small>${temSvg ? `${(envio.svg.length / 1024).toFixed(1).replace('.', ',')} KB · clique ou arraste outro para trocar` : 'ou arraste para cá'}</small></span>
      </label>
      <div class="grupo pequeno"><span class="k">Prévia</span><div class="previas">${previa}</div>
        <small class="u-apoio">Um SVG de uma cor só (currentColor) acompanha o fundo; um com cores próprias aparece como está.</small></div>
      <div class="grupo pequeno"><span class="k">Este arquivo</span>
        <div class="modos">
          <label class="modo${envio.modo === 'novo' ? ' on' : ''}"><input type="radio" name="modo" value="novo"${envio.modo === 'novo' ? ' checked' : ''}>
            <span><b>Acrescenta uma peça</b><small>Entra na lista do ${esc(n.nome.replace(/^Odisse /, ''))} com nome novo</small></span></label>
          <label class="modo${envio.modo === 'substituir' ? ' on' : ''}"><input type="radio" name="modo" value="substituir"${envio.modo === 'substituir' ? ' checked' : ''}>
            <span><b>Substitui uma peça</b><small>Mesmo endereço; os sites trocam sozinhos</small></span></label>
        </div>
        ${envio.modo === 'novo'
          ? `<div class="c"><label for="logo-nome">Nome da peça</label><input id="logo-nome" name="nome" value="${esc(envio.nome)}" placeholder="Em branco: o próximo número da série"></div>`
          : `<div class="c"><label for="logo-alvo">Peça a substituir</label><select id="logo-alvo" name="alvo">${alvos.map(([a, nm]) => `<option value="${esc(a)}"${a === envio.alvo ? ' selected' : ''}>${esc(nm)}</option>`).join('')}</select></div>`}
      </div>
      ${conferencia.length ? `<ul class="conferencia">${conferencia.map(([t, m]) => `<li class="conf-${t}">${icone[t]}<span>${m}</span></li>`).join('')}</ul>` : ''}
      <p class="erro" data-erro hidden></p>
      <div class="dl-acoes"><span class="u-apoio">Grava no marca-odisse, com histórico</span>
        <button type="button" class="u-botao" data-acao="fechar-logo">Cancelar</button>
        <button type="submit" class="u-botao forte"${bloqueado ? ' disabled' : ''}>Enviar</button></div>
    </form>`;
  }

  function dialogo() {
    let dl = document.getElementById('dialogo-logo');
    if (!dl) {
      dl = document.createElement('dialog'); dl.id = 'dialogo-logo'; dl.className = 'u-cartao';
      document.body.appendChild(dl);
      dl.addEventListener('click', (ev) => {
        if (ev.target === dl || ev.target.closest('[data-acao="fechar-logo"]')) { ev.preventDefault(); dl.close(); return; }
        const tb = ev.target.closest('[data-trocar]');
        if (tb) { envio.svg = envio.svg.replace(new RegExp(tb.dataset.trocar.slice(1), 'gi'), tb.dataset.por.slice(1)); redesenharDialogo(); }
      });
      dl.addEventListener('change', (ev) => {
        const t = ev.target;
        if (t.matches('[data-acao="arquivo-logo"]') && t.files[0]) return lerArquivo(t.files[0]);
        if (t.name === 'modo') { envio.modo = t.value; if (envio.modo === 'substituir' && !envio.alvo) envio.alvo = alvoPadrao(); redesenharDialogo(); }
        if (t.name === 'alvo') envio.alvo = t.value;
      });
      dl.addEventListener('input', (ev) => { if (ev.target.name === 'nome') envio.nome = ev.target.value; });
      dl.addEventListener('dragover', (ev) => { ev.preventDefault(); dl.classList.add('arrastando'); });
      dl.addEventListener('dragleave', () => dl.classList.remove('arrastando'));
      dl.addEventListener('drop', (ev) => { ev.preventDefault(); dl.classList.remove('arrastando'); const f = ev.dataTransfer.files[0]; if (f) lerArquivo(f); });
      dl.addEventListener('submit', (ev) => { ev.preventDefault(); enviarLogo(); });
    }
    return dl;
  }
  const alvoPadrao = () => { const n = envio.dados.nucleos.find((x) => x.id === envio.nucleo); return n.logos?.[0]?.arquivo || n.selo?.arquivo || ''; };
  function redesenharDialogo() { dialogo().innerHTML = dialogoHtml(); }

  async function lerArquivo(f) {
    if (f.size > 512 * 1024) { toque('Arquivo grande demais (máximo 512 KB)'); return; }
    envio.svg = await f.text(); envio.nomeArquivo = f.name;
    redesenharDialogo();
  }

  async function abrirLogo(nucleo) {
    let r;
    try { r = await api('/api/marca'); } catch { r = { status: 0 }; }
    if (r.status !== 200) { toque(r.status === 401 ? 'Senha incorreta: saia e entre de novo.' : 'Não foi possível falar com o servidor do Universo.'); return; }
    Object.assign(envio, { nucleo, svg: '', nomeArquivo: '', sha: r.sha, dados: r.dados, modo: 'novo', alvo: '', nome: '' });
    const dl = dialogo(); dl.innerHTML = dialogoHtml(); dl.showModal();
  }

  async function enviarLogo() {
    const dl = dialogo(), botao = dl.querySelector('[type=submit]'), erroEl = dl.querySelector('[data-erro]');
    botao.disabled = true; botao.textContent = 'Enviando…';
    const corpo = { sha: envio.sha, nucleo: envio.nucleo, modo: envio.modo, svg: envio.svg,
      ...(envio.modo === 'novo' ? { nome: envio.nome.trim() } : { alvo: envio.alvo || alvoPadrao() }) };
    let r;
    try { r = await api('/api/marca/logo', { method: 'POST', body: JSON.stringify(corpo) }); }
    catch { r = { status: 0, error: 'Não foi possível falar com o servidor do Universo.' }; }
    if (r.status === 200) {
      recentes[r.caminho] = URL.createObjectURL(new Blob([envio.svg], { type: 'image/svg+xml' }));
      gravarOdisse(r.dados);
      if (edicao) edicao = { dados: r.dados, sha: r.sha };
      dl.close();
      aviso = `<p class="ok">${esc(r.nome)} enviado (${esc(r.caminho)}). Os sites atualizam em 1 a 2 minutos.${r.commit ? ` <a href="${esc(r.commit)}" target="_blank" rel="noopener">ver alteração</a>` : ''}</p>`;
      desenhar(); return;
    }
    if (r.status === 409) { envio.sha = r.sha; envio.dados = r.dados; }
    erroEl.hidden = false;
    erroEl.textContent = r.status === 409 ? 'A marca mudou enquanto você enviava. Confira e envie de novo.' : (r.error || 'Não foi possível enviar.');
    botao.disabled = false; botao.textContent = 'Enviar';
  }

  // ---- eventos -------------------------------------------------------------

  function ligar(el) {
    raiz = el;
    edicao = null; aviso = '';
    desenhar();
    el.addEventListener('click', async (ev) => {
      const l = ev.target.closest('[data-lang]');
      if (l) {
        const form = el.querySelector('form[data-form="marca"]');
        if (form && edicao) colher(form);
        lang = l.dataset.lang; desenhar(); return;
      }
      const cor = ev.target.closest('.cor[data-c]');
      if (cor) { try { await navigator.clipboard.writeText(cor.dataset.c); toque('Copiado: ' + cor.dataset.c); } catch { toque(cor.dataset.c); } return; }
      const b = ev.target.closest('[data-acao]'); if (!b) return;
      if (b.dataset.acao === 'editar') abrirEdicao();
      if (b.dataset.acao === 'cancelar') { edicao = null; aviso = ''; desenhar(); window.scrollTo(0, 0); }
      if (b.dataset.acao === 'logo') abrirLogo(b.dataset.nucleo);
    });
    el.addEventListener('submit', (ev) => { if (ev.target.dataset.form === 'marca') { ev.preventDefault(); salvar(ev.target); } });
    // cor: o seletor nativo e o código andam juntos; a amostra e o contraste acompanham
    el.addEventListener('input', (ev) => {
      const linha = ev.target.closest('.linha-cor[data-cor]');
      if (linha) {
        const texto = linha.querySelector('input[type=text][data-k$=".valor"]'), roda = linha.querySelector('input[type=color]');
        if (ev.target === roda) texto.value = roda.value.toUpperCase();
        const v = texto.value.trim();
        if (/^#[0-9A-F]{6}$/i.test(v)) {
          if (ev.target === texto) roda.value = v.toLowerCase();
          linha.querySelector('.amostra-viva').style.background = v;
          linha.querySelector('.contraste').textContent = contrasteTexto(v, paleta(edicao.dados));
        }
      }
      const sel = ev.target.closest('.sel-cor select');
      if (sel) sel.previousElementSibling.style.background = paleta(edicao.dados)[sel.value]?.valor || '';
    });
    el.addEventListener('change', (ev) => {
      const sel = ev.target.closest('.sel-cor select');
      if (sel) sel.previousElementSibling.style.background = paleta(edicao.dados)[sel.value]?.valor || '';
    });
  }

  return { ligar };
}
