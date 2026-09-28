(function(){
  const {plot, css, TAU} = window.AT;

  /* ---------- helpers ---------- */
  function fmtDb(v){ return isFinite(v) ? (v >= 0 ? "" : "−") + Math.abs(v).toFixed(1) + " dB" : "null (−∞ dB)"; }
  function fmtHz(f){ return f >= 1000 ? (f / 1000).toFixed(3).replace(/\.?0+$/, "") + " kHz" : Math.round(f) + " Hz"; }

  /* ---------- u1-polar: first-order polar patterns ---------- */
  AT.demo("u1-polar", {
    init(el){
      const sel = el.querySelector("#u1-polar-sel"), sl = el.querySelector("#u1-polar-a"), sc = el.querySelector("#u1-polar-scale");
      sel.addEventListener("change", () => { if(sel.value !== "custom") sl.value = sel.value; this.draw(el); });
      sl.addEventListener("input", () => {
        const a = +sl.value; let match = "custom";
        Array.from(sel.options).forEach(o => { if(o.value !== "custom" && Math.abs(+o.value - a) < 0.006) match = o.value; });
        sel.value = match; this.draw(el);
      });
      sc.addEventListener("change", () => this.draw(el));
    },
    draw(el){
      const sel = el.querySelector("#u1-polar-sel"), sl = el.querySelector("#u1-polar-a");
      const a = sel.value === "custom" ? +sl.value : +sel.value;
      const useDb = el.querySelector("#u1-polar-scale").value === "db";
      el.querySelector("#u1-polar-a-o").textContent = a.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

      const r = th => a + (1 - a) * Math.cos(th);
      const lvl = v => Math.abs(v) < 1e-9 ? -Infinity : 20 * Math.log10(Math.abs(v));
      const di = 10 * Math.log10(1 / (a * a + (1 - a) * (1 - a) / 3));
      const r180 = 2 * a - 1;
      el.querySelector("#u1-polar-r90").textContent = fmtDb(lvl(a));
      el.querySelector("#u1-polar-r180").textContent = fmtDb(lvl(r180)) + (r180 < -1e-9 ? ", inverted" : "");
      el.querySelector("#u1-polar-null").textContent = a <= 0.5 ? (Math.acos(-a / (1 - a)) * 180 / Math.PI).toFixed(0) + "°" : "none";
      el.querySelector("#u1-polar-di").textContent = di.toFixed(1) + " dB";

      const cv = el.querySelector("canvas"), w = cv.clientWidth; if(!w) return;
      const h = +(cv.dataset.h || 320), dpr = window.devicePixelRatio || 1;
      cv.style.height = h + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 26;
      const grid = css("--plot-grid"), axis = css("--plot-axis"), muted = css("--muted");
      const range = 30;
      const rho = v => useDb ? Math.max(0, (lvl(v) + range) / range) * R : Math.abs(v) * R;

      ctx.lineWidth = 1; ctx.strokeStyle = grid; ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace"; ctx.fillStyle = muted;
      const rings = useDb ? [0, -6, -12, -18, -24] : [1, 0.75, 0.5, 0.25];
      rings.forEach(v => {
        const rr = useDb ? (v + range) / range * R : v * R;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.strokeStyle = v === rings[0] ? axis : grid; ctx.stroke();
        ctx.textAlign = "left"; ctx.fillText(useDb ? (v === 0 ? "0 dB" : "−" + Math.abs(v)) : String(v), cx + 4, cy - rr + 12);
      });
      ctx.strokeStyle = grid;
      for(let d = 0; d < 360; d += 30){
        const t = d * Math.PI / 180;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.sin(t), cy - R * Math.cos(t)); ctx.stroke();
        ctx.textAlign = "center"; ctx.fillText(d + "°", cx + (R + 14) * Math.sin(t), cy - (R + 14) * Math.cos(t) + 4);
      }

      // pattern: split into in-phase (r >= 0) and inverted (r < 0) segments
      const acc = css("--accent"), red = css("--right");
      ctx.lineWidth = 2.2;
      let prevSign = null;
      for(let i = 0; i <= 720; i++){
        const t = i / 720 * TAU, v = r(t), sgn = v >= 0;
        const p = rho(v), x = cx + p * Math.sin(t), y = cy - p * Math.cos(t);
        if(sgn !== prevSign){
          if(prevSign !== null){ ctx.lineTo(x, y); ctx.stroke(); }
          ctx.beginPath(); ctx.strokeStyle = sgn ? acc : red; ctx.moveTo(x, y); prevSign = sgn;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = muted; ctx.font = "600 12px 'Schibsted Grotesk', Arial, sans-serif"; ctx.textAlign = "left";
      ctx.fillText("front (0°)", 8, 16);
      ctx.fillText(useDb ? "radius: level in dB" : "radius: |r|", 8, h - 8);
    }
  });

  /* ---------- u1-adc: sampling, aliasing and quantisation ---------- */
  AT.demo("u1-adc", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const f = +el.querySelector("#u1-adc-f").value;
      const fs = +el.querySelector("#u1-adc-fs").value;
      const bits = +el.querySelector("#u1-adc-bits").value;
      el.querySelector("#u1-adc-f-o").textContent = fmtHz(f);
      el.querySelector("#u1-adc-bits-o").textContent = bits + " bits";

      const k = Math.round(f / fs), d = f - k * fs, fa = Math.abs(d), sgn = d >= 0 ? 1 : -1;
      const levels = Math.pow(2, bits), step = 2 / levels, A = 0.9;
      const q = v => Math.max(-1, Math.min(1 - step, Math.round(v / step) * step));

      el.querySelector("#u1-adc-nyq").textContent = fmtHz(fs / 2);
      const aliased = f > fs / 2;
      el.querySelector("#u1-adc-alias").textContent = fmtHz(fa) + (aliased ? " (aliased)" : f === fs / 2 ? " (at Nyquist)" : " (correct)");
      el.querySelector("#u1-adc-lev").textContent = levels.toLocaleString("en-GB");
      el.querySelector("#u1-adc-sqnr").textContent = (6.02 * bits + 1.76).toFixed(1) + " dB";
      el.querySelector("#u1-adc-rate").textContent = (fs * bits / 1000).toFixed(1).replace(/\.0$/, "") + " kbit/s";

      const nS = 24, T = nS / fs, tms = T * 1000;
      const ax = [], ay = [], npts = 1600;
      for(let i = 0; i <= npts; i++){ const t = i / npts * T; ax.push(t * 1000); ay.push(A * Math.sin(TAU * f * t)); }
      const sx = [], sy = [], qx = [], qy = [];
      for(let n = 0; n <= nS; n++){
        const t = n / fs, v = A * Math.sin(TAU * f * t);
        sx.push(t * 1000); sy.push(v); qx.push(t * 1000); qy.push(q(v));
      }
      const rx = [], ry = [];
      for(let i = 0; i <= 400; i++){ const t = i / 400 * T; rx.push(t * 1000); ry.push(sgn * A * Math.sin(TAU * fa * t)); }

      plot(el.querySelector("canvas"), {
        xlim: [0, tms], ylim: [-1.15, 1.15], xlabel: "Time (ms)", ylabel: "Amplitude (full scale = 1)",
        series: [
          {x: ax, y: ay, color: "--plot-axis", width: 1},
          {x: rx, y: ry, color: "--left", width: 1.6, dash: [6, 4]},
          {x: qx, y: qy, color: "--accent", width: 2, step: true},
          {x: sx, y: sy, color: "--right", line: false, marker: "dot", msize: 3.2}
        ]
      });
    }
  });

  /* ---------- u1-latency: block size, latency and data rate ---------- */
  AT.demo("u1-latency", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const n = Math.pow(2, +el.querySelector("#u1-latency-n").value);
      const fs = +el.querySelector("#u1-latency-fs").value;
      const bits = +el.querySelector("#u1-latency-bits").value;
      const ch = +el.querySelector("#u1-latency-ch").value;
      const conv = +el.querySelector("#u1-latency-conv").value;
      el.querySelector("#u1-latency-n-o").textContent = n + " samples";
      el.querySelector("#u1-latency-conv-o").textContent = conv.toFixed(1) + " ms";

      const blk = 1000 * n / fs, tot = 2 * blk + conv, rate = fs * bits * ch;
      el.querySelector("#u1-latency-blk").textContent = blk.toFixed(2) + " ms";
      el.querySelector("#u1-latency-tot").textContent = tot.toFixed(2) + " ms";
      el.querySelector("#u1-latency-rate").textContent = (rate / 1000).toFixed(1).replace(/\.0$/, "") + " kbit/s";
      el.querySelector("#u1-latency-mb").textContent = (rate * 60 / 8 / 1e6).toFixed(2) + " MB";

      const xmax = Math.max(5, tot * 1.15);
      plot(el.querySelector("canvas"), {
        xlim: [0, xmax], ylim: [0, 1], xlabel: "Latency (ms)", yticks: [],
        series: [
          {x: [0, blk], y: [0.5, 0.5], color: "--left", width: 26},
          {x: [blk, 2 * blk], y: [0.5, 0.5], color: "--accent", width: 26},
          {x: [2 * blk, tot], y: [0.5, 0.5], color: "--warn", width: 26},
          {x: [10, 10], y: [0.1, 0.9], color: "--plot-axis", width: 1, dash: [4, 4], off: 0}
        ],
        labels: xmax > 10 ? [{text: "10 ms", x: 10, y: 0.9, dx: 4, dy: 4, color: "--muted"}] : []
      });
    }
  });
})();

