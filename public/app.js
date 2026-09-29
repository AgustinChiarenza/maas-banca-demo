'use strict';

/* =========================================================================
   Utilidades
   ========================================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ars = (n) => (typeof n === 'number' && isFinite(n))
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n) : '—';
const intFmt = (n) => new Intl.NumberFormat('es-AR').format(Math.round(n || 0));
const fmtMs = (ms) => ms == null ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
const fmtDNI = (d) => String(d || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtDate = (iso) => {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};
function parseDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  return isNaN(d) ? null : d;
}
function yearsSince(iso) {
  const d = parseDate(iso);
  if (!d) return null;
  const now = new Date();
  let y = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) y--;
  return y;
}
const num = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  // acepta "1.342.170,00" o "1342170.00"
  const s = v.replace(/[^\d,.-]/g, '');
  if (/,\d{1,2}$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return parseFloat(s.replace(/,/g, ''));
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin storage */ } },
  sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  sset(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* sin storage */ } },
};

// Extrae el JSON de la respuesta: cuerpo entero, bloque ```json``` o primer { … último }.
function extractJSON(t) {
  if (!t) return null;
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const cand = fence ? fence[1] : t;
  try { return JSON.parse(cand); } catch { /* sigue */ }
  const a = cand.indexOf('{'), b = cand.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(cand.slice(a, b + 1)); } catch { /* sigue */ } }
  return null;
}

// Algunos despliegues devuelven el razonamiento dentro de <think>…</think> en el content.
function splitThink(text) {
  const m = text.match(/^\s*<think>([\s\S]*?)(<\/think>|$)/);
  if (!m) return { content: text, think: '' };
  return { content: text.slice(m[0].length).trimStart(), think: m[1].trim() };
}

async function fileToDataURL(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 4500);
}

// PDF -> imágenes. pdf.js (public/vendor) se carga solo la primera vez que se usa.
const PDF_MAX_PAGES = 3;
let pdfjsLib = null;
const isPdf = (f) => !!f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''));
const isSupported = (f) => !!f && (f.type.startsWith('image/') || isPdf(f));

async function pdfPages(file, width = 1400) {
  if (!pdfjsLib) {
    pdfjsLib = await import('./vendor/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.mjs', location.href).href;
  }
  let doc;
  try {
    // disableFontFace: pdf.js dibuja los glifos él mismo, sin esperar la carga de fuentes del navegador
    // (que puede no terminar nunca con la pestaña en segundo plano).
    doc = await pdfjsLib.getDocument({
      data: await file.arrayBuffer(),
      disableFontFace: true,
      // URL absoluta: el worker resuelve las relativas desde su propia carpeta.
      standardFontDataUrl: new URL('vendor/standard_fonts/', location.href).href,
    }).promise;
  } catch (e) {
    throw new Error(e.name === 'PasswordException' ? 'El PDF tiene contraseña.' : 'No se pudo leer el PDF.');
  }
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, PDF_MAX_PAGES); i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    // 'print' evita requestAnimationFrame, que se pausa si la pestaña queda en segundo plano.
    await page.render({ canvasContext: g, viewport: vp, intent: 'print' }).promise;
    pages.push(c);
  }
  const total = doc.numPages;
  doc.destroy();
  return { pages, total };
}

// Todas las páginas en una sola imagen (una debajo de otra).
async function pdfToDataURL(file) {
  const { pages, total } = await pdfPages(file);
  const c = document.createElement('canvas');
  c.width = Math.max(...pages.map((p) => p.width));
  c.height = pages.reduce((h, p) => h + p.height, 0);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  let y = 0;
  for (const p of pages) { g.drawImage(p, 0, y); y += p.height; }
  if (total > PDF_MAX_PAGES) toast(`El PDF tiene ${total} páginas: se usan las primeras ${PDF_MAX_PAGES}.`);
  return c.toDataURL('image/jpeg', 0.85);
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) { const o = btn.textContent; btn.textContent = 'Copiado'; setTimeout(() => (btn.textContent = o), 1400); }
  } catch {
    if (btn) btn.textContent = 'No se pudo copiar';
  }
}

/* =========================================================================
   Configuración
   ========================================================================= */
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);
const MOD = IS_MAC ? '⌘' : 'Ctrl';

const CFG_KEY = 'maasBanca.cfg';
const KEY_KEY = 'maasBanca.key';

function loadConfig() {
  let c = {};
  try { c = JSON.parse(store.get(CFG_KEY) || '{}'); } catch { /* vacío */ }
  if (c.endpoint) $('#cfgEndpoint').value = c.endpoint;
  if (c.model) $('#cfgModel').value = c.model;
  if (c.temperature != null) $('#cfgTemp').value = c.temperature;
  if (c.maxTokens) $('#cfgMax').value = c.maxTokens;
  if (c.stream != null) $('#cfgStream').checked = c.stream;
  if (c.mock != null) $('#cfgMock').checked = c.mock;
  $('#cfgRemember').checked = !!c.remember;
  $('#cfgKey').value = (c.remember ? store.get(KEY_KEY) : store.sget(KEY_KEY)) || '';
}

function saveConfig() {
  const c = getConfig();
  const remember = $('#cfgRemember').checked;
  store.set(CFG_KEY, JSON.stringify({
    endpoint: c.endpoint, model: c.model, temperature: c.temperature,
    maxTokens: c.maxTokens, stream: c.stream, mock: c.mock, remember,
  }));
  if (remember) { store.set(KEY_KEY, c.apiKey || null); store.sset(KEY_KEY, null); }
  else { store.set(KEY_KEY, null); store.sset(KEY_KEY, c.apiKey || null); }
}

function getConfig() {
  return {
    endpoint: $('#cfgEndpoint').value.trim(),
    apiKey: $('#cfgKey').value.trim(),
    model: $('#cfgModel').value.trim(),
    temperature: parseFloat($('#cfgTemp').value),
    maxTokens: parseInt($('#cfgMax').value, 10),
    stream: $('#cfgStream').checked,
    mock: $('#cfgMock').checked,
  };
}

function chatUrl(endpoint) {
  let u = (endpoint || 'https://api.tu-maas.com/v1').trim().replace(/\/+$/, '');
  if (!/\/chat\/completions$/.test(u)) u += '/chat/completions';
  return u;
}
function baseUrl(endpoint) {
  return (endpoint || 'https://api.tu-maas.com/v1').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
}

let connState = null; // null | 'ok' | 'error'
function updateStatus() {
  const c = getConfig();
  const el = $('#status'), txt = $('#statusText');
  let host = '';
  try { host = c.endpoint ? new URL(c.endpoint).host : ''; } catch { host = c.endpoint; }
  if (c.mock) { el.dataset.state = 'mock'; txt.textContent = `Modo simulado · ${c.model || 'sin modelo'}`; }
  else if (!c.endpoint || !c.model) { el.dataset.state = 'idle'; txt.textContent = 'Sin configurar'; }
  else {
    el.dataset.state = connState || 'ready';
    txt.textContent = `${host} · ${c.model}${connState === 'ok' ? ' · conectado' : connState === 'error' ? ' · error' : ''}`;
  }
  $('#endpointNote').innerHTML = `Se llama a <code>${esc(chatUrl(c.endpoint))}</code>`;
  renderMigration();
}

