/* ─── WAWE · app.js ──────────────────────────────────────────────────────────── */
/*
 *  Enhancement:  Replicate — nightmareai/real-esrgan  (AI upscaling, real improvement)
 *  Report:       Groq      — llama-3.2-11b-vision-preview (fast, free tier)
 */

// ─── Keys (stored in localStorage) ───────────────────────────────────────────
let REPLICATE_KEY = localStorage.getItem('wawe_replicate') || '';
let GROQ_KEY      = localStorage.getItem('wawe_groq')      || '';

// ─── State ────────────────────────────────────────────────────────────────────
let currentFile     = null;
let currentMode     = 'enhance';
let deferredInstall = null;
let isDragging      = false;
let compareReady    = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const dropZone        = document.getElementById('dropZone');
const fileInput       = document.getElementById('fileInput');
const filePreview     = document.getElementById('filePreview');
const thumbEl         = document.getElementById('previewThumb');
const fileNameEl      = document.getElementById('fileName');
const fileMetaEl      = document.getElementById('fileMeta');
const removeFileBtn   = document.getElementById('removeFile');
const optionsSection  = document.getElementById('options');
const modeButtons     = document.querySelectorAll('.mode-btn');
const btnProcess      = document.getElementById('btnProcess');
const progressSection = document.getElementById('progressSection');
const progressFill    = document.getElementById('progressFill');
const progressText    = document.getElementById('progressText');
const stepsEl         = document.getElementById('steps');
const resultSection   = document.getElementById('resultSection');
const compareWrap     = document.getElementById('compareWrap');
const imgBefore       = document.getElementById('imgBefore');
const imgAfter        = document.getElementById('imgAfter');
const compareDivider  = document.getElementById('compareDivider');
const reportText      = document.getElementById('reportText');
const btnDownload     = document.getElementById('btnDownload');
const btnReset        = document.getElementById('btnReset');
const installBanner   = document.getElementById('installBanner');
const installBtn      = document.getElementById('installBtn');
const apiKeyModal     = document.getElementById('apiKeyModal');
const apiKeyToggle    = document.getElementById('apiKeyToggle');
const apiKeyStatus    = document.getElementById('apiKeyStatus');
const repKeyInput     = document.getElementById('repKeyInput');
const groqKeyInput    = document.getElementById('groqKeyInput');
const apiKeySave      = document.getElementById('apiKeySave');

// ─── API Key modal ────────────────────────────────────────────────────────────
function updateKeyStatus() {
  const both = REPLICATE_KEY && GROQ_KEY;
  const one  = REPLICATE_KEY || GROQ_KEY;
  if (both) {
    apiKeyStatus.textContent = 'Keys set';
    apiKeyStatus.className   = 'api-key-status set';
  } else if (one) {
    apiKeyStatus.textContent = 'Partial keys';
    apiKeyStatus.className   = 'api-key-status set';
  } else {
    apiKeyStatus.textContent = 'No API keys';
    apiKeyStatus.className   = 'api-key-status unset';
  }
}
updateKeyStatus();

apiKeyToggle.addEventListener('click', () => {
  apiKeyModal.classList.toggle('visible');
  if (apiKeyModal.classList.contains('visible')) {
    repKeyInput.value  = REPLICATE_KEY;
    groqKeyInput.value = GROQ_KEY;
  }
});

apiKeyModal.addEventListener('click', (e) => {
  if (e.target === apiKeyModal) apiKeyModal.classList.remove('visible');
});

apiKeySave.addEventListener('click', () => {
  const rep  = repKeyInput.value.trim();
  const groq = groqKeyInput.value.trim();
  if (!rep && !groq) { showToast('Enter at least one key'); return; }
  if (rep)  { REPLICATE_KEY = rep;  localStorage.setItem('wawe_replicate', rep); }
  if (groq) { GROQ_KEY      = groq; localStorage.setItem('wawe_groq', groq); }
  apiKeyModal.classList.remove('visible');
  updateKeyStatus();
  showToast('Keys saved');
});

[repKeyInput, groqKeyInput].forEach(inp => {
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  apiKeySave.click();
    if (e.key === 'Escape') apiKeyModal.classList.remove('visible');
  });
});

// ─── File handling ────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });
removeFileBtn.addEventListener('click', (e) => { e.stopPropagation(); resetAll(); });

