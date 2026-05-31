// ============================================================
//  WAWE — APP LOGIC
// ============================================================

const GROQ_KEY     = WAWE_CONFIG.GROQ_KEY;
const GOFILE_TOKEN = WAWE_CONFIG.GOFILE_TOKEN;
const GROQ_MODEL   = WAWE_CONFIG.GROQ_MODEL;

// ── STATE ────────────────────────────────────────────────────
let files = new Map();
let uid   = 0;

// ── DRAG & DROP + TOUCH ──────────────────────────────────────
const dz = document.getElementById('dropzone');

dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', e => { if (!dz.contains(e.relatedTarget)) dz.classList.remove('over'); });
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('over');
  addFiles([...e.dataTransfer.files]);
});

// click sulla dropzone apre il file picker (non sui bottoni)
dz.addEventListener('click', e => {
  if (e.target.closest('button') || e.target.closest('input')) return;
  document.getElementById('file-input').click();
});

// ── FILE INPUT HANDLERS ──────────────────────────────────────
document.getElementById('btn-browse-files').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('file-input').click();
});

document.getElementById('btn-browse-folder').addEventListener('click', e => {
  e.stopPropagation();
  const fi = document.getElementById('folder-input');
  // webkitdirectory non supportato su iOS Safari — fallback a file picker normale
  if (typeof fi.webkitdirectory !== 'undefined') {
    fi.click();
  } else {
    document.getElementById('file-input').click();
  }
});

document.getElementById('file-input').addEventListener('change', e => {
  addFiles([...e.target.files]); e.target.value = '';
});
document.getElementById('folder-input').addEventListener('change', e => {
  addFiles([...e.target.files]); e.target.value = '';
});

// ── FILE MANAGEMENT ──────────────────────────────────────────
function addFiles(list) {
  if (!list || list.length === 0) return;
  list.forEach(f => {
    // salta file di sistema nascosti (es. .DS_Store)
    if (f.name.startsWith('.')) return;
    const id = ++uid;
    files.set(id, { file: f, status: 'idle' });
    document.getElementById('file-list').prepend(buildCard(id, f));
  });
  refreshToolbar();
}

function removeFile(id) {
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.style.transition = 'opacity .2s, transform .2s';
    card.style.opacity    = '0';
    card.style.transform  = 'translateX(20px)';
    setTimeout(() => card.remove(), 200);
  }
  files.delete(id);
  refreshToolbar();
}

function refreshToolbar() {
  const total = files.size;
  const idle  = [...files.values()].filter(e => e.status === 'idle').length;
  const done  = [...files.values()].filter(e => e.status === 'done').length;
  document.getElementById('toolbar').classList.toggle('show', total > 0);
  document.getElementById('toolbar-stats').innerHTML =
    `<span>${total}</span> file &nbsp;·&nbsp; <span>${done}</span> completati`;
  document.getElementById('btn-all').disabled = idle === 0;
}

// ── FILE TYPE HELPERS ────────────────────────────────────────
function getCategory(file) {
  const t = file.type, n = file.name.toLowerCase();
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('image/')) return 'image';
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.pptx')||n.endsWith('.ppt')||n.endsWith('.docx')||
      n.endsWith('.doc') ||n.endsWith('.xlsx')||n.endsWith('.csv')) return 'doc';
  if (n.endsWith('.zip')||n.endsWith('.rar')||n.endsWith('.7z')||
      n.endsWith('.tar')||n.endsWith('.gz')) return 'archive';
  return 'other';
}
function getLabel(file) {
  const ext = file.name.split('.').pop().toUpperCase();
  return ext.length <= 4 ? ext : getCategory(file).slice(0,3).toUpperCase();
}
function fmtSize(b) {
  if (b < 1024)   return b + ' B';
  if (b < 1<<20)  return (b/1024).toFixed(1) + ' KB';
  return (b/(1<<20)).toFixed(2) + ' MB';
}

