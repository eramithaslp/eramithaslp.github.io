/* Unit 5 demos: u5-edit, u5-comp, u5-eq, u5-hw */
(function(){
  const {plot, TAU, rng, gauss, $} = window.AT;
  const db = v => 20 * Math.log10(Math.max(v, 1e-12));
  const fmtDb = (v, unit) => (v > 0 ? "+" : "") + v.toFixed(2) + " " + unit;
  const bind = (el, self) => el.querySelectorAll("input,select").forEach(i => {
    i.addEventListener("input", () => self.draw(el));
    i.addEventListener("change", () => self.draw(el));
  });

  /* ---------------- u5-edit: waveform editor ---------------- */
  const EDIT_FS = 8000;
  let editSig = null;
  function makeSpeechLike(){
    if(editSig) return editSig;
    const fs = EDIT_FS, n = Math.round(1.6 * fs), x = new Float64Array(n);
    const r = rng(20261217);
    // three voiced "syllables": start, end (s), peak amplitude, F0 start/end, formants
    const syl = [
      {t0:0.15, t1:0.42, a:0.45, f0a:142, f0b:128, F:[650, 1300, 2500]},
      {t0:0.50, t1:0.80, a:0.62, f0a:136, f0b:118, F:[400, 2000, 2700]},
      {t0:0.88, t1:1.12, a:0.34, f0a:124, f0b:108, F:[550, 900, 2400]}
    ];
    const res = (f, F, bw) => 1 / Math.sqrt(1 + Math.pow((f - F) / bw, 2));
    syl.forEach(s => {
      const i0 = Math.round(s.t0 * fs), i1 = Math.round(s.t1 * fs), L = i1 - i0;
      const att = Math.round(0.03 * fs), rel = Math.round(0.06 * fs);
      let ph = 0, K = 0;
      const gk = new Float64Array(64);
      for(let i = 0; i < L; i++){
        const u = i / L, f0 = (s.f0a + (s.f0b - s.f0a) * u) * (1 + 0.004 * gauss(r));
        ph += TAU * f0 / fs;
        if(i % 16 === 0){            // update harmonic weights every 2 ms
          K = Math.floor(3800 / f0);
          for(let k = 1; k <= K; k++){
            const f = k * f0;
            gk[k] = (res(f, s.F[0], 90) + 0.6 * res(f, s.F[1], 120) + 0.35 * res(f, s.F[2], 160)) / Math.sqrt(k);
          }
        }
        let v = 0;
        for(let k = 1; k <= K; k++) v += gk[k] * Math.sin(k * ph);
        let env = 1;
        if(i < att) env = 0.5 - 0.5 * Math.cos(Math.PI * i / att);
        else if(i > L - rel) env = 0.5 - 0.5 * Math.cos(Math.PI * (L - i) / rel);
        env *= 0.85 + 0.15 * Math.sin(Math.PI * u);
        x[i0 + i] += s.a * env * v;
      }
    });
    // fricative: differenced noise burst
    const f0i = Math.round(1.18 * fs), f1i = Math.round(1.40 * fs);
    let prev = 0;
    for(let i = f0i; i < f1i; i++){
      const w = gauss(r), hp = w - prev; prev = w;
      const u = (i - f0i) / (f1i - f0i);
      x[i] += 0.07 * hp * Math.sin(Math.PI * u);
    }
    // normalise voiced material to a peak of -5 dBFS, then add a low noise floor
    let pk = 0; for(let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(x[i]));
    const sc = Math.pow(10, -5 / 20) / pk;
    for(let i = 0; i < n; i++) x[i] = x[i] * sc + 0.0015 * gauss(r);
    editSig = x;
    return x;
  }
  function envelopeSeries(y, fs, bins){
    const n = y.length, xs = [], ys = [], step = n / bins;
    for(let b = 0; b < bins; b++){
      const a = Math.floor(b * step), e = Math.min(n, Math.floor((b + 1) * step));
      let mn = Infinity, mx = -Infinity;
      for(let i = a; i < e; i++){ if(y[i] < mn) mn = y[i]; if(y[i] > mx) mx = y[i]; }
      const t = (a + e) / 2 / fs;
      if(b % 2){ xs.push(t, t); ys.push(mn, mx); } else { xs.push(t, t); ys.push(mx, mn); }
    }
    return {x: xs, y: ys};
  }
  function fadeGain(u, shape){
    if(u <= 0) return 0;
    if(u >= 1) return 1;
    if(shape === "lin") return u;
    if(shape === "log") return Math.pow(10, (-60 + 60 * u) / 20);
    return 0.5 - 0.5 * Math.cos(Math.PI * u);
  }
  AT.demo("u5-edit", {
    init(el){ bind(el, this); },
    draw(el){
      const x = makeSpeechLike(), fs = EDIT_FS, n = x.length;
      const gain = +$("#u5-edit-gain", el).value, tgt = +$("#u5-edit-tgt", el).value;
      const norm = $("#u5-edit-norm", el).checked, clip = $("#u5-edit-clip", el).checked;
      const fin = +$("#u5-edit-fin", el).value, fout = +$("#u5-edit-fout", el).value;
      const shape = $("#u5-edit-shape", el).value;
      $("#u5-edit-gain-o", el).textContent = (gain > 0 ? "+" : "") + gain.toFixed(1) + " dB" + (norm ? " (ignored)" : "");
      $("#u5-edit-tgt-o", el).textContent = tgt.toFixed(1) + " dBFS" + (norm ? "" : " (off)");
      $("#u5-edit-fin-o", el).textContent = fin + " ms";
      $("#u5-edit-fout-o", el).textContent = fout + " ms";
      let pk0 = 0; for(let i = 0; i < n; i++) pk0 = Math.max(pk0, Math.abs(x[i]));
      const applied = norm ? tgt - db(pk0) : gain;
      const A = Math.pow(10, applied / 20);
      const y = new Float64Array(n);
      for(let i = 0; i < n; i++) y[i] = x[i] * A;
      const nIn = Math.round(fin / 1000 * fs), nOut = Math.round(fout / 1000 * fs);
      for(let i = 0; i < nIn && i < n; i++) y[i] *= fadeGain(i / nIn, shape);
      for(let i = 0; i < nOut && i < n; i++) y[n - 1 - i] *= fadeGain(i / nOut, shape);
      let over = 0;
      for(let i = 0; i < n; i++){
        if(Math.abs(y[i]) > 1){ over++; if(clip) y[i] = y[i] > 0 ? 1 : -1; }
      }
      let pk = 0, ss = 0;
      for(let i = 0; i < n; i++){ pk = Math.max(pk, Math.abs(y[i])); ss += y[i] * y[i]; }
      const rms = Math.sqrt(ss / n);
      $("#u5-edit-ag", el).textContent = fmtDb(applied, "dB");
      const pkEl = $("#u5-edit-pk", el);
      pkEl.textContent = fmtDb(db(pk), "dBFS"); pkEl.classList.toggle("bad", pk > 1);
      $("#u5-edit-rms", el).textContent = fmtDb(db(rms), "dBFS");
      const ncEl = $("#u5-edit-nc", el);
      ncEl.textContent = over + (clip ? " clipped" : (over ? " (clip on export)" : ""));
      ncEl.classList.toggle("bad", over > 0);
      const cvs = el.querySelectorAll("canvas");
      const eo = envelopeSeries(x, fs, 700), ep = envelopeSeries(y, fs, 700);
      const fsLine = (lim) => [{x:[0, 1.6], y:[1, 1], color:"--right", width:1, dash:[5,4]}, {x:[0, 1.6], y:[-1, -1], color:"--right", width:1, dash:[5,4]}];
      plot(cvs[0], {xlim:[0, 1.6], ylim:[-1.3, 1.3], ylabel:"Original",
        series:[{x:eo.x, y:eo.y, color:"--left", width:1}].concat(fsLine())});
      const lim = Math.max(1.3, Math.min(pk * 1.1, 10));
      plot(cvs[1], {xlim:[0, 1.6], ylim:[-lim, lim], xlabel:"Time (s)", ylabel:"Processed",
        series:[{x:ep.x, y:ep.y, color:"--accent", width:1}].concat(fsLine()),
        labels: over ? [{text: clip ? "clipped at full scale" : "above full scale", x:0.02, y:lim * 0.82, color:"--right"}] : []});
    }
  });

  /* ---------------- u5-comp: compressor ---------------- */
  function gainComputer(x, T, R, W){
    const d = x - T;
    if(W > 0 && 2 * Math.abs(d) <= W) return x + (1 / R - 1) * Math.pow(d + W / 2, 2) / (2 * W);
    if(2 * d <= (W > 0 ? -W : 0)) return x;
    return d > 0 ? T + d / R : x;
  }
  AT.demo("u5-comp", {
    init(el){ bind(el, this); },
    draw(el){
      const T = +$("#u5-comp-thr", el).value, R = +$("#u5-comp-ratio", el).value;
      const W = +$("#u5-comp-knee", el).value, M = +$("#u5-comp-mu", el).value;
      const att = +$("#u5-comp-att", el).value, rel = +$("#u5-comp-rel", el).value;
      const B = +$("#u5-comp-burst", el).value;
      $("#u5-comp-thr-o", el).textContent = T + " dBFS";
      $("#u5-comp-ratio-o", el).textContent = R.toFixed(1) + ":1";
      $("#u5-comp-knee-o", el).textContent = W + " dB";
      $("#u5-comp-mu-o", el).textContent = "+" + M.toFixed(1) + " dB";
      $("#u5-comp-att-o", el).textContent = att + " ms";
      $("#u5-comp-rel-o", el).textContent = rel + " ms";
      $("#u5-comp-burst-o", el).textContent = B + " dBFS";
      const cvs = el.querySelectorAll("canvas");
      // static curve
      const xs = [], ys = [], grs = [];
      for(let x = -60; x <= 0.001; x += 0.25){
        const y = gainComputer(x, T, R, W);
        xs.push(x); ys.push(y + M); grs.push(x - y);
      }
      const ymax = Math.max(0, Math.max.apply(null, ys)) + 3;
      plot(cvs[0], {xlim:[-60, 0], ylim:[-60, ymax], xlabel:"Input level (dBFS)", ylabel:"Output level (dBFS)",
        series:[{x:[-60, 0], y:[-60, 0], color:"--plot-axis", width:1, dash:[4,4]},
                {x:[T, T], y:[-60, ymax], color:"--muted", width:1, dash:[2,4]},
                {x:xs, y:ys, color:"--accent", width:2.2}],
        labels:[{text:"threshold", x:T, y:-55, dx:4, color:"--muted"}]});
      const grMax = Math.max(6, Math.max.apply(null, grs) * 1.1);
      plot(cvs[1], {xlim:[-60, 0], ylim:[0, grMax], xlabel:"Input level (dBFS)", ylabel:"Gain reduction (dB)",
        series:[{x:[T, T], y:[0, grMax], color:"--muted", width:1, dash:[2,4]},
                {x:xs, y:grs, color:"--right", width:2}]});
      // time behaviour for a burst
      const fsE = 2000, tOn = 0.2, tOff = 0.7;
      const tEnd = tOff + Math.max(0.5, 2.8 * rel / 1000);
      const N = Math.round(tEnd * fsE);
      const aA = Math.exp(-1 / (att / 1000 * fsE)), aR = Math.exp(-1 / (rel / 1000 * fsE));
      const lo = -40, gLo = lo - gainComputer(lo, T, R, W), gHi = B - gainComputer(B, T, R, W);
      let g = gLo, tA = null, tR = null;
      const t = [], xin = [], ytar = [], yout = [];
      for(let i = 0; i < N; i++){
        const tt = i / fsE, x = (tt >= tOn && tt < tOff) ? B : lo;
        const gt = x - gainComputer(x, T, R, W);
        g = gt > g ? aA * g + (1 - aA) * gt : aR * g + (1 - aR) * gt;
        const dG = gHi - gLo;
        if(tA === null && tt >= tOn && tt < tOff && Math.abs(dG) > 0.01 && (g - gLo) >= 0.9 * dG) tA = (tt - tOn) * 1000;
        if(tR === null && tt >= tOff && Math.abs(dG) > 0.01 && (g - gLo) <= 0.1 * dG) tR = (tt - tOff) * 1000;
        t.push(tt * 1000); xin.push(x); ytar.push(x - gt + M); yout.push(x - g + M);
      }
      const all = xin.concat(yout, ytar);
      const y0 = Math.min(-60, Math.min.apply(null, all) - 5), y1 = Math.max.apply(null, all) + 6;
      plot(cvs[2], {xlim:[0, tEnd * 1000], ylim:[y0, y1], xlabel:"Time (ms)", ylabel:"Level (dBFS)",
        series:[{x:t, y:xin, color:"--left", width:1.4},
                {x:t, y:ytar, color:"--warn", width:1.2, dash:[5,4]},
                {x:t, y:yout, color:"--accent", width:2.2}],
        labels:[{text:"burst", x:tOn * 1000, y:y1 - 3, dx:4, color:"--muted"}]});
      $("#u5-comp-gr", el).textContent = gHi.toFixed(2) + " dB";
      $("#u5-comp-out", el).textContent = (B - gHi + M).toFixed(2) + " dBFS";
      const dG = gHi - gLo;
      $("#u5-comp-ta", el).textContent = Math.abs(dG) <= 0.01 ? "no change" : (tA === null ? "not reached" : Math.round(tA) + " ms");
      $("#u5-comp-tr", el).textContent = Math.abs(dG) <= 0.01 ? "no change" : (tR === null ? "not reached" : Math.round(tR) + " ms");
    }
  });

  /* ---------------- u5-eq: parametric EQ (RBJ peaking) ---------------- */
  const EQ_FS = 48000;
  const sliderToF = v => 20 * Math.pow(1000, v / 1000);
  const fmtF = f => f < 1000 ? Math.round(f) + " Hz" : (f / 1000).toFixed(f < 10000 ? 2 : 1) + " kHz";
  function peakingCoefs(f0, G, Q){
    const A = Math.pow(10, G / 40), w0 = TAU * f0 / EQ_FS, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0);
    const a0 = 1 + al / A;
    return {b0:(1 + al * A) / a0, b1:-2 * c / a0, b2:(1 - al * A) / a0, a1:-2 * c / a0, a2:(1 - al / A) / a0};
  }
  function magDb(k, f){
    const w = TAU * f / EQ_FS, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
    const nr = k.b0 + k.b1 * c1 + k.b2 * c2, ni = -(k.b1 * s1 + k.b2 * s2);
    const dr = 1 + k.a1 * c1 + k.a2 * c2, di = -(k.a1 * s1 + k.a2 * s2);
    return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  }
  AT.demo("u5-eq", {
    init(el){ bind(el, this); },
    draw(el){
      const bands = [1, 2, 3].map(b => {
        const f = sliderToF(+$("#u5-eq-f" + b, el).value), g = +$("#u5-eq-g" + b, el).value, q = +$("#u5-eq-q" + b, el).value;
        $("#u5-eq-f" + b + "-o", el).textContent = fmtF(f);
        $("#u5-eq-g" + b + "-o", el).textContent = (g > 0 ? "+" : "") + g.toFixed(1) + " dB";
        $("#u5-eq-q" + b + "-o", el).textContent = q.toFixed(1);
        return {f, g, q, k: peakingCoefs(f, g, q)};
      });
      const N = 400, fr = [], tot = [], per = [[], [], []];
      for(let i = 0; i < N; i++){
        const f = 20 * Math.pow(1000, i / (N - 1));
        fr.push(f);
        let s = 0;
        bands.forEach((b, j) => { const v = magDb(b.k, f); per[j].push(v); s += v; });
        tot.push(s);
      }
      const at = f => bands.reduce((s, b) => s + magDb(b.k, f), 0);
      let iMax = 0, iMin = 0;
      tot.forEach((v, i) => { if(v > tot[iMax]) iMax = i; if(v < tot[iMin]) iMin = i; });
      const cols = ["--left", "--warn", "--right"];
      const series = bands.map((b, j) => ({x:fr, y:per[j], color:cols[j], width:1.2, dash:[5,4]}));
      series.push({x:fr, y:tot, color:"--accent", width:2.4});
      const lim = Math.max(20, Math.ceil((Math.max(Math.abs(tot[iMax]), Math.abs(tot[iMin])) + 2) / 5) * 5);
      plot(el.querySelector("canvas"), {xlim:[20, 20000], ylim:[-lim, lim], xlog:true,
        xticks:[[20,"20"],[50,"50"],[100,"100"],[200,"200"],[500,"500"],[1000,"1k"],[2000,"2k"],[5000,"5k"],[10000,"10k"],[20000,"20k"]],
        xlabel:"Frequency (Hz)", ylabel:"Gain (dB)", series:[{x:[20, 20000], y:[0, 0], color:"--plot-axis", width:1}].concat(series)});
      const f1 = at(1000), f4 = at(4000);
      $("#u5-eq-r1k", el).textContent = (f1 >= 0 ? "+" : "") + f1.toFixed(2) + " dB";
      $("#u5-eq-r4k", el).textContent = (f4 >= 0 ? "+" : "") + f4.toFixed(2) + " dB";
      $("#u5-eq-max", el).textContent = tot[iMax] > 0.05 ? "+" + tot[iMax].toFixed(2) + " dB at " + fmtF(fr[iMax]) : "none";
      $("#u5-eq-min", el).textContent = tot[iMin] < -0.05 ? tot[iMin].toFixed(2) + " dB at " + fmtF(fr[iMin]) : "none";
    }
  });

  /* ---------------- u5-hw: Hughson-Westlake simulation ---------------- */
  function erf(x){
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
  function runHW(thr, sd, seed, start, fa){
    const r = rng(seed * 2654435761 >>> 0);
    let level = start, heardOnce = false, prev = null, floorHeard = 0, maxMiss = 0;
    const asc = {}, trials = [];
    let est = null, note = "";
    for(let n = 1; n <= 40; n++){
      const p = fa + (1 - fa) * Phi((level - thr) / sd);
      const resp = r() < p;
      const ascending = heardOnce && prev === false;
      if(ascending){ const a = asc[level] || (asc[level] = [0, 0]); a[0] += resp ? 1 : 0; a[1] += 1; }
      trials.push({n, level, resp, ascending});
      if(ascending && asc[level][0] >= 2 && 2 * asc[level][0] >= asc[level][1]){ est = level; break; }
      if(resp){
        heardOnce = true;
        if(level <= -10){ floorHeard++; if(floorHeard >= 2){ est = -10; note = " (floor)"; break; } }
        level = Math.max(-10, level - 10);
      } else {
        if(level >= 120){ maxMiss++; if(maxMiss >= 2){ note = "no response at 120 dB HL"; break; } }
        level = Math.min(120, level + (heardOnce ? 5 : 20));
      }
      prev = resp;
    }
    return {trials, est, asc, note};
  }
  AT.demo("u5-hw", {
    init(el){ bind(el, this); },
    draw(el){
      const thr = +$("#u5-hw-thr", el).value, sd = +$("#u5-hw-sd", el).value;
      const seed = +$("#u5-hw-seed", el).value, start = +$("#u5-hw-start", el).value;
      const fa = +$("#u5-hw-fa", el).value / 100;
      $("#u5-hw-thr-o", el).textContent = thr + " dB HL";
      $("#u5-hw-sd-o", el).textContent = sd.toFixed(1) + " dB";
      $("#u5-hw-seed-o", el).textContent = seed;
      $("#u5-hw-fa-o", el).textContent = Math.round(fa * 100) + "%";
      const res = runHW(thr, sd, seed, start, fa), tr = res.trials, n = tr.length;
      const lv = tr.map(d => d.level);
      const yl0 = Math.min(Math.min.apply(null, lv), thr) - 10, yl1 = Math.max(Math.max.apply(null, lv), thr) + 10;
      const step = n <= 20 ? 1 : n <= 40 ? 2 : 5, xt = [];
      for(let i = 1; i <= n; i += step) xt.push([i, String(i)]);
      const ringX = [], ringY = [], hx = [], hy = [], mx = [], my = [];
      tr.forEach(d => {
        if(d.ascending){ ringX.push(d.n); ringY.push(d.level); }
        if(d.resp){ hx.push(d.n); hy.push(d.level); } else { mx.push(d.n); my.push(d.level); }
      });
      const series = [
        {x:[0.5, n + 0.5], y:[thr, thr], color:"--muted", width:1.2, dash:[6,4]},
        {x:tr.map(d => d.n), y:lv, color:"--plot-axis", width:1.2},
        {x:ringX, y:ringY, color:"--ink", line:false, marker:"o", msize:9},
        {x:hx, y:hy, color:"--accent", line:false, marker:"dot", msize:5},
        {x:mx, y:my, color:"--right", line:false, marker:"x", msize:5}
      ];
      const labels = [{text:"true " + thr, x:0.6, y:thr, dy:-5, color:"--muted"}];
      if(res.est !== null){
        series.push({x:[0.5, n + 0.5], y:[res.est, res.est], color:"--warn", width:1.6, dash:[3,3]});
        labels.push({text:"estimate " + res.est, x:n + 0.4, y:res.est, dy:14, color:"--warn", align:"right"});
      }
      plot(el.querySelector("canvas"), {xlim:[0.5, n + 0.5], ylim:[yl0, yl1], xticks:xt,
        xlabel:"Trial", ylabel:"Presentation level (dB HL)", series, labels});
      const estEl = $("#u5-hw-est", el), errEl = $("#u5-hw-err", el);
      if(res.est !== null){
        estEl.textContent = res.est + " dB HL" + res.note;
        const e = res.est - thr;
        errEl.textContent = (e > 0 ? "+" : "") + e + " dB";
        errEl.classList.toggle("bad", Math.abs(e) >= 10);
        const a = res.asc[res.est];
        $("#u5-hw-tal", el).textContent = a ? a[0] + " of " + a[1] + " at " + res.est + " dB HL" : "floor reached";
      } else {
        estEl.textContent = res.note || "not reached in 40 trials";
        errEl.textContent = "n/a"; errEl.classList.remove("bad");
        $("#u5-hw-tal", el).textContent = "n/a";
      }
      $("#u5-hw-n", el).textContent = n;
    }
  });
})();

