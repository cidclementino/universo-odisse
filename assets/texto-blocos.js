// Texto do editor → blocos do montador da Marca (marca.odisse.com.br/v1/documentos).
// Um formato só para todos os documentos do Universo; as ferramentas que montam o conteúdo por código
// (vendas, Projetos) mandam os blocos direto, no mesmo formato.
//
// Marcas, sempre no começo da linha:
//   (linha em branco)      separa parágrafos; linhas seguidas viram um parágrafo só
//   # Título               seção
//   - item  ou  • item     lista com travessão (linhas seguidas)
//   1. item  ou  1) item   lista numerada (a numeração sai em ordem, qualquer que seja o número digitado)
//   | a | b | c |          tabela (linhas seguidas). Se a 2ª linha for |---|---|, a 1ª é o cabeçalho;
//                          `---:` alinha à direita, `:---:` ao centro. Outra linha |---| antes da última
//                          faz da última a linha de total.
//   > texto                nota (texto pequeno)
//   **texto**              parágrafo inteiro em negrito

const SEP = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const celulas = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const alinhar = (c) => { c = c.trim(); return c.startsWith(':') && c.endsWith(':') ? 'centro' : c.endsWith(':') ? 'direita' : 'esquerda'; };
const ITEM = /^\s*[-•–]\s+/;
const NUM = /^\s*\d+[.)]\s+/;

function tabela(linhas) {
  let cab = null, alinh = [], total = null;
  let corpo = linhas;
  if (corpo.length > 1 && SEP.test(corpo[1])) {
    cab = celulas(corpo[0]); alinh = celulas(corpo[1]).map(alinhar); corpo = corpo.slice(2);
  }
  const sep = corpo.findIndex((l) => SEP.test(l));
  if (sep >= 0) {
    const depois = corpo.slice(sep + 1).filter((l) => !SEP.test(l));
    total = depois.length ? celulas(depois[depois.length - 1]) : null;
    corpo = [...corpo.slice(0, sep), ...depois.slice(0, -1)];
  }
  const rows = corpo.filter((l) => !SEP.test(l)).map(celulas);
  const n = Math.max(cab?.length || 0, alinh.length, ...rows.map((r) => r.length), total?.length || 0);
  const colunas = Array.from({ length: n }, (_, i) => ({ titulo: cab?.[i] || '', alinhar: alinh[i] || 'esquerda' }));
  const b = { tipo: 'tabela', colunas, linhas: rows };
  if (total) b.total = total;
  return b;
}

export function textoEmBlocos(texto) {
  const linhas = String(texto || '').replace(/\r/g, '').split('\n');
  const out = [];
  let par = [];
  const fechaPar = () => {
    if (!par.length) return;
    const t = par.join(' ').replace(/\s+/g, ' ').trim();
    par = [];
    if (!t) return;
    const m = t.match(/^\*\*(.+)\*\*$/);
    out.push(m ? { tipo: 'paragrafo', texto: m[1].trim(), negrito: true } : t);
  };
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (!l.trim()) { fechaPar(); continue; }
    if (/^\s*#\s+/.test(l)) { fechaPar(); out.push({ tipo: 'secao', texto: l.replace(/^\s*#+\s+/, '').trim() }); continue; }
    if (/^\s*>\s?/.test(l)) {
      fechaPar();
      const nota = [];
      while (i < linhas.length && /^\s*>\s?/.test(linhas[i])) nota.push(linhas[i++].replace(/^\s*>\s?/, '').trim());
      i--;
      out.push({ tipo: 'nota', texto: nota.join(' ').trim() });
      continue;
    }
    if (/^\s*\|/.test(l)) {
      fechaPar();
      const t = [];
      while (i < linhas.length && /^\s*\|/.test(linhas[i])) t.push(linhas[i++]);
      i--;
      out.push(tabela(t));
      continue;
    }
    const lista = ITEM.test(l) ? ITEM : NUM.test(l) ? NUM : null;
    if (lista) {
      fechaPar();
      const itens = [];
      while (i < linhas.length && linhas[i].trim()) {
        if (lista.test(linhas[i])) itens.push(linhas[i].replace(lista, '').trim());
        else if (/^\s+\S/.test(linhas[i]) && itens.length) itens[itens.length - 1] += ' ' + linhas[i].trim(); // continuação recuada
        else break;
        i++;
      }
      i--;
      out.push(lista === NUM ? { tipo: 'lista', numerada: true, itens } : { tipo: 'lista', itens });
      continue;
    }
    par.push(l);
  }
  fechaPar();
  return out;
}