// ── BUILD CARD ───────────────────────────────────────────────
function buildCard(id, file) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.id = `card-${id}`;
  const cat = getCategory(file);
  card.innerHTML = `
    <div class="card-head">
      <div class="card-type-icon ${cat}">${getLabel(file)}</div>
      <div class="card-info">
        <div class="card-name" title="${esc(file.name)}">${esc(file.name)}</div>
        <div class="card-meta">
          <span>${fmtSize(file.size)}</span>
          <span class="sep">·</span>
          <span>${cat}</span>
          <span class="sep">·</span>
          <span id="status-${id}" class="s-idle">idle</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-analyze" id="btn-${id}" onclick="processSingle(${id})">Analizza</button>
        <button class="btn-remove"  onclick="removeFile(${id})" title="Rimuovi">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="card-progress" id="prog-${id}">
      <div class="prog-track"><div class="prog-fill" id="bar-${id}"></div></div>
      <div class="prog-label" id="plbl-${id}"></div>
    </div>
    <div class="card-analysis" id="analysis-${id}">
      <div class="analysis-head">
        <span class="analysis-label">AI Analysis</span>
        <div class="badge-row" id="badges-${id}"></div>
      </div>
      <div class="analysis-body">
        <div class="analysis-summary" id="asummary-${id}"></div>
        <div class="issues-list"     id="aissues-${id}"></div>
        <div class="analysis-detail" id="adetail-${id}"></div>
      </div>
    </div>
    <div class="card-download" id="dl-${id}">
      <svg viewBox="0 0 24 24" width="15" height="15" stroke="#34d399" fill="none" stroke-width="2">
        <path d="M12 16l-4-4h3V4h2v8h3l-4 4z"/><path d="M4 18h16"/>
      </svg>
      <a class="dl-link" id="dllink-${id}" href="#" target="_blank">—</a>
      <button class="btn-copy" onclick="copyLink(${id})">copy</button>
    </div>`;
  return card;
}

// ── PROCESS ──────────────────────────────────────────────────
async function processAll() {
  const idle = [...files.entries()].filter(([,e]) => e.status === 'idle');
  const btn  = document.getElementById('btn-all');
  btn.disabled = true;
  for (const [id] of idle) await processSingle(id);
  btn.textContent = 'Tutti completati';
  setTimeout(() => {
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Processa tutti';
    refreshToolbar();
  }, 2500);
}

async function processSingle(id) {
  const entry = files.get(id);
  if (!entry || entry.status === 'processing') return;
  entry.status = 'processing';
  setCardStatus(id, 'processing');
  const btn = document.getElementById(`btn-${id}`);
  btn.disabled = true; btn.textContent = '...';

  try {
    setProgress(id, 10, 'connessione a groq...');
    const analysis = await groqAnalyze(entry.file);

    setProgress(id, 60, 'upload su gofile...');
    const url = await gofileUpload(entry.file);

    setProgress(id, 100, 'completato');
    showAnalysis(id, analysis);
    showDownload(id, url);
    entry.status = 'done';
    setCardStatus(id, 'done');
    document.getElementById(`card-${id}`).classList.add('done');
    btn.textContent = 'done';
    toast('File processato', 'green');
  } catch (err) {
    entry.status = 'error';
    setCardStatus(id, 'error');
    document.getElementById(`card-${id}`).classList.add('error');
    setProgress(id, 0, 'errore: ' + err.message);
    btn.disabled  = false;
    btn.textContent = 'Riprova';
    toast(err.message, 'red');
    console.error('[wawe]', err);
  }
  refreshToolbar();
}

