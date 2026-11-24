// Carrega todas as tabelas de referência (data/*.json) uma vez, no início.
const OdisseData = (() => {
  const FILES = {
    tipologias: 'data/tipologias.json',
    cub: 'data/cub.json',
    fatorPercentual: 'data/fator-percentual.json',
    redutorRepeticao: 'data/redutor-repeticao.json',
    icCriterios: 'data/ic-criterios.json',
    reducaoEscopo: 'data/reducao-escopo.json',
    jurosParcelamento: 'data/juros-parcelamento.json',
    etapasPagamento: 'data/etapas-pagamento.json',
    etapas: 'data/etapas.json',
    pesosEtapas: 'data/pesos-etapas.json',
    assessoramento: 'data/assessoramento.json',
    servicosOdisse: 'data/servicos-odisse.json',
    despesasReembolsaveis: 'data/despesas-reembolsaveis.json'
  };

  let cache = null;
  // Impressão digital de cada tabela (12 primeiros caracteres do SHA-256 do arquivo):
  // vai nas referências de cada proposta, para saber com que versão das tabelas ela foi calculada.
  const impressoes = {};

  async function sha(texto) {
    if (!(window.crypto && crypto.subtle)) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
  }

  // Cópia local dos arquivos (localStorage): abre na hora com a última cópia e confere por baixo
  // (o robô do CUB muda cub.json todo mês; a cópia nova vale a partir da próxima abertura).
  const CHAVE = 'vendas:dados';
  const lerTudo = () => { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (_) { return null; } };
  const gravarTudo = (t) => { try { localStorage.setItem(CHAVE, JSON.stringify(t)); } catch (_) { /* cheio */ } };

  async function baixar(fresco) {
    const textos = {};
    await Promise.all(Object.entries(FILES).map(async ([key, path]) => {
      const res = await fetch(path, fresco ? { cache: 'no-cache' } : undefined);
      if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
      textos[key] = await res.text();
    }));
    return textos;
  }
  async function montar(textos) {
    for (const [key, path] of Object.entries(FILES)) impressoes[path] = await sha(textos[key]).catch(() => null);
    return Object.fromEntries(Object.entries(textos).map(([k, t]) => [k, JSON.parse(t)]));
  }

  async function load() {
    if (cache) return cache;
    const guardado = lerTudo();
    if (guardado && Object.keys(FILES).every((k) => k in guardado)) {
      cache = await montar(guardado);
      baixar(true).then((novo) => { if (JSON.stringify(novo) !== JSON.stringify(guardado)) gravarTudo(novo); }).catch(() => {});
      return cache;
    }
    const textos = await baixar(false);
    gravarTudo(textos);
    cache = await montar(textos);
    return cache;
  }

  return { load, impressoes: () => ({ ...impressoes }) };
})();
