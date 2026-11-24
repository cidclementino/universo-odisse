#!/usr/bin/env python3
"""
Atualiza data/cub.json com os valores mais recentes do CUB publicado pelo
Sinduscon João Pessoa (sindusconjp.com.br).

Roda mensalmente via .github/workflows/update-cub.yml. Como o layout do PDF
pode mudar sem aviso, este script NUNca sobrescreve o arquivo em silêncio: se
não conseguir localizar a lista de páginas com confiança, ele escreve um
aviso em data/cub-status.json e encerra sem tocar em cub.json — aí a
atualização vira manual até alguém revisar.

Uso: python3 scripts/update_cub.py
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

INDEX_URL = "https://sindusconjp.com.br/pesquisas-e-indices/"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CUB_JSON = DATA_DIR / "cub.json"
STATUS_JSON = DATA_DIR / "cub-status.json"

# Mapeia o "Código" da nossa tabela para os textos que aparecem nas linhas
# do PDF do Sinduscon-JP (a nomenclatura deles usa os códigos padrão da
# NBR 12.721 — R1-B, R1-N, R1-A, PP4-B, PP4-N, R8-B, R8-N, R8-A, PIS, RP1Q,
# R16-N, R16-A, CAL8-N, CAL8-A, CSL8-N, CSL8-A, CSL16-N, CSL16-A, GI).
CODIGOS = ["R-1-B", "R-1-N", "R-1-A", "PP-4-B", "PP-4-N", "R-8-B", "R-8-N",
           "R-8-A", "PIS", "RP1Q", "R-16-N", "R-16-A", "CAL-8-N", "CAL-8-A",
           "CSL-8-N", "CSL-8-A", "CSL-16-N", "CSL-16-A", "GI"]


def escrever_status(ok, mensagem, detalhes=None):
    STATUS_JSON.write_text(json.dumps({
        "ok": ok,
        "mensagem": mensagem,
        "detalhes": detalhes or {},
        "verificado_em": datetime.now(timezone.utc).isoformat()
    }, ensure_ascii=False, indent=2), encoding="utf-8")


def encontrar_pdf_mais_recente():
    resp = requests.get(INDEX_URL, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    links = [a["href"] for a in soup.find_all("a", href=True) if a["href"].lower().endswith(".pdf")]
    # Prioriza links cujo texto/href contenha "CUB-PB" e não "desonerado"
    candidatos = [l for l in links if "cub" in l.lower() and "deson" not in l.lower()]
    if not candidatos:
        return None
    return candidatos[0]


def extrair_tabela_pdf(pdf_bytes):
    """Tenta extrair pares (código, honerado, desonerado) do texto do PDF.
    Retorna None se não achar nada com confiança suficiente."""
    try:
        import pdfplumber
        import io
        valores = {}
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            texto_completo = "\n".join(page.extract_text() or "" for page in pdf.pages)
        for codigo in CODIGOS:
            # procura uma linha contendo o código seguido de dois números decimais
            padrao = re.escape(codigo) + r"\s+([\d.,]+)\s+([\d.,]+)"
            m = re.search(padrao, texto_completo)
            if m:
                valores[codigo] = {
                    "honerado": float(m.group(1).replace(".", "").replace(",", ".")),
                    "desonerado": float(m.group(2).replace(".", "").replace(",", "."))
                }
        return valores if len(valores) >= len(CODIGOS) // 2 else None
    except Exception as e:
        print(f"Erro ao extrair PDF: {e}", file=sys.stderr)
        return None


def main():
    try:
        pdf_url = encontrar_pdf_mais_recente()
        if not pdf_url:
            escrever_status(False, "Não encontrei nenhum link de PDF de CUB na página do Sinduscon-JP. Verifique manualmente.")
            return

        if not pdf_url.startswith("http"):
            pdf_url = "https://sindusconjp.com.br" + pdf_url

        resp = requests.get(pdf_url, timeout=30)
        resp.raise_for_status()

        valores = extrair_tabela_pdf(resp.content)
        if not valores:
            escrever_status(False, f"Baixei o PDF ({pdf_url}) mas não consegui extrair a tabela com confiança. Layout pode ter mudado — atualize manualmente.", {"pdf_url": pdf_url})
            return

        cub_atual = json.loads(CUB_JSON.read_text(encoding="utf-8"))
        regiao = cub_atual["regioes"][cub_atual["regiao_ativa"]]
        for codigo, vals in valores.items():
            if codigo in regiao["tabela"]:
                regiao["tabela"][codigo]["honerado"] = vals["honerado"]
                regiao["tabela"][codigo]["desonerado"] = vals["desonerado"]
        regiao["fonte"] = "Sinduscon-JP"
        regiao["competencia_referencia"] = f"Atualizado automaticamente em {datetime.now(timezone.utc).date().isoformat()}"
        regiao["pdf_origem"] = pdf_url

        CUB_JSON.write_text(json.dumps(cub_atual, ensure_ascii=False, indent=2), encoding="utf-8")
        escrever_status(True, f"CUB atualizado com sucesso a partir de {pdf_url}", {"codigos_atualizados": list(valores.keys())})
        print("CUB atualizado com sucesso.")

    except Exception as e:
        escrever_status(False, f"Erro inesperado ao atualizar o CUB: {e}")
        print(f"Erro: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