(function(){
  const {plot, css, TAU, rng, gauss, fft, $} = window.AT;
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* ---------- u5-4-console: simulated command window ---------- */
  const CON = [
{
"cmd": "3 + 4 * 2",
"out": "ans = 11",
"note": "Multiplication is done before addition, so this is 3 + 8. The result goes into the automatic variable ans.",
"ws": [
[
"ans",
"1x1",
"double"
]
]
},
{
"cmd": "(3 + 4) * 2",
"out": "ans = 14",
"note": "Brackets are evaluated first. ans is overwritten with the new result.",
"ws": [
[
"ans",
"1x1",
"double"
]
]
},
{
"cmd": "20*log10(2)",
"out": "ans = 6.0206",
"note": "Doubling a pressure ratio adds about 6.02 dB.",
"ws": [
[
"ans",
"1x1",
"double"
]
]
},
{
"cmd": "p = 0.02;",
"out": "",
"note": "The semicolon suppresses the display, but the variable p (sound pressure in pascals) is still created. Look at the Workspace.",
"ws": [
[
"ans",
"1x1",
"double"
],
[
"p",
"1x1",
"double"
]
]
},
{
"cmd": "spl = 20*log10(p/20e-6)",
"out": "spl = 60",
"note": "SPL of 0.02 Pa re 20 micropascals: 60 dB SPL.",
"ws": [
[
"ans",
"1x1",
"double"
],
[
"p",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
]
]
},
{
"cmd": "L = 10*log10(10^(60/10) + 10^(60/10))",
"out": "L = 63.010",
"note": "Two incoherent 60 dB sounds add to about 63 dB, not 120 dB.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x1",
"double"
],
[
"p",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
]
]
},
{
"cmd": "f = [250 500 1000 2000 4000 8000]",
"out": "f =\n\n    250    500   1000   2000   4000   8000",
"note": "A row vector of audiometric frequencies: size 1x6, class double.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x1",
"double"
],
[
"f",
"1x6",
"double"
],
[
"p",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
]
]
},
{
"cmd": "thr = [20 25 35 50 60 65];",
"out": "",
"note": "Thresholds in dB HL for the same six frequencies (display suppressed).",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x1",
"double"
],
[
"f",
"1x6",
"double"
],
[
"p",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"thr",
"1x6",
"double"
]
]
},
{
"cmd": "size(thr)",
"out": "ans =\n\n   1   6",
"note": "size returns [rows columns].",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x2",
"double"
],
[
"f",
"1x6",
"double"
],
[
"p",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"thr",
"1x6",
"double"
]
]
},
{
"cmd": "pta = mean(thr(2:4))",
"out": "pta = 36.667",
"note": "Elements 2 to 4 are the 500, 1000 and 2000 Hz thresholds; their mean is the three-frequency PTA.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x2",
"double"
],
[
"f",
"1x6",
"double"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"thr",
"1x6",
"double"
]
]
},
{
"cmd": "thr(end)",
"out": "ans = 65",
"note": "end means the last index, here the 8 kHz threshold.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x1",
"double"
],
[
"f",
"1x6",
"double"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"thr",
"1x6",
"double"
]
]
},
{
"cmd": "thr > 40",
"out": "ans =\n\n  0  0  0  1  1  1",
"note": "A comparison gives a logical vector (1 = true, 0 = false).",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x6",
"logical"
],
[
"f",
"1x6",
"double"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"thr",
"1x6",
"double"
]
]
},
{
"cmd": "f(thr > 40)",
"out": "ans =\n\n   2000   4000   8000",
"note": "Logical indexing picks the frequencies where the threshold exceeds 40 dB HL.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x3",
"double"
],
[
"f",
"1x6",
"double"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"thr",
"1x6",
"double"
]
]
},
{
"cmd": "x = 1:5",
"out": "x =\n\n   1   2   3   4   5",
"note": "The colon operator makes a row vector from 1 to 5 in steps of 1.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x3",
"double"
],
[
"f",
"1x6",
"double"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"thr",
"1x6",
"double"
],
[
"x",
"1x5",
"double"
]
]
},
{
"cmd": "x .^ 2",
"out": "ans =\n\n    1    4    9   16   25",
"note": "The dot makes the power element-wise: each element is squared.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x5",
"double"
],
[
"f",
"1x6",
"double"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"thr",
"1x6",
"double"
],
[
"x",
"1x5",
"double"
]
]
},
{
"cmd": "fs = 16000; t = (0:3)/fs",
"out": "t =\n\n            0   6.2500e-05   1.2500e-04   1.8750e-04",
"note": "Sample times of the first four samples at 16 kHz, in seconds. Several commands can share one line.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x5",
"double"
],
[
"f",
"1x6",
"double"
],
[
"fs",
"1x1",
"double"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"t",
"1x4",
"double"
],
[
"thr",
"1x6",
"double"
],
[
"x",
"1x5",
"double"
]
]
},
{
"cmd": "name = 'Right ear'",
"out": "name = Right ear",
"note": "Single quotes make a character array (class char), one element per character.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x5",
"double"
],
[
"f",
"1x6",
"double"
],
[
"fs",
"1x1",
"double"
],
[
"name",
"1x9",
"char"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"t",
"1x4",
"double"
],
[
"thr",
"1x6",
"double"
],
[
"x",
"1x5",
"double"
]
]
},
{
"cmd": "class(name)",
"out": "ans = char",
"note": "class reports the data type of a variable.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x4",
"char"
],
[
"f",
"1x6",
"double"
],
[
"fs",
"1x1",
"double"
],
[
"name",
"1x9",
"char"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"t",
"1x4",
"double"
],
[
"thr",
"1x6",
"double"
],
[
"x",
"1x5",
"double"
]
]
},
{
"cmd": "ok = pta > 25",
"out": "ok = 1",
"note": "A single logical value: the PTA is greater than 25 dB HL.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x4",
"char"
],
[
"f",
"1x6",
"double"
],
[
"fs",
"1x1",
"double"
],
[
"name",
"1x9",
"char"
],
[
"ok",
"1x1",
"logical"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"t",
"1x4",
"double"
],
[
"thr",
"1x6",
"double"
],
[
"x",
"1x5",
"double"
]
]
},
{
"cmd": "clear x",
"out": "",
"note": "clear removes a variable from the Workspace; x disappears from the table.",
"ws": [
[
"L",
"1x1",
"double"
],
[
"ans",
"1x4",
"char"
],
[
"f",
"1x6",
"double"
],
[
"fs",
"1x1",
"double"
],
[
"name",
"1x9",
"char"
],
[
"ok",
"1x1",
"logical"
],
[
"p",
"1x1",
"double"
],
[
"pta",
"1x1",
"double"
],
[
"spl",
"1x1",
"double"
],
[
"t",
"1x4",
"double"
],
[
"thr",
"1x6",
"double"
]
]
}
];
  AT.demo("u5-4-console", {
    init(el){
      const sel = el.querySelector("#u5-4-console-sel");
      CON.forEach((s, i) => { const o = document.createElement("option"); o.value = i; o.textContent = (i + 1) + ".  " + s.cmd; sel.appendChild(o); });
      this.i = 0;
      sel.addEventListener("change", () => { this.i = +sel.value; this.draw(el); });
      el.querySelector("#u5-4-console-prev").addEventListener("click", () => { this.i = Math.max(0, this.i - 1); this.draw(el); });
      el.querySelector("#u5-4-console-next").addEventListener("click", () => { this.i = Math.min(CON.length - 1, this.i + 1); this.draw(el); });
      el.querySelector("#u5-4-console-reset").addEventListener("click", () => { this.i = 0; this.draw(el); });
    },
    draw(el){
      const i = this.i || 0, s = CON[i];
      el.querySelector("#u5-4-console-sel").value = i;
      el.querySelector("#u5-4-console-step").textContent = "Step " + (i + 1) + " of " + CON.length;
      let h = "";
      for(let k = 0; k <= i; k++){
        const c = CON[k], cur = k === i;
        h += '<span style="color:var(--' + (cur ? "accent" : "muted") + ')">&gt;&gt; ' + esc(c.cmd) + "</span>\n";
        if(c.out) h += '<span style="color:var(--' + (cur ? "ink" : "muted") + ')">' + esc(c.out) + "</span>\n";
      }
      const pre = el.querySelector("#u5-4-console-win");
      pre.innerHTML = h + '<span style="color:var(--accent)">&gt;&gt; </span>';
      pre.scrollTop = pre.scrollHeight;
      el.querySelector("#u5-4-console-note").textContent = s.note;
      const prev = i > 0 ? CON[i - 1].ws : [];
      const pm = {}; prev.forEach(r => pm[r[0]] = r.join("|"));
      const tb = el.querySelector("#u5-4-console-ws");
      if(!s.ws.length){ tb.innerHTML = '<tr><td colspan="3" class="muted">(empty)</td></tr>'; }
      else tb.innerHTML = s.ws.map(r => {
        const changed = pm[r[0]] !== r.join("|");
        return "<tr" + (changed ? ' style="background:var(--accent-soft)"' : "") + "><td><code>" + esc(r[0]) + "</code>" + (changed ? ' <span class="muted" style="font-size:.75rem">' + (pm[r[0]] ? "changed" : "new") + "</span>" : "") + '</td><td class="num">' + esc(r[1]) + '</td><td class="num">' + esc(r[2]) + "</td></tr>";
      }).join("");
      const gone = prev.filter(r => !s.ws.some(q => q[0] === r[0])).map(r => r[0]);
      el.querySelector("#u5-4-console-gone").textContent = gone.length ? "Removed from the Workspace in this step: " + gone.join(", ") : "";
    }
  });

  /* ---------- u5-4-index: indexing visualiser ---------- */
  const IDX = [
{
"e": "A(2,3)",
"out": "ans = 25",
"lin": [
10
]
},
{
"e": "A(:,4)",
"out": "ans =\n\n   45\n   40\n   60\n   15",
"lin": [
13,
14,
15,
16
]
},
{
"e": "A(1,:)",
"out": "ans =\n\n   15   20   30   45   60   65",
"lin": [
1,
5,
9,
13,
17,
21
]
},
{
"e": "A(end,end)",
"out": "ans = 50",
"lin": [
24
]
},
{
"e": "A(end,:)",
"out": "ans =\n\n    5   10   10   15   35   50",
"lin": [
4,
8,
12,
16,
20,
24
]
},
{
"e": "A(3,2:4)",
"out": "ans =\n\n   30   45   60",
"lin": [
7,
11,
15
]
},
{
"e": "A(:,2:4)",
"out": "ans =\n\n   20   30   45\n   15   25   40\n   30   45   60\n   10   10   15",
"lin": [
5,
6,
7,
8,
9,
10,
11,
12,
13,
14,
15,
16
]
},
{
"e": "A([1 3],:)",
"out": "ans =\n\n   15   20   30   45   60   65\n   20   30   45   60   70   80",
"lin": [
1,
3,
5,
7,
9,
11,
13,
15,
17,
19,
21,
23
]
},
{
"e": "A(2:3,[1 6])",
"out": "ans =\n\n   10   70\n   20   80",
"lin": [
2,
3,
22,
23
]
},
{
"e": "A(5)",
"out": "ans = 20",
"lin": [
5
]
},
{
"e": "A(1,end)",
"out": "ans = 65",
"lin": [
21
]
},
{
"e": "A(:,end-1:end)",
"out": "ans =\n\n   60   65\n   55   70\n   70   80\n   35   50",
"lin": [
17,
18,
19,
20,
21,
22,
23,
24
]
},
{
"e": "A(A>40)",
"out": "ans =\n\n   45\n   45\n   60\n   60\n   55\n   70\n   65\n   70\n   80\n   50",
"lin": [
11,
13,
15,
17,
18,
19,
21,
22,
23,
24
]
},
{
"e": "find(A>40)",
"out": "ans =\n\n   11\n   13\n   15\n   17\n   18\n   19\n   21\n   22\n   23\n   24",
"lin": [
11,
13,
15,
17,
18,
19,
21,
22,
23,
24
]
}
];
  const A = [[15,20,30,45,60,65],[10,15,25,40,55,70],[20,30,45,60,70,80],[5,10,10,15,35,50]];
  const FR = ["250","500","1k","2k","4k","8k"];
  AT.demo("u5-4-index", {
    init(el){
      const sel = el.querySelector("#u5-4-index-sel");
      IDX.forEach((d, i) => { const o = document.createElement("option"); o.value = i; o.textContent = d.e; sel.appendChild(o); });
      el.querySelectorAll("select,input").forEach(c => c.addEventListener("change", () => this.draw(el)));
    },
    draw(el){
      const d = IDX[+el.querySelector("#u5-4-index-sel").value || 0];
      const showLin = el.querySelector("#u5-4-index-lin").checked;
      const isFind = d.e.indexOf("find") === 0;
      const order = {}; d.lin.forEach((v, k) => { if(!(v in order)) order[v] = k + 1; });
      let h = '<thead><tr><th></th>' + FR.map((f, j) => "<th>col " + (j + 1) + "<br>" + f + " Hz</th>").join("") + "</tr></thead><tbody>";
      for(let r = 0; r < 4; r++){
        h += "<tr><th>row " + (r + 1) + "<br>P" + (r + 1) + "</th>";
        for(let c = 0; c < 6; c++){
          const lin = c * 4 + r + 1, on = lin in order;
          h += '<td class="num" style="text-align:center;' + (on ? "background:var(--accent-soft);outline:2px solid var(--accent);outline-offset:-2px;" : "") + '">' + A[r][c] +
            (showLin ? '<div class="muted" style="font-size:.7rem">(' + lin + ")</div>" : "") +
            (on ? '<div style="font-size:.7rem;color:var(--accent)">#' + order[lin] + "</div>" : "") + "</td>";
        }
        h += "</tr>";
      }
      el.querySelector("#u5-4-index-grid").innerHTML = h + "</tbody>";
      el.querySelector("#u5-4-index-out").textContent = ">> " + d.e + "\n" + d.out;
      el.querySelector("#u5-4-index-n").textContent = d.lin.length + (d.lin.length === 1 ? " element selected" : " elements selected") +
        (isFind ? "; find returns the linear indices themselves, not the values" : "") + ". The #numbers show the order in which elements appear in the result (column by column).";
    }
  });

  /* ---------- u5-4-plot: plotting playground ---------- */
  const FSV = [8000, 16000, 22050, 44100];
  AT.demo("u5-4-plot", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const sig = el.querySelector("#u5-4-plot-sig").value, typ = el.querySelector("#u5-4-plot-type").value;
      const f = +el.querySelector("#u5-4-plot-f").value, fs = FSV[+el.querySelector("#u5-4-plot-fs").value];
      el.querySelector("#u5-4-plot-f-o").textContent = f + " Hz";
      el.querySelector("#u5-4-plot-fs-o").textContent = fs + " Hz (Nyquist " + fs / 2 + " Hz)";
      const N = 8192, x = new Float64Array(N), r = rng(1), T = N / fs;
      for(let n = 0; n < N; n++){
        const t = n / fs;
        if(sig === "tone") x[n] = 0.5 * Math.sin(TAU * f * t);
        else if(sig === "two") x[n] = 0.5 * Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 1.5 * f * t);
        else if(sig === "noise") x[n] = 0.2 * gauss(r);
        else x[n] = 0.5 * Math.sin(TAU * (100 * t + (f - 100) / (2 * T) * t * t));
      }
      const cv = el.querySelector("canvas");
      let code = "fs = " + fs + ";  f = " + f + ";  N = " + N + ";\nt = (0:N-1)' / fs;               % time axis in seconds\n";
      if(sig === "tone") code += "x = 0.5 * sin(2*pi*f*t);          % pure tone\n";
      else if(sig === "two") code += "x = 0.5*sin(2*pi*f*t) + 0.25*sin(2*pi*1.5*f*t);   % two tones\n";
      else if(sig === "noise") code += "rng(1);  x = 0.2 * randn(N, 1);   % Gaussian white noise\n";
      else code += "T = N / fs;                        % duration in seconds\nx = 0.5 * sin(2*pi*(100*t + (f-100)/(2*T)*t.^2));   % linear chirp 100 Hz to f\n";
      if(typ === "plot"){
        const xs = [], ys = [], nmax = Math.min(N, Math.round(0.01 * fs));
        for(let n = 0; n < nmax; n++){ xs.push(1000 * n / fs); ys.push(x[n]); }
        plot(cv, {xlim:[0, 10], ylim:[-0.8, 0.8], xlabel:"Time (ms)", ylabel:"Amplitude", series:[{x:xs, y:ys, color:"--accent", width:1.6}]});
        code += "plot(t*1000, x);  xlim([0 10]);\nxlabel('Time (ms)');  ylabel('Amplitude');  grid on;";
      } else if(typ === "stem"){
        const xs = [], ys = [], xl = [], yl = [];
        for(let n = 0; n < 32; n++){ xs.push(n); ys.push(x[n]); }
        for(let k = 0; k <= 400; k++){ const tn = k * 31 / 400; xl.push(tn); yl.push(sig === "noise" ? NaN : sigAt(sig, f, tn / fs, T)); }
        const ser = [];
        xs.forEach((v, k) => ser.push({x:[v, v], y:[0, ys[k]], color:"--accent", width:1.2}));
        ser.push({x:xs, y:ys, color:"--accent", marker:"o", msize:3.5, line:false});
        if(sig !== "noise") ser.unshift({x:xl, y:yl, color:"--plot-axis", width:1, dash:[4,4]});
        plot(cv, {xlim:[-0.5, 31.5], ylim:[-0.8, 0.8], xlabel:"Sample index n (starting at 0)", ylabel:"x[n]", series:ser});
        code += "n = 0:31;\nstem(n, x(1:32), 'filled');       % first 32 samples\nxlabel('Sample index n');  ylabel('x[n]');";
      } else {
        const re = new Float64Array(N), im = new Float64Array(N); let sw = 0;
        for(let n = 0; n < N; n++){ const w = 0.5 - 0.5 * Math.cos(TAU * n / (N - 1)); re[n] = x[n] * w; sw += w; }
        fft(re, im);
        const xs = [], ys = [];
        for(let k = 1; k <= N / 2; k++){ const fk = k * fs / N; if(fk < 20) continue; let a = Math.hypot(re[k], im[k]) / sw; if(k < N / 2) a *= 2; xs.push(fk); ys.push(Math.max(-120, 20 * Math.log10(a + 1e-12))); }
        plot(cv, {xlim:[20, fs / 2], xlog:true, ylim:[-100, 0], xlabel:"Frequency (Hz)", ylabel:"Level (dB re full scale)", xticks:[[31.5,"31.5"],[63,"63"],[125,"125"],[250,"250"],[500,"500"],[1000,"1k"],[2000,"2k"],[4000,"4k"],[8000,"8k"],[16000,"16k"]].filter(v => v[0] <= fs / 2), series:[{x:xs, y:ys, color:"--accent", width:1.3}]});
        code += "w = 0.5 - 0.5*cos(2*pi*(0:N-1)'/(N-1));   % Hann window (base MATLAB)\nX = fft(x .* w);\nA = abs(X(1:N/2+1)) / sum(w);  A(2:end-1) = 2*A(2:end-1);   % single-sided\nfk = (0:N/2)' * fs / N;           % frequency of each bin\nsemilogx(fk(2:end), 20*log10(A(2:end)));  xlim([20 fs/2]);  ylim([-100 0]);\nxlabel('Frequency (Hz)');  ylabel('Level (dB re full scale)');  grid on;";
      }
      el.querySelector("#u5-4-plot-code").textContent = code;
      let msg = "";
      if(sig !== "noise" && f > fs / 2) msg = "The frequency is above the Nyquist frequency (" + fs / 2 + " Hz): the tone is aliased and appears at " + Math.abs(f - fs * Math.round(f / fs)) + " Hz.";
      else if(sig === "two" && 1.5 * f > fs / 2) msg = "The second tone (" + 1.5 * f + " Hz) is above the Nyquist frequency and is aliased to " + Math.abs(1.5 * f - fs * Math.round(1.5 * f / fs)) + " Hz.";
      else if(sig === "tone" || sig === "two") msg = "Samples per cycle at " + f + " Hz: " + (fs / f).toFixed(1) + ".";
      else if(sig === "chirp") msg = "The chirp sweeps linearly from 100 Hz to " + f + " Hz over " + T.toFixed(3) + " s.";
      else msg = "White noise has a flat long-term spectrum; the ragged detail is random variation between FFT bins.";
      el.querySelector("#u5-4-plot-msg").textContent = msg;
    }
  });
  function sigAt(sig, f, t, T){
    if(sig === "tone") return 0.5 * Math.sin(TAU * f * t);
    if(sig === "two") return 0.5 * Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 1.5 * f * t);
    return 0.5 * Math.sin(TAU * (100 * t + (f - 100) / (2 * T) * t * t));
  }
})();

