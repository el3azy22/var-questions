// لوحة تحكم ڤار: الأسئلة (مسودة ← نشر ← رجوع)، البلاغات، تصحيح المباريات، الأرقام
import { app as A, auth as AU, db as D, XLSX } from "./vendor.js";

const ADMIN_EMAIL = "ibrahimalhosani2280@gmail.com";
const GH_QUESTIONS = "https://raw.githubusercontent.com/el3azy22/var-questions/main/questions.json";
const GH_FIXTURES = "https://raw.githubusercontent.com/el3azy22/var-questions/main/fixtures.json";
const KEEP_HISTORY = 30;

const cfg = {
  apiKey: "AIzaSyAO2QxjZiEqL6NL63syXVQoFeo5ZpqO9xA",
  authDomain: "var-el3azy.firebaseapp.com",
  databaseURL: "https://var-el3azy-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "var-el3azy",
  storageBucket: "var-el3azy.firebasestorage.app",
  messagingSenderId: "897066495423",
  appId: "1:897066495423:web:75784ff46ad6e6dec6850a",
};
const fb = A.initializeApp(cfg);
const auth = AU.getAuth(fb);
const db = D.getDatabase(fb);
const EMU = /[?&]emu=1/.test(location.search);
if (EMU) { AU.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); D.connectDatabaseEmulator(db, "127.0.0.1", 9000); }
const R = (p) => D.ref(db, p);

/* ---------- ثوابت التطبيق ---------- */
const CATS = { season: "الموسم الحالي", history: "تاريخ الدوري", cups: "البطولات المحلية", asia: "مشاركاتنا الخارجية", clubs: "أندية وملاعب", stars: "نجوم وهدافين", crests: "شعارات الأندية", career: "مسيرة لاعب", ref: "قانون وتحكيم", national: "منتخبنا" };
const CAT_COLOR = { season: "#22B573", history: "#8E5CF0", cups: "#F2A93B", asia: "#EF4A5C", clubs: "#2E86F5", stars: "#F57C3A", crests: "#1FB5B0", career: "#00A7E1", ref: "#E5509F", national: "#C8102E" };
const CLUBS = { ain: "العين", shabab: "شباب الأهلي", wasl: "الوصل", jazira: "الجزيرة", wahda: "الوحدة", sharjah: "الشارقة", nasr: "النصر", ajman: "عجمان", kalba: "كلباء", khorfakkan: "خورفكان", baniyas: "بني ياس", dhafra: "الظفرة", hatta: "حتا", united: "يونايتد" };
const ANS = ["#EF4A5C", "#2E86F5", "#F2A93B", "#22B573"];
const KINDS = { normal: "اختيار من متعدد", tf: "صح وغلط", order: "رتّب", guess: "خمّن من التلميحات", odd: "الغريب بينهم", num: "قرّب الرقم", score: "توقّع النتيجة", pairs: "وصّل", blur: "شعار مغبّش", adv: "متقدم (مسيرة لاعب / تحكيم)" };
const SPECIAL = ["num", "score", "pairs"];

/* ---------- أدوات ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = (x) => JSON.parse(JSON.stringify(x));
const fmtDate = (t) => t ? new Date(t).toLocaleString("ar-AE", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" }) : "—";
function toast(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2800); }
function ask({ title, body = "", ok = "تمام", danger = false, cancel = "إلغاء" }) {
  return new Promise((res) => {
    const o = document.createElement("div"); o.className = "ov";
    o.innerHTML = `<div class="card center"><h2 style="margin:6px 0">${esc(title)}</h2><div class="muted" style="font-size:15px;line-height:1.8;margin-bottom:14px">${body}</div>
      <div class="row" style="justify-content:center"><button class="btn ${danger ? "r" : ""}" data-k="1">${esc(ok)}</button>${cancel ? `<button class="btn w" data-k="0">${esc(cancel)}</button>` : ""}</div></div>`;
    o.addEventListener("click", (e) => { const k = e.target.closest("[data-k]")?.dataset.k; if (k !== undefined) { o.remove(); res(k === "1"); } });
    document.body.appendChild(o);
  });
}
const isAdmin = (u) => !!u && u.emailVerified && String(u.email || "").toLowerCase() === ADMIN_EMAIL;

/* ---------- الحالة ---------- */
const S = { user: null, tab: "q", pub: null, draft: null, history: {}, reports: {}, fxo: {}, fixtures: null, ghVersion: 0, filter: { s: "", c: "", st: "" }, round: null, unsub: [] };
const ready = { pub: false, draft: false };

/* ---------- الدخول ---------- */
AU.onAuthStateChanged(auth, async (u) => {
  S.unsub.forEach((f) => f()); S.unsub = [];
  S.user = u;
  $("#who").innerHTML = u ? `${esc(u.email || "")}<br><a href="#" id="out" style="color:var(--gold2)">اطلع</a>` : "";
  $("#out")?.addEventListener("click", (e) => { e.preventDefault(); AU.signOut(auth); });
  if (!u) return renderLogin();
  if (!isAdmin(u)) return renderNoAccess();
  start();
});

function renderLogin(msg = "") {
  $("#root").innerHTML = `<div class="card center" style="max-width:440px;margin:30px auto">
    <img src="img/logo.png" style="width:90px;height:90px;border-radius:50%">
    <h2 style="margin:10px 0 4px">ادخل لوحة التحكم</h2>
    <div class="muted" style="margin-bottom:16px">بحساب Google حق صاحب التطبيق بس</div>
    ${msg ? `<div class="banner red">${esc(msg)}</div>` : ""}
    <button class="btn" id="login" style="width:100%">الدخول بحساب Google</button></div>`;
  $("#login").onclick = async () => {
    const p = new AU.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
    try { await AU.signInWithPopup(auth, p); }
    catch (e) {
      if (e?.code === "auth/popup-blocked" || e?.code === "auth/operation-not-supported-in-this-environment") { try { await AU.signInWithRedirect(auth, p); } catch (e2) { renderLogin("ما قدرنا ندخل: " + (e2?.code || e2)); } }
      else if (e?.code !== "auth/popup-closed-by-user" && e?.code !== "auth/cancelled-popup-request") renderLogin("ما قدرنا ندخل: " + (e?.code || e));
    }
  };
}
function renderNoAccess() {
  $("#root").innerHTML = `<div class="card center" style="max-width:440px;margin:30px auto"><h2>ما عندك صلاحية</h2>
    <div class="muted" style="margin-bottom:14px">هالحساب (${esc(S.user.email || "")}) مب حساب المدير</div>
    <button class="btn w" id="o2">ادخل بحساب ثاني</button></div>`;
  $("#o2").onclick = () => AU.signOut(auth);
}

/* ---------- تشغيل ---------- */
function start() {
  $("#root").innerHTML = `<div class="spin"></div>`;
  const on = (p, f) => S.unsub.push(D.onValue(R(p), (s) => f(s.val()), (e) => { console.error(p, e); toast("ما قدرنا نقرا " + p + " — تأكد إن قواعد الحماية الجديدة منسوخة في Firebase"); }));
  on("bank/published", (v) => { S.pub = v; ready.pub = true; boot(); });
  on("bank/draft", (v) => { S.draft = v; ready.draft = true; boot(); });
  on("bank/history", (v) => { S.history = v || {}; render(); });
  on("reports", (v) => { S.reports = v || {}; render(); });
  on("fxo", (v) => { S.fxo = v || {}; render(); });
  fetch(GH_QUESTIONS + "?t=" + Date.now()).then((r) => r.json()).then((d) => { S.gh = d; S.ghVersion = Number(d.version) || 0; boot(); }).catch(() => { S.gh = null; boot(); });
  fetch(GH_FIXTURES + "?t=" + Date.now()).then((r) => r.json()).then((d) => { S.fixtures = d; if (S.round == null) S.round = d.current || 1; render(); }).catch(() => {});
}
let booted = false;
function boot() {
  if (!ready.pub || !ready.draft) return;
  if (!S.pub && S.gh === undefined) return; // ننطر نسخة GitHub لأول مرة
  booted = true; render();
}

