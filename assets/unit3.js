/* Unit 3a demos: filterbank, WDRC, noise reduction, feedback loop gain */
(function(){
  const {plot} = window.AT;
  const log2 = v => Math.log(v) / Math.LN2;
  const db10 = v => 10 * Math.log10(v);
  const fmt1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const bind = (el, obj) => el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => obj.draw(el)));
  const logGrid = (a, b, n) => { const out = []; for(let i = 0; i < n; i++) out.push(a * Math.pow(b / a, i / (n - 1))); return out; };
  const fTicks = [[100,"100"],[200,"200"],[500,"500"],[1000,"1k"],[2000,"2k"],[4000,"4k"],[8000,"8k"]];

  /* ---------- 3.2 filterbank ---------- */
  const erbNum = f => 21.4 * Math.log10(4.37 * f / 1000 + 1);
  const erbInv = e => (Math.pow(10, e / 21.4) - 1) * 1000 / 4.37;
  function bandEdges(n, sp, lo, hi){
    const e = [];
    for(let k = 0; k <= n; k++){
      const t = k / n;
      if(sp === "lin") e.push(lo + (hi - lo) * t);
      else if(sp === "log") e.push(lo * Math.pow(hi / lo, t));
      else e.push(erbInv(erbNum(lo) + (erbNum(hi) - erbNum(lo)) * t));
    }
    return e;
  }
  function centre(a, b, sp){
    if(sp === "lin") return (a + b) / 2;
    if(sp === "log") return Math.sqrt(a * b);
    return erbInv((erbNum(a) + erbNum(b)) / 2);
  }
  AT.demo("u3-bands", {
    init(el){ bind(el, this); },
    draw(el){
      const n = +el.querySelector("#u3-bands-n").value;
      const sp = el.querySelector("#u3-bands-sp").value;
      const ord = +el.querySelector("#u3-bands-ord").value;
      el.querySelector("#u3-bands-n-o").textContent = n;
      el.querySelector("#u3-bands-ord-o").textContent = ord + " (" + (6 * ord) + " dB/octave)";
      const e = bandEdges(n, sp, 100, 8000);
      const f = logGrid(70, 10000, 400);
      const series = [], psum = new Array(f.length).fill(0), cfs = [];
      let bmin = Infinity, bmax = 0, fmin = 0, fmax = 0, below = 0;
      for(let k = 0; k < n; k++){
        const fl = e[k], fh = e[k + 1], y = [];
        for(let i = 0; i < f.length; i++){
          const p = 1 / (1 + Math.pow(fl / f[i], 2 * ord)) / (1 + Math.pow(f[i] / fh, 2 * ord));
          psum[i] += p; y.push(db10(p));
        }
        series.push({x: f, y, color: k % 2 ? "--left" : "--accent", width: 1.6});
        const cf = centre(fl, fh, sp); cfs.push(Math.round(cf));
        const bw = fh - fl;
        if(bw < bmin){ bmin = bw; fmin = cf; }
        if(bw > bmax){ bmax = bw; fmax = cf; }
        if(cf < 1000) below++;
      }
      series.push({x: f, y: psum.map(db10), color: "--plot-axis", width: 1.4, dash: [5, 4]});
      plot(el.querySelector("canvas"), {
        xlim: [70, 10000], ylim: [-40, 8], xlog: true, xticks: fTicks,
        yticks: [[-40,"-40"],[-30,"-30"],[-20,"-20"],[-10,"-10"],[0,"0"]],
        xlabel: "Frequency (Hz)", ylabel: "Magnitude (dB)", series
      });
      el.querySelector("#u3-bands-cf").textContent = cfs.join(", ");
      const same = Math.abs(bmax - bmin) < 1;
      el.querySelector("#u3-bands-bmin").textContent = Math.round(bmin) + " Hz wide" + (same ? " (all channels equal)" : " (centre " + Math.round(fmin) + " Hz)");
      el.querySelector("#u3-bands-bmax").textContent = Math.round(bmax) + " Hz wide" + (same ? " (all channels equal)" : " (centre " + Math.round(fmax) + " Hz)");
      el.querySelector("#u3-bands-lo").textContent = below + " of " + n;
    }
  });

  /* ---------- 3.3 WDRC ---------- */
  function wdrcOut(L, kp, cr, g, mpo){
    const o = L < kp ? L + g : kp + g + (L - kp) / cr;
    return Math.min(o, mpo);
  }
  AT.demo("u3-wdrc", {
    init(el){ bind(el, this); },
    draw(el){
      const kp = +el.querySelector("#u3-wdrc-kp").value;
      const cr = +el.querySelector("#u3-wdrc-cr").value;
      const g = +el.querySelector("#u3-wdrc-g").value;
      const mpo = +el.querySelector("#u3-wdrc-mpo").value;
      el.querySelector("#u3-wdrc-kp-o").textContent = kp + " dB SPL";
      el.querySelector("#u3-wdrc-cr-o").textContent = cr.toFixed(1) + ":1";
      el.querySelector("#u3-wdrc-g-o").textContent = g + " dB";
      el.querySelector("#u3-wdrc-mpo-o").textContent = mpo + " dB SPL";
      const x = [], yo = [], yg = [], ylin = [];
      for(let L = 20; L <= 110; L += 0.5){ const o = wdrcOut(L, kp, cr, g, mpo); x.push(L); yo.push(o); yg.push(o - L); ylin.push(L + g); }
      const px = [50, 65, 80], po = px.map(L => wdrcOut(L, kp, cr, g, mpo));
      const cv = el.querySelectorAll("canvas");
      plot(cv[0], {
        xlim: [20, 110], ylim: [20, 140], xlabel: "Input level (dB SPL)", ylabel: "Output (dB SPL)",
        series: [
          {x: [20, 110], y: [20 + g, 110 + g], color: "--plot-axis", width: 1, dash: [4, 4]},
          {x: [20, 110], y: [mpo, mpo], color: "--warn", width: 1.2, dash: [6, 4]},
          {x: [kp, kp], y: [20, 140], color: "--plot-axis", width: 1, dash: [2, 4]},
          {x, y: yo, color: "--accent", width: 2.4},
          {x: px, y: po, color: "--right", line: false, marker: "dot", msize: 4}
        ],
        labels: [{text: "MPO", x: 22, y: mpo + 2, color: "--warn"}, {text: "CT", x: kp + 1, y: 25, color: "--muted"}]
      });
      plot(cv[1], {
        xlim: [20, 110], ylim: [-30, 70], xlabel: "Input level (dB SPL)", ylabel: "Gain (dB)",
        series: [
          {x: [20, 110], y: [g, g], color: "--plot-axis", width: 1, dash: [4, 4]},
          {x: [20, 110], y: [0, 0], color: "--plot-axis", width: 1},
          {x, y: yg, color: "--accent", width: 2.4},
          {x: px, y: po.map((o, i) => o - px[i]), color: "--right", line: false, marker: "dot", msize: 4}
        ]
      });
      ["g50", "g65", "g80"].forEach((id, i) => {
        const L = px[i], o = po[i], unl = L < kp ? L + g : kp + g + (L - kp) / cr;
        el.querySelector("#u3-wdrc-" + id).textContent = fmt1(o - L) + " dB (output " + fmt1(o) + ")" + (unl > mpo ? ", MPO-limited" : "");
      });
      el.querySelector("#u3-wdrc-sl").textContent = cr === 1 ? "1.00 dB per dB (linear)" : "1/CR = " + (1 / cr).toFixed(2) + " dB per dB";
    }
  });

  /* ---------- 3.4 noise reduction ---------- */
  const rules = {
    w: xi => xi / (1 + xi),
    p: xi => Math.sqrt(xi / (1 + xi)),
    m: xi => 1 - 1 / Math.sqrt(1 + xi)
  };
  AT.demo("u3-nr", {
    init(el){ bind(el, this); },
    draw(el){
      const rule = el.querySelector("#u3-nr-rule").value;
      const fl = +el.querySelector("#u3-nr-floor").value;
      const nl = +el.querySelector("#u3-nr-nl").value;
      el.querySelector("#u3-nr-floor-o").textContent = fl + " dB";
      el.querySelector("#u3-nr-nl-o").textContent = (nl > 0 ? "+" : "") + nl + " dB";
      const gmin = Math.pow(10, -fl / 20);
      const gain = (r, xi) => Math.max(rules[r](xi), gmin);
      const xs = [], curves = {w: [], p: [], m: []}, sel = [];
      for(let d = -20; d <= 25; d += 0.25){
        const xi = Math.pow(10, d / 10); xs.push(d);
        for(const r in rules) curves[r].push(20 * Math.log10(Math.max(rules[r](xi), 1e-4)));
        sel.push(20 * Math.log10(gain(rule, xi)));
      }
      const cv = el.querySelectorAll("canvas");
      const others = Object.keys(rules).filter(r => r !== rule).map(r => ({x: xs, y: curves[r], color: "--plot-axis", width: 1, dash: [4, 4]}));
      plot(cv[0], {
        xlim: [-20, 25], ylim: [-35, 3], xlabel: "A priori SNR (dB)", ylabel: "Gain (dB)",
        series: others.concat([
          {x: [-20, 25], y: [-fl, -fl], color: "--warn", width: 1.2, dash: [6, 4]},
          {x: xs, y: sel, color: "--accent", width: 2.6}
        ]),
        labels: [{text: "attenuation limit", x: 12, y: -fl - 2.5, color: "--warn"}]
      });
      /* band spectrum */
      const nb = 16, edges = [], cfs = [];
      for(let k = 0; k <= nb; k++) edges.push(100 * Math.pow(80, k / nb));
      for(let k = 0; k < nb; k++) cfs.push(Math.sqrt(edges[k] * edges[k + 1]));
      const S = cfs.map((f, k) => (f > 450 ? 60 - 6 * log2(f / 450) : 60 - 4 * log2(450 / f)) + 2.5 * Math.sin(1.7 * k));
      const N = cfs.map(f => 55 + nl - 5 * log2(f / 100));
      const P = x => Math.pow(10, x / 10);
      let s0 = 0, n0 = 0, s1 = 0, n1 = 0, cnt = 0;
      const Y = [], Z = [];
      for(let k = 0; k < nb; k++){
        const ps = P(S[k]), pn = P(N[k]), g = gain(rule, ps / pn), g2 = g * g;
        s0 += ps; n0 += pn; s1 += g2 * ps; n1 += g2 * pn;
        if(20 * Math.log10(g) < -3) cnt++;
        Y.push(db10(ps + pn)); Z.push(db10(ps + pn) + 20 * Math.log10(g));
      }
      const stepS = arr => ({x: edges.slice(), y: arr.concat([arr[arr.length - 1]])});
      const mk = (arr, color, width, dash) => Object.assign(stepS(arr), {color, width, dash, step: true});
      plot(cv[1], {
        xlim: [100, 8000], ylim: [0, 75], xlog: true, xticks: fTicks.slice(0, 7),
        xlabel: "Frequency (Hz)", ylabel: "Band level (dB)",
        series: [mk(S, "--left", 1.4, [4, 3]), mk(N, "--right", 1.4, [4, 3]), mk(Y, "--plot-axis", 1.8), mk(Z, "--accent", 2.4)]
      });
      const snr0 = db10(s0 / n0), snr1 = db10(s1 / n1);
      el.querySelector("#u3-nr-snr0").textContent = fmt1(snr0) + " dB";
      el.querySelector("#u3-nr-snr1").textContent = fmt1(snr1) + " dB (in-band SNR unchanged)";
      el.querySelector("#u3-nr-nb").textContent = cnt + " of " + nb;
      el.querySelector("#u3-nr-ds").textContent = fmt1(db10(s1 / s0)) + " dB";
    }
  });

  /* ---------- 3.5 feedback ---------- */
  AT.demo("u3-feedback", {
    init(el){ bind(el, this); },
    draw(el){
      const a0 = +el.querySelector("#u3-feedback-vent").value;
      const G = +el.querySelector("#u3-feedback-g").value;
      const asg = +el.querySelector("#u3-feedback-asg").value;
      el.querySelector("#u3-feedback-g-o").textContent = G + " dB";
      el.querySelector("#u3-feedback-asg-o").textContent = asg + " dB";
      const haGain = f => G - 12 * Math.max(0, log2(2000 / f)) - 10 * Math.max(0, log2(f / 5000));
      const atten = f => a0 + 10 * Math.pow(log2(f / 3000), 2) + asg;
      const f = logGrid(250, 8000, 300);
      const g = f.map(haGain), A = f.map(atten), L = f.map((v, i) => g[i] - A[i]);
      let lmax = -Infinity, fmx = 0;
      L.forEach((v, i) => { if(v > lmax){ lmax = v; fmx = f[i]; } });
      const wx = [], wy = [], rx = [], ry = [];
      for(let i = 0; i < f.length; i += 3){
        if(L[i] >= 0){ rx.push(f[i]); ry.push(L[i]); }
        else if(L[i] >= -6){ wx.push(f[i]); wy.push(L[i]); }
      }
      const tk = [[250,"250"],[500,"500"],[1000,"1k"],[2000,"2k"],[4000,"4k"],[8000,"8k"]];
      const cv = el.querySelectorAll("canvas");
      plot(cv[0], {
        xlim: [250, 8000], ylim: [-60, 100], xlog: true, xticks: tk,
        xlabel: "Frequency (Hz)", ylabel: "dB",
        series: [
          {x: [250, 8000], y: [0, 0], color: "--right", width: 1, dash: [4, 4]},
          {x: [250, 8000], y: [-6, -6], color: "--warn", width: 1, dash: [2, 4]},
          {x: f, y: g, color: "--left", width: 1.8},
          {x: f, y: A, color: "--plot-axis", width: 1.8, dash: [6, 4]},
          {x: f, y: L, color: "--accent", width: 2.4},
          {x: wx, y: wy, color: "--warn", line: false, marker: "dot", msize: 3.5},
          {x: rx, y: ry, color: "--right", line: false, marker: "dot", msize: 3.5}
        ],
        labels: [{text: "0 dB loop gain", x: 260, y: 5, dy: -4, color: "--right"}]
      });
      /* closed-loop response change, 4 ms loop delay */
      const tau = 0.004, fd = logGrid(250, 8000, 4000), hx = [], hy = [];
      const stable = lmax < 0;
      if(stable){
        for(const fr of fd){
          const l = Math.pow(10, (haGain(fr) - atten(fr)) / 20), ph = 2 * Math.PI * fr * tau;
          const re = 1 - l * Math.cos(ph), im = l * Math.sin(ph);
          hx.push(fr); hy.push(-10 * Math.log10(re * re + im * im));
        }
      }
      plot(cv[1], {
        xlim: [250, 8000], ylim: [-10, 25], xlog: true, xticks: tk,
        xlabel: "Frequency (Hz)", ylabel: "Response change (dB)",
        series: stable ? [{x: [250, 8000], y: [0, 0], color: "--plot-axis", width: 1}, {x: hx, y: hy, color: "--accent", width: 1.4}] : [],
        labels: stable ? [] : [{text: "Loop gain above 0 dB: unstable, the aid oscillates (whistle)", x: 300, y: 8, color: "--right"}]
      });
      el.querySelector("#u3-feedback-max").textContent = (lmax > 0 ? "+" : "") + fmt1(lmax) + " dB";
      el.querySelector("#u3-feedback-fmax").textContent = Math.round(fmx) + " Hz";
      el.querySelector("#u3-feedback-msg").textContent = (a0 + asg) + " dB";
      el.querySelector("#u3-feedback-st").textContent = lmax >= 0 ? "Unstable: whistle likely" :
        lmax >= -6 ? "Marginal: " + fmt1(-lmax) + " dB margin, colouration likely" : "Stable: " + fmt1(-lmax) + " dB margin";
    }
  });
})();