/* Unit 5 extension demos: u5-5-effects, u5-5-noise, u5-6-multitrack */
(function(){
  const {plot, heat, TAU, rng, gauss, fft} = window.AT;
  const db = v => 20 * Math.log10(Math.max(v, 1e-12));
  const sgn = v => { const r = Math.round(v * 10) / 10; return (r > 0 ? "+" : "") + (r === 0 ? "0.0" : r.toFixed(1)); };
  const bindAll = (el, self) => el.querySelectorAll("input,select").forEach(i => {
    i.addEventListener("input", () => self.draw(el));
    i.addEventListener("change", () => self.draw(el));
  });
  const peakOf = x => { let p = 0; for(let i = 0; i < x.length; i++){ const a = Math.abs(x[i]); if(a > p) p = a; } return p; };
  const rmsOf = x => { let s = 0; for(let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, x.length)); };

  /* speech-like syllables: harmonic source shaped by three formant peaks */
  function syllables(fs, n, list, seed){
    const x = new Float64Array(n), r = rng(seed);
    const res = (f, F, bw) => 1 / Math.sqrt(1 + Math.pow((f - F) / bw, 2));
    const gk = new Float64Array(80);
    list.forEach(s => {
      const i0 = Math.round(s.t0 * fs), i1 = Math.min(n, Math.round(s.t1 * fs)), L = i1 - i0;
      const att = Math.round(0.025 * fs), rel = Math.round(0.05 * fs);
      let ph = 0, K = 0;
      for(let i = 0; i < L; i++){
        const u = i / L, f0 = (s.f0a + (s.f0b - s.f0a) * u) * (1 + 0.003 * gauss(r));
        ph += TAU * f0 / fs;
        if(i % 16 === 0){
          K = Math.min(79, Math.floor(0.47 * fs / f0));
          for(let k = 1; k <= K; k++){
            const f = k * f0;
            gk[k] = (res(f, s.F[0], 90) + 0.6 * res(f, s.F[1], 120) + 0.35 * res(f, s.F[2], 160)) / Math.sqrt(k);
          }
        }
        let v = 0;
        for(let k = 1; k <= K; k++) v += gk[k] * Math.sin(k * ph);
        let env = 1;
        if(i < att) env = 0.5 - 0.5 * Math.cos(Math.PI * i / att);
        else if(i > L - rel) env = 0.5 - 0.5 * Math.cos(Math.PI * (L - i) / rel);
        x[i0 + i] += s.a * env * v;
      }
    });
    return x;
  }
  function scaleTo(x, targetDb, useRms){
    const m = useRms ? rmsOf(x) : peakOf(x), g = Math.pow(10, targetDb / 20) / Math.max(m, 1e-12);
    for(let i = 0; i < x.length; i++) x[i] *= g;
    return x;
  }
  /* min/max envelope for plotting long signals */
  function envXY(x, fs, bins, off){
    const n = x.length, xs = [], ys = [], step = n / bins; off = off || 0;
    for(let b = 0; b < bins; b++){
      const a = Math.floor(b * step), e = Math.max(a + 1, Math.min(n, Math.floor((b + 1) * step)));
      let lo = Infinity, hi = -Infinity;
      for(let i = a; i < e; i++){ if(x[i] < lo) lo = x[i]; if(x[i] > hi) hi = x[i]; }
      const t = a / fs;
      xs.push(t, t); ys.push(lo + off, hi + off);
    }
    return {x: xs, y: ys};
  }
  /* magnitude spectrum in dBFS (Hann, amplitude-corrected), whole signal */
  function spectrum(x, N){
    const re = new Float64Array(N), im = new Float64Array(N), L = Math.min(N, x.length);
    let wsum = 0;
    for(let i = 0; i < L; i++){ const w = 0.5 - 0.5 * Math.cos(TAU * i / (L - 1)); re[i] = x[i] * w; wsum += w; }
    fft(re, im);
    const out = new Float64Array(N / 2);
    for(let k = 0; k < N / 2; k++) out[k] = db(2 * Math.hypot(re[k], im[k]) / wsum);
    return out;
  }
  /* RBJ biquads */
  function biquad(type, f0, Q, fs){
    const w = TAU * f0 / fs, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * Q);
    let b0, b1, b2, a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
    if(type === "lp"){ b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
    else if(type === "hp"){ b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
    else { b0 = 1; b1 = -2 * cw; b2 = 1; }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function runBiquad(x, c){
    const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for(let i = 0; i < x.length; i++){
      const v = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  function onePole(x, type, fc, fs){
    const K = Math.tan(Math.PI * fc / fs), y = new Float64Array(x.length);
    let b0, b1, a1;
    if(type === "lp"){ b0 = K / (1 + K); b1 = b0; } else { b0 = 1 / (1 + K); b1 = -b0; }
    a1 = (K - 1) / (K + 1);
    let x1 = 0, y1 = 0;
    for(let i = 0; i < x.length; i++){ const v = b0 * x[i] + b1 * x1 - a1 * y1; x1 = x[i]; y1 = v; y[i] = v; }
    return y;
  }
  function butter(x, type, fc, order, fs){
    if(order === 1) return onePole(x, type, fc, fs);
    if(order === 2) return runBiquad(x, biquad(type, fc, Math.SQRT1_2, fs));
    let y = runBiquad(x, biquad(type, fc, 0.5412, fs));
    return runBiquad(y, biquad(type, fc, 1.3066, fs));
  }

  /* ---------------- u5-5-effects ---------------- */
  const EF_FS = 16000, EF_N = 8192;
  let efSig = null;
  function efSignal(){
    if(efSig) return efSig;
    const n = EF_N;
    const x = syllables(EF_FS, n, [
      {t0:0.03, t1:0.22, a:0.5, f0a:150, f0b:132, F:[700, 1200, 2600]},
      {t0:0.27, t1:0.47, a:0.8, f0a:140, f0b:120, F:[350, 2100, 2800]}
    ], 55501);
    scaleTo(x, -6, false);
    const r = rng(9001);
    let prev = 0;
    for(let i = 0; i < n; i++){
      const t = i / EF_FS;
      // mains hum (50 Hz plus harmonics) and a little hiss, as in a real clinic recording
      x[i] += 0.012 * Math.sin(TAU * 50 * t) + 0.005 * Math.sin(TAU * 150 * t + 0.4);
      const w = gauss(r); x[i] += 0.0015 * (w - 0.5 * prev); prev = w;
    }
    efSig = x;
    return x;
  }
  const EFFECTS = {
    amplify: {label:"Amplify", params:[{n:"Gain", min:-20, max:20, step:0.5, v:8, u:" dB"}],
      apply(x, p){ const g = Math.pow(10, p[0] / 20); return x.map(v => g * v); },
      note:"Every sample is multiplied by 10^(G/20). Peaks above 0 dBFS will clip when exported to a 16 or 24-bit file (shown clipped here)."},
    normalise: {label:"Normalise (peak or RMS)", params:[{n:"Target", min:-40, max:0, step:0.5, v:-1, u:" dBFS"}, {n:"Mode", min:0, max:1, step:1, v:0, lab:["peak", "RMS"]}],
      apply(x, p){ const m = p[1] ? rmsOf(x) : peakOf(x), g = Math.pow(10, p[0] / 20) / m; return x.map(v => g * v); },
      note:"One gain is computed from the whole selection and applied everywhere; spectrum shape is unchanged, only shifted in level."},
    fade: {label:"Fade in / fade out", params:[{n:"Fade length", min:5, max:250, step:5, v:120, u:" ms"}, {n:"Shape", min:0, max:2, step:1, v:0, lab:["linear", "exponential (dB-linear)", "S-curve (raised cosine)"]}, {n:"Where", min:0, max:2, step:1, v:2, lab:["fade in", "fade out", "both"]}],
      apply(x, p){
        const L = Math.max(2, Math.round(p[0] / 1000 * EF_FS)), y = Float64Array.from(x);
        const shape = u => p[1] === 0 ? u : p[1] === 1 ? (u <= 0 ? 0 : Math.pow(10, -60 * (1 - u) / 20)) : 0.5 - 0.5 * Math.cos(Math.PI * u);
        for(let i = 0; i < L && i < y.length; i++){
          const g = shape(i / (L - 1));
          if(p[2] !== 1) y[i] *= g;
          if(p[2] !== 0) y[y.length - 1 - i] *= g;
        }
        return y;
      },
      note:"Gain rises (or falls) over the fade. Short S-curve ramps give the cleanest onsets; very short linear ramps spread energy across frequency."},
    tremolo: {label:"Tremolo (amplitude modulation)", params:[{n:"Rate", min:1, max:20, step:0.5, v:6, u:" Hz"}, {n:"Depth", min:0, max:100, step:5, v:60, u:" %"}],
      apply(x, p){ const d = p[1] / 100; return x.map((v, i) => v * (1 - d / 2 + d / 2 * Math.sin(TAU * p[0] * i / EF_FS))); },
      note:"g(t) = 1 - d/2 + (d/2) sin(2 pi fm t). The spectrum gains sidebands at plus and minus the rate around each harmonic; the envelope changes most."},
    vibrato: {label:"Vibrato (pitch modulation)", params:[{n:"Rate", min:1, max:10, step:0.5, v:5.5, u:" Hz"}, {n:"Depth", min:0, max:100, step:5, v:50, u:" cents"}],
      apply(x, p){
        const fm = p[0], r = Math.pow(2, p[1] / 1200), d = (r - 1) / (TAU * fm), D0 = d + 0.001;
        const y = new Float64Array(x.length);
        for(let i = 0; i < x.length; i++){
          const t = i / EF_FS, pos = i - (D0 + d * Math.sin(TAU * fm * t)) * EF_FS;
          const k = Math.floor(pos), f = pos - k;
          y[i] = k >= 0 && k + 1 < x.length ? x[k] * (1 - f) + x[k + 1] * f : 0;
        }
        return y;
      },
      note:"A time-varying delay D(t) = D0 + d sin(2 pi fm t) scales every frequency by 1 - dD/dt. Top plot shows the instantaneous fundamental before and after."},
    comb: {label:"Chorus / flanger (comb filter)", params:[{n:"Delay", min:0.3, max:25, step:0.1, v:1.0, u:" ms"}, {n:"Mix g", min:0, max:1, step:0.05, v:0.9, u:""}],
      apply(x, p){
        const D = p[0] / 1000 * EF_FS, k0 = Math.floor(D), f = D - k0;
        return x.map((v, i) => { const a = i - k0; const dl = a - 1 >= 0 ? x[a] * (1 - f) + x[a - 1] * f : 0; return (v + p[1] * dl) / (1 + p[1]); });
      },
      note:"y[n] = x[n] + g x[n - D]. Notches fall at odd multiples of 1/(2D). Flangers sweep D over about 0.1 to 10 ms; choruses use about 15 to 30 ms."},
    distortion: {label:"Distortion (clipping)", params:[{n:"Drive", min:0, max:30, step:1, v:12, u:" dB"}, {n:"Type", min:0, max:1, step:1, v:0, lab:["hard clip", "soft clip (tanh)"]}],
      apply(x, p){ const g = Math.pow(10, p[0] / 20); return x.map(v => p[1] ? Math.tanh(g * v) : Math.max(-1, Math.min(1, g * v))); },
      note:"A non-linear transfer curve creates new harmonic and intermodulation components that were not in the input; they cannot be filtered out afterwards."},
    highpass: {label:"High-pass filter", params:[{n:"Cutoff", min:20, max:2000, step:10, v:300, u:" Hz"}, {n:"Roll-off", min:0, max:2, step:1, v:1, lab:["6 dB/octave", "12 dB/octave", "24 dB/octave"]}],
      apply(x, p){ return butter(x, "hp", p[0], [1, 2, 4][p[1]], EF_FS); },
      note:"Butterworth response: -3 dB at the cutoff, then falling at the roll-off slope below it. Removes hum and rumble but also the voice fundamental if set too high. The peak can rise although energy is removed, because the filter shifts the phases of the remaining harmonics: always re-check peaks after filtering."},
    lowpass: {label:"Low-pass filter", params:[{n:"Cutoff", min:300, max:7500, step:50, v:3400, u:" Hz"}, {n:"Roll-off", min:0, max:2, step:1, v:2, lab:["6 dB/octave", "12 dB/octave", "24 dB/octave"]}],
      apply(x, p){ return butter(x, "lp", p[0], [1, 2, 4][p[1]], EF_FS); },
      note:"Removes content above the cutoff: fricative and sibilant energy, hiss. A 3400 Hz low-pass plus 300 Hz high-pass gives telephone bandwidth."},
    notch: {label:"Notch filter", params:[{n:"Frequency", min:40, max:1000, step:1, v:50, u:" Hz"}, {n:"Q", min:1, max:40, step:1, v:10, u:""}],
      apply(x, p){ return runBiquad(x, biquad("notch", p[0], p[1], EF_FS)); },
      note:"Removes a narrow band of width about f0/Q. At 50 Hz with Q = 10 the notch is about 5 Hz wide. Mains hum also has harmonics (100, 150 Hz...) that need their own notches."}
  };
  AT.demo("u5-5-effects", {
    init(el){
      const sel = el.querySelector("#u5-5-effects-type");
      sel.addEventListener("change", () => { this.setup(el); this.draw(el); });
      el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el)));
      this.setup(el);
    },
    setup(el){
      const ef = EFFECTS[el.querySelector("#u5-5-effects-type").value];
      for(let j = 0; j < 3; j++){
        const box = el.querySelector("#u5-5-effects-p" + j + "-box"), inp = el.querySelector("#u5-5-effects-p" + j), pr = ef.params[j];
        if(!pr){ box.style.display = "none"; continue; }
        box.style.display = "";
        inp.min = pr.min; inp.max = pr.max; inp.step = pr.step; inp.value = pr.v;
      }
    },
    draw(el){
      const key = el.querySelector("#u5-5-effects-type").value, ef = EFFECTS[key], x = efSignal();
      const p = [];
      for(let j = 0; j < ef.params.length; j++){
        const pr = ef.params[j], v = +el.querySelector("#u5-5-effects-p" + j).value; p.push(v);
        el.querySelector("#u5-5-effects-p" + j + "-n").textContent = pr.n + ": ";
        el.querySelector("#u5-5-effects-p" + j + "-o").textContent = pr.lab ? pr.lab[v] : (v + pr.u);
      }
      let y = ef.apply(x, p);
      const clipCount = y.reduce((c, v) => c + (Math.abs(v) > 1 ? 1 : 0), 0);
      const yExp = y.map(v => Math.max(-1, Math.min(1, v)));
      const cvs = el.querySelectorAll("canvas");
      if(key === "vibrato"){
        const fm = p[0], r = Math.pow(2, p[1] / 1200), d = (r - 1) / (TAU * fm);
        const tx = [], f0in = [], f0out = [];
        const segs = [[0.03, 0.22, 150, 132], [0.27, 0.47, 140, 120]];
        segs.forEach(s => {
          for(let t = s[0]; t <= s[1]; t += 0.002){
            const u = (t - s[0]) / (s[1] - s[0]), f = s[2] + (s[3] - s[2]) * u;
            tx.push(t); f0in.push(f); f0out.push(f * (1 - TAU * fm * d * Math.cos(TAU * fm * t)));
          }
          tx.push(NaN); f0in.push(NaN); f0out.push(NaN);
        });
        const series = [];
        let a = 0;
        for(let i = 0; i <= tx.length; i++){
          if(i === tx.length || isNaN(tx[i])){
            if(i > a){
              series.push({x: tx.slice(a, i), y: f0in.slice(a, i), color:"--plot-axis", width:1.6, dash:[5, 4]});
              series.push({x: tx.slice(a, i), y: f0out.slice(a, i), color:"--accent", width:2});
            }
            a = i + 1;
          }
        }
        plot(cvs[0], {xlim:[0, EF_N / EF_FS], ylim:[100, 175], xlabel:"Time (s)", ylabel:"Fundamental (Hz)", series});
      } else {
        const e0 = envXY(x, EF_FS, 400), e1 = envXY(yExp, EF_FS, 400);
        plot(cvs[0], {xlim:[0, EF_N / EF_FS], ylim:[-1.1, 1.1], xlabel:"Time (s)", ylabel:"Amplitude (FS)",
          series:[{x:e0.x, y:e0.y, color:"--plot-axis", width:1}, {x:e1.x, y:e1.y, color:"--accent", width:1},
            {x:[0, 1], y:[1, 1], color:"--right", width:1, dash:[3, 3]}, {x:[0, 1], y:[-1, -1], color:"--right", width:1, dash:[3, 3]}]});
      }
      const S0 = spectrum(x, EF_N), S1 = spectrum(yExp, EF_N), fx = [], s0 = [], s1 = [];
      for(let k = 3; k < EF_N / 2; k++){ fx.push(k * EF_FS / EF_N); s0.push(S0[k]); s1.push(S1[k]); }
      const series = [{x:fx, y:s0, color:"--plot-axis", width:1}, {x:fx, y:s1, color:"--accent", width:1.2}];
      if(key === "comb"){
        const D = p[0] / 1000, g = p[1], cx = [], cy = [];
        for(let f = 20; f <= 8000; f *= 1.01){ cx.push(f); cy.push(db(Math.hypot(1 + g * Math.cos(TAU * f * D), g * Math.sin(TAU * f * D)) / (1 + g)) - 10); }
        series.push({x:cx, y:cy, color:"--warn", width:1.4, dash:[4, 3]});
      }
      plot(cvs[1], {xlim:[20, 8000], xlog:true, ylim:[-110, 0], xlabel:"Frequency (Hz)", ylabel:"Level (dBFS)",
        xticks:[[50, "50"], [100, "100"], [300, "300"], [1000, "1k"], [3400, "3.4k"], [8000, "8k"]], series});
      el.querySelector("#u5-5-effects-pk0").textContent = db(peakOf(x)).toFixed(1) + " dBFS";
      el.querySelector("#u5-5-effects-pk1").textContent = db(peakOf(y)).toFixed(1) + " dBFS";
      el.querySelector("#u5-5-effects-r0").textContent = db(rmsOf(x)).toFixed(1) + " dBFS";
      el.querySelector("#u5-5-effects-r1").textContent = db(rmsOf(yExp)).toFixed(1) + " dBFS";
      el.querySelector("#u5-5-effects-clip").textContent = clipCount ? clipCount + " samples clip" : "none";
      el.querySelector("#u5-5-effects-note").textContent = ef.note;
      el.querySelector("#u5-5-effects-leg").textContent = key === "vibrato" ? "Output fundamental" : "After (as exported, clipped at full scale)";
    }
  });

  /* ---------------- u5-5-noise ---------------- */
  const NR_FS = 8000, NR_N = 256, NR_HOP = 128, NR_DUR = 2.0, NR_NOISE_END = 0.45;
  let nrData = null;
  function nrPrepare(){
    if(nrData) return nrData;
    const n = Math.round(NR_DUR * NR_FS);
    const s = syllables(NR_FS, n, [
      {t0:0.55, t1:0.85, a:0.6, f0a:160, f0b:140, F:[700, 1150, 2500]},
      {t0:0.92, t1:1.20, a:0.8, f0a:150, f0b:128, F:[320, 2200, 2900]},
      {t0:1.30, t1:1.70, a:0.5, f0a:140, f0b:112, F:[500, 950, 2400]}
    ], 424242);
    scaleTo(s, -18, true);
    const r = rng(77), x = new Float64Array(n);
    let b = 0;
    for(let i = 0; i < n; i++){ const w = gauss(r); b = 0.6 * b + w; x[i] = s[i] + 0.012 * b; }
    const frames = Math.floor((n - NR_N) / NR_HOP) + 1, bins = NR_N / 2 + 1;
    const P = new Float64Array(frames * bins), Ps = new Float64Array(frames * bins);
    const win = new Float64Array(NR_N);
    for(let i = 0; i < NR_N; i++) win[i] = 0.5 - 0.5 * Math.cos(TAU * i / NR_N);
    const re = new Float64Array(NR_N), im = new Float64Array(NR_N);
    for(let f = 0; f < frames; f++){
      for(let src = 0; src < 2; src++){
        const sig = src ? s : x;
        for(let i = 0; i < NR_N; i++){ re[i] = sig[f * NR_HOP + i] * win[i]; im[i] = 0; }
        fft(re, im);
        const dst = src ? Ps : P;
        for(let k = 0; k < bins; k++) dst[f * bins + k] = (re[k] * re[k] + im[k] * im[k]) + 1e-14;
      }
    }
    const nf = Math.floor((NR_NOISE_END * NR_FS - NR_N) / NR_HOP) + 1;
    const prof = new Float64Array(bins);
    for(let f = 0; f < nf; f++) for(let k = 0; k < bins; k++) prof[k] += P[f * bins + k] / nf;
    const speechMask = new Uint8Array(frames);
    for(let f = 0; f < frames; f++){ let e = 0; for(let k = 0; k < bins; k++) e += Ps[f * bins + k]; speechMask[f] = e > 1e-4 ? 1 : 0; }
    nrData = {P, Ps, prof, frames, bins, nf, speechMask};
    return nrData;
  }
  AT.demo("u5-5-noise", {
    init(el){ bindAll(el, this); },
    draw(el){
      const red = +el.querySelector("#u5-5-noise-red").value, sens = +el.querySelector("#u5-5-noise-sens").value, sm = +el.querySelector("#u5-5-noise-sm").value;
      el.querySelector("#u5-5-noise-red-o").textContent = red + " dB";
      el.querySelector("#u5-5-noise-sens-o").textContent = sens.toFixed(1) + " dB";
      el.querySelector("#u5-5-noise-sm-o").textContent = sm + " bands";
      const {P, Ps, prof, frames, bins, nf, speechMask} = nrPrepare();
      const floorG = Math.pow(10, -red / 10), thrMul = Math.pow(10, sens / 10);
      const G = new Float64Array(frames * bins), raw = new Float64Array(bins);
      let isolated = 0, noiseCells = 0;
      for(let f = 0; f < frames; f++){
        for(let k = 0; k < bins; k++) raw[k] = P[f * bins + k] > prof[k] * thrMul ? 1 : floorG;
        for(let k = 0; k < bins; k++){
          let acc = 0, c = 0;
          for(let j = Math.max(0, k - sm); j <= Math.min(bins - 1, k + sm); j++){ acc += Math.log(raw[j]); c++; }
          G[f * bins + k] = Math.exp(acc / c);
          if(f < nf){ noiseCells++; if(G[f * bins + k] > 0.5) isolated++; }
        }
      }
      const zmin = -100, zmax = -20;
      const d0 = new Float64Array(frames * bins), d1 = new Float64Array(frames * bins);
      let nb = 0, na = 0, sb = 0, sa = 0;
      for(let f = 0; f < frames; f++) for(let k = 0; k < bins; k++){
        const idx = f * bins + k, pw = P[idx] / (NR_N * NR_N / 16);
        d0[idx] = 10 * Math.log10(pw); d1[idx] = 10 * Math.log10(pw * G[idx] * G[idx]);
        if(f < nf){ nb += P[idx]; na += P[idx] * G[idx] * G[idx]; }
        else if(speechMask[f]){ sb += Ps[idx]; sa += Ps[idx] * G[idx] * G[idx]; }
      }
      const cv = el.querySelectorAll("canvas");
      const opt = {nx:frames, ny:bins, zmin, zmax, xlim:[0, NR_DUR], ylim:[0, NR_FS / 2], xlabel:"Time (s)", ylabel:"Frequency (Hz)"};
      heat(cv[0], Object.assign({data:d0}, opt));
      heat(cv[1], Object.assign({data:d1}, opt));
      el.querySelector("#u5-5-noise-floor").textContent = sgn(-10 * Math.log10(nb / na)) + " dB";
      el.querySelector("#u5-5-noise-speech").textContent = sgn(10 * Math.log10(sa / sb)) + " dB";
      el.querySelector("#u5-5-noise-mus").textContent = (100 * isolated / noiseCells).toFixed(1) + " %";
    }
  });

  /* ---------------- u5-6-multitrack ---------------- */
  const MT_FS = 8000, MT_DUR = 2.5;
  let mt = null;
  function mtPrepare(){
    if(mt) return mt;
    const n = Math.round(MT_DUR * MT_FS);
    const speech = syllables(MT_FS, n, [
      {t0:0.35, t1:0.70, a:0.7, f0a:150, f0b:130, F:[700, 1200, 2600]},
      {t0:0.80, t1:1.15, a:1.0, f0a:140, f0b:118, F:[330, 2200, 2900]},
      {t0:1.25, t1:1.55, a:0.6, f0a:135, f0b:120, F:[500, 1000, 2400]},
      {t0:1.65, t1:2.05, a:0.8, f0a:132, f0b:105, F:[600, 1700, 2500]}
    ], 1111);
    const babble = new Float64Array(n), r = rng(31337);
    for(let talker = 0; talker < 6; talker++){
      const list = [];
      let t = -0.2 * r();
      while(t < MT_DUR){
        const L = 0.18 + 0.25 * r(), f0 = talker % 2 ? 200 + 40 * r() : 105 + 30 * r();
        list.push({t0:Math.max(0, t), t1:Math.min(MT_DUR, t + L), a:0.5 + 0.5 * r(), f0a:f0, f0b:f0 * (0.85 + 0.1 * r()), F:[300 + 500 * r(), 900 + 1400 * r(), 2300 + 600 * r()]});
        t += L + 0.03 + 0.12 * r();
      }
      const y = syllables(MT_FS, n, list.filter(s => s.t1 - s.t0 > 0.08), 500 + talker);
      for(let i = 0; i < n; i++) babble[i] += y[i];
    }
    const tone = new Float64Array(n);
    for(let i = 0; i < n; i++) tone[i] = Math.sin(TAU * 1000 * i / MT_FS);
    const ramp = Math.round(0.01 * MT_FS);
    for(let i = 0; i < ramp; i++){ const g = 0.5 - 0.5 * Math.cos(Math.PI * i / ramp); tone[i] *= g; tone[n - 1 - i] *= g; }
    scaleTo(speech, -26, true); scaleTo(babble, -26, true); scaleTo(tone, -26, true);
    mt = {n, tr:[speech, babble, tone], rms:[rmsOf(speech), rmsOf(babble), rmsOf(tone)]};
    return mt;
  }
  const MT_NAMES = ["speech", "babble", "tone"];
  AT.demo("u5-6-multitrack", {
    init(el){ bindAll(el, this); },
    draw(el){
      const d = mtPrepare(), n = d.n;
      const g = [], pan = [], mute = [], solo = [];
      MT_NAMES.forEach((nm, j) => {
        g.push(+el.querySelector("#u5-6-multitrack-g" + j).value);
        pan.push(+el.querySelector("#u5-6-multitrack-p" + j).value);
        mute.push(el.querySelector("#u5-6-multitrack-m" + j).checked);
        solo.push(el.querySelector("#u5-6-multitrack-s" + j).checked);
        el.querySelector("#u5-6-multitrack-g" + j + "-o").textContent = sgn(g[j]) + " dB";
        const pv = pan[j];
        el.querySelector("#u5-6-multitrack-p" + j + "-o").textContent = pv === 0 ? "C" : (pv < 0 ? "L" + (-pv) : "R" + pv);
      });
      const anySolo = solo.some(v => v);
      const audible = MT_NAMES.map((_, j) => anySolo ? solo[j] : !mute[j]);
      const L = new Float64Array(n), R = new Float64Array(n);
      const trackSeries = [];
      MT_NAMES.forEach((_, j) => {
        const a = Math.pow(10, g[j] / 20), th = (pan[j] / 100 + 1) * Math.PI / 4;
        const gl = a * Math.cos(th), gr = a * Math.sin(th), x = d.tr[j];
        if(audible[j]) for(let i = 0; i < n; i++){ L[i] += gl * x[i]; R[i] += gr * x[i]; }
        const e = envXY(x.map(v => v * a * 4), MT_FS, 300, 2 * (2 - j));
        trackSeries.push({x:e.x, y:e.y, color: audible[j] ? ["--accent", "--warn", "--left"][j] : "--plot-axis", width:1});
      });
      const cv = el.querySelectorAll("canvas");
      plot(cv[0], {xlim:[0, MT_DUR], ylim:[-1.2, 5.2], xlabel:"Time (s)", ylabel:"Tracks",
        yticks:[[4, ""], [2, ""], [0, ""]], series:trackSeries,
        labels:[{text:"speech", x:0.01, y:4.75, color:"--muted"}, {text:"babble", x:0.01, y:2.75, color:"--muted"}, {text:"tone", x:0.01, y:0.75, color:"--muted"}]});
      const eL = envXY(L, MT_FS, 400, 1.2), eR = envXY(R, MT_FS, 400, -1.2);
      plot(cv[1], {xlim:[0, MT_DUR], ylim:[-2.6, 2.6], xlabel:"Time (s)", ylabel:"Mix L / R",
        yticks:[[2.2, "+1"], [1.2, "L"], [0.2, "-1"], [-0.2, "+1"], [-1.2, "R"], [-2.2, "-1"]],
        series:[{x:eL.x, y:eL.y, color:"--left", width:1}, {x:eR.x, y:eR.y, color:"--right", width:1},
          {x:[0, MT_DUR], y:[2.2, 2.2], color:"--warn", width:1, dash:[3, 3]}, {x:[0, MT_DUR], y:[0.2, 0.2], color:"--warn", width:1, dash:[3, 3]},
          {x:[0, MT_DUR], y:[-0.2, -0.2], color:"--warn", width:1, dash:[3, 3]}, {x:[0, MT_DUR], y:[-2.2, -2.2], color:"--warn", width:1, dash:[3, 3]}]});
      const pL = peakOf(L), pR = peakOf(R), rL = rmsOf(L), rR = rmsOf(R);
      const f = v => v < 1e-9 ? "silent" : db(v).toFixed(1) + " dBFS";
      el.querySelector("#u5-6-multitrack-pk").textContent = f(pL) + " / " + f(pR);
      el.querySelector("#u5-6-multitrack-rms").textContent = f(rL) + " / " + f(rR);
      let clips = 0; for(let i = 0; i < n; i++){ if(Math.abs(L[i]) > 1) clips++; if(Math.abs(R[i]) > 1) clips++; }
      const cw = el.querySelector("#u5-6-multitrack-clip");
      cw.textContent = clips ? "CLIPPING: " + clips + " samples over 0 dBFS" : "no clipping";
      cw.style.color = clips ? "var(--right)" : "";
      const snrEl = el.querySelector("#u5-6-multitrack-snr");
      if(audible[0] && audible[1]) snrEl.textContent = sgn(db(d.rms[0] * Math.pow(10, g[0] / 20)) - db(d.rms[1] * Math.pow(10, g[1] / 20))) + " dB";
      else snrEl.textContent = "n/a (speech or babble not audible)";
    }
  });
})();