function setFile(file) {
  if (file.size > 50 * 1024 * 1024) { showToast('File too large — max 50 MB'); return; }
  currentFile = file;
  fileNameEl.textContent = file.name;
  fileMetaEl.textContent = formatFileSize(file.size) + ' · ' + getFileType(file);
  if (file.type.startsWith('image/')) {
    thumbEl.src = URL.createObjectURL(file);
    thumbEl.style.display = 'block';
  } else {
    thumbEl.style.display = 'none';
  }
  filePreview.classList.add('visible');
  optionsSection.classList.add('visible');
  btnProcess.classList.add('visible');
  filterModes(file);
}

function filterModes(file) {
  const type = getFileType(file);
  let anyActive = false;
  modeButtons.forEach(btn => {
    const ok = btn.dataset.supports === 'all' || btn.dataset.supports === type;
    btn.style.display = ok ? '' : 'none';
    if (!ok && btn.classList.contains('active')) btn.classList.remove('active');
    if (ok  && btn.classList.contains('active')) anyActive = true;
  });
  if (!anyActive) {
    const first = [...modeButtons].find(b => b.style.display !== 'none');
    if (first) { first.classList.add('active'); currentMode = first.dataset.mode; }
  }
}

function getFileType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function formatFileSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// ─── Mode selection ───────────────────────────────────────────────────────────
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
  });
});

// ─── Process button ───────────────────────────────────────────────────────────
btnProcess.addEventListener('click', (e) => {
  if (!REPLICATE_KEY && !GROQ_KEY) {
    apiKeyModal.classList.add('visible');
    showToast('Set your API keys first');
    return;
  }
  const ripple = document.createElement('span');
  ripple.className = 'ripple-el';
  const rect = btnProcess.getBoundingClientRect();
  ripple.style.left = (e.clientX - rect.left) + 'px';
  ripple.style.top  = (e.clientY - rect.top)  + 'px';
  btnProcess.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
  startProcessing();
});

// ─── Main processing flow ─────────────────────────────────────────────────────
async function startProcessing() {
  if (!currentFile) return;
  btnProcess.disabled    = true;
  btnProcess.textContent = 'Processing...';
  resultSection.classList.remove('visible');
  progressSection.classList.add('visible');

  const fileType = getFileType(currentFile);
  const steps = [
    'Reading file',
    fileType === 'image' ? 'AI upscaling via Replicate' : 'Processing stream',
    'Generating AI report',
    'Preparing output'
  ];
  renderSteps(steps);

  try {
    // Step 0 — read
    await animateStep(0, steps.length, 'Reading file...');
    const base64Data = await readFileAsBase64(currentFile);

    // Step 1 — enhance
    await animateStep(1, steps.length, fileType === 'image' ? 'Sending to Replicate...' : 'Processing...');
    let resultBlob;
    let originalURL = null;

    if (fileType === 'image') {
      originalURL = URL.createObjectURL(currentFile);
      if (REPLICATE_KEY) {
        resultBlob = await enhanceWithReplicate(base64Data, currentFile.type, currentMode);
      } else {
        // Fallback: canvas-only if no Replicate key
        resultBlob = await enhanceWithCanvas(currentFile, currentMode);
        showToast('No Replicate key — using local enhancement');
      }
    } else {
      resultBlob = new Blob([await currentFile.arrayBuffer()], { type: currentFile.type });
    }

    // Step 2 — AI report
    await animateStep(2, steps.length, 'Generating report...');
    const report = GROQ_KEY
      ? await getGroqReport(base64Data, currentFile, currentMode)
      : 'Add a Groq API key in settings to get an AI-generated analysis report.';

    // Step 3 — done
    await animateStep(3, steps.length, 'Done');
    const processedURL = URL.createObjectURL(resultBlob);

    setTimeout(() => {
      progressSection.classList.remove('visible');
      showResult(fileType, originalURL, processedURL, report);
    }, 400);

  } catch (err) {
    console.error(err);
    progressSection.classList.remove('visible');
    showToast('Error: ' + (err.message || 'something went wrong'));
    btnProcess.disabled    = false;
    btnProcess.textContent = 'Enhance File';
  }
}

function renderSteps(steps) {
  stepsEl.innerHTML = '';
  steps.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'step';
    div.id = 'step-' + i;
    div.innerHTML = `<span class="step__dot"></span><span>${s}</span>`;
    stepsEl.appendChild(div);
  });
}

