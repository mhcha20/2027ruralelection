# 2027ruralelection

Q&A website over the Hong Kong EAC 2027 Rural Representative Election guidelines (鄉郊代表選舉活動指引).

- Source: https://www.eac.hk/tc/elections/rural/rr_guide.html (PDFs at https://www.eac.hk/pdf/village/ch/<name>.pdf)
- `data/pdf/` — original PDFs (prologue, chap01–19, appendix01–14, etc.), kept so the document is always available offline.
- `data/titles.json` — PDF filename → Chinese title.
- `data/chunks.json` — searchable passages (built by `python3 scripts/build_chunks.py`, needs `pymupdf`).
- `server.js` — zero-dependency Node server: `/api/search`, `/api/ask` (Claude if `ANTHROPIC_API_KEY` set), static `public/`.
- Deployed on Railway project `2027ruralelection` (service `web`, auto-deploys from `main`): https://web-production-81c64.up.railway.app
- Answer only from the guideline text, in Traditional Chinese, and cite chapter/page. If the guideline is updated on eac.hk, re-download the PDFs and rebuild chunks.
