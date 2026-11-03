# 2027ruralelection

Q&A website over the Hong Kong EAC 2027 Rural Representative Election guidelines (鄉郊代表選舉活動指引).

- Source: https://www.eac.hk/tc/elections/rural/rr_guide.html (PDFs at https://www.eac.hk/pdf/village/ch/<name>.pdf)
- `data/pdf/` — original PDFs (prologue, chap01–19, appendix01–14, etc.), kept so the document is always available offline.
- `data/titles.json` — PDF filename → Chinese title.
- `data/chunks.json` — searchable passages (built by `python3 scripts/build_chunks.py`, needs `pymupdf`).
- `server.js` — zero-dependency Node server: `/api/search`, `/api/ask` (Claude if `ANTHROPIC_API_KEY` set), static `public/`.
- Deployed on Railway project `2027ruralelection` (service `web`, auto-deploys from `main`): https://web-production-81c64.up.railway.app
- Answer only from the guideline text, in Traditional Chinese, and cite chapter/page. If the guideline is updated on eac.hk, re-download the PDFs and rebuild chunks.
- `data/pdf/nomination_guide.pdf` (also served at `/docs/nomination_guide.pdf`) — 2027 鄉郊一般選舉候選人提名指引 slide deck (Oct 2026, 158 pages) supplied by the user; original/uploaded, not from eac.hk. Covers nomination forms (IIR etc.), election dates (原居民/居民代表 2027-01-17, 街坊代表 2027-01-24).
- `public/redact.html` — 提名表格遮蓋工具 (client-side only; files never uploaded). Templates in `public/redact-templates.json` (IIR/ReR/KFR, page → boxes as page fractions), derived from the redacted samples on nomination_guide slides 134–145. 14 items to redact per slide 133. Export rasterises pages (pdf.js + jsPDF from cdnjs) so hidden text can't be recovered.
- Reply to the user in Cantonese (廣東話).