/* ---------- المسودة ---------- */
function withIds(list) { return (list || []).map((q) => (q.id ? q : { ...q, id: uid() })); }
function pubList() { return S.pub?.questions ? withIds(S.pub.questions) : []; }
function work() {
  if (S.draft?.questions) return S.draft.questions;
  if (S.pub?.questions) return pubList();
  return withIds(S.gh?.questions || []);
}
const firstTime = () => !S.pub;
let saveT = null;
async function saveDraft(list, msg) {
  S.draft = { questions: list, base: S.pub?.version || 0, at: Date.now() };
  render();
  clearTimeout(saveT);
  try { await D.set(R("bank/draft"), { questions: list, base: S.pub?.version || 0, at: D.serverTimestamp() }); if (msg) toast(msg); }
  catch (e) { toast("ما انحفظت المسودة: " + (e?.code || e?.message || e)); }
}
function diff() {
  const p = new Map(pubList().map((q) => [q.id, q])); const w = work();
  const wm = new Map(w.map((q) => [q.id, q]));
  let added = 0, edited = 0, removed = 0; const status = {};
  w.forEach((q) => { const o = p.get(q.id); if (!o) { added++; status[q.id] = "new"; } else if (JSON.stringify(o) !== JSON.stringify(q)) { edited++; status[q.id] = "ed"; } });
  p.forEach((q, id) => { if (!wm.has(id)) removed++; });
  return { added, edited, removed, status, changed: firstTime() ? true : added + edited + removed > 0 };
}

/* ---------- التحقق ---------- */
function check(q, list, selfId) {
  const errs = [];
  if (!q.c || !CATS[q.c]) errs.push("اختار الفئة");
  if (!q.q || !q.q.trim()) errs.push("اكتب السؤال");
  if (typeof q.e !== "string") errs.push("الشرح لازم يكون نص");
  if (SPECIAL.includes(q.kind)) { /* الأجوبة تنحسب بروحها */ }
  else if (!Array.isArray(q.a) || q.a.filter((x) => String(x).trim()).length < 2) errs.push("لازم جوابين على الأقل");
  else {
    if (q.a.some((x) => !String(x).trim())) errs.push("في جواب فاضي");
    const n = q.a.map(norm); if (new Set(n).size !== n.length) errs.push("في أجوبة مكررة");
  }
  if (q.kind === "tf" && !(q.a.length === 2 && q.a.includes("صح") && q.a.includes("غلط"))) errs.push("صح وغلط: الأجوبة لازم تكون «صح» و«غلط»");
  if (q.kind === "guess" && (!Array.isArray(q.clues) || q.clues.filter(Boolean).length < 2)) errs.push("خمّن: حط تلميحين على الأقل");
  if (q.kind === "num") {
    const ok = [q.n, q.min, q.max].every((x) => typeof x === "number" && isFinite(x));
    if (!ok) errs.push("قرّب الرقم: اكتب الرقم الصح وأقل وأعلى رقم");
    else if (!(q.min <= q.n && q.n <= q.max && q.min < q.max)) errs.push("الرقم الصح لازم يكون بين أقل رقم وأعلى رقم");
  }
  if (q.kind === "score" && (!Array.isArray(q.teams) || q.teams.length !== 2 || q.teams.some((t) => !String(t || "").trim()) || !Array.isArray(q.s) || q.s.some((x) => !(Number.isInteger(x) && x >= 0 && x <= 15)))) errs.push("توقّع النتيجة: اكتب اسم الفريقين والنتيجة");
  if (q.kind === "pairs") {
    const ps = (q.pairs || []).filter((p) => p[0]?.trim() || p[1]?.trim());
    if (ps.length < 3) errs.push("وصّل: لازم 3 أزواج على الأقل");
    if (ps.some((p) => !p[0]?.trim() || !p[1]?.trim())) errs.push("وصّل: في خانة فاضية");
    const L = ps.map((p) => norm(p[0])), Rr = ps.map((p) => norm(p[1]));
    if (new Set(L).size !== L.length || new Set(Rr).size !== Rr.length) errs.push("وصّل: في تكرار");
  }
  if (q.kind === "blur" && !q.img) errs.push("شعار مغبّش: اختار الشعار");
  if (q.img && !CLUBS[q.img]) errs.push("الشعار مب من أندية الدوري");
  if (q.club && !CLUBS[q.club]) errs.push("النادي مب من أندية الدوري");
  if (list) { const k = norm(q.q); const dup = list.find((x) => x.id !== selfId && norm(x.q) === k); if (dup) errs.push("السؤال موجود من قبل"); }
  return errs;
}

/* ---------- العرض ---------- */
function render() {
  if (!S.user || !isAdmin(S.user) || !booted) return;
  const d = diff(); const nRep = Object.keys(S.reports).length;
  const tabs = [["q", "الأسئلة"], ["rep", "البلاغات", nRep], ["fx", "المباريات"], ["ver", "النسخ"], ["st", "الأرقام"]];
  $("#root").innerHTML = `
    <div class="tabs">${tabs.map(([k, t, n]) => `<button class="tab ${S.tab === k ? "on" : ""}" data-tab="${k}">${t}${n ? `<span class="n">${n}</span>` : ""}</button>`).join("")}</div>
    <div id="pane"></div>
    ${d.changed && S.tab === "q" ? `<div class="bar">${firstTime() ? `<span>أول مرة: هذي أسئلة التطبيق الحالية (${work().length}). انشرها عشان تبدا اللوحة تتحكم فيها</span>` : `<span>تعديلات ما انتشرت: <b>${d.added}</b> جديد · <b>${d.edited}</b> معدّل · <b>${d.removed}</b> محذوف</span>`}
      <button class="btn sm g" id="publish">انشر للاعبين</button>${!firstTime() ? `<button class="btn sm ghost" id="discard">الغِ التعديلات</button>` : ""}</div>` : ""}`;
  $("#root").querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
  $("#publish")?.addEventListener("click", publish);
  $("#discard")?.addEventListener("click", discard);
  const pane = $("#pane");
  ({ q: paneQuestions, rep: paneReports, fx: paneFixtures, ver: paneVersions, st: paneStats })[S.tab](pane, d);
}