(function(){
  const {plot, heat, TAU, rng, gauss, fft} = window.AT;
  const num = (v, d) => Number(v).toFixed(d);
  const grp = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  /* vocal-tract all-pole magnitude response at frequency f (Hz) */
  function tract(f, F, B){
    let h = 1;
    for(let k = 0; k < F.length; k++){
      const a = Math.PI * B[k], w = TAU * F[k];
      const num2 = a * a + w * w;
      const d1 = Math.sqrt(a * a + Math.pow(TAU * (f - F[k]), 2));
      const d2 = Math.sqrt(a * a + Math.pow(TAU * (f + F[k]), 2));
      h *= num2 / (d1 * d2);
    }
    return h;
  }

  /* ---------- u5-7-spectro: wideband vs narrowband spectrogram ---------- */
  const SP = {fs: 11025, dur: 1.2, x: null};
  const VOW = [
    {F: [300, 2300, 3000, 3400, 4000]},
    {F: [700, 1220, 2600, 3400, 4000]},
    {F: [320, 870, 2250, 3400, 4000]}
  ];
  const BW = [80, 90, 120, 150, 200];
  function spF0(t){ return t < 0.6 ? 100 + 80 * t / 0.6 : 180 - 60 * (t - 0.6) / 0.6; }
  function spFormants(t){
    const edges = [0.4, 0.8], tr = 0.03;
    let seg = t < 0.4 ? 0 : t < 0.8 ? 1 : 2;
    let F = VOW[seg].F.slice();
    for(let e = 0; e < 2; e++){
      const c = edges[e];
      if(Math.abs(t - c) < tr){
        const w = (t - (c - tr)) / (2 * tr);
        F = VOW[e].F.map((v, i) => v + (VOW[e + 1].F[i] - v) * w);
      }
    }
    return F;
  }
  function spSynth(){
    if(SP.x) return SP.x;
    const fs = SP.fs, n = Math.round(fs * SP.dur), x = new Float64Array(n);
    const K = 60, ph = new Float64Array(K + 1), blk = 32, nb = Math.ceil(n / blk) + 1;
    const AMP = [];
    for(let b = 0; b < nb; b++){
      const tc = Math.min(SP.dur, b * blk / fs), f0c = spF0(tc), F = spFormants(tc), a = new Float64Array(K + 1);
      for(let k = 1; k <= K; k++){ const f = k * f0c; a[k] = f < 5300 ? tract(f, F, BW) * (f0c / f) : 0; }
      AMP.push(a);
    }
    for(let i = 0; i < n; i++){
      const f0 = spF0(i / fs), b = Math.floor(i / blk), w = (i - b * blk) / blk, a0 = AMP[b], a1 = AMP[b + 1];
      let s = 0;
      for(let k = 1; k <= K; k++){ ph[k] += TAU * k * f0 / fs; const a = a0[k] + (a1[k] - a0[k]) * w; if(a) s += a * Math.cos(ph[k]); }
      x[i] = s;
    }
    const r = rng(11);
    let mx = 0; for(let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(x[i]));
    for(let i = 0; i < n; i++) x[i] = x[i] / mx + 0.0005 * gauss(r);
    SP.x = x; return x;
  }
  AT.demo("u5-7-spectro", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const L = +el.querySelector("#u5-7-spectro-win").value / 1000;
      const DR = +el.querySelector("#u5-7-spectro-dr").value;
      const pre = +el.querySelector("#u5-7-spectro-pre").value === 1;
      el.querySelector("#u5-7-spectro-win-o").textContent = Math.round(L * 1000) + " ms";
      el.querySelector("#u5-7-spectro-dr-o").textContent = DR + " dB";
      el.querySelector("#u5-7-spectro-pre-o").textContent = pre ? "on (+6 dB/oct)" : "off";
      const fs = SP.fs, x0 = spSynth(), n = x0.length;
      let x = x0;
      if(pre){ const a = Math.exp(-TAU * 50 / fs); x = new Float64Array(n); x[0] = x0[0]; for(let i = 1; i < n; i++) x[i] = x0[i] - a * x0[i - 1]; }
      const Nw = Math.max(16, Math.round(L * fs));
      let nfft = 512; while(nfft < Nw) nfft *= 2;
      const nx = 480, hop = (n - Nw) / (nx - 1), kmax = Math.floor(5000 / fs * nfft), ny = kmax;
      const win = new Float64Array(Nw); for(let i = 0; i < Nw; i++) win[i] = 0.5 - 0.5 * Math.cos(TAU * (i + 0.5) / Nw);
      const data = new Float64Array(nx * ny), re = new Float64Array(nfft), im = new Float64Array(nfft);
      let zmax = -1e9;
      for(let c = 0; c < nx; c++){
        const st = Math.round(c * hop);
        re.fill(0); im.fill(0);
        for(let i = 0; i < Nw; i++) re[i] = x[st + i] * win[i];
        fft(re, im);
        for(let j = 0; j < ny; j++){ const p = re[j] * re[j] + im[j] * im[j]; const d = 10 * Math.log10(p + 1e-20); data[c * ny + j] = d; if(d > zmax) zmax = d; }
      }
      heat(el.querySelector("canvas"), {data, nx, ny, zmin: zmax - DR, zmax, xlim: [0, SP.dur], ylim: [0, kmax * fs / nfft], xlabel: "Time (s)   /i/  then  /a/  then  /u/", ylabel: "Frequency (Hz)"});
      const fr = 1.44 / L;
      el.querySelector("#u5-7-spectro-tr").textContent = num(L * 1000, 0) + " ms";
      el.querySelector("#u5-7-spectro-fr").textContent = "about " + num(fr, 0) + " Hz";
      el.querySelector("#u5-7-spectro-kind").textContent = fr >= 180 ? "Wideband: formant bands, vertical pulse striations"
        : fr <= 60 ? "Narrowband: separate harmonic lines spaced at F0"
        : "Intermediate: harmonics partly resolved (clearest where F0 is highest)";
    }
  });

  /* ---------- u5-7-pitch: autocorrelation pitch detector ---------- */
  const PFS = 16000;
  AT.demo("u5-7-pitch", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const g = id => +el.querySelector("#u5-7-pitch-" + id).value;
      const f0 = g("f0"), noise = g("noise") / 100, floor = g("floor");
      let ceil = g("ceil"); if(ceil < floor + 10) ceil = floor + 10;
      el.querySelector("#u5-7-pitch-f0-o").textContent = f0 + " Hz";
      el.querySelector("#u5-7-pitch-noise-o").textContent = Math.round(noise * 100) + " % of signal RMS";
      el.querySelector("#u5-7-pitch-floor-o").textContent = floor + " Hz";
      el.querySelector("#u5-7-pitch-ceil-o").textContent = ceil + " Hz" + (ceil !== g("ceil") ? " (raised above floor)" : "");
      const Nf = Math.round(3 / floor * PFS);
      const F = [600, 1400, 2500], B = [100, 120, 160];
      const K = Math.floor(3800 / f0), amps = [];
      for(let k = 1; k <= K; k++) amps.push(tract(k * f0, F, B) / k);
      const s = new Float64Array(Nf);
      for(let i = 0; i < Nf; i++){ const t = i / PFS; let v = 0; for(let k = 1; k <= K; k++) v += amps[k - 1] * Math.cos(TAU * k * f0 * t + 0.3 * k); s[i] = v; }
      let rms = 0; for(let i = 0; i < Nf; i++) rms += s[i] * s[i]; rms = Math.sqrt(rms / Nf);
      const r0 = rng(5); for(let i = 0; i < Nf; i++) s[i] = s[i] / rms + noise * gauss(r0);
      let mean = 0; for(let i = 0; i < Nf; i++) mean += s[i]; mean /= Nf;
      const w = new Float64Array(Nf), xw = new Float64Array(Nf);
      for(let i = 0; i < Nf; i++){ w[i] = 0.5 - 0.5 * Math.cos(TAU * (i + 0.5) / Nf); xw[i] = (s[i] - mean) * w[i]; }
      const maxLag = Math.min(Math.floor(Nf / 2), Math.ceil(1.4 / floor * PFS));
      const ac = (v, lag) => { let a = 0; for(let i = 0; i + lag < Nf; i++) a += v[i] * v[i + lag]; return a; };
      const ra0 = ac(xw, 0), rw0 = ac(w, 0), r = new Float64Array(maxLag + 1);
      for(let L = 0; L <= maxLag; L++) r[L] = (ac(xw, L) / ra0) / (ac(w, L) / rw0);
      const lo = Math.max(2, Math.floor(PFS / ceil)), hi = Math.min(maxLag - 1, Math.ceil(PFS / floor));
      let best = null;
      for(let L = lo; L <= hi; L++){
        if(r[L] > r[L - 1] && r[L] >= r[L + 1]){
          const a = r[L - 1], b = r[L], c = r[L + 1], den = a - 2 * b + c;
          const d = den !== 0 ? 0.5 * (a - c) / den : 0, tau = (L + d) / PFS, rp = b - 0.25 * (a - c) * d;
          const R = rp - 0.01 * Math.log2(floor * tau);
          if(!best || R > best.R) best = {tau, r: rp, R};
        }
      }
      const voiced = best && best.r >= 0.45;
      const tx = [], ty = [], ex = [], ey = [];
      for(let i = 0; i < Nf; i++){ tx.push(i / PFS * 1000); ty.push(s[i]); }
      const amax = Math.max(...ty.map(Math.abs)) * 1.05;
      for(let i = 0; i < Nf; i += 4){ ex.push(i / PFS * 1000); ey.push(w[i] * amax); }
      const cv = el.querySelectorAll("canvas");
      plot(cv[0], {xlim: [0, Nf / PFS * 1000], ylim: [-amax, amax], xlabel: "Time within frame (ms)", ylabel: "Amplitude",
        series: [{x: tx, y: ty, color: "--accent", width: 1.2}, {x: ex, y: ey, color: "--muted", width: 1, dash: [4, 4]}],
        labels: [{text: "Hann window", x: Nf / PFS * 500, y: amax * 0.9, color: "--muted", align: "center"}]});
      const lx = [], ly = [];
      for(let L = 0; L <= maxLag; L++){ lx.push(L / PFS * 1000); ly.push(r[L]); }
      const xmax = maxLag / PFS * 1000, tl = 1000 / ceil, th = 1000 / floor, tp = 1000 / f0;
      const ser = [
        {x: [tl, tl], y: [-1.1, 1.1], color: "--left", width: 1.5, dash: [5, 4]},
        {x: [th, th], y: [-1.1, 1.1], color: "--left", width: 1.5, dash: [5, 4]},
        {x: [tl, Math.min(th, xmax)], y: [-0.95, -0.95], color: "--left", width: 6},
        {x: [tp, tp], y: [-1.1, 1.1], color: "--plot-axis", width: 1, dash: [2, 3]},
        {x: lx, y: ly, color: "--accent", width: 1.8}
      ];
      if(best) ser.push({x: [best.tau * 1000], y: [best.r], color: "--right", marker: "o", msize: 6, line: false});
      const labs = [{text: "true period", x: tp, y: 1.0, dx: 4, color: "--muted"},
                    {text: "search range", x: tl, y: -0.8, dx: 4, color: "--left"}];
      plot(cv[1], {xlim: [0, xmax], ylim: [-1.1, 1.1], xlabel: "Lag (ms)", ylabel: "Normalised r", series: ser, labels: labs});
      el.querySelector("#u5-7-pitch-len").textContent = num(3000 / floor, 1) + " ms";
      el.querySelector("#u5-7-pitch-range").textContent = num(tl, 2) + " to " + num(th, 2) + " ms";
      el.querySelector("#u5-7-pitch-lag").textContent = best ? num(best.tau * 1000, 2) + " ms, r = " + num(best.r, 2) : "no peak in range";
      el.querySelector("#u5-7-pitch-est").textContent = voiced ? num(1 / best.tau, 1) + " Hz" : "unvoiced";
      let v;
      if(!voiced){
        v = (tp > th + 0.01) ? "Unvoiced: true period is longer than 1 / floor (floor too high)"
          : best ? "Unvoiced: best peak below the voicing threshold 0.45 (too noisy)" : "Unvoiced: no peak in range";
      } else {
        const ratio = (1 / best.tau) / f0;
        v = Math.abs(ratio - 1) < 0.03 ? "Correct"
          : Math.abs(ratio - 0.5) < 0.03 ? "Octave error: halved (true period shorter than 1 / ceiling?)"
          : Math.abs(ratio - 2) < 0.06 ? "Octave error: doubled"
          : Math.abs(ratio - 1 / 3) < 0.03 ? "Error: one third of F0 (period tripled)"
          : "Wrong peak (" + num(ratio, 2) + " x true F0)";
      }
      el.querySelector("#u5-7-pitch-verdict").textContent = v;
    }
  });

  /* ---------- u5-7-vowels: F1-F2 chart and vowel space area ---------- */
  const PB = {
    m: [["i", 270, 2290], ["ɪ", 390, 1990], ["ɛ", 530, 1840], ["æ", 660, 1720], ["ɑ", 730, 1090], ["ɔ", 570, 840], ["ʊ", 440, 1020], ["u", 300, 870], ["ʌ", 640, 1190], ["ɝ", 490, 1350]],
    f: [["i", 310, 2790], ["ɪ", 430, 2480], ["ɛ", 610, 2330], ["æ", 860, 2050], ["ɑ", 850, 1220], ["ɔ", 590, 920], ["ʊ", 470, 1160], ["u", 370, 950], ["ʌ", 760, 1400], ["ɝ", 500, 1640]]
  };
  const tri = (p, q, r) => Math.abs(p[1] * (q[0] - r[0]) + q[1] * (r[0] - p[0]) + r[1] * (p[0] - q[0])) / 2;
  function polyArea(P){ let a = 0; for(let i = 0; i < P.length; i++){ const p = P[i], q = P[(i + 1) % P.length]; a += p[1] * q[0] - q[1] * p[0]; } return Math.abs(a) / 2; }
  AT.demo("u5-7-vowels", {
    init(el){ el.querySelectorAll("input,select").forEach(i => { i.addEventListener("input", () => this.draw(el)); i.addEventListener("change", () => this.draw(el)); }); },
    draw(el){
      const V = {};
      ["i", "e", "a", "o", "u"].forEach(k => {
        const a = parseFloat(el.querySelector("#u5-7-vowels-" + k + "1").value), b = parseFloat(el.querySelector("#u5-7-vowels-" + k + "2").value);
        if(isFinite(a) && isFinite(b) && a > 100 && b > 300) V[k] = [a, b];
      });
      const ref = el.querySelector("#u5-7-vowels-ref").value, series = [], labels = [];
      let refArea = null;
      if(ref !== "n"){
        const R = PB[ref];
        series.push({x: R.map(v => v[2]), y: R.map(v => v[1]), color: "--plot-axis", marker: "dot", msize: 3.5, line: false});
        R.forEach(v => labels.push({text: v[0], x: v[2], y: v[1], dx: 6, dy: -4, color: "--muted"}));
        const g = s => R.find(v => v[0] === s);
        const ti = g("i"), ta = g("ɑ"), tu = g("u");
        series.push({x: [ti[2], ta[2], tu[2], ti[2]], y: [ti[1], ta[1], tu[1], ti[1]], color: "--plot-axis", width: 1, dash: [4, 4]});
        refArea = tri([ti[1], ti[2]], [ta[1], ta[2]], [tu[1], tu[2]]);
      }
      const order = ["i", "e", "a", "o", "u"].filter(k => V[k]);
      if(order.length >= 3){
        const P = order.map(k => V[k]);
        series.push({x: P.map(p => p[1]).concat([P[0][1]]), y: P.map(p => p[0]).concat([P[0][0]]), color: "--accent", width: 1.2, dash: [2, 3]});
      }
      if(V.i && V.a && V.u){
        series.push({x: [V.i[1], V.a[1], V.u[1], V.i[1]], y: [V.i[0], V.a[0], V.u[0], V.i[0]], color: "--accent", width: 2});
      }
      order.forEach(k => { series.push({x: [V[k][1]], y: [V[k][0]], color: "--accent", marker: "o", msize: 6, line: false}); labels.push({text: "/" + k + "/", x: V[k][1], y: V[k][0], dx: 9, dy: 14, color: "--accent"}); });
      const xt = [3000, 2500, 2000, 1500, 1000, 500].map(v => [v, String(v)]);
      plot(el.querySelector("canvas"), {xlim: [3200, 500], ylim: [1100, 150], xticks: xt, xlabel: "F2 (Hz), decreasing to the right", ylabel: "F1 (Hz), increasing downwards", series, labels});
      const A = (V.i && V.a && V.u) ? tri(V.i, V.a, V.u) : null;
      el.querySelector("#u5-7-vowels-area").textContent = A !== null ? grp(A) + " Hz²" : "enter /i/, /a/ and /u/";
      el.querySelector("#u5-7-vowels-khz").textContent = A !== null ? num(A / 1e6, 3) + " kHz²" : "";
      el.querySelector("#u5-7-vowels-poly").textContent = order.length > 3 ? grp(polyArea(order.map(k => V[k]))) + " Hz² (" + order.length + " vowels, order i e a o u)" : "enter /e/ and /o/ as well";
      el.querySelector("#u5-7-vowels-refarea").textContent = refArea !== null ? grp(refArea) + " Hz² (typical, " + (ref === "m" ? "male" : "female") + ")" : "none shown";
    }
  });

  /* ---------- u5-7-jitter: jitter and shimmer calculator ---------- */
  const NC = 60;
  const JR = (() => { const r = rng(21), a = [], b = []; for(let i = 0; i < NC; i++){ a.push(gauss(r)); b.push(gauss(r)); } return {a, b}; })();
  AT.demo("u5-7-jitter", {
    init(el){ el.querySelectorAll("input,select").forEach(i => { i.addEventListener("input", () => this.draw(el)); i.addEventListener("change", () => this.draw(el)); }); },
    draw(el){
      const f0 = +el.querySelector("#u5-7-jitter-f0").value, j = +el.querySelector("#u5-7-jitter-jit").value / 100;
      const sh = +el.querySelector("#u5-7-jitter-shim").value / 100, alt = el.querySelector("#u5-7-jitter-mode").value === "a";
      el.querySelector("#u5-7-jitter-f0-o").textContent = f0 + " Hz";
      el.querySelector("#u5-7-jitter-jit-o").textContent = num(j * 100, 1) + " %";
      el.querySelector("#u5-7-jitter-shim-o").textContent = num(sh * 100, 1) + " %";
      const T0 = 1 / f0, T = [], A = [];
      for(let i = 0; i < NC; i++){
        const gp = alt ? (i % 2 ? -1 : 1) : JR.a[i], ga = alt ? (i % 2 ? -1 : 1) : JR.b[i];
        T.push(T0 * Math.max(0.2, 1 + j * gp)); A.push(Math.max(0.05, 1 + sh * ga));
      }
      const mean = v => v.reduce((s, x) => s + x, 0) / v.length;
      const mT = mean(T), mA = mean(A);
      let dT = 0, dA = 0, dB = 0; for(let i = 1; i < NC; i++){ dT += Math.abs(T[i] - T[i - 1]); dA += Math.abs(A[i] - A[i - 1]); dB += Math.abs(20 * Math.log10(A[i] / A[i - 1])); }
      dT /= NC - 1; dA /= NC - 1; dB /= NC - 1;
      let rap = 0, apq = 0; for(let i = 1; i < NC - 1; i++){ rap += Math.abs(T[i] - (T[i - 1] + T[i] + T[i + 1]) / 3); apq += Math.abs(A[i] - (A[i - 1] + A[i] + A[i + 1]) / 3); }
      rap /= NC - 2; apq /= NC - 2;
      el.querySelector("#u5-7-jitter-jl").textContent = num(100 * dT / mT, 2) + " %";
      el.querySelector("#u5-7-jitter-ja").textContent = num(dT * 1e6, 1) + " µs";
      el.querySelector("#u5-7-jitter-rap").textContent = num(100 * rap / mT, 2) + " %";
      el.querySelector("#u5-7-jitter-sl").textContent = num(100 * dA / mA, 2) + " %";
      el.querySelector("#u5-7-jitter-sdb").textContent = num(dB, 3) + " dB";
      el.querySelector("#u5-7-jitter-apq3").textContent = num(100 * apq / mA, 2) + " %";
      const cv = el.querySelectorAll("canvas"), fsd = 20000, wx = [], wy = [];
      let t0 = 0; const ncy = 12;
      for(let c = 0; c < ncy; c++){
        const n = Math.round(T[c] * fsd);
        for(let i = 0; i < n; i += 1){ const t = i / fsd; wx.push((t0 + t) * 1000); wy.push(A[c] * Math.exp(-t / (0.25 * T0)) * Math.sin(TAU * 700 * t)); }
        t0 += T[c];
      }
      const am = Math.max(1.2, Math.max(...A.slice(0, ncy)) * 1.1);
      plot(cv[0], {xlim: [0, t0 * 1000], ylim: [-am, am], xlabel: "Time (ms), first 12 cycles", ylabel: "Amplitude", series: [{x: wx, y: wy, color: "--accent", width: 1.2}]});
      const idx = T.map((_, i) => i + 1), Tms = T.map(v => v * 1000), sp = Math.max(4 * j, 0.02) * T0 * 1000;
      plot(cv[1], {xlim: [1, NC], ylim: [T0 * 1000 - sp, T0 * 1000 + sp], xlabel: "Cycle number", ylabel: "Period (ms)",
        series: [{x: [1, NC], y: [mT * 1000, mT * 1000], color: "--plot-axis", width: 1, dash: [4, 4]}, {x: idx, y: Tms, color: "--accent", width: 1.2, marker: "dot", msize: 2.5}]});
      const as = Math.max(4 * sh, 0.1);
      plot(cv[2], {xlim: [1, NC], ylim: [Math.max(0, 1 - as), 1 + as], xlabel: "Cycle number", ylabel: "Peak amplitude",
        series: [{x: [1, NC], y: [mA, mA], color: "--plot-axis", width: 1, dash: [4, 4]}, {x: idx, y: A, color: "--left", width: 1.2, marker: "dot", msize: 2.5}]});
    }
  });
})();

