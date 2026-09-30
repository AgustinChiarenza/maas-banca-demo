// Agente de sucursal: function calling + RAG sobre el mismo endpoint MaaS.
// El modelo decide qué herramientas llamar; el navegador las ejecuta (core simulado,
// búsqueda BM25 en la base de conocimiento, simulador, tickets) y le devuelve el resultado,
// hasta que el modelo responde sin pedir más herramientas.
// Usa helpers de app.js ($, esc, callModel, …): se cargan antes de que se llame a nada de acá.

const AG_MAX_STEPS = 8;

/* =========================================================================
   RAG: índice BM25 en memoria (sin embeddings, sin dependencias)
   ========================================================================= */
const AG_STOP = new Set(('a al algo ante antes como con cual cuando de del desde donde el ella en entre era es esa ese esta este esto fue ha hay la las le les lo los mas me mi muy no o para pero por que se si sin sobre su sus te tiene todo tu un una uno y ya').split(' '));

function agTokens(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !AG_STOP.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(es|s)$/, '') : w)); // plural → singular, suficiente para la demo
}

const agIndex = { chunks: [], df: new Map(), avgdl: 1 };

function agBuildIndex() {
  const chunks = AGENT_DATA.documentos.flatMap((d) => d.secciones.map((s) => ({
    id: `${d.id} §${s.n}`, documento: d.titulo, titulo: s.titulo, texto: s.texto,
  })));
  const df = new Map();
  for (const c of chunks) {
    c.tokens = agTokens(`${c.documento} ${c.titulo} ${c.titulo} ${c.texto}`); // el título pesa doble
    for (const t of new Set(c.tokens)) df.set(t, (df.get(t) || 0) + 1);
  }
  const avgdl = chunks.reduce((s, c) => s + c.tokens.length, 0) / (chunks.length || 1);
  Object.assign(agIndex, { chunks, df, avgdl });
}

function agSearch(query, k = 4) {
  const { chunks, df, avgdl } = agIndex, N = chunks.length, k1 = 1.2, b = 0.75;
  const terms = [...new Set(agTokens(query))];
  return chunks.map((c) => {
    let score = 0;
    for (const t of terms) {
      const f = c.tokens.reduce((n, x) => n + (x === t), 0);
      if (!f) continue;
      const n = df.get(t);
      score += Math.log(1 + (N - n + 0.5) / (n + 0.5)) * f * (k1 + 1) / (f + k1 * (1 - b + b * c.tokens.length / avgdl));
    }
    return { c, score };
  }).filter((r) => r.score > 0).sort((x, y) => y.score - x.score).slice(0, k);
}

/* =========================================================================
   Herramientas (definición para el modelo + ejecución local)
   ========================================================================= */
