(function(){
  const {plot, fft} = window.AT;
  const q = (el, s) => el.querySelector(s);
  const bind = (self, el) => el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => self.draw(el)));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* 5.1 amplifier classes */
  function ampOut(cls, v){
    // v is the ideal drive in units of full scale (1 = supply limit)
    let y = v;
    if(cls === "B"){ const dz = 0.06; y = Math.sign(v) * Math.max(0, Math.abs(v) - dz); }
    // class AB: bias removes the dead zone, output follows the input
    return clamp(y, -1, 1);
  }
  function eff(cls, x){
    // x = output amplitude as a fraction of full scale (0..1); normalised Pout = x^2
    if(x <= 0) return 0;
    const p = x * x;
    if(cls === "A") return 0.25 * p;
    if(cls === "B") return Math.PI / 4 * x;
    if(cls === "AB") return p / (4 * x / Math.PI + 0.03);
    return p / (p / 0.95 + 0.02);
  }
  AT.demo("b5-1-amp", {
    init(el){ bind(this, el); },
    draw(el){
      const cls = q(el, "#b5-1-amp-cls").value;
      const lvl = +q(el, "#b5-1-amp-lvl").value / 100;
      q(el, "#b5-1-amp-lvl-o").textContent = Math.round(lvl * 100) + " % of full scale";
      const cvs = el.querySelectorAll("canvas");
      // waveform, two cycles
      const x = [], y = [], yi = [];
      const N = 400;
      for(let i = 0; i <= N; i++){ const t = i / N * 2; const v = lvl * Math.sin(2 * Math.PI * t); x.push(t); yi.push(v); y.push(ampOut(cls, v)); }
      const series = [{x, y: yi, color:"--plot-axis", width:1, dash:[4,4]}];
      if(cls === "D"){
        const px = [], py = []; const P = 24;
        for(let k = 0; k < P; k++){
          const a = k / P * 2, b = (k + 1) / P * 2, tc = (a + b) / 2;
          const d = 0.5 + 0.5 * clamp(lvl * Math.sin(2 * Math.PI * tc), -1, 1);
          const m = a + d * (b - a);
          px.push(a, a, m, m, b); py.push(-1.15, 1.15, 1.15, -1.15, -1.15);
        }
        series.push({x: px, y: py, color:"--left", width:0.8});
      }
      series.push({x, y, color:"--accent", width:2.2});
      plot(cvs[0], {xlim:[0,2], ylim:[-1.3,1.3], xlabel:"Time (cycles)", ylabel:"Output (full scale = 1)",
        xticks:[[0,"0"],[0.5,"0.5"],[1,"1"],[1.5,"1.5"],[2,"2"]], yticks:[[-1,"-1"],[0,"0"],[1,"1"]], series});
      // THD from 8 cycles, 2048 points
      const M = 2048, C = 8, re = new Float64Array(M), im = new Float64Array(M);
      for(let i = 0; i < M; i++){ re[i] = ampOut(cls, lvl * Math.sin(2 * Math.PI * C * i / M)); }
      fft(re, im);
      const mag = k => Math.hypot(re[k], im[k]);
      let h = 0; for(let k = 2 * C; k < M / 2; k += C) h += mag(k) ** 2;
      const thd = Math.sqrt(h) / mag(C) * 100;
      // efficiency curves
      const ex = []; for(let i = 1; i <= 100; i++) ex.push(i / 100);
      const col = {A:"--right", B:"--left", AB:"--warn", D:"--accent"};
      const es = ["A","B","AB","D"].map(c => ({x: ex.map(v => v * 100), y: ex.map(v => eff(c, v) * 100), color: col[c], width: c === cls ? 2.6 : 1.2}));
      const xo = Math.min(lvl, 1), e = eff(cls, xo);
      es.push({x:[xo * 100], y:[e * 100], color:"--ink", marker:"o", msize:5, line:false});
      plot(cvs[1], {xlim:[0,100], ylim:[0,100], xlabel:"Output amplitude (% of full scale)", ylabel:"Efficiency (%)", series: es,
        labels:[{text:"D", x:96, y:eff("D",0.96)*100 - 7, color:"--accent"}, {text:"B", x:96, y:eff("B",0.96)*100 - 7, color:"--left"},
                {text:"AB", x:82, y:eff("AB",0.82)*100 - 9, color:"--warn"}, {text:"A", x:96, y:eff("A",0.96)*100 + 6, color:"--right"}]});
      q(el, "#b5-1-amp-eff").textContent = (e * 100).toFixed(0) + " %";
      q(el, "#b5-1-amp-heat").textContent = (1 / e - 1).toFixed(2) + " W";
      let note = "";
      if(lvl > 1) note = " (clipping)"; else if(cls === "B" && thd > 1) note = " (crossover)";
      q(el, "#b5-1-amp-thd").textContent = (thd < 0.05 ? "< 0.05" : thd.toFixed(1)) + " %" + note;
    }
  });

  /* 5.2 filter explorer */
  const logf = (s, lo, hi) => lo * Math.pow(hi / lo, s / 100);
  function fmtF(f){ return f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2) + " kHz" : Math.round(f) + " Hz"; }
  function mag(type, f, fc, n, Q){
    if(type === "lp") return 1 / Math.sqrt(1 + Math.pow(f / fc, 2 * n));
    if(type === "hp") return 1 / Math.sqrt(1 + Math.pow(fc / f, 2 * n));
    const u = Q * Math.abs(f / fc - fc / f);
    if(type === "bp") return 1 / Math.sqrt(1 + Math.pow(u, 2 * n));
    if(u === 0) return 0;
    return 1 / Math.sqrt(1 + Math.pow(1 / u, 2 * n));
  }
  AT.demo("b5-2-filt", {
    init(el){ bind(this, el); },
    draw(el){
      const type = q(el, "#b5-2-filt-type").value;
      const fc = logf(+q(el, "#b5-2-filt-fc").value, 50, 10000);
      const n = +q(el, "#b5-2-filt-n").value;
      const Q = +q(el, "#b5-2-filt-q").value / 10;
      const fp = logf(+q(el, "#b5-2-filt-p").value, 20, 20000);
      q(el, "#b5-2-filt-fc-o").textContent = fmtF(fc);
      q(el, "#b5-2-filt-n-o").textContent = n + " (" + 6 * n + " dB/octave)";
      q(el, "#b5-2-filt-q-o").textContent = Q.toFixed(1) + (type === "bp" || type === "bs" ? "" : " (not used)");
      q(el, "#b5-2-filt-p-o").textContent = fmtF(fp);
      const x = [], y = [];
      for(let i = 0; i <= 600; i++){
        const f = 20 * Math.pow(1000, i / 600);
        x.push(f); y.push(Math.max(-80, 20 * Math.log10(Math.max(1e-6, mag(type, f, fc, n, Q)))));
      }
      const gp = 20 * Math.log10(Math.max(1e-9, mag(type, fp, fc, n, Q)));
      plot(q(el, "canvas"), {xlim:[20,20000], xlog:true, ylim:[-60,5], xlabel:"Frequency (Hz)", ylabel:"Gain (dB)",
        xticks:[[20,"20"],[50,"50"],[100,"100"],[250,"250"],[500,"500"],[1000,"1k"],[2000,"2k"],[4000,"4k"],[8000,"8k"],[20000,"20k"]],
        series:[{x:[20,20000], y:[-3,-3], color:"--plot-axis", width:1, dash:[4,4]},
                {x, y, color:"--accent", width:2.2},
                {x:[fp], y:[Math.max(-60, gp)], color:"--right", marker:"o", msize:5, line:false}]});
      q(el, "#b5-2-filt-g").textContent = gp < -80 ? "below -80 dB" : (Math.abs(gp) < 0.05 ? "0.0" : gp.toFixed(1)) + " dB";
      q(el, "#b5-2-filt-s").textContent = 6 * n + " dB/octave";
      let edges;
      if(type === "lp" || type === "hp") edges = fmtF(fc);
      else {
        const r = 1 / (2 * Q), f2 = fc * (r + Math.sqrt(r * r + 1)), f1 = fc * fc / f2;
        edges = fmtF(f1) + " and " + fmtF(f2) + " (BW " + fmtF(f2 - f1) + ")";
      }
      q(el, "#b5-2-filt-e").textContent = edges;
    }
  });

  /* 5.3 WDRC input-output */
  function ioOut(i, G, K, CR, M){ const o = i <= K ? i + G : K + G + (i - K) / CR; return Math.min(o, M); }
  AT.demo("b5-3-io", {
    init(el){ bind(this, el); },
    draw(el){
      const G = +q(el, "#b5-3-io-g").value, K = +q(el, "#b5-3-io-k").value;
      const CR = +q(el, "#b5-3-io-cr").value / 10, M = +q(el, "#b5-3-io-m").value;
      q(el, "#b5-3-io-g-o").textContent = G + " dB";
      q(el, "#b5-3-io-k-o").textContent = K + " dB SPL";
      q(el, "#b5-3-io-cr-o").textContent = CR.toFixed(1) + ":1";
      q(el, "#b5-3-io-m-o").textContent = M + " dB SPL";
      const x = [], y = [], yl = [];
      for(let i = 20; i <= 110; i += 0.5){ x.push(i); y.push(ioOut(i, G, K, CR, M)); yl.push(i + G); }
      plot(q(el, "canvas"), {xlim:[20,110], ylim:[30,140], xlabel:"Input level (dB SPL)", ylabel:"Output level (dB SPL)",
        series:[{x, y: yl, color:"--plot-axis", width:1, dash:[4,4]},
                {x:[20,110], y:[M,M], color:"--warn", width:1, dash:[2,4]},
                {x:[50,50], y:[30,140], color:"--right", width:1, dash:[3,3]},
                {x:[65,65], y:[30,140], color:"--right", width:1, dash:[3,3]},
                {x:[80,80], y:[30,140], color:"--right", width:1, dash:[3,3]},
                {x, y, color:"--accent", width:2.4},
                {x:[K], y:[ioOut(K, G, K, CR, M)], color:"--ink", marker:"o", msize:4, line:false}],
        labels:[{text:"MPO", x:24, y:M + 3, color:"--warn"}, {text:"kneepoint", x:K + 1, y:ioOut(K, G, K, CR, M) + 5, color:"--muted"}]});
      [50, 65, 80].forEach(i => { const o = ioOut(i, G, K, CR, M); q(el, "#b5-3-io-r" + i).textContent = o.toFixed(1) + " dB SPL out, gain " + (o - i).toFixed(1) + " dB"; });
    }
  });

  /* 5.4 remote microphone SNR */
  AT.demo("b5-4-snr", {
    init(el){ bind(this, el); },
    draw(el){
      const d = +q(el, "#b5-4-snr-d").value / 10, Ln = +q(el, "#b5-4-snr-n").value, rc = +q(el, "#b5-4-snr-rc").value / 10;
      const L1 = 65;
      q(el, "#b5-4-snr-d-o").textContent = d.toFixed(1) + " m";
      q(el, "#b5-4-snr-n-o").textContent = Ln + " dBA";
      q(el, "#b5-4-snr-rc-o").textContent = rc.toFixed(1) + " m";
      const Lr = L1 - 20 * Math.log10(rc);
      const x = [], yd = [], yt = [];
      for(let r = 0.5; r <= 10.001; r += 0.05){
        const Ld = L1 - 20 * Math.log10(r);
        x.push(r); yd.push(Ld - Ln); yt.push(10 * Math.log10(Math.pow(10, Ld / 10) + Math.pow(10, Lr / 10)) - Ln);
      }
      const snrRM = L1 - 20 * Math.log10(0.15) - Ln;
      const snrD = L1 - 20 * Math.log10(d) - Ln;
      plot(q(el, "canvas"), {xlim:[0.5,10], ylim:[-25,50], xlabel:"Distance from teacher (m)", ylabel:"SNR (dB)",
        series:[{x:[0.5,10], y:[15,15], color:"--plot-axis", width:1, dash:[4,4]},
                {x:[0.5,10], y:[0,0], color:"--plot-axis", width:0.8},
                {x, y: yt, color:"--warn", width:1.6},
                {x, y: yd, color:"--left", width:2},
                {x:[0.5,10], y:[snrRM, snrRM], color:"--accent", width:2.4},
                {x:[d], y:[snrD], color:"--ink", marker:"o", msize:5, line:false}],
        labels:[{text:"+15 dB target", x:7.4, y:17.5, color:"--muted"}]});
      q(el, "#b5-4-snr-r1").textContent = (snrD >= 0 ? "+" : "") + snrD.toFixed(1) + " dB";
      q(el, "#b5-4-snr-r2").textContent = (snrRM >= 0 ? "+" : "") + snrRM.toFixed(1) + " dB";
      q(el, "#b5-4-snr-r3").textContent = (snrRM - snrD).toFixed(1) + " dB";
    }
  });
})();

