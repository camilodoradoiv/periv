'use strict';
/* PERIV Â· JavaScript puro, sin dependencias ni llamadas externas */

const DOC_VERSION = '1.0 (2026-11-06)';
const K = {
  profile: 'periv_profile', exp: 'periv_expenses', rem: 'periv_reminders',
  budget: 'periv_budget', log: 'periv_consent_log', cookie: 'periv_cookie_notice'
};
const CATS = {
  'Vivienda': '#7c5cff', 'AlimentaciÃ³n': '#3ddc97', 'Transporte': '#00b8ff', 'Servicios': '#ffc857',
  'Salud': '#ff5d73', 'Ocio': '#ff4fd8', 'EducaciÃ³n': '#ff8a3d', 'Otros': '#9aa0c8'
};
const MAIL = 'perivdor5@gmail.com';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/* ---------- almacenamiento ---------- */
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch { toast('No se pudo guardar en este navegador (Â¿modo privado o sin espacio?).'); return false; }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthStr = () => todayStr().slice(0, 7);

let profile = load(K.profile, null);
let expenses = load(K.exp, []);
let reminders = load(K.rem, []);
let budgets = load(K.budget, {});

/* ---------- utilidades de UI ---------- */
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  kids.forEach(c => n.append(c));
  return n;
}
function toast(msg) {
  const t = el('div', { class: 'toast', text: msg });
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 6000);
}
const openDlg = d => { if (!d.open) d.showModal(); };
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
  const lg = e.target.closest('[data-legal]');
  if (lg) { e.preventDefault(); showLegal(lg.dataset.legal); }
});
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

/* ---------- documentos legales ---------- */
const LEGAL_TITLES = { terms: 'TÃ©rminos y condiciones', privacy: 'PolÃ­tica de privacidad', cookies: 'PolÃ­tica de cookies', refund: 'PolÃ­tica de reembolso' };
function showLegal(id) {
  const tpl = $('#tpl-' + id);
  if (!tpl) return;
  $('#lg-title').textContent = LEGAL_TITLES[id];
  const body = $('#lg-body');
  body.replaceChildren(tpl.content.cloneNode(true));
  openDlg($('#dlg-legal'));
  body.scrollTop = 0;
  $('#dlg-legal').scrollTop = 0;
}

