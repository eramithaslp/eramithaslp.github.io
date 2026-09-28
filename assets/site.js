(function(){
"use strict";
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const TAU = Math.PI * 2;

/* ---------- seeded RNG ---------- */
function rng(seed){ let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r){ let u = 0, v = 0; while(!u) u = r(); v = r(); return Math.sqrt(-2*Math.log(u)) * Math.cos(TAU*v); }

/* ---------- FFT (radix-2, in place) ---------- */
function fft(re, im){
  const n = re.length;
  for(let i=1,j=0;i<n;i++){ let bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit; if(i<j){ [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; } }
  for(let len=2;len<=n;len<<=1){
    const ang=-TAU/len, wr=Math.cos(ang), wi=Math.sin(ang);
    for(let i=0;i<n;i+=len){ let cr=1, ci=0;
      for(let k=0;k<len/2;k++){ const a=i+k, b=a+len/2;
        const xr=re[b]*cr-im[b]*ci, xi=re[b]*ci+im[b]*cr;
        re[b]=re[a]-xr; im[b]=im[a]-xi; re[a]+=xr; im[a]+=xi;
        const t=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=t; } } }
}
function makeTone(f, dur, fs=44100, amp=0.5, rampMs=10){
  const n = Math.floor(fs*dur), x = new Float64Array(n), nr = Math.floor(fs*rampMs/1000);
  for(let i=0;i<n;i++) x[i] = amp*Math.sin(TAU*f*i/fs);
  for(let i=0;i<nr;i++){ const r = 0.5*(1-Math.cos(Math.PI*i/nr)); x[i]*=r; x[n-1-i]*=r; }
  return x;
}

/* ---------- plotting ---------- */
function niceTicks(a, b, count=5){
  const span = b - a, step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag; let step = mag * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const out = []; for(let v = Math.ceil(a/step)*step; v <= b + 1e-9; v += step) out.push([+v.toFixed(10), fmt(v)]);
  return out;
}
function fmt(v){ if(Math.abs(v) >= 1000 && v % 1000 === 0) return (v/1000)+"k"; const s = +v.toFixed(3); return String(s); }

function setupCanvas(cv){
  const w = cv.clientWidth; if(!w) return null;
  const h = +(cv.dataset.h || (cv.dataset.h = cv.getAttribute("height")) || 200); const dpr = window.devicePixelRatio || 1;
  cv.style.height = h + "px"; cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
  const ctx = cv.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  return {ctx, w, h};
}
function plot(cv, o){
  const s = setupCanvas(cv); if(!s) return; const {ctx, w, h} = s;
  const m = {l: o.ylabel ? 56 : 40, r: o.rightPad || 14, t: 10, b: o.xlabel ? 40 : 24};
  const pw = w - m.l - m.r, ph = h - m.t - m.b;
  const [x0, x1] = o.xlim, [y0, y1] = o.ylim;
  const lx = v => Math.log10(v);
  const X = v => m.l + (o.xlog ? (lx(v)-lx(x0))/(lx(x1)-lx(x0)) : (v-x0)/(x1-x0)) * pw;
  const Y = v => m.t + (o.invertY ? (v-y1)/(y0-y1) : (y1-v)/(y1-y0)) * ph;
  const grid = css("--plot-grid"), axis = css("--plot-axis"), muted = css("--muted"), ink = css("--ink");
  const monoF = "11px 'JetBrains Mono', ui-monospace, monospace", dispF = "600 12px 'Schibsted Grotesk', Arial, sans-serif";
  ctx.lineWidth = 1; ctx.font = monoF; ctx.fillStyle = muted;
  const xt = o.xticks || niceTicks(x0, x1, Math.max(3, Math.floor(pw/90)));
  const yt = o.yticks || niceTicks(Math.min(y0,y1), Math.max(y0,y1), Math.max(3, Math.floor(ph/45)));
  ctx.strokeStyle = grid;
  xt.forEach(([v, l]) => { const px = X(v); ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t+ph); ctx.stroke(); ctx.textAlign = "center"; ctx.fillText(l, px, m.t+ph+15); });
  yt.forEach(([v, l]) => { const py = Y(v); ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l+pw, py); ctx.stroke(); ctx.textAlign = "right"; ctx.fillText(l, m.l-6, py+4); });
  ctx.strokeStyle = axis; ctx.strokeRect(m.l+.5, m.t+.5, pw-1, ph-1);
  ctx.font = dispF; ctx.fillStyle = muted;
  if(o.xlabel){ ctx.textAlign = "center"; ctx.fillText(o.xlabel, m.l+pw/2, h-6); }
  if(o.ylabel){ ctx.save(); ctx.translate(13, m.t+ph/2); ctx.rotate(-Math.PI/2); ctx.textAlign = "center"; ctx.fillText(o.ylabel, 0, 0); ctx.restore(); }
  ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
  (o.series || []).forEach(sr => {
    const col = sr.color.startsWith("--") ? css(sr.color) : sr.color;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = sr.width || 1.6; ctx.setLineDash(sr.dash || []);
    const n = sr.x.length;
    if(sr.line !== false){ ctx.beginPath();
      for(let i=0;i<n;i++){ const px = X(sr.x[i]), py = Y(sr.y[i] + (sr.off||0));
        if(sr.step && i){ ctx.lineTo(px, Y(sr.y[i-1] + (sr.off||0))); }
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); }
    ctx.setLineDash([]);
    if(sr.marker){ for(let i=0;i<n;i++){ const px = X(sr.x[i]), py = Y(sr.y[i]); const r = sr.msize || 5;
      ctx.lineWidth = 1.8; ctx.beginPath();
      if(sr.marker === "o"){ ctx.fillStyle = css("--surface"); ctx.arc(px, py, r, 0, TAU); ctx.fill(); ctx.stroke(); }
      else if(sr.marker === "x"){ ctx.moveTo(px-r,py-r); ctx.lineTo(px+r,py+r); ctx.moveTo(px+r,py-r); ctx.lineTo(px-r,py+r); ctx.stroke(); }
      else { ctx.fillStyle = col; ctx.arc(px, py, r, 0, TAU); ctx.fill(); } } }
  });
  ctx.restore();
  (o.labels || []).forEach(lb => { ctx.font = dispF; ctx.fillStyle = lb.color ? css(lb.color) : ink; ctx.textAlign = lb.align || "left"; ctx.fillText(lb.text, X(lb.x) + (lb.dx||0), Y(lb.y) + (lb.dy||0)); });
}
const VIRIDIS = [[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];
function cmap(t){ t = Math.max(0, Math.min(1, t)) * (VIRIDIS.length-1); const i = Math.floor(t), f = t - i, a = VIRIDIS[i], b = VIRIDIS[Math.min(i+1, VIRIDIS.length-1)]; return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f]; }
function heat(cv, o){
  const s = setupCanvas(cv); if(!s) return; const {ctx, w, h} = s;
  const m = {l: 56, r: 14, t: 10, b: 40}, pw = w-m.l-m.r, ph = h-m.t-m.b;
  const {data, nx, ny, zmin, zmax} = o;
  const img = document.createElement("canvas"); img.width = nx; img.height = ny; const ictx = img.getContext("2d"); const id = ictx.createImageData(nx, ny);
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const v = data[i*ny + j]; const c = cmap((v-zmin)/(zmax-zmin)); const p = ((ny-1-j)*nx + i)*4; id.data[p]=c[0]; id.data[p+1]=c[1]; id.data[p+2]=c[2]; id.data[p+3]=255; }
  ictx.putImageData(id, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(img, m.l, m.t, pw, ph);
  const muted = css("--muted"), axis = css("--plot-axis");
  ctx.strokeStyle = axis; ctx.strokeRect(m.l+.5, m.t+.5, pw-1, ph-1);
  ctx.font = "11px 'JetBrains Mono', monospace"; ctx.fillStyle = muted;
  niceTicks(o.xlim[0], o.xlim[1], 5).forEach(([v,l]) => { const px = m.l + (v-o.xlim[0])/(o.xlim[1]-o.xlim[0])*pw; ctx.textAlign="center"; ctx.fillText(l, px, m.t+ph+15); });
  niceTicks(o.ylim[0], o.ylim[1], 4).forEach(([v,l]) => { const py = m.t + ph - (v-o.ylim[0])/(o.ylim[1]-o.ylim[0])*ph; ctx.textAlign="right"; ctx.fillText(l, m.l-6, py+4); });
  ctx.font = "600 12px 'Schibsted Grotesk', Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillText(o.xlabel, m.l+pw/2, h-6);
  ctx.save(); ctx.translate(13, m.t+ph/2); ctx.rotate(-Math.PI/2); ctx.fillText(o.ylabel, 0, 0); ctx.restore();
}

/* ---------- syntax highlighting ---------- */
const KW = new Set("import from as def return for in if else elif while with lambda True False None and or not is class try except finally pass break continue yield global".split(" "));
const BI = new Set("print len range int float str bool list dict type round sum zip abs max min enumerate help".split(" "));
const MODS = new Set("np plt signal wavfile librosa Audio".split(" "));
const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
function highlight(src, lang){
  if(lang === "shell") return esc(src).replace(/(#[^\n]*)/g, '<span class="tk-com">$1</span>');
  const re = /(#[^\n]*)|("""[\s\S]*?"""|[rbf]?"(?:[^"\\\n]|\\.)*"|[rbf]?'(?:[^'\\\n]|\\.)*')|(\b\d+\.?\d*(?:e[-+]?\d+)?\b)|(\b[A-Za-z_]\w*\b)/g;
  let out = "", last = 0, m, prevDef = false;
  while((m = re.exec(src))){
    out += esc(src.slice(last, m.index)); last = re.lastIndex; const t = m[0];
    if(m[1]) out += `<span class="tk-com">${esc(t)}</span>`;
    else if(m[2]) out += `<span class="tk-str">${esc(t)}</span>`;
    else if(m[3]) out += `<span class="tk-num">${t}</span>`;
    else { if(KW.has(t)) out += `<span class="tk-kw">${t}</span>`;
      else if(prevDef || src[last] === "(" && !BI.has(t)) out += `<span class="tk-fn">${t}</span>`;
      else if(BI.has(t) || MODS.has(t)) out += `<span class="tk-bi">${t}</span>`;
      else out += t;
      prevDef = (t === "def"); continue; }
    prevDef = false;
  }
  return out + esc(src.slice(last));
}

/* ---------- notebook cells ---------- */
let execCount = 0;
function copyText(text, pre){
  const fallback = () => { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  try { navigator.clipboard.writeText(text).then(() => {}, fallback); } catch(e){ fallback(); }
}
function drawCell(cell){ const p = cell.dataset.plot; if(!p) return; const cv = $("canvas", cell); if(cv && AT.plots[p]) AT.plots[p](cv); }
function initCells(){
  $$(".cell").forEach(cell => {
    const pre = $("pre.code", cell); if(!pre) return;
    const lang = cell.dataset.lang || "python"; const raw = pre.textContent.replace(/^\n/, "");
    pre.innerHTML = highlight(raw, lang);
    const out = $(".out", cell);
    const bar = document.createElement("div"); bar.className = "cell-bar";
    const prompt = document.createElement("span"); prompt.className = "prompt";
    if(lang === "shell") prompt.textContent = "$";
    else if(out){ execCount++; prompt.textContent = `In [${execCount}]:`; }
    else prompt.textContent = "In [ ]:";
    const title = document.createElement("span"); title.className = "cell-title"; title.textContent = cell.dataset.title || "";
    const copy = document.createElement("button"); copy.type = "button"; copy.className = "cell-btn"; copy.textContent = "Copy";
    copy.addEventListener("click", () => { copyText(pre.textContent, pre); copy.textContent = "Copied"; setTimeout(() => copy.textContent = "Copy", 1400); });
    bar.append(prompt, title, copy);
    if(lang !== "shell"){
      const run = document.createElement("button"); run.type = "button"; run.className = "cell-btn run"; run.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 0.5L9 5L1 9.5z" fill="currentColor"/></svg>Run';
      run.setAttribute("aria-label", "Run cell: " + (cell.dataset.title || "code"));
      run.addEventListener("click", () => runCell(cell)); bar.append(run);
    }
    cell.prepend(bar);
    if(out){ const op = document.createElement("span"); op.className = "prompt"; op.textContent = prompt.textContent.replace("In", "Out");
      const body = document.createElement("div"); while(out.firstChild) body.appendChild(out.firstChild); out.append(op, body);
      if(cell.dataset.plot){ const cv = document.createElement("canvas"); cv.dataset.h = 200; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Plot output: " + (cell.dataset.title || "")); body.appendChild(cv); }
      const pr = $("pre", body); if(pr && !pr.textContent.trim()) pr.remove();
    }
  });
}
function runCell(cell){
  const prompt = $(".cell-bar .prompt", cell), out = $(".out", cell);
  prompt.textContent = "In [*]:";
  setTimeout(() => { execCount++; prompt.textContent = `In [${execCount}]:`; cell.classList.add("ran");
    if(out){ $(".prompt", out).textContent = `Out[${execCount}]:`; out.classList.remove("flash"); void out.offsetWidth; out.classList.add("flash"); drawCell(cell); } }, 280);
}


/* ---------- quiz from markup ---------- */
function initQuiz(){
  $$(".q").forEach(q => {
    if(q.dataset.ready) return; q.dataset.ready = "1";
    const ans = +q.dataset.answer, lis = $$(".opts li", q), fb = document.createElement("div"); fb.className = "fb"; fb.setAttribute("aria-live","polite"); q.appendChild(fb);
    const btns = lis.map(li => { const b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.innerHTML = li.innerHTML; li.innerHTML = ""; li.appendChild(b); return b; });
    btns.forEach((b, i) => b.addEventListener("click", () => { if(q.dataset.done) return; q.dataset.done = "1";
      if(i === ans){ b.classList.add("right"); fb.textContent = "Correct. " + (q.dataset.explain || ""); }
      else { b.classList.add("wrong"); if(btns[ans]) btns[ans].classList.add("right"); fb.textContent = "Not quite. " + (q.dataset.explain || ""); } }));
  });
}

/* ---------- table of contents ---------- */
function initNav(){
  const toc = $("#toc"); if(!toc) return;
  if(!toc.children.length){
    $$("main section[id]").forEach(s => { const h = $("h2", s); if(!h) return; const code = $(".topic-code, .mod-num", s);
      const li = document.createElement("li"); const a = document.createElement("a"); a.href = "#" + s.id;
      a.innerHTML = `<span class="n">${code ? esc(code.textContent) : ""}</span>${esc(s.dataset.short || h.textContent)}`; li.appendChild(a); toc.appendChild(li); });
  }
  const mob = $("#mnavBody");
  if(mob){ const clone = toc.cloneNode(true); clone.id = "tocMobile"; mob.appendChild(clone);
    const oc = window.bootstrap ? bootstrap.Offcanvas.getOrCreateInstance($("#mnav")) : null;
    $$("a", mob).forEach(a => a.addEventListener("click", () => oc && oc.hide())); }
  const links = $$("a", toc).concat(mob ? $$("#tocMobile a", mob) : []);
  const io = new IntersectionObserver(ents => { ents.forEach(e => { if(e.isIntersecting){ const id = e.target.id; links.forEach(l => l.classList.toggle("active", l.getAttribute("href") === "#" + id)); } }); }, {rootMargin:"-80px 0px -70% 0px"});
  $$("main section[id]").forEach(s => io.observe(s));
}

/* ---------- demos ---------- */
function runDemos(first){
  $$("[data-demo]").forEach(el => { const d = AT.demos[el.dataset.demo]; if(!d) return;
    try { if(first && d.init) d.init(el); if(d.draw) d.draw(el); } catch(e){ console.error("demo " + el.dataset.demo, e); } });
}

/* ---------- export + init ---------- */
const AT = window.AT = window.AT || {};
Object.assign(AT, {$, $$, css, TAU, rng, gauss, fft, makeTone, niceTicks, plot, heat, cmap, highlight, esc, runCell});
AT.plots = AT.plots || {}; AT.demos = AT.demos || {}; AT._init = AT._init || []; AT._redraw = AT._redraw || [];
AT.onInit = f => AT._init.push(f); AT.onRedraw = f => AT._redraw.push(f);
AT.demo = (name, def) => { AT.demos[name] = def; };

function redrawAll(){ runDemos(false); $$(".cell[data-plot]").forEach(drawCell); AT._redraw.forEach(f => { try{ f(); }catch(e){ console.error(e); } }); }
function init(){
  initCells(); initQuiz(); initNav();
  AT._init.forEach(f => { try{ f(); }catch(e){ console.error(e); } });
  runDemos(true);
  const pb = $("#predictBtn"); if(pb) pb.addEventListener("click", () => { const on = !document.body.classList.contains("predict"); document.body.classList.toggle("predict", on); pb.setAttribute("aria-pressed", on); if(!on) redrawAll(); });
  const ra = $("#runAll"); if(ra) ra.addEventListener("click", () => { $$(".cell").forEach((c, i) => { if($(".cell-btn.run", c) && $(".out", c)) setTimeout(() => runCell(c), i*60); }); });
  document.addEventListener("shown.bs.tab", redrawAll); document.addEventListener("shown.bs.collapse", redrawAll);
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(redrawAll, 120); });
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawAll); } catch(e){}
  new MutationObserver(redrawAll).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});
  redrawAll();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAll);
}
AT.redrawAll = redrawAll;
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