/* ---------- الأسئلة ---------- */
function paneQuestions(pane, d) {
  const list = work(); const f = S.filter;
  const pm = new Map(pubList().map((q) => [q.id, q]));
  const removed = [...pm.values()].filter((q) => !list.find((x) => x.id === q.id));
  let rows = list.map((q) => ({ q, st: d.status[q.id] || "" }));
  if (f.st === "del") rows = removed.map((q) => ({ q, st: "del" }));
  else if (f.st) rows = rows.filter((r) => r.st === f.st);
  if (f.c) rows = rows.filter((r) => r.q.c === f.c);
  if (f.s) { const k = norm(f.s); rows = rows.filter((r) => norm(r.q.q + " " + r.q.a.join(" ") + " " + r.q.e).includes(k)); }
  pane.innerHTML = `
    <div class="glasscard">
      <div class="row">
        <button class="btn" id="add">+ سؤال جديد</button>
        <button class="btn ghost" id="imp">رفع ملف Excel / CSV</button>
        <button class="btn ghost sm" id="tpl">نموذج الملف</button>
        <button class="btn ghost sm" id="exp">نزّل الأسئلة</button>
      </div>
      <div class="row" style="margin-top:10px">
        <input type="search" class="grow" id="s" placeholder="ابحث في الأسئلة والأجوبة…" value="${esc(f.s)}">
        <select id="c" style="flex:0 1 190px"><option value="">كل الفئات</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${f.c === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <select id="st" style="flex:0 1 160px"><option value="">الكل (${list.length})</option><option value="new" ${f.st === "new" ? "selected" : ""}>جديد (${d.added})</option><option value="ed" ${f.st === "ed" ? "selected" : ""}>معدّل (${d.edited})</option><option value="del" ${f.st === "del" ? "selected" : ""}>محذوف (${removed.length})</option></select>
      </div>
    </div>
    <div class="card" style="padding:6px 14px">${rows.length ? rows.slice(0, 400).map(({ q, st }) => `
      <div class="q" data-id="${q.id}" data-del="${st === "del" ? 1 : ""}">
        <span class="chip" style="background:${CAT_COLOR[q.c] || "#999"}">${esc(CATS[q.c] || q.c)}</span>
        <div style="flex:1"><div class="t">${esc(q.q)}</div><div class="a">✔ ${esc(q.kind === "order" ? q.a.join(" ← ") : q.kind === "num" ? `${q.n} ${q.unit || ""}` : q.kind === "score" ? `${q.teams?.[0]} ${q.s?.[0]}-${q.s?.[1]} ${q.teams?.[1]}` : q.kind === "pairs" ? (q.pairs || []).map((p) => p[0] + "↔" + p[1]).join("، ") : q.a[0])}${q.kind ? ` · ${esc(KINDS[q.kind] || KINDS.adv)}` : q.odd ? " · " + KINDS.odd : ""}</div></div>
        ${st ? `<span class="st ${st}">${{ new: "جديد", ed: "معدّل", del: "محذوف" }[st]}</span>` : ""}
      </div>`).join("") : `<div class="muted center" style="padding:20px">ما في أسئلة بهالبحث</div>`}
      ${rows.length > 400 ? `<div class="muted center" style="padding:10px">يطلع أول 400، ضيّق البحث</div>` : ""}
    </div>`;
  const keep = (id, k) => { const el = $("#" + id); el.oninput = el.onchange = () => { S.filter[k] = el.value; const pos = el.selectionStart; render(); const n = $("#" + id); n.focus(); if (pos != null && n.setSelectionRange) try { n.setSelectionRange(pos, pos); } catch {} }; };
  keep("s", "s"); keep("c", "c"); keep("st", "st");
  $("#add").onclick = () => editor(null);
  $("#imp").onclick = importFile;
  $("#tpl").onclick = downloadTemplate;
  $("#exp").onclick = exportAll;
  pane.querySelectorAll(".q").forEach((el) => (el.onclick = () => {
    if (el.dataset.del) return restoreRemoved(el.dataset.id);
    editor(work().find((q) => q.id === el.dataset.id));
  }));
}

async function restoreRemoved(id) {
  const q = pubList().find((x) => x.id === id); if (!q) return;
  if (!(await ask({ title: "ترجّع هالسؤال؟", body: esc(q.q), ok: "رجّعه" }))) return;
  saveDraft([...work(), q], "رجع السؤال للمسودة");
}

