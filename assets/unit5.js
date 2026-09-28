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
