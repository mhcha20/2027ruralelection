// Zero-dependency server: static site + /api/search + /api/ask (Claude, optional)
const http = require('http'), fs = require('fs'), path = require('path');
const chunks = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/chunks.json'), 'utf8'));
const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

const isCJK = c => /[一-鿿]/.test(c);
function grams(s) {
  s = s.toLowerCase(); const out = [];
  const cjk = [...s].filter(isCJK).join('');
  for (let i = 0; i < cjk.length - 1; i++) out.push(cjk.slice(i, i + 2));
  for (const w of s.match(/[a-z0-9.]+/g) || []) out.push(w);
  return out;
}
const idx = chunks.map(c => new Set(grams(c.text + ' ' + c.title)));
const df = new Map();
idx.forEach(set => set.forEach(g => df.set(g, (df.get(g) || 0) + 1)));

const STOP = '需要 多少 甚麼 什麼 可以 是否 如何 怎樣 應該 有沒有 哪些 請問 能否 需否 是什 麼人 要多 少人'.split(' ');
const titleSet = chunks.map(c => new Set(grams(c.title)));
function search(q, k = 6) {
  const qg = [...new Set(grams(q))].filter(g => !STOP.includes(g));
  const num = q.match(/\d+\.\d+/g) || [];
  return chunks.map((c, i) => {
    let s = 0;
    for (const g of qg) if (idx[i].has(g)) s += Math.log(1 + chunks.length / df.get(g)) * (titleSet[i].has(g) ? 3 : 1);
    for (const n of num) if (c.text.includes(n)) s += 8;
    if (c.doc.startsWith('appendix')) s *= 0.6;
    return { c, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map(x => x.c);
}

async function ask(q) {
  const hits = search(q, 8);
  const sources = hits.map(h => ({ title: h.title, page: h.page, url: h.url, text: h.text }));
  if (!process.env.ANTHROPIC_API_KEY) return { answer: null, sources };
  const ctx = hits.map((h, i) => `[${i + 1}] 《${h.title}》第${h.page}頁\n${h.text}`).join('\n\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1200,
      system: '你是2027年香港鄉郊代表選舉指引的問答助手。只根據提供的指引節錄作答，用繁體中文，簡潔清楚，並以[編號]標註引用來源。若節錄未涵蓋答案，直接說明並建議查閱選管會官方指引或致電選舉事務處。不要編造。',
      messages: [{ role: 'user', content: `指引節錄：\n${ctx}\n\n問題：${q}` }]
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'API error');
  return { answer: j.content.map(b => b.text || '').join(''), sources };
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.pdf': 'application/pdf', '.json': 'application/json' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const json = (o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
  try {
    if (u.pathname === '/api/search') return json({ sources: search(u.searchParams.get('q') || '', 10) });
    if (u.pathname === '/api/ask' && req.method === 'POST') {
      let body = ''; for await (const d of req) { body += d; if (body.length > 5000) return json({ error: 'too long' }, 413); }
      const q = (JSON.parse(body).q || '').trim().slice(0, 500);
      if (!q) return json({ error: 'empty' }, 400);
      return json(await ask(q));
    }
    if (u.pathname === '/health') return json({ ok: true, chunks: chunks.length, ai: !!process.env.ANTHROPIC_API_KEY });
    const docs = u.pathname.startsWith('/docs/') ? path.join(__dirname, 'data/pdf', path.basename(u.pathname)) : null;
    const f = docs || path.join(__dirname, 'public', u.pathname === '/' ? 'index.html' : u.pathname);
    if (!(docs || f.startsWith(path.join(__dirname, 'public'))) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  } catch (e) { json({ error: e.message }, 500); }
}).listen(PORT, () => console.log('listening on', PORT));