/* محرر السؤال */
function kindOf(q) { if (!q) return "normal"; if (["tf", "order", "guess", "num", "score", "pairs", "blur"].includes(q.kind)) return q.kind; if (q.kind) return "adv"; if (q.odd) return "odd"; return "normal"; }
function editor(orig, presetText) {
  const isNew = !orig;
  let q = orig ? clone(orig) : { id: uid(), c: "history", q: presetText || "", a: ["", "", "", ""], e: "" };
  let kind = kindOf(q);
  let correct = 0; // الجواب الصح دايماً ينحفظ أول واحد، وفي المحرر نخلي المستخدم يختاره
  const o = document.createElement("div"); o.className = "ov";
  document.body.appendChild(o); document.body.style.overflow = "hidden";
  const close = () => { o.remove(); document.body.style.overflow = ""; };

  function specialHtml() {
    if (kind === "num") return `<div class="row">${[["n", "الرقم الصح"], ["min", "أقل رقم"], ["max", "أعلى رقم"]].map(([k, l]) => `<div class="grow"><label class="l">${l}</label><input type="number" data-n="${k}" value="${q[k] ?? ""}"></div>`).join("")}</div>
      <div class="row">${[["step", "الخطوة (1 = عادي)"], ["tol", "يحسب قريب لين فرق"]].map(([k, l]) => `<div class="grow"><label class="l">${l}</label><input type="number" data-n="${k}" value="${q[k] ?? ""}"></div>`).join("")}<div class="grow"><label class="l">الوحدة (اختياري)</label><input type="text" id="funit" value="${esc(q.unit || "")}" placeholder="مثل: متفرج، هدف"></div></div>
      <div class="muted">بالضبط = النقاط كاملة. قريب (داخل الفرق اللي حطيته) = نص النقاط.</div>`;
    if (kind === "score") return `<div class="row"><div class="grow"><label class="l">الفريق الأول</label><input type="text" data-t="0" value="${esc(q.teams?.[0] || "")}"></div><div style="flex:0 0 90px"><label class="l">أهدافه</label><input type="number" min="0" max="15" data-s="0" value="${q.s?.[0] ?? 0}"></div></div>
      <div class="row"><div class="grow"><label class="l">الفريق الثاني</label><input type="text" data-t="1" value="${esc(q.teams?.[1] || "")}"></div><div style="flex:0 0 90px"><label class="l">أهدافه</label><input type="number" min="0" max="15" data-s="1" value="${q.s?.[1] ?? 0}"></div></div>
      <div class="muted">النتيجة بالضبط = كاملة. الفايز صح = نص النقاط.</div>`;
    if (kind === "pairs") return (q.pairs || []).map((p, i) => `<div class="ans"><b style="width:22px">${i + 1}</b><input type="text" data-p="${i}-0" value="${esc(p[0])}" placeholder="يمين"><span>↔</span><input type="text" data-p="${i}-1" value="${esc(p[1])}" placeholder="يسار">${(q.pairs || []).length > 3 ? `<button class="btn w sm" data-rmp="${i}">✕</button>` : ""}</div>`).join("") + ((q.pairs || []).length < 5 ? `<button class="btn w sm" id="addP">+ زوج</button>` : "") + `<div class="muted">يتلخبط ترتيب اليسار للاعب. 3 غلطات وتخلص.</div>`;
    return "";
  }
  function answersHtml() {
    if (kind === "tf") return ["صح", "غلط"].map((v, i) => `<label class="ans"><input type="radio" name="cr" value="${i}" ${q.a[0] === v ? "checked" : ""}> <b>${v}</b> ${q.a[0] === v ? '<span class="st new">هذا الصح</span>' : ""}</label>`).join("");
    const lab = kind === "order" ? "اكتبها بالترتيب الصح (من فوق لتحت)" : kind === "odd" ? "اختار الغريب" : "اختار الجواب الصح";
    return `<div class="muted" style="margin-bottom:6px">${lab}</div>` + q.a.map((v, i) => `<div class="ans">
      ${kind === "order" ? `<b style="width:22px;text-align:center">${i + 1}</b>` : `<input type="radio" name="cr" value="${i}" ${i === correct ? "checked" : ""}>`}
      <input type="text" data-a="${i}" value="${esc(v)}" placeholder="جواب ${i + 1}">
      ${q.a.length > 2 ? `<button class="btn w sm" data-rm="${i}" title="شيل">✕</button>` : ""}</div>`).join("") + (q.a.length < 4 ? `<button class="btn w sm" id="addA">+ جواب</button>` : "");
  }
  function draw() {
    const errs = check(build(), work(), q.id);
    o.innerHTML = `<div class="card">
      <div class="row" style="justify-content:space-between"><h2 style="margin:0">${isNew ? "سؤال جديد" : "تعديل السؤال"}</h2><button class="btn w sm" id="x">✕</button></div>
      <label class="l">الفئة</label><select id="fc">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${q.c === k ? "selected" : ""}>${v}</option>`).join("")}</select>
      <label class="l">نوع السؤال</label><select id="fk">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${kind === k ? "selected" : ""}>${v}</option>`).join("")}</select>
      ${kind === "adv" ? `<label class="l">السؤال كامل (JSON)</label><textarea id="fj" style="min-height:260px;direction:ltr;text-align:left;font-family:monospace;font-size:13px">${esc(JSON.stringify(stripId(q), null, 1))}</textarea>
        <div class="muted">هالنوع فيه رسمة أو مسيرة لاعب. عدّل النصوص بحذر وخل الشكل مثل ما هو. الجواب الصح أول واحد في "a".</div>` : `
      <label class="l">السؤال</label><textarea id="fq" maxlength="300">${esc(q.q)}</textarea>
      ${kind === "guess" ? `<label class="l">التلميحات (كل وحدة في سطر، من الأصعب للأسهل)</label><textarea id="fcl">${esc((q.clues || []).join("\n"))}</textarea>` : ""}
      <label class="l">${SPECIAL.includes(kind) ? KINDS[kind] : "الأجوبة"}</label><div id="fa">${SPECIAL.includes(kind) ? specialHtml() : answersHtml()}</div>
      <label class="l">الشرح (يطلع بعد الجواب)</label><textarea id="fe" maxlength="400">${esc(q.e)}</textarea>
      <div class="row"><div class="grow"><label class="l">النادي المرتبط (اختياري)</label><select id="fclub"><option value="">—</option>${Object.entries(CLUBS).map(([k, v]) => `<option value="${k}" ${q.club === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <div class="grow"><label class="l">صورة شعار في السؤال (اختياري)</label><select id="fimg"><option value="">بدون</option>${Object.entries(CLUBS).map(([k, v]) => `<option value="${k}" ${q.img === k ? "selected" : ""}>${v}</option>`).join("")}</select></div></div>
      <div class="muted" style="margin-top:4px">انتبه: لو حطيت شعار نادي في السؤال لا تخلي اسم النادي نفسه من الأجوبة إذا السؤال عن الشعار.</div>`}
      <label class="l">كذا بيطلع في اللعبة</label>${preview(build())}
      ${errs.length ? `<div class="banner red" style="margin-top:10px">${errs.map(esc).join("<br>")}</div>` : ""}
      <div class="row" style="margin-top:12px"><button class="btn g grow" id="sv" ${errs.length ? "disabled" : ""}>احفظ في المسودة</button>
      ${!isNew ? `<button class="btn r" id="del">احذف</button>` : ""}</div>
      <div class="muted center">الحفظ ما يوصل للاعبين إلا لما تضغط «انشر للاعبين»</div></div>`;
    $("#x", o).onclick = close;
    $("#fc", o).onchange = (e) => { q.c = e.target.value; draw(); };
    $("#fk", o).onchange = (e) => { switchKind(e.target.value); draw(); };
    if (kind === "adv") { $("#fj", o).oninput = () => { try { const v = JSON.parse($("#fj", o).value); q = { ...v, id: q.id }; $("#sv", o).disabled = check(build(), work(), q.id).length > 0; } catch { $("#sv", o).disabled = true; } }; }
    else {
      $("#fq", o).oninput = (e) => { q.q = e.target.value; refresh(); };
      $("#fe", o).oninput = (e) => { q.e = e.target.value; refresh(); };
      $("#fcl", o) && ($("#fcl", o).oninput = (e) => { q.clues = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean); refresh(); });
      $("#fclub", o).onchange = (e) => { q.club = e.target.value || undefined; draw(); };
      $("#fimg", o).onchange = (e) => { q.img = e.target.value || undefined; draw(); };
      o.querySelectorAll("[data-a]").forEach((el) => (el.oninput = () => { q.a[+el.dataset.a] = el.value; refresh(); }));
      o.querySelectorAll("[data-n]").forEach((el) => (el.oninput = () => { const v = el.value === "" ? undefined : Number(el.value); q[el.dataset.n] = v; refresh(); }));
      $("#funit", o) && ($("#funit", o).oninput = (e) => { q.unit = e.target.value || undefined; refresh(); });
      o.querySelectorAll("[data-t]").forEach((el) => (el.oninput = () => { q.teams = q.teams || ["", ""]; q.teams[+el.dataset.t] = el.value; refresh(); }));
      o.querySelectorAll("[data-s]").forEach((el) => (el.oninput = () => { q.s = q.s || [0, 0]; q.s[+el.dataset.s] = Math.max(0, parseInt(el.value || "0", 10) || 0); refresh(); }));
      o.querySelectorAll("[data-p]").forEach((el) => (el.oninput = () => { const [i, j] = el.dataset.p.split("-").map(Number); q.pairs[i][j] = el.value; refresh(); }));
      o.querySelectorAll("[data-rmp]").forEach((el) => (el.onclick = () => { q.pairs.splice(+el.dataset.rmp, 1); draw(); }));
      $("#addP", o) && ($("#addP", o).onclick = () => { q.pairs.push(["", ""]); draw(); });
      o.querySelectorAll("input[name=cr]").forEach((el) => (el.onchange = () => {
        if (kind === "tf") { q.a = el.value === "0" ? ["صح", "غلط"] : ["غلط", "صح"]; } else correct = +el.value;
        draw();
      }));
      o.querySelectorAll("[data-rm]").forEach((el) => (el.onclick = () => { const i = +el.dataset.rm; q.a.splice(i, 1); if (correct === i) correct = 0; else if (correct > i) correct--; draw(); }));
      $("#addA", o) && ($("#addA", o).onclick = () => { q.a.push(""); draw(); });
    }
    $("#sv", o).onclick = save;
    $("#del", o) && ($("#del", o).onclick = async () => {
      if (!(await ask({ title: "تحذف السؤال؟", body: esc(q.q) + "<br>تقدر ترجعه من «محذوف» قبل النشر", ok: "احذف", danger: true }))) return;
      saveDraft(work().filter((x) => x.id !== q.id), "انحذف من المسودة"); close();
    });
  }
  // تحديث المعاينة والأخطاء بدون ما نعيد رسم الحقول (عشان الكتابة ما تنقطع)
  function refresh() {
    const b = build(); const errs = check(b, work(), q.id);
    const pv = o.querySelector(".prev"); if (pv) pv.outerHTML = preview(b);
    let ban = o.querySelector(".banner.red");
    if (errs.length) { if (!ban) { ban = document.createElement("div"); ban.className = "banner red"; ban.style.marginTop = "10px"; o.querySelector(".prev").after(ban); } ban.innerHTML = errs.map(esc).join("<br>"); }
    else ban?.remove();
    $("#sv", o).disabled = errs.length > 0;
  }
  function switchKind(k) {
    if (k === "adv") { kind = "adv"; return; }
    const prevAns = q.a.filter((x) => x !== "صح" && x !== "غلط");
    for (const f of ["n", "min", "max", "step", "tol", "unit", "teams", "s", "pairs"]) delete q[f];
    if (k === "num") { q.kind = "num"; delete q.clues; delete q.odd; q.min = 0; q.max = 100; kind = k; return; }
    if (k === "score") { q.kind = "score"; delete q.clues; delete q.odd; q.teams = ["", ""]; q.s = [0, 0]; kind = k; return; }
    if (k === "pairs") { q.kind = "pairs"; delete q.clues; delete q.odd; q.pairs = [["", ""], ["", ""], ["", ""], ["", ""]]; kind = k; return; }
    if (k === "tf") { q.kind = "tf"; q.a = ["صح", "غلط"]; delete q.clues; delete q.odd; }
    else {
      if (kind === "tf" || SPECIAL.includes(kind)) q.a = ["", "", "", ""]; else if (!prevAns.length) q.a = ["", "", "", ""];
      delete q.kind; delete q.odd; delete q.career; delete q.scene;
      if (k === "order") q.kind = "order";
      if (k === "guess") { q.kind = "guess"; q.clues = q.clues || []; } else delete q.clues;
      if (k === "odd") q.odd = true;
      if (k === "blur") { q.kind = "blur"; q.c = "crests"; }
    }
    kind = k; correct = 0;
  }
  function build() {
    if (kind === "adv") return q;
    if (SPECIAL.includes(kind)) {
      const b = { ...q, q: (q.q || "").trim(), e: (q.e || "").trim() };
      if (kind === "num") { b.a = [String(b.n ?? ""), String(b.min ?? ""), String(b.max ?? "")]; if (!b.step) delete b.step; if (!b.tol) delete b.tol; }
      if (kind === "score") { b.teams = (b.teams || ["", ""]).map((t) => String(t).trim()); b.a = [`${b.s?.[0]} - ${b.s?.[1]}`, "نتيجة ثانية"]; }
      if (kind === "pairs") { b.pairs = (b.pairs || []).map((p) => [String(p[0]).trim(), String(p[1]).trim()]).filter((p) => p[0] || p[1]); b.a = ["شوف التوصيل الصح فوق", "توصيل ثاني"]; }
      Object.keys(b).forEach((k) => (b[k] === undefined || b[k] === "") && k !== "e" && delete b[k]);
      return b;
    }
    const b = { ...q, q: (q.q || "").trim(), e: (q.e || "").trim(), a: q.a.map((x) => String(x).trim()) };
    if (kind !== "tf" && kind !== "order" && correct > 0) { const a = b.a.slice(); const [c] = a.splice(correct, 1); a.unshift(c); b.a = a; }
    Object.keys(b).forEach((k) => (b[k] === undefined || b[k] === "") && k !== "e" && delete b[k]);
    return b;
  }
  function save() {
    const b = build(); const errs = check(b, work(), b.id);
    if (errs.length) return toast(errs[0]);
    const list = work().slice(); const i = list.findIndex((x) => x.id === b.id);
    if (i >= 0) list[i] = b; else list.unshift(b);
    saveDraft(list, isNew ? "انضاف للمسودة" : "انحفظ في المسودة"); close();
  }
  draw();
}
const stripId = (q) => { const { id, ...r } = q; return r; };

function preview(q) {
  const a = q.a || [];
  let ans;
  if (q.kind === "num") ans = `<div class="pa" style="background:rgba(255,255,255,.18);justify-content:center;font-size:30px">${q.n ?? "؟"} ${esc(q.unit || "")}</div><div class="muted center" style="color:#fff">بين ${q.min ?? "?"} و ${q.max ?? "?"}${q.tol ? ` · قريب لين فرق ${q.tol}` : ""}</div>`;
  else if (q.kind === "score") ans = `<div class="pa" style="background:rgba(255,255,255,.18);justify-content:center;font-size:24px">${esc(q.teams?.[0] || "…")} ${q.s?.[0] ?? 0} - ${q.s?.[1] ?? 0} ${esc(q.teams?.[1] || "…")}</div>`;
  else if (q.kind === "pairs") ans = (q.pairs || []).map((p, i) => `<div class="pa" style="background:${ANS[i % 4]}"><span>${esc(p[0] || "…")}</span><span>↔ ${esc(p[1] || "…")}</span></div>`).join("");
  else if (q.kind === "order") ans = a.map((x, i) => `<div class="pa" style="background:${ANS[i % 4]}"><span>${esc(x || "…")}</span><span>${i + 1}</span></div>`).join("");
  else {
    // اللاعب يشوف الأجوبة بترتيب عشوائي، هني نخلط ترتيب ثابت عشان تشوف الشكل
    const order = q.kind === "tf" ? [a.indexOf("صح"), a.indexOf("غلط")] : a.map((_, i) => i).sort((x, y) => ((x * 7 + 3) % 5) - ((y * 7 + 3) % 5));
    ans = order.filter((i) => i >= 0).map((i, j) => `<div class="pa ${i === 0 ? "ok" : ""}" style="background:${ANS[j % 4]}"><span>${esc(a[i] || "…")}</span><span>${i === 0 ? "✔" : ""}</span></div>`).join("");
  }
  const img = q.kind === "blur" && q.img ? `<div class="center" style="margin:10px 0"><span style="display:inline-flex;width:110px;height:110px;border-radius:50%;background:#DDE5F2;align-items:center;justify-content:center"><img src="img/crests/${q.img}.png" style="width:70px;height:70px;object-fit:contain;filter:blur(6px)"></span><div class="muted">يبدا مغبّش ويوضح مع الوقت</div></div>` : q.img ? `<div class="center" style="margin:10px 0"><span style="display:inline-flex;width:110px;height:110px;border-radius:50%;background:#fff;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(0,0,0,.2)"><img src="img/crests/${q.img}.png" style="width:70px;height:70px;object-fit:contain"></span></div>` : "";
  const clues = q.kind === "guess" && q.clues?.length ? `<div style="margin-top:8px;font-size:14px;font-weight:600;color:var(--textSoft)">${q.clues.map((c, i) => `${i + 1}. ${esc(c)}`).join("<br>")}</div>` : "";
  return `<div class="prev"><div class="qc"><span class="chip" style="background:${CAT_COLOR[q.c] || "#999"}">${esc(CATS[q.c] || "")}</span>${img}<div style="margin-top:8px">${esc(q.q || "…")}</div>${clues}</div>${ans}
    ${q.e ? `<div style="background:#fff;border-radius:14px;padding:10px;margin-top:10px;font-size:14px;color:var(--textSoft)">${esc(q.e)}</div>` : ""}</div>`;
}

/* ---------- النشر والرجوع ---------- */
async function publish() {
  const d = diff(); const list = work();
  const bad = list.map((q) => [q, check(q, null)]).filter(([, e]) => e.length);
  if (bad.length) return ask({ title: "في أسئلة فيها مشاكل", body: bad.slice(0, 6).map(([q, e]) => `• ${esc(q.q.slice(0, 60))}: ${esc(e[0])}`).join("<br>") + (bad.length > 6 ? `<br>و${bad.length - 6} غيرها` : "") + "<br>صلّحها قبل النشر", ok: "تمام", cancel: "" });
  if (list.length < 20) return ask({ title: "الأسئلة قليلة", body: "لازم 20 سؤال على الأقل عشان ننشر", ok: "تمام", cancel: "" });
  const body = firstTime() ? `بننشر ${list.length} سؤال. من الحين التطبيق ياخذ أسئلته من هاللوحة.` : `${d.added} جديد · ${d.edited} معدّل · ${d.removed} محذوف<br>المجموع بعد النشر: ${list.length} سؤال<br>تقدر ترجع للنسخة الحالية في أي وقت من «النسخ».`;
  if (!(await ask({ title: "تنشر للاعبين؟", body, ok: "انشر" }))) return;
  await doPublish(list, firstTime() ? "أول نشر من اللوحة" : `${d.added} جديد، ${d.edited} معدّل، ${d.removed} محذوف`);
  await D.remove(R("bank/draft")).catch(() => {});
}
async function doPublish(list, note) {
  const oldV = Number(S.pub?.version) || 0;
  const v = Math.max(oldV, S.ghVersion || 0) + 1;
  const upd = {};
  if (S.pub) upd[`history/${oldV}`] = { ...S.pub, archivedAt: D.serverTimestamp() };
  upd["published"] = { version: v, at: D.serverTimestamp(), count: list.length, questions: list };
  upd["meta"] = { version: v, at: D.serverTimestamp(), count: list.length };
  upd[`log/${v}`] = { at: D.serverTimestamp(), note, by: S.user.email, count: list.length };
  try {
    await D.update(R("bank"), upd);
    toast(`انتشرت النسخة ${v} ✅ توصل للاعبين أول ما يفتحون التطبيق`);
    const keys = Object.keys(S.history).map(Number).sort((a, b) => a - b);
    const extra = keys.length + (S.pub ? 1 : 0) - KEEP_HISTORY;
    if (extra > 0) { const rm = {}; keys.slice(0, extra).forEach((k) => (rm[`history/${k}`] = null)); await D.update(R("bank"), rm).catch(() => {}); }
  } catch (e) { ask({ title: "ما انتشر", body: esc(e?.code || e?.message || e) + "<br>تأكد من النت ومن قواعد الحماية", ok: "تمام", cancel: "" }); }
}
async function discard() {
  if (!(await ask({ title: "تلغي كل التعديلات؟", body: "المسودة بترجع مثل النسخة المنشورة الحين", ok: "الغها", danger: true }))) return;
  await D.remove(R("bank/draft")); toast("انلغت التعديلات");
}

/* ---------- النسخ ---------- */
function paneVersions(pane) {
  const hs = Object.entries(S.history).map(([k, v]) => ({ k: +k, ...v })).sort((a, b) => b.k - a.k);
  pane.innerHTML = `<div class="card"><h3 style="margin-top:0">النسخة المنشورة الحين</h3>
    ${S.pub ? `<div><b>النسخة ${S.pub.version}</b> · ${S.pub.questions?.length || 0} سؤال · ${fmtDate(S.pub.at)}</div>` : `<div class="muted">لسا ما انتشر شي من اللوحة. التطبيق ياخذ ملف GitHub (النسخة ${S.ghVersion || "?"})</div>`}</div>
    <div class="card"><h3 style="margin-top:0">النسخ اللي قبل</h3>
    ${hs.length ? hs.map((h) => `<div class="row" style="border-bottom:1px solid var(--line);padding:10px 0"><div class="grow"><b>النسخة ${h.k}</b> · ${h.questions?.length || 0} سؤال<div class="muted">انتشرت ${fmtDate(h.at)}</div></div>
      <button class="btn w sm" data-dl="${h.k}">نزّلها</button><button class="btn sm" data-rb="${h.k}">ارجع لها</button></div>`).join("") : `<div class="muted">ما في نسخ قبل للحين</div>`}
    <div class="muted" style="margin-top:8px">نحتفظ بآخر ${KEEP_HISTORY} نسخة. والرجوع ينشرها كنسخة جديدة، يعني ما يضيع شي.</div></div>`;
  pane.querySelectorAll("[data-rb]").forEach((b) => (b.onclick = async () => {
    const h = S.history[b.dataset.rb];
    if (!(await ask({ title: `ترجع للنسخة ${b.dataset.rb}؟`, body: `بتنتشر للاعبين على طول (${h.questions.length} سؤال). وأي تعديلات في المسودة بتنلغي.`, ok: "ارجع لها", danger: true }))) return;
    await doPublish(h.questions, `رجوع للنسخة ${b.dataset.rb}`); await D.remove(R("bank/draft")).catch(() => {});
  }));
  pane.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = () => downloadJson(S.history[b.dataset.dl].questions, `var-questions-v${b.dataset.dl}.json`)));
}

/* ---------- الملفات ---------- */
const COLS = ["الفئة", "النوع", "السؤال", "الجواب الصح", "جواب 2", "جواب 3", "جواب 4", "الشرح", "النادي", "شعار في السؤال", "التلميحات"];
function downloadTemplate() {
  const rows = [COLS,
    ["تاريخ الدوري", "اختيار من متعدد", "منو بطل الدوري موسم 2009-2010؟", "الوحدة", "العين", "الجزيرة", "الأهلي", "الوحدة فاز باللقب موسم 2009-2010.", "الوحدة", "", ""],
    ["تاريخ الدوري", "صح وغلط", "العين فاز بالدوري موسم 2017-2018.", "صح", "", "", "", "العين بطل 2017-2018.", "العين", "", ""],
    ["شعارات الأندية", "اختيار من متعدد", "شو لقب صاحب هالشعار؟", "الزعيم", "الفرسان", "الإمبراطور", "العنابي", "العين لقبه الزعيم.", "", "العين", ""],
    ["نجوم وهدافين", "خمّن من التلميحات", "منو اللاعب؟", "أسامواه جيان", "لابا كودجو", "ماركوس بيرج", "", "جيان هداف الدوري ثلاث مواسم.", "العين", "", "مهاجم من غانا | لعب للعين | هداف الدوري ثلاث مواسم"]];
  const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = COLS.map((c, i) => ({ wch: [16, 18, 46, 20, 16, 16, 16, 40, 12, 14, 40][i] }));
  const notes = XLSX.utils.aoa_to_sheet([["طريقة التعبئة"], ["الفئة: " + Object.values(CATS).join("، ")], ["النوع: اختيار من متعدد، صح وغلط، رتّب، خمّن من التلميحات، الغريب بينهم (فاضي = اختيار من متعدد)"], ["الجواب الصح: في عمود «الجواب الصح» دايماً. في «رتّب» اكتب الترتيب الصح من «الجواب الصح» لين «جواب 4»"], ["صح وغلط: اكتب «صح» أو «غلط» في عمود الجواب الصح وخل الباقي فاضي"], ["النادي وشعار في السؤال: اسم النادي بالعربي، مثل: " + Object.values(CLUBS).join("، ")], ["التلميحات: افصل بينها بـ |"]]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "الأسئلة"); XLSX.utils.book_append_sheet(wb, notes, "طريقة التعبئة");
  XLSX.writeFile(wb, "var-questions-template.xlsx");
}
function exportAll() {
  const rows = [COLS, ...work().map((q) => {
    const k = kindOf(q); const kl = k === "normal" ? "اختيار من متعدد" : k === "adv" ? "متقدم" : KINDS[k];
    return [CATS[q.c] || q.c, kl, q.q, q.a[0] || "", q.a[1] || "", q.a[2] || "", q.a[3] || "", q.e || "", CLUBS[q.club] || "", CLUBS[q.img] || "", (q.clues || []).join(" | ")];
  })];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "الأسئلة");
  XLSX.writeFile(wb, `var-questions-${new Date().toISOString().slice(0, 10)}.xlsx`);
  downloadJson(work(), `var-questions-${new Date().toISOString().slice(0, 10)}.json`);
}
function downloadJson(list, name) {
  const blob = new Blob([JSON.stringify({ version: S.pub?.version || 0, questions: list.map(stripId) }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const byLabel = (map, v) => { v = String(v || "").trim(); if (!v) return undefined; if (map[v]) return v; const k = Object.keys(map).find((k) => norm(map[k]) === norm(v)); return k || null; };
function rowToQ(r) {
  const g = (name) => String(r[name] ?? "").trim();
  const errs = [];
  const c = byLabel(CATS, g("الفئة")); if (!c) errs.push("الفئة مب معروفة");
  const kl = g("النوع"); const kind = !kl ? "normal" : (Object.keys(KINDS).find((k) => norm(KINDS[k]) === norm(kl) || k === kl) || null);
  if (!kind || kind === "adv") errs.push("النوع مب معروف");
  const q = { id: uid(), c: c || "", q: g("السؤال"), e: g("الشرح"), a: [] };
  if (kind === "tf") { const v = g("الجواب الصح"); if (v !== "صح" && v !== "غلط") errs.push("صح وغلط: الجواب لازم «صح» أو «غلط»"); q.kind = "tf"; q.a = v === "غلط" ? ["غلط", "صح"] : ["صح", "غلط"]; }
  else {
    q.a = ["الجواب الصح", "جواب 2", "جواب 3", "جواب 4"].map(g).filter(Boolean);
    if (kind === "order") q.kind = "order";
    if (kind === "guess") { q.kind = "guess"; q.clues = g("التلميحات").split("|").map((s) => s.trim()).filter(Boolean); }
    if (kind === "odd") q.odd = true;
  }
  const club = byLabel(CLUBS, g("النادي")); if (club === null) errs.push("النادي مب معروف"); else if (club) q.club = club;
  const img = byLabel(CLUBS, g("شعار في السؤال")); if (img === null) errs.push("الشعار مب معروف"); else if (img) q.img = img;
  return { q, errs };
}
function importFile() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".xlsx,.xls,.csv,.json";
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    let items = [];
    try {
      if (/\.json$/i.test(f.name)) {
        const d = JSON.parse(await f.text()); const list = Array.isArray(d) ? d : d.questions;
        if (!Array.isArray(list)) throw new Error("الملف ما فيه questions");
        items = list.map((x) => ({ q: { ...x, id: x.id || uid() }, errs: [] }));
      } else {
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array", codepage: 65001 });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        items = rows.filter((r) => Object.values(r).some((v) => String(v).trim())).map(rowToQ);
      }
    } catch (e) { return ask({ title: "ما قدرنا نقرا الملف", body: esc(e?.message || e), ok: "تمام", cancel: "" }); }
    importReview(items, f.name);
  };
  inp.click();
}
function importReview(items, name) {
  const cur = work(); const seen = new Set(cur.map((q) => norm(q.q))); const inFile = new Set();
  items.forEach((it) => {
    it.errs = it.errs.concat(check(it.q, null));
    const k = norm(it.q.q);
    it.dup = seen.has(k); if (inFile.has(k)) it.errs.push("مكرر داخل الملف"); inFile.add(k);
  });
  const good = items.filter((i) => !i.errs.length); const fresh = good.filter((i) => !i.dup);
  const o = document.createElement("div"); o.className = "ov"; document.body.appendChild(o);
  o.innerHTML = `<div class="card" style="max-width:860px"><div class="row" style="justify-content:space-between"><h2 style="margin:0">مراجعة الملف</h2><button class="btn w sm" id="x">✕</button></div>
    <div class="muted" style="margin:6px 0 10px">${esc(name)} · ${items.length} سطر</div>
    <div class="row" style="margin-bottom:10px"><span class="st new">${fresh.length} جديد وسليم</span><span class="st ed">${good.length - fresh.length} موجود من قبل</span><span class="st del">${items.length - good.length} فيه مشاكل</span></div>
    <div style="max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:14px"><table><tr><th>#</th><th>السؤال</th><th>الصح</th><th>الحالة</th></tr>
    ${items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.q.q)}</td><td>${esc(it.q.a?.[0] || "")}</td><td>${it.errs.length ? `<span class="err">${it.errs.map(esc).join("، ")}</span>` : it.dup ? "موجود" : "✅"}</td></tr>`).join("")}</table></div>
    <div class="row" style="margin-top:12px">
      <button class="btn g" id="add" ${fresh.length ? "" : "disabled"}>أضف الجديد للمسودة (${fresh.length})</button>
      <button class="btn r" id="rep" ${good.length >= 20 ? "" : "disabled"}>بدّل كل الأسئلة بالملف (${good.length})</button></div>
    <div class="muted">الأسطر اللي فيها مشاكل ما بتنضاف. وكل شي يروح المسودة أول، ما يوصل للاعبين إلا بعد «انشر».</div></div>`;
  $("#x", o).onclick = () => o.remove();
  $("#add", o).onclick = () => { saveDraft([...fresh.map((i) => i.q), ...cur], `انضاف ${fresh.length} سؤال للمسودة`); o.remove(); S.filter.st = "new"; render(); };
  $("#rep", o).onclick = async () => {
    if (!(await ask({ title: "تبدّل كل الأسئلة؟", body: `المسودة بتصير ${good.length} سؤال من الملف بس، وكل الأسئلة الثانية بتنشال منها. (النسخة المنشورة ما تتغير إلا لما تنشر)`, ok: "بدّل", danger: true }))) return;
    saveDraft(good.map((i) => i.q), "تبدلت المسودة بأسئلة الملف"); o.remove();
  };
}

