// ============================================================
//  WAWE — APP LOGIC v2 (con enhancement reale immagini + AI visiva)
// ============================================================

const GROQ_KEY     = WAWE_CONFIG.GROQ_KEY;
const GOFILE_TOKEN = WAWE_CONFIG.GOFILE_TOKEN;
const GROQ_MODEL   = WAWE_CONFIG.GROQ_MODEL;
const ANTHROPIC_KEY = WAWE_CONFIG.ANTHROPIC_KEY;

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

dz.addEventListener('click', e => {
  if (e.target.closest('button') || e.target.closest('input')) return;
  document.getElementById('file-input').click();
});

document.getElementById('btn-browse-files').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('file-input').click();
});

document.getElementById('btn-browse-folder').addEventListener('click', e => {
  e.stopPropagation();
  const fi = document.getElementById('folder-input');
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
        <button class="btn-analyze" id="btn-${id}" onclick="processSingle(${id})">Enhance</button>
        <button class="btn-remove"  onclick="removeFile(${id})" title="Rimuovi">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="card-progress" id="prog-${id}">
      <div class="prog-track"><div class="prog-fill" id="bar-${id}"></div></div>
      <div class="prog-label" id="plbl-${id}"></div>
    </div>
    <div class="card-preview" id="preview-${id}" style="display:none"></div>
    <div class="card-analysis" id="analysis-${id}">
      <div class="analysis-head">
        <span class="analysis-label">Enhancement Report</span>
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
    const cat = getCategory(entry.file);

    if (cat === 'image') {
      await processImage(id, entry);
    } else {
      await processGeneric(id, entry, cat);
    }

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

// ── IMAGE PROCESSING (Canvas enhancement + AI visiva) ────────
async function processImage(id, entry) {
  const btn = document.getElementById(`btn-${id}`);

  setProgress(id, 10, 'caricamento immagine...');
  const originalDataUrl = await fileToDataUrl(entry.file);

  setProgress(id, 25, 'analisi AI visiva...');
  const aiResult = await claudeAnalyzeImage(originalDataUrl, entry.file.name);

  setProgress(id, 50, 'enhancement in corso...');
  const enhancedBlob = await enhanceImage(originalDataUrl, aiResult.enhancements);

  setProgress(id, 70, 'mostra anteprima...');
  showImagePreview(id, originalDataUrl, enhancedBlob);

  setProgress(id, 80, 'upload su gofile...');
  const enhancedFile = new File([enhancedBlob], 'wawe-enhanced-' + entry.file.name, { type: 'image/jpeg' });
  const url = await gofileUpload(enhancedFile);

  setProgress(id, 100, 'completato');
  showAnalysis(id, aiResult, true);
  showDownload(id, url);
  entry.status = 'done';
  setCardStatus(id, 'done');
  document.getElementById(`card-${id}`).classList.add('done');
  btn.textContent = 'done';
  toast('Immagine migliorata', 'green');
}

// ── CLAUDE VISION ANALYSIS ───────────────────────────────────
async function claudeAnalyzeImage(dataUrl, filename) {
  const base64 = dataUrl.split(',')[1];
  const mediaType = dataUrl.split(';')[0].split(':')[1] || 'image/jpeg';

  const prompt = `Sei un esperto di image enhancement. Analizza questa immagine e rispondi SOLO con JSON valido, zero markdown:
{
  "quality": "good|degraded|poor",
  "summary": "descrizione concisa dei problemi visivi che vedi",
  "issues": ["problema 1", "problema 2", "problema 3"],
  "suggestions": "cosa hai migliorato e perché, in italiano, max 2 righe",
  "enhancements": {
    "brightness": 0,
    "contrast": 15,
    "saturation": 10,
    "sharpness": 20,
    "denoise": true
  }
}

I valori enhancement vanno da -100 a +100 (0 = nessuna modifica). Sceglili basandoti sui problemi reali che vedi nell'immagine.
Se l'immagine è sgranata → aumenta sharpness (20-40), abilita denoise.
Se è scura → aumenta brightness (10-30).
Se i colori sono spenti → aumenta saturation (10-25).
Se è piatta → aumenta contrast (10-25).`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-calls': 'true'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Claude vision errore ${r.status}`);
  }

  const data = await r.json();
  const raw = data.content?.[0]?.text || '{}';
  try {
    return JSON.parse(raw.replace(/```[\w]*\n?|```/g, '').trim());
  } catch {
    return {
      quality: 'unknown', summary: raw.slice(0,120), issues: [], suggestions: '',
      enhancements: { brightness: 0, contrast: 10, saturation: 5, sharpness: 15, denoise: true }
    };
  }
}

// ── CANVAS IMAGE ENHANCEMENT ─────────────────────────────────
function enhanceImage(dataUrl, enhancements = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');

      // Disegna immagine originale
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const brightness  = (enhancements.brightness  || 0);
      const contrast    = (enhancements.contrast     || 0);
      const saturation  = (enhancements.saturation   || 0);
      const sharpness   = (enhancements.sharpness    || 0);
      const denoise     = (enhancements.denoise      || false);

      // Fattore contrasto (0-2, 1 = neutro)
      const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2];

        // 1. Brightness
        r += brightness; g += brightness; b += brightness;

        // 2. Contrast
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;

        // 3. Saturation (via HSL shift)
        const avg = (r + g + b) / 3;
        const sat = saturation / 100;
        r = avg + (r - avg) * (1 + sat);
        g = avg + (g - avg) * (1 + sat);
        b = avg + (b - avg) * (1 + sat);

        data[i]   = Math.max(0, Math.min(255, r));
        data[i+1] = Math.max(0, Math.min(255, g));
        data[i+2] = Math.max(0, Math.min(255, b));
      }

      ctx.putImageData(imageData, 0, 0);

      // 4. Sharpness (unsharp mask via filtro CSS)
      if (sharpness > 0) {
        const amount = sharpness / 100;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width  = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.filter = `blur(${Math.max(0.3, 1 - amount * 0.7)}px)`;
        tempCtx.drawImage(canvas, 0, 0);

        // Unsharp mask: original + (original - blurred) * amount
        const sharpData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const blurData  = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < sharpData.data.length; i += 4) {
          sharpData.data[i]   = Math.max(0, Math.min(255, sharpData.data[i]   + (sharpData.data[i]   - blurData.data[i])   * amount));
          sharpData.data[i+1] = Math.max(0, Math.min(255, sharpData.data[i+1] + (sharpData.data[i+1] - blurData.data[i+1]) * amount));
          sharpData.data[i+2] = Math.max(0, Math.min(255, sharpData.data[i+2] + (sharpData.data[i+2] - blurData.data[i+2]) * amount));
        }
        ctx.putImageData(sharpData, 0, 0);
      }

      // 5. Denoise (blur leggero per ridurre grain)
      if (denoise) {
        const denoiseCanvas = document.createElement('canvas');
        denoiseCanvas.width  = canvas.width;
        denoiseCanvas.height = canvas.height;
        const dCtx = denoiseCanvas.getContext('2d');
        dCtx.filter = 'blur(0.4px)';
        dCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(denoiseCanvas, 0, 0);
      }

      canvas.toBlob(resolve, 'image/jpeg', 0.93);
    };
    img.src = dataUrl;
  });
}