/* Unit 3 part b demos: CI filterbank / n-of-m, LPC envelope, cepstrum, WER calculator */
(function(){
  const AT = window.AT;
  const {plot, heat, TAU, rng, gauss} = AT;

  /* ---------- shared helpers ---------- */
  function fftReal(x, n){
    const re = new Float64Array(n), im = new Float64Array(n);
    for(let i = 0; i < Math.min(n, x.length); i++) re[i] = x[i];
    AT.fft(re, im);
    return {re, im};
  }
  // second-order resonator coefficients (unity gain at DC)
  function resonator(F, B, fs){
    const r = Math.exp(-Math.PI * B / fs), th = TAU * F / fs;
    const a1 = 2 * r * Math.cos(th), a2 = -r * r;
    return {a1, a2, g: 1 - a1 - a2};
  }
  // magnitude of a cascade of resonators at frequency f
  function cascadeMag(f, formants, fs){
    let m = 1;
    const w = TAU * f / fs, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
    formants.forEach(([F, B]) => {
      const {a1, a2, g} = resonator(F, B, fs);
      const re = 1 - a1 * c1 - a2 * c2, im = a1 * s1 + a2 * s2;
      m *= g / Math.sqrt(re * re + im * im);
    });
    return m;
  }
  function filterCascade(x, formants, fs){
    let y = Float64Array.from(x);
    formants.forEach(([F, B]) => {
      const {a1, a2, g} = resonator(F, B, fs); let y1 = 0, y2 = 0;
      for(let i = 0; i < y.length; i++){ const v = g * y[i] + a1 * y1 + a2 * y2; y2 = y1; y1 = v; y[i] = v; }
    });
    return y;
  }
  const fmtHz = v => { const r = String(Math.round(v)); return r.length > 4 ? r.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : r; };

  /* ================= u3-ci: filterbank, envelopes, n-of-m ================= */
  const CI = {fs: 16000, dur: 0.4, sig: null};
  function ciSignal(){
    if(CI.sig) return CI.sig;
    const fs = CI.fs, N = Math.round(fs * CI.dur), x = new Float64Array(N);
    const r = rng(7);
    // voiced diphthong 0 to 290 ms: /a/ gliding to /i/, f0 110 to 140 Hz
    const nV = Math.round(0.29 * fs);
    const A = [[730, 90], [1090, 110], [2440, 170], [3400, 250]];
    const I = [[270, 60], [2290, 110], [3010, 170], [3700, 250]];
    let ph = 0, lp = 0; const st = [[0,0],[0,0],[0,0],[0,0]];
    for(let n = 0; n < nV; n++){
      const u = n / nV, f0 = 110 + 30 * u;
      ph += f0 / fs; let e = 0; if(ph >= 1){ ph -= 1; e = 1; }
      lp = 0.9 * lp + e;                          // glottal spectral tilt
      let v = lp;
      const k = Math.min(1, Math.max(0, (u - 0.25) / 0.5));
      for(let j = 0; j < 4; j++){
        const F = A[j][0] + (I[j][0] - A[j][0]) * k, B = A[j][1] + (I[j][1] - A[j][1]) * k;
        const c = resonator(F, B, fs); const y = c.g * v + c.a1 * st[j][0] + c.a2 * st[j][1];
        st[j][1] = st[j][0]; st[j][0] = y; v = y;
      }
      const ramp = Math.min(1, n / (0.02 * fs), (nV - n) / (0.015 * fs));
      x[n] = v * ramp;
    }
    // fricative /s/-like noise 310 to 400 ms
    const n0 = Math.round(0.31 * fs); let prev = 0;
    const fr = resonator(5200, 1800, fs); let s1 = 0, s2 = 0; const nz = [];
    for(let n = n0; n < N; n++){
      const w = gauss(r), d = w - prev; prev = w;             // first difference: high-pass
      const y = fr.g * d + fr.a1 * s1 + fr.a2 * s2; s2 = s1; s1 = y; nz.push(y);
    }
    let pv = 0; for(let n = 0; n < nV; n++) pv = Math.max(pv, Math.abs(x[n]));
    let pn = 0; nz.forEach(v => pn = Math.max(pn, Math.abs(v)));
    nz.forEach((v, i) => { const n = n0 + i, ramp = Math.min(1, i / (0.01 * fs), (N - 1 - n) / (0.01 * fs));
      x[n] = 0.35 * pv * v / pn * ramp; });
    CI.sig = x; return x;
  }
  function ciAnalyse(m){
    const key = "m" + m; CI.cache = CI.cache || {}; if(CI.cache[key]) return CI.cache[key];
    const fs = CI.fs, x = ciSignal(), N = x.length, lo = 200, hi = 7000, hop = 32, nf = Math.floor(N / hop);
    const edges = []; for(let k = 0; k <= m; k++) edges.push(lo * Math.pow(hi / lo, k / m));
    const env = new Float64Array(nf * m);            // env[f*m + ch]
    const aL = Math.exp(-TAU * 200 / fs);           // one-pole envelope smoother at 200 Hz
    for(let ch = 0; ch < m; ch++){
      const fl = edges[ch], fh = edges[ch + 1], fc = Math.sqrt(fl * fh), Q = fc / (fh - fl);
      const w0 = TAU * fc / fs, al = Math.sin(w0) / (2 * Q), a0 = 1 + al;
      const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w0) / a0, a2 = (1 - al) / a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, v1 = 0, v2 = 0, e1 = 0, e2 = 0;
      for(let n = 0; n < N; n++){
        const xn = x[n];
        const y = b0 * xn + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = xn; y2 = y1; y1 = y;     // biquad 1
        const v = b0 * y + b2 * u2 - a1 * v1 - a2 * v2; u2 = u1; u1 = y; v2 = v1; v1 = v;       // biquad 2
        e1 = aL * e1 + (1 - aL) * Math.abs(v);       // full-wave rectify + low-pass
        e2 = aL * e2 + (1 - aL) * e1;
        if(n % hop === hop - 1){ const f = (n - hop + 1) / hop; if(f < nf) env[f * m + ch] = e2; }
      }
    }
    const res = {edges, env, nf, hop};
    CI.cache[key] = res; return res;
  }
  AT.demo("u3-ci", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const m = +el.querySelector("#u3-ci-m").value;
      const nSel = el.querySelector("#u3-ci-n");
      let nWanted = nSel.value === "all" ? m : +nSel.value;
      const n = Math.min(nWanted, m);
      const rate = +el.querySelector("#u3-ci-rate").value;
      const {edges, env, nf, hop} = ciAnalyse(m);
      let mx = 1e-12; for(let i = 0; i < env.length; i++) mx = Math.max(mx, env[i]);
      const floor = -60;
      const dB = new Float64Array(nf * m), sel = new Float64Array(nf * m).fill(floor);
      let eAll = 0, eSel = 0; const count = new Array(m).fill(0);
      for(let f = 0; f < nf; f++){
        const idx = [];
        for(let ch = 0; ch < m; ch++){ const v = env[f * m + ch]; dB[f * m + ch] = Math.max(floor, 20 * Math.log10(v / mx + 1e-12)); idx.push(ch); eAll += v * v; }
        idx.sort((a, b) => env[f * m + b] - env[f * m + a]);
        for(let k = 0; k < n; k++){ const ch = idx[k]; sel[f * m + ch] = dB[f * m + ch]; eSel += env[f * m + ch] ** 2; count[ch]++; }
      }
      // heat() expects data[i*ny + j] with i = x (frame), j = y (channel): same layout
      const tEnd = nf * hop / CI.fs * 1000;
      const cvs = el.querySelectorAll("canvas");
      const opts = {nx: nf, ny: m, zmin: floor, zmax: 0, xlim: [0, tEnd], ylim: [0.5, m + 0.5], xlabel: "Time (ms)", ylabel: "Channel (1 = low freq.)"};
      heat(cvs[0], Object.assign({data: dB}, opts));
      heat(cvs[1], Object.assign({data: sel}, opts));
      el.querySelector("#u3-ci-m-o").textContent = m;
      el.querySelector("#u3-ci-rch").textContent = m + " (" + fmtHz(Math.sqrt(edges[0] * edges[1])) + " to " + fmtHz(Math.sqrt(edges[m - 1] * edges[m])) + " Hz)";
      el.querySelector("#u3-ci-rn").textContent = n >= m ? m + " of " + m + " (all: CIS)" : n + " of " + m + " (n-of-m)";
      el.querySelector("#u3-ci-re").textContent = (100 * eSel / eAll).toFixed(1) + " %";
      const total = n * rate, maxRate = Math.floor(1 / (2 * 25e-6 + 8e-6));
      el.querySelector("#u3-ci-rr").textContent = fmtHz(total) + " pps";
      el.querySelector("#u3-ci-note").textContent = n + " channels per frame at " + fmtHz(rate) + " pps each gives " + fmtHz(total) +
        " pulses per second in total. With 25 µs phases and an 8 µs gap one pulse lasts 58 µs, so strictly sequential pulses cannot exceed about " +
        fmtHz(maxRate) + " pps. " + (total > maxRate ? "This setting exceeds that limit: shorter phases (and therefore higher current for the same charge) or fewer channels would be needed." : "This setting is within that limit.");
    }
  });

  /* ================= u3-lpc: autocorrelation LPC and Levinson-Durbin ================= */
  const VOWELS = {
    a: [[730, 80], [1090, 100], [2440, 150], [3400, 250]],
    i: [[270, 60], [2290, 100], [3010, 150], [3600, 250]],
    u: [[300, 60], [870, 90], [2240, 150], [3400, 250]],
    ae: [[660, 80], [1720, 100], [2410, 150], [3400, 250]]
  };
  function levinson(r, p){
    const a = new Float64Array(p + 1); a[0] = 1; let E = r[0];
    for(let i = 1; i <= p; i++){
      let acc = r[i]; for(let j = 1; j < i; j++) acc += a[j] * r[i - j];
      const k = -acc / E, prev = a.slice();
      for(let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
      a[i] = k; E *= (1 - k * k);
    }
    return {a, E};
  }
  AT.demo("u3-lpc", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const fs = 10000, N = 512, NF = 2048;
      const p = +el.querySelector("#u3-lpc-p").value, f0 = +el.querySelector("#u3-lpc-f0").value;
      const fm = VOWELS[el.querySelector("#u3-lpc-v").value];
      el.querySelector("#u3-lpc-p-o").textContent = p;
      el.querySelector("#u3-lpc-f0-o").textContent = f0 + " Hz";
      // synthetic vowel: harmonics of f0, source falling 6 dB/octave, shaped by formants
      const x = new Float64Array(N + 1);
      for(let h = 1; h * f0 < fs / 2 - 50; h++){
        const f = h * f0, amp = cascadeMag(f, fm, fs) / h, w = TAU * f / fs;
        for(let n = 0; n <= N; n++) x[n] += amp * Math.cos(w * n);
      }
      // pre-emphasis and Hamming window
      const y = new Float64Array(N);
      for(let n = 0; n < N; n++) y[n] = (x[n + 1] - 0.97 * x[n]) * (0.54 - 0.46 * Math.cos(TAU * n / (N - 1)));
      const r = new Float64Array(p + 1);
      for(let k = 0; k <= p; k++){ let s = 0; for(let n = k; n < N; n++) s += y[n] * y[n - k]; r[k] = s; }
      const {a, E} = levinson(r, p);
      const X = fftReal(y, NF), Af = fftReal(a, NF);
      const fx = [], sp = [], env = [];
      for(let k = 0; k <= NF / 2; k++){
        fx.push(k * fs / NF);
        sp.push(10 * Math.log10(X.re[k] ** 2 + X.im[k] ** 2 + 1e-20));
        env.push(10 * Math.log10(E / (Af.re[k] ** 2 + Af.im[k] ** 2) + 1e-20));
      }
      const top = Math.max(...sp);
      for(let k = 0; k < sp.length; k++){ sp[k] -= top; env[k] -= top; }
      const peaks = [];
      for(let k = 2; k < env.length - 2; k++) if(env[k] > env[k - 1] && env[k] >= env[k + 1] && fx[k] > 90 && fx[k] < fs / 2 - 90) peaks.push(fx[k]);
      const series = [
        {x: fx, y: sp, color: "--plot-axis", width: 1},
        {x: fx, y: env, color: "--accent", width: 2.4}
      ];
      fm.forEach(([F]) => series.push({x: [F, F], y: [-75, 8], color: "--warn", width: 1, dash: [4, 4]}));
      series.push({x: peaks, y: peaks.map(f => env[Math.round(f * NF / fs)] + 4), color: "--right", line: false, marker: "o", msize: 4});
      plot(el.querySelector("canvas"), {xlim: [0, 5000], ylim: [-75, 10], xlabel: "Frequency (Hz)", ylabel: "Level (dB re max)", series});
      el.querySelector("#u3-lpc-pk").textContent = peaks.length ? peaks.map(v => fmtHz(v)).join(", ") + " Hz" : "none";
      el.querySelector("#u3-lpc-tr").textContent = fm.map(v => fmtHz(v[0])).join(", ") + " Hz";
      el.querySelector("#u3-lpc-err").textContent = (10 * Math.log10(E / r[0])).toFixed(1) + " dB";
    }
  });

  /* ================= u3-cep: real cepstrum and pitch ================= */
  AT.demo("u3-cep", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const fs = 16000, N = 1024;
      const f0 = +el.querySelector("#u3-cep-f0").value, src = el.querySelector("#u3-cep-src").value;
      const Lms = +el.querySelector("#u3-cep-l").value / 10;
      el.querySelector("#u3-cep-f0-o").textContent = f0 + " Hz";
      el.querySelector("#u3-cep-l-o").textContent = Lms.toFixed(1) + " ms";
      const fm = VOWELS.a;
      const x = new Float64Array(N);
      if(src !== "unv"){
        for(let h = 1; h * f0 < fs / 2 - 50; h++){
          const f = h * f0, amp = cascadeMag(f, fm, fs) / h, w = TAU * f / fs;
          for(let n = 0; n < N; n++) x[n] += amp * Math.cos(w * n);
        }
      }
      {  // noise: the whole source when unvoiced, aspiration when breathy, a faint floor (-46 dB) when voiced
        const r = rng(11), M = N + 2000, w = new Float64Array(M);
        for(let i = 0; i < M; i++) w[i] = gauss(r);
        const nz = filterCascade(w, fm, fs);
        let pv = 0, pn = 0; for(let n = 0; n < N; n++){ pv += x[n] * x[n]; pn += nz[n + 2000] ** 2; }
        const g = src === "unv" ? 1 : Math.sqrt(pv / pn) * (src === "bre" ? 0.25 : 0.005);   // breathy: about 12 dB below voicing
        for(let n = 0; n < N; n++) x[n] += g * nz[n + 2000];
      }
      for(let n = 0; n < N; n++) x[n] *= 0.5 - 0.5 * Math.cos(TAU * n / (N - 1));
      const X = fftReal(x, N), lm = new Float64Array(N);
      for(let k = 0; k < N; k++) lm[k] = Math.log(Math.sqrt(X.re[k] ** 2 + X.im[k] ** 2) + 1e-9);
      const C = fftReal(lm, N), c = new Float64Array(N);
      for(let n = 0; n < N; n++) c[n] = C.re[n] / N;              // log spectrum is real and even
      const lo = Math.round(fs / 400), hi = Math.round(fs / 70);
      let q = lo; for(let n = lo; n <= hi; n++) if(c[n] > c[q]) q = n;
      let mean = 0, sd = 0; for(let n = lo; n <= hi; n++) mean += c[n]; mean /= (hi - lo + 1);
      for(let n = lo; n <= hi; n++) sd += (c[n] - mean) ** 2; sd = Math.sqrt(sd / (hi - lo + 1));
      const prom = (c[q] - mean) / sd, voiced = prom > 4.5;
      // cepstrum plot
      const qx = [], qy = [];
      for(let n = 8; n <= 320; n++){ qx.push(1000 * n / fs); qy.push(c[n]); }
      let ymax = 0.05; qy.forEach(v => ymax = Math.max(ymax, Math.abs(v)));
      const cvs = el.querySelectorAll("canvas");
      plot(cvs[0], {xlim: [0, 20], ylim: [-ymax * 1.1, ymax * 1.25], xlabel: "Quefrency (ms)", ylabel: "Cepstrum",
        series: [
          {x: [1000 * lo / fs, 1000 * lo / fs], y: [-ymax * 2, ymax * 2], color: "--plot-axis", dash: [3, 4], width: 1},
          {x: [1000 * hi / fs, 1000 * hi / fs], y: [-ymax * 2, ymax * 2], color: "--plot-axis", dash: [3, 4], width: 1},
          {x: [Lms, Lms], y: [-ymax * 2, ymax * 2], color: "--left", dash: [6, 3], width: 1.4},
          {x: qx, y: qy, color: "--accent", width: 1.4},
          {x: [1000 * q / fs], y: [c[q]], color: "--right", line: false, marker: "o", msize: 5}
        ],
        labels: [{text: "search range", x: 1000 * lo / fs, y: ymax * 1.12, dx: 4, color: "--muted"}, {text: "lifter", x: Lms, y: -ymax * 0.95, dx: 4, color: "--left"}]
      });
      // liftered envelope
      const L = Math.max(1, Math.round(Lms * fs / 1000)), cl = new Float64Array(N);
      cl[0] = c[0]; for(let n = 1; n < L; n++){ cl[n] = c[n]; cl[N - n] = c[N - n]; }
      const S = fftReal(cl, N);
      const fx = [], sp = [], env = [], k2dB = 20 / Math.LN10;
      for(let k = 0; k <= N / 2; k++){ fx.push(k * fs / N); sp.push(lm[k] * k2dB); env.push(S.re[k] * k2dB); }
      const top = Math.max(...sp);
      for(let k = 0; k < sp.length; k++){ sp[k] -= top; env[k] -= top; }
      plot(cvs[1], {xlim: [0, 5000], ylim: [-100, 10], xlabel: "Frequency (Hz)", ylabel: "Level (dB re max)",
        series: [{x: fx, y: sp, color: "--plot-axis", width: 1}, {x: fx, y: env, color: "--left", width: 2.4}]});
      el.querySelector("#u3-cep-q").textContent = (1000 * q / fs).toFixed(3) + " ms (" + q + " samples)";
      el.querySelector("#u3-cep-est").textContent = voiced ? (fs / q).toFixed(1) + " Hz" : "no clear peak (treat as unvoiced)";
      el.querySelector("#u3-cep-tr").textContent = src === "unv" ? "none (noise source)" : f0 + " Hz";
      el.querySelector("#u3-cep-pr").textContent = prom.toFixed(1) + " SD";
    }
  });

  /* ================= u3-wer: word error rate calculator ================= */
  function norm(s){ return s.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean); }
  function align(r, h){
    const R = r.length, H = h.length, D = [];
    for(let i = 0; i <= R; i++){ D.push(new Array(H + 1).fill(0)); D[i][0] = i; }
    for(let j = 0; j <= H; j++) D[0][j] = j;
    for(let i = 1; i <= R; i++) for(let j = 1; j <= H; j++)
      D[i][j] = Math.min(D[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
    let i = R, j = H, S = 0, Dl = 0, I = 0; const rr = [], hh = [], oo = [];
    while(i > 0 || j > 0){
      if(i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1)){
        const ok = r[i - 1] === h[j - 1]; if(!ok) S++;
        const w = Math.max(r[i - 1].length, h[j - 1].length);
        rr.unshift(r[i - 1].padEnd(w)); hh.unshift(h[j - 1].padEnd(w)); oo.unshift((ok ? "" : "S").padEnd(w)); i--; j--;
      } else if(i > 0 && D[i][j] === D[i - 1][j] + 1){
        Dl++; const w = r[i - 1].length; rr.unshift(r[i - 1]); hh.unshift("*".repeat(w)); oo.unshift("D".padEnd(w)); i--;
      } else {
        I++; const w = h[j - 1].length; rr.unshift("*".repeat(w)); hh.unshift(h[j - 1]); oo.unshift("I".padEnd(w)); j--;
      }
    }
    return {S, D: Dl, I, N: R, text: "REF: " + rr.join(" ") + "\nHYP: " + hh.join(" ") + "\n     " + oo.join(" ")};
  }
  AT.demo("u3-wer", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const r = norm(el.querySelector("#u3-wer-ref").value), h = norm(el.querySelector("#u3-wer-hyp").value);
      const res = align(r, h);
      el.querySelector("#u3-wer-s").textContent = res.S;
      el.querySelector("#u3-wer-d").textContent = res.D;
      el.querySelector("#u3-wer-i").textContent = res.I;
      el.querySelector("#u3-wer-n").textContent = res.N;
      el.querySelector("#u3-wer-w").textContent = res.N ? (100 * (res.S + res.D + res.I) / res.N).toFixed(1) + " %" : "n/a";
      el.querySelector("#u3-wer-al").textContent = res.text;
    }
  });
  AT._u3b = {ciSignal, ciAnalyse, levinson, align, norm};
})();