/* Topic 5.8 demos: u5-8-staircase, u5-8-psychometric, u5-8-din, u5-8-calib */
(function(){
  const {plot, rng, $} = window.AT;
  const bind = (el, self) => el.querySelectorAll("input,select").forEach(i => {
    i.addEventListener("input", () => self.draw(el));
    i.addEventListener("change", () => self.draw(el));
  });
  const q = (el, id) => el.querySelector("#" + id);
  const set = (el, id, txt) => { const o = q(el, id); if(o) o.textContent = txt; };
  const sgn = (v, d) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
  const fmt = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d);

  // Logistic psychometric function with guess rate g and lapse rate l
  const pf = (L, T, b, g, l) => g + (1 - g - l) / (1 + Math.exp(-b * (L - T)));
  // Level at which pf reaches probability p (null if unreachable)
  function inv(p, T, b, g, l){
    const u = (p - g) / (1 - g - l);
    if(!(u > 0 && u < 1)) return null;
    return T + Math.log(u / (1 - u)) / b;
  }

  /* ---------------- u5-8-psychometric ---------------- */
  AT.demo("u5-8-psychometric", {
    init(el){ bind(el, this); },
    draw(el){
      const g = +q(el, "u5-8-psychometric-task").value;
      const T = +q(el, "u5-8-psychometric-t").value;
      const b = +q(el, "u5-8-psychometric-b").value;
      const l = +q(el, "u5-8-psychometric-l").value;
      set(el, "u5-8-psychometric-t-o", T + " dB");
      set(el, "u5-8-psychometric-b-o", b.toFixed(2) + " /dB");
      set(el, "u5-8-psychometric-l-o", Math.round(l * 100) + "%");
      const x = [], y = [];
      for(let L = 0; L <= 70; L += 0.25){ x.push(L); y.push(100 * pf(L, T, b, g, l)); }
      const series = [
        {x:[0, 70], y:[100 * g, 100 * g], color:"--plot-axis", width:1, dash:[4, 4]},
        {x:[0, 70], y:[100 * (1 - l), 100 * (1 - l)], color:"--plot-axis", width:1, dash:[4, 4]},
        {x, y, color:"--accent", width:2.5}
      ];
      const labels = [];
      const targets = [[0.5, "50%", "u5-8-psychometric-p50"], [0.7071, "70.7%", "u5-8-psychometric-p71"], [0.7937, "79.4%", "u5-8-psychometric-p79"]];
      targets.forEach(([p, name, id]) => {
        const Lp = inv(p, T, b, g, l);
        if(Lp === null || Lp < 0 || Lp > 70){
          set(el, id, Lp === null ? "not reached" : "outside range");
          return;
        }
        set(el, id, Lp.toFixed(1) + " dB");
        series.push({x:[Lp, Lp], y:[0, 100 * p], color:"--warn", width:1, dash:[3, 3]});
        series.push({x:[Lp], y:[100 * p], color:"--warn", marker:"o", msize:5, line:false});
        labels.push({text:name, x:Lp, y:100 * p, dx:6, dy:-6, color:"--warn"});
      });
      const slope = 100 * (1 - g - l) * b / 4;
      set(el, "u5-8-psychometric-sl", slope.toFixed(1) + "% per dB");
      plot(el.querySelector("canvas"), {
        xlim:[0, 70], ylim:[0, 100], xlabel:"Level (dB)", ylabel:"Percent correct",
        yticks:[[0, "0"], [25, "25"], [50, "50"], [75, "75"], [100, "100"]],
        series, labels
      });
    }
  });

  /* ---------------- u5-8-staircase ---------------- */
  function runStair(n, g, step, nrev, T, b, seed){
    const r = rng(seed);
    let level = T + 15, run = 0, dir = 0;
    const trials = [], revs = [];
    let guard = 0;
    while(revs.length < nrev && guard < 400){
      guard++;
      const ok = r() < pf(level, T, b, g, 0);
      const tr = {level, ok, rev:false};
      trials.push(tr);
      let nd = 0;
      if(ok){
        run++;
        if(run >= n){ run = 0; nd = -1; }
      } else { run = 0; nd = 1; }
      if(nd !== 0){
        if(dir !== 0 && nd !== dir){ revs.push(level); tr.rev = true; }
        dir = nd;
        level += nd * step;
        level = Math.max(-30, Math.min(90, level));
      }
    }
    return {trials, revs};
  }
  AT.demo("u5-8-staircase", {
    init(el){ bind(el, this); },
    draw(el){
      const n = +q(el, "u5-8-staircase-rule").value;
      const g = +q(el, "u5-8-staircase-task").value;
      const step = +q(el, "u5-8-staircase-step").value;
      const nrev = +q(el, "u5-8-staircase-rev").value;
      let last = +q(el, "u5-8-staircase-last").value;
      const T = +q(el, "u5-8-staircase-thr").value;
      const b = +q(el, "u5-8-staircase-beta").value;
      const seed = +q(el, "u5-8-staircase-seed").value;
      if(last > nrev) last = nrev;
      set(el, "u5-8-staircase-step-o", step + " dB");
      set(el, "u5-8-staircase-rev-o", String(nrev));
      set(el, "u5-8-staircase-last-o", String(last) + (last < +q(el, "u5-8-staircase-last").value ? " (limited)" : ""));
      set(el, "u5-8-staircase-thr-o", T + " dB");
      set(el, "u5-8-staircase-beta-o", b.toFixed(2) + " /dB");
      set(el, "u5-8-staircase-seed-o", String(seed));

      const target = Math.pow(0.5, 1 / n);
      const tl = inv(target, T, b, g, 0);
      const res = runStair(n, g, step, nrev, T, b, seed * 7919 + 13);
      const tr = res.trials, N = tr.length;
      const used = res.revs.slice(-last);
      const est = used.length ? used.reduce((a, c) => a + c, 0) / used.length : NaN;

      set(el, "u5-8-staircase-tp", (100 * target).toFixed(1) + "%");
      set(el, "u5-8-staircase-tl", tl === null ? "below chance: none" : tl.toFixed(1) + " dB");
      set(el, "u5-8-staircase-est", isNaN(est) ? "no reversals" : est.toFixed(1) + " dB");
      set(el, "u5-8-staircase-err", (tl === null || isNaN(est)) ? "not defined" : sgn(est - tl, 1) + " dB");
      set(el, "u5-8-staircase-n", String(N) + (res.revs.length < nrev ? " (stopped at limit)" : ""));

      const lv = tr.map(d => d.level);
      let y0 = Math.min.apply(null, lv.concat([T - 10])), y1 = Math.max.apply(null, lv.concat([T + 20]));
      y0 = Math.floor((y0 - 5) / 5) * 5; y1 = Math.ceil((y1 + 5) / 5) * 5;
      const xs = tr.map((d, i) => i + 1);
      const cx = [], cy = [], ex = [], ey = [], rx = [], ry = [];
      tr.forEach((d, i) => {
        if(d.ok){ cx.push(i + 1); cy.push(d.level); } else { ex.push(i + 1); ey.push(d.level); }
        if(d.rev){ rx.push(i + 1); ry.push(d.level); }
      });
      const series = [{x:xs, y:lv, color:"--plot-axis", width:1, step:true}];
      if(tl !== null) series.push({x:[1, Math.max(N, 2)], y:[tl, tl], color:"--left", width:1.5, dash:[5, 4]});
      if(!isNaN(est)) series.push({x:[1, Math.max(N, 2)], y:[est, est], color:"--warn", width:1.5});
      series.push({x:cx, y:cy, color:"--accent", marker:"o", msize:4, line:false});
      series.push({x:ex, y:ey, color:"--right", marker:"x", msize:5, line:false});
      series.push({x:rx, y:ry, color:"--warn", marker:"o", msize:8, line:false});
      const cvs = el.querySelectorAll("canvas");
      plot(cvs[0], {
        xlim:[0, Math.max(N, 2) + 1], ylim:[y0, y1], xlabel:"Trial", ylabel:"Level (dB)",
        series,
        labels: tl === null ? [{text:"target below chance", x:1, y:y1 - 3, dx:4, color:"--muted"}] : []
      });

      const px = [], py = [];
      for(let L = y0; L <= y1; L += 0.25){ px.push(100 * pf(L, T, b, g, 0)); py.push(L); }
      const s2 = [
        {x:px, y:py, color:"--accent", width:2.5},
        {x:[100 * target, 100 * target], y:[y0, y1], color:"--warn", width:1, dash:[4, 4]}
      ];
      const lab2 = [{text:(100 * target).toFixed(1) + "% target", x:100 * target, y:y0 + 2, dx:-4, align:"right", color:"--warn"}];
      if(tl !== null){
        s2.push({x:[0, 100], y:[tl, tl], color:"--left", width:1.5, dash:[5, 4]});
        s2.push({x:[100 * target], y:[tl], color:"--left", marker:"o", msize:5, line:false});
      }
      plot(cvs[1], {
        xlim:[0, 100], ylim:[y0, y1], xlabel:"P(correct) %", ylabel:"Level (dB)",
        xticks:[[0, "0"], [50, "50"], [100, "100"]],
        series:s2, labels:lab2
      });
    }
  });

  /* ---------------- u5-8-din ---------------- */
  AT.demo("u5-8-din", {
    init(el){ bind(el, this); },
    draw(el){
      const srt = +q(el, "u5-8-din-srt").value;
      const sl = +q(el, "u5-8-din-slope").value / 100;     // proportion per dB at SRT
      const cut = +q(el, "u5-8-din-cut").value;
      const seed = +q(el, "u5-8-din-seed").value;
      set(el, "u5-8-din-srt-o", fmt(srt, 1) + " dB SNR");
      set(el, "u5-8-din-slope-o", Math.round(sl * 100) + "% per dB");
      set(el, "u5-8-din-cut-o", fmt(cut, 1) + " dB SNR");
      set(el, "u5-8-din-seed-o", String(seed));
      const r = rng(seed * 104729 + 7);
      let snr = 0, nc = 0;
      const track = [], oks = [];
      for(let t = 0; t < 24; t++){
        track.push(snr);
        const p = 1 / (1 + Math.exp(-4 * sl * (snr - srt)));   // midpoint slope = sl
        const ok = r() < p;
        oks.push(ok); if(ok) nc++;
        snr += ok ? -2 : 2;
      }
      let sum = 0;
      for(let t = 4; t < 24; t++) sum += track[t];
      const est = sum / 20;
      set(el, "u5-8-din-est", fmt(est, 1) + " dB SNR");
      set(el, "u5-8-din-err", sgn(est - srt, 1) + " dB");
      set(el, "u5-8-din-nc", nc + " of 24");
      set(el, "u5-8-din-res", est <= cut ? "pass (illustrative)" : "refer (illustrative)");
      const xs = track.map((v, i) => i + 1);
      const cx = [], cy = [], ex = [], ey = [];
      track.forEach((v, i) => { if(oks[i]){ cx.push(i + 1); cy.push(v); } else { ex.push(i + 1); ey.push(v); } });
      const lo = Math.min.apply(null, track.concat([cut, srt])) - 4, hi = Math.max(4, Math.max.apply(null, track) + 4);
      plot(el.querySelector("canvas"), {
        xlim:[0, 25], ylim:[Math.floor(lo / 2) * 2, Math.ceil(hi / 2) * 2], xlabel:"Triplet number", ylabel:"SNR (dB)",
        xticks:[[1, "1"], [5, "5"], [10, "10"], [15, "15"], [20, "20"], [24, "24"]],
        series:[
          {x:[4.5, 4.5], y:[lo - 10, hi + 10], color:"--plot-axis", width:1, dash:[2, 4]},
          {x:[0, 25], y:[cut, cut], color:"--warn", width:1.5, dash:[6, 4]},
          {x:[5, 24], y:[est, est], color:"--left", width:2},
          {x:xs, y:track, color:"--plot-axis", width:1},
          {x:cx, y:cy, color:"--accent", marker:"o", msize:4, line:false},
          {x:ex, y:ey, color:"--right", marker:"x", msize:5, line:false}
        ],
        labels:[
          {text:"scored trials 5 to 24", x:5, y:hi - 1, dx:4, color:"--muted"},
          {text:"cut-off (illustrative)", x:25, y:cut, dx:-4, dy:-6, align:"right", color:"--warn"}
        ]
      });
    }
  });

  /* ---------------- u5-8-calib ---------------- */
  AT.demo("u5-8-calib", {
    init(el){ bind(el, this); },
    draw(el){
      const ref = +q(el, "u5-8-calib-ref").value;
      const spl = +q(el, "u5-8-calib-spl").value;
      const ret = +q(el, "u5-8-calib-f").value;
      const hl = +q(el, "u5-8-calib-hl").value;
      const bits = +q(el, "u5-8-calib-bits").value;
      const nf = +q(el, "u5-8-calib-nf").value;
      set(el, "u5-8-calib-ref-o", fmt(ref, 0) + " dBFS RMS");
      set(el, "u5-8-calib-spl-o", spl.toFixed(1) + " dB SPL");
      set(el, "u5-8-calib-hl-o", hl + " dB HL");
      set(el, "u5-8-calib-nf-o", fmt(nf, 0) + " dBFS");
      const S = spl - ref;
      const tspl = hl + ret;
      const req = tspl - S;
      const clip = -20 * Math.log10(Math.SQRT2);     // -3.01 dBFS RMS for a full-scale sine
      const floorM = nf + 10;
      const peakAmp = Math.pow(10, (req - clip) / 20);   // relative to full scale
      const steps = peakAmp * (Math.pow(2, bits - 1) - 1);
      const hlMax = S + clip - ret, hlMin = floorM + S - ret;
      set(el, "u5-8-calib-s", S.toFixed(1) + " dB SPL");
      set(el, "u5-8-calib-tspl", tspl.toFixed(1) + " dB SPL");
      set(el, "u5-8-calib-req", fmt(req, 1) + " dBFS");
      set(el, "u5-8-calib-lsb", req > clip ? "clips" : (steps >= 100 ? steps.toFixed(0) : steps.toFixed(1)));
      set(el, "u5-8-calib-rng", hlMin < hlMax ? fmt(hlMin, 1) + " to " + fmt(hlMax, 1) + " dB HL" : "none");
      let st;
      if(req > clip) st = "Too high: exceeds 0 dBFS peak (clipping)";
      else if(req < floorM) st = "Too low: within 10 dB of noise floor";
      else if(steps < 20) st = "Warning: few quantisation steps";
      else st = "OK";
      set(el, "u5-8-calib-st", st);
      const x = [], y = [];
      for(let h = -10; h <= 120; h += 1){ x.push(h); y.push(h + ret - S); }
      const ylo = Math.min(nf - 10, req - 10), yhi = 10;
      plot(el.querySelector("canvas"), {
        xlim:[-10, 120], ylim:[Math.floor(ylo / 10) * 10, yhi], xlabel:"Target level (dB HL)", ylabel:"Required level (dBFS RMS)",
        series:[
          {x:[-10, 120], y:[clip, clip], color:"--right", width:1.5, dash:[6, 4]},
          {x:[-10, 120], y:[floorM, floorM], color:"--warn", width:1.5, dash:[6, 4]},
          {x, y, color:"--accent", width:2.5},
          {x:[hl], y:[req], color:"--left", marker:"o", msize:6, line:false}
        ],
        labels:[
          {text:"clipping limit", x:-8, y:clip, dy:-6, color:"--right"},
          {text:"noise floor + 10 dB", x:-8, y:floorM, dy:-6, color:"--warn"}
        ]
      });
    }
  });
})();