(function(){
  const {plot, rng, gauss} = window.AT;

  /* ---------- 5.5 Audiometer front panel ---------- */
  // Typical RETSPL (dB re 20 uPa) for the TDH-39 earphone in the 6 cm3 coupler (ISO 389-1)
  const RET = {125: 45, 250: 25.5, 500: 11.5, 1000: 7, 2000: 9, 4000: 9.5, 8000: 13};
  AT.demo("b5-5-aud", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const f = +el.querySelector("#b5-5-aud-f").value;
      const hl = +el.querySelector("#b5-5-aud-hl").value;
      const on = el.querySelector("#b5-5-aud-on").checked;
      const pul = el.querySelector("#b5-5-aud-pul").checked;
      const ret = RET[f], spl = hl + ret;
      el.querySelector("#b5-5-aud-hl-o").textContent = hl + " dB HL";
      el.querySelector("#b5-5-aud-spl").textContent = on ? spl.toFixed(1) + " dB SPL" : "no tone";
      el.querySelector("#b5-5-aud-ret").textContent = ret.toFixed(1) + " dB";
      const ratio = Math.pow(10, (hl - 110) / 20);
      const rs = ratio >= 0.001 ? ratio.toPrecision(3) : ratio.toExponential(2);
      el.querySelector("#b5-5-aud-v").textContent = rs + " (" + (hl - 110) + " dB)";
      // envelope: tone bar pressed from 250 to 1250 ms, 25 ms linear ramps, optional 225 ms on/off pulsing
      const floor = 0, ramp = 25, x = [], y = [];
      const gate = t => {
        if(!on || t < 250 || t > 1250) return 0;
        let e = Math.min(1, (t - 250) / ramp, (1250 - t) / ramp);
        if(pul){
          const k = (t - 250) % 450;
          if(k > 225) return 0;
          e = Math.min(e, k / ramp, (225 - k) / ramp);
        }
        return Math.max(0, e);
      };
      for(let t = 0; t <= 1500; t += 1){
        const e = gate(t);
        x.push(t); y.push(e > 0 ? Math.max(floor, spl + 20 * Math.log10(e)) : floor);
      }
      plot(el.querySelector("canvas"), {
        xlim:[0, 1500], ylim:[0, 140], xlabel:"Time (ms)", ylabel:"Level at earphone (dB SPL)",
        series:[
          {x:[0, 1500], y:[ret, ret], color:"--left", width:1.5, dash:[5,4]},
          {x, y, color:"--accent", width:2}
        ],
        labels:[
          {text:"0 dB HL = " + ret + " dB SPL", x:1480, y:ret, dy:-6, color:"--left", align:"right"},
          {text: on ? (pul ? "pulsed tone" : "tone bar pressed") : "tone off", x:750, y:132, color:"--muted", align:"center"}
        ]
      });
    }
  });

  /* ---------- 5.6 Tympanogram viewer ---------- */
  const TY = {
    A:  {p: -10,  y: 0.75, w: 45,  v: 1.0, peak: true},
    As: {p: -10,  y: 0.22, w: 50,  v: 1.0, peak: true},
    Ad: {p: 0,    y: 2.4,  w: 35,  v: 1.1, peak: true},
    B:  {p: -60,  y: 0.08, w: 500, v: 0.9, peak: false},
    Bl: {p: 0,    y: 0.03, w: 900, v: 3.6, peak: false},
    C:  {p: -220, y: 0.55, w: 60,  v: 1.0, peak: true}
  };
  const tympCurve = pr => {
    const lor = P => 1 / (1 + Math.pow((P - pr.p) / pr.w, 2));
    const base = lor(200), den = 1 - base;
    return P => Math.max(0, pr.y * (lor(P) - base) / den);
  };
  const anim = new WeakMap();
  AT.demo("b5-6-tymp", {
    init(el){
      const self = this, sl = el.querySelector("#b5-6-tymp-p");
      el.querySelector("#b5-6-tymp-type").addEventListener("change", () => self.draw(el));
      sl.addEventListener("input", () => { stop(); self.draw(el); });
      const stop = () => { const a = anim.get(el); if(a){ cancelAnimationFrame(a); anim.delete(el); } };
      el.querySelector("#b5-6-tymp-go").addEventListener("click", () => {
        stop();
        let t0 = null;
        const step = ts => {
          if(t0 === null) t0 = ts;
          const P = Math.max(-400, 200 - Math.round((ts - t0) * 0.2 / 5) * 5); // 200 daPa/s
          sl.value = P; self.draw(el);
          if(P > -400) anim.set(el, requestAnimationFrame(step)); else anim.delete(el);
        };
        anim.set(el, requestAnimationFrame(step));
      });
    },
    draw(el){
      const key = el.querySelector("#b5-6-tymp-type").value, pr = TY[key], Y = tympCurve(pr);
      const Pc = +el.querySelector("#b5-6-tymp-p").value;
      el.querySelector("#b5-6-tymp-p-o").textContent = Pc + " daPa";
      const xf = [], yf = [], xs = [], ys = [];
      let im = -400, ym = -1;
      for(let P = -400; P <= 200; P += 2){
        const v = Y(P); xf.push(P); yf.push(v);
        if(v > ym){ ym = v; im = P; }
        if(P >= Pc){ xs.push(P); ys.push(v); }
      }
      const yc = Y(Pc);
      el.querySelector("#b5-6-tymp-y").textContent = yc.toFixed(2) + " mmho";
      el.querySelector("#b5-6-tymp-pk").textContent = pr.peak ? ym.toFixed(2) + " mmho" : "no clear peak";
      el.querySelector("#b5-6-tymp-tpp").textContent = pr.peak ? im + " daPa" : "none";
      el.querySelector("#b5-6-tymp-vea").textContent = pr.v.toFixed(1) + " ml";
      const ytop = key === "Ad" ? 3 : 1.5;
      plot(el.querySelector("canvas"), {
        xlim:[-400, 200], ylim:[0, ytop], xlabel:"Ear canal pressure (daPa)", ylabel:"Admittance (mmho)",
        series:[
          {x:xf, y:yf, color:"--plot-axis", width:1, dash:[4,4]},
          {x:xs, y:ys, color:"--accent", width:2.5},
          {x:[Pc, Pc], y:[0, ytop], color:"--right", width:1},
          {x:[Pc], y:[yc], color:"--right", marker:"o", msize:5, line:false}
        ],
        labels:[{text:"Vea " + pr.v.toFixed(1) + " ml (subtracted)", x:190, y:ytop * 0.92, color:"--muted", align:"right"}]
      });
    }
  });

  /* ---------- 5.7 Jitter and shimmer ---------- */
  const seeds = new WeakMap();
  AT.demo("b5-7-jit", {
    init(el){
      seeds.set(el, 7);
      el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el)));
      el.querySelector("#b5-7-jit-new").addEventListener("click", () => { seeds.set(el, (seeds.get(el) || 7) + 1); this.draw(el); });
    },
    draw(el){
      const f0 = +el.querySelector("#b5-7-jit-f0").value;
      const jp = +el.querySelector("#b5-7-jit-j").value;
      const sp = +el.querySelector("#b5-7-jit-s").value;
      el.querySelector("#b5-7-jit-f0-o").textContent = f0 + " Hz";
      el.querySelector("#b5-7-jit-j-o").textContent = jp.toFixed(1) + " %";
      el.querySelector("#b5-7-jit-s-o").textContent = sp.toFixed(1) + " %";
      const r = rng(seeds.get(el) || 7), N = 20, T0 = 1000 / f0; // ms
      // mean |difference| of two independent normals = 1.128 sigma, so scale sigma to aim at the slider value
      const sj = jp / 100 / 1.128, ss = sp / 100 / 1.128;
      const T = [], A = [], tp = [0];
      for(let i = 0; i < N; i++){
        T.push(T0 * Math.max(0.7, 1 + sj * gauss(r)));
        A.push(Math.max(0.3, 1 + ss * gauss(r)));
        tp.push(tp[i] + T[i]);
      }
      const dur = tp[N], dt = 0.05, F1 = 0.7, tau = 1.0; // ms, kHz, ms
      const x = [], y = [];
      const pk = new Array(N).fill(0), pkt = new Array(N).fill(0);
      let c = 0;
      for(let t = 0; t <= dur; t += dt){
        while(c < N - 1 && t >= tp[c + 1]) c++;
        let v = 0;
        for(let k = Math.max(0, c - 3); k <= c; k++){
          const u = t - tp[k];
          if(u >= 0) v += A[k] * Math.exp(-u / tau) * Math.sin(2 * Math.PI * F1 * u);
        }
        x.push(t); y.push(v);
        if(t < tp[N] && v > pk[c]){ pk[c] = v; pkt[c] = t; }
      }
      let dT = 0, dA = 0, dB = 0, mT = 0, mA = 0;
      for(let i = 0; i < N; i++){ mT += T[i]; mA += pk[i]; }
      mT /= N; mA /= N;
      for(let i = 0; i < N - 1; i++){
        dT += Math.abs(T[i] - T[i + 1]);
        dA += Math.abs(pk[i] - pk[i + 1]);
        dB += Math.abs(20 * Math.log10(pk[i + 1] / pk[i]));
      }
      dT /= N - 1; dA /= N - 1; dB /= N - 1;
      const jit = dT / mT * 100, shim = dA / mA * 100;
      el.querySelector("#b5-7-jit-mf").textContent = (1000 / mT).toFixed(1) + " Hz";
      el.querySelector("#b5-7-jit-jo").textContent = jit.toFixed(2) + " %" + (jit > 1.04 ? " (above 1.04)" : "");
      el.querySelector("#b5-7-jit-so").textContent = shim.toFixed(2) + " %" + (shim > 3.81 ? " (above 3.81)" : "");
      el.querySelector("#b5-7-jit-sd").textContent = dB.toFixed(3) + " dB";
      plot(el.querySelector("canvas"), {
        xlim:[0, dur], ylim:[-1.6, 1.6], xlabel:"Time (ms)", ylabel:"Amplitude",
        series:[
          {x, y, color:"--accent", width:1.3},
          {x:pkt, y:pk, color:"--right", marker:"o", msize:3.5, line:false}
        ]
      });
    }
  });
})();

