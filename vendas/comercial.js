// ==========================================================================
// Comercial — liga o orçamento ao Universo: cliente (contato), oportunidade,
// proposta numerada e PDF congelado. Usado pelo orçamento (steps.js), pelo
// histórico, pelo funil (crm.html) e pela migração das propostas antigas.
//
// Regras:
//   - O endereço da etapa 1 é do IMÓVEL, não do cliente: fica no retrato do
//     cálculo da proposta (e, mais tarde, no local do projeto), nunca nos
//     dados pessoais. Só o CPF vai para os dados sensíveis da pessoa.
//   - O PDF que o cliente recebe é guardado no Universo no momento em que é
//     gerado ("congelado"). Depois disso, valores e cálculo da proposta não
//     mudam mais; para mudar, cria-se uma revisão (PC-0007-2026-R1).
// ==========================================================================

const ETAPAS_FUNIL = [
  { id: 'lead', nome: 'Lead' },
  { id: 'contato', nome: 'Contato' },
  { id: 'briefing', nome: 'Briefing' },
  { id: 'proposta', nome: 'Proposta' },
  { id: 'negociacao', nome: 'Negociação' },
  { id: 'ganha', nome: 'Ganha' },
  { id: 'perdida', nome: 'Perdida' }
];
const ORIGENS = [
  { id: 'indicacao', nome: 'Indicação' },
  { id: 'instagram', nome: 'Instagram' },
  { id: 'site', nome: 'Site' },
  { id: 'landing_page', nome: 'Landing page' },
  { id: 'herma', nome: 'Herma' },
  { id: 'radar', nome: 'Radar' },
  { id: 'outro', nome: 'Outro' }
];
const NUCLEOS = [
  { id: 'arquitetos', nome: 'Arquitetos' },
  { id: 'estudio', nome: 'Estúdio' },
  { id: 'objetos', nome: 'Objetos' },
  { id: 'elaia', nome: 'Elaia' }
];
const SITUACOES_PROPOSTA = [
  { id: 'rascunho', nome: 'Rascunho' },
  { id: 'enviada', nome: 'Enviada' },
  { id: 'aceita', nome: 'Aceita' },
  { id: 'recusada', nome: 'Recusada' },
  { id: 'expirada', nome: 'Expirada' },
  { id: 'substituida', nome: 'Substituída' }
];
const ORDEM_FUNIL = Object.fromEntries(ETAPAS_FUNIL.map((e, i) => [e.id, i]));
const nomeDe = (lista, id) => (lista.find((x) => x.id === id) || {}).nome || id || '—';