/* ---------- registro de consentimientos ---------- */
async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return 'no-disponible'; }
}
async function recordConsent(formId, form, checks, extra = {}) {
  const docs = ['terms', 'privacy', 'cookies', 'refund'].map(i => $('#tpl-' + i).content.textContent).join('\n');
  const labels = checks.map(c => c.closest('label').textContent.trim()).join('\n');
  const now = new Date();
  const entry = {
    id: uid(),
    timestamp_utc: now.toISOString(),
    hora_local: now.toLocaleString('es-CO', { timeZone: 'America/Bogota' }) + ' (America/Bogota)',
    zona_horaria_navegador: Intl.DateTimeFormat().resolvedOptions().timeZone,
    formulario: formId,
    casillas: Object.fromEntries(checks.map(c => [c.id, c.checked])),
    metodo: 'Casillas separadas, no premarcadas, marcadas manualmente por la persona y envÃ­o del formulario',
    version_documentos: DOC_VERSION,
    huella_sha256_textos: await sha256(docs + '\n' + labels),
    idioma: navigator.language,
    navegador: navigator.userAgent,
    pagina: location.href.split('#')[0],
    ...extra
  };
  const log = load(K.log, []);
  log.push(entry);
  save(K.log, log);
  return entry;
}
function renderConsents() {
  const log = load(K.log, []).slice().reverse();
  const ul = $('#cs-list');
  ul.replaceChildren();
  if (!log.length) { ul.append(el('li', { class: 'empty', text: 'AÃºn no hay aceptaciones registradas.' })); return; }
  log.forEach(e => {
    ul.append(el('li', {},
      el('div', { class: 'meta' },
        el('b', { text: `${e.formulario} Â· ${e.hora_local}` }),
        el('small', { text: `Casillas: ${Object.entries(e.casillas).map(([k, v]) => k + '=' + (v ? 'sÃ­' : 'no')).join(', ')} Â· v${e.version_documentos}` }),
        el('small', { text: `ID ${e.id} Â· huella ${e.huella_sha256_textos.slice(0, 16)}â€¦` }))));
  });
}
$('#btn-consents').addEventListener('click', () => { renderConsents(); openDlg($('#dlg-consents')); });
$('#foot-consents').addEventListener('click', e => { e.preventDefault(); renderConsents(); openDlg($('#dlg-consents')); });
$('#cs-download').addEventListener('click', () => {
  download('periv-registro-aceptaciones.json', JSON.stringify(load(K.log, []), null, 2), 'application/json');
});
$('#cs-clear').addEventListener('click', () => {
  if (confirm('Â¿Borrar tu registro de aceptaciones? PerderÃ¡s la prueba de cuÃ¡ndo y cÃ³mo aceptaste.')) {
    localStorage.removeItem(K.log); renderConsents(); toast('Registro borrado.');
  }
});
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' }));
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- perfil (formulario 1) ---------- */
function openOnboard() {
  $('#form-onboard').reset();
  openDlg($('#dlg-onboard'));
}
['#btn-start', '#btn-unlock'].forEach(s => $(s).addEventListener('click', () => profile ? $('#panel').scrollIntoView() : openOnboard()));
$('#form-onboard').addEventListener('submit', async e => {
  e.preventDefault();
  const t = $('#ob-terms'), p = $('#ob-priv');
  if (!t.checked || !p.checked) { toast('Debes marcar las dos casillas para continuar.'); return; }
  const alias = $('#ob-alias').value.trim().slice(0, 30);
  if (!alias) return;
  const rec = await recordConsent('Perfil / registro', e.target, [t, p]);
  profile = { alias, creado: new Date().toISOString(), consentimiento_id: rec.id };
  save(K.profile, profile);
  $('#dlg-onboard').close();
  refreshGate();
  toast(`Â¡Bienvenido/a, ${alias}! Tu aceptaciÃ³n quedÃ³ registrada.`);
  $('#panel').scrollIntoView({ behavior: 'smooth' });
});
function refreshGate() {
  const on = !!profile;
  $('#lock').classList.toggle('hide', on);
  $('#panel-app').setAttribute('aria-hidden', on ? 'false' : 'true');
  $('#hello-name').textContent = on ? profile.alias : 'â€”';
  if (on) renderAll();
}

/* ---------- gastos ---------- */
const catSel = $('#e-cat');
Object.keys(CATS).forEach(c => catSel.append(el('option', { value: c, text: c })));
$('#e-date').value = todayStr();
$('#r-date').value = todayStr();
const monthInp = $('#month');
monthInp.value = monthStr();
monthInp.addEventListener('change', renderAll);

$('#form-expense').addEventListener('submit', e => {
  e.preventDefault();
  const amount = Math.round(Number($('#e-amount').value));
  if (!(amount > 0)) return;
  expenses.push({ id: uid(), desc: $('#e-desc').value.trim().slice(0, 60), amount, cat: catSel.value, date: $('#e-date').value });
  save(K.exp, expenses);
  e.target.reset(); $('#e-date').value = todayStr();
  renderAll();
});
function monthExpenses() { return expenses.filter(x => x.date.startsWith(monthInp.value)); }