/* ---------- البلاغات ---------- */
function paneReports(pane) {
  const list = Object.entries(S.reports).map(([k, v]) => ({ k, ...v })).sort((a, b) => (b.at || 0) - (a.at || 0));
  pane.innerHTML = list.length ? list.map((r) => `<div class="card">
    <div class="row" style="justify-content:space-between"><span class="st del">${esc(r.why)}</span><span class="muted">${fmtDate(r.at)}</span></div>
    <div style="font-weight:700;margin-top:8px;line-height:1.7">${esc(r.q)}</div>
    ${r.ans ? `<div class="muted">الجواب في اللعبة: ${esc(r.ans)}</div>` : ""}
    ${r.note ? `<div style="background:var(--soft);border-radius:12px;padding:10px;margin-top:8px">«${esc(r.note)}»</div>` : ""}
    <div class="row" style="margin-top:10px"><button class="btn sm" data-open="${r.k}">افتح السؤال وعدّله</button><button class="btn g sm" data-done="${r.k}">تم ✓</button></div></div>`).join("")
    : `<div class="glasscard center">ما في بلاغات 👌</div>`;
  pane.querySelectorAll("[data-done]").forEach((b) => (b.onclick = () => D.remove(R("reports/" + b.dataset.done)).then(() => toast("انقفل البلاغ")).catch((e) => toast("ما انقفل: " + (e?.code || e)))));
  pane.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => {
    const r = S.reports[b.dataset.open]; const k = norm(r.q);
    const q = work().find((x) => norm(x.q) === k) || work().find((x) => norm(x.q).includes(k.slice(0, 30)));
    if (q) editor(q); else ask({ title: "ما لقينا السؤال", body: "يمكن انحذف أو تعدل نصه. ابحث عنه في تبويب الأسئلة.", ok: "تمام", cancel: "" });
  }));
}