const AG_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buscar_cliente',
      description: 'Consulta el core bancario por DNI. Devuelve edad, situación laboral, antigüedad, ingreso neto mensual, si cobra haberes en el banco, situación en la Central de Deudores (BCRA), score interno, productos, cuotas vigentes y alertas.',
      parameters: { type: 'object', properties: { dni: { type: 'string', description: 'DNI sin puntos' } }, required: ['dni'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_politicas',
      description: 'Busca en la base de conocimiento del banco (políticas de crédito, tarifario, antifraude, alta de clientes, preguntas frecuentes). Devuelve los fragmentos más relevantes con un id para citar. Hacé una búsqueda por tema; se puede llamar varias veces.',
      parameters: {
        type: 'object',
        properties: {
          consulta: { type: 'string', description: 'Qué buscar, en palabras clave' },
          cantidad: { type: 'integer', description: 'Cantidad de fragmentos (1 a 6, por defecto 4)' },
        },
        required: ['consulta'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simular_prestamo',
      description: 'Calcula un préstamo en sistema francés: cuota mensual, total e intereses. Si se pasan ingreso_neto y cuotas_vigentes, calcula la relación cuota/ingreso total (cuota nueva + cuotas vigentes). Usar siempre esta herramienta en lugar de calcular a mano.',
      parameters: {
        type: 'object',
        properties: {
          monto: { type: 'number', description: 'Capital en pesos' },
          plazo_meses: { type: 'integer' },
          tna: { type: 'number', description: 'Tasa nominal anual en porcentaje, por ejemplo 55' },
          ingreso_neto: { type: 'number', description: 'Ingreso neto mensual del cliente' },
          cuotas_vigentes: { type: 'number', description: 'Suma de las cuotas mensuales que el cliente ya paga' },
        },
        required: ['monto', 'plazo_meses', 'tna'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_ticket',
      description: 'Registra un ticket en el sistema de gestión del banco: pre-aprobación, derivación a gerente o comité, pedido de documentación o sospecha de fraude.',
      parameters: {
        type: 'object',
        properties: {
          dni: { type: 'string' },
          tipo: { type: 'string', enum: ['preaprobacion', 'derivacion_gerente', 'derivacion_comite', 'documentacion', 'fraude'] },
          prioridad: { type: 'string', enum: ['baja', 'media', 'alta'] },
          resumen: { type: 'string', description: 'Resumen del caso y motivo, citando la política aplicada' },
        },
        required: ['tipo', 'resumen'],
      },
    },
  },
];

const agTickets = [];

const AG_RUN = {
  buscar_cliente({ dni }) {
    const d = String(dni ?? '').replace(/\D/g, '');
    const c = AGENT_DATA.clientes.find((x) => x.dni === d);
    if (!c) return { encontrado: false, mensaje: `No hay ningún cliente con DNI ${d}.` };
    return { encontrado: true, ...c, edad: yearsSince(c.fecha_nacimiento) };
  },
  buscar_politicas({ consulta, cantidad }) {
    const k = Math.min(6, Math.max(1, parseInt(cantidad, 10) || 4));
    return {
      consulta,
      resultados: agSearch(consulta || '', k).map(({ c, score }) => ({
        id: c.id, documento: c.documento, titulo: c.titulo, score: +score.toFixed(2), texto: c.texto,
      })),
    };
  },
  simular_prestamo({ monto, plazo_meses, tna, ingreso_neto, cuotas_vigentes }) {
    const P = Number(monto), n = parseInt(plazo_meses, 10), t = Number(tna), i = t / 100 / 12;
    if (!(P > 0 && n > 0 && t >= 0)) return { error: 'monto, plazo_meses y tna tienen que ser números positivos' };
    const cuota = i > 0 ? P * i / (1 - (1 + i) ** -n) : P / n;
    const r = { monto: P, plazo_meses: n, tna: t, cuota_mensual: Math.round(cuota), total_a_pagar: Math.round(cuota * n), intereses: Math.round(cuota * n - P) };
    if (Number(ingreso_neto) > 0) {
      const prev = Number(cuotas_vigentes) || 0;
      Object.assign(r, {
        ingreso_neto: Number(ingreso_neto), cuotas_vigentes: prev, cuota_total_mensual: Math.round(cuota + prev),
        relacion_cuota_ingreso_pct: +((cuota + prev) / ingreso_neto * 100).toFixed(1),
      });
    }
    return r;
  },
  crear_ticket({ dni, tipo, prioridad = 'media', resumen }) {
    const t = { id: `TCK-${1041 + agTickets.length}`, dni: dni || null, tipo, prioridad, resumen, creado: new Date().toLocaleString('es-AR') };
    agTickets.push(t);
    agRenderTickets();
    return { ok: true, ticket: t.id, estado: 'abierto' };
  },
};

/* =========================================================================
   Panel
   ========================================================================= */
const AG_SUGGESTIONS = [
  'La clienta DNI 30.123.456 pide un préstamo personal de $5.000.000 a 36 meses. ¿Califica? Si califica, dejá registrada la pre-aprobación.',
  'Jorge Ferreyra (DNI 27.987.654) quiere $8.000.000 a 48 meses. ¿Qué le respondemos?',
  'DNI 35.555.111 pide $2.000.000 a 24 meses. Evaluá y hacé lo que corresponda según política.',
  'Un jubilado con DNI 20.111.222 pide $6.000.000 a 60 meses. ¿Se puede? Si no, ¿qué alternativa le ofrecemos?',
  'Un cliente viene acompañado de alguien que habla por él y quiere transferir el préstamo apenas se acredite. ¿Qué hago?',
];

function agSystemPrompt() {
  return `Sos el Agente de Sucursal de Banco Demo (entidad ficticia). Ayudás a oficiales de cuentas a resolver pedidos de clientes usando herramientas. Hoy es ${new Date().toLocaleDateString('es-AR')}.

Reglas:
1. Nunca inventes datos de clientes, tasas ni políticas: obtenelos con las herramientas.
2. Para evaluar un préstamo: buscar_cliente, luego buscar_politicas (requisitos, capacidad de pago, Central de Deudores, montos, niveles de aprobación y tasa del tarifario) y luego simular_prestamo con la TNA que corresponda según el tarifario, pasando ingreso_neto y la suma de cuotas_vigentes.
3. Podés llamar varias herramientas en paralelo cuando no dependen entre sí.
4. Citá cada regla que apliques con su id entre corchetes, por ejemplo [POL-PP §3].
5. Si el caso requiere derivación (gerente o comité), o si el oficial lo pide y el cliente califica, usá crear_ticket. Si no califica, no crees ticket.
6. Respuesta final: primera línea "Veredicto: APROBABLE", "Veredicto: DERIVAR" o "Veredicto: NO CALIFICA" (omitila si la consulta no es sobre un préstamo). Después, fundamentos en viñetas con los números clave y citas, y al final los próximos pasos. Español rioplatense, breve y concreto.`;
}

function buildAgentPanel() {
  agBuildIndex();
  const p = document.createElement('section');
  p.className = 'panel'; p.id = 'panel-agente'; p.setAttribute('role', 'tabpanel'); p.hidden = true;
  p.innerHTML = `
    <div class="panel-head">
      <span class="eyebrow">Caso 4 · Agente con herramientas y RAG</span>
      <h1>Agente de sucursal</h1>
      <p>El oficial pide algo en lenguaje natural. El modelo decide qué herramientas usar (core bancario, políticas del banco, simulador, tickets), encadena los pasos y responde citando la política aplicada. Todo por el mismo endpoint MaaS, con <i>function calling</i> estándar.</p>
    </div>
    <div class="case">
      <div class="col">
        <div class="card ag-ask">
          <label class="field">Pedido del oficial
            <textarea id="agInput" rows="4" placeholder="Ej.: El cliente DNI 30.123.456 pide $5.000.000 a 36 meses, ¿califica? (${MOD}+Enter para ejecutar)"></textarea>
          </label>
          <div class="suggestions" id="agSugg">${AG_SUGGESTIONS.map((s) => `<button>${esc(s)}</button>`).join('')}</div>
          <div class="row">
            <button class="btn primary" id="agRun">Ejecutar agente</button>
            <button class="btn ghost" id="agStop" hidden>Detener</button>
          </div>
        </div>
        <details class="card prompt"><summary>Instrucciones del agente</summary><textarea id="agSystem" rows="16" spellcheck="false"></textarea></details>
        <details class="card prompt"><summary>Herramientas que puede usar (${AG_TOOLS.length})</summary>
          <ul class="ag-tools">${AG_TOOLS.map(({ function: f }) => `<li><code>${esc(f.name)}(${esc(Object.keys(f.parameters.properties).join(', '))})</code><span>${esc(f.description)}</span></li>`).join('')}</ul>
        </details>
        <details class="card prompt" id="agKb"><summary>Base de conocimiento · <span id="agKbCount"></span></summary>
          <p class="fineprint">Documentos ficticios de “Banco Demo”, divididos por sección e indexados con BM25 en el navegador. El agente los consulta con <code>buscar_politicas</code>.</p>
          <label class="field">Probar la búsqueda<input id="agKbQuery" placeholder="Ej.: tasa para jubilados a 48 meses" autocomplete="off"></label>
          <ol class="ag-hits" id="agKbHits"></ol>
          <div class="ag-docs" id="agKbDocs"></div>
          <details class="ag-add"><summary>Agregar un documento propio</summary>
            <label class="field">Título<input id="agDocTitle" placeholder="Ej.: Circular interna 12/2026" autocomplete="off"></label>
            <label class="field">Texto (cada párrafo separado por una línea en blanco se indexa como una sección)<textarea id="agDocText" rows="6"></textarea></label>
            <button class="btn ghost small" id="agDocAdd">Agregar al índice</button>
          </details>
        </details>
        <div class="card" id="agTicketsCard" hidden>
          <h3 class="section-title">Tickets creados por el agente</h3>
          <ul class="ag-tickets" id="agTickets"></ul>
        </div>
      </div>
      <div class="col">
        <div class="metrics" id="agMetrics"></div>
        <div class="card out">
          <div class="out-tabs"><button class="active" data-v="trace">Traza del agente</button><button data-v="msgs">Mensajes (JSON)</button></div>
          <div class="out-body">
            <ol class="ag-trace" id="agTrace"><li class="empty">Elegí un ejemplo o escribí un pedido y tocá “Ejecutar agente”. Acá vas a ver cada decisión del modelo y cada herramienta que usa.</li></ol>
            <pre class="raw" id="agMsgs" hidden></pre>
          </div>
        </div>
        <div class="card" id="agAnswerCard" hidden>
          <h3 class="section-title">Respuesta del agente</h3>
          <div id="agAnswer"></div>
        </div>
      </div>
    </div>`;
  $('#panels').append(p);
  $('#agSystem').value = agSystemPrompt();
  agRenderKb();

  $('#agSugg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { $('#agInput').value = b.textContent; $('#agInput').focus(); }
  });
  $('#agInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runAgent(); });
  $('#agRun').addEventListener('click', runAgent);
  $('#agStop').addEventListener('click', () => agent.ctl?.abort());
  $$('.out-tabs button', p).forEach((b) => b.addEventListener('click', () => {
    $$('.out-tabs button', p).forEach((x) => x.classList.toggle('active', x === b));
    $('#agTrace').hidden = b.dataset.v !== 'trace';
    $('#agMsgs').hidden = b.dataset.v !== 'msgs';
  }));
  $('#agKbQuery').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const hits = q ? agSearch(q, 4) : [];
    $('#agKbHits').innerHTML = hits.map(({ c, score }) => agHitHTML(c, score, hits[0].score)).join('') || (q ? '<li class="fineprint">Sin resultados.</li>' : '');
  });
  $('#agDocAdd').addEventListener('click', () => {
    const title = $('#agDocTitle').value.trim(), text = $('#agDocText').value.trim();
    if (!title || !text) return toast('Completá título y texto.');
    const id = `DOC${AGENT_DATA.documentos.filter((d) => d.id.startsWith('DOC')).length + 1}`;
    const secciones = text.split(/\n\s*\n/).map((t, i) => t.trim()).filter(Boolean)
      .map((t, i) => ({ n: String(i + 1), titulo: t.split('\n')[0].slice(0, 70), texto: t }));
    AGENT_DATA.documentos.push({ id, titulo: title, secciones });
    agBuildIndex(); agRenderKb();
    $('#agDocTitle').value = ''; $('#agDocText').value = '';
    toast(`“${title}” agregado como ${id} (${secciones.length} secciones).`);
  });
}

function agRenderKb() {
  $('#agKbCount').textContent = `${AGENT_DATA.documentos.length} documentos, ${agIndex.chunks.length} fragmentos`;
  $('#agKbDocs').innerHTML = AGENT_DATA.documentos.map((d) => `
    <details><summary><code>${esc(d.id)}</code> ${esc(d.titulo)} <span class="fineprint">· ${d.secciones.length}</span></summary>
      <ul class="plain">${d.secciones.map((s) => `<li><b>§${esc(s.n)} ${esc(s.titulo)}.</b> ${esc(s.texto)}</li>`).join('')}</ul>
    </details>`).join('');
}

function agHitHTML(c, score, max) {
  const w = Math.round(Math.min(1, score / (max || score || 1)) * 100);
  return `<li><div class="ag-hit-head"><code>${esc(c.id)}</code><b>${esc(c.titulo)}</b><span class="ag-score"><span style="width:${w}%"></span></span><span class="ag-num">${score.toFixed(2)}</span></div>
    <p>${esc(c.texto)}</p></li>`;
}

function agRenderTickets() {
  $('#agTicketsCard').hidden = !agTickets.length;
  $('#agTickets').innerHTML = agTickets.slice().reverse().map((t) => `
    <li><div><code>${esc(t.id)}</code> <span class="pill ${t.prioridad === 'alta' ? 'bad' : t.prioridad === 'media' ? 'warn' : 'na'}">${esc(t.prioridad)}</span>
      <b>${esc(t.tipo.replace(/_/g, ' '))}</b>${t.dni ? ` · DNI ${esc(fmtDNI(t.dni))}` : ''} <span class="fineprint">· ${esc(t.creado)}</span></div>
      <p>${esc(t.resumen)}</p></li>`).join('');
}

/* =========================================================================
   Bucle del agente
   ========================================================================= */
const agent = { ctl: null };

async function runAgent() {
  const q = $('#agInput').value.trim();
  if (!q || agent.ctl) return;
  agent.ctl = new AbortController();
  const { signal } = agent.ctl;
  $('#agRun').disabled = true; $('#agStop').hidden = false;
  $('#agTrace').innerHTML = '';
  $('#agAnswerCard').hidden = true;
  $$('#panel-agente .out-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.v === 'trace'));
  $('#agTrace').hidden = false; $('#agMsgs').hidden = true;

  const messages = [{ role: 'system', content: $('#agSystem').value.trim() }, { role: 'user', content: q }];
  const stats = { model: getConfig().model, steps: 0, tools: 0, inTok: 0, outTok: 0, est: false, t0: performance.now() };
  const renderStats = () => {
    $('#agMetrics').innerHTML = [
      ['Modelo', stats.model], ['Llamadas al modelo', stats.steps], ['Herramientas', stats.tools],
      ['Tokens entrada', intFmt(stats.inTok)], ['Tokens salida', (stats.est ? '~' : '') + intFmt(stats.outTok)],
      ['Total', fmtMs(performance.now() - stats.t0)],
    ].map(([k, v]) => `<span class="chip">${esc(k)} <b>${esc(v)}</b></span>`).join('');
    $('#agMsgs').textContent = JSON.stringify(messages, null, 2);
  };
  renderStats();

  try {
    for (let step = 1; step <= AG_MAX_STEPS; step++) {
      const last = step === AG_MAX_STEPS;
      if (last) messages.push({ role: 'user', content: 'Llegaste al máximo de pasos. Respondé ahora con la información que tenés.' });
      const li = agTraceItem('model', `Modelo · paso ${step}`, '<div class="thinking">Decidiendo qué hacer…</div>');
      const res = await agStep(messages, {
        tools: !last, signal,
        onText: (text, thinking) => {
          $('.step-body', li).innerHTML = text
            ? `<div class="ag-said">${esc(text)}</div>`
            : `<div class="thinking">${thinking ? 'Razonando…' : 'Decidiendo qué hacer…'}</div>`;
        },
      });
      stats.steps++;
      stats.model = res.model || stats.model;
      stats.inTok += res.usage?.prompt_tokens || 0;
      stats.outTok += res.usage?.completion_tokens ?? res.estOut ?? 0;
      if (!res.usage) stats.est = true;

      const calls = res.toolCalls || [];
      calls.forEach((tc, i) => { tc.id ||= `call_${step}_${i}`; tc.type ||= 'function'; });
      const msg = { role: 'assistant', content: res.text || null };
      if (res.reasoning && !getConfig().mock) msg.reasoning_content = res.reasoning; // DeepSeek lo pide de vuelta al usar herramientas con razonamiento
      if (calls.length) msg.tool_calls = calls;
      messages.push(msg);

      const out = res.usage?.completion_tokens ?? res.estOut;
      $('.step-meta', li).textContent = `${fmtMs(res.total)} · ${intFmt(res.usage?.prompt_tokens || 0)} → ${res.usage ? '' : '~'}${intFmt(out)} tok`;
      $('.step-body', li).innerHTML = (res.text && calls.length ? `<div class="ag-said">${esc(res.text)}</div>` : '')
        + (calls.length
          ? `<div>Decide llamar a ${calls.map((c) => `<code>${esc(c.function.name)}</code>`).join(' ')}${calls.length > 1 ? ' <span class="fineprint">(en paralelo)</span>' : ''}</div>`
          : '<div>Tiene lo que necesita y redacta la respuesta final.</div>')
        + (res.reasoning ? `<details class="reasoning"><summary>Razonamiento del modelo</summary><pre>${esc(res.reasoning)}</pre></details>` : '');
      renderStats();

      if (!calls.length) { agRenderAnswer(res.text); break; }

      for (const tc of calls) {
        const name = tc.function.name;
        let args = null;
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* se informa abajo */ }
        const t0 = performance.now();
        const result = !AG_RUN[name] ? { error: `Herramienta desconocida: ${name}` }
          : !args ? { error: 'Los argumentos no son JSON válido', recibido: tc.function.arguments }
            : AG_RUN[name](args);
        stats.tools++;
        agTraceItem('tool', name, agToolSummary(name, args, result), fmtMs(performance.now() - t0), { args, result });
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      renderStats();
    }
  } catch (e) {
    const aborted = e.name === 'AbortError';
    agTraceItem('error', aborted ? 'Detenido' : 'Error', aborted ? 'Se detuvo el agente.' : esc(agErrorHint(e.message)));
    if (!aborted) markConn('error');
  } finally {
    renderStats();
    agent.ctl = null;
    $('#agRun').disabled = false; $('#agStop').hidden = true;
  }
}

function agErrorHint(msg) {
  return /tool|function/i.test(msg)
    ? `${msg}\n\nEl endpoint o el modelo puede no soportar function calling ("tools"). Probá con otro modelo o activá el modo simulado.`
    : msg;
}

function agStep(messages, { tools, signal, onText }) {
  if (getConfig().mock) return agMockStep(messages, { tools, signal, onText });
  return callModel({ messages, signal, onText, overrides: tools ? { tools: AG_TOOLS, tool_choice: 'auto' } : {} });
}

/* ---------- Traza */
function agTraceItem(kind, title, bodyHTML, meta = '', data = null) {
  const li = document.createElement('li');
  li.className = `ag-step ${kind}`;
  li.innerHTML = `
    <div class="step-head"><span class="step-ico" aria-hidden="true">${{ model: '◆', tool: '⚙', error: '!' }[kind]}</span>
      <b>${kind === 'tool' ? `<code>${esc(title)}</code>` : esc(title)}</b><span class="step-meta">${esc(meta)}</span></div>
    <div class="step-body">${bodyHTML}</div>
    ${data ? `<details class="step-json"><summary>Argumentos y resultado</summary><pre>${esc(JSON.stringify(data, null, 2))}</pre></details>` : ''}`;
  $('#agTrace').append(li);
  li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return li;
}

function agToolSummary(name, args, r) {
  const argLine = args ? `<div class="ag-args">${Object.entries(args).map(([k, v]) => `<span><i>${esc(k)}</i> ${esc(typeof v === 'string' ? `"${v}"` : JSON.stringify(v))}</span>`).join('')}</div>` : '';
  if (r.error) return argLine + `<div class="error-box">${esc(r.error)}</div>`;
  let body = '';
  if (name === 'buscar_cliente') {
    body = r.encontrado
      ? `<dl class="fields ag-mini">
          <div><dt>Cliente</dt><dd>${esc(r.nombre)} · ${esc(r.edad)} años</dd></div>
          <div><dt>Situación laboral</dt><dd>${esc(r.situacion_laboral)} · ${esc(r.antiguedad_laboral_meses)} meses</dd></div>
          <div><dt>Ingreso neto</dt><dd>${ars(r.ingreso_neto_mensual)}${r.cobra_haberes_en_banco ? ' · cobra en el banco' : ''}</dd></div>
          <div><dt>Central de Deudores</dt><dd>Situación ${esc(r.situacion_bcra)}</dd></div>
          <div><dt>Cuotas vigentes</dt><dd>${ars(r.cuotas_vigentes.reduce((s, c) => s + c.cuota_mensual, 0))}</dd></div>
          ${r.alertas.length ? `<div><dt>Alertas</dt><dd>${esc(r.alertas.join('; '))}</dd></div>` : ''}
        </dl>`
      : `<div class="fineprint">${esc(r.mensaje)}</div>`;
  } else if (name === 'buscar_politicas') {
    const max = r.resultados[0]?.score;
    body = r.resultados.length
      ? `<ol class="ag-hits">${r.resultados.map((x) => agHitHTML(x, x.score, max)).join('')}</ol>`
      : '<div class="fineprint">Sin resultados.</div>';
  } else if (name === 'simular_prestamo') {
    body = `<div class="sim-out ag-sim">
      <div class="stat"><div class="k">Cuota mensual</div><div class="v">${ars(r.cuota_mensual)}</div></div>
      <div class="stat"><div class="k">Total a pagar</div><div class="v">${ars(r.total_a_pagar)}</div></div>
      ${r.relacion_cuota_ingreso_pct != null ? `<div class="stat hl"><div class="k">Cuota / ingreso (con vigentes)</div><div class="v">${String(r.relacion_cuota_ingreso_pct).replace('.', ',')} %</div></div>` : ''}
    </div>`;
  } else if (name === 'crear_ticket') {
    body = `<div>Ticket <code>${esc(r.ticket)}</code> abierto.</div>`;
  }
  return argLine + body;
}

/* ---------- Respuesta final con citas */
function agRenderAnswer(text) {
  const chunks = new Map(agIndex.chunks.map((c) => [c.id.replace(/\s+/g, ''), c]));
  const cited = new Map();
  const cite = (raw) => {
    const c = chunks.get(raw.replace(/\s+/g, ''));
    if (!c) return esc(raw);
    cited.set(c.id, c);
    return `<span class="cite" tabindex="0" title="${esc(`${c.documento} · ${c.titulo}: ${c.texto}`)}">${esc(c.id)}</span>`;
  };
  let t = String(text || '').trim();
  let verdict = '';
  const m = /^\s*(?:\*\*)?\s*Veredicto\s*:?\s*(?:\*\*)?\s*(APROBABLE|DERIVAR|NO CALIFICA)\b[^\n]*\n?/i.exec(t);
  if (m) {
    const k = m[1].toUpperCase();
    const v = { APROBABLE: ['ok', '✓', 'Aprobable', 'El cliente cumple la política'], DERIVAR: ['warn', '→', 'Derivar', 'Requiere aprobación de otra instancia'], 'NO CALIFICA': ['bad', '✕', 'No califica', 'No cumple la política'] }[k];
    verdict = verdictHTML(...v);
    t = t.slice(m[0].length).trim();
  }
  const html = esc(t)
    .replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]\n]*§[^\]\n]*)\]/g, (_, inner) => inner.split(/\s*[,;]\s*/).map(cite).join(' '));
  $('#agAnswer').innerHTML = `${verdict}<div class="ag-answer">${html}</div>${cited.size ? `
    <h3 class="section-title">Fuentes citadas</h3>
    <ul class="ag-sources">${[...cited.values()].map((c) => `<li><code>${esc(c.id)}</code> <b>${esc(c.documento)} · ${esc(c.titulo)}.</b> ${esc(c.texto)}</li>`).join('')}</ul>` : ''}`;
  $('#agAnswerCard').hidden = false;
  $('#agAnswerCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* =========================================================================
   Modo simulado: un "planificador" determinístico que imita al modelo
   ========================================================================= */
function agParseAsk(text) {
  const dni = /\b(\d{2}\.?\d{3}\.?\d{3})\b/.exec(text)?.[1].replace(/\D/g, '');
  let monto = null;
  const mm = /\$\s*([\d.,]+)\s*(millones|millón|mill|m\b)?/i.exec(text) || /([\d.,]+)\s*(millones|millón)/i.exec(text);
  if (mm) monto = parseFloat(mm[1].replace(/\./g, '').replace(',', '.')) * (mm[2] ? 1e6 : 1);
  const plazo = parseInt(/(\d{1,2})\s*(meses|cuotas)/i.exec(text)?.[1], 10) || null;
  return { dni, monto, plazo };
}

function agMockDecision(c, sim, ask) {
  const items = [];
  const add = (ok, txt, ref, level = ok ? 'ok' : 'bad') => items.push({ level, txt, ref });
  const edadFin = c.edad + ask.plazo / 12;
  add(edadFin <= 75, `Edad al vencimiento: ${Math.floor(edadFin)} años (máximo 75)`, 'POL-PP §2');
  const need = /monotrib|autónom/i.test(c.situacion_laboral) ? 24 : /jubilad|pension/i.test(c.situacion_laboral) ? 0 : 12;
  if (need) add(c.antiguedad_laboral_meses >= need, `Antigüedad laboral: ${c.antiguedad_laboral_meses} meses (mínimo ${need})`, 'POL-PP §2');
  if (c.situacion_bcra === 1) add(true, 'Central de Deudores: situación 1', 'POL-PP §4');
  else if (c.situacion_bcra === 2) add(false, 'Central de Deudores: situación 2, corresponde Comité de Créditos', 'POL-PP §4', 'warn');
  else add(false, `Central de Deudores: situación ${c.situacion_bcra}`, 'POL-PP §4');
  const tope = c.cobra_haberes_en_banco ? 35 : 30;
  add(sim.relacion_cuota_ingreso_pct <= tope, `Cuota/ingreso con cuotas vigentes: ${String(sim.relacion_cuota_ingreso_pct).replace('.', ',')} % (tope ${tope} %) · cuota ${ars(sim.cuota_mensual)} a TNA ${sim.tna} %`, 'POL-PP §3');
  const max = Math.min(12 * c.ingreso_neto_mensual, 30e6);
  add(ask.monto <= max, `Monto ${ars(ask.monto)} (máximo ${ars(max)})`, 'POL-PP §5');
  if (ask.monto > 15e6) add(false, 'Monto mayor a $15.000.000: aprueba el Comité de Créditos', 'POL-PP §6', 'warn');
  else if (ask.monto > 5e6) add(false, 'Monto mayor a $5.000.000: aprueba el gerente regional', 'POL-PP §6', 'warn');
  const verdict = items.some((i) => i.level === 'bad') ? 'NO CALIFICA' : items.some((i) => i.level === 'warn') ? 'DERIVAR' : 'APROBABLE';
  const comite = items.some((i) => i.level === 'warn' && /Comité/.test(i.txt));
  const ticket = verdict === 'NO CALIFICA' ? null
    : { dni: c.dni, tipo: verdict === 'APROBABLE' ? 'preaprobacion' : comite ? 'derivacion_comite' : 'derivacion_gerente', prioridad: 'media' };
  return { items, verdict, ticket, edadFin };
}

function agMockStep(messages, { tools, signal, onText }) {
  const user = messages.find((m) => m.role === 'user')?.content || '';
  const ask = agParseAsk(user);
  const called = messages.flatMap((m) => m.tool_calls || []).map((tc) => tc.function.name);
  const results = messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));
  const cliente = results.find((r) => 'encontrado' in r);
  const sim = results.find((r) => 'cuota_mensual' in r);
  const toolCalls = [];
  const call = (name, args) => toolCalls.push({ id: `call_${called.length + toolCalls.length + 1}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
  let text = '';

  const decision = cliente?.encontrado && sim ? agMockDecision(cliente, sim, ask) : null;
  if (tools && !called.length) {
    if (ask.dni) {
      call('buscar_cliente', { dni: ask.dni });
      call('buscar_politicas', { consulta: 'requisitos edad antigüedad capacidad de pago relación cuota ingreso' });
      call('buscar_politicas', { consulta: 'central de deudores situación montos niveles de aprobación' });
      call('buscar_politicas', { consulta: 'tasa TNA préstamo personal tarifario plazo' });
    } else {
      call('buscar_politicas', { consulta: user });
      if (/fraude|sospech|acompañad|transfer|clave|estafa/i.test(user)) call('buscar_politicas', { consulta: 'acción ante sospecha de fraude comunicación con el cliente' });
    }
  } else if (tools && cliente?.encontrado && ask.monto && ask.plazo && !sim) {
    call('simular_prestamo', {
      monto: ask.monto, plazo_meses: ask.plazo,
      tna: (cliente.cobra_haberes_en_banco ? 55 : 62) + (ask.plazo > 36 ? 3 : 0),
      ingreso_neto: cliente.ingreso_neto_mensual,
      cuotas_vigentes: cliente.cuotas_vigentes.reduce((s, c) => s + c.cuota_mensual, 0),
    });
  } else if (tools && decision?.ticket && !called.includes('crear_ticket')) {
    call('crear_ticket', { ...decision.ticket, resumen: `${cliente.nombre} pide ${ars(ask.monto)} a ${ask.plazo} meses. ${decision.verdict === 'APROBABLE' ? 'Cumple todos los requisitos [POL-PP §2-§6], queda pre-aprobado.' : decision.items.filter((i) => i.level === 'warn').map((i) => `${i.txt} [${i.ref}]`).join('. ')}` });
  } else if (decision) {
    const t = results.find((r) => r.ticket);
    text = `Veredicto: ${decision.verdict}\n\n${decision.items.map((i) => `- ${i.level === 'ok' ? '✓' : i.level === 'warn' ? '→' : '✕'} ${i.txt} [${i.ref}]`).join('\n')}\n\nPróximos pasos:\n`
      + (decision.verdict === 'APROBABLE' ? `- Pre-aprobación registrada en ${t?.ticket}. Pedir la documentación [POL-PP §7]; se acredita en 24 h hábiles [FAQ §1].`
        : decision.verdict === 'DERIVAR' ? `- Caso derivado en ${t?.ticket}. Avisarle al cliente que la respuesta depende de otra instancia [POL-PP §6].`
          : '- Informarle al cliente que hoy no califica, sin crear ticket.'
            + (decision.edadFin > 75 ? `\n- Alternativa: con un plazo de hasta ${Math.max(0, Math.floor((75 - cliente.edad) * 12))} meses la edad al vencimiento queda dentro de la política [POL-PP §2]. Conviene volver a simular.` : ''));
  } else if (cliente && !cliente.encontrado) {
    text = `No encontré un cliente con DNI ${fmtDNI(ask.dni)} en el core. Verificá el número o iniciá el alta [PROC-KYC §1].`;
  } else {
    const hits = [...new Map(results.flatMap((r) => r.resultados || []).sort((a, b) => b.score - a.score).map((h) => [h.id, h])).values()].slice(0, 4);
    text = hits.length
      ? `Según la base de conocimiento:\n\n${hits.map((h) => `- **${h.titulo}.** ${h.texto} [${h.id}]`).join('\n')}`
      : 'No encontré información sobre eso en la base de conocimiento.';
  }
  text = text ? `${text}\n\n(Modo simulado: respuesta armada con reglas fijas, sin llamar al modelo.)` : '';

  const t0 = performance.now();
  return new Promise((resolve, reject) => {
    let i = 0, ttft = null;
    const finish = () => {
      signal.removeEventListener('abort', onAbort);
      const res = {
        text, reasoning: '', toolCalls, ttft, total: performance.now() - t0, model: `${getConfig().model} (simulado)`,
        usage: { prompt_tokens: Math.round(JSON.stringify(messages).length / 4), completion_tokens: Math.round((text.length + JSON.stringify(toolCalls).length) / 4) },
      };
      recordUsage(res);
      resolve(res);
    };
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
    signal.addEventListener('abort', onAbort, { once: true });
    let timer = setTimeout(function tick() {
      ttft ??= performance.now() - t0;
      if (!text) return finish();
      i = Math.min(text.length, i + 16);
      onText?.(text.slice(0, i), '');
      if (i < text.length) timer = setTimeout(tick, 16);
      else finish();
    }, 500 + Math.random() * 400);
  });
}