/* Unit 3.12 demos: hearing-aid battery-life estimator, I2C vs SPI byte transfer */
(function(){
  const {css} = window.AT;
  const q = (el, s) => el.querySelector(s);
  const bind = (el, obj) => el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => obj.draw(el)));
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const num = (inp, lo, hi, def) => { const v = parseFloat(inp.value); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def; };

  function setup(cv){
    const w = cv.clientWidth; if(!w) return null;
    const h = +(cv.dataset.h || 200), dpr = window.devicePixelRatio || 1;
    cv.style.height = h + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return {ctx, w, h};
  }
  const MONO = "11px 'JetBrains Mono', ui-monospace, monospace";
  const DISP = "600 12px 'Schibsted Grotesk', Arial, sans-serif";

  /* ---------- battery-life estimator ---------- */
  const V_ZN = 1.3, V_LI = 3.7;
  const ZN = {zn312: {cap: 180, name: "Zn-air 312"}, zn13: {cap: 290, name: "Zn-air 13"}};

  AT.demo("u3x-power", {
    init(el){ bind(el, this); },
    draw(el){
      const src = q(el, "#u3x-power-src").value;
      const isLi = src === "li";
      const capLi = num(q(el, "#u3x-power-cap"), 5, 200, 30);
      const u = +q(el, "#u3x-power-u").value / 100;
      const eta = +q(el, "#u3x-power-eta").value / 100;
      let hn = +q(el, "#u3x-power-hn").value, hs = +q(el, "#u3x-power-hs").value;
      const In = num(q(el, "#u3x-power-in"), 0.1, 20, 2), Is = num(q(el, "#u3x-power-is"), 0.1, 30, 4.5);
      let clipped = false;
      if(hn + hs > 24){ hn = 24 - hs; clipped = true; }
      q(el, "#u3x-power-cap-o").textContent = isLi ? capLi + " mAh" : "(not used)";
      q(el, "#u3x-power-u-o").textContent = Math.round(u * 100) + "%";
      q(el, "#u3x-power-eta-o").textContent = isLi ? Math.round(eta * 100) + "%" : "(not used)";
      q(el, "#u3x-power-hn-o").textContent = f1(hn) + " h" + (clipped ? " (limited)" : "");
      q(el, "#u3x-power-hs-o").textContent = f1(hs) + " h";
      q(el, "#u3x-power-cap").disabled = !isLi;
      q(el, "#u3x-power-eta").disabled = !isLi;

      /* energy per day at the cell, mWh */
      const k = isLi ? V_ZN / eta : V_ZN;          /* mW per mA of load current */
      const eN = In * hn * k, eS = Is * hs * k, eDay = eN + eS;
      const eBat = isLi ? capLi * V_LI * u : ZN[src].cap * u * V_ZN;
      const worn = hn + hs;
      const avgI = worn > 0 ? (In * hn + Is * hs) / worn : 0;
      q(el, "#u3x-power-day").textContent = f1(eDay) + " mWh";
      q(el, "#u3x-power-bat").textContent = f1(eBat) + " mWh" + (isLi ? "" : " (" + Math.round(ZN[src].cap * u) + " mAh)");
      q(el, "#u3x-power-avg").textContent = worn > 0 ? (Math.round(avgI * 100) / 100).toFixed(2) + " mA" : "not worn";
      let res = "no use set";
      if(eDay > 0){
        const days = eBat / eDay;
        if(isLi){
          const hrs = eBat / (eDay / worn);
          res = f1(hrs) + " h of wear per charge (" + f1(days) + " days)";
        } else {
          res = f1(days) + " days per cell";
        }
      }
      q(el, "#u3x-power-res").textContent = res;
      const note = isLi
        ? "Li-ion: load currents are referred to a 1.3 V supply and converted to battery power through the regulator efficiency; the cell's energy is capacity x 3.7 V x usable fraction."
        : "Zinc-air: rated capacity is a typical datasheet value at low test currents; the usable fraction allows for voltage dips at the higher currents of wireless aids.";
      q(el, "#u3x-power-note").textContent = note + (clipped ? " Normal-use hours were limited so that the day does not exceed 24 hours." : "");

      /* stacked bars */
      const s = setup(q(el, "canvas")); if(!s) return;
      const {ctx, w, h} = s;
      const L = 150, R = 20, top = 22, bh = 42, gap = 34;
      const pw = w - L - R;
      const maxE = Math.max(eDay, eBat, 1) * 1.08;
      const X = v => L + v / maxE * pw;
      const grid = css("--plot-grid"), axis = css("--plot-axis"), muted = css("--muted"), ink = css("--ink");
      /* ticks */
      const raw = maxE / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), e = raw / mag;
      const step = mag * (e >= 5 ? 10 : e >= 2 ? 5 : e >= 1 ? 2 : 1);
      ctx.font = MONO; ctx.textAlign = "center"; ctx.fillStyle = muted; ctx.strokeStyle = grid; ctx.lineWidth = 1;
      const yAx = top + 2 * bh + gap + 8;
      for(let v = 0; v <= maxE + 1e-9; v += step){
        const x = X(v); ctx.beginPath(); ctx.moveTo(x, top - 6); ctx.lineTo(x, yAx); ctx.stroke();
        ctx.fillText(String(Math.round(v * 10) / 10), x, yAx + 14);
      }
      ctx.font = DISP; ctx.fillStyle = muted; ctx.fillText("Energy (mWh)", L + pw / 2, h - 6);
      ctx.textAlign = "right"; ctx.fillStyle = ink;
      ctx.fillText("Used in one day", L - 10, top + bh / 2 + 4);
      ctx.fillText("Usable in battery", L - 10, top + bh + gap + bh / 2 + 4);
      const seg = (x0, x1, y, col) => { if(x1 - x0 <= 0) return; ctx.fillStyle = css(col); ctx.fillRect(x0, y, x1 - x0, bh); };
      seg(X(0), X(eN), top, "--accent");
      seg(X(eN), X(eDay), top, "--right");
      seg(X(0), X(eBat), top + bh + gap, "--left");
      ctx.strokeStyle = axis; ctx.strokeRect(L + 0.5, top - 6.5, pw - 1, yAx - top + 6);
      /* percentage labels */
      ctx.font = MONO; ctx.textAlign = "left"; ctx.fillStyle = ink;
      if(eDay > 0){
        const pn = Math.round(eN / eDay * 100), ps = 100 - pn;
        const txt = "normal " + pn + "%, streaming " + ps + "%";
        const tx = X(eDay) + 6;
        if(tx + ctx.measureText(txt).width < w - 4) ctx.fillText(txt, tx, top + bh / 2 + 4);
        else ctx.fillText(txt, L + 4, top + bh + 16);
        /* day markers on battery bar */
        const nd = eBat / eDay;
        if(nd < 40){
          ctx.strokeStyle = css("--ink"); ctx.globalAlpha = 0.5;
          for(let d = 1; d < nd; d++){ const x = X(d * eDay); ctx.beginPath(); ctx.moveTo(x, top + bh + gap); ctx.lineTo(x, top + 2 * bh + gap); ctx.stroke(); }
          ctx.globalAlpha = 1;
        }
      }
    }
  });

  /* ---------- I2C vs SPI byte transfer ---------- */
  function buildI2C(addr, byte){
    const slots = [{k: "S", t: "START"}];
    for(let i = 6; i >= 0; i--) slots.push({k: "b", v: (addr >> i) & 1, t: "address bit A" + i, owner: "c"});
    slots.push({k: "b", v: 0, t: "R/W = 0 (write)", owner: "c", lab: "W"});
    slots.push({k: "b", v: 0, t: "ACK from target", owner: "t", lab: "A"});
    for(let i = 7; i >= 0; i--) slots.push({k: "b", v: (byte >> i) & 1, t: "data bit D" + i, owner: "c"});
    slots.push({k: "b", v: 0, t: "ACK from target", owner: "t", lab: "A"});
    slots.push({k: "P", t: "STOP"});
    return slots;
  }
  function buildSPI(byte, reply){
    const slots = [{k: "S", t: "CS low: target selected"}];
    for(let i = 7; i >= 0; i--) slots.push({k: "b", v: (byte >> i) & 1, r: (reply >> i) & 1, t: "bit " + i + " out on MOSI, in on MISO"});
    slots.push({k: "P", t: "CS high: transfer ends"});
    return slots;
  }

  AT.demo("u3x-bus", {
    init(el){
      bind(el, this);
      const sl = q(el, "#u3x-bus-s");
      q(el, "#u3x-bus-step").addEventListener("click", () => {
        const n = this._n || 1, cur = Math.round(+sl.value / 100 * n);
        const next = cur >= n ? 1 : cur + 1;
        sl.value = Math.round(next / n * 100); this.draw(el);
      });
      q(el, "#u3x-bus-reset").addEventListener("click", () => { sl.value = 0; this.draw(el); });
    },
    draw(el){
      const p = q(el, "#u3x-bus-p").value;
      const byte = Math.round(num(q(el, "#u3x-bus-b"), 0, 255, 165));
      const addr = Math.round(num(q(el, "#u3x-bus-a"), 0, 127, 42));
      const f = +q(el, "#u3x-bus-f").value;
      const prog = +q(el, "#u3x-bus-s").value / 100;
      const hex = (v, n) => "0x" + v.toString(16).toUpperCase().padStart(n, "0");
      const bin = v => v.toString(2).padStart(8, "0");
      q(el, "#u3x-bus-b-o").textContent = hex(byte, 2) + " = " + bin(byte);
      q(el, "#u3x-bus-a-o").textContent = hex(addr, 2) + (p === "spi" ? " (SPI uses CS instead)" : "");
      const reply = 0x3C;
      const slots = p === "i2c" ? buildI2C(addr, byte) : buildSPI(byte, reply);
      const n = slots.length; this._n = n;
      const shown = Math.round(prog * n);
      q(el, "#u3x-bus-s-o").textContent = shown + " of " + n + " steps";
      const clocks = slots.filter(s => s.k === "b").length;
      const bitTimes = p === "i2c" ? clocks + 2 : clocks;
      const tus = bitTimes / f * 1e6;
      q(el, "#u3x-bus-clk").textContent = clocks;
      q(el, "#u3x-bus-w").textContent = p === "i2c" ? "2 (SCL, SDA), shared" : "4 (CS, SCLK, MOSI, MISO)";
      q(el, "#u3x-bus-t").textContent = (tus >= 10 ? f1(tus) : (Math.round(tus * 1000) / 1000).toString()) + " µs at " + (f >= 1e6 ? (f / 1e6) + " MHz" : (f / 1e3) + " kHz");
      q(el, "#u3x-bus-cur").textContent = shown === 0 ? "idle" : slots[shown - 1].t;

      const s = setup(q(el, "canvas")); if(!s) return;
      const {ctx, w, h} = s;
      const lanes = p === "i2c"
        ? [{n: "SCL", c: "--accent"}, {n: "SDA", c: "--right"}]
        : [{n: "CS", c: "--left"}, {n: "SCLK", c: "--accent"}, {n: "MOSI", c: "--right"}, {n: "MISO", c: "--left"}];
      const L = 56, R = 12, top = 34;
      const laneH = (h - top - 16) / lanes.length, amp = Math.min(22, laneH * 0.5);
      const pw = w - L - R, sw = pw / (n + 1);
      const X = i => L + sw * 0.5 + i * sw;
      const muted = css("--muted"), grid = css("--plot-grid"), ink = css("--ink");
      ctx.font = DISP; ctx.fillStyle = muted; ctx.textAlign = "right";
      lanes.forEach((ln, j) => { ctx.fillText(ln.n, L - 8, top + j * laneH + laneH / 2 + 4); });
      /* slot grid and labels */
      ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.font = MONO; ctx.textAlign = "center";
      for(let i = 0; i < n; i++){
        const x0 = X(i); ctx.beginPath(); ctx.moveTo(x0, top - 4); ctx.lineTo(x0, h - 12); ctx.stroke();
        const sl = slots[i];
        const lab = sl.k === "S" ? (p === "i2c" ? "S" : "CS") : sl.k === "P" ? (p === "i2c" ? "P" : "CS") : (sl.lab || String(sl.v));
        ctx.fillStyle = i < shown ? (sl.owner === "t" ? css("--warn") : ink) : muted;
        ctx.fillText(lab, x0 + sw / 2, top - 12);
      }
      ctx.beginPath(); ctx.moveTo(X(n), top - 4); ctx.lineTo(X(n), h - 12); ctx.stroke();
      const yOf = (j, lv) => top + j * laneH + laneH / 2 + (lv ? -amp / 2 : amp / 2);
      const xEnd = X(shown);
      /* build waveform point lists per lane: arrays of [x, level] changes */
      const wf = lanes.map(() => []);
      const push = (j, x, lv) => wf[j].push([x, lv]);
      const x0 = L;
      if(p === "i2c"){
        push(0, x0, 1); push(1, x0, 1);
        slots.forEach((sl, i) => {
          const a = X(i), b = X(i + 1);
          if(sl.k === "S"){ push(1, a + sw * 0.4, 0); push(0, a + sw * 0.75, 0); }
          else if(sl.k === "P"){ push(1, a + sw * 0.1, 0); push(0, a + sw * 0.3, 1); push(1, a + sw * 0.65, 1); }
          else { push(1, a + sw * 0.08, sl.v); push(0, a + sw * 0.5, 1); push(0, b, 0); }
        });
      } else {
        push(0, x0, 1); push(1, x0, 0); push(2, x0, 0); push(3, x0, 0);
        slots.forEach((sl, i) => {
          const a = X(i), b = X(i + 1);
          if(sl.k === "S"){ push(0, a + sw * 0.4, 0); }
          else if(sl.k === "P"){ push(0, a + sw * 0.5, 1); push(2, a + sw * 0.1, 0); push(3, a + sw * 0.1, 0); }
          else { push(2, a + sw * 0.05, sl.v); push(3, a + sw * 0.05, sl.r); push(1, a + sw * 0.5, 1); push(1, b, 0); }
        });
      }
      lanes.forEach((ln, j) => {
        const pts = wf[j];
        ctx.strokeStyle = css(ln.c); ctx.lineWidth = 2; ctx.beginPath();
        let lv = pts[0][1]; ctx.moveTo(pts[0][0], yOf(j, lv));
        for(let i = 1; i < pts.length; i++){
          const [x, nl] = pts[i];
          if(x > xEnd){ break; }
          ctx.lineTo(x, yOf(j, lv)); ctx.lineTo(x, yOf(j, nl)); lv = nl;
        }
        ctx.lineTo(Math.max(xEnd, x0), yOf(j, lv)); ctx.stroke();
        /* shade acknowledge slots on I2C SDA */
        if(p === "i2c" && j === 1){
          ctx.fillStyle = css("--warn"); ctx.globalAlpha = 0.18;
          slots.forEach((sl, i) => { if(sl.owner === "t" && i < shown) ctx.fillRect(X(i), top + laneH * 1 + 4, sw, laneH - 8); });
          ctx.globalAlpha = 1;
        }
      });
      if(shown > 0 && shown <= n){
        ctx.strokeStyle = css("--warn"); ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(xEnd, top - 4); ctx.lineTo(xEnd, h - 12); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  });
})();