function renderExpenses() {
  const ul = $('#list-expenses'); ul.replaceChildren();
  const list = monthExpenses().sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) ul.append(el('li', { class: 'empty', text: 'Sin gastos este mes.' }));
  list.forEach(x => ul.append(el('li', {},
    el('div', { class: 'meta' }, el('b', { text: x.desc }), el('small', { text: `${x.cat} Â· ${x.date}` })),
    el('span', { class: 'amt', text: cop.format(x.amount) }),
    el('div', { class: 'acts' }, el('button', { class: 'icon-btn', 'aria-label': 'Eliminar gasto', text: 'ðŸ—‘', onclick: () => {
      expenses = expenses.filter(y => y.id !== x.id); save(K.exp, expenses); renderAll();
    } })))));
}
function renderStats() {
  const total = monthExpenses().reduce((s, x) => s + x.amount, 0);
  const b = Number(budgets[monthInp.value]) || 0;
  $('#st-total').textContent = cop.format(total);
  $('#budget').value = b || '';
  $('#st-left').textContent = b ? cop.format(b - total) : 'â€”';
  const pct = b ? Math.min(100, Math.round(total / b * 100)) : 0;
  const ring = $('#ring');
  ring.style.setProperty('--p', pct);
  ring.style.setProperty('--ringc', pct >= 100 ? 'var(--bad)' : pct >= 80 ? 'var(--warn)' : 'var(--p2)');
  $('#ring-pct').textContent = b ? pct + '%' : 'â€”';
  $('#st-left').style.color = b && total > b ? 'var(--bad)' : '';
}
$('#budget').addEventListener('change', e => {
  budgets[monthInp.value] = Math.max(0, Math.round(Number(e.target.value) || 0));
  save(K.budget, budgets); renderStats();
});
function renderChart() {
  const box = $('#chart3d'); box.replaceChildren();
  const tot = {};
  monthExpenses().forEach(x => tot[x.cat] = (tot[x.cat] || 0) + x.amount);
  const entries = Object.entries(tot).sort((a, b) => b[1] - a[1]);
  if (!entries.length) { box.append(el('span', { class: 'none', text: 'AÃ±ade gastos para ver el grÃ¡fico 3D' })); return; }
  const max = entries[0][1];
  entries.forEach(([cat, v]) => {
    const bar = el('div', { class: 'bar3d', style: `--c:${CATS[cat]};--h:4px` },
      ...['fr', 'bk', 'lf', 'rt', 'tp'].map(c => el('i', { class: c })));
    const col = el('div', { class: 'bar-col', title: `${cat}: ${cop.format(v)}` },
      el('em', { text: cop.format(v).replace(/\s/g, '') }), bar, el('small', { text: cat }));
    box.append(col);
    requestAnimationFrame(() => requestAnimationFrame(() => bar.style.setProperty('--h', Math.max(8, v / max * 140) + 'px')));
  });
}

/* ---------- recordatorios ---------- */
$('#form-reminder').addEventListener('submit', e => {
  e.preventDefault();
  reminders.push({
    id: uid(), title: $('#r-title').value.trim().slice(0, 60), amount: Math.round(Number($('#r-amount').value)) || 0,
    when: `${$('#r-date').value}T${$('#r-time').value}`, repeat: $('#r-repeat').value, done: false, notified: false
  });
  save(K.rem, reminders);
  e.target.reset(); $('#r-date').value = todayStr(); $('#r-time').value = '09:00';
  renderReminders(); checkReminders();
});
function addMonth(iso) {
  const d = new Date(iso); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function renderReminders() {
  const ul = $('#list-reminders'); ul.replaceChildren();
  const now = new Date();
  const list = reminders.slice().sort((a, b) => a.done - b.done || a.when.localeCompare(b.when));
  if (!list.length) ul.append(el('li', { class: 'empty', text: 'No tienes recordatorios.' }));
  list.forEach(r => {
    const due = new Date(r.when) <= now && !r.done;
    const li = el('li', { class: (r.done ? 'done ' : '') + (due ? 'overdue' : '') },
      el('div', { class: 'meta' },
        el('b', { text: r.title }),
        el('small', { text: `${new Date(r.when).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}${r.repeat === 'monthly' ? ' Â· cada mes' : ''}${r.amount ? ' Â· ' + cop.format(r.amount) : ''}` })),
      el('div', { class: 'acts' },
        el('button', { class: 'icon-btn', 'aria-label': 'Marcar como hecho', text: 'âœ“', onclick: () => {
          if (r.repeat === 'monthly') { r.when = addMonth(r.when); r.notified = false; toast(`Siguiente aviso: ${new Date(r.when).toLocaleDateString('es-CO')}`); }
          else r.done = true;
          save(K.rem, reminders); renderReminders();
        } }),
        el('button', { class: 'icon-btn', 'aria-label': 'Eliminar recordatorio', text: 'ðŸ—‘', onclick: () => {
          reminders = reminders.filter(y => y.id !== r.id); save(K.rem, reminders); renderReminders();
        } })));
    ul.append(li);
  });
}
function checkReminders() {
  if (!profile) return;
  const now = new Date(); let changed = false;
  reminders.forEach(r => {
    if (!r.done && !r.notified && new Date(r.when) <= now) {
      r.notified = true; changed = true;
      const msg = `â° ${r.title}${r.amount ? ' Â· ' + cop.format(r.amount) : ''}`;
      toast(msg);
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('PERIV', { body: msg }); } catch { /* ignorar */ }
      }
    }
  });
  if (changed) { save(K.rem, reminders); renderReminders(); }
}
setInterval(checkReminders, 30000);
$('#btn-notif').addEventListener('click', async () => {
  if (!('Notification' in window)) { toast('Tu navegador no admite notificaciones; verÃ¡s los avisos dentro de la pÃ¡gina.'); return; }
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? 'Avisos del navegador activados.' : 'No activaste los avisos; seguirÃ¡s viÃ©ndolos dentro de la pÃ¡gina.');
});

