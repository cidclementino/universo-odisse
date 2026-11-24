#!/usr/bin/env python3
"""Numera os arquivos do site para o cache: rode antes de cada commit que mude JS ou CSS.

Escreve em index.html, entre os marcadores VERSOES, o import map com cada módulo de assets/js
apontando para "arquivo.js?v=<hash do conteúdo>", e põe ?v= nos <link> de CSS, nos scripts de
vendor/ e no app.js. Só muda o número dos arquivos que mudaram: o resto segue no cache do navegador
(service worker, sw.js).
"""
import hashlib, json, pathlib, re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
INDEX = RAIZ / 'index.html'

def h(p):
    return hashlib.sha1(p.read_bytes()).hexdigest()[:10]

def rel(p):
    return p.relative_to(RAIZ).as_posix()

modulos = sorted((RAIZ / 'assets' / 'js').rglob('*.js'))
mapa = {f'./{rel(p)}': f'./{rel(p)}?v={h(p)}' for p in modulos}
bloco = ('<!-- VERSOES (gerado por tools/versionar.py — não editar à mão) -->\n'
         '  <script type="importmap">\n  '
         + json.dumps({'imports': mapa}, indent=2, ensure_ascii=False).replace('\n', '\n  ')
         + '\n  </script>\n  <!-- /VERSOES -->')

s = INDEX.read_text(encoding='utf-8')
if '<!-- VERSOES' in s:
    s = re.sub(r'<!-- VERSOES.*?<!-- /VERSOES -->', lambda m: bloco, s, flags=re.S)
else:
    s = s.replace('<link rel="stylesheet" href="assets/css/card.css', bloco + '\n  <link rel="stylesheet" href="assets/css/card.css', 1)

def versiona(m):
    attr, caminho = m.group(1), m.group(2)
    p = RAIZ / caminho
    return f'{attr}="{caminho}?v={h(p)}"' if p.exists() else m.group(0)

s = re.sub(r'(href|src)="((?:assets/css|vendor)/[^"?]+|assets/js/app\.js)(?:\?v=[^"]*)?"', versiona, s)
INDEX.write_text(s, encoding='utf-8')
print(f'{len(mapa)} módulos e {len(re.findall(r"\\?v=", s)) - len(mapa)} arquivos numerados.')