(function(){
  const {plot, TAU, rng, gauss} = window.AT;

  /* ---------- 5.8: A, C, Z weighting curves (IEC 61672) ---------- */
  function wA(f){
    const f2 = f*f;
    const r = (12194*12194*f2*f2) / ((f2 + 20.6*20.6) * Math.sqrt((f2 + 107.7*107.7)*(f2 + 737.9*737.9)) * (f2 + 12194*12194));
    return 20*Math.log10(r) + 2.00;
  }
  function wC(f){
    const f2 = f*f;
    const r = (12194*12194*f2) / ((f2 + 20.6*20.6) * (f2 + 12194*12194));
    return 20*Math.log10(r) + 0.06;
  }
  const sliderF = v => 10*Math.pow(2000, v/1000); /* 10 Hz to 20 kHz, log */
  const fmtF = f => f >= 1000 ? (f/1000).toFixed(f >= 10000 ? 1 : 2) + " kHz" : f.toFixed(f < 100 ? 1 : 0) + " Hz";
  const sgn = v => { const r = Math.round(v*10)/10; return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(1); };

  AT.demo("b5-8-weight", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const f = sliderF(+el.querySelector("#b5-8-weight-f").value);
      const L = +el.querySelector("#b5-8-weight-l").value;
      el.querySelector("#b5-8-weight-f-o").textContent = fmtF(f);
      el.querySelector("#b5-8-weight-l-o").textContent = L + " dB SPL";
      const x = [], ya = [], yc = [], yz = [];
      for(let i = 0; i <= 300; i++){ const fr = 10*Math.pow(2000, i/300); x.push(fr); ya.push(wA(fr)); yc.push(wC(fr)); yz.push(0); }
      const a = wA(f), c = wC(f);
      plot(el.querySelector("canvas"), {
        xlim:[10, 20000], ylim:[-70, 10], xlog:true,
        xticks:[[10,"10"],[31.5,"31.5"],[100,"100"],[250,"250"],[1000,"1k"],[4000,"4k"],[20000,"20k"]],
        xlabel:"Frequency (Hz)", ylabel:"Weighting (dB)",
        series:[
          {x, y:yz, color:"--plot-axis", width:1.5, dash:[5,4]},
          {x, y:yc, color:"--left", width:2},
          {x, y:ya, color:"--accent", width:2.2},
          {x:[f, f], y:[-70, 10], color:"--muted", width:1, dash:[2,3]},
          {x:[f], y:[a], color:"--accent", line:false, marker:"o"},
          {x:[f], y:[c], color:"--left", line:false, marker:"o"}
        ]
      });
      el.querySelector("#b5-8-weight-a").textContent = sgn(a) + " dB";
      el.querySelector("#b5-8-weight-c").textContent = sgn(c) + " dB";
      el.querySelector("#b5-8-weight-r").textContent = (L + a).toFixed(1) + " / " + (L + c).toFixed(1) + " / " + L.toFixed(1) + " dB";
    }
  });

  /* ---------- 5.8: Fast and Slow time weighting ---------- */
  AT.demo("b5-8-time", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const kind = el.querySelector("#b5-8-time-s").value;
      const dur = +el.querySelector("#b5-8-time-d").value / 1000;
      el.querySelector("#b5-8-time-d-o").textContent = Math.round(dur*1000) + " ms" + ((kind === "speech" || kind === "clap") ? " (tones only)" : "");
      const fs = 8000, T = 8, N = fs*T, dt = 1/fs;
      const Ls = 90, amp = Math.SQRT2*Math.pow(10, Ls/20);  /* pressure relative to p0 */
      const bg = Math.pow(10, 40/20);                       /* 40 dB background noise, RMS */
      const r = rng(7);
      const p = new Float64Array(N);
      /* speech-like envelope: random syllable peaks about 4 per second */
      const syl = []; if(kind === "speech"){ let t = 0.3; while(t < T - 0.3){ syl.push([t, 0.12 + 0.2*r(), -12*r()]); t += 0.18 + 0.2*r(); } }
      const claps = [1.0, 3.5, 6.0];
      for(let n = 0; n < N; n++){
        const t = n*dt; let v = bg*gauss(r);
        if(kind === "burst"){ const tt = (t - 0.5) % 2; if(t >= 0.5 && tt < dur) v += amp*Math.sin(TAU*1000*t); }
        else if(kind === "single"){ if(t >= 1 && t < 1 + dur) v += amp*Math.sin(TAU*1000*t); }
        else if(kind === "speech"){
          let e = 0;
          for(let k = 0; k < syl.length; k++){ const [t0, d, g] = syl[k]; if(t >= t0 && t < t0 + d){ e = Math.pow(10, g/20)*Math.sin(Math.PI*(t - t0)/d); break; } }
          v += e*Math.pow(10, 85/20)*gauss(r);
        }
        else { for(const tc of claps){ if(t >= tc && t < tc + 0.15) v += Math.pow(10, 115/20)*Math.exp(-(t - tc)/0.01)*gauss(r); } }
        p[n] = v;
      }
      let yF = bg*bg, yS = bg*bg, sum = 0, blk = 0, maxF = 0, maxS = 0;
      const tx = [], lst = [], lf = [], ls = [], B = fs/100;
      const aF = dt/0.125, aS = dt/1.0;
      for(let n = 0; n < N; n++){
        const q = p[n]*p[n];
        yF += aF*(q - yF); yS += aS*(q - yS); sum += q; blk += q;
        if(yF > maxF) maxF = yF; if(yS > maxS) maxS = yS;
        if((n + 1) % B === 0){ tx.push((n + 1)*dt); lst.push(10*Math.log10(blk/B)); lf.push(10*Math.log10(yF)); ls.push(10*Math.log10(yS)); blk = 0; }
      }
      const leq = 10*Math.log10(sum/N);
      plot(el.querySelector("canvas"), {
        xlim:[0, T], ylim:[30, 120], xlabel:"Time (s)", ylabel:"Level (dB)",
        series:[
          {x:tx, y:lst, color:"--plot-axis", width:1},
          {x:[0, T], y:[leq, leq], color:"--warn", width:1.5, dash:[6,4]},
          {x:tx, y:ls, color:"--left", width:2.2},
          {x:tx, y:lf, color:"--accent", width:2}
        ]
      });
      const tone = kind === "burst" || kind === "single";
      el.querySelector("#b5-8-time-ss").textContent = tone ? Ls.toFixed(1) + " dB" : "not a steady tone";
      el.querySelector("#b5-8-time-f").textContent = (10*Math.log10(maxF)).toFixed(1) + " dB";
      el.querySelector("#b5-8-time-sl").textContent = (10*Math.log10(maxS)).toFixed(1) + " dB";
      el.querySelector("#b5-8-time-eq").textContent = leq.toFixed(1) + " dB";
    }
  });

  /* ---------- 5.9: calibration worksheet calculator ---------- */
  const TABLES = {
    tdh: {unit:"dB SPL", hl:70, ref:{125:45.0,250:25.5,500:11.5,1000:7.0,2000:9.0,3000:10.0,4000:9.5,6000:15.5,8000:13.0},
          meas:{125:115.8,250:94.0,500:82.3,1000:77.4,2000:80.1,3000:79.2,4000:83.4,6000:88.0,8000:78.6}},
    er3: {unit:"dB SPL", hl:70, ref:{125:26.0,250:14.0,500:5.5,1000:0.0,2000:3.0,3000:3.5,4000:5.5,6000:2.0,8000:0.0},
          meas:{125:96.4,250:80.2,500:76.1,1000:70.3,2000:72.2,3000:74.1,4000:75.0,6000:73.6,8000:68.9}},
    b71: {unit:"dB re 1 µN", hl:40, ref:{250:67.0,500:58.0,1000:42.5,2000:31.0,3000:30.0,4000:35.5},
          meas:{250:108.9,500:97.1,1000:81.0,2000:72.8,3000:70.4,4000:74.9}}
  };
  const id = s => "b5-9-cal-m-" + s;

  AT.demo("b5-9-cal", {
    build(el){
      const key = el.querySelector("#b5-9-cal-t").value, tb = TABLES[key];
      el.querySelector("#b5-9-cal-hl").value = tb.hl;
      el.querySelector("#b5-9-cal-u").textContent = "All levels in " + tb.unit + ".";
      const body = el.querySelector("#b5-9-cal-rows"); body.innerHTML = "";
      Object.keys(tb.ref).map(Number).sort((a, b) => a - b).forEach(f => {
        const tr = document.createElement("tr");
        tr.innerHTML = '<td class="num">' + f + '</td><td class="num" data-k="ref"></td><td class="num" data-k="exp"></td>' +
          '<td><input type="number" step="0.1" class="form-control form-control-sm" style="max-width:5.5rem;min-width:4.5rem" id="' + id(f) + '" aria-label="Measured level at ' + f + ' Hz" value="' + tb.meas[f] + '"></td>' +
          '<td class="num" data-k="dev"></td><td data-k="res"></td>';
        tr.dataset.f = f; body.appendChild(tr);
        tr.querySelector("input").addEventListener("input", () => this.draw(el));
      });
    },
    init(el){
      this.build(el);
      el.querySelector("#b5-9-cal-t").addEventListener("change", () => { this.build(el); this.draw(el); });
      ["#b5-9-cal-hl", "#b5-9-cal-tl", "#b5-9-cal-th"].forEach(s => el.querySelector(s).addEventListener("input", () => this.draw(el)));
    },
    draw(el){
      const key = el.querySelector("#b5-9-cal-t").value, tb = TABLES[key];
      const hl = parseFloat(el.querySelector("#b5-9-cal-hl").value) || 0;
      const tl = Math.abs(parseFloat(el.querySelector("#b5-9-cal-tl").value) || 3);
      const th = Math.abs(parseFloat(el.querySelector("#b5-9-cal-th").value) || 5);
      const rows = Array.from(el.querySelectorAll("#b5-9-cal-rows tr"));
      const xs = [], devs = [], tolU = [], tolL = [], passX = [], passY = [], failX = [], failY = [], ticks = [];
      let nPass = 0, nTot = 0, worst = 0;
      rows.forEach((tr, i) => {
        const f = +tr.dataset.f, ref = tb.ref[f], exp = hl + ref;
        const m = parseFloat(tr.querySelector("input").value);
        const tol = f <= 4000 ? tl : th;
        tr.querySelector('[data-k="ref"]').textContent = ref.toFixed(1);
        tr.querySelector('[data-k="exp"]').textContent = exp.toFixed(1);
        ticks.push([i, f >= 1000 ? (f/1000) + "k" : String(f)]);
        tolU.push(tol); tolL.push(-tol); xs.push(i);
        if(isNaN(m)){ tr.querySelector('[data-k="dev"]').textContent = "–"; tr.querySelector('[data-k="res"]').textContent = "enter value"; return; }
        const d = Math.round((m - exp)*10)/10; nTot++;
        const ok = Math.abs(d) <= tol + 1e-9;
        tr.querySelector('[data-k="dev"]').textContent = sgn(d) + " dB";
        tr.querySelector('[data-k="res"]').textContent = ok ? "Pass" : (d > 0 ? "Fail (too loud)" : "Fail (too soft)");
        if(ok){ nPass++; passX.push(i); passY.push(d); } else { failX.push(i); failY.push(d); }
        devs.push(d); if(Math.abs(d) > Math.abs(worst)) worst = d;
      });
      const n = rows.length;
      const ymax = Math.max(8, Math.ceil(Math.max(th, tl, ...devs.map(Math.abs)) + 1));
      /* tolerance drawn as steps across each frequency slot */
      const sx = [], su = [], sl = [];
      for(let i = 0; i < n; i++){ sx.push(i - 0.5, i + 0.5); su.push(tolU[i], tolU[i]); sl.push(tolL[i], tolL[i]); }
      plot(el.querySelector("canvas"), {
        xlim:[-0.6, n - 0.4], ylim:[-ymax, ymax], xticks:ticks,
        xlabel:"Frequency (Hz)", ylabel:"Deviation (dB)",
        series:[
          {x:[-0.6, n - 0.4], y:[0, 0], color:"--plot-axis", width:1},
          {x:sx, y:su, color:"--warn", width:1.6, dash:[5,4]},
          {x:sx, y:sl, color:"--warn", width:1.6, dash:[5,4]},
          {x:passX, y:passY, color:"--accent", line:false, marker:"dot", msize:6},
          {x:failX, y:failY, color:"--right", line:false, marker:"dot", msize:7}
        ]
      });
      el.querySelector("#b5-9-cal-n").textContent = nPass + " of " + nTot;
      el.querySelector("#b5-9-cal-mx").textContent = nTot ? sgn(worst) + " dB" : "–";
      el.querySelector("#b5-9-cal-ov").textContent = nTot === 0 ? "–" : (nPass === nTot ? "Pass" : "Fail: adjust and remeasure");
    }
  });
})();