function animateStep(index, total, label) {
  return new Promise(resolve => {
    if (index > 0) {
      const prev = document.getElementById('step-' + (index - 1));
      if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
    }
    const el = document.getElementById('step-' + index);
    if (el) el.classList.add('active');
    progressFill.style.width = Math.round(((index + 1) / total) * 100) + '%';
    progressText.textContent  = label;
    setTimeout(resolve, index === 1 ? 200 : 700); // step 1 resolves fast, Replicate is async
  });
}

// ─── Replicate — Real-ESRGAN ──────────────────────────────────────────────────
async function enhanceWithReplicate(base64, mimeType, mode) {
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // Map mode → Real-ESRGAN params
  const scale = (mode === 'hdr' || mode === 'enhance') ? 4 : 2;
  const faceEnhance = false; // can expose as option later

  // 1. Create prediction
  const createRes = await fetch('https://api.replicate.com/v1/models/nightmareai/real-esrgan/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait'               // ask Replicate to wait up to 60s synchronously
    },
    body: JSON.stringify({
      input: {
        image:        dataUrl,
        scale:        scale,
        face_enhance: faceEnhance
      }
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    if (createRes.status === 401) throw new Error('Invalid Replicate key');
    throw new Error(err.detail || 'Replicate error ' + createRes.status);
  }

  let prediction = await createRes.json();

  // 2. Poll if not done yet (fallback when "Prefer: wait" isn't honoured)
  const maxWait = 120000; // 2 min
  const start   = Date.now();
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
    if (Date.now() - start > maxWait) throw new Error('Replicate timeout — try again');
    await sleep(2500);
    progressText.textContent = 'AI upscaling... ' + Math.round((Date.now() - start) / 1000) + 's';
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { 'Authorization': `Token ${REPLICATE_KEY}` }
    });
    prediction = await pollRes.json();
  }

  if (prediction.status === 'failed') throw new Error('Replicate failed: ' + (prediction.error || 'unknown'));

  // 3. Fetch the output image as blob
  const outputUrl  = prediction.output;
  const imgRes     = await fetch(outputUrl);
  if (!imgRes.ok)  throw new Error('Could not download enhanced image');
  return await imgRes.blob();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Canvas fallback (no Replicate key) ───────────────────────────────────────
function enhanceWithCanvas(file, mode) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;

      if (mode === 'enhance') {
        for (let i = 0; i < d.length; i += 4) {
          d[i]   = clamp((d[i]   - 128) * 1.18 + 134);
          d[i+1] = clamp((d[i+1] - 128) * 1.15 + 130);
          d[i+2] = clamp((d[i+2] - 128) * 1.12 + 128);
        }
      } else if (mode === 'sharpen') {
        applySharpen(d, canvas.width, canvas.height);
      } else if (mode === 'denoise') {
        applyDenoise(d, canvas.width, canvas.height);
      } else if (mode === 'hdr') {
        for (let i = 0; i < d.length; i += 4) {
          d[i]   = clamp(Math.pow(d[i]   / 255, 0.82) * 255 * 1.14);
          d[i+1] = clamp(Math.pow(d[i+1] / 255, 0.84) * 255 * 1.10);
          d[i+2] = clamp(Math.pow(d[i+2] / 255, 0.86) * 255 * 1.06);
        }
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.97);
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
  });
}

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

function applySharpen(d, w, h) {
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const c = new Uint8ClampedArray(d);
  for (let y = 1; y < h-1; y++)
    for (let x = 1; x < w-1; x++)
      for (let ch = 0; ch < 3; ch++) {
        let s = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++)
            s += c[((y+ky)*w+(x+kx))*4+ch] * k[(ky+1)*3+(kx+1)];
        d[(y*w+x)*4+ch] = clamp(s);
      }
}

function applyDenoise(d, w, h) {
  const c = new Uint8ClampedArray(d);
  for (let y = 1; y < h-1; y++)
    for (let x = 1; x < w-1; x++)
      for (let ch = 0; ch < 3; ch++) {
        let s = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++)
            s += c[((y+ky)*w+(x+kx))*4+ch];
        d[(y*w+x)*4+ch] = clamp(s / 9);
      }
}

// ─── Base64 reader ────────────────────────────────────────────────────────────
function readFileAsBase64(file) {
  if (!file.type.startsWith('image/')) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result.split(',')[1]);
    r.onerror = () => reject(new Error('File read failed'));
    r.readAsDataURL(file);
  });
}

