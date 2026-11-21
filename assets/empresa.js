// O Estúdio › Empresa (#/empresa; Cid, 19/11): dados da empresa para contratos e documentos, e os textos de
// apresentação do escritório em três tamanhos (curto, médio, longo), em português e inglês.
//
// Onde mora: banco do Universo (tabela `empresa`, registro emp_odisse, migração 0018) — é daí que o contrato lê.
// Ao salvar, a parte pública (nome, contato, endereço, textos) é copiada para o odisse.json da Marca, que o site
// e as ferramentas continuam lendo; razão social, CNPJ e demais dados jurídicos ficam só no banco.
// Desenho: o sistema de caixas da ficha da Equipe (eq-ficha, eq-sec, eq-tres) e a barra de salvar presa ao pé.
// Constituição e registros (0021; Cid, 19/11): os dados jurídicos e, embaixo, os documentos de constituição e do CAU
// da PJ; a caixa Contato e sede leva os documentos da sede. Os documentos gravam sozinhos (Gaveta, assets/credenciais.js);
// os campos, pela Barra de salvar.
// Dados bancários (0027; Cid, 21/11): banco, agência, conta e PIX para o pagamento dos contratos. Só no banco do Universo
// (fora da cópia pública; marketing e site não enxergam). Enquanto faltar algum, o Bloco mostra o aviso "a preencher".

import { lerCopia, gravarCopia } from './memoria.js';

const ID = 'emp_odisse';
const COPIA = 'empresa';
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const TAMANHOS = [
  ['curto', 'Curto', 200, 'Uma frase. Bio de rede social, cabeçalho de proposta, cartão de visita.'],
  ['medio', 'Médio', 900, 'Um parágrafo. Rodapé do site, apresentação na proposta, ficha técnica.'],
  ['longo', 'Longo', 4000, 'Três a quatro parágrafos (linha em branco entre eles). Página Sobre do site, portfólio.'],
];
const CAMPOS = ['nome', 'nome_completo', 'nome_completo_en', 'razao_social', 'cnpj', 'inscricao_municipal', 'registro_cau', 'fundacao',
  'inscricao_estadual', 'capital_social', 'responsavel_tecnico_id',
  'email', 'telefone', 'logradouro', 'bairro', 'cidade', 'uf', 'cep', 'caixa_postal',
  'banco', 'agencia', 'conta', 'pix',
  ...TAMANHOS.flatMap(([k]) => ['texto_' + k, 'texto_' + k + '_en'])];
// o que vai para a cópia pública (odisse.json)
const PUBLICOS = new Set(['nome', 'nome_completo', 'nome_completo_en', 'email', 'telefone', 'logradouro', 'bairro', 'cidade', 'uf', 'cep',
  'caixa_postal', ...TAMANHOS.flatMap(([k]) => ['texto_' + k, 'texto_' + k + '_en'])]);

