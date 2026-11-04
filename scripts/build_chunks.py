"""Extract guideline PDFs (data/pdf) into data/chunks.json for search.
Usage: pip install pymupdf; python3 scripts/build_chunks.py"""
import pymupdf, glob, os, re, json
titles = json.load(open('data/titles.json'))
BASE = 'https://www.eac.hk/pdf/village/ch/'
LOCAL = {'nomination_guide', 'ro_manual', 'ro_forms'}   # served from data/pdf via /docs/
# Text-only documents (PDF too large to fetch): data/text/<key>.txt, cited by section heading
TEXT_DOCS = {'ro_appendices': ('https://drive.google.com/file/d/1QPPTgWGmobE2Z4XAUIWvYCCQblmfgW1e/view', r'^(Appendix [IVXL]+)')}
CJK = r'　-〿一-鿿＀-￯'

def clean(t):
    t = t.replace(' ', ' ')
    t = re.sub(r'[ \t]+', ' ', t)
    # remove spaces/newlines between CJK / fullwidth chars (PDF fragmenting)
    for _ in range(3):
        t = re.sub(r'([%s])\s*\n?\s*([%s])' % (CJK, CJK), r'\1\2', t)
    t = re.sub(r'(?<=\d) (?=[\d.%)])|(?<=[(.]) (?=\d)', '', t)
    return t

chunks = []
for p in sorted(glob.glob('data/pdf/*.pdf')):
    key = os.path.basename(p)[:-4]
    if key not in titles: continue
    doc = pymupdf.open(p)
    for i, page in enumerate(doc, 1):
        text = clean(page.get_text())
        text = re.sub(r'\n\s*\d+\s*\n', '\n', text)  # lone page numbers
        eng = key.startswith('ro_')   # English docs: keep spaces between lines/paragraphs
        paras = [s.strip().replace('\n', ' ' if eng else '') for s in re.split(r'\n{2,}|\n(?=\d+\s?\.\s?\d+)', text) if s.strip()]
        buf = ''
        for para in paras + ['']:
            if buf and (len(buf) + len(para) > (800 if key.startswith('ro_') else 500) or not para):
                chunks.append(dict(id=len(chunks), doc=key, title=titles[key], page=i,
                                   url=(f'/docs/{key}.pdf#page={i}' if key in LOCAL else f'{BASE}{key}.pdf#page={i}'), text=buf))
                buf = ''
            buf += (' ' if eng and buf else '') + para
for key, (url, head) in TEXT_DOCS.items():
    sec, buf = '', ''
    flush = lambda: chunks.append(dict(id=len(chunks), doc=key, title=titles[key], page=sec, url=url, text=buf))
    for para in [l.strip() for l in open(f'data/text/{key}.txt').read().split('\n') if l.strip()]:
        m = re.match(head, para)
        if m and m.group(1) != sec:
            if buf: flush(); buf = ''
            sec = m.group(1)
        if buf and len(buf) + len(para) > 800: flush(); buf = ''
        buf += (' ' if buf else '') + para
    if buf: flush()
print(len(chunks), 'chunks')
json.dump(chunks, open('data/chunks.json', 'w'), ensure_ascii=False)