// ─── Groq report ──────────────────────────────────────────────────────────────
async function getGroqReport(base64Data, file, mode) {
  const fileType  = getFileType(file);
  const modeLabel = { enhance:'AI upscaling (4x Real-ESRGAN)', sharpen:'sharpening (2x Real-ESRGAN)', denoise:'noise reduction (2x Real-ESRGAN)', hdr:'HDR tone mapping (4x Real-ESRGAN)' }[mode] || mode;

  let messages;
  if (fileType === 'image' && base64Data) {
    messages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${file.type || 'image/jpeg'};base64,${base64Data}` } },
        { type: 'text', text: `You are a professional image quality analyst. Analyze this image and write a concise enhancement report (3 short paragraphs). Processing applied: "${modeLabel}". Cover: 1) image content and original quality assessment, 2) specific improvements the AI upscaling applied, 3) recommended use cases for the enhanced version. Be specific and technical. Plain text only, no markdown.` }
      ]
    }];
  } else {
    messages = [{
      role: 'user',
      content: `You are a media quality analyst. Write a brief enhancement report (3 paragraphs) for a ${fileType} file: "${file.name}" (${formatFileSize(file.size)}) processed with "${modeLabel}". Cover: improvements applied, technical parameters, expected quality gain. Plain text, no markdown.`
    }];
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model:      fileType === 'image' ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile',
      max_tokens: 600,
      messages
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Invalid Groq key');
    throw new Error(err.error?.message || 'Groq error ' + res.status);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || 'No report generated.';
}

// ─── Show result ──────────────────────────────────────────────────────────────
function showResult(fileType, originalURL, processedURL, report) {
  if (fileType === 'image' && originalURL) {
    compareWrap.style.display = '';
    imgBefore.src = originalURL;
    imgAfter.src  = processedURL;
    updateCompare(50);
    if (!compareReady) {
      compareReady = true;
      compareWrap.addEventListener('mousedown', startDrag);
      compareWrap.addEventListener('touchstart', startDrag, { passive: true });
    }
  } else {
    compareWrap.style.display = 'none';
  }

  reportText.textContent = report;
  const ext      = fileType === 'image' ? '.png' : ('.' + currentFile.name.split('.').pop());
  const baseName = currentFile.name.replace(/\.[^.]+$/, '');
  btnDownload.href     = processedURL;
  btnDownload.download = baseName + '_wawe' + ext;

  resultSection.classList.add('visible');
  btnProcess.disabled    = false;
  btnProcess.textContent = 'Enhance File';
}

// ─── Compare slider ───────────────────────────────────────────────────────────
function startDrag(e) {
  isDragging = true;
  moveDrag(e);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('touchmove', moveDrag, { passive: true });
  window.addEventListener('mouseup',   endDrag);
  window.addEventListener('touchend',  endDrag);
}
function moveDrag(e) {
  if (!isDragging) return;
  const rect   = compareWrap.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  updateCompare(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
}
function endDrag() {
  isDragging = false;
  window.removeEventListener('mousemove', moveDrag);
  window.removeEventListener('touchmove', moveDrag);
  window.removeEventListener('mouseup',   endDrag);
  window.removeEventListener('touchend',  endDrag);
}
function updateCompare(pct) {
  imgAfter.style.clipPath   = `inset(0 ${100 - pct}% 0 0)`;
  compareDivider.style.left = pct + '%';
}

// ─── Reset ────────────────────────────────────────────────────────────────────
btnReset.addEventListener('click', resetAll);
function resetAll() {
  currentFile  = null;
  compareReady = false;
  fileInput.value = '';
  filePreview.classList.remove('visible');
  optionsSection.classList.remove('visible');
  btnProcess.classList.remove('visible');
  progressSection.classList.remove('visible');
  resultSection.classList.remove('visible');
  btnProcess.disabled    = false;
  btnProcess.textContent = 'Enhance File';
  progressFill.style.width = '0%';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

// ─── PWA install ──────────────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  installBanner.classList.add('visible');
});
installBtn.addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  if (outcome === 'accepted') { installBanner.classList.remove('visible'); showToast('WAWE installed'); }
  deferredInstall = null;
});
window.addEventListener('appinstalled', () => installBanner.classList.remove('visible'));

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(console.error));
}