// ── IMAGE PREVIEW (before/after slider) ──────────────────────
function showImagePreview(id, originalUrl, enhancedBlob) {
  const enhancedUrl = URL.createObjectURL(enhancedBlob);
  const previewEl = document.getElementById(`preview-${id}`);
  previewEl.style.display = 'block';
  previewEl.innerHTML = `
    <div class="preview-wrap">
      <div class="preview-label-row">
        <span class="preview-lbl">Originale</span>
        <span class="preview-lbl enhanced-lbl">Migliorata ✦</span>
      </div>
      <div class="preview-slider-wrap" id="slider-wrap-${id}">
        <img class="preview-img preview-original" src="${originalUrl}" alt="Originale"/>
        <div class="preview-enhanced-clip" id="enhanced-clip-${id}" style="width:50%">
          <img class="preview-img preview-enhanced" src="${enhancedUrl}" alt="Migliorata"/>
        </div>
        <div class="preview-divider" id="divider-${id}" style="left:50%"></div>
      </div>
      <p class="preview-hint">← trascina per confrontare →</p>
    </div>`;

  // Slider drag logic
  const wrap     = document.getElementById(`slider-wrap-${id}`);
  const clip     = document.getElementById(`enhanced-clip-${id}`);
  const divider  = document.getElementById(`divider-${id}`);
  let dragging   = false;

  function setSlider(clientX) {
    const rect = wrap.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    clip.style.width    = (pct * 100) + '%';
    divider.style.left  = (pct * 100) + '%';
  }

  wrap.addEventListener('mousedown',  e => { dragging = true; setSlider(e.clientX); });
  wrap.addEventListener('touchstart', e => { dragging = true; setSlider(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('mousemove', e => { if (dragging) setSlider(e.clientX); });
  window.addEventListener('touchmove', e => { if (dragging) setSlider(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('mouseup',  () => dragging = false);
  window.addEventListener('touchend', () => dragging = false);
}

// ── GENERIC PROCESSING (video/audio/docs — AI testuale + upload) ─
async function processGeneric(id, entry, cat) {
  const btn = document.getElementById(`btn-${id}`);

  setProgress(id, 15, 'analisi AI...');
  const analysis = await groqAnalyze(entry.file, cat);

  setProgress(id, 65, 'upload su gofile...');
  const url = await gofileUpload(entry.file);

  setProgress(id, 100, 'completato');
  showAnalysis(id, analysis, false);
  showDownload(id, url);
  entry.status = 'done';
  setCardStatus(id, 'done');
  document.getElementById(`card-${id}`).classList.add('done');
  btn.textContent = 'done';
  toast('File processato', 'green');
}

// ── GROQ API (testo, per file non-immagine) ───────────────────
async function groqAnalyze(file, cat) {
  let catPrompt = '';
  if (cat === 'video') catPrompt = 'Per il video: valuta qualità visiva presunta, frame rate, risoluzione dal nome file, problemi audio comuni. Suggerisci strumenti per migliorarlo (HandBrake, ffmpeg, DaVinci Resolve).';
  else if (cat === 'audio') catPrompt = 'Per l\'audio: valuta qualità presunta, bitrate, rumore di fondo probabile. Suggerisci strumenti (Audacity, Adobe Audition, ffmpeg con filtri).';
  else if (cat === 'pdf') catPrompt = 'Per il PDF: valuta leggibilità, possibile scan qualità bassa, testo estraibile. Suggerisci miglioramenti (OCR, compressione, Adobe Acrobat).';
  else if (cat === 'doc') catPrompt = 'Per il documento: valuta integrità, dimensione, possibili problemi di formattazione.';
  else catPrompt = 'Valuta il file in generale.';

  const sys = `Sei un esperto di file enhancement. Rispondi SOLO con JSON valido, niente markdown:
{"quality":"good|degraded|poor","summary":"descrizione concisa","issues":["problema 1","problema 2"],"suggestions":"cosa si può fare per migliorarlo, in italiano, max 2 righe"}`;

  const msg = `File: "${file.name}" | MIME: ${file.type||'sconosciuto'} | Dimensione: ${fmtSize(file.size)}\n${catPrompt}`;

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL, max_tokens: 400, temperature: 0.1,
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
    return { quality:'unknown', summary: raw.slice(0,120), issues:[], suggestions:'' };
  }
}

// ── GOFILE API ───────────────────────────────────────────────
async function gofileUpload(file) {
  const sr = await fetch('https://api.gofile.io/servers', { method: 'GET' });
  if (!sr.ok) throw new Error('GoFile: server non raggiungibile');
  const sd = await sr.json();
  if (sd.status !== 'ok' || !sd.data?.servers?.length) {
    throw new Error('GoFile: nessun server disponibile');
  }
  const server = sd.data.servers[0].name;

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

// ── HELPERS ──────────────────────────────────────────────────
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Lettura file fallita'));
    reader.readAsDataURL(file);
  });
}

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

function showAnalysis(id, a, isEnhanced) {
  document.getElementById(`analysis-${id}`).style.display = 'block';
  const badges = [];
  const q = a.quality || 'unknown';
  if      (q === 'good')     badges.push(['green', isEnhanced ? 'Enhanced ✦' : 'OK']);
  else if (q === 'degraded') badges.push(['amber', 'Migliorata ✦']);
  else if (q === 'poor')     badges.push(['red',   'Migliorata ✦']);
  else                       badges.push(['amber',  'Processata']);

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
