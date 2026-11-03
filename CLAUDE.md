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
- `public/redact.html` — 提名表格遮蓋工具 (client-side only; files never uploaded). Templates in `public/redact-templates.json` (IIR/ReR/KFR, page → boxes as page fractions), derived from the redacted samples on nomination_guide slides 134–145. 14 items to redact per slide 133. Users can save adjusted box positions as shared templates: stored server-side via `/api/templates` (GET / PUT :key / DELETE :key, no auth) in `$TEMPLATES_DIR/my-templates.json`; on Railway a volume `templates` is mounted at `/data` with `TEMPLATES_DIR=/data`. Old localStorage templates auto-migrate to the server on first load. JSON export/import still available. Export rasterises pages (pdf.js + jsPDF from cdnjs) so hidden text can't be recovered.
- `data/forms/FR_nomination_form_2026_STDO.docx` — blank 漁民代表 (FR) nomination form, election 2026-12-20, supplied by user. FR template (page numbers per the form footer, 1–8) measured from a LibreOffice render; Word/print layout may differ slightly. FR subscriber table only has HKID column. Redaction items for FR assumed same as IIR (full address) — not in the guide deck.
- `public/dates.html` — 重要日子一覽 timeline (provisional, compiled from nomination_guide + EAC guide; each row cites source page). Edit the `E` array in the file to add dates.
- Reply to the user in Cantonese (廣東話).
