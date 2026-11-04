// Zero-dependency server: static site + /api/search + /api/ask (Claude, optional)
const http = require('http'), fs = require('fs'), path = require('path');
const chunks = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/chunks.json'), 'utf8'));
const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
// Shared redaction templates (persisted; set TEMPLATES_DIR to a mounted volume on Railway)
const TPL_DIR = process.env.TEMPLATES_DIR || path.join(__dirname, 'data');
const TPL_FILE = path.join(TPL_DIR, 'my-templates.json');
const readTpl = () => { try { return JSON.parse(fs.readFileSync(TPL_FILE, 'utf8')); } catch { return {}; } };
const writeTpl = t => { fs.mkdirSync(TPL_DIR, { recursive: true }); fs.writeFileSync(TPL_FILE + '.tmp', JSON.stringify(t)); fs.renameSync(TPL_FILE + '.tmp', TPL_FILE); };
const validTpl = t => t && typeof t.name === 'string' && t.name.length <= 100 && t.pages && typeof t.pages === 'object' &&
  Object.values(t.pages).every(a => Array.isArray(a) && a.length <= 500 && a.every(b => ['x', 'y', 'w', 'h'].every(k => typeof b[k] === 'number')));

const isCJK = c => /[一-鿿]/.test(c);
function grams(s) {
  s = s.toLowerCase(); const out = [];
  // bigrams within each run of CJK characters (runs are separated by punctuation / spaces / removed stop words)
  for (const run of s.match(/[一-鿿]+/g) || []) for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
  for (const w of s.match(/[a-z0-9.]+/g) || []) out.push(w);
  return out;
}
// Term frequencies per chunk (BM25) and document frequencies
const N = chunks.length;
const tfIdx = chunks.map(c => { const m = new Map(); for (const g of grams(c.text)) m.set(g, (m.get(g) || 0) + 1); return m; });
const lens = chunks.map(c => c.text.length), avgLen = lens.reduce((a, b) => a + b, 0) / N;
const df = new Map();
tfIdx.forEach(m => m.forEach((_, g) => df.set(g, (df.get(g) || 0) + 1)));
const idf = g => Math.log(1 + (N - (df.get(g) || 0) + 0.5) / ((df.get(g) || 0) + 0.5));
const titleSet = chunks.map(c => new Set(grams(c.title)));
// Question words / particles that carry no meaning for retrieval. Removed before building bigrams so they also stop
// bigrams spanning them (e.g. 「時間係幾點」 → 「時間」 only). Longer entries first so they win over their parts.
const QSTOP = ['可唔可以','應唔應該','使唔使','要唔要','有沒有','有冇','有無','點樣','點算','點做','點解','幾時','幾點','幾多','幾耐','幾錢','邊啲','邊個','邊度','乜嘢','咩嘢','係咪','是否','如何','怎樣','應該','需要','需否','能否','請問','哪些','甚麼','什麼','多少','之後','之前','同埋','或者','想知','知道','嘅','係','呀','吖','呢','嗎','啊','咩','啲','咗','嗰','佢','我','你','哋','的','了','嘛','囉','喎','就','都','仲','唔'];
const QSTOP_RE = new RegExp(QSTOP.join('|'), 'g');
const cleanQuery = q => q.replace(QSTOP_RE, ' ');
// Chinese → English expansion so Chinese questions also hit the English HAD documents (ro_manual / ro_forms / ro_appendices)
const GLOSS = {
  提名: 'nomination', 提名表格: 'nomination form', 提名期: 'nomination period', 候選人: 'candidate', 退選: 'withdrawal candidature',
  選舉主任: 'returning officer ro', 助理選舉主任: 'assistant returning officer aro', 投票站主任: 'presiding officer pro', 民政: 'had', 總署: 'had hqs',
  選舉廣告: 'election advertisement ea eas', 廣告: 'advertisement', 指定地點: 'designated spot', 橫額: 'banner', 海報: 'poster',
  代理人: 'agent', 選舉代理人: 'election agent', 監察投票代理人: 'polling agent', 監察點票代理人: 'counting agent', 選舉開支代理人: 'election expense agent',
  投票站: 'polling station', 點票站: 'counting station', 點票: 'count counting', 投票: 'poll polling', 投票日: 'polling day', 選票: 'ballot paper',
  選民: 'elector electors', 選民登記冊: 'register electors', 選民資料: 'electors information',
  遮蓋: 'cover covered', 公眾查閱: 'public inspection', 查閱: 'inspection inspect', 個人資料: 'personal data', 身份證: 'identity document hkid', 住址: 'address residential', 主要住址: 'principal residential address pra', 通訊地址: 'correspondence address', 出生日期: 'date of birth', 電話: 'telephone', 電郵: 'email',
  誓言: 'oath', 宣誓: 'oath', 憲報: 'gazette', 公告: 'notice', 選舉結果: 'election result', 當選: 'elected', 無競逐: 'uncontested', 有競逐: 'contested', 有效: 'validity valid', 無效: 'invalid',
  選舉申報書: 'election return', 申報書: 'return declaration', 選舉開支: 'election expenses', 捐贈: 'donation donations', 收據: 'receipt',
  禁止拉票區: 'no canvassing zone ncz', 禁止逗留區: 'no staying zone nsz', 拉票: 'canvassing', 投訴: 'complaint complaints',
  懲教: 'penal institution prison', 監獄: 'prison penal', 惡劣天氣: 'inclement weather typhoon rainstorm', 風球: 'typhoon', 黑雨: 'rainstorm',
  方格表: 'grid paper', 候選人簡介: 'introduction to candidates', 簡介: 'introduction', 抽籤: 'lots drawing', 候選人編號: 'candidate number', 校樣: 'printing proof', 印刷: 'printing',
  表格: 'form', 限期: 'deadline not later than by', 時限: 'deadline', 鄉事委員會: 'rural committee', 鄉郊地區: 'rural area', 鄉村: 'village', 墟鎮: 'market town',
  街坊代表: 'kaifong representative kfr', 原居民代表: 'indigenous inhabitant representative iir', 居民代表: 'resident representative rer', 漁民: 'fishermen', 鄉郊代表: 'rural representative rr',
  選舉呈請: 'election petition', 視障: 'visual impairment', 行動不便: 'mobility difficulties', 簡介會: 'briefing', 平台: 'platform', 中央平台: 'central platform',
  辦公時間: 'ordinary business hours', 星期六: 'saturday', 當值: 'duty work on saturdays', 承諾書: 'undertaking', 授權: 'authorization authorisation permission', 同意: 'consent',
  清理: 'clearance removal', 移除: 'remove removal', 貼紙: 'stickers', 保密: 'secrecy', 聲明: 'declaration', 保管: 'safe custody', 銷毀: 'destruction erasure disposal'
};
// Cantonese / colloquial → wording the documents actually use
const ZH_SYN = {
  幾點: '時間', 幾時: '日期 限期', 幾耐: '期限', 幾多錢: '金額 最高限額', 幾多人: '人數 數目', 幾多: '數目',
  移除: '拆除 清除 清理', 拆除: '移除 清除', 清走: '拆除 清除', 宣誓: '誓言 鄉郊代表誓言', 誓言: '宣誓',
  遮: '遮蓋', 遮住: '遮蓋', 黑: '遮蓋', 退選: '退出選舉 退選通知書', 合照: '合照 照片 活動', 影相: '拍攝 攝影',
  開門: '開始', 收工: '結束', 截止: '限期 結束', 死線: '限期', 交表: '遞交 提名表格', 落單: '遞交',
  投票站開: '投票時間 開始', 投票站關: '投票時間 結束', 幾點開: '投票時間 開始', 幾點關: '投票時間 結束',
  點票: '點票 點算', 抽籤: '抽籤 候選人編號', 選舉主任辦事處: '選舉主任 辦事處', 民政處: '民政事務處 民政事務總署',
  身份證: '身分證明文件 身份證', 住址: '住址 地址', 電話: '電話號碼', 相片: '照片', 相: '照片',
  罰款: '罰款 違法 罪行', 坐監: '監禁', 犯法: '違法 罪行', 投訴: '投訴', 拉票: '拉票 競選活動', 掛橫額: '展示 選舉廣告 橫額',
  錢: '選舉開支 捐贈', 使費: '選舉開支', 開支: '選舉開支', 捐款: '選舉捐贈', 報數: '選舉申報書'
};
function expand(q) {
  const extra = [];
  for (const [zh, en] of Object.entries(GLOSS)) if (q.includes(zh)) extra.push(en);
  for (const [zh, syn] of Object.entries(ZH_SYN)) if (q.includes(zh)) extra.push(syn);
  return extra.join(' ');
}
function search(q, k = 6) {
  const ex = expand(q);
  const cq = cleanQuery(q + ' ' + ex);
  const qg = [...new Set(grams(cq + ' ' + expand(ex)))];
  const phrases = (cq.match(/[一-鿿]{2,}/g) || []).filter(p => p.length >= 2);   // exact runs for a phrase bonus
  const num = q.match(/\d+\.\d+/g) || [];
  const k1 = 1.2, b = 0.75;
  const ranked = chunks.map((c, i) => {
    let s = 0, matched = 0;
    const norm = k1 * (1 - b + b * lens[i] / avgLen);
    for (const g of qg) {
      const tf = tfIdx[i].get(g); if (!tf) continue;
      matched++;
      const w = idf(g);
      s += w * tf * (k1 + 1) / (tf + norm);
      if (titleSet[i].has(g)) s += 2 * w;          // title match counts roughly triple
    }
    if (!s) return { c, s: 0 };
    const low = c.text.toLowerCase();
    for (const p of phrases) {
      if (p.length >= 3 && low.includes(p)) s += 1.5 * p.length;   // whole phrase present in the passage
      if (c.title.includes(p)) s += 2 * p.length;                  // whole phrase is part of the document title
    }
    s *= 0.6 + 0.4 * matched / qg.length;          // reward covering more of the question
    for (const n of num) if (c.text.includes(n)) s += 8;
    if (c.doc.startsWith('appendix')) s *= 0.6;
    return { c, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  // at most 3 passages per document so one long chapter does not crowd out the others
  const perDoc = {}, out = [];
  for (const x of ranked) { if ((perDoc[x.c.doc] || 0) >= 3) continue; perDoc[x.c.doc] = (perDoc[x.c.doc] || 0) + 1; out.push(x.c); if (out.length >= k) break; }
  return out;
}

const pageLabel = p => typeof p === 'number' ? `第${p}頁` : String(p);
async function ask(q) {
  const hits = search(q, 8);
  const sources = hits.map(h => ({ title: h.title, page: h.page, url: h.url, text: h.text }));
  if (!process.env.ANTHROPIC_API_KEY) return { answer: null, sources };
  const ctx = hits.map((h, i) => `[${i + 1}] 《${h.title}》${pageLabel(h.page)}\n${h.text}`).join('\n\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1200,
      system: `你是2027年香港鄉郊代表選舉的問答助手，用戶是選舉主任辦事處／民政處的同事。用繁體中文（可用廣東話口語），簡潔具體。
回答分兩部分：
1. 先直接答：用你自己的判斷，綜合節錄內容，一開始就給出結論同建議做法（例如限期、要做乜、要注意乜），唔好先列出處。
2. 之後一段以「參考資料：」開頭，逐點引述節錄中支持答案的內容，並以[編號]標註出處。英文節錄請翻譯成中文摘要。
節錄未涵蓋的部分要明確講明「文件冇講」，可以用常識補充但要標明係你嘅推斷，並建議查閱選管會指引或致電民政總署／選舉事務處。不要編造文件冇嘅數字或日期。`,
      messages: [{ role: 'user', content: `指引節錄：\n${ctx}\n\n問題：${q}` }]
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'API error');
  return { answer: j.content.map(b => b.text || '').join(''), sources };
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.pdf': 'application/pdf', '.json': 'application/json' };
// Whole-site password (HTTP Basic). Set SITE_PASSWORD on Railway; any username is accepted.
const SITE_PW = process.env.SITE_PASSWORD;
function siteAuthed(req) {
  if (!SITE_PW) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const dec = Buffer.from(h.slice(6), 'base64').toString('utf8');
  return dec.slice(dec.indexOf(':') + 1) === SITE_PW;
}
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const json = (o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
  try {
    if (u.pathname !== '/health' && !siteAuthed(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="2027 Rural Election", charset="UTF-8"', 'content-type': 'text/plain; charset=utf-8' });
      return res.end('需要密碼 / Password required');
    }
    if (u.pathname === '/api/search') return json({ sources: search(u.searchParams.get('q') || '', 10) });
    if (u.pathname === '/api/ask' && req.method === 'POST') {
      let body = ''; for await (const d of req) { body += d; if (body.length > 5000) return json({ error: 'too long' }, 413); }
      const q = (JSON.parse(body).q || '').trim().slice(0, 500);
      if (!q) return json({ error: 'empty' }, 400);
      return json(await ask(q));
    }
    const tm = u.pathname.match(/^\/api\/templates(?:\/([\w-]{1,64}))?$/);
    if (tm) {
      const key = tm[1];
      if (req.method === 'GET' && !key) return json(readTpl());
      const PW = process.env.TEMPLATES_PASSWORD;
      if (!PW) return json({ error: 'TEMPLATES_PASSWORD not configured' }, 503);
      if (!SITE_PW && (req.headers['x-password'] || '') !== PW) return json({ error: 'wrong password' }, 401);
      if (req.method === 'PUT' && key) {
        let body = ''; for await (const d of req) { body += d; if (body.length > 300000) return json({ error: 'too large' }, 413); }
        const t = JSON.parse(body); if (!validTpl(t)) return json({ error: 'bad template' }, 400);
        const all = readTpl(); all[key] = { name: t.name, pages: t.pages, saved: new Date().toISOString() }; writeTpl(all); return json({ ok: true });
      }
      if (req.method === 'DELETE' && key) { const all = readTpl(); delete all[key]; writeTpl(all); return json({ ok: true }); }
      return json({ error: 'method' }, 405);
    }
    if (u.pathname === '/health') return json({ ok: true, chunks: chunks.length, ai: !!process.env.ANTHROPIC_API_KEY });
    const docs = u.pathname.startsWith('/docs/') ? path.join(__dirname, 'data/pdf', path.basename(u.pathname)) : null;
    const f = docs || path.join(__dirname, 'public', u.pathname === '/' ? 'index.html' : u.pathname);
    if (!(docs || f.startsWith(path.join(__dirname, 'public'))) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  } catch (e) { json({ error: e.message }, 500); }
});
if (require.main === module) server.listen(PORT, () => console.log('listening on', PORT));
module.exports = { search };
// Railway sends SIGTERM when a newer deployment replaces this one: close cleanly so it is not reported as a crash.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  console.log(sig, 'received, shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});
