#!/usr/bin/env python3
"""Põe o número de versão (?v=<hash do conteúdo>) nos arquivos .js e .css do site, nas páginas .html e
nos .js que carregam outros arquivos (pdf.js → fonts-inter.js).

O service worker (sw.js) guarda para sempre cada arquivo versionado: o endereço só muda quando o conteúdo
muda. Por isso, rode isto antes de cada commit que mexa em .js ou .css:

    python3 tools/versionar.py            # atualiza
    python3 tools/versionar.py --conferir # só confere (o GitHub Actions usa; falha se faltar atualizar)
"""
import hashlib, pathlib, re, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
REF = re.compile(r'''(?P<a>(?:src|href)=["']|['"])(?P<arq>[\w\-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(?P<b>["'])''')
NUNCA = {'sw.js'}  # o service worker não pode ser versionado (o navegador o procura sempre no mesmo endereço)


def hash_de(nome):
    return hashlib.sha1((RAIZ / nome).read_bytes()).hexdigest()[:10]


def trocar(texto):
    def sub(m):
        arq = m.group('arq')
        if arq in NUNCA or not (RAIZ / arq).is_file():
            return m.group(0)
        return f"{m.group('a')}{arq}?v={hash_de(arq)}{m.group('b')}"
    return REF.sub(sub, texto)


def main():
    conferir = '--conferir' in sys.argv
    mudou = []
    # primeiro os .js que citam outros (o hash deles muda junto), depois as páginas
    alvos = [RAIZ / 'pdf.js'] + sorted(RAIZ.glob('*.html'))
    for p in alvos:
        antes = p.read_text(encoding='utf-8')
        depois = trocar(antes)
        if depois != antes:
            mudou.append(p.name)
            if not conferir:
                p.write_text(depois, encoding='utf-8')
    if conferir and mudou:
        print('Versões desatualizadas em:', ', '.join(mudou), '— rode python3 tools/versionar.py e faça o commit.')
        sys.exit(1)
    print('atualizados:' if not conferir else 'conferidos', ', '.join(mudou) or 'nada a mudar')


main()