(function(){
  "use strict";
  const {plot, heat, TAU, fft} = window.AT;

  /* ---------- shared helpers ---------- */
  const fmtHz = f => f >= 1000 ? (f/1000).toFixed(f >= 10000 ? 1 : 2) + " kHz" : Math.round(f) + " Hz";
  const logTicks = (lo, hi) => [[20,"20"],[50,"50"],[100,"100"],[200,"200"],[500,"500"],[1000,"1k"],[2000,"2k"],[5000,"5k"],[10000,"10k"],[20000,"20k"]].filter(t => t[0] >= lo && t[0] <= hi);
  const cmul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
  const cdiv = (a, b) => { const d = b[0]*b[0] + b[1]*b[1]; return [(a[0]*b[0] + a[1]*b[1])/d, (a[1]*b[0] - a[0]*b[1])/d]; };
  const cabs = a => Math.hypot(a[0], a[1]);

  /* ---------- filter maths (exposed for testing) ---------- */
  function firCoefs(type, N, fc, fs){
    const h = new Float64Array(N);
    if(type === "ma"){ h.fill(1/N); return h; }
    const M = (N - 1)/2, fn = fc/fs; let s = 0;
    for(let n = 0; n < N; n++){
      const k = n - M, sinc = k === 0 ? 2*fn : Math.sin(TAU*fn*k)/(Math.PI*k);
      const w = N > 1 ? 0.54 - 0.46*Math.cos(TAU*n/(N - 1)) : 1;
      h[n] = sinc*w; s += h[n];
    }
    for(let n = 0; n < N; n++) h[n] /= s;          // 0 dB at DC
    return h;
  }
  function firMag(h, f, fs){
    const w = TAU*f/fs; let re = 0, im = 0;
    for(let n = 0; n < h.length; n++){ re += h[n]*Math.cos(w*n); im -= h[n]*Math.sin(w*n); }
    return Math.hypot(re, im);
  }
  // Digital Butterworth low-pass by bilinear transform with pre-warping:
  // zeros all at z = -1, poles mapped from the analog prototype.
  function butterPoles(N, fc, fs){
    const W = 2*fs*Math.tan(Math.PI*fc/fs), c = 2*fs, p = [];
    for(let k = 0; k < N; k++){
      const th = Math.PI*(2*k + N + 1)/(2*N), s = [W*Math.cos(th), W*Math.sin(th)];
      p.push(cdiv([c + s[0], s[1]], [c - s[0], -s[1]]));
    }
    let K = 1; p.forEach(pk => { K *= cabs([1 - pk[0], -pk[1]])/2; });
    return {p, K};
  }
  function butterMag(bp, f, fs){
    const w = TAU*f/fs, e = [Math.cos(w), -Math.sin(w)];
    let m = bp.K;
    bp.p.forEach(pk => {
      const num = cabs([1 + e[0], e[1]]);
      const pe = cmul(pk, e), den = cabs([1 - pe[0], -pe[1]]);
      m *= num/den;
    });
    return m;
  }
  function notchMag(f, fs, f0, bw){
    const w0 = TAU*f0/fs, r = 1 - Math.PI*bw/fs, c = Math.cos(w0);
    const g = (1 - 2*r*c + r*r)/(2 - 2*c);
    const w = TAU*f/fs, z1 = [Math.cos(w), -Math.sin(w)], z2 = [Math.cos(2*w), -Math.sin(2*w)];
    const num = [1 - 2*c*z1[0] + z2[0], -2*c*z1[1] + z2[1]];
    const den = [1 - 2*r*c*z1[0] + r*r*z2[0], -2*r*c*z1[1] + r*r*z2[1]];
    return g*cabs(num)/cabs(den);
  }
  function cross3(fr, db){
    if(db[0] < -3.0103) return "below " + fmtHz(fr[0]);
    for(let i = 1; i < fr.length; i++){
      if(db[i] < -3.0103){
        const a = db[i-1], b = db[i], t = (a + 3.0103)/(a - b);
        return fmtHz(Math.pow(10, Math.log10(fr[i-1]) + t*(Math.log10(fr[i]) - Math.log10(fr[i-1]))));
      }
    }
    return "not reached";
  }
  window.AT.u1b = {firCoefs, firMag, butterPoles, butterMag, notchMag};

  /* ---------- demo: FIR vs IIR ---------- */
  AT.demo("u1-filters", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const q = s => el.querySelector(s);
      const fs = +q("#u1-filters-fs").value, nyq = fs/2;
      const fcMin = 100, fcMax = 0.45*fs;
      const fc = fcMin*Math.pow(fcMax/fcMin, +q("#u1-filters-fc").value/1000);
      const type = q("#u1-filters-type").value, N = +q("#u1-filters-n").value, ord = +q("#u1-filters-ord").value;
      const showNotch = q("#u1-filters-notch").checked;
      q("#u1-filters-fc-o").textContent = type === "ma" ? fmtHz(fc) + " (IIR only)" : fmtHz(fc);
      q("#u1-filters-n-o").textContent = N;

      const npts = 900, fr = [];
      for(let i = 0; i < npts; i++) fr.push(20*Math.pow(nyq*0.999/20, i/(npts - 1)));
      if(showNotch){ fr.push(50); fr.sort((a, b) => a - b); }
      const h = firCoefs(type, N, fc, fs), bp = butterPoles(ord, fc, fs);
      const dB = v => Math.max(-200, 20*Math.log10(v + 1e-12));
      const yF = fr.map(f => dB(firMag(h, f, fs))), yI = fr.map(f => dB(butterMag(bp, f, fs)));
      const series = [
        {x:[20, nyq], y:[-3, -3], color:"--plot-axis", width:1, dash:[4,4]},
        {x:[fc, fc], y:[-90, 10], color:"--muted", width:1, dash:[2,4]},
        {x:fr, y:yF, color:"--accent", width:2},
        {x:fr, y:yI, color:"--left", width:2}
      ];
      if(showNotch) series.push({x:fr, y:fr.map(f => dB(notchMag(f, fs, 50, 4))), color:"--warn", width:1.8});
      plot(q("canvas"), {
        xlim:[20, nyq], ylim:[-80, 5], xlog:true, xticks:logTicks(20, nyq),
        xlabel:"Frequency (Hz)", ylabel:"Magnitude (dB)", series,
        labels:[{text:"fc", x:fc, y:0, dx:4, color:"--muted"}]
      });
      q("#u1-filters-firm").textContent = N + (type === "ma" ? " (2 as running sum)" : " (" + (N + 1)/2 + " with symmetry)");
      q("#u1-filters-fir3").textContent = cross3(fr, yF);
      q("#u1-filters-fird").textContent = ((N - 1)/2) + " samples = " + ((N - 1)/2/fs*1000).toFixed(2) + " ms";
      q("#u1-filters-iirm").textContent = (2*ord + 1) + " (direct form, order " + ord + ")";
      q("#u1-filters-iir3").textContent = cross3(fr, yI);
      q("#u1-filters-nm").textContent = showNotch ? "5 (2nd-order IIR)" : "notch off";
    }
  });

  /* ---------- demo: synthetic vowel ---------- */
  const VOWELS = {a:[730, 1090, 2440], i:[270, 2290, 3010], u:[300, 870, 2240]};
  const BW = [80, 100, 120];
  function tract(f, F){                           // complex response of 3 resonances
    let H = [1, 0]; const s = [0, TAU*f];
    F.forEach((Fk, k) => {
      const p = [-Math.PI*BW[k], TAU*Fk], pc = [p[0], -p[1]];
      const num = [p[0]*p[0] + p[1]*p[1], 0];
      H = cmul(H, cdiv(num, cmul([s[0] - p[0], s[1] - p[1]], [s[0] - pc[0], s[1] - pc[1]])));
    });
    return H;
  }
  const envMag = (f, F) => (1/(1 + (f/100)*(f/100)))*(f/100)*cabs(tract(f, F));

  AT.demo("u1-vowel", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const q = s => el.querySelector(s);
      const f0 = +q("#u1-vowel-f0").value, F = VOWELS[q("#u1-vowel-v").value];
      q("#u1-vowel-f0-o").textContent = f0 + " Hz";
      const fmax = 5000;
      const ef = [], ev = [];
      for(let f = 50; f <= fmax; f += 10){ ef.push(f); ev.push(envMag(f, F)); }
      const ref = Math.max(...ev), toDb = v => 20*Math.log10(v/ref + 1e-9);
      const series = [{x:ef, y:ev.map(toDb), color:"--left", width:1.6, dash:[5,3]}];
      const hx = [], hy = [];
      for(let k = 1; k*f0 < fmax; k++){
        const d = Math.max(-60, toDb(envMag(k*f0, F)));
        series.push({x:[k*f0, k*f0], y:[-60, d], color:"--accent", width:1.8});
        hx.push(k*f0); hy.push(d);
      }
      series.push({x:hx, y:hy, color:"--accent", line:false, marker:"dot", msize:2.5});
      const cv = el.querySelectorAll("canvas");
      plot(cv[0], {
        xlim:[0, fmax], ylim:[-60, 8], xlabel:"Frequency (Hz)", ylabel:"Level (dB re peak)", series,
        labels:F.map((Fk, k) => ({text:"F" + (k + 1), x:Fk, y:Math.min(4, toDb(envMag(Fk, F)) + 4), dx:-7, color:"--left"}))
      });
      // time waveform, 30 ms at 16 kHz
      const fs = 16000, n = 480, wx = [], wy = new Float64Array(n);
      for(let k = 1; k*f0 < fmax; k++){
        const f = k*f0, H = tract(f, F), A = envMag(f, F), ph = Math.atan2(H[1], H[0]);
        for(let i = 0; i < n; i++) wy[i] += A*Math.cos(TAU*f*i/fs + ph);
      }
      let mx = 0; for(let i = 0; i < n; i++){ mx = Math.max(mx, Math.abs(wy[i])); wx.push(i/fs*1000); }
      plot(cv[1], {
        xlim:[0, 30], ylim:[-1.1, 1.1], xlabel:"Time (ms)", ylabel:"Amplitude",
        series:[{x:wx, y:Array.from(wy, v => v/mx), color:"--right", width:1.5}]
      });
      const h1 = Math.max(1, Math.round(F[0]/f0));
      q("#u1-vowel-t0").textContent = (1000/f0).toFixed(2) + " ms";
      q("#u1-vowel-sp").textContent = f0 + " Hz";
      q("#u1-vowel-nh").textContent = Math.ceil(fmax/f0) - 1;
      q("#u1-vowel-h1").textContent = "H" + h1 + " at " + (h1*f0) + " Hz (F1 " + F[0] + " Hz)";
    }
  });

  /* ---------- demo: STFT time/frequency trade-off ---------- */
  const FS = 16000, LEN = 16000, HOP = 64, NFFT = 1024, NY = 256;   // 0 to 4 kHz shown
  const sigCache = {}, specCache = {};
  function testSignal(kind){
    if(sigCache[kind]) return sigCache[kind];
    const x = new Float64Array(LEN), t0 = 0.05, t1 = 0.75, ramp = 0.01;
    let ph = 0;
    for(let i = 0; i < LEN; i++){
      const t = i/FS;
      if(t < t0 || t > t1) continue;
      const g = Math.min(1, (t - t0)/ramp, (t1 - t)/ramp), env = 0.5 - 0.5*Math.cos(Math.PI*g);
      if(kind === "glide"){
        const f0 = 120 + 140*(t - t0)/(t1 - t0);
        ph += TAU*f0/FS; let v = 0;
        for(let h = 1; h <= 12; h++) v += Math.sin(h*ph)/h;
        x[i] = env*v;
      } else {
        x[i] = env*0.5*(Math.sin(TAU*1000*t) + Math.sin(TAU*1150*t));
      }
    }
    [0.85, 0.86].forEach(tc => { const i = Math.round(tc*FS); x[i] += 4; x[i + 1] -= 4; });
    return (sigCache[kind] = x);
  }
  function stft(kind, N, win){
    const key = kind + N + win; if(specCache[key]) return specCache[key];
    const x = testSignal(kind), nx = LEN/HOP, data = new Float64Array(nx*NY);
    const w = new Float64Array(N);
    for(let n = 0; n < N; n++) w[n] = win === "rect" ? 1 : win === "hann" ? 0.5 - 0.5*Math.cos(TAU*n/(N - 1)) : 0.54 - 0.46*Math.cos(TAU*n/(N - 1));
    const re = new Float64Array(NFFT), im = new Float64Array(NFFT);
    let mx = -Infinity;
    for(let m = 0; m < nx; m++){
      re.fill(0); im.fill(0);
      const c = Math.round((m + 0.5)*HOP), s0 = c - N/2;
      for(let n = 0; n < N; n++){ const i = s0 + n; if(i >= 0 && i < LEN) re[n] = x[i]*w[n]; }
      fft(re, im);
      for(let j = 0; j < NY; j++){ const v = 10*Math.log10(re[j]*re[j] + im[j]*im[j] + 1e-20); data[m*NY + j] = v; if(v > mx) mx = v; }
    }
    for(let k = 0; k < data.length; k++) data[k] -= mx;
    return (specCache[key] = {data, nx});
  }
  AT.demo("u1-stft", {
    init(el){ el.querySelectorAll("select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const q = s => el.querySelector(s);
      const kind = q("#u1-stft-sig").value, N = +q("#u1-stft-n").value, win = q("#u1-stft-w").value;
      const S = stft(kind, N, win);
      heat(q("canvas"), {data:S.data, nx:S.nx, ny:NY, zmin:-80, zmax:0, xlim:[0, 1], ylim:[0, NY*FS/NFFT], xlabel:"Time (s)", ylabel:"Frequency (Hz)"});
      const df = FS/N;
      q("#u1-stft-dur").textContent = (N/FS*1000) + " ms (" + N + " samples)";
      q("#u1-stft-df").textContent = (Number.isInteger(df) ? df : df.toFixed(2)) + " Hz";
      q("#u1-stft-ml").textContent = ((win === "rect" ? 2 : 4)*df).toFixed(0) + " Hz";
      q("#u1-stft-hop").textContent = (HOP/FS*1000) + " ms / " + S.nx + " frames";
    }
  });

  /* ---------- plots attached to code cells ---------- */
  AT.plots["u1-resynth"] = cv => {
    const x = [], a = [], b = [];
    for(let i = 0; i <= 600; i++){ const t = i/100000; x.push(t*1000); b.push(Math.sin(TAU*500*t)); a.push(b[i] + 0.5*Math.sin(TAU*1500*t)); }
    plot(cv, {xlim:[0, 6], ylim:[-1.6, 1.6], xlabel:"Time (ms)", ylabel:"Amplitude",
      series:[{x, y:a, color:"--accent", width:1.6}, {x, y:b, color:"--right", width:1.6, dash:[5,3]}],
      labels:[{text:"input", x:0.2, y:1.35, color:"--accent"}, {text:"output (500 Hz only)", x:2.2, y:1.35, color:"--right"}]});
  };
  AT.plots["u1-plotwave"] = cv => {
    const x = [], y = [];
    for(let i = 0; i < 160; i++){ x.push(i/16); y.push(0.5*Math.sin(TAU*500*i/16000)); }
    plot(cv, {xlim:[0, 10], ylim:[-0.6, 0.6], xlabel:"Time (ms)", ylabel:"Amplitude",
      series:[{x, y, color:"--accent", width:1.6}], labels:[{text:"500 Hz tone, fs = 16 kHz", x:0.2, y:0.52}]});
  };
})();