/* ---------- exportar y borrar ---------- */
$('#btn-csv').addEventListener('click', () => {
  const q = v => '"' + String(v).replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
  const rows = [['Fecha', 'DescripciÃ³n', 'CategorÃ­a', 'Valor COP'], ...expenses.map(x => [x.date, x.desc, x.cat, x.amount])];
  download('periv-gastos.csv', '\ufeff' + rows.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
});
$('#btn-wipe').addEventListener('click', () => {
  if (!confirm('Se borrarÃ¡n tu perfil, gastos, recordatorios y presupuestos de este dispositivo. Tu registro de aceptaciones se conserva. Â¿Continuar?')) return;
  [K.profile, K.exp, K.rem, K.budget].forEach(k => localStorage.removeItem(k));
  profile = null; expenses = []; reminders = []; budgets = {};
  refreshGate(); toast('Tus datos fueron eliminados.');
});

function renderAll() { renderStats(); renderExpenses(); renderChart(); renderReminders(); }

/* ---------- contacto (formulario 2) ---------- */
$('#form-contact').addEventListener('submit', async e => {
  e.preventDefault();
  const t = $('#c-terms'), p = $('#c-priv');
  if (!t.checked || !p.checked) { toast('Marca las dos casillas para enviar.'); return; }
  const rec = await recordConsent('Contacto', e.target, [t, p]);
  const name = $('#c-name').value.trim(), mail = $('#c-mail').value.trim(), msg = $('#c-msg').value.trim();
  const body = `${msg}\n\nâ€” ${name} (${mail})\nRef. de aceptaciÃ³n: ${rec.id}`;
  const url = `mailto:${MAIL}?subject=${encodeURIComponent('Contacto PERIV - ' + name)}&body=${encodeURIComponent(body)}`;
  $('#contact-result').textContent = 'Se abriÃ³ tu aplicaciÃ³n de correo con el mensaje listo. Si no se abriÃ³, escrÃ­benos a ' + MAIL + ' o por WhatsApp al 321 700 3340. Tu aceptaciÃ³n quedÃ³ registrada.';
  location.href = url;
  e.target.reset();
});

/* ---------- cookies (aviso informativo) ---------- */
if (!load(K.cookie, null)) $('#cookie').hidden = false;
$('#cookie-ok').addEventListener('click', () => {
  save(K.cookie, { visto: new Date().toISOString(), version: DOC_VERSION });
  $('#cookie').hidden = true;
});

/* ---------- efectos 3D ---------- */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce) {
  const scene = $('#scene');
  addEventListener('pointermove', e => {
    const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
    scene.style.setProperty('--mx', (x * 50) + 'deg');
    scene.style.setProperty('--my', (-y * 30) + 'deg');
  });
  document.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('[data-tilt]');
    $$('[data-tilt]').forEach(n => { if (n !== c) n.style.transform = ''; });
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    c.style.transform = `perspective(800px) rotateX(${-y * 12}deg) rotateY(${x * 14}deg) translateZ(8px)`;
    c.style.setProperty('--gx', ((x + .5) * 100) + '%');
    c.style.setProperty('--gy', ((y + .5) * 100) + '%');
  });
  document.addEventListener('pointerleave', () => $$('[data-tilt]').forEach(n => n.style.transform = ''));
}
const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .15 });
$$('.reveal').forEach(n => io.observe(n));

/* ---------- inicio ---------- */
refreshGate();checkReminders();
