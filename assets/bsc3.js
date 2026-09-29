(function(){
  "use strict";
  const {plot, heat, TAU, fft, rng, gauss} = window.AT;

  /* ---------- shared signal helpers (B.Sc. unit 3a) ---------- */
  const FS = 16000;
  const db = v => 20*Math.log10(Math.max(v, 1e-12));
  const fmtHz = f => f >= 1000 ? (f/1000).toFixed(2) + " kHz" : Math.round(f) + " Hz";
  const VOW = {
    a: {F:[730, 1090, 2440], B:[90, 110, 170]},
    i: {F:[270, 2290, 3010], B:[60, 100, 170]},
    u: {F:[300, 870, 2240], B:[60, 90, 170]}
  };
  // two-pole resonator (Klatt style), unity gain at DC
  function reson(x, F, B, fs){
    const T = 1/fs, c = -Math.exp(-TAU*B*T), b = 2*Math.exp(-Math.PI*B*T)*Math.cos(TAU*F*T), a = 1 - b - c;
    const y = new Float64Array(x.length); let y1 = 0, y2 = 0;
    for(let n = 0; n < x.length; n++){ const v = a*x[n] + b*y1 + c*y2; y[n] = v; y2 = y1; y1 = v; }
    return y;
  }
  function ramp(x, fs, ms){
    const nr = Math.min(Math.floor(fs*ms/1000), Math.floor(x.length/2));
    for(let i = 0; i < nr; i++){ const r = 0.5*(1 - Math.cos(Math.PI*i/nr)); x[i] *= r; x[x.length-1-i] *= r; }
    return x;
  }
  function normPeak(x, p){ let m = 0; for(const v of x) m = Math.max(m, Math.abs(v)); if(m > 0) for(let i = 0; i < x.length; i++) x[i] *= p/m; return x; }
  // synthetic vowel: glottal impulse train, glottal tilt, formant cascade, lip radiation
  function vowel(n, fs, f0a, f0b, v, amp){
    const src = new Float64Array(n); let ph = 0;
    for(let i = 0; i < n; i++){ const f0 = f0a + (f0b - f0a)*i/n; ph += f0/fs; if(ph >= 1){ ph -= 1; src[i] = 1; } }
    let g = 0;
    for(let i = 0; i < n; i++){ g = 0.9*g + src[i]; src[i] = g; }
    let y = src; const P = VOW[v];
    for(let k = 0; k < 3; k++) y = reson(y, P.F[k], P.B[k], fs);
    const out = new Float64Array(n); for(let i = 1; i < n; i++) out[i] = y[i] - y[i-1];
    return normPeak(ramp(out, fs, 25), amp);
  }
  function noise(n, seed){ const r = rng(seed), x = new Float64Array(n); for(let i = 0; i < n; i++) x[i] = gauss(r); return x; }
  function fricS(n, fs, seed, amp){
    let x = noise(n, seed); x = reson(x, 5500, 1800, fs);
    const y = new Float64Array(n); for(let i = 1; i < n; i++) y[i] = x[i] - x[i-1];
    return normPeak(ramp(y, fs, 30), amp);
  }
  // "a sa pa"-like utterance: silence, vowel, fricative, vowel, closure, burst, vowel, silence
  function utterance(fs, f0){
    const segs = [], sec = s => Math.floor(s*fs);
    segs.push(new Float64Array(sec(0.10)));
    segs.push(vowel(sec(0.25), fs, f0*1.1, f0, "a", 0.8));
    segs.push(fricS(sec(0.15), fs, 11, 0.18));
    segs.push(vowel(sec(0.20), fs, f0*1.05, f0*0.95, "a", 0.7));
    segs.push(new Float64Array(sec(0.08)));
    const nb = sec(0.015), b = noise(nb, 7); for(let i = 0; i < nb; i++) b[i] *= 0.12*Math.exp(-i/(nb/3));
    segs.push(b);
    const na = sec(0.03), asp = noise(na, 9); for(let i = 0; i < na; i++) asp[i] *= 0.04*(1 - i/na);
    segs.push(asp);
    segs.push(vowel(sec(0.18), fs, f0*0.95, f0*0.85, "a", 0.6));
    segs.push(new Float64Array(sec(0.10)));
    const tot = segs.reduce((s, a) => s + a.length, 0), x = new Float64Array(tot); let o = 0;
    segs.forEach(a => { x.set(a, o); o += a.length; });
    const r = rng(3); for(let i = 0; i < tot; i++) x[i] += 0.002*gauss(r);
    return x;
  }
  const bindAll = (el, self) => el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => self.draw(el)));
  const q = (el, id) => el.querySelector("#" + id);

  /* ---------- 3.1 waveform viewer ---------- */
  AT.demo("b3-1-wave", {
    cache: {},
    init(el){ bindAll(el, this); },
    sig(kind, f){
      const key = kind + ":" + f; if(this.cache[key]) return this.cache[key];
      const n = FS; let x;
      if(kind === "tone"){ x = new Float64Array(n); for(let i = 0; i < n; i++) x[i] = 0.7*Math.sin(TAU*f*i/FS); ramp(x, FS, 60); }
      else if(kind === "complex"){ x = new Float64Array(n); for(let i = 0; i < n; i++){ const t = i/FS; x[i] = 0.4*Math.sin(TAU*f*t) + 0.25*Math.sin(TAU*2*f*t + 0.8) + 0.15*Math.sin(TAU*3*f*t + 2.1); } ramp(x, FS, 60); }
      else if(kind === "square"){ x = new Float64Array(n); for(let i = 0; i < n; i++) x[i] = ((i*f/FS) % 1) < 0.5 ? 0.5 : -0.5; ramp(x, FS, 60); }
      else if(kind === "noise"){ x = noise(n, 5); for(let i = 0; i < n; i++) x[i] *= 0.18; ramp(x, FS, 60); }
      else if(kind === "vowel"){ x = vowel(n, FS, f, f, "a", 0.8); }
      else { x = utterance(FS, Math.min(f, 250)); }
      this.cache = {}; this.cache[key] = x; return x;
    },
    draw(el){
      const kind = q(el, "b3-1-wave-sig").value, f = +q(el, "b3-1-wave-f").value;
      const span = +q(el, "b3-1-wave-z").value, pos = +q(el, "b3-1-wave-p").value, env = q(el, "b3-1-wave-env").checked;
      q(el, "b3-1-wave-f-o").textContent = f + " Hz";
      q(el, "b3-1-wave-p-o").textContent = pos + " %";
      const x = this.sig(kind, f), dur = x.length/FS*1000;
      const t0 = Math.min(Math.max(0, pos/100*(dur - span)), Math.max(0, dur - span)), t1 = Math.min(dur, t0 + span);
      const i0 = Math.floor(t0*FS/1000), i1 = Math.floor(t1*FS/1000);
      const tx = [], ty = []; let pk = 0, ss = 0;
      for(let i = i0; i < i1; i++){ tx.push(i*1000/FS); ty.push(x[i]); pk = Math.max(pk, Math.abs(x[i])); ss += x[i]*x[i]; }
      const rms = Math.sqrt(ss/Math.max(1, i1 - i0));
      const series = [{x:tx, y:ty, color:"--accent", width:1.3}];
      if(rms > 1e-4){ series.push({x:[t0,t1], y:[rms,rms], color:"--right", width:1.2, dash:[5,4]}, {x:[t0,t1], y:[-rms,-rms], color:"--right", width:1.2, dash:[5,4]}); }
      if(env){
        const w = Math.floor(0.010*FS), ex = [], ey = [], ey2 = [];
        for(let s = i0; s + w <= i1; s += Math.max(1, Math.floor(w/4))){ let e = 0; for(let k = s; k < s + w; k++) e += x[k]*x[k]; e = Math.sqrt(e/w)*Math.SQRT2; ex.push((s + w/2)*1000/FS); ey.push(e); ey2.push(-e); }
        series.push({x:ex, y:ey, color:"--left", width:2}, {x:ex, y:ey2, color:"--left", width:2});
      }
      plot(q(el, "b3-1-wave-cv"), {xlim:[t0, t1], ylim:[-1, 1], xlabel:"Time (ms)", ylabel:"Amplitude (full scale = 1)", series});
      const periodic = ["tone", "complex", "square", "vowel"].includes(kind);
      q(el, "b3-1-wave-pk").textContent = pk.toFixed(3) + " (" + db(pk).toFixed(1) + " dBFS)";
      q(el, "b3-1-wave-rms").textContent = rms < 1e-4 ? "silence" : rms.toFixed(3) + " (" + db(rms).toFixed(1) + " dBFS)";
      q(el, "b3-1-wave-cf").textContent = rms < 1e-4 ? "n/a" : (pk/rms).toFixed(2) + " (" + db(pk/rms).toFixed(1) + " dB)";
      q(el, "b3-1-wave-per").textContent = periodic ? (1000/f).toFixed(2) + " ms (" + f + " Hz)" : "aperiodic parts: no single period";
    }
  });

  /* ---------- 3.2 Fourier synthesis ---------- */
  function harmAmps(pat, N, f0){
    const a = [], ph = [];
    for(let n = 1; n <= N; n++){
      let v = 0, p = 0;
      if(pat === "saw") v = 1/n;
      else if(pat === "square") v = n % 2 ? 1/n : 0;
      else if(pat === "tri"){ v = n % 2 ? 1/(n*n) : 0; p = ((n - 1)/2) % 2 ? Math.PI : 0; }
      else if(pat === "equal") v = 1/Math.sqrt(N);
      else { const f = n*f0; let e = 0; VOW.a.F.forEach((F, k) => { const B = VOW.a.B[k]*1.6; e += [1, 0.8, 0.35][k]/(1 + Math.pow((f - F)/B, 2)); }); v = (0.15 + e)/Math.sqrt(n); }
      a.push(v); ph.push(p);
    }
    return {a, ph};
  }
  AT.demo("b3-2-harm", {
    init(el){ bindAll(el, this); },
    draw(el){
      const f0 = +q(el, "b3-2-harm-f0").value, N = +q(el, "b3-2-harm-n").value, pat = q(el, "b3-2-harm-pat").value;
      const rand = q(el, "b3-2-harm-ph").value === "rand", dB = q(el, "b3-2-harm-sc").value === "db";
      q(el, "b3-2-harm-f0-o").textContent = f0 + " Hz"; q(el, "b3-2-harm-n-o").textContent = N;
      const {a, ph} = harmAmps(pat, N, f0);
      const r = rng(42); if(rand) for(let k = 0; k < N; k++) ph[k] = TAU*r();
      // normalise so that the waveform peak fits
      const fsw = 48000, dur = 0.02, n = Math.floor(fsw*dur), tx = new Array(n), ty = new Float64Array(n);
      let pk = 0;
      for(let i = 0; i < n; i++){ const t = i/fsw; let s = 0; for(let k = 0; k < N; k++) if(a[k]) s += a[k]*Math.sin(TAU*(k + 1)*f0*t + ph[k]); ty[i] = s; tx[i] = t*1000; pk = Math.max(pk, Math.abs(s)); }
      const g = pk > 0 ? 0.9/pk : 1; for(let i = 0; i < n; i++) ty[i] *= g;
      const amps = a.map(v => v*g);
      const series = [{x:tx, y:Array.from(ty), color:"--accent", width:1.8}];
      if(N > 1 && a[0]){ const fx = [], fy = []; for(let i = 0; i < n; i += 4){ fx.push(tx[i]); fy.push(amps[0]*Math.sin(TAU*f0*i/fsw + ph[0])); } series.push({x:fx, y:fy, color:"--left", width:1.2, dash:[4,4]}); }
      plot(q(el, "b3-2-harm-w"), {xlim:[0, 20], ylim:[-1, 1], xlabel:"Time (ms)", ylabel:"Amplitude", series});
      const fmax = Math.max(1000, Math.ceil((N + 1)*f0/500)*500), ss = [];
      const amax = Math.max(...amps);
      amps.forEach((v, k) => {
        if(!v) return; const f = (k + 1)*f0;
        const y = dB ? 20*Math.log10(v/amax) : v;
        ss.push({x:[f, f], y:[dB ? -60 : 0, Math.max(y, dB ? -60 : 0)], color: k ? "--accent" : "--right", width:2.5, marker:"dot", msize:3});
      });
      plot(q(el, "b3-2-harm-s"), {xlim:[0, fmax], ylim: dB ? [-60, 5] : [0, Math.max(0.1, amax*1.15)], xlabel:"Frequency (Hz)", ylabel: dB ? "Level re strongest (dB)" : "Amplitude", series:ss});
      const rms = Math.sqrt(amps.reduce((s, v) => s + v*v/2, 0));
      const top = amps.reduce((m, v, k) => v ? (k + 1)*f0 : m, f0);
      q(el, "b3-2-harm-T").textContent = (1000/f0).toFixed(2) + " ms";
      q(el, "b3-2-harm-top").textContent = fmtHz(top);
      q(el, "b3-2-harm-cnt").textContent = amps.filter(v => v).length;
      q(el, "b3-2-harm-rms").textContent = rms.toFixed(3);
    }
  });

  /* ---------- 3.3 spectrogram ---------- */
  AT.demo("b3-3-spec", {
    cache: {},
    init(el){ bindAll(el, this); },
    sig(kind){
      if(this.cache[kind]) return this.cache[kind];
      let x;
      if(kind === "chirp"){
        const n = Math.floor(1.2*FS); x = new Float64Array(n); let ph = 0;
        for(let i = 0; i < n; i++){ const f = 200 + (4000 - 200)*i/n; ph += TAU*f/FS; x[i] = 0.6*Math.sin(ph); }
        ramp(x, FS, 20);
      } else if(kind === "vowels"){
        const seg = Math.floor(0.33*FS), gap = Math.floor(0.05*FS), parts = [new Float64Array(gap)];
        [["a", 140, 128], ["i", 128, 115], ["u", 115, 100]].forEach(([v, fa, fb]) => { parts.push(vowel(seg, FS, fa, fb, v, 0.8)); parts.push(new Float64Array(gap)); });
        const tot = parts.reduce((s, a) => s + a.length, 0); x = new Float64Array(tot); let o = 0; parts.forEach(a => { x.set(a, o); o += a.length; });
      } else { x = utterance(FS, 130); }
      this.cache[kind] = x; return x;
    },
    draw(el){
      const kind = q(el, "b3-3-spec-sig").value, wms = +q(el, "b3-3-spec-win").value, dr = +q(el, "b3-3-spec-dr").value;
      const x = this.sig(kind), W = Math.round(wms*FS/1000);
      let nfft = 512; while(nfft < W) nfft *= 2;
      const hop = Math.floor(0.004*FS), nx = Math.max(1, Math.floor((x.length - W)/hop) + 1), ny = 200, fmax = 8000;
      const win = new Float64Array(W); for(let i = 0; i < W; i++) win[i] = 0.5 - 0.5*Math.cos(TAU*i/(W - 1));
      const data = new Float64Array(nx*ny), re = new Float64Array(nfft), im = new Float64Array(nfft);
      let mx = -300;
      for(let c = 0; c < nx; c++){
        re.fill(0); im.fill(0); const s = c*hop;
        for(let i = 0; i < W; i++) re[i] = x[s + i]*win[i];
        fft(re, im);
        for(let j = 0; j < ny; j++){
          const f = (j + 0.5)*fmax/ny, k = Math.min(nfft/2, Math.round(f*nfft/FS));
          const v = 10*Math.log10(re[k]*re[k] + im[k]*im[k] + 1e-14); data[c*ny + j] = v; if(v > mx) mx = v;
        }
      }
      const dur = (nx - 1)*hop/FS + W/FS;
      heat(q(el, "b3-3-spec-cv"), {data, nx, ny, zmin:mx - dr, zmax:mx, xlim:[W/2/FS, W/2/FS + (nx - 1)*hop/FS], ylim:[0, fmax], xlabel:"Time (s)", ylabel:"Frequency (Hz)"});
      const bw = 1.44/(wms/1000);
      q(el, "b3-3-spec-wd").textContent = wms + " ms (" + W + " samples)";
      q(el, "b3-3-spec-bw").textContent = "about " + Math.round(bw) + " Hz";
      q(el, "b3-3-spec-ty").textContent = bw > 200 ? "wideband" : bw < 80 ? "narrowband" : "in between";
      q(el, "b3-3-spec-du").textContent = dur.toFixed(2) + " s";
    }
  });

  /* ---------- 3.4 file size ---------- */
  AT.demo("b3-4-size", {
    init(el){ bindAll(el, this); },
    draw(el){
      const fs = +q(el, "b3-4-size-fs").value, bits = +q(el, "b3-4-size-bd").value, ch = +q(el, "b3-4-size-ch").value;
      const min = +q(el, "b3-4-size-t").value; q(el, "b3-4-size-t-o").textContent = min + " min";
      const sec = min*60, pcm = fs*bits*ch;                  // bit/s
      // MP3 bit rates are total rates for the file, whatever the channel count
      const sizes = [pcm*sec/8, 0.6*pcm*sec/8, 320000*sec/8, 128000*sec/8];
      const mb = sizes.map(b => b/1e6);
      const ymax = Math.max(...mb)*1.2, series = [];
      const cols = ["--accent", "--left", "--warn", "--right"];
      mb.forEach((v, k) => series.push({x:[k + 1, k + 1], y:[0, v], color:cols[k], width:26}));
      plot(q(el, "b3-4-size-cv"), {xlim:[0.4, 4.6], ylim:[0, ymax], xticks:[[1, "WAV"], [2, "FLAC"], [3, "MP3 320k"], [4, "MP3 128k"]], ylabel:"File size (MB)", series,
        labels: mb.map((v, k) => ({text: v >= 100 ? v.toFixed(0) : v.toFixed(1), x:k + 1, y:v, dy:-6, align:"center", color:"--ink"}))});
      q(el, "b3-4-size-rate").textContent = (pcm/1000).toFixed(1) + " kbit/s";
      q(el, "b3-4-size-wav").textContent = mb[0].toFixed(mb[0] < 10 ? 2 : 1) + " MB";
      q(el, "b3-4-size-ny").textContent = fmtHz(fs/2);
      q(el, "b3-4-size-dr").textContent = bits === 32 ? "over 140 dB (floating point)" : (6.02*bits + 1.76).toFixed(1) + " dB";
    }
  });

  /* ---------- 3.4 gain staging ---------- */
  AT.demo("b3-4-gain", {
    sp: null,
    init(el){ bindAll(el, this); },
    draw(el){
      if(!this.sp){
        const u = utterance(FS, 130); let ss = 0, n = 0;
        for(const v of u) if(Math.abs(v) > 0.01){ ss += v*v; n++; }
        const r = Math.sqrt(ss/n); this.sp = u.map(v => v/r);   // active-speech RMS = 1
        const rr = rng(21); this.nz = Float64Array.from({length:u.length}, () => gauss(rr));
      }
      const gain = +q(el, "b3-4-gain-g").value, dcm = +q(el, "b3-4-gain-d").value;
      const lvl = +q(el, "b3-4-gain-v").value, room = +q(el, "b3-4-gain-r").value;
      q(el, "b3-4-gain-g-o").textContent = gain + " dB"; q(el, "b3-4-gain-d-o").textContent = dcm + " cm";
      const spl = lvl - 20*Math.log10(dcm/100);
      const OFF = 132;
      const sDb = spl + gain - OFF, nDbRoom = room + gain - OFF, nDb = 10*Math.log10(Math.pow(10, nDbRoom/10) + Math.pow(10, -96/10));
      const sA = Math.pow(10, sDb/20), nA = Math.pow(10, nDb/20);
      const x = this.sp, N = x.length, step = 2, tx = [], ty = []; let clip = 0, pk = 0;
      for(let i = 0; i < N; i++){ let v = sA*x[i] + nA*this.nz[i]; if(Math.abs(v) >= 1){ clip++; v = Math.sign(v); } pk = Math.max(pk, Math.abs(v)); if(i % step === 0){ tx.push(i/FS); ty.push(v); } }
      const T = N/FS, L = (y, c, d) => ({x:[0, T], y:[y, y], color:c, width:1, dash:d});
      plot(q(el, "b3-4-gain-cv"), {xlim:[0, T], ylim:[-1.1, 1.1], xlabel:"Time (s)", ylabel:"Recorded sample value",
        series:[{x:tx, y:ty, color:"--accent", width:1}, L(1, "--right", []), L(-1, "--right", []), L(0.5, "--warn", [5,4]), L(-0.5, "--warn", [5,4]), L(0.25, "--plot-axis", [2,4]), L(-0.25, "--plot-axis", [2,4])],
        labels:[{text:"0 dBFS (clipping)", x:0.02, y:1.0, dy:-4, color:"--right"}, {text:"-6 dBFS", x:0.02, y:0.5, dy:-4, color:"--warn"}, {text:"-12 dBFS", x:0.02, y:0.25, dy:-4, color:"--muted"}]});
      const pct = 100*clip/N, snr = sDb - nDb;
      q(el, "b3-4-gain-spl").textContent = spl.toFixed(1) + " dB SPL";
      q(el, "b3-4-gain-pk").textContent = db(pk).toFixed(1) + " dBFS";
      q(el, "b3-4-gain-sn").textContent = snr.toFixed(1) + " dB";
      let st;
      if(pct > 0.01) st = "Clipping (" + pct.toFixed(2) + " % of samples): lower the gain";
      else if(db(pk) < -20) st = "Too quiet: raise the gain or move closer";
      else if(db(pk) > -3) st = "Very hot: little headroom, lower the gain a little";
      else st = "Good: peaks have headroom";
      if(snr < 30) st += "; SNR below 30 dB: reduce noise or move closer";
      q(el, "b3-4-gain-st").textContent = st;
    }
  });
})();