/* =========================================================================
   Consumo de la sesión
   ========================================================================= */
const usage = { req: 0, inTok: 0, outTok: 0, lat: 0, estimated: false };
function recordUsage(r) {
  usage.req++;
  usage.lat += r.total;
  usage.inTok += r.usage?.prompt_tokens || 0;
  usage.outTok += r.usage?.completion_tokens ?? r.estOut ?? 0;
  if (!r.usage) usage.estimated = true;
  renderUsage();
}
function renderUsage() {
  $('#uReq').textContent = usage.req;
  $('#uIn').textContent = intFmt(usage.inTok);
  $('#uOut').textContent = (usage.estimated ? '~' : '') + intFmt(usage.outTok);
  $('#uLat').textContent = usage.req ? fmtMs(usage.lat / usage.req) : '—';
}

/* =========================================================================
   Llamada al modelo (formato OpenAI chat/completions, vía proxy local)
   ========================================================================= */
let lastRequest = null;

async function callModel({ messages, onText, signal, mockKey, overrides = {} }) {
  const cfg = getConfig();
  const payload = {
    model: cfg.model,
    messages,
    temperature: isFinite(cfg.temperature) ? cfg.temperature : 0.2,
    max_tokens: cfg.maxTokens || 2048,
    stream: cfg.stream,
    ...overrides,
  };
  if (payload.stream) payload.stream_options = { include_usage: true };
  lastRequest = { url: chatUrl(cfg.endpoint), payload };
  renderLastRequest();

  if (cfg.mock) return mockCall(mockKey, messages, onText, signal);
  if (!cfg.endpoint) throw new Error('Falta el endpoint. Completalo en Configuración.');
  if (!cfg.model) throw new Error('Falta el nombre del modelo.');

  const t0 = performance.now();
  let r;
  try {
    r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: cfg.endpoint, apiKey: cfg.apiKey, payload }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Se perdió la conexión con el servidor de la demo. Verificá que siga corriendo (node server.js o el contenedor) y recargá la página.');
  }
  if (!r.ok) throw new Error(describeError(r.status, await r.text()));

  let raw = '', reasoning = '', usageObj = null, ttft = null, model = null;
  const emit = () => {
    const s = splitThink(raw);
    onText?.(s.content, reasoning || s.think);
  };
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let j;
        try { j = JSON.parse(data); } catch { continue; }
        if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
        if (j.model) model = j.model;
        if (j.usage) usageObj = j.usage;
        const d = j.choices?.[0]?.delta;
        if (!d) continue;
        if (d.reasoning_content || d.reasoning) {
          if (ttft === null) ttft = performance.now() - t0;
          reasoning += d.reasoning_content || d.reasoning;
          emit();
        }
        if (d.content) {
          if (ttft === null) ttft = performance.now() - t0;
          raw += d.content;
          emit();
        }
      }
    }
  } else {
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    const msg = j.choices?.[0]?.message || {};
    raw = Array.isArray(msg.content) ? msg.content.map((p) => p.text || '').join('') : (msg.content || '');
    reasoning = msg.reasoning_content || msg.reasoning || '';
    usageObj = j.usage || null;
    model = j.model || null;
    ttft = performance.now() - t0;
    emit();
  }
  const total = performance.now() - t0;
  const s = splitThink(raw);
  const result = {
    text: s.content, reasoning: reasoning || s.think, usage: usageObj, ttft, total,
    model: model || cfg.model, estOut: Math.round(raw.length / 4),
  };
  recordUsage(result);
  return result;
}

function describeError(status, body) {
  let msg = body;
  try { const j = JSON.parse(body); msg = j.error?.message || j.message || j.detail || body; } catch { /* texto plano */ }
  if (typeof msg !== 'string') msg = JSON.stringify(msg);
  msg = msg.slice(0, 600);
  if (status === 502) return msg; // el proxy ya arma el mensaje en español
  const hint = {
    400: 'Request inválido (400)',
    401: 'API key inválida o ausente (401)',
    403: 'Sin permiso para este modelo (403)',
    404: 'Endpoint o modelo no encontrado (404)',
    413: 'La imagen o el prompt son demasiado grandes (413)',
    429: 'Límite de uso alcanzado (429)',
    502: 'No se pudo llegar al endpoint',
  }[status] || `Error ${status}`;
  return `${hint}: ${msg}`;
}

/* ---------- Modo simulado */
const MOCKS = {
  kyc: {
    tipo_documento: 'DNI tarjeta', apellido: 'GÓMEZ', nombres: 'MARÍA LAURA', numero_documento: '33456789',
    sexo: 'F', nacionalidad: 'ARGENTINA', fecha_nacimiento: '1988-03-14', fecha_emision: '2019-08-02',
    fecha_vencimiento: '2034-08-02', numero_tramite: '00612345678', calidad_imagen: 'buena',
    alertas: ['La imagen tiene la leyenda "MUESTRA — SIN VALIDEZ": no es un documento válido para el alta.'],
    confianza: 0.93,
  },
  credito: {
    empleador: 'METALÚRGICA DEL CENTRO S.A.', cuit_empleador: '30-71234567-8', empleado: 'GÓMEZ, MARÍA LAURA',
    cuil_empleado: '27-33456789-4', periodo: '2026-08', fecha_ingreso: '2016-03-01',
    remuneracion_bruta: 1657000, total_deducciones: 314830, neto_a_cobrar: 1342170,
    conceptos: [
      { concepto: 'Sueldo básico', tipo: 'haber', importe: 1450000 },
      { concepto: 'Adicional antigüedad (10 años)', tipo: 'haber', importe: 87000 },
      { concepto: 'Presentismo', tipo: 'haber', importe: 120000 },
      { concepto: 'Jubilación 11%', tipo: 'deduccion', importe: 182270 },
      { concepto: 'Ley 19.032 (PAMI) 3%', tipo: 'deduccion', importe: 49710 },
      { concepto: 'Obra social 3%', tipo: 'deduccion', importe: 49710 },
      { concepto: 'Cuota sindical 2%', tipo: 'deduccion', importe: 33140 },
    ],
    observaciones: 'Los aportes coinciden con los porcentajes legales sobre el bruto. Antigüedad de 10 años en el empleo.',
    alertas: ['Documento marcado como muestra con datos ficticios.'],
  },
  fraude: {
    veredicto: 'fraude', riesgo: 96, tipo: 'Smishing (phishing por SMS)', canal: 'SMS',
    remitente: '+54 9 351 555-0199',
    urls: ['https://bancor-validacion.com.ar-seguridad.xyz/login'],
    senales: [
      { senal: 'Dominio falso', detalle: 'El dominio real es ar-seguridad.xyz; "bancor-validacion.com" es solo un subdominio para engañar.' },
      { senal: 'Urgencia y amenaza', detalle: 'Plazo de 2 horas, "baja definitiva" y un cargo de $45.000 para presionar.' },
      { senal: 'Pedido de validar datos', detalle: 'El banco no pide validar datos por links en SMS.' },
      { senal: 'Canal paralelo por WhatsApp', detalle: 'Deriva a un "asesor" en un número de otra provincia, típico de falso soporte.' },
      { senal: 'Remitente de número común', detalle: 'Llega desde un celular particular y no desde el número corto oficial.' },
    ],
    respuesta_al_cliente: 'Hola, gracias por avisarnos. Ese mensaje es falso: no lo enviamos nosotros. No entres al link ni escribas al WhatsApp que figura. Tu cuenta no está bloqueada. Si ya ingresaste datos, llamanos cuanto antes para bloquear tus claves.',
    acciones_internas: [
      'Reportar el dominio ar-seguridad.xyz para su baja (takedown).',
      'Agregar la URL y los números a la lista de bloqueo de canales digitales.',
      'Enviar un aviso preventivo a clientes de la zona.',
    ],
  },
};