const Comercial = (() => {
  const digitos = (s) => String(s || '').replace(/\D/g, '');
  const fmtCpf = (d) => d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;
  const fmtCnpj = (d) => d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;
  const fmtTel = (d) => {
    const n = String(d || '').replace(/^55(?=\d{10,11}$)/, '');
    if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return n;
  };

  // "João Pessoa – PB", "João Pessoa/PB", "João Pessoa - PB" → { cidade, uf }
  function separarCidadeUf(s) {
    const m = String(s || '').trim().match(/^(.*?)\s*[–\-\/,]\s*([A-Za-z]{2})$/);
    if (m) return { cidade: m[1].trim() || null, uf: m[2].toUpperCase() };
    return { cidade: String(s || '').trim() || null, uf: null };
  }

  // Campos opcionais que, se vierem inválidos (telefone incompleto, e-mail torto),
  // são deixados de fora em vez de impedir o cadastro. Rótulo (da API) → campo.
  const ROTULOS = { 'E-mail': 'email', 'Telefone': 'telefone', 'WhatsApp': 'whatsapp', 'CNPJ': 'cnpj', 'UF': 'uf', 'CPF': 'cpf', 'Instagram': 'instagram' };

  // Cria tirando os campos opcionais recusados pela validação; devolve { registro, deixados }.
  async function criarTolerante(rota, corpo) {
    const deixados = [];
    let tentativa = { ...corpo };
    for (let i = 0; i < 4; i++) {
      try {
        return { registro: await Universo.criar(rota, tentativa), deixados };
      } catch (e) {
        if (e.status !== 422 || !e.dados.erros) throw e;
        const tirar = e.dados.erros.map((m) => ROTULOS[m.split(':')[0]]).filter((k) => k && tentativa[k]);
        if (!tirar.length) throw e;
        for (const k of tirar) { deixados.push(`${k}: ${tentativa[k]}`); delete tentativa[k]; }
        if (rota !== 'pessoas-sensiveis') {
          tentativa.observacoes = [tentativa.observacoes, `Dados não aceitos no cadastro automático: ${deixados.join('; ')}`].filter(Boolean).join('\n');
        }
      }
    }
    throw new Error('não consegui cadastrar o contato');
  }

  // Cria um contato tratando duplicados. `perguntar`: mostra confirm() na tela;
  // sem isso (migração), usa o cadastro existente que bate.
  async function criarContato(rota, corpo, { perguntar = true } = {}) {
    try {
      return (await criarTolerante(rota, corpo)).registro;
    } catch (e) {
      if (e.status !== 409 || e.dados.erro !== 'possivel_duplicado') throw e;
      const c = e.dados.candidatos[0];
      const bate = Object.entries(c.campos).filter(([, v]) => v === 'bate').map(([k]) => k).join(', ');
      const usar = !perguntar || confirm(
        `Já existe no Universo um cadastro parecido: "${c.registro.nome}" (mesmo ${bate}).\n\n` +
        `OK = usar esse cadastro\nCancelar = criar um cadastro novo`
      );
      if (usar) return c.registro;
      return (await criarTolerante(rota, { ...corpo, confirmar_novo: true })).registro;
    }
  }

  // Garante o cliente do orçamento no Universo e devolve o id (pes_… ou org_…).
  async function garantirCliente(cliente, { clienteId = null, perguntar = true } = {}) {
    const pj = cliente.representacao === 'PJ';
    let id = clienteId;
    if (!id) {
      if (pj) {
        const { cidade, uf } = separarCidadeUf(cliente.cidadeUf);
        const reg = await criarContato('organizacoes', {
          nome: cliente.nome, cnpj: digitos(cliente.documento) || null, email: cliente.email || null,
          telefone: cliente.telefone || null, cidade, uf
        }, { perguntar });
        id = reg.id;
      } else {
        const reg = await criarContato('pessoas', {
          nome: cliente.nome, email: cliente.email || null,
          telefone: cliente.telefone || null, whatsapp: cliente.telefone || null
        }, { perguntar });
        id = reg.id;
      }
    }
    // CPF da pessoa física: só preenche se ainda não houver (nunca sobrescreve)
    const cpf = digitos(cliente.documento);
    if (id.startsWith('pes_') && !pj && cpf.length === 11) {
      const sens = await Universo.talvez('pessoas-sensiveis', id);
      if (!sens) await criarTolerante('pessoas-sensiveis', { id, cpf });
      else if (!sens.cpf) await Universo.alterar('pessoas-sensiveis', id, { versao: sens.versao, cpf });
    }
    return id;
  }

  // Oportunidade da proposta: usa a ligada ao orçamento (avançando para "proposta" se ainda
  // estiver antes) ou cria uma nova já na etapa "proposta".
  async function garantirOportunidade({ oportunidadeId, clienteId, titulo }) {
    if (oportunidadeId) {
      const o = await Universo.ler('oportunidades', oportunidadeId);
      if (ORDEM_FUNIL[o.etapa_funil] < ORDEM_FUNIL.proposta) {
        await Universo.alterar('oportunidades', o.id, { versao: o.versao, etapa_funil: 'proposta' });
      }
      return o.id;
    }
    const o = await Universo.criar('oportunidades', {
      titulo, cliente_id: clienteId, contato_pessoa_id: clienteId.startsWith('pes_') ? clienteId : null,
      nucleo_id: 'arquitetos', etapa_funil: 'proposta'
    });
    return o.id;
  }

  function nomeServico(state, data) {
    if (state && state.versao === 2) {
      if (state.resumo && state.resumo.servico) return state.resumo.servico;
      const s = typeof Catalogo !== 'undefined' ? Catalogo.servico(state.servicoId) : null;
      return s ? s.nome : 'Proposta';
    }
    const s = ((data && data.servicosOdisse) || []).find((x) => x.id === state.servicoId);
    return s ? s.nome : 'Proposta';
  }

  // O que foi usado no cálculo: CUB (região e competência) e a impressão digital de cada
  // tabela de data/ — se uma tabela mudar depois, dá para saber que esta proposta usou a anterior.
  function referencias(state, data) {
    const regiao = data.cub && data.cub.regioes && data.cub.regioes[data.cub.regiao_ativa];
    return {
      ferramenta: 'vendas.odisse',
      cub: regiao ? { regiao: data.cub.regiao_ativa, fonte: regiao.fonte || null, competencia: regiao.competencia_referencia || null } : null,
      tabelas: (typeof OdisseData !== 'undefined' && OdisseData.impressoes) ? OdisseData.impressoes() : null,
      // versões publicadas no Universo usadas no orçamento (Bases, PGT, Honorários)
      universo: state._versoes || null,
      gerada_em: new Date().toISOString()
    };
  }

  // Retrato do estado do orçamento (o que remonta a proposta). Tira o que é só da tela.
  function retrato(state) {
    const s = { ...state }; delete s._rubricas;
    const r = JSON.parse(JSON.stringify(s));
    delete r._maxUnlocked;
    delete r.numeroPropostaStatus;
    // resumo legível sem o catálogo (PDF remontado, funil, contrato → projeto): o que a proposta promete
    if (state.versao === 2 && typeof resumoProposta === 'function') r.resumo = resumoProposta(state);
    return r;
  }

  // Rubricas (iniciais) de quem assina, lidas da Equipe do Universo só na emissão, ligadas à proposta
  // no histórico. A primeira emissão guarda qual rubrica saiu (rubrica_id); as seguintes pedem a mesma.
  // Devolve { equipe_id: dataURL }. Quem não tem rubrica sai só com o nome.
  async function lerRubricas(state) {
    const urls = {};
    for (const a of state.assinantes || []) {
      if (!a || !a.equipe_id || !a.rubrica || urls[a.equipe_id]) continue;
      const fixa = a.rubrica_id ? `&arquivo=${encodeURIComponent(a.rubrica_id)}` : '';
      try {
        const res = await Universo.bruto(`equipe/${a.equipe_id}/assinatura?uso=proposta&registro=${encodeURIComponent(state._propostaId)}${fixa}`);
        const saiu = res.headers.get('X-Rubrica');
        if (saiu && !a.rubrica_id) a.rubrica_id = saiu;
        const blob = await res.blob();
        urls[a.equipe_id] = await new Promise((ok, erro) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = erro; f.readAsDataURL(blob); });
      } catch (e) { console.warn('rubrica', a.nome, e); }
    }
    return urls;
  }

  // Finalizar: cliente → oportunidade → proposta numerada. Devolve a proposta.
  async function registrarProposta(state, data) {
    const r0 = state._calcResult;
    const servico0 = nomeServico(state, data);
    // revisão só quando continua do mesmo tipo (simulação → simulação, proposta → proposta);
    // uma simulação que vira proposta de verdade ganha número próprio
    const revisaoDe = state._revisaoDe && !!state._revisaoDeSimulacao === !!state._simulacao ? state._revisaoDe : null;
    if (state._simulacao) {
      // simulação: numera, mas não cadastra cliente nem entra no funil
      const corpo = {
        simulacao: 1, titulo: servico0, data: state.dataProposta || null,
        valor_total: r0 ? centavos(r0.valorFinal) : null, calculo: retrato(state), referencias: referencias(state, data)
      };
      if (revisaoDe) corpo.revisao_de = revisaoDe;
      return await Universo.criar('propostas', corpo);
    }
    const clienteId = await garantirCliente(state.cliente, { clienteId: state._clienteId });
    state._clienteId = clienteId;
    const servico = nomeServico(state, data);
    const oportunidadeId = await garantirOportunidade({
      oportunidadeId: state._oportunidadeId, clienteId, titulo: `${servico} — ${state.cliente.nome}`
    });
    state._oportunidadeId = oportunidadeId;
    const r = state._calcResult;
    const corpo = {
      oportunidade_id: oportunidadeId,
      titulo: servico,
      data: state.dataProposta || null,
      valor_total: r ? centavos(r.valorFinal) : null,
      calculo: retrato(state),
      referencias: referencias(state, data)
    };
    if (revisaoDe) corpo.revisao_de = revisaoDe;
    return await Universo.criar('propostas', corpo);
  }

  // Guarda o PDF que vai para o cliente e congela a proposta.
  async function congelarPdf(propostaId, blob, nomeArquivo, legenda = null) {
    const arq = await Universo.enviarArquivo(blob, {
      dono_id: propostaId, nome_original: nomeArquivo, categoria: 'pdf_proposta', legenda
    });
    const p = await Universo.ler('propostas', propostaId);
    return await Universo.alterar('propostas', propostaId, { versao: p.versao, arquivo_pdf_id: arq.id });
  }

  // Baixa o PDF de uma proposta: o congelado, se houver; senão remonta a partir do cálculo.
  async function baixarPdf(proposta, data) {
    if (proposta.arquivo_pdf_id) {
      const blob = await Universo.baixarArquivo(proposta.arquivo_pdf_id);
      baixarBlob(blob, `${proposta.codigo}.pdf`);
      return 'congelado';
    }
    const estado = typeof proposta.calculo === 'string' ? JSON.parse(proposta.calculo) : proposta.calculo;
    if (!estado) throw new Error('esta proposta não tem os dados do cálculo');
    estado.numeroProposta = proposta.codigo;
    estado._simulacao = !!proposta.simulacao;
    await OdissePdf.preparar();
    const { doc, nomeArquivo } = OdissePdf.montar(estado, data);
    doc.save(nomeArquivo);
    return 'remontado';
  }

  // Abre uma proposta no orçamento como revisão (mesmo número, R+1) ou como nova proposta
  // da mesma oportunidade. Grava o rascunho e vai para o editor (index.html#/editor).
  function abrirNoOrcamento(proposta, { comoRevisao = true } = {}) {
    const estado = typeof proposta.calculo === 'string' ? JSON.parse(proposta.calculo) : proposta.calculo;
    if (!estado) { alert('Esta proposta não tem os dados do cálculo para reabrir.'); return; }
    estado.numeroProposta = '';
    estado.numeroPropostaStatus = '';
    estado._propostaId = null;
    estado._pdfCongelado = false;
    estado._oportunidadeId = proposta.oportunidade_id || null;
    estado._simulacao = !!proposta.simulacao;
    estado._revisaoDe = comoRevisao ? proposta.id : null;
    estado._revisaoDeCodigo = comoRevisao ? proposta.codigo : null;
    estado._revisaoDeSimulacao = !!proposta.simulacao;
    // revisão é documento novo: a rubrica sai a atual; o resumo é refeito com o catálogo do momento
    if (Array.isArray(estado.assinantes)) estado.assinantes = estado.assinantes.map(({ rubrica_id, ...a }) => a);
    delete estado.resumo;
    estado.dataProposta = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    localStorage.setItem('odisse-orcamento-rascunho', JSON.stringify({ state: estado, currentStepIndex: 0 }));
    window.location.href = 'index.html#/editor';
  }

  // Novo orçamento já ligado a uma oportunidade (vindo do funil).
  async function novoOrcamentoDaOportunidade(oportunidade) {
    const cliente = { nome: '', email: '', telefone: '', representacao: 'PF', documento: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidadeUf: '' };
    if (oportunidade.cliente_id) {
      const tabela = oportunidade.cliente_id.startsWith('org_') ? 'organizacoes' : 'pessoas';
      const c = await Universo.ler(tabela, oportunidade.cliente_id);
      Object.assign(cliente, { nome: c.nome || '', email: c.email || '', telefone: fmtTel(c.telefone || c.whatsapp) });
      if (tabela === 'organizacoes') {
        cliente.representacao = 'PJ';
        if (c.cnpj) cliente.documento = fmtCnpj(c.cnpj);
      } else {
        const s = await Universo.talvez('pessoas-sensiveis', c.id);
        if (s && s.cpf) cliente.documento = fmtCpf(s.cpf);
      }
    }
    localStorage.setItem('odisse-orcamento-rascunho', JSON.stringify({
      state: { versao: 2, cliente: { nome: cliente.nome, email: cliente.email, telefone: cliente.telefone, representacao: cliente.representacao, documento: cliente.documento }, _oportunidadeId: oportunidade.id, _clienteId: oportunidade.cliente_id || null },
      currentStepIndex: 0
    }));
    window.location.href = 'index.html#/editor';
  }

  // ---- contrato assinado → projeto (Universo, ferramenta Projetos)
  // O Universo cria o projeto ao receber o contrato principal assinado. Daqui vai o que só o vendas
  // sabe ler do cálculo da proposta: etapas (nomes, fases e semanas, na ordem do cronograma),
  // endereço do imóvel (etapa 1 do orçamento), tipologia, área e serviço.
  function dadosDoProjeto(proposta, data, { nome, inicio } = {}) {
    const c = typeof proposta.calculo === 'string' ? JSON.parse(proposta.calculo || 'null') : proposta.calculo;
    const p = { nome: nome || null, inicio: inicio || null, servico: proposta.titulo || null };
    if (!c) return p;
    if (c.versao === 2) {
      const res = c.resumo || {};
      p.etapas = (res.etapas || []).map((e) => ({ nome: e.nome, fase: e.fase || null, ref_vendas: e.id, semanas: e.semanas || null }));
      if (res.servico) p.servico = res.servico;
      if (res.tipologia) p.tipologia = res.tipologia;
      if (c.areaConstruida > 0) p.area_m2 = Number(c.areaConstruida);
      if (!p.nome && c.nomeProjeto) p.nome = c.nomeProjeto;
      const im = c.imovel || {};
      const { cidade, uf } = separarCidadeUf(im.cidadeUf);
      Object.assign(p, { bairro: im.bairro || null, cidade, uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : null });
      const cep = digitos(im.cep);
      p.local = { logradouro: im.logradouro || null, numero: im.numero || null, complemento: im.complemento || null, cep: cep.length === 8 ? cep : null };
      return p;
    }
    const sel = c.etapasSelecionadas || [];
    p.etapas = (data.etapas || []).filter((e) => sel.includes(e.id)).map((e) => ({
      nome: e.nome, fase: e.fase || null, ref_vendas: e.id,
      semanas: (c.etapasSemanas && c.etapasSemanas[e.id]) || e.semanas_base || null
    }));
    if (c.servicoId) p.servico = nomeServico(c, data);
    if (c.tipologiaItem) p.tipologia = c.tipologiaItem.descricao || c.tipologiaItem.item || null;
    if (c.areaConstruida > 0) p.area_m2 = Number(c.areaConstruida);
    const im = c.cliente || {};
    const { cidade, uf } = separarCidadeUf(im.cidadeUf);
    Object.assign(p, { bairro: im.bairro || null, cidade, uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : null });
    const cep = digitos(im.cep);
    p.local = { logradouro: im.logradouro || null, numero: im.numero || null, complemento: im.complemento || null, cep: cep.length === 8 ? cep : null };
    return p;
  }

  // Registra o contrato principal assinado; o Universo cria o projeto, marca a proposta aceita e
  // a oportunidade ganha. `arquivo` (opcional): PDF do contrato assinado, guardado no Universo.
  async function registrarContrato({ proposta, data, assinadoEm, valorTotal, nomeProjeto, inicio, projetoExistente, arquivo }) {
    const corpo = { proposta_id: proposta.id, tipo: 'principal', situacao: 'assinado', assinado_em: assinadoEm, valor_total: valorTotal };
    if (projetoExistente) corpo.projeto_existente = projetoExistente;
    else corpo.projeto = dadosDoProjeto(proposta, data, { nome: nomeProjeto, inicio });
    let ctr = await Universo.criar('contratos', corpo);
    if (arquivo) {
      const arq = await Universo.enviarArquivo(arquivo, { dono_id: ctr.id, nome_original: arquivo.name || `${ctr.codigo}.pdf`, categoria: 'contrato' });
      ctr = await Universo.alterar('contratos', ctr.id, { versao: ctr.versao, arquivo_assinado_id: arq.id });
    }
    return ctr;
  }

  return {
    dadosDoProjeto, registrarContrato,
    fmtTel, fmtCpf, fmtCnpj, separarCidadeUf, criarContato, criarTolerante, garantirCliente, garantirOportunidade, nomeServico,
    referencias, retrato, lerRubricas, registrarProposta, congelarPdf, baixarPdf, abrirNoOrcamento, novoOrcamentoDaOportunidade
  };
})();