(function(){
  "use strict";
  const {plot, TAU, rng, gauss, fft} = window.AT;
  const q = (el, id) => el.querySelector("#" + id);
  const hook = (el, self) => el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => self.draw(el)));
  const fmtHz = f => f >= 1000 ? (f/1000).toFixed(2).replace(/\.?0+$/, "") + " kHz" : Math.round(f) + " Hz";

  /* ---------- 3.5 signal through the chain ---------- */
  // Input: vowel-like 250 Hz harmonics plus an unwanted 11 kHz tone (volts after preamp).
  const COMP = [[250, 0.35, 0], [500, 0.21, 0.6], [750, 0.14, 1.1], [1000, 0.08, 2.0], [11000, 0.08, 0.3]];
  const MIC_GAIN = 100;      // preamp gain (40 dB): mic output is 1/100 of this
  const FS_V = 1.0;          // ADC full scale +/- 1 V
  AT.demo("b3-5-chain", {
    init(el){ hook(el, this); },
    draw(el){
      const st = +q(el, "b3-5-chain-st").value;
      const fs = +q(el, "b3-5-chain-fs").value * 1000;
      const nb = +q(el, "b3-5-chain-nb").value;
      const gdb = +q(el, "b3-5-chain-g").value;
      const aa = q(el, "b3-5-chain-aa").checked;
      q(el, "b3-5-chain-fs-o").textContent = fs/1000 + " kHz";
      q(el, "b3-5-chain-nb-o").textContent = nb + " bits";
      q(el, "b3-5-chain-g-o").textContent = (gdb > 0 ? "+" : "") + gdb + " dB";
      const fc = 0.45*fs, order = 8;
      const aaGain = f => aa ? 1/Math.sqrt(1 + Math.pow(f/fc, 2*order)) : 1;
      const pre = t => COMP.reduce((s, c) => s + c[1]*Math.sin(TAU*c[0]*t + c[2]), 0);
      const filt = t => COMP.reduce((s, c) => s + aaGain(c[0])*c[1]*Math.sin(TAU*c[0]*t + c[2]), 0);
      const T = 0.006, nf = 900, tx = [], ref = [];
      for(let i = 0; i <= nf; i++){ const t = T*i/nf; tx.push(t*1000); ref.push(pre(t)); }
      const levels = Math.pow(2, nb), step = 2*FS_V/levels;
      const quant = v => { let k = Math.round(v/step); k = Math.max(-levels/2, Math.min(levels/2 - 1, k)); return k*step; };
      const g = Math.pow(10, gdb/20);
      const clip = v => Math.max(-FS_V, Math.min(FS_V - step, v));
      // samples over a wider span for reconstruction
      const n0 = Math.floor(-0.004*fs), n1 = Math.ceil((T + 0.004)*fs);
      const sIdx = [], sRaw = [], sQ = [], sP = [];
      for(let n = n0; n <= n1; n++){
        const v = filt(n/fs); sIdx.push(n); sRaw.push(v);
        const qv = quant(v); sQ.push(qv); sP.push(clip(qv*g));
      }
      const inWin = n => n/fs >= 0 && n/fs <= T;
      const sx = [], sy = [], stx = [], sty = [];
      const pick = st <= 3 ? sRaw : st === 4 ? sQ : sP;
      sIdx.forEach((n, i) => { if(inWin(n)){ sx.push(n/fs*1000); sy.push(pick[i]); } });
      // staircase: hold each value until the next sample
      sIdx.forEach((n, i) => { if(n/fs >= -1/fs && n/fs <= T){ stx.push(Math.max(0, n/fs*1000)); sty.push(pick[i]); } });
      stx.push(T*1000); sty.push(sty[sty.length - 1]);
      let series = [], ylim = [-1.4, 1.4], ylabel = "Voltage (V)";
      const refS = {x: tx, y: ref, color: "--plot-axis", width: 1, dash: [4, 4]};
      if(st === 0){
        series = [{x: tx, y: ref.map(v => v*1000/MIC_GAIN), color: "--accent", width: 1.8}];
        ylim = [-10, 10]; ylabel = "Voltage (mV)";
      } else if(st === 1){
        series = [{x: tx, y: ref, color: "--accent", width: 1.8}];
      } else if(st === 2){
        series = [refS, {x: tx, y: tx.map(t => filt(t/1000)), color: "--accent", width: 1.8}];
      } else if(st === 3 || st === 4 || st === 6){
        series = [refS, {x: stx, y: sty, color: "--accent", width: 1.8, step: true}, {x: sx, y: sy, color: "--right", line: false, marker: "dot", msize: 2.5}];
      } else if(st === 5){
        series = [refS, {x: sx, y: sy, color: "--right", line: false, marker: "dot", msize: 3}];
      } else {
        // ideal band-limited (sinc) reconstruction of the processed samples
        const ry = tx.map(tm => { const t = tm/1000; let s = 0;
          for(let i = 0; i < sIdx.length; i++){ const u = fs*t - sIdx[i]; s += sP[i]*(Math.abs(u) < 1e-9 ? 1 : Math.sin(Math.PI*u)/(Math.PI*u)); }
          return s; });
        series = [refS, {x: tx, y: ry, color: "--accent", width: 1.8}];
      }
      const lbl = st >= 5 && g > 1.01 ? [{text: "full scale", x: 0.1, y: FS_V, dy: -4, color: "--muted"}] : [];
      if(st >= 5) series.push({x: [0, T*1000], y: [FS_V, FS_V], color: "--warn", width: 1, dash: [2, 3]}, {x: [0, T*1000], y: [-FS_V, -FS_V], color: "--warn", width: 1, dash: [2, 3]});
      plot(el.querySelector("canvas"), {xlim: [0, T*1000], ylim, xlabel: "Time (ms)", ylabel, series, labels: lbl});
      q(el, "b3-5-chain-ny").textContent = fmtHz(fs/2);
      q(el, "b3-5-chain-q").textContent = (step*1000).toFixed(step*1000 < 10 ? 2 : 1) + " mV";
      q(el, "b3-5-chain-sq").textContent = (6.02*nb + 1.76).toFixed(1) + " dB";
      const f = 11000;
      let al;
      if(f < fs/2) al = aa ? "passes (below Nyquist), " + (20*Math.log10(aaGain(f))).toFixed(1) + " dB" : "passes (below Nyquist)";
      else {
        const alias = Math.abs(f - Math.round(f/fs)*fs);
        al = aa ? "filtered out (" + (20*Math.log10(aaGain(f))).toFixed(0) + " dB)" : "aliases to " + fmtHz(alias);
      }
      q(el, "b3-5-chain-al").textContent = al;
    }
  });

  /* ---------- 3.6 analogue vs digital copying ---------- */
  const CP_FS = 48000, CP_N = 960;   // 20 ms
  const cpOrig = new Float64Array(CP_N);
  for(let n = 0; n < CP_N; n++){ const t = n/CP_FS;
    cpOrig[n] = 0.5*Math.sin(TAU*200*t) + 0.25*Math.sin(TAU*400*t + 0.5) + 0.15*Math.sin(TAU*1200*t + 1) + 0.08*Math.sin(TAU*3000*t + 2); }
  const cpRms = Math.sqrt(cpOrig.reduce((s, v) => s + v*v, 0)/CP_N);
  const cpDig = cpOrig.map(v => Math.round(v*32767)/32767);
  const snr = (a, b) => { let e = 0, s = 0; for(let i = 0; i < a.length; i++){ e += (a[i] - b[i])**2; s += b[i]*b[i]; } return 10*Math.log10(s/e); };
  AT.demo("b3-6-copy", {
    init(el){ hook(el, this); },
    draw(el){
      const N = +q(el, "b3-6-copy-n").value, s1 = +q(el, "b3-6-copy-s").value, hf = q(el, "b3-6-copy-hf").checked;
      q(el, "b3-6-copy-n-o").textContent = N;
      q(el, "b3-6-copy-s-o").textContent = s1 + " dB";
      const sd = cpRms*Math.pow(10, -s1/20), r = rng(1234);
      let x = Float64Array.from(cpOrig);
      const a = 1 - Math.exp(-TAU*8000/CP_FS);   // gentle one-pole treble loss per copy
      for(let g = 0; g < N; g++){
        if(hf){ let y = x[0]; for(let n = 0; n < CP_N; n++){ y = a*x[n] + (1 - a)*y; x[n] = y; } }
        for(let n = 0; n < CP_N; n++) x[n] += sd*gauss(r);
      }
      const t = Array.from({length: CP_N}, (_, i) => i/CP_FS*1000);
      const cv = el.querySelectorAll("canvas");
      const base = {xlim: [0, 20], ylim: [-1.3, 1.3], xlabel: "Time (ms)", ylabel: "Amplitude"};
      plot(cv[0], Object.assign({}, base, {series: [{x: t, y: Array.from(x), color: "--right", width: 1.3}, {x: t, y: Array.from(cpOrig), color: "--plot-axis", width: 1, dash: [4, 4]}],
        labels: [{text: "Analogue copy, generation " + N, x: 0.4, y: 1.1, color: "--ink"}]}));
      plot(cv[1], Object.assign({}, base, {series: [{x: t, y: Array.from(cpOrig), color: "--plot-axis", width: 1, dash: [4, 4]}, {x: t, y: Array.from(cpDig), color: "--accent", width: 1.5}],
        labels: [{text: "Digital copy, generation " + N + " (identical to generation 1)", x: 0.4, y: 1.1, color: "--ink"}]}));
      q(el, "b3-6-copy-p").textContent = (s1 - 10*Math.log10(N)).toFixed(1) + " dB";
      q(el, "b3-6-copy-m").textContent = snr(x, cpOrig).toFixed(1) + " dB";
      q(el, "b3-6-copy-d").textContent = snr(cpDig, cpOrig).toFixed(1) + " dB";
    }
  });

  /* ---------- 3.7 averaging ---------- */
  const AV_M = 200, AV_T = 10;
  const avT = Array.from({length: AV_M}, (_, i) => i*AV_T/(AV_M - 1));
  const abr = t => 0.15*Math.exp(-(((t - 1.6)/0.25)**2)) + 0.12*Math.exp(-(((t - 3.7)/0.3)**2)) + 0.5*Math.exp(-(((t - 5.6)/0.35)**2)) - 0.3*Math.exp(-(((t - 6.6)/0.6)**2));
  const avTrue = avT.map(abr);
  let avCache = {key: "", y: null};
  AT.demo("b3-7-avg", {
    init(el){ hook(el, this); },
    draw(el){
      const k = +q(el, "b3-7-avg-k").value, sig = +q(el, "b3-7-avg-s").value, N = Math.pow(2, k);
      q(el, "b3-7-avg-k-o").textContent = N;
      q(el, "b3-7-avg-s-o").textContent = sig + " µV RMS";
      const key = k + "_" + sig;
      if(avCache.key !== key){
        const r = rng(777), acc = new Float64Array(AV_M);
        for(let s = 0; s < N; s++) for(let i = 0; i < AV_M; i++) acc[i] += avTrue[i] + sig*gauss(r);
        avCache = {key, y: Array.from(acc, v => v/N)};
      }
      const y = avCache.y;
      let e = 0; for(let i = 0; i < AV_M; i++) e += (y[i] - avTrue[i])**2;
      const res = Math.sqrt(e/AV_M);
      const lim = Math.max(1, Math.min(60, Math.max(...y.map(Math.abs))*1.1));
      plot(el.querySelector("canvas"), {xlim: [0, AV_T], ylim: [-lim, lim], xlabel: "Time after click (ms)", ylabel: "Voltage (µV)",
        series: [{x: avT, y, color: "--accent", width: 1.6}, {x: avT, y: avTrue, color: "--plot-axis", width: 1.2, dash: [4, 3]}],
        labels: [{text: "V", x: 5.6, y: 0.5, dy: -8, color: "--muted"}]});
      q(el, "b3-7-avg-p").textContent = (sig/Math.sqrt(N)).toFixed(3) + " µV";
      q(el, "b3-7-avg-m").textContent = res.toFixed(3) + " µV";
      q(el, "b3-7-avg-g").textContent = (10*Math.log10(N)).toFixed(1) + " dB";
      q(el, "b3-7-avg-r").textContent = (0.5/res).toFixed(2);
    }
  });

  /* ---------- 3.8 energy, ZCR, V/UV/S ---------- */
  const SF = 8000, SL = SF;   // 1 s at 8 kHz
  const utt = (function(){
    const x = new Float64Array(SL), r = rng(42);
    let prev = 0;
    for(let n = 0; n < SL; n++){
      const t = n/SF; let v = 0.002*gauss(r);
      const vowel = (t0, t1, f0) => {
        if(t < t0 || t > t1) return 0;
        const env = Math.min(1, (t - t0)/0.03, (t1 - t)/0.03);
        let s = 0; for(let k = 1; k*f0 < 3500; k++) s += Math.sin(TAU*k*f0*t)/k;
        return 0.25*env*s;
      };
      v += vowel(0.10, 0.35, 120) + vowel(0.60, 0.85, 200);
      if(t >= 0.37 && t <= 0.50){
        const w = gauss(r), hp = w - prev; prev = w;
        const env = Math.min(1, (t - 0.37)/0.02, (0.50 - t)/0.02);
        v += 0.05*env*hp;
      }
      x[n] = v;
    }
    return x;
  })();
  function acF0(x, s, N){
    const kmin = Math.floor(SF/400), kmax = Math.min(Math.floor(SF/60), N - 1);
    let r0 = 0; for(let n = 0; n < N; n++) r0 += x[s + n]**2;
    let best = -Infinity, bk = 0;
    for(let k = kmin; k <= kmax; k++){ let r = 0; for(let n = 0; n + k < N; n++) r += x[s + n]*x[s + n + k]; if(r > best){ best = r; bk = k; } }
    return {f0: SF/bk, k: bk, strength: best/(r0/N)};
  }
  AT.demo("b3-8-ste", {
    init(el){ hook(el, this); },
    draw(el){
      const fl = +q(el, "b3-8-ste-fl").value, et = +q(el, "b3-8-ste-et").value, zt = +q(el, "b3-8-ste-zt").value;
      q(el, "b3-8-ste-fl-o").textContent = fl + " ms";
      q(el, "b3-8-ste-et-o").textContent = et + " dB";
      q(el, "b3-8-ste-zt-o").textContent = zt + " /s";
      const N = Math.round(fl/1000*SF), H = Math.round(N/2);
      const w = Array.from({length: N}, (_, n) => 0.54 - 0.46*Math.cos(TAU*n/(N - 1)));
      const wp = w.reduce((s, v) => s + v*v, 0)/N;
      const ft = [], E = [], Z = [], D = [];
      let cnt = [0, 0, 0];
      for(let s = 0; s + N <= SL; s += H){
        let e = 0, z = 0;
        for(let n = 0; n < N; n++){ const v = utt[s + n]*w[n]; e += v*v;
          if(n && ((utt[s + n] >= 0) !== (utt[s + n - 1] >= 0))) z++; }
        const edb = 10*Math.log10(e/N/wp + 1e-12), zr = z/(N/SF);
        const d = edb < et ? 0 : zr >= zt ? 1 : 2;
        cnt[d]++;
        ft.push((s + N/2)/SF); E.push(edb); Z.push(zr); D.push(d);
      }
      const cv = el.querySelectorAll("canvas");
      const tw = [], xw = [];
      for(let n = 0; n < SL; n += 2){ tw.push(n/SF); xw.push(utt[n]); }
      plot(cv[0], {xlim: [0, 1], ylim: [-0.6, 0.6], ylabel: "Amplitude", series: [{x: tw, y: xw, color: "--accent", width: 1}],
        labels: [{text: "vowel 1", x: 0.17, y: 0.48, color: "--muted"}, {text: "/s/", x: 0.42, y: 0.48, color: "--muted"}, {text: "vowel 2", x: 0.67, y: 0.48, color: "--muted"}]});
      plot(cv[1], {xlim: [0, 1], ylim: [-70, 0], ylabel: "Energy (dB)", series: [{x: ft, y: E, color: "--accent", width: 1.6}, {x: [0, 1], y: [et, et], color: "--right", width: 1.2, dash: [5, 4]}]});
      plot(cv[2], {xlim: [0, 1], ylim: [0, 6000], ylabel: "ZCR (/s)", series: [{x: ft, y: Z, color: "--accent", width: 1.6}, {x: [0, 1], y: [zt, zt], color: "--right", width: 1.2, dash: [5, 4]}]});
      plot(cv[3], {xlim: [0, 1], ylim: [-0.4, 2.4], xlabel: "Time (s)", yticks: [[0, "S"], [1, "UV"], [2, "V"]], series: [{x: ft, y: D, color: "--left", width: 2, step: true}]});
      q(el, "b3-8-ste-n").textContent = N + " / " + H;
      q(el, "b3-8-ste-c").textContent = cnt[2] + " / " + cnt[1] + " / " + cnt[0];
      const p1 = acF0(utt, Math.round(0.225*SF - N/2), N), p2 = acF0(utt, Math.round(0.725*SF - N/2), N);
      q(el, "b3-8-ste-f1").textContent = p1.f0.toFixed(1) + " Hz (lag " + p1.k + ")";
      q(el, "b3-8-ste-f2").textContent = p2.f0.toFixed(1) + " Hz (lag " + p2.k + ")";
    }
  });

  /* ---------- 3.9 vowel spectra ---------- */
  const VOW = {a: [[730, 90], [1090, 110], [2440, 170]], i: [[270, 60], [2290, 120], [3010, 170]], u: [[300, 60], [870, 90], [2240, 150]]};
  const resMag = (f, F, B) => { const pr = -Math.PI*B, pi = TAU*F, w = TAU*f;
    const m2 = pr*pr + pi*pi; return m2/(Math.hypot(pr, w - pi)*Math.hypot(pr, w + pi)); };
  const VF = 16000, NFFT = 2048;
  AT.demo("b3-9-vowel", {
    init(el){ hook(el, this); },
    draw(el){
      const v = q(el, "b3-9-vowel-v").value, f0 = +q(el, "b3-9-vowel-f0").value, L = +q(el, "b3-9-vowel-w").value, showE = q(el, "b3-9-vowel-e").checked;
      q(el, "b3-9-vowel-f0-o").textContent = f0 + " Hz";
      const fm = VOW[v];
      const Hm = f => fm.reduce((p, [F, B]) => p*resMag(f, F, B), 1);
      const env = f => Hm(f)*f0/Math.max(f, f0);
      const re = new Float64Array(NFFT), im = new Float64Array(NFFT);
      let wsum = 0;
      // cosine phases aligned so that a glottal pulse falls at the window centre
      const phases = []; for(let k = 1; k*f0 < 7000; k++) phases.push(-TAU*k*f0*(L/2)/VF);
      for(let n = 0; n < L; n++){
        const w = 0.5 - 0.5*Math.cos(TAU*n/(L - 1)); wsum += w;
        let s = 0; for(let k = 1; k*f0 < 7000; k++) s += env(k*f0)*Math.cos(TAU*k*f0*n/VF + phases[k - 1]);
        re[n] = s*w;
      }
      fft(re, im);
      const fx = [], sy = [];
      let ref = 0; for(let k = 1; k*f0 < 5000; k++) ref = Math.max(ref, env(k*f0));
      for(let b = 0; b <= NFFT/2; b++){ const f = b*VF/NFFT; if(f > 5000) break;
        fx.push(f); sy.push(20*Math.log10(Math.hypot(re[b], im[b])/(wsum/2)/ref + 1e-9)); }
      const mx = Math.max(...sy); for(let i = 0; i < sy.length; i++) sy[i] -= mx;   // peak at 0 dB
      const series = [{x: fx, y: sy, color: "--accent", width: 1.5}];
      if(showE){ const ex = [], ey = []; for(let f = 20; f <= 5000; f += 10){ ex.push(f); ey.push(20*Math.log10(env(f)/ref)); } series.push({x: ex, y: ey, color: "--right", width: 1.3, dash: [5, 4]}); }
      const labels = fm.map(([F], i) => ({text: "F" + (i + 1), x: F, y: Math.min(3, 20*Math.log10(env(F)/ref)), dy: -8, color: "--ink", align: "center"}));
      plot(el.querySelector("canvas"), {xlim: [0, 5000], ylim: [-70, 10], xlabel: "Frequency (Hz)", ylabel: "Level (dB)", series, labels});
      q(el, "b3-9-vowel-f").textContent = fm.map(p => p[0]).join(" / ") + " Hz";
      q(el, "b3-9-vowel-h").textContent = f0 + " Hz";
      const kn = Math.max(1, Math.round(fm[0][0]/f0));
      q(el, "b3-9-vowel-n").textContent = kn + " × " + f0 + " = " + kn*f0 + " Hz";
      q(el, "b3-9-vowel-b").textContent = (VF/NFFT).toFixed(2) + " Hz";
    }
  });
})();