function mockCall(key, messages, onText, signal) {
  const text = MOCKS[key]
    ? '```json\n' + JSON.stringify(MOCKS[key], null, 2) + '\n```'
    : '(Modo simulado) Esta respuesta es de ejemplo. Desactivá "Modo simulado" en Configuración para hablar con el modelo real.\n\n'
      + 'Tu mensaje fue: "' + lastUserText(messages).slice(0, 200) + '"';
  const t0 = performance.now();
  return new Promise((resolve, reject) => {
    let i = 0, ttft = null;
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
    let timer = setTimeout(function tick() {
      if (ttft === null) ttft = performance.now() - t0;
      i = Math.min(text.length, i + 14);
      onText?.(text.slice(0, i), '');
      if (i < text.length) { timer = setTimeout(tick, 18); return; }
      signal?.removeEventListener('abort', onAbort);
      const est = Math.round(text.length / 4);
      const res = { text, reasoning: '', usage: { prompt_tokens: 1200, completion_tokens: est }, ttft, total: performance.now() - t0, model: getConfig().model + ' (simulado)' };
      recordUsage(res);
      resolve(res);
    }, 450);
  });
}

function lastUserText(messages) {
  const m = [...messages].reverse().find((x) => x.role === 'user');
  if (!m) return '';
  return typeof m.content === 'string' ? m.content : (m.content.find((p) => p.type === 'text')?.text || '');
}

/* =========================================================================
   Casos de uso
   ========================================================================= */
const CASES = [
  {
    id: 'kyc',
    tab: 'Onboarding DNI',
    eyebrow: 'Caso 1 · Alta digital de clientes',
    title: 'Lectura y validación de DNI',
    desc: 'El cliente sube la foto de su DNI. El modelo extrae los datos y señala problemas de la imagen; la app valida edad, vigencia y que coincida con lo declarado.',
    sample: () => SAMPLES.dni(),
    runLabel: 'Leer DNI',
    extra: `<label class="field">DNI que declaró el cliente en el formulario
      <input class="x-dni" inputmode="numeric" value="33456789"></label>`,
    prompt: `Sos el sistema de onboarding digital de un banco argentino. Analizá la imagen del frente de un DNI argentino.

Devolvé SOLO un objeto JSON, sin texto adicional, con esta forma:
{
  "tipo_documento": "DNI tarjeta" | "DNI libreta" | "otro",
  "apellido": string,
  "nombres": string,
  "numero_documento": string (solo dígitos),
  "sexo": "F" | "M" | "X",
  "nacionalidad": string,
  "fecha_nacimiento": "AAAA-MM-DD",
  "fecha_emision": "AAAA-MM-DD",
  "fecha_vencimiento": "AAAA-MM-DD",
  "numero_tramite": string,
  "calidad_imagen": "buena" | "regular" | "mala",
  "alertas": [string],
  "confianza": número entre 0 y 1
}

Si un campo no es legible, usá null. En "alertas" indicá cualquier señal de adulteración, recortes, reflejos, fotocopia, captura de pantalla, o leyendas como "muestra" o "specimen". Escribí las alertas en español.`,
    render: renderKYC,
  },
  {
    id: 'credito',
    tab: 'Recibo de sueldo',
    eyebrow: 'Caso 2 · Originación de préstamos',
    title: 'Pre-evaluación crediticia desde el recibo de sueldo',
    desc: 'El modelo lee el recibo, separa haberes y deducciones y verifica que cierren las cuentas. Con el neto, la app simula cuánto se le puede prestar al cliente.',
    sample: () => SAMPLES.recibo(),
    runLabel: 'Analizar recibo',
    prompt: `Sos analista de riesgo crediticio de un banco argentino. Analizá la imagen de un recibo de sueldo.

Devolvé SOLO un objeto JSON, sin texto adicional, con esta forma:
{
  "empleador": string,
  "cuit_empleador": string,
  "empleado": string,
  "cuil_empleado": string,
  "periodo": "AAAA-MM",
  "fecha_ingreso": "AAAA-MM-DD" | null,
  "remuneracion_bruta": número,
  "total_deducciones": número,
  "neto_a_cobrar": número,
  "conceptos": [{ "concepto": string, "tipo": "haber" | "deduccion", "importe": número }],
  "observaciones": string,
  "alertas": [string]
}

Los importes van como números sin separador de miles y con punto decimal (ej. 1342170.5). En "observaciones" comentá brevemente si los aportes son razonables y la antigüedad. En "alertas" indicá inconsistencias, tachaduras, importes que no cierran o señales de que el documento no es genuino.`,
    render: renderCredito,
  },
  {
    id: 'fraude',
    tab: 'Antifraude',
    eyebrow: 'Caso 3 · Prevención de fraude',
    title: 'Detector de phishing en mensajes que reenvían los clientes',
    desc: 'Un cliente reenvía la captura de un SMS, WhatsApp o mail sospechoso. El modelo da un veredicto, marca las señales de fraude y redacta la respuesta para el cliente.',
    sample: () => SAMPLES.sms(),
    runLabel: 'Analizar mensaje',
    optionalImage: true,
    extra: `<label class="field">O pegá el texto del mensaje (opcional)
      <textarea class="x-text" rows="3" placeholder="Ej.: Estimado cliente, su tarjeta fue suspendida…"></textarea></label>`,
    prompt: `Sos analista de prevención de fraude de un banco argentino. Un cliente reenvió un mensaje sospechoso (captura de SMS, WhatsApp, email o sitio web, o el texto copiado).

Devolvé SOLO un objeto JSON, sin texto adicional, con esta forma:
{
  "veredicto": "fraude" | "sospechoso" | "legitimo",
  "riesgo": número de 0 a 100,
  "tipo": string (ej. "Smishing", "Phishing por email", "Falso soporte", "Estafa de inversión"),
  "canal": string,
  "remitente": string | null,
  "urls": [string],
  "senales": [{ "senal": string, "detalle": string }],
  "respuesta_al_cliente": string,
  "acciones_internas": [string]
}

"respuesta_al_cliente" es un mensaje breve y empático, en español rioplatense (vos), que el banco le enviaría al cliente. "acciones_internas" son los pasos que debería tomar el equipo de fraude.`,
    render: renderFraude,
  },
];

/* ---------- Construcción de pestañas y paneles */
const TABS = [...CASES.map((c) => ({ id: c.id, label: c.tab })), { id: 'chat', label: 'Chat libre' }, { id: 'migrar', label: 'Migrar en 3 líneas' }];

