# 2027ruralelection

Q&A website over the Hong Kong EAC 2027 Rural Representative Election guidelines (鄉郊代表選舉活動指引), plus tools for the user's own election-office work (form redaction for public inspection, key-dates timeline).

## How to work with the user
- **Reply in Cantonese (廣東話)**, not written Mandarin. Keep it plain and concrete.
- The user is not a programmer. Explain outcomes, not code. Always say what was tested and what wasn't.
- The user works in a 選舉主任辦事處 / 民政處 context (handles nomination forms, public inspection copies). Treat uploaded forms as sensitive: never commit filled-in forms or personal data to the repo; never put them on the server.
- Always state clearly that compiled material (dates, redaction rules) is provisional and the official EAC/HAD documents prevail.
- Passwords live only in Railway env vars. Never write password values into the repo, commit messages or this file.
- Batch several changes into one push where possible — every deploy used to trigger a "Deploy Crashed" email (fixed, see below) and the user dislikes noise.
- After a push, wait for Railway to redeploy and verify the live URL before telling the user it's done.

## Site
- Live: https://web-production-81c64.up.railway.app — **whole site behind HTTP Basic auth** (env `SITE_PASSWORD`, any username). `/health` stays open. Same password is used for everything; the user wants one password only.
- Pages: `/` 指引問答 (search + Claude answer), `/dates.html` 重要日子一覽, `/redact.html` 提名表格遮蓋工具, `/docs/nomination_guide.pdf`.
- Railway: project `2027ruralelection` (id `18015206-13b4-41bd-b92d-adb4ba5f7ce1`), service `web` (id `9a38927e-9c1f-435a-9680-c11aa52def63`), env `production` (id `6e1df4e1-0db8-4d4f-9575-f877738fc6fa`), auto-deploys from `main`. Volume `templates` mounted at `/data`.
- Env vars on the service: `SITE_PASSWORD`, `TEMPLATES_PASSWORD`, `TEMPLATES_DIR=/data`, `ANTHROPIC_API_KEY` (set by the user, enables AI answers).
- `railway.json`: startCommand `node server.js`, healthcheck `/health`. `server.js` handles SIGTERM with exit 0. Before this, every redeploy emailed the user "Deploy Crashed" (old container stopped under `npm start` → SIGTERM reported as failure). Deployments were in fact always SUCCESS.

## Code layout
- `server.js` — zero-dependency Node server: static `public/`, `/api/search` (bigram keyword search over chunks, title boost, appendix down-weight), `/api/ask` (Claude via `ANTHROPIC_API_KEY`, answers only from retrieved passages, cites [n]), `/api/templates` (GET open; PUT/DELETE :key; when `SITE_PASSWORD` is set Basic auth suffices, otherwise header `x-password` = `TEMPLATES_PASSWORD`), `/docs/<file>.pdf` serves `data/pdf/`.
- `data/pdf/` — all source PDFs (EAC guide prologue, chap01–19, appendix01–14, important, abbr, supplementary_sheet, related_websites, plus `nomination_guide.pdf`). Kept in git so documents survive offline.
- `data/titles.json` — PDF key → Chinese title. `data/chunks.json` — search passages, built by `python3 scripts/build_chunks.py` (needs `pymupdf`; poppler `pdftotext` lacks CJK fonts here, don't use it).
- `data/forms/FR_nomination_form_2026_STDO.docx` — blank 漁民代表 form supplied by user.
- `public/redact-templates.json` — built-in redaction templates (IIR / ReR / KFR / FR): page → boxes as fractions of page width/height.
- `data/my-templates.json` (git-ignored; on Railway at `/data/my-templates.json`) — user-saved templates.

## Documents the user asked me to "remember"
1. EAC 《鄉郊代表選舉活動指引》 — https://www.eac.hk/tc/elections/rural/rr_guide.html (PDFs at https://www.eac.hk/pdf/village/ch/<name>.pdf). If updated on eac.hk, re-download and rebuild chunks.
2. `nomination_guide.pdf` — HAD 「2027年鄉郊一般選舉候選人提名指引」 slide deck, Oct 2026, 158 pages, uploaded by user (internal, not on eac.hk). Key content: nomination period 2026-11-24 → 2026-12-07 17:00; election days 原居民/居民代表 2027-01-17, 街坊代表 2027-01-24; slide 133 = the 14 personal-data items to cover before public inspection; slides 134–145 = officially redacted sample forms (IIR/ReR/KFR) that the built-in templates were measured from.
3. FR nomination form (docx above) — election 2026-12-20. Redaction rules for FR are **not** in the deck; I assumed same as IIR (full address covered). User has not confirmed.

## Redaction tool (`public/redact.html`) — decisions made with the user
- Form files are processed **only in the browser**; nothing uploaded. Export rasterises each page (pdf.js → canvas → jsPDF, cdnjs) so covered text cannot be recovered. The page header must keep saying exactly this; the user checked the wording.
- Boxes are solid black while editing (user asked for darker). Red labels show item numbers.
- Workflow: upload PDF/images → pick template → 「套用範本」 → adjust (drag to add, drag box to move, corner handle to resize, Delete) → 「儲存為我的範本」 → 「下載已遮蓋 PDF」.
- Saved templates are **shared server-side** so they appear on every computer (user explicitly asked; localStorage-only version was rejected). Old localStorage templates auto-migrate on first load. JSON export/import kept as backup. Deleting a saved template is in the sidebar (「刪除所選範本」); built-in ones can't be deleted.
- Rules shown in the sidebar: ReR/KFR 主要住址 only cover the part other than 區域/地區/鄉村名稱; 「供傳媒及公眾查閱的聯絡資料」 is **not** covered.

## Dates page (`public/dates.html`)
- Data is the `E` array in the file: `[ISO date | 'rel', label, 'cand'|'ro', text, source html, deadline?]`. Rows tagged `ro` are internal RO-office deadlines from the deck; `cand` are candidate-facing. Filters and "hide past" are client-side.
- Two rows are inferred, not quoted: "投票日前10天" (2027-01-07) from chap04, and FR polling day from the form. Flag this if asked.

## Pending / ideas the user hasn't decided
- Nice Chinese login page instead of the browser Basic-auth prompt.
- Confirm FR redaction items with HAD.
- Add more documents or forms as the user uploads them (put PDFs in `data/pdf/`, add title, rebuild chunks; for forms add a template to `redact-templates.json`).
