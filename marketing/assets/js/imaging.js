// Leitura de imagens e tratamentos de cada núcleo (manual, seção 08).
// O tratamento é aplicado em pixels, para que a exportação em PNG saia idêntica à tela.

const MAX_LADO = 2400;

function carregar(src) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = erro;
    img.src = src;
  });
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Lê um File e devolve um dataURL reduzido (no máximo 2400 px no lado maior). */
export async function lerArquivo(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await carregar(url);
    const k = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k);
    const h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const png = /png|svg/.test(file.type);
    return { src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Gera uma rampa de 256 cores a partir das paradas do duotone. */
function rampa(paradas) {
  const cores = paradas.map(hexRgb);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (cores.length - 1);
    const a = Math.min(Math.floor(t), cores.length - 2);
    const f = t - a;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = cores[a][c] + (cores[a + 1][c] - cores[a][c]) * f;
  }
  return lut;
}

const cache = new Map();

/** Aplica o tratamento do núcleo. Resultado em cache por (imagem, tratamento). */
export async function tratar(src, tratamento) {
  if (!src || !tratamento || tratamento.tipo === 'nenhum') return src;
  const chave = src.length + ':' + src.slice(-64) + JSON.stringify(tratamento);
  if (cache.has(chave)) return cache.get(chave);

  const img = await carregar(src);
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (tratamento.difusao) ctx.filter = `blur(${(tratamento.difusao * Math.max(w, h)) / 1440}px)`;
  ctx.drawImage(img, 0, 0);
  ctx.filter = 'none';

  const dados = ctx.getImageData(0, 0, w, h);
  const p = dados.data;
  const lut = rampa(tratamento.paradas);
  const grao = (tratamento.grao || 0) * 255;
  // contraste leve antes do mapeamento, como nos posts de referência
  for (let i = 0; i < p.length; i += 4) {
    let l = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
    l = (l - 128) * 1.12 + 128;
    if (grao) l += (Math.random() - 0.5) * grao;
    l = l < 0 ? 0 : l > 255 ? 255 : l | 0;
    p[i] = lut[l * 3];
    p[i + 1] = lut[l * 3 + 1];
    p[i + 2] = lut[l * 3 + 2];
  }
  ctx.putImageData(dados, 0, 0);
  const out = c.toDataURL('image/jpeg', 0.9);
  cache.set(chave, out);
  return out;
}
