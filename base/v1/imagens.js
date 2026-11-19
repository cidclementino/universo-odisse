// Imagens do Universo: o mesmo sistema do odisse.com.br (dados.md § 9).
// Conversão no navegador para WebP 0,82 (ou JPEG 0,86 onde o navegador não gera WebP), em três tamanhos pelo
// lado maior: 2400 (g), 1200 (m) e 960 px (s). O original não sobe: os brutos ficam no Drive.
//
//   import { prepararImagem } from 'https://universo.odisse.com.br/base/v1/imagens.js';
//   const { g, m, s, sha256, largura, altura, tipo } = await prepararImagem(arquivo);
//   // g/m/s = { blob, w, h }; sha256 = da versão grande (é ela que identifica a mídia no acervo)

export const MAX_IMAGEM = 20 * 1024 * 1024;
export const TAMANHOS = { g: 2400, m: 1200, s: 960 };

export async function reduzir(bmp, max) {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  let blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.82));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
  return { blob, w, h };
}

export const sha256 = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

export async function prepararImagem(arquivo) {
  if (arquivo.size > MAX_IMAGEM * 4) throw new Error('arquivo grande demais');
  const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  try {
    const g = await reduzir(bmp, TAMANHOS.g);
    const m = await reduzir(bmp, TAMANHOS.m);
    const s = await reduzir(bmp, TAMANHOS.s);
    if (g.blob.size > MAX_IMAGEM) throw new Error('imagem grande demais mesmo reduzida (máximo 20 MB)');
    return { g, m, s, sha256: await sha256(g.blob), largura: g.w, altura: g.h, tipo: g.blob.type };
  } finally {
    bmp.close?.();
  }
}