// capital social: digitado em reais, guardado em centavos
const reais = (c) => (c == null ? '' : (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const centavos = (t) => {
  const s = String(t || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!s) return null;
  const n = Math.round(Number(s) * 100);
  return Number.isFinite(n) ? n : null;
};
const BANCARIOS = [['banco', 'banco'], ['agencia', 'agência'], ['conta', 'conta'], ['pix', 'chave PIX']];
const faltamBancarios = (d) => BANCARIOS.filter(([k]) => !d?.[k]).map(([, r]) => r);
const valorDe = (k, bruto) => (k === 'capital_social' ? centavos(bruto) : (String(bruto ?? '').trim() || null));

export function criarEmpresa({ esc, api, toque, lerOdisse, gravarOdisse, cred }) {
  let reg = null;          // registro como está no servidor
  let sujo = new Set();    // campos mudados e ainda não salvos
  window.addEventListener('beforeunload', (ev) => { if (sujo.size && location.hash.startsWith('#/empresa')) { ev.preventDefault(); ev.returnValue = ''; } });

  const campo = (k, rotulo, extra = {}) => {
    const v = reg?.[k] ?? '';
    if (extra.lista) return `<label class="u-campo"><span>${rotulo}</span><select name="${k}"><option value="">—</option>
      ${extra.lista.map((o) => `<option${v === o ? ' selected' : ''}>${o}</option>`).join('')}</select></label>`;
    return `<label class="u-campo"><span>${rotulo}</span><input name="${k}" value="${esc(v)}"${extra.tipo ? ` type="${extra.tipo}"` : ''}${extra.ph ? ` placeholder="${esc(extra.ph)}"` : ''}>
      ${extra.dica ? `<small>${extra.dica}</small>` : ''}</label>`;
  };
  const texto = (k, max, en) => {
    const nome = 'texto_' + k + (en ? '_en' : '');
    const v = reg?.[nome] ?? '';
    return `<label class="u-campo"><span>${en ? '<span class="lingua en">EN</span>' : '<span class="lingua">PT</span>'}</span>
      <textarea name="${nome}" rows="${k === 'curto' ? 3 : k === 'medio' ? 6 : 12}" maxlength="${max}">${esc(v)}</textarea>
      <small class="emp-conta" data-conta="${nome}">${v.length} / ${max}</small></label>`;
  };

  // qualificação da contratada, no formato da prévia "Como sai no contrato" da Equipe
  function qualificacao(d) {
    const falta = (x, rot) => x || `[${rot}]`;
    const sede = [d.logradouro, d.bairro, d.cidade && d.uf ? `${d.cidade}/${d.uf}` : d.cidade].filter(Boolean).join(', ');
    return `${falta(d.razao_social || d.nome_completo, 'razão social')}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº `
      + `${falta(d.cnpj, 'CNPJ')}${d.registro_cau ? `, registrada no CAU sob o nº ${d.registro_cau}` : ''}, com sede na ${falta(sede, 'endereço')}`
      + `${d.cep ? `, CEP ${d.cep}` : ''}, neste ato representada por seu sócio [quem assina o contrato].`;
  }

  // responsável técnico: quem tem registro no conselho (lido do quadro das Credenciais)
  function opcoesRT() {
    const eq = (cred?.lerQuadro()?.equipe || []).filter((e) => e.registro || e.id === reg?.responsavel_tecnico_id);
    const atual = reg?.responsavel_tecnico_id;
    const lista = eq.length || !atual ? eq : [{ id: atual, nome: 'pessoa da equipe' }];
    return '<option value="">—</option>' + lista.map((e) => `<option value="${esc(e.id)}"${e.id === atual ? ' selected' : ''}>${esc(e.nome)}</option>`).join('');
  }

  function ler(raiz) {
    const f = raiz.querySelector('form');
    const d = { ...reg };
    for (const k of CAMPOS) if (f.elements[k]) d[k] = valorDe(k, f.elements[k].value);
    return d;
  }

  function desenhar(raiz) {
    raiz.innerHTML = `<div class="cab"><div><h1 class="u-titulo">Empresa</h1></div>
        <div class="lado u-apoio">${reg.atualizado_em ? 'Atualizado em ' + esc(new Date(reg.atualizado_em).toLocaleDateString('pt-BR')) : ''}</div></div>
      <form class="eq-ficha" autocomplete="off" novalidate>
        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Identidade</h2>
          <div class="eq-tres">
            ${campo('nome', 'Nome curto')}${campo('nome_completo', 'Nome completo')}${campo('nome_completo_en', 'Nome completo (inglês)')}
          </div></section>

        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Constituição e registros</h2>
          <div class="eq-tres">
            <div class="eq-col">${campo('razao_social', 'Razão social')}${campo('cnpj', 'CNPJ', { ph: '00.000.000/0000-00' })}${campo('fundacao', 'Fundação', { ph: 'AAAA' })}</div>
            <div class="eq-col">${campo('inscricao_municipal', 'Inscrição municipal')}${campo('inscricao_estadual', 'Inscrição estadual', { dica: 'Só se o Odisse Objetos vender com o mesmo CNPJ.' })}
              ${campo('registro_cau', 'Registro no CAU (pessoa jurídica)')}</div>
            <div class="eq-col"><label class="u-campo"><span>Capital social (R$)</span><input name="capital_social" inputmode="decimal" value="${esc(reais(reg.capital_social))}" placeholder="0,00">
                <small>Alguns editais pedem um mínimo.</small></label>
              <label class="u-campo"><span>Responsável técnico no CAU</span><select name="responsavel_tecnico_id" data-rt>${opcoesRT()}</select>
                <small>Quem responde pela PJ no CAU. Só aparece quem tem registro na Equipe.</small></label>
              <small class="u-apoio">Estes dados ficam só no Universo (contratos, documentos e editais); não vão para o site.</small></div>
          </div>
          <div class="cre-docs"><span class="u-rotulo">Documentos</span><div data-docs="constituicao"></div></div></section>

        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Contato e sede</h2>
          <div class="eq-tres">
            <div class="eq-col">${campo('email', 'E-mail', { tipo: 'email' })}${campo('telefone', 'Telefone', { tipo: 'tel', dica: 'O WhatsApp sai deste número.' })}</div>
            <div class="eq-col">${campo('logradouro', 'Logradouro, número e sala')}${campo('bairro', 'Bairro')}
              <div class="emp-cidade">${campo('cidade', 'Cidade')}${campo('uf', 'UF', { lista: UFS })}${campo('cep', 'CEP')}</div>
              ${campo('caixa_postal', 'Caixa postal')}</div>
            <div><span class="u-rotulo">Como sai no contrato</span>
              <div class="eq-folha"><p class="emp-qualif" data-qualif></p></div>
              <small class="u-apoio">Qualificação da contratada. O sócio que assina vem da Equipe.</small></div>
          </div>
          <div class="cre-docs"><span class="u-rotulo">Documentos da sede</span><div data-docs="sede"></div></div></section>

        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Dados bancários <span data-falta-banco></span></h2>
          <div data-aviso-banco></div>
          <div class="eq-tres">
            <div class="eq-col">${campo('banco', 'Banco', { ph: 'Nome e código (ex.: BS2 – 218)' })}${campo('agencia', 'Agência')}</div>
            <div class="eq-col">${campo('conta', 'Conta corrente', { ph: '000000-0' })}${campo('pix', 'Chave PIX', { dica: 'De preferência o CNPJ.' })}</div>
            <div><span class="u-rotulo">Como sai no contrato</span>
              <div class="eq-folha"><p class="emp-qualif" data-banco></p></div>
              <small class="u-apoio">Ficam só no Universo: não vão para o site nem para a cópia pública da Marca.</small></div>
          </div></section>

        <section class="u-cartao eq-sec"><h2 class="u-subtitulo">Textos de apresentação</h2>
          ${TAMANHOS.map(([k, nome, max, uso]) => `<div class="eq-tres emp-texto">
            <div class="emp-texto-rot"><b>${nome}</b><span class="u-apoio">Até ${max} caracteres. ${uso}</span></div>
            ${texto(k, max, false)}${texto(k, max, true)}</div>`).join('')}
          <small class="u-apoio">O site lê estes textos da cópia pública na Marca. O curto também é a descrição da marca.</small></section>

        <div class="barra-salvar" data-barra hidden><span class="u-apoio" data-conta-mud></span><div data-msg></div>
          <button type="button" class="u-botao" data-acao="descartar">Descartar</button>
          <button type="submit" class="u-botao forte">Salvar</button></div>
      </form>`;
    const f = raiz.querySelector('form');
    const atualizar = () => {
      const d = ler(raiz);
      raiz.querySelector('[data-qualif]').textContent = qualificacao(d);
      const faltam = faltamBancarios(d);
      raiz.querySelector('[data-falta-banco]').innerHTML = faltam.length ? '<span class="etq etq--atencao">a preencher</span>' : '';
      raiz.querySelector('[data-aviso-banco]').innerHTML = faltam.length
        ? `<p class="emp-aviso">O contrato precisa destes dados para o pagamento dos honorários. Falta: ${esc(faltam.join(', '))}.</p>` : '';
      raiz.querySelector('[data-banco]').textContent = `O pagamento será feito por depósito, transferência ou PIX em favor de ${d.razao_social || d.nome_completo || '[razão social]'}`
        + `, CNPJ ${d.cnpj || '[CNPJ]'}: banco ${d.banco || '[banco]'}, agência ${d.agencia || '[agência]'}, conta corrente ${d.conta || '[conta]'}`
        + `; chave PIX ${d.pix || '[chave PIX]'}.`;
      const barra = raiz.querySelector('[data-barra]');
      barra.hidden = !sujo.size;
      raiz.querySelector('[data-conta-mud]').textContent = `${sujo.size} ${sujo.size === 1 ? 'mudança' : 'mudanças'} não salvas`;
    };
    const mudou = (ev) => {
      const k = ev.target.name; if (!k || !CAMPOS.includes(k)) return;
      if (valorDe(k, ev.target.value) === (reg[k] ?? null)) sujo.delete(k); else sujo.add(k);
      const conta = raiz.querySelector(`[data-conta="${k}"]`);
      if (conta) conta.textContent = `${ev.target.value.length} / ${ev.target.maxLength}`;
      atualizar();
    };
    f.addEventListener('input', mudou);
    f.addEventListener('change', mudou);
    // documentos: gravam sozinhos pela Gaveta (fora da Barra de salvar)
    cred?.montar(raiz.querySelector('[data-docs="constituicao"]'), 'constituicao', ID);
    cred?.montar(raiz.querySelector('[data-docs="sede"]'), 'sede', ID);
    f.addEventListener('keydown', (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') { ev.preventDefault(); f.requestSubmit(); } });
    raiz.querySelector('[data-acao="descartar"]').addEventListener('click', () => { sujo = new Set(); desenhar(raiz); });
    f.addEventListener('submit', async (ev) => { ev.preventDefault(); await salvar(raiz); });
    atualizar();
  }

  async function salvar(raiz) {
    if (!sujo.size) return;
    const msg = raiz.querySelector('[data-msg]');
    const d = ler(raiz);
    const corpo = { versao: reg.versao };
    for (const k of sujo) corpo[k] = d[k];
    const botao = raiz.querySelector('[type="submit"]'); botao.disabled = true;
    try {
      const r = await api(`/api/v1/empresa/${ID}`, { method: 'PATCH', body: JSON.stringify(corpo) });
      if (r.status === 409) { msg.innerHTML = '<p class="erro">Os dados mudaram em outro lugar. Recarregue a página e refaça a mudança.</p>'; return; }
      if (r.status >= 400) { msg.innerHTML = `<p class="erro">Não foi possível salvar: ${esc(r.erro || r.status)}</p>`; return; }
      const publico = [...sujo].some((k) => PUBLICOS.has(k));
      reg = r.registro; gravarCopia(COPIA, reg); sujo = new Set();
      let aviso = 'Salvo.';
      if (publico) aviso = (await espelhar()) || 'Salvo, e a cópia pública da Marca foi atualizada (o site muda em cerca de um minuto).';
      desenhar(raiz);
      toque(aviso.startsWith('Salvo') ? 'Salvo' : 'Salvo no Universo');
      if (!aviso.startsWith('Salvo')) raiz.querySelector('[data-msg]').innerHTML = `<p class="erro">${esc(aviso)}</p>`;
    } finally { botao.disabled = false; }
  }

  // cópia pública: o odisse.json da Marca (o hub faz o commit pelo servidor, como na página Marca)
  async function espelhar() {
    const atual = await api('/api/marca');
    if (atual.status !== 200 || !atual.dados) return 'Salvo no Universo, mas a cópia pública da Marca não foi atualizada (sem acesso à Marca).';
    const d = structuredClone(atual.dados);
    d.nome = reg.nome || d.nome;
    d.nome_completo = reg.nome_completo || d.nome_completo;
    d.nome_completo_en = reg.nome_completo_en || '';
    d.descricao = reg.texto_curto || d.descricao;
    d.descricao_en = reg.texto_curto_en || '';
    d.contato = { ...d.contato, email: reg.email || d.contato.email, telefone: reg.telefone || d.contato.telefone };
    d.endereco = { ...d.endereco, logradouro: reg.logradouro || '', bairro: reg.bairro || '', cidade: reg.cidade || '', uf: reg.uf || '',
      cep: reg.cep || '', caixa_postal: reg.caixa_postal || '' };
    d.textos = Object.fromEntries(TAMANHOS.flatMap(([k]) => [[k, reg['texto_' + k] || ''], [k + '_en', reg['texto_' + k + '_en'] || '']]));
    const r = await api('/api/marca', { method: 'PUT', body: JSON.stringify({ dados: d, sha: atual.sha }) });
    if (r.status !== 200) return `Salvo no Universo, mas a cópia pública da Marca não foi atualizada: ${r.error || r.status}.`;
    if (r.dados) gravarOdisse(r.dados);
    return null;
  }

  return {
    async ligar(raiz) {
      sujo = new Set();
      cred?.carregar().then(() => {
        const sel = raiz.isConnected && raiz.querySelector('[data-rt]');
        if (sel && !sujo.has('responsavel_tecnico_id')) sel.innerHTML = opcoesRT();
      });
      const copia = lerCopia(COPIA);
      if (copia) { reg = copia; desenhar(raiz); } else raiz.innerHTML = '<p class="u-apoio">Carregando…</p>';
      const r = await api(`/api/v1/empresa/${ID}`);
      const novo = r.registro || r;
      if (r.status !== 200 || !novo?.id) { if (!copia) raiz.innerHTML = `<p class="erro">Não foi possível ler os dados da empresa (${esc(r.erro || r.status)}).</p>`; return; }
      gravarCopia(COPIA, novo);
      if (!raiz.isConnected || sujo.size) return;
      if (!copia || JSON.stringify(copia) !== JSON.stringify(novo)) { reg = novo; desenhar(raiz); }
    },
  };
}
