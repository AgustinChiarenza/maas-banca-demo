// Documentos de ejemplo generados en el navegador (datos ficticios, marcados como muestra).
// Así la demo no depende de archivos externos ni de datos personales reales.
window.SAMPLES = (() => {
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  }
  // Parte un texto en líneas que entren en maxW (corta palabras largas, como URLs).
  function lines(g, text, maxW) {
    const out = [];
    let cur = '';
    for (const word of text.split(' ')) {
      let w = word;
      const test = cur ? cur + ' ' + w : w;
      if (g.measureText(test).width <= maxW) { cur = test; continue; }
      if (cur) out.push(cur);
      cur = '';
      while (g.measureText(w).width > maxW) {
        let i = w.length;
        while (i > 1 && g.measureText(w.slice(0, i)).width > maxW) i--;
        out.push(w.slice(0, i));
        w = w.slice(i);
      }
      cur = w;
    }
    if (cur) out.push(cur);
    return out;
  }

  function dni() {
    const [c, g] = mk(1000, 630);
    g.fillStyle = '#e4e7ea';
    g.fillRect(0, 0, 1000, 630);
    const gr = g.createLinearGradient(0, 0, 1000, 630);
    gr.addColorStop(0, '#d8e5f1'); gr.addColorStop(0.55, '#eef3f8'); gr.addColorStop(1, '#d2e1ec');
    rr(g, 10, 10, 980, 610, 36);
    g.fillStyle = gr; g.fill();
    g.strokeStyle = '#9fb3c6'; g.lineWidth = 2; g.stroke();

    g.save();
    rr(g, 10, 10, 980, 610, 36); g.clip();
    g.strokeStyle = 'rgba(60,110,160,.10)'; g.lineWidth = 1;
    for (let k = 0; k < 26; k++) {
      g.beginPath();
      for (let x = 0; x <= 1000; x += 8) {
        const y = 60 + k * 22 + Math.sin(x / 55 + k * 0.7) * 14;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    g.restore();

    g.fillStyle = '#1d3b5c'; g.font = '700 26px Arial'; g.fillText('REPÚBLICA ARGENTINA', 40, 58);
    g.font = '600 15px Arial'; g.fillStyle = '#3a5a7a'; g.fillText('MERCOSUR · REGISTRO NACIONAL DE LAS PERSONAS', 40, 84);
    g.textAlign = 'right'; g.font = '700 21px Arial'; g.fillStyle = '#1d3b5c';
    g.fillText('DOCUMENTO NACIONAL DE IDENTIDAD', 960, 58);
    g.font = '600 15px Arial'; g.fillStyle = '#3a5a7a'; g.fillText('Ejemplar A', 960, 84);
    g.textAlign = 'left';

    // foto
    rr(g, 40, 115, 230, 290, 14); g.fillStyle = '#c5d1dc'; g.fill();
    g.save(); rr(g, 40, 115, 230, 290, 14); g.clip();
    g.fillStyle = '#8fa1b2';
    g.beginPath(); g.arc(155, 225, 58, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(155, 400, 105, 95, 0, Math.PI, 0); g.fill();
    g.restore();

    const F = (label, value, x, y, size = 26) => {
      g.font = '500 14px Arial'; g.fillStyle = '#4a6076'; g.fillText(label, x, y);
      g.font = `700 ${size}px Arial`; g.fillStyle = '#14202b'; g.fillText(value, x, y + size + 4);
    };
    F('Apellido / Surname', 'GÓMEZ', 310, 130);
    F('Nombre / Name', 'MARÍA LAURA', 310, 195);
    F('Sexo / Sex', 'F', 310, 260);
    F('Nacionalidad / Nationality', 'ARGENTINA', 450, 260);
    F('Fecha de nacimiento / Date of birth', '14 MAR/ MAR 1988', 310, 325);
    F('Fecha de emisión / Date of issue', '02 AGO/ AUG 2019', 310, 390, 22);
    F('Fecha de vencimiento / Date of expiry', '02 AGO/ AUG 2034', 640, 390, 22);
    F('Documento / Document', '33.456.789', 40, 470, 40);
    F('Trámite N° / Of. ident.', '00612345678', 640, 470, 22);

    g.strokeStyle = '#23324a'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(330, 575);
    g.bezierCurveTo(360, 530, 390, 600, 420, 560);
    g.bezierCurveTo(445, 528, 460, 590, 500, 565);
    g.bezierCurveTo(530, 548, 560, 580, 600, 560);
    g.stroke();
    g.font = '500 13px Arial'; g.fillStyle = '#4a6076'; g.fillText('Firma / Signature', 330, 602);

    g.save();
    g.translate(560, 330); g.rotate(-0.28);
    g.textAlign = 'center'; g.font = '800 64px Arial'; g.fillStyle = 'rgba(190,30,30,.30)';
    g.fillText('MUESTRA — SIN VALIDEZ', 0, 0);
    g.restore();
    return c.toDataURL('image/jpeg', 0.92);
  }

  function recibo() {
    const [c, g] = mk(900, 1180);
    g.fillStyle = '#fdfdfb'; g.fillRect(0, 0, 900, 1180);
    g.strokeStyle = '#333'; g.lineWidth = 1.5; g.strokeRect(30, 30, 840, 1120);
    g.fillStyle = '#111';
    g.font = '700 26px Arial'; g.fillText('METALÚRGICA DEL CENTRO S.A.', 55, 80);
    g.font = '15px Arial'; g.fillText('CUIT 30-71234567-8 · Av. Colón 1234, Córdoba', 55, 106);
    g.textAlign = 'right';
    g.font = '700 20px Arial'; g.fillText('RECIBO DE HABERES', 845, 80);
    g.font = '15px Arial'; g.fillText('Ley 20.744 · Original', 845, 106);
    g.textAlign = 'left';
    g.beginPath(); g.moveTo(30, 128); g.lineTo(870, 128); g.stroke();

    const info = [
      ['Apellido y nombre', 'GÓMEZ, MARÍA LAURA', 'CUIL', '27-33456789-4'],
      ['Legajo', '1045', 'Fecha de ingreso', '01/03/2016'],
      ['Categoría', 'Administrativa B', 'Período', 'AGOSTO 2026'],
      ['Lugar de pago', 'Córdoba', 'Fecha de pago', '05/09/2026'],
    ];
    info.forEach((r, i) => {
      const y = 165 + i * 34;
      g.font = '14px Arial'; g.fillStyle = '#555';
      g.fillText(r[0] + ':', 55, y); g.fillText(r[2] + ':', 520, y);
      g.font = '700 16px Arial'; g.fillStyle = '#111';
      g.fillText(r[1], 200, y); g.fillText(r[3], 660, y);
    });

    const top = 320;
    const cols = [55, 470, 600, 740]; // concepto, unidades, haberes (der), deducciones (der)
    g.fillStyle = '#ecefe9'; g.fillRect(31, top, 838, 38);
    g.fillStyle = '#111'; g.font = '700 15px Arial';
    g.fillText('Concepto', cols[0], top + 25);
    g.fillText('Unid.', cols[1], top + 25);
    g.textAlign = 'right'; g.fillText('Haberes', 715, top + 25); g.fillText('Deducciones', 845, top + 25); g.textAlign = 'left';

    const rows = [
      ['Sueldo básico', '30 d', '1.450.000,00', ''],
      ['Adicional antigüedad (10 años)', '6 %', '87.000,00', ''],
      ['Presentismo', '', '120.000,00', ''],
      ['Jubilación', '11 %', '', '182.270,00'],
      ['Ley 19.032 (PAMI)', '3 %', '', '49.710,00'],
      ['Obra social', '3 %', '', '49.710,00'],
      ['Cuota sindical', '2 %', '', '33.140,00'],
    ];
    g.font = '16px Arial';
    rows.forEach((r, i) => {
      const y = top + 75 + i * 40;
      g.fillText(r[0], cols[0], y);
      g.fillText(r[1], cols[1], y);
      g.textAlign = 'right'; g.fillText(r[2], 715, y); g.fillText(r[3], 845, y); g.textAlign = 'left';
    });
    const ty = top + 75 + rows.length * 40 + 10;
    g.beginPath(); g.moveTo(30, ty - 22); g.lineTo(870, ty - 22); g.stroke();
    g.font = '700 16px Arial';
    g.fillText('TOTALES', cols[0], ty + 6);
    g.textAlign = 'right'; g.fillText('1.657.000,00', 715, ty + 6); g.fillText('314.830,00', 845, ty + 6); g.textAlign = 'left';

    const ny = ty + 60;
    g.fillStyle = '#ecefe9'; g.fillRect(430, ny - 30, 439, 56);
    g.fillStyle = '#111'; g.font = '700 20px Arial';
    g.fillText('NETO A COBRAR', 450, ny + 6);
    g.textAlign = 'right'; g.fillText('$ 1.342.170,00', 845, ny + 6); g.textAlign = 'left';

    g.font = 'italic 15px Arial'; g.fillStyle = '#333';
    lines(g, 'Son pesos: un millón trescientos cuarenta y dos mil ciento setenta con 00/100.', 780)
      .forEach((l, i) => g.fillText(l, 55, ny + 70 + i * 22));

    g.strokeStyle = '#333'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(560, 1040); g.lineTo(840, 1040); g.stroke();
    g.font = '14px Arial'; g.fillStyle = '#333'; g.fillText('Firma del empleador', 630, 1062);
    g.beginPath(); g.moveTo(60, 1040); g.lineTo(340, 1040); g.stroke();
    g.fillText('Firma del empleado', 135, 1062);

    g.font = '700 14px Arial'; g.fillStyle = '#a33';
    g.fillText('DOCUMENTO DE MUESTRA · DATOS FICTICIOS', 55, 1125);
    return c.toDataURL('image/jpeg', 0.92);
  }

  function sms() {
    const [c, g] = mk(600, 1040);
    g.fillStyle = '#f2f2f7'; g.fillRect(0, 0, 600, 1040);
    g.fillStyle = '#111'; g.font = '600 20px Arial';
    g.fillText('10:42', 32, 38);
    g.textAlign = 'right'; g.fillText('4G  82%', 568, 38); g.textAlign = 'left';

    g.fillStyle = '#fbfbfd'; g.fillRect(0, 56, 600, 104);
    g.fillStyle = '#d0d0d6'; g.fillRect(0, 159, 600, 1);
    g.fillStyle = '#0a7cff'; g.font = '400 44px Arial'; g.fillText('‹', 20, 120);
    g.fillStyle = '#a4a8b3'; g.beginPath(); g.arc(300, 92, 24, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center';
    g.fillStyle = '#111'; g.font = '600 18px Arial'; g.fillText('+54 9 351 555-0199', 300, 138);
    g.fillStyle = '#6b6b75'; g.font = '14px Arial'; g.fillText('Mensaje de texto · Hoy 10:41', 300, 190);
    g.textAlign = 'left';

    const bubble = (y, parts) => {
      const maxW = 400, pad = 16, lh = 29;
      g.font = '21px Arial';
      const all = [];
      for (const p of parts) {
        for (const l of lines(g, p.text, maxW)) all.push({ l, link: p.link });
        all.push(null); // separación entre párrafos
      }
      all.pop();
      const h = all.reduce((s, x) => s + (x ? lh : 10), 0) + pad * 2;
      const w = maxW + pad * 2;
      rr(g, 24, y, w, h, 20); g.fillStyle = '#e5e5ea'; g.fill();
      let cy = y + pad + 21;
      for (const x of all) {
        if (!x) { cy += 10; continue; }
        g.fillStyle = x.link ? '#0a64d6' : '#111';
        g.fillText(x.l, 24 + pad, cy);
        if (x.link) {
          const lw = g.measureText(x.l).width;
          g.fillRect(24 + pad, cy + 3, lw, 1.5);
        }
        cy += lh;
      }
      return y + h;
    };
    let y = bubble(215, [
      { text: 'BANCOR INFORMA: Detectamos un acceso no autorizado y su cuenta fue BLOQUEADA. Para evitar la baja definitiva valide sus datos dentro de las proximas 2 hs ingresando a:' },
      { text: 'https://bancor-validacion.com.ar-seguridad.xyz/login', link: true },
      { text: 'Si no valida, se debitara un cargo de $45.000 por reactivacion.' },
    ]);
    g.fillStyle = '#8e8e96'; g.font = '13px Arial'; g.fillText('10:41', 30, y + 22);
    y = bubble(y + 44, [
      { text: 'Ante dudas comuniquese con su asesor por WhatsApp al +54 9 11 5555-0142. No responda este mensaje.' },
    ]);
    g.fillStyle = '#8e8e96'; g.font = '13px Arial'; g.fillText('10:41', 30, y + 22);

    g.fillStyle = '#fbfbfd'; g.fillRect(0, 960, 600, 80);
    rr(g, 24, 976, 552, 46, 23); g.strokeStyle = '#c9c9cf'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#9a9aa2'; g.font = '18px Arial'; g.fillText('Mensaje de texto', 46, 1006);
    return c.toDataURL('image/jpeg', 0.92);
  }

  return { dni, recibo, sms };
})();