/* ---------- المباريات ---------- */
const DXB = 4 * 3600e3;
const toLocalInput = (iso) => { const t = new Date(iso).getTime(); if (isNaN(t)) return ""; return new Date(t + DXB).toISOString().slice(0, 16); };
const fromLocalInput = (v) => new Date(new Date(v + ":00Z").getTime() - DXB).toISOString().replace(".000", "");
const m0 = (id) => { for (const r of S.fixtures?.rounds || []) for (const m of r.matches) if (String(m.id) === String(id)) return m; return {}; };
function paneFixtures(pane) {
  const fx = S.fixtures;
  if (!fx) { pane.innerHTML = `<div class="glasscard center">يحمّل جدول المباريات…</div>`; return; }
  const rd = fx.rounds.find((r) => r.round === S.round) || fx.rounds[0];
  pane.innerHTML = `<div class="glasscard"><div class="row"><b>الجولة</b><select id="rd" style="flex:0 1 160px">${fx.rounds.map((r) => `<option value="${r.round}" ${r.round === rd.round ? "selected" : ""}>الجولة ${r.round}${r.round === fx.current ? " (الحالية)" : ""}</option>`).join("")}</select>
    <span class="muted" style="color:rgba(255,255,255,.75)">الجدول يتحدث أوتوماتيك كل ساعتين. صحّح هني بس إذا المصدر غلط.</span></div></div>
    ${rd.matches.map((m) => { const o = S.fxo[m.id]; const hs = o?.hs ?? m.hs; const as = o?.as ?? m.as; const ko = o?.ko || m.ko;
      return `<div class="card">
      <div class="match"><div><img class="mascot" src="img/${m.home}.png"> ${esc(CLUBS[m.home] || m.home)}</div><div style="font-size:22px">${o?.clear ? "– : –" : hs != null ? `${hs} : ${as}` : "– : –"}</div><div>${esc(CLUBS[m.away] || m.away)} <img class="mascot" src="img/${m.away}.png"></div></div>
      <div class="muted center" style="margin-top:4px">${fmtDate(ko)}${(o?.postponed ?? m.postponed) ? " · مؤجلة" : ""}${o ? ' · <span class="st ed">معدّلة يدوي</span>' : ""}</div>
      <details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;color:var(--royal)">صحّح</summary>
        <div class="row" style="margin-top:8px"><div class="grow"><label class="l">${esc(CLUBS[m.home])}</label><input type="number" min="0" max="20" id="h${m.id}" value="${hs ?? ""}"></div>
        <div class="grow"><label class="l">${esc(CLUBS[m.away])}</label><input type="number" min="0" max="20" id="a${m.id}" value="${as ?? ""}"></div></div>
        <label class="l">الموعد (بتوقيت الإمارات)</label><input type="datetime-local" id="k${m.id}" value="${toLocalInput(ko)}">
        <label class="ans" style="margin-top:10px"><input type="checkbox" id="p${m.id}" ${(o?.postponed ?? m.postponed) ? "checked" : ""} style="width:20px;height:20px"> مؤجلة</label>
        <div class="row"><button class="btn sm" data-save="${m.id}">احفظ</button><button class="btn w sm" data-clear="${m.id}">امسح النتيجة</button>${o ? `<button class="btn w sm" data-auto="${m.id}">رجّعها أوتوماتيك</button>` : ""}</div>
      </details></div>`; }).join("")}`;
  $("#rd").onchange = (e) => { S.round = +e.target.value; render(); };
  pane.querySelectorAll("[data-save]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.save; const h = $("#h" + id).value, a = $("#a" + id).value, k = $("#k" + id).value;
    const v = { by: S.user.email, at: D.serverTimestamp(), postponed: $("#p" + id).checked };
    if (h !== "" || a !== "") { if (h === "" || a === "") return toast("اكتب النتيجتين"); v.hs = +h; v.as = +a; v.status = "FT"; }
    if (k && k !== toLocalInput(m0(id).ko)) v.ko = fromLocalInput(k);
    try { await D.set(R("fxo/" + id), v); toast("انحفظ ✅ يوصل للاعبين أول ما يفتحون التوقعات"); } catch (e) { toast("ما انحفظ: " + (e?.code || e)); }
  }));
  pane.querySelectorAll("[data-clear]").forEach((b) => (b.onclick = () => D.set(R("fxo/" + b.dataset.clear), { clear: true, status: "NS", by: S.user.email, at: D.serverTimestamp() }).then(() => toast("انمسحت النتيجة"))));
  pane.querySelectorAll("[data-auto]").forEach((b) => (b.onclick = () => D.remove(R("fxo/" + b.dataset.auto)).then(() => toast("رجعت أوتوماتيك"))));
}