function buildTabs() {
  const nav = $('#tabs');
  nav.innerHTML = TABS.map((t) =>
    `<button class="tab" role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}" data-tab="${t.id}">${esc(t.label)}</button>`).join('');
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) selectTab(b.dataset.tab);
  });
}
function selectTab(id) {
  $$('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  $$('.panel').forEach((p) => (p.hidden = p.id !== `panel-${id}`));
  store.set('maasBanca.tab', id);
  if (history.replaceState) history.replaceState(null, '', '#' + id);
}
const activeTab = () => $('.tab[aria-selected="true"]')?.dataset.tab;

function buildCasePanel(c) {
  const p = document.createElement('section');
  p.className = 'panel'; p.id = `panel-${c.id}`; p.setAttribute('role', 'tabpanel'); p.hidden = true;
  p.innerHTML = `
    <div class="panel-head">
      <span class="eyebrow">${esc(c.eyebrow)}</span>
      <h1>${esc(c.title)}</h1>
      <p>${esc(c.desc)}</p>
    </div>
    <div class="case">
      <div class="col">
        <div class="drop" tabindex="0" role="button" aria-label="Cargar imagen">
          <input type="file" accept="image/*,application/pdf,.pdf" hidden>
          <div class="drop-empty"><strong>Arrastrá una imagen o un PDF</strong>pegala con ${MOD}+V o hacé clic para elegir un archivo${c.optionalImage ? ' (opcional)' : ''}</div>
          <img alt="Imagen cargada" hidden>
        </div>
        <div class="row">
          <button class="btn ghost small sample">Cargar ejemplo</button>
          <button class="btn ghost small clear" hidden>Quitar imagen</button>
        </div>
        ${c.extra ? `<div class="extra">${c.extra}</div>` : ''}
        <details class="prompt"><summary>Ver y editar el prompt</summary><textarea rows="14" spellcheck="false"></textarea></details>
        <div class="row">
          <button class="btn primary run">${esc(c.runLabel)}</button>
          <button class="btn ghost stop" hidden>Detener</button>
        </div>
      </div>
      <div class="col">
        <div class="metrics"></div>
        <div class="card out">
          <div class="out-tabs" role="tablist">
            <button class="active" data-v="view">Resultado</button>
            <button data-v="raw">Respuesta del modelo</button>
          </div>
          <div class="out-body">
            <div class="view"><div class="empty">Cargá una imagen (o el ejemplo) y tocá “${esc(c.runLabel)}”.</div></div>
            <pre class="raw" hidden></pre>
          </div>
          <details class="reasoning" hidden><summary>Razonamiento del modelo</summary><pre></pre></details>
        </div>
      </div>
    </div>`;
  $('#panels').append(p);
  $('textarea', $('.prompt', p)).value = c.prompt;

  const state = { image: null, ctl: null, lastData: null };
  c.state = state;
  const drop = $('.drop', p), img = $('img', drop), fileIn = $('input[type=file]', drop);
  const emptyHtml = $('.drop-empty', drop).innerHTML;

  c.setImage = (dataUrl) => {
    state.image = dataUrl;
    img.src = dataUrl || '';
    img.hidden = !dataUrl;
    $('.drop-empty', drop).hidden = !!dataUrl;
    drop.classList.toggle('has-image', !!dataUrl);
    $('.clear', p).hidden = !dataUrl;
  };
  const takeFile = async (f) => {
    if (!isSupported(f)) return toast('Formato no soportado: usá una imagen o un PDF.');
    if (!isPdf(f)) return c.setImage(await fileToDataURL(f));
    $('.drop-empty', drop).innerHTML = '<strong>Leyendo el PDF…</strong>';
    try { c.setImage(await pdfToDataURL(f)); } catch (e) { toast(e.message); }
    finally { $('.drop-empty', drop).innerHTML = emptyHtml; }
  };

  drop.addEventListener('click', () => { if (!state.image) fileIn.click(); });
  drop.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !state.image) { e.preventDefault(); fileIn.click(); } });
  fileIn.addEventListener('change', () => { takeFile(fileIn.files[0]); fileIn.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); takeFile(e.dataTransfer.files[0]); });
  c.takeFile = takeFile;

  $('.sample', p).addEventListener('click', () => c.setImage(c.sample()));
  $('.clear', p).addEventListener('click', () => c.setImage(null));

  $$('.out-tabs button', p).forEach((b) => b.addEventListener('click', () => {
    $$('.out-tabs button', p).forEach((x) => x.classList.toggle('active', x === b));
    $('.view', p).hidden = b.dataset.v !== 'view';
    $('.raw', p).hidden = b.dataset.v !== 'raw';
  }));

  $('.stop', p).addEventListener('click', () => state.ctl?.abort());
  $('.run', p).addEventListener('click', () => runCase(c, p));
}

async function runCase(c, p) {
  const st = c.state;
  const extraText = $('.x-text', p)?.value.trim() || '';
  const view = $('.view', p), raw = $('.raw', p), reas = $('.reasoning', p);
  if (!st.image && !(c.optionalImage && extraText)) {
    view.innerHTML = `<div class="error-box">${c.optionalImage ? 'Cargá una imagen o pegá el texto del mensaje.' : 'Primero cargá una imagen (podés usar el ejemplo).'}</div>`;
    return;
  }
  let prompt = $('.prompt textarea', p).value;
  if (extraText) prompt += `\n\nTexto del mensaje reenviado por el cliente:\n"""\n${extraText}\n"""`;
  const content = [{ type: 'text', text: prompt }];
  if (st.image) content.push({ type: 'image_url', image_url: { url: st.image } });

  st.ctl = new AbortController();
  $('.run', p).disabled = true; $('.stop', p).hidden = false;
  view.innerHTML = '<div class="thinking">Esperando al modelo…</div>';
  raw.textContent = ''; reas.hidden = true; $('pre', reas).textContent = '';
  $('.metrics', p).innerHTML = '';

  try {
    const res = await callModel({
      messages: [{ role: 'user', content }],
      mockKey: c.id,
      signal: st.ctl.signal,
      onText: (text, thinking) => {
        raw.textContent = text;
        if (thinking) { reas.hidden = false; $('pre', reas).textContent = thinking; }
        if (text) view.innerHTML = `<div class="thinking">Recibiendo respuesta… ${intFmt(text.length)} caracteres</div>`;
        else if (thinking) view.innerHTML = '<div class="thinking">El modelo está razonando…</div>';
      },
    });
    renderMetrics($('.metrics', p), res);
    raw.textContent = res.text;
    const data = extractJSON(res.text);
    if (!data) {
      view.innerHTML = '<div class="error-box"><b>No se pudo leer un JSON en la respuesta.</b> Mirá la pestaña “Respuesta del modelo”.</div>';
      return;
    }
    st.lastData = data;
    c.render(data, view, p);
  } catch (e) {
    if (e.name === 'AbortError') view.innerHTML = '<div class="empty">Se detuvo la consulta.</div>';
    else { view.innerHTML = `<div class="error-box"><b>Error.</b> ${esc(e.message)}</div>`; markConn('error'); }
  } finally {
    $('.run', p).disabled = false; $('.stop', p).hidden = true;
    st.ctl = null;
  }
}