// ── GROQ API ─────────────────────────────────────────────────
async function groqAnalyze(file) {
  const sys = `Sei un analizzatore file professionale. Rispondi SOLO con JSON valido, niente markdown, niente testo fuori dal JSON:
{"quality":"good|degraded|corrupted","virus_risk":"none|suspicious|dangerous","readable":true,"summary":"una riga concisa","issues":["max 3 problemi specifici"],"suggestions":"suggerimenti pratici in italiano, max 2 righe"}`;

  const msg = `File: "${file.name}" | tipo MIME: ${file.type||'sconosciuto'} | dimensione: ${fmtSize(file.size)} | categoria: ${getCategory(file)}
Analizza: per video/audio valuta qualità e lag; per documenti leggibilità e corruzione; per archivi integrità. Valuta sempre rischi virus.`;

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL, max_tokens: 512, temperature: 0.1,
      messages: [
        { role: 'system', content: sys },
        { role: 'user',   content: msg }
      ]
    })
  });

  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Groq errore ${r.status}`);
  }
  const data = await r.json();
  const raw  = data.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw.replace(/```[\w]*\n?|```/g, '').trim());
  } catch {
    return { quality:'unknown', virus_risk:'none', readable:true, summary: raw.slice(0,120), issues:[], suggestions:'' };
  }
}

// ── GOFILE API ───────────────────────────────────────────────
async function gofileUpload(file) {
  // Step 1: recupera il server ottimale
  const sr = await fetch('https://api.gofile.io/servers', { method: 'GET' });
  if (!sr.ok) throw new Error('GoFile: server non raggiungibile');
  const sd = await sr.json();
  if (sd.status !== 'ok' || !sd.data?.servers?.length) {
    throw new Error('GoFile: nessun server disponibile');
  }
  const server = sd.data.servers[0].name; // es. "store1"

  // Step 2: upload sul server
  const form = new FormData();
  form.append('file', file);

  const ur = await fetch(`https://${server}.gofile.io/contents/uploadfile`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GOFILE_TOKEN}` },
    body: form
  });

  if (!ur.ok) throw new Error(`GoFile upload fallito (${ur.status})`);
  const ud = await ur.json();
  if (ud.status !== 'ok') throw new Error('GoFile: ' + (ud.message || 'upload fallito'));

  return ud.data?.downloadPage || ud.data?.directLink || '#';
}

// ── UI HELPERS ───────────────────────────────────────────────
function setProgress(id, pct, label) {
  document.getElementById(`prog-${id}`).style.display = 'block';
  document.getElementById(`bar-${id}`).style.width    = pct + '%';
  document.getElementById(`plbl-${id}`).textContent   = label;
}

function setCardStatus(id, s) {
  const el = document.getElementById(`status-${id}`);
  if (!el) return;
  el.textContent = s;
  el.className   = `s-${s}`;
}

function showAnalysis(id, a) {
  document.getElementById(`analysis-${id}`).style.display = 'block';
  const badges = [];
  if      (a.quality === 'good')        badges.push(['green', 'OK']);
  else if (a.quality === 'degraded')    badges.push(['amber', 'Degraded']);
  else if (a.quality === 'corrupted')   badges.push(['red',   'Corrupted']);
  if      (a.virus_risk === 'none')       badges.push(['green', 'Clean']);
  else if (a.virus_risk === 'suspicious') badges.push(['amber', 'Suspicious']);
  else if (a.virus_risk === 'dangerous')  badges.push(['red',   'VIRUS']);
  if (a.readable === false) badges.push(['amber', 'Illeggibile']);

  document.getElementById(`badges-${id}`).innerHTML = badges.map(([t,l]) =>
    `<span class="badge badge-${t}"><span class="dot"></span>${l}</span>`).join('');
  document.getElementById(`asummary-${id}`).textContent = a.summary || '';
  document.getElementById(`aissues-${id}`).innerHTML = (a.issues || []).map(i =>
    `<div class="issue-item"><div class="issue-dot"></div><span>${esc(i)}</span></div>`).join('');
  document.getElementById(`adetail-${id}`).textContent = a.suggestions || '';
}

function showDownload(id, url) {
  const dl   = document.getElementById(`dl-${id}`);
  const link = document.getElementById(`dllink-${id}`);
  dl.style.display  = 'flex';
  link.href         = url;
  link.textContent  = url;
}

function copyLink(id) {
  const url = document.getElementById(`dllink-${id}`).href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast('Link copiato', 'green'));
  } else {
    // fallback per browser senza clipboard API (alcuni mobile)
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Link copiato', 'green');
  }
}

let _tt;
function toast(msg, color = 'blue') {
  const map = { green:'#34d399', blue:'#60a5fa', red:'#f87171', amber:'#fbbf24' };
  document.getElementById('toast-dot').style.background = map[color] || map.blue;
  document.getElementById('toast-msg').textContent = msg;
  const t = document.getElementById('toast');
  t.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => t.classList.remove('show'), 3200);
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── PWA INSTALL ──────────────────────────────────────────────
let _dp;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); _dp = e;
  document.getElementById('install-btn').classList.add('show');
});
document.getElementById('install-btn').addEventListener('click', async () => {
  if (!_dp) return;
  _dp.prompt();
  const { outcome } = await _dp.userChoice;
  if (outcome === 'accepted') document.getElementById('install-btn').classList.remove('show');
  _dp = null;
});

// ── SERVICE WORKER ───────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