/* ---------- الأرقام ---------- */
async function paneStats(pane) {
  pane.innerHTML = `<div class="spin"></div>`;
  const val = async (p) => { try { return (await D.get(R(p))).val(); } catch { return null; } };
  const [users, preds, rooms] = await Promise.all([val("users"), val("preds"), val("rooms")]);
  if (S.tab !== "st") return;
  const live = Object.values(rooms || {}).filter((r) => r && r.state !== "gone" && (r.created || 0) > Date.now() - 6 * 3600e3);
  const playing = live.reduce((n, r) => n + Object.keys(r.players || {}).length, 0);
  const npreds = Object.values(preds || {}).reduce((n, p) => n + Object.keys(p || {}).length, 0);
  const box = (n, t) => `<div class="stat"><b>${n}</b>${t}</div>`;
  pane.innerHTML = `<div class="row" style="align-items:stretch">${box(Object.keys(users || {}).length, "لاعب مسجّل في التوقعات")}${box(Object.keys(preds || {}).length, "لاعب توقّع")}${box(npreds, "توقع")}</div>
    <div class="row" style="align-items:stretch;margin-top:8px">${box(live.length, "غرفة أونلاين شغالة")}${box(playing, "لاعب في الغرف الحين")}${box(Object.keys(S.reports).length, "بلاغ مفتوح")}</div>
    <div class="row" style="align-items:stretch;margin-top:8px">${box(S.pub?.version ?? "—", "رقم النسخة المنشورة")}${box(S.pub?.questions?.length ?? work().length, "سؤال منشور")}</div>
    <div class="glasscard" style="margin-top:12px">الألعاب اللي بروحك ما تنحسب هني لأنها تشتغل داخل التلفون بدون نت.</div>`;
}