function renderMetrics(el, r) {
  const out = r.usage?.completion_tokens ?? r.estOut;
  const genSecs = (r.total - (r.ttft || 0)) / 1000;
  const chips = [
    ['Modelo', r.model],
    ['1er token', fmtMs(r.ttft)],
    ['Total', fmtMs(r.total)],
    ['Tokens entrada', r.usage?.prompt_tokens != null ? intFmt(r.usage.prompt_tokens) : '—'],
    ['Tokens salida', (r.usage ? '' : '~') + intFmt(out)],
    ['Velocidad', genSecs > 0.2 && out ? `${Math.round(out / genSecs)} tok/s` : '—'],
  ];
  el.innerHTML = chips.map(([k, v]) => `<span class="chip">${esc(k)} <b>${esc(v)}</b></span>`).join('');
}

/* ---------- Render: KYC */
function renderKYC(d, el, p) {
  const declared = ($('.x-dni', p)?.value || '').replace(/\D/g, '');
  const doc = String(d.numero_documento ?? '').replace(/\D/g, '');
  const age = yearsSince(d.fecha_nacimiento);
  const exp = parseDate(d.fecha_vencimiento);
  const conf = typeof d.confianza === 'number' ? d.confianza : null;
  const checks = [
    ['Número de documento legible', doc ? doc.length >= 7 && doc.length <= 8 : false, doc ? `N° ${fmtDNI(doc)}` : 'No se pudo leer'],
    ['Coincide con lo declarado', declared ? doc === declared : null, declared ? (doc === declared ? 'Coincide' : `Declaró ${fmtDNI(declared)}`) : 'Sin dato declarado'],
    ['Mayor de edad', age != null ? age >= 18 : null, age != null ? `${age} años` : 'Fecha no legible'],
    ['Documento vigente', exp ? exp > new Date() : null, exp ? `Vence ${fmtDate(d.fecha_vencimiento)}` : 'Sin fecha de vencimiento'],
    ['Calidad de imagen', d.calidad_imagen ? d.calidad_imagen !== 'mala' : null, d.calidad_imagen || '—'],
    ['Confianza del modelo ≥ 80 %', conf != null ? conf >= 0.8 : null, conf != null ? `${Math.round(conf * 100)} %` : '—'],
  ];
  const alerts = Array.isArray(d.alertas) ? d.alertas.filter(Boolean) : [];
  const failed = checks.filter((c) => c[1] === false).length;
  const unknown = checks.filter((c) => c[1] === null).length;
  let v;
  if (failed) v = ['bad', '✕', 'Rechazado', `${failed} validación${failed > 1 ? 'es' : ''} no superada${failed > 1 ? 's' : ''}`];
  else if (alerts.length || unknown) v = ['warn', '!', 'Revisión manual', alerts.length ? `${alerts.length} alerta${alerts.length > 1 ? 's' : ''} del modelo` : 'Faltan datos para validar'];
  else v = ['ok', '✓', 'Aprobado para continuar', 'Todas las validaciones superadas'];

  const f = (label, val) => `<div><dt>${esc(label)}</dt><dd class="${val == null || val === '' ? 'null' : ''}">${val == null || val === '' ? 'no legible' : esc(val)}</dd></div>`;
  el.innerHTML = `
    ${verdictHTML(...v)}
    <h3 class="section-title">Datos extraídos</h3>
    <dl class="fields">
      ${f('Apellido', d.apellido)}${f('Nombres', d.nombres)}
      ${f('Documento', doc ? fmtDNI(doc) : null)}${f('Sexo', d.sexo)}
      ${f('Nacionalidad', d.nacionalidad)}${f('Nacimiento', d.fecha_nacimiento ? fmtDate(d.fecha_nacimiento) : null)}
      ${f('Emisión', d.fecha_emision ? fmtDate(d.fecha_emision) : null)}${f('Vencimiento', d.fecha_vencimiento ? fmtDate(d.fecha_vencimiento) : null)}
      ${f('N° de trámite', d.numero_tramite)}${f('Tipo', d.tipo_documento)}
    </dl>
    <h3 class="section-title">Validaciones del banco</h3>
    ${checksHTML(checks)}
    ${alerts.length ? `<h3 class="section-title">Alertas del modelo</h3><ul class="alerts">${alerts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`;
}

function verdictHTML(kind, badge, title, sub) {
  return `<div class="verdict ${kind}"><span class="v-badge" aria-hidden="true">${badge}</span><div><div class="v-title">${esc(title)}</div><div class="v-sub">${esc(sub)}</div></div></div>`;
}
function checksHTML(checks) {
  return `<ul class="checks">${checks.map(([label, ok, detail]) => `
    <li><span class="pill ${ok === true ? 'ok' : ok === false ? 'bad' : 'na'}">${ok === true ? 'OK' : ok === false ? 'FALLA' : 'S/D'}</span>
    <span>${esc(label)}</span><span class="detail">${esc(detail)}</span></li>`).join('')}</ul>`;
}

/* ---------- Render: Crédito */
function renderCredito(d, el, p) {
  const bruto = num(d.remuneracion_bruta), ded = num(d.total_deducciones), neto = num(d.neto_a_cobrar);
  const conceptos = Array.isArray(d.conceptos) ? d.conceptos : [];
  const sumH = conceptos.filter((c) => c.tipo === 'haber').reduce((s, c) => s + (num(c.importe) || 0), 0);
  const sumD = conceptos.filter((c) => c.tipo !== 'haber').reduce((s, c) => s + (num(c.importe) || 0), 0);
  const close = (a, b) => isFinite(a) && isFinite(b) && Math.abs(a - b) <= Math.max(2, Math.abs(b) * 0.001);
  const antig = yearsSince(d.fecha_ingreso);
  const checks = [
    ['Bruto − deducciones = neto', isFinite(bruto) && isFinite(ded) && isFinite(neto) ? close(bruto - ded, neto) : null, isFinite(neto) ? `${ars(bruto)} − ${ars(ded)}` : 'Faltan importes'],
    ['Suma de haberes = bruto', conceptos.length ? close(sumH, bruto) : null, conceptos.length ? ars(sumH) : 'Sin detalle'],
    ['Suma de deducciones = total', conceptos.length ? close(sumD, ded) : null, conceptos.length ? ars(sumD) : 'Sin detalle'],
    ['Aportes de ley ≈ 17 % del bruto', isFinite(bruto) && isFinite(ded) ? ded / bruto > 0.13 && ded / bruto < 0.25 : null, isFinite(bruto) && bruto ? `${(ded / bruto * 100).toFixed(1)} %` : '—'],
    ['Antigüedad ≥ 1 año', antig != null ? antig >= 1 : null, antig != null ? `${antig} año${antig === 1 ? '' : 's'}` : 'Sin fecha de ingreso'],
  ];
  const alerts = Array.isArray(d.alertas) ? d.alertas.filter(Boolean) : [];
  const failed = checks.filter((c) => c[1] === false).length;
  const v = failed ? ['bad', '✕', 'El recibo no cierra', 'Pedir documentación adicional']
    : alerts.length ? ['warn', '!', 'Consistente, con alertas', 'Revisar las alertas antes de avanzar']
      : ['ok', '✓', 'Recibo consistente', 'Se puede usar el neto para la pre-evaluación'];

  el.innerHTML = `
    ${verdictHTML(...v)}
    <dl class="fields">
      <div><dt>Empleado</dt><dd>${esc(d.empleado || '—')}</dd></div>
      <div><dt>CUIL</dt><dd>${esc(d.cuil_empleado || '—')}</dd></div>
      <div><dt>Empleador</dt><dd>${esc(d.empleador || '—')}</dd></div>
      <div><dt>CUIT empleador</dt><dd>${esc(d.cuit_empleador || '—')}</dd></div>
      <div><dt>Período</dt><dd>${esc(d.periodo || '—')}</dd></div>
      <div><dt>Neto a cobrar</dt><dd>${ars(neto)}</dd></div>
    </dl>
    ${conceptos.length ? `<h3 class="section-title">Conceptos</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Concepto</th><th class="num">Haberes</th><th class="num">Deducciones</th></tr></thead>
      <tbody>${conceptos.map((c) => `<tr><td>${esc(c.concepto)}</td><td class="num">${c.tipo === 'haber' ? ars(num(c.importe)) : ''}</td><td class="num">${c.tipo !== 'haber' ? ars(num(c.importe)) : ''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Totales</td><td class="num">${ars(bruto)}</td><td class="num">${ars(ded)}</td></tr></tfoot>
    </table></div>` : ''}
    <h3 class="section-title">Controles</h3>
    ${checksHTML(checks)}
    ${d.observaciones ? `<h3 class="section-title">Observaciones del modelo</h3><p class="quote">${esc(d.observaciones)}</p>` : ''}
    ${alerts.length ? `<h3 class="section-title">Alertas</h3><ul class="alerts">${alerts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    <h3 class="section-title">Simulador de préstamo personal</h3>
    <div class="sim">
      <label class="field">Relación cuota / ingreso (%)<input type="number" id="simRatio" min="5" max="50" step="1" value="30"></label>
      <label class="field">Plazo (meses)
        <select id="simPlazo">${[12, 18, 24, 36, 48, 60].map((m) => `<option ${m === 36 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="field">TNA (%)<input type="number" id="simTna" min="1" max="300" step="0.5" value="55"></label>
    </div>
    <div class="sim-out" id="simOut"></div>
    <p class="fineprint">Simulación ilustrativa con sistema francés, sin impuestos ni seguros. No constituye una oferta de crédito.</p>`;

  const recalc = () => {
    const ratio = parseFloat($('#simRatio', el).value) / 100;
    const n = parseInt($('#simPlazo', el).value, 10);
    const i = parseFloat($('#simTna', el).value) / 100 / 12;
    const cuota = isFinite(neto) ? neto * ratio : NaN;
    const monto = i > 0 ? cuota * (1 - Math.pow(1 + i, -n)) / i : cuota * n;
    $('#simOut', el).innerHTML = `
      <div class="stat"><div class="k">Cuota máxima mensual</div><div class="v">${ars(cuota)}</div></div>
      <div class="stat hl"><div class="k">Monto máximo prestable</div><div class="v">${ars(monto)}</div></div>
      <div class="stat"><div class="k">Total a devolver</div><div class="v">${ars(cuota * n)}</div></div>`;
  };
  $$('#simRatio, #simPlazo, #simTna', el).forEach((x) => x.addEventListener('input', recalc));
  recalc();
}

/* ---------- Render: Fraude */
function renderFraude(d, el) {
  const risk = Math.max(0, Math.min(100, Number(d.riesgo) || 0));
  const ver = String(d.veredicto || '').toLowerCase();
  const kind = ver.startsWith('fraude') ? 'bad' : ver.startsWith('sospech') ? 'warn' : 'ok';
  const title = kind === 'bad' ? 'Fraude' : kind === 'warn' ? 'Sospechoso' : 'Parece legítimo';
  const color = kind === 'bad' ? 'var(--bad)' : kind === 'warn' ? 'var(--warn)' : 'var(--ok)';
  const senales = Array.isArray(d.senales) ? d.senales : [];
  const urls = Array.isArray(d.urls) ? d.urls.filter(Boolean) : [];
  const acciones = Array.isArray(d.acciones_internas) ? d.acciones_internas : [];
  el.innerHTML = `
    ${verdictHTML(kind, kind === 'ok' ? '✓' : '!', `${title} · riesgo ${risk}/100`, [d.tipo, d.canal].filter(Boolean).join(' · '))}
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${risk}" aria-label="Riesgo"><span style="width:${risk}%;background:${color}"></span></div>
    <dl class="fields" style="margin-top:14px">
      <div><dt>Remitente</dt><dd>${esc(d.remitente || '—')}</dd></div>
      <div><dt>Canal</dt><dd>${esc(d.canal || '—')}</dd></div>
    </dl>
    ${urls.length ? `<h3 class="section-title">Links detectados (no abrir)</h3><div class="urls">${urls.map((u) => `<span class="url">${esc(u)}</span>`).join('')}</div>` : ''}
    ${senales.length ? `<h3 class="section-title">Señales de fraude</h3><ul class="signals">${senales.map((s) => `<li><b>${esc(s.senal || s.señal || '')}</b><span>${esc(s.detalle || '')}</span></li>`).join('')}</ul>` : ''}
    ${d.respuesta_al_cliente ? `<h3 class="section-title">Respuesta sugerida al cliente</h3>
      <p class="quote">${esc(d.respuesta_al_cliente)}</p>
      <div class="row" style="margin-top:8px"><button class="btn ghost small" id="copyReply">Copiar respuesta</button></div>` : ''}
    ${acciones.length ? `<h3 class="section-title">Acciones internas</h3><ul class="plain">${acciones.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`;
  $('#copyReply', el)?.addEventListener('click', (e) => copyText(d.respuesta_al_cliente, e.currentTarget));
}

/* =========================================================================
   Chat libre
   ========================================================================= */
const chat = { turns: [], pending: [], ctl: null };
const DEFAULT_SYSTEM = 'Sos un asistente para empleados de un banco argentino. Respondés en español rioplatense, de forma clara y breve. Si te mandan una imagen, describí lo relevante para el caso bancario. Si no sabés algo, decilo; no inventes normativa, tasas ni datos de clientes.';

function buildChatPanel() {
  const p = document.createElement('section');
  p.className = 'panel'; p.id = 'panel-chat'; p.setAttribute('role', 'tabpanel'); p.hidden = true;
  p.innerHTML = `
    <div class="panel-head">
      <span class="eyebrow">Caso libre</span>
      <h1>Chat multimodal</h1>
      <p>Para preguntas del público: texto e imágenes (gráficos, formularios, capturas de pantalla).</p>
    </div>
    <div class="chat">
      <details class="prompt card"><summary>Instrucciones de sistema</summary><textarea id="chatSystem" rows="4"></textarea></details>
      <div class="card chat-log" id="chatLog" aria-live="polite"><div class="empty" id="chatEmpty">Escribí una pregunta o adjuntá una imagen o PDF.</div></div>
      <div class="suggestions" id="chatSugg">
        <button>Explicame qué es el CFT de un préstamo como se lo explicaría a un cliente</button>
        <button>Redactá un aviso para clientes sobre cómo reconocer mensajes falsos del banco</button>
        <button>¿Qué datos de esta imagen servirían para un legajo de crédito?</button>
      </div>
      <div class="chat-compose">
        <div class="attachments" id="chatAtt"></div>
        <textarea id="chatInput" placeholder="Escribí tu mensaje… (${MOD}+Enter para enviar)"></textarea>
        <div class="row">
          <input type="file" id="chatFile" accept="image/*,application/pdf,.pdf" multiple hidden>
          <button class="btn ghost small" id="chatAttach">Adjuntar imagen o PDF</button>
          <button class="btn ghost small" id="chatClear">Nueva conversación</button>
          <span class="spacer"></span>
          <button class="btn ghost" id="chatStop" hidden>Detener</button>
          <button class="btn primary" id="chatSend">Enviar</button>
        </div>
      </div>
    </div>`;
  $('#panels').append(p);
  $('#chatSystem').value = DEFAULT_SYSTEM;

  $('#chatAttach').addEventListener('click', () => $('#chatFile').click());
  $('#chatFile').addEventListener('change', async (e) => {
    for (const f of e.target.files) await addChatImage(f);
    e.target.value = '';
  });
  $('#chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendChat(); });
  $('#chatSend').addEventListener('click', sendChat);
  $('#chatStop').addEventListener('click', () => chat.ctl?.abort());
  $('#chatClear').addEventListener('click', () => {
    chat.ctl?.abort(); chat.turns = []; chat.pending = []; renderAttachments();
    $('#chatLog').innerHTML = '<div class="empty" id="chatEmpty">Escribí una pregunta o adjuntá una imagen o PDF.</div>';
  });
  $('#chatSugg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { $('#chatInput').value = b.textContent; $('#chatInput').focus(); }
  });
}

async function addChatImage(file) {
  if (!isSupported(file)) return toast('Formato no soportado: usá una imagen o un PDF.');
  if (isPdf(file)) {
    try {
      const { pages, total } = await pdfPages(file, 1200);
      pages.forEach((c) => chat.pending.push(c.toDataURL('image/jpeg', 0.85)));
      if (total > PDF_MAX_PAGES) toast(`El PDF tiene ${total} páginas: se adjuntan las primeras ${PDF_MAX_PAGES}.`);
    } catch (e) { toast(e.message); }
  } else chat.pending.push(await fileToDataURL(file));
  renderAttachments();
}
function renderAttachments() {
  $('#chatAtt').innerHTML = chat.pending.map((src, i) =>
    `<figure><img src="${src}" alt="Adjunto ${i + 1}"><button data-i="${i}" aria-label="Quitar adjunto">✕</button></figure>`).join('');
  $$('#chatAtt button').forEach((b) => b.addEventListener('click', () => { chat.pending.splice(+b.dataset.i, 1); renderAttachments(); }));
}
function addBubble(role, text, images = []) {
  $('#chatEmpty')?.remove();
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  images.forEach((src) => { const im = document.createElement('img'); im.src = src; im.alt = 'Imagen adjunta'; div.append(im); });
  const t = document.createElement('span'); t.className = 'txt'; t.textContent = text; div.append(t);
  $('#chatLog').append(div);
  $('#chatLog').scrollTop = $('#chatLog').scrollHeight;
  return div;
}

async function sendChat() {
  const text = $('#chatInput').value.trim();
  if ((!text && !chat.pending.length) || chat.ctl) return;
  const images = chat.pending.splice(0);
  renderAttachments();
  $('#chatInput').value = '';
  addBubble('user', text, images);
  const content = images.length
    ? [{ type: 'text', text: text || 'Describí esta imagen.' }, ...images.map((u) => ({ type: 'image_url', image_url: { url: u } }))]
    : text;
  chat.turns.push({ role: 'user', content });

  const bubble = addBubble('assistant', 'Pensando…');
  const txt = $('.txt', bubble);
  chat.ctl = new AbortController();
  $('#chatSend').disabled = true; $('#chatStop').hidden = false;
  try {
    const sys = $('#chatSystem').value.trim();
    const messages = [...(sys ? [{ role: 'system', content: sys }] : []), ...chat.turns];
    const res = await callModel({
      messages, signal: chat.ctl.signal, mockKey: 'chat',
      onText: (t, th) => {
        txt.textContent = t || (th ? 'Razonando…' : 'Pensando…');
        $('#chatLog').scrollTop = $('#chatLog').scrollHeight;
      },
    });
    txt.textContent = res.text;
    chat.turns.push({ role: 'assistant', content: res.text });
    const meta = document.createElement('span');
    meta.className = 'meta';
    const out = res.usage?.completion_tokens ?? res.estOut;
    meta.textContent = `${res.model} · ${fmtMs(res.total)} · ${res.usage ? '' : '~'}${intFmt(out)} tokens`;
    bubble.append(meta);
  } catch (e) {
    chat.turns.pop();
    bubble.className = 'msg error';
    txt.textContent = e.name === 'AbortError' ? 'Se detuvo la respuesta.' : e.message;
    if (e.name !== 'AbortError') markConn('error');
  } finally {
    chat.ctl = null;
    $('#chatSend').disabled = false; $('#chatStop').hidden = true;
  }
}

/* =========================================================================
   Migrar en 3 líneas
   ========================================================================= */
let migLang = 'python';

function buildMigrationPanel() {
  const p = document.createElement('section');
  p.className = 'panel'; p.id = 'panel-migrar'; p.setAttribute('role', 'tabpanel'); p.hidden = true;
  p.innerHTML = `
    <div class="panel-head">
      <span class="eyebrow">Migración</span>
      <h1>El mismo código, otro proveedor</h1>
      <p>El servicio usa la misma API que OpenAI. Si el banco ya tiene código con el SDK de OpenAI, migrar es cambiar la URL, la clave y el nombre del modelo. El código de la derecha se arma con lo que cargaste en Configuración.</p>
    </div>
    <div class="diff-summary" id="migSummary"></div>
    <div class="lang-tabs" id="migLangs">
      <button data-l="python">Python</button><button data-l="node">JavaScript</button><button data-l="curl">cURL</button>
    </div>
    <div class="mig" id="migCode"></div>
    <h3 class="section-title" style="margin-top:28px">Último request enviado por esta app</h3>
    <div class="code-card" id="lastReq">
      <header><b>POST</b><span id="lastReqUrl">Todavía no se envió ningún request</span><button class="copy" id="copyLastReq">Copiar</button></header>
      <pre id="lastReqBody"><span class="ln">—</span></pre>
    </div>`;
  $('#panels').append(p);
  $('#migLangs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { migLang = b.dataset.l; renderMigration(); }
  });
  $('#copyLastReq').addEventListener('click', (e) => lastRequest && copyText(JSON.stringify(redactPayload(lastRequest.payload), null, 2), e.currentTarget));
}

function codeFor(lang, { base, key, model, url }) {
  // Cada línea: [texto, cambia?]
  if (lang === 'python') return [
    ['import os, base64', 0],
    ['from openai import OpenAI', 0],
    ['', 0],
    ['client = OpenAI(', 0],
    [`    base_url="${base}",`, 1],
    [`    api_key=os.environ["${key}"],`, 1],
    [')', 0],
    ['', 0],
    ['img = base64.b64encode(open("dni.jpg", "rb").read()).decode()', 0],
    ['', 0],
    ['resp = client.chat.completions.create(', 0],
    [`    model="${model}",`, 1],
    ['    messages=[{', 0],
    ['        "role": "user",', 0],
    ['        "content": [', 0],
    ['            {"type": "text", "text": "Extraé los datos del DNI en JSON"},', 0],
    ['            {"type": "image_url",', 0],
    ['             "image_url": {"url": f"data:image/jpeg;base64,{img}"}},', 0],
    ['        ],', 0],
    ['    }],', 0],
    [')', 0],
    ['print(resp.choices[0].message.content)', 0],
  ];
  if (lang === 'node') return [
    ['import OpenAI from "openai";', 0],
    ['import fs from "node:fs";', 0],
    ['', 0],
    ['const client = new OpenAI({', 0],
    [`  baseURL: "${base}",`, 1],
    [`  apiKey: process.env.${key},`, 1],
    ['});', 0],
    ['', 0],
    ['const img = fs.readFileSync("dni.jpg").toString("base64");', 0],
    ['', 0],
    ['const resp = await client.chat.completions.create({', 0],
    [`  model: "${model}",`, 1],
    ['  messages: [{', 0],
    ['    role: "user",', 0],
    ['    content: [', 0],
    ['      { type: "text", text: "Extraé los datos del DNI en JSON" },', 0],
    ['      { type: "image_url",', 0],
    ['        image_url: { url: `data:image/jpeg;base64,${img}` } },', 0],
    ['    ],', 0],
    ['  }],', 0],
    ['});', 0],
    ['console.log(resp.choices[0].message.content);', 0],
  ];
  return [
    [`curl ${url} \\`, 1],
    [`  -H "Authorization: Bearer $${key}" \\`, 1],
    ['  -H "Content-Type: application/json" \\', 0],
    ['  -d \'{', 0],
    [`    "model": "${model}",`, 1],
    ['    "messages": [{', 0],
    ['      "role": "user",', 0],
    ['      "content": [', 0],
    ['        {"type": "text", "text": "Extraé los datos del DNI en JSON"},', 0],
    ['        {"type": "image_url",', 0],
    ['         "image_url": {"url": "data:image/jpeg;base64,..."}}', 0],
    ['      ]', 0],
    ['    }]', 0],
    ['  }\'', 0],
  ];
}

function codeCardHTML(title, sub, lines, id) {
  const text = lines.map((l) => l[0]).join('\n');
  return `<div class="code-card">
    <header><b>${esc(title)}</b><span>${esc(sub)}</span><button class="copy" data-copy="${id}">Copiar</button></header>
    <pre>${lines.map(([t, chg]) => `<span class="ln${chg ? ' chg' : ''}">${esc(t) || ' '}</span>`).join('')}</pre>
    <textarea hidden id="${id}">${esc(text)}</textarea>
  </div>`;
}

function renderMigration() {
  if (!$('#migCode')) return;
  const c = getConfig();
  const before = { base: 'https://api.openai.com/v1', key: 'OPENAI_API_KEY', model: 'gpt-4o', url: 'https://api.openai.com/v1/chat/completions' };
  const after = { base: baseUrl(c.endpoint), key: 'MAAS_API_KEY', model: c.model || 'deepseek-v4.1', url: chatUrl(c.endpoint) };
  $$('#migLangs button').forEach((b) => b.classList.toggle('active', b.dataset.l === migLang));
  $('#migSummary').innerHTML = [
    ['Endpoint', before.base, after.base],
    ['API key', 'OPENAI_API_KEY', 'MAAS_API_KEY'],
    ['Modelo', before.model, after.model],
  ].map(([k, a, b]) => `<div class="stat"><div class="k">${esc(k)}</div><div class="from">${esc(a)}</div><div class="v">${esc(b)}</div></div>`).join('');
  $('#migCode').innerHTML =
    codeCardHTML('Antes', 'OpenAI', codeFor(migLang, before), 'codeBefore') +
    codeCardHTML('Después', 'MaaS · ' + after.model, codeFor(migLang, after), 'codeAfter');
  $$('#migCode .copy').forEach((b) => b.addEventListener('click', () => copyText($('#' + b.dataset.copy).value, b)));
}

function redactPayload(payload) {
  return JSON.parse(JSON.stringify(payload, (k, v) =>
    (typeof v === 'string' && v.startsWith('data:image/')) ? `${v.slice(0, 40)}… (${intFmt(v.length / 1024)} KB)` : v));
}
function renderLastRequest() {
  if (!$('#lastReqBody') || !lastRequest) return;
  $('#lastReqUrl').textContent = lastRequest.url;
  const json = JSON.stringify(redactPayload(lastRequest.payload), null, 2);
  $('#lastReqBody').innerHTML = json.split('\n').map((l) => `<span class="ln">${esc(l)}</span>`).join('');
}

/* =========================================================================
   Probar conexión y arranque
   ========================================================================= */
function markConn(state) { connState = state; updateStatus(); }

async function testConnection() {
  saveConfig();
  const out = $('#testResult'), btn = $('#testConn');
  out.className = 'test-result'; out.textContent = 'Probando…';
  btn.disabled = true;
  try {
    const r = await callModel({
      messages: [{ role: 'user', content: 'Respondé solamente con la palabra OK.' }],
      mockKey: 'ping',
      overrides: { max_tokens: 512, stream: false },
    });
    out.className = 'test-result ok';
    out.innerHTML = `<b>Conectado</b> en ${fmtMs(r.total)} · modelo <code>${esc(r.model)}</code><br>Respondió: “${esc(r.text.trim().slice(0, 80) || '(vacío)')}”`;
    markConn('ok');
  } catch (e) {
    out.className = 'test-result err';
    out.innerHTML = `<b>No se pudo conectar.</b> ${esc(e.message)}`;
    markConn('error');
  } finally {
    btn.disabled = false;
  }
}

function init() {
  loadConfig();
  buildTabs();
  CASES.forEach(buildCasePanel);
  buildChatPanel();
  buildMigrationPanel();

  const hash = location.hash.slice(1);
  const initial = TABS.some((t) => t.id === hash) ? hash : (store.get('maasBanca.tab') || 'kyc');
  selectTab(TABS.some((t) => t.id === initial) ? initial : 'kyc');

  $$('#config input').forEach((i) => i.addEventListener('input', () => {
    if (['cfgEndpoint', 'cfgKey', 'cfgModel'].includes(i.id)) connState = null;
    saveConfig(); updateStatus();
  }));
  $('#showKey').addEventListener('click', (e) => {
    const k = $('#cfgKey');
    k.type = k.type === 'password' ? 'text' : 'password';
    e.currentTarget.textContent = k.type === 'password' ? 'Ver' : 'Ocultar';
  });
  $('#testConn').addEventListener('click', testConnection);
  $('#resetUsage').addEventListener('click', () => { Object.assign(usage, { req: 0, inTok: 0, outTok: 0, lat: 0, estimated: false }); renderUsage(); });
  $('#toggleConfig').addEventListener('click', (e) => {
    const open = $('#config').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });

  // Pegar imágenes con Ctrl+V en la pestaña activa
  window.addEventListener('paste', (e) => {
    const file = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
    if (!file) return;
    const tab = activeTab();
    const c = CASES.find((x) => x.id === tab);
    if (c) { e.preventDefault(); c.takeFile(file); }
    else if (tab === 'chat') { e.preventDefault(); addChatImage(file); }
  });

  updateStatus();
  renderUsage();
}

init();
