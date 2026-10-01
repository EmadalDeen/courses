/* script.js — Frontend only (GitHub Pages friendly).
   • Content (sessions, deadlines, resources) is published as static files: data.js + resources/.
   • Student submissions are written to submissions/<course>/session-<n>/ in the linked local folder
     (works on the teacher's / lab computer; a static site cannot receive files from other devices). */
(() => {
'use strict';
const LOCAL = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const COURSES = {
  CN1: { ar: 'شبكات الحاسوب 1', en: 'Computer Networks 1', icon: 'fa-network-wired', cls: 'cn1' },
  CN2: { ar: 'شبكات الحاسوب 2', en: 'Computer Networks 2', icon: 'fa-network-wired', cls: 'cn2' },
  DB1: { ar: 'قواعد البيانات 1', en: 'Databases 1', icon: 'fa-database', cls: 'db1' },
  CS2: { ar: 'مهارات الحاسوب 2', en: 'Computer Science 2', icon: 'fa-laptop-code', cls: 'cs2' }
};
const ADMIN_KEY = 'uni_admin_db_v3', SUBS_KEY = 'uni_subs_v3';
const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = s => String(s).replace(/[\\/:*?"<>|]/g, '_').slice(0, 100) || 'file';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtDate = t => new Date(t).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const isOpen = s => !!(s && s.hw && Date.now() < s.hw.deadline);
const fail = m => Object.assign(new Error(m), { user: true });
const FS_OK = 'showDirectoryPicker' in window;
// students read the published data.js; on the professor's own PC (nothing published yet) the admin copy is used
const siteSessions = () => (window.SITE_DATA?.sessions?.length ? window.SITE_DATA.sessions : (jget(ADMIN_KEY, null)?.sessions || []));

/* ---------- local folder access (File System Access API, Chrome/Edge) ---------- */
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('uni_fs', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = async k => { try { const db = await idb(); return await new Promise(res => { const q = db.transaction('h').objectStore('h').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch { return null; } };
const idbSet = async (k, v) => { const db = await idb(); return new Promise(res => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').put(v, k); t.oncomplete = res; }); };
const isSiteRoot = async h => { try { await h.getFileHandle('index.html'); return true; } catch { return false; } };   // the right folder contains index.html
async function rootHandle(ask) {   // with ask=true it must be the first await inside a click/submit handler
  const h = await idbGet('root'); if (!h) return null;
  try { let p = await h.queryPermission({ mode: 'readwrite' }); if (p !== 'granted' && ask) p = await h.requestPermission({ mode: 'readwrite' }); return p === 'granted' && await isSiteRoot(h) ? h : null; } catch { return null; }
}
async function writeTo(root, parts, name, file) {
  let d = root; for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
  const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(file); await w.close();
}
async function readFrom(root, parts, name) { let d = root; for (const p of parts) d = await d.getDirectoryHandle(p); return (await d.getFileHandle(name)).getFile(); }

/* ---------- shared UI ---------- */
function toast(msg, type = 'success') {
  let box = $('.toast-container'); if (!box) { box = document.createElement('div'); box.className = 'toast-container position-fixed bottom-0 start-0 p-3'; document.body.appendChild(box); }
  const el = document.createElement('div'); el.className = `toast text-bg-${type} border-0`; el.innerHTML = `<div class="toast-body">${esc(msg)}</div>`;
  box.appendChild(el); new bootstrap.Toast(el, { delay: 4500 }).show(); el.addEventListener('hidden.bs.toast', () => el.remove());
}
function countdown(deadline) {
  let s = Math.floor((deadline - Date.now()) / 1000); if (s <= 0) return null;
  const d = Math.floor(s / 86400); s %= 86400; const p = n => String(n).padStart(2, '0');
  return `${d} يوم : ${p(Math.floor(s / 3600))} ساعة : ${p(Math.floor(s % 3600 / 60))} دقيقة : ${p(s % 60)} ثانية`;
}
function resBtn(r, label, icon) {
  if (!r) return `<span class="btn btn-outline-secondary disabled"><i class="fa-solid ${icon} ms-1"></i>${label} (غير متوفر)</span>`;
  return `<a class="btn btn-outline-dark" href="${esc(r.url)}" ${r.external ? 'target="_blank" rel="noopener"' : `download="${esc(r.name)}"`}><i class="fa-solid ${icon} ms-1"></i>${label}</a>`;
}

/* =================== STUDENT =================== */
function initStudent() {
  let current = null, openId = null; const picked = {};
  const cards = $('#courseCards'), list = $('#sessionList');
  cards.innerHTML = Object.entries(COURSES).map(([k, c]) => `<div class="col-md-4"><div class="course-card ${c.cls} p-4 text-center" data-c="${k}" tabindex="0" role="button">
    <i class="fa-solid ${c.icon} ic mb-2"></i><h4 class="fw-bold mb-0">${k}</h4><div>${c.ar}</div><small class="text-muted">${c.en}</small></div></div>`).join('');
  cards.addEventListener('click', e => { const c = e.target.closest('.course-card'); if (!c) return; current = c.dataset.c;
    document.querySelectorAll('.course-card').forEach(x => x.classList.toggle('active', x === c)); render(); $('#sessionsHead').scrollIntoView({ behavior: 'smooth' }); });
  cards.addEventListener('keydown', e => e.key === 'Enter' && e.target.click());

  function hwHTML(s) {
    if (!s.hw) return '';
    const mine = jget(SUBS_KEY, []).filter(x => x.sid === s.id && x.name === localStorage.getItem('stu_name')).pop();
    const done = mine ? `<div class="alert alert-success py-2 mt-2"><i class="fa-solid fa-circle-check ms-1"></i>تم تسليم «${esc(mine.orig)}» في ${fmtDate(mine.time)}</div>` : '';
    const head = `<h6 class="fw-bold mt-4"><i class="fa-solid fa-clipboard-list ms-1"></i>${esc(s.hw.title)}</h6>${s.hw.text ? `<div class="hw-text mb-2">${esc(s.hw.text)}</div>` : ''}
      <div class="small text-muted">آخر موعد: ${fmtDate(s.hw.deadline)}</div>`;
    if (!isOpen(s)) return `${head}<div class="closed-box mt-2"><i class="fa-solid fa-lock ms-1"></i>انتهى وقت التسليم</div>${done}<button class="btn btn-secondary mt-2" disabled>انتهى وقت التسليم</button>`;
    if (!LOCAL) return `${head}<div class="mb-2">الوقت المتبقي: <span class="countdown" data-sid="${s.id}"></span></div><div class="alert alert-info py-2">الرفع الإلكتروني غير متاح في هذه النسخة المنشورة، سلّم وظيفتك حسب تعليمات الأستاذ.</div>${done}`;
    return `${head}<div class="mb-2">الوقت المتبقي: <span class="countdown" data-sid="${s.id}"></span></div>
      <input class="form-control mb-2" id="nm-${s.id}" placeholder="اسمك الكامل ورقمك الجامعي" value="${esc(localStorage.getItem('stu_name') || '')}">
      <div class="dropzone" data-sid="${s.id}"><i class="fa-solid fa-cloud-arrow-up fa-2x mb-2"></i><div>اسحب الملف إلى هنا أو اضغط للاختيار</div>
      <div class="small text-muted pick-${s.id}">لم يتم اختيار ملف</div><input type="file" hidden></div>
      <button class="btn btn-brass mt-2 submit-btn" data-sid="${s.id}"><i class="fa-solid fa-paper-plane ms-1"></i>تسليم الوظيفة</button>${done}`;
  }
  function render() {
    const ss = siteSessions().filter(s => s.course === current).sort((a, b) => a.num - b.num);
    $('#sessionsHead').innerHTML = current ? `<h3 class="fw-bold">جلسات ${current} — ${COURSES[current].ar}</h3>` : '';
    if (!current) return list.innerHTML = '';
    if (!ss.length) return list.innerHTML = '<div class="panel text-center text-muted">لا توجد جلسات منشورة لهذا المقرر بعد.</div>';
    list.innerHTML = `<div class="accordion">${ss.map(s => `<div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button ${s.id === openId ? '' : 'collapsed'}" data-bs-toggle="collapse" data-bs-target="#s-${s.id}">
      <b class="ms-2">الجلسة ${s.num}:</b> ${esc(s.title)} ${s.hw ? '<i class="fa-solid fa-clock me-2 text-warning"></i>' : ''}</button></h2>
      <div id="s-${s.id}" class="accordion-collapse collapse ${s.id === openId ? 'show' : ''}"><div class="accordion-body">
      <div class="d-flex flex-wrap gap-2">${resBtn(s.slides, 'تحميل السلايدات', 'fa-file-powerpoint')}${resBtn(s.lab, 'المستند العملي', 'fa-file-word')}</div>
      <div class="hw" data-sid="${s.id}">${hwHTML(s)}</div></div></div></div>`).join('')}</div>`;
    list.querySelectorAll('.collapse').forEach(c => c.addEventListener('show.bs.collapse', () => openId = c.id.slice(2)));
  }
  const refreshHw = sid => { const s = siteSessions().find(x => x.id === sid), b = document.querySelector(`.hw[data-sid="${sid}"]`); if (s && b) b.innerHTML = hwHTML(s); };
  const setPicked = (sid, f) => { picked[sid] = f; const el = $('.pick-' + sid); if (el) el.textContent = f ? `${f.name} (${fmtSize(f.size)})` : 'لم يتم اختيار ملف'; };
  list.addEventListener('click', e => { const dz = e.target.closest('.dropzone'); if (dz) dz.querySelector('input').click(); const b = e.target.closest('.submit-btn'); if (b) submit(b.dataset.sid, b); });
  list.addEventListener('change', e => { const dz = e.target.closest('.dropzone'); if (dz && e.target.files[0]) setPicked(dz.dataset.sid, e.target.files[0]); });
  ['dragover', 'dragleave', 'drop'].forEach(ev => list.addEventListener(ev, e => { const dz = e.target.closest('.dropzone'); if (!dz) return; e.preventDefault();
    dz.classList.toggle('drag', ev === 'dragover'); if (ev === 'drop' && e.dataTransfer.files[0]) setPicked(dz.dataset.sid, e.dataTransfer.files[0]); }));

  async function submit(sid, btn) {
    const s = siteSessions().find(x => x.id === sid), name = ($('#nm-' + sid)?.value || '').trim(), f = picked[sid];
    if (!isOpen(s)) { toast('انتهى وقت التسليم، لا يمكن رفع ملفات.', 'danger'); return refreshHw(sid); }
    if (!name) return toast('أدخل اسمك ورقمك الجامعي.', 'warning');
    if (!f) return toast('اختر ملفاً للتسليم أولاً.', 'warning');
    btn.disabled = true; let time;
    try {
      const root = await rootHandle(true); if (!root) throw fail('لم يُربط مجلد الموقع الصحيح من لوحة التحكم، أو لم تسمح للمتصفح بالوصول إليه.');
      if (!isOpen(s)) throw fail('انتهى وقت التسليم قبل اكتمال الرفع.');
      time = Date.now(); await writeTo(root, ['submissions', s.course, `session-${s.num}`], `${safe(name)}__${time}__${safe(f.name)}`, f);
    } catch (err) { btn.disabled = false; toast(err.user ? err.message : 'تعذّر الاتصال أو حفظ الملف، حاول مرة أخرى.', 'danger'); if (!isOpen(s)) refreshHw(sid); return; }
    const all = jget(SUBS_KEY, []); all.push({ id: uid(), sid, course: s.course, num: s.num, name, orig: f.name, file: `${safe(name)}__${time}__${safe(f.name)}`, size: f.size, time }); localStorage.setItem(SUBS_KEY, JSON.stringify(all));
    localStorage.setItem('stu_name', name); delete picked[sid];
    toast('تم رفع الملف وحفظ حالة التسليم بنجاح ✔'); refreshHw(sid);
  }
  setInterval(() => document.querySelectorAll('.countdown').forEach(el => {
    const s = siteSessions().find(x => x.id === el.dataset.sid); if (!s?.hw) return;
    const t = countdown(s.hw.deadline); if (t === null) return refreshHw(s.id);   // upload UI removed from the DOM
    el.textContent = t; el.classList.toggle('urgent', s.hw.deadline - Date.now() < 3600e3);
  }), 1000);
}

/* =================== ADMIN =================== */
const sha = async s => crypto.subtle ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('') : btoa(unescape(encodeURIComponent(s)));
function gate() {   // client-side password screen (casual protection only)
  if (sessionStorage.getItem('adm') === '1') return Promise.resolve();
  const first = !localStorage.getItem('adm_hash');
  return new Promise(res => {
    const o = document.createElement('div'); o.className = 'gate';
    o.innerHTML = `<form class="panel"><h4 class="fw-bold mb-3"><i class="fa-solid fa-lock ms-1"></i>${first ? 'تعيين كلمة مرور المشرف' : 'دخول المشرف'}</h4>
      <input type="password" class="form-control mb-2" placeholder="كلمة المرور" required minlength="4"><div class="text-danger small mb-2"></div><button class="btn btn-brass w-100">${first ? 'حفظ ودخول' : 'دخول'}</button></form>`;
    document.body.appendChild(o); const inp = o.querySelector('input'); inp.focus();
    o.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const h = await sha(inp.value);
      if (first) localStorage.setItem('adm_hash', h); else if (h !== localStorage.getItem('adm_hash')) return o.querySelector('.text-danger').textContent = 'كلمة المرور غير صحيحة';
      sessionStorage.setItem('adm', '1'); o.remove(); res();
    };
  });
}
async function initAdmin() {
  await gate(); document.body.classList.remove('locked');
  let db = jget(ADMIN_KEY, null) || { sessions: JSON.parse(JSON.stringify(window.SITE_DATA?.sessions || [])) };
  const body = $('#body'), form = $('#sessionForm');
  const dataJs = () => 'window.SITE_DATA = ' + JSON.stringify({ updated: Date.now(), sessions: db.sessions }) + ';\n';

  async function commit(root) {            // save locally + publish data.js into the linked folder
    localStorage.setItem(ADMIN_KEY, JSON.stringify(db));
    try { if (root) { await writeTo(root, [], 'data.js', new Blob([dataJs()])); setPub(true); } else setPub(false); } catch { setPub(false); }
  }
  const setPub = ok => $('#pubState').innerHTML = ok ? '<i class="fa-solid fa-circle-check text-success ms-1"></i>تم تحديث <code>data.js</code> في المجلد — ارفع المجلد إلى GitHub لينشر التغييرات.'
    : '<i class="fa-solid fa-triangle-exclamation text-warning ms-1"></i>التغييرات لم تُكتب في <code>data.js</code> بعد: اربط المجلد، أو نزّل الملف يدوياً وضعه بجانب index.html.';
  $('#dlData').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([dataJs()], { type: 'text/javascript' })); a.download = 'data.js'; a.click(); URL.revokeObjectURL(a.href); };
  async function showLink() {
    if (!FS_OK) { $('#linkState').innerHTML = '<span class="text-danger">المتصفح لا يدعم الحفظ في مجلد — استخدم Chrome أو Edge.</span>'; return; }
    const h = await idbGet('root'); $('#linkState').textContent = h ? `المجلد المرتبط: ${h.name}` : 'لم يُربط مجلد بعد';
  }
  $('#linkBtn').onclick = async () => {
    try {
      const h = await window.showDirectoryPicker({ id: 'unisite', mode: 'readwrite' });
      if (!(await isSiteRoot(h))) toast(`المجلد «${h.name}» ليس مجلد الموقع. اختر المجلد الذي يحتوي index.html مباشرة (وليس مجلداً أعلى منه أو داخله).`, 'danger');
      else { await idbSet('root', h); await commit(h); toast('تم ربط مجلد الموقع ونُشر data.js فيه.'); }
    } catch {}
    showLink();
  };
  $('#out').onclick = () => { sessionStorage.removeItem('adm'); location.reload(); };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const slidesF = $('#slidesFile').files[0], labF = $('#labFile').files[0], hwTitle = $('#hwTitle').value.trim(), dl = $('#deadline').value;
    if (hwTitle && !dl) return toast('حدّد موعد انتهاء الوظيفة.', 'warning');
    const root = await rootHandle(true);   // first await: still inside the user gesture
    if ((slidesF || labF) && !root) return toast('اربط مجلد الموقع الصحيح (الذي فيه index.html مباشرة) بزر «ربط المجلد» ليتم حفظ الملفات في resources.', 'danger');
    const course = $('#course').value, num = +$('#num').value;
    if (db.sessions.some(s => s.course === course && s.num === num)) return toast('رقم الجلسة موجود مسبقاً في هذا المقرر.', 'danger');
    const put = async (f, url) => {
      if (f) { const n = safe(f.name); await writeTo(root, ['resources', course, `session-${num}`], n, f); return { name: n, url: `resources/${course}/session-${num}/${encodeURIComponent(n)}` }; }
      return /^https?:\/\//i.test(url.trim()) ? { name: 'رابط خارجي', url: url.trim(), external: true } : null;
    };
    try {
      db.sessions.push({ id: uid(), course, num, title: $('#title').value.trim(), slides: await put(slidesF, $('#slidesUrl').value), lab: await put(labF, $('#labUrl').value),
        hw: hwTitle ? { title: hwTitle, text: $('#hwText').value.trim(), deadline: new Date(dl).getTime() } : null });
    } catch { return toast('فشل حفظ الملفات في المجلد.', 'danger'); }
    await commit(root); form.reset(); toast(`تمت إضافة الجلسة (resources/${course}/session-${num})`); render();
  });

  function render() {
    const subs = jget(SUBS_KEY, []), rows = [...db.sessions].sort((a, b) => a.course.localeCompare(b.course) || a.num - b.num);
    body.innerHTML = rows.length ? rows.map(s => `<tr><td><span class="badge bg-dark">${s.course}</span></td><td>${s.num}</td><td>${esc(s.title)}</td>
      <td>${s.slides ? '<i class="fa-solid fa-check text-success"></i>' : '—'}</td><td>${s.lab ? '<i class="fa-solid fa-check text-success"></i>' : '—'}</td>
      <td>${s.hw ? `${esc(s.hw.title)}<br><span class="countdown small" data-sid="${s.id}"></span>` : '—'}</td>
      <td>${s.hw ? `<button class="btn btn-sm btn-outline-dark" data-subs="${s.id}"><i class="fa-solid fa-inbox ms-1"></i>${subs.filter(x => x.sid === s.id).length}</button>` : ''}</td>
      <td><button class="btn btn-sm btn-outline-danger" data-del="${s.id}" aria-label="حذف"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')
      : '<tr><td colspan="8" class="text-center text-muted">لا توجد جلسات بعد. أضف أول جلسة من النموذج أعلاه.</td></tr>';
    tick();
  }
  const tick = () => document.querySelectorAll('.countdown').forEach(el => { const s = db.sessions.find(x => x.id === el.dataset.sid); if (!s?.hw) return;
    const t = countdown(s.hw.deadline); el.textContent = t ?? 'انتهى الموعد'; el.classList.toggle('urgent', t === null); });
  setInterval(tick, 1000);

  body.addEventListener('click', async e => {
    const del = e.target.closest('[data-del]'), sb = e.target.closest('[data-subs]');
    if (del && confirm('حذف الجلسة؟ (ملفاتها تبقى في المجلد)')) { const root = await rootHandle(true); db.sessions = db.sessions.filter(s => s.id !== del.dataset.del); await commit(root); toast('تم الحذف', 'secondary'); render(); }
    if (sb) {
      const s = db.sessions.find(x => x.id === sb.dataset.subs), list = jget(SUBS_KEY, []).filter(x => x.sid === s.id);
      $('#subsTitle').textContent = `تسليمات ${s.course} — الجلسة ${s.num}`;
      $('#subsBody').innerHTML = list.length ? list.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.orig)}</td><td>${fmtSize(x.size)}</td><td>${fmtDate(x.time)}</td>
        <td><button class="btn btn-sm btn-outline-dark" data-dl="${x.id}"><i class="fa-solid fa-download"></i></button></td></tr>`).join('')
        : '<tr><td colspan="5" class="text-center text-muted">لا توجد تسليمات حتى الآن.</td></tr>';
      new bootstrap.Modal('#subsModal').show();
    }
  });
  $('#subsBody').addEventListener('click', async e => {
    const b = e.target.closest('[data-dl]'); if (!b) return;
    const x = jget(SUBS_KEY, []).find(v => v.id === b.dataset.dl), root = await rootHandle(true);
    if (!root) return toast('اربط المجلد وامنح الإذن أولاً.', 'danger');
    try { const f = await readFrom(root, ['submissions', x.course, `session-${x.num}`], x.file), a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = x.orig; a.click(); URL.revokeObjectURL(a.href); }
    catch { toast('الملف غير موجود في المجلد المرتبط.', 'danger'); }
  });
  showLink(); render(); setPub(false);
}

document.addEventListener('DOMContentLoaded', () => { const p = document.body.dataset.page; if (p === 'student') initStudent(); else if (p === 'admin') initAdmin(); });
})();
