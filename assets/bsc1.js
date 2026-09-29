(function(){
  const {plot} = window.AT;
  const q = (el, id) => el.querySelector("#" + id);
  const bindAll = (el, self) => el.querySelectorAll("input,select").forEach(i => {
    i.addEventListener("input", () => self.draw(el));
    i.addEventListener("change", () => self.draw(el));
  });
  const set = (el, id, t) => { const n = q(el, id); if(n) n.textContent = t; };
  const db = r => 20 * Math.log10(r);
  const fmtR = r => r >= 1e6 ? (r / 1e6).toFixed(2) + " MΩ" : r >= 1000 ? (r / 1000).toFixed(r >= 1e4 ? 1 : 2) + " kΩ" : r.toFixed(r < 10 ? 2 : 1) + " Ω";
  const fmtI = i => { const a = Math.abs(i); return a >= 1 ? i.toFixed(2) + " A" : a >= 1e-3 ? (i * 1e3).toFixed(a >= 0.1 ? 0 : 2) + " mA" : (i * 1e6).toFixed(1) + " µA"; };
  const fmtT = t => t >= 1 ? t.toFixed(2) + " s" : t >= 1e-3 ? (t * 1e3).toFixed(1) + " ms" : (t * 1e6).toFixed(0) + " µs";
  const fmtF = f => f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2) + " kHz" : f.toFixed(f < 100 ? 1 : 0) + " Hz";
  const fmtL = l => l >= 1 ? l.toFixed(2) + " H" : l >= 1e-3 ? (l * 1e3).toFixed(l >= 0.01 ? 1 : 2) + " mH" : (l * 1e6).toFixed(0) + " µH";
  const fmtC = c => c >= 1e-6 ? (c * 1e6).toFixed(c >= 1e-5 ? 0 : 2) + " µF" : (c * 1e9).toFixed(0) + " nF";

  /* ---------- 1.1 linear versus log taper ---------- */
  const idealLog = x => (Math.pow(81, x) - 1) / 80;               // 10% at half travel
  const segLog = x => x <= 0.5 ? 0.2 * x : 0.1 + 1.8 * (x - 0.5);  // two straight segments
  AT.demo("b1-1-taper", {
    init(el){ bindAll(el, this); },
    draw(el){
      const rot = +q(el, "b1-1-taper-rot").value / 100;
      const view = q(el, "b1-1-taper-view").value;
      const vin = +q(el, "b1-1-taper-vin").value;
      set(el, "b1-1-taper-rot-o", Math.round(rot * 100) + "%");
      set(el, "b1-1-taper-vin-o", vin.toFixed(1) + " V");
      const xs = [], yl = [], yg = [], ys = [];
      const tr = (f) => view === "db" ? (f > 0 ? Math.max(db(f), -60) : -60) : f;
      for(let i = 0; i <= 200; i++){ const x = i / 200; xs.push(x * 100); yl.push(tr(x)); yg.push(tr(idealLog(x))); ys.push(tr(segLog(x))); }
      const fl = rot, fg = idealLog(rot), fs = segLog(rot);
      const txt = f => (f * vin).toFixed(2) + " V, " + (f > 0 ? db(f).toFixed(1) + " dB" : "−∞ dB");
      set(el, "b1-1-taper-lin", txt(fl));
      set(el, "b1-1-taper-log", txt(fg));
      set(el, "b1-1-taper-seg", txt(fs));
      const ylim = view === "db" ? [-60, 3] : [0, 1.02];
      plot(el.querySelector("canvas"), {
        xlim: [0, 100], ylim,
        xlabel: "Rotation (% of travel)", ylabel: view === "db" ? "Output (dB re Vin)" : "Vout / Vin",
        yticks: view === "db" ? [[0,"0"],[-10,"-10"],[-20,"-20"],[-30,"-30"],[-40,"-40"],[-50,"-50"],[-60,"-60"]] : undefined,
        series: [
          {x: xs, y: yl, color: "--left", width: 2},
          {x: xs, y: yg, color: "--accent", width: 2},
          {x: xs, y: ys, color: "--warn", width: 1.6, dash: [5, 4]},
          {x: [rot * 100, rot * 100], y: ylim, color: "--plot-axis", width: 1, dash: [3, 3]},
          {x: [rot * 100, rot * 100, rot * 100], y: [tr(fl), tr(fg), tr(fs)], color: "--ink", line: false, marker: "o", msize: 4}
        ]
      });
    }
  });

  /* ---------- 1.1 RC charging ---------- */
  AT.demo("b1-1-rc", {
    init(el){ bindAll(el, this); },
    draw(el){
      const R = 1000 * Math.pow(10, +q(el, "b1-1-rc-r").value);   // 1 k to 100 k
      const C = +q(el, "b1-1-rc-c").value;
      const V = +q(el, "b1-1-rc-v").value;
      set(el, "b1-1-rc-r-o", fmtR(R));
      set(el, "b1-1-rc-v-o", V.toFixed(1) + " V");
      const tau = R * C;
      let unit = 1, un = "s";
      if(tau * 10 < 0.1){ unit = 1e-3; un = "ms"; }
      const T = 10 * tau, xs = [], vc = [], ic = [];
      for(let i = 0; i <= 400; i++){
        const t = T * i / 400; let v, cur;
        if(t <= 5 * tau){ v = V * (1 - Math.exp(-t / tau)); cur = (V / R) * Math.exp(-t / tau); }
        else { const v5 = V * (1 - Math.exp(-5)); v = v5 * Math.exp(-(t - 5 * tau) / tau); cur = -(v5 / R) * Math.exp(-(t - 5 * tau) / tau); }
        xs.push(t / unit); vc.push(v); ic.push(cur * R);          // current scaled: I×R has volt units
      }
      set(el, "b1-1-rc-tau", fmtT(tau));
      set(el, "b1-1-rc-v1", (V * (1 - Math.exp(-1))).toFixed(2) + " V (63.2%)");
      set(el, "b1-1-rc-i0", fmtI(V / R));
      set(el, "b1-1-rc-xc", fmtR(1 / (2 * Math.PI * 1000 * C)));
      plot(el.querySelector("canvas"), {
        xlim: [0, T / unit], ylim: [-V * 1.05, V * 1.1],
        xlabel: "Time (" + un + ")", ylabel: "Volts",
        series: [
          {x: [0, T / unit], y: [0, 0], color: "--plot-axis", width: 1},
          {x: xs, y: ic, color: "--right", width: 1.6, dash: [5, 3]},
          {x: xs, y: vc, color: "--accent", width: 2.2},
          {x: [tau / unit, tau / unit], y: [0, V * (1 - Math.exp(-1))], color: "--plot-axis", width: 1, dash: [3, 3]},
          {x: [tau / unit], y: [V * (1 - Math.exp(-1))], color: "--accent", line: false, marker: "o", msize: 4}
        ],
        labels: [
          {text: "1τ", x: tau / unit, y: -V * 0.15, align: "center", color: "--muted"},
          {text: "charging", x: 2.5 * tau / unit, y: V * 1.02, align: "center", color: "--muted"},
          {text: "discharging", x: 7.5 * tau / unit, y: V * 1.02, align: "center", color: "--muted"}
        ]
      });
    }
  });

  /* ---------- 1.2 reactance against frequency ---------- */
  AT.demo("b1-2-xl", {
    init(el){ bindAll(el, this); },
    draw(el){
      const L = 1e-3 * Math.pow(10, +q(el, "b1-2-xl-l").value);   // 0.1 mH to 100 mH
      const C = 1e-6 * Math.pow(10, +q(el, "b1-2-xl-c").value);   // 10 nF to 100 µF
      const f = Math.pow(10, +q(el, "b1-2-xl-f").value);          // 20 Hz to 20 kHz
      set(el, "b1-2-xl-l-o", fmtL(L));
      set(el, "b1-2-xl-c-o", fmtC(C));
      set(el, "b1-2-xl-f-o", fmtF(f));
      const xs = [], yl = [], yc = [];
      for(let i = 0; i <= 200; i++){
        const fr = 20 * Math.pow(1000, i / 200);
        xs.push(fr); yl.push(Math.log10(2 * Math.PI * fr * L)); yc.push(Math.log10(1 / (2 * Math.PI * fr * C)));
      }
      const XL = 2 * Math.PI * f * L, XC = 1 / (2 * Math.PI * f * C), f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
      set(el, "b1-2-xl-xl", fmtR(XL));
      set(el, "b1-2-xl-xc", fmtR(XC));
      set(el, "b1-2-xl-f0", f0 >= 20 && f0 <= 20000 ? fmtF(f0) : fmtF(f0) + " (outside plot)");
      const yt = [[-2,"0.01"],[-1,"0.1"],[0,"1"],[1,"10"],[2,"100"],[3,"1k"],[4,"10k"],[5,"100k"]];
      const ser = [
        {x: xs, y: yl, color: "--accent", width: 2.2},
        {x: xs, y: yc, color: "--left", width: 2.2},
        {x: [f, f], y: [-2, 5], color: "--plot-axis", width: 1, dash: [3, 3]},
        {x: [f, f], y: [Math.log10(XL), Math.log10(XC)], color: "--ink", line: false, marker: "o", msize: 4}
      ];
      if(f0 >= 20 && f0 <= 20000) ser.push({x: [f0], y: [Math.log10(2 * Math.PI * f0 * L)], color: "--right", line: false, marker: "dot", msize: 5});
      plot(el.querySelector("canvas"), {
        xlim: [20, 20000], xlog: true, ylim: [-2, 5],
        xticks: [[20,"20"],[100,"100"],[1000,"1k"],[10000,"10k"],[20000,"20k"]],
        yticks: yt, xlabel: "Frequency (Hz)", ylabel: "Reactance (Ω)", series: ser
      });
    }
  });

  /* ---------- 1.2 transformer turns ratio ---------- */
  AT.demo("b1-2-tx", {
    init(el){ bindAll(el, this); },
    draw(el){
      const Np = +q(el, "b1-2-tx-np").value, Ns = +q(el, "b1-2-tx-ns").value;
      const R = 10 * Math.pow(10, +q(el, "b1-2-tx-rl").value);    // 10 Ω to 10 kΩ
      set(el, "b1-2-tx-np-o", Np);
      set(el, "b1-2-tx-ns-o", Ns);
      set(el, "b1-2-tx-rl-o", fmtR(R));
      const Vp = 230, n = Ns / Np, Vs = Vp * n, Is = Vs / R, Ip = Is * n, Zp = R / (n * n);
      set(el, "b1-2-tx-type", Ns < Np ? "Step-down " + (Np / Ns).toFixed(2) + ":1" : Ns > Np ? "Step-up 1:" + (Ns / Np).toFixed(2) : "1:1 (isolation)");
      set(el, "b1-2-tx-vs", Vs.toFixed(Vs < 100 ? 2 : 0) + " V");
      set(el, "b1-2-tx-is", fmtI(Is));
      set(el, "b1-2-tx-ip", fmtI(Ip));
      set(el, "b1-2-tx-zp", fmtR(Zp));
      const xs = [], yp = [], ys = [];
      for(let i = 0; i <= 300; i++){
        const t = 0.04 * i / 300;
        xs.push(t * 1000); yp.push(Vp * Math.SQRT2 * Math.sin(2 * Math.PI * 50 * t)); ys.push(Vs * Math.SQRT2 * Math.sin(2 * Math.PI * 50 * t));
      }
      const pk = Math.max(Vp, Vs) * Math.SQRT2 * 1.1;
      plot(el.querySelector("canvas"), {
        xlim: [0, 40], ylim: [-pk, pk], xlabel: "Time (ms)", ylabel: "Volts",
        series: [
          {x: [0, 40], y: [0, 0], color: "--plot-axis", width: 1},
          {x: xs, y: yp, color: "--left", width: 1.8},
          {x: xs, y: ys, color: "--accent", width: 2.2}
        ]
      });
    }
  });

  /* ---------- 1.3 diode V-I characteristic ---------- */
  const DIODES = {
    si:  {Is: 5e-9,  n: 1.9, vbr: 60,  name: "Si"},
    ge:  {Is: 1e-6,  n: 1.3, vbr: 40,  name: "Ge"},
    led: {Is: 1e-18, n: 2.0, vbr: 30,  name: "LED"},
    z:   {Is: 5e-9,  n: 1.9, vbr: 5.1, name: "Zener"}
  };
  const RZ = 5;   // ohms, slope resistance beyond breakdown
  function idiode(v, d, T){
    const VT = 8.617e-5 * (T + 273.15);
    const Is = d.Is * Math.exp(0.09 * (T - 25));
    let i = Is * (Math.exp(Math.min(v / (d.n * VT), 80)) - 1);
    const over = -v - d.vbr, k = 0.05;                           // k: soft knee width in volts
    if(over > -0.5) i -= (k * Math.log(1 + Math.exp(over / k))) / RZ;
    return i;
  }
  AT.demo("b1-3-vi", {
    init(el){ bindAll(el, this); },
    draw(el){
      const d = DIODES[q(el, "b1-3-vi-type").value];
      const Vs = +q(el, "b1-3-vi-vs").value, R = +q(el, "b1-3-vi-r").value, T = +q(el, "b1-3-vi-t").value;
      set(el, "b1-3-vi-vs-o", Vs.toFixed(1) + " V");
      set(el, "b1-3-vi-r-o", fmtR(R));
      set(el, "b1-3-vi-t-o", T + " °C");
      // operating point by bisection: f(v) = I(v) - (Vs - v)/R, increasing in v
      let a = -Math.abs(Vs) - 1, b = Math.abs(Vs) + 1;
      for(let k = 0; k < 200; k++){ const m = (a + b) / 2; if(idiode(m, d, T) - (Vs - m) / R > 0) b = m; else a = m; }
      const vd = (a + b) / 2, id = (Vs - vd) / R;
      // knee: voltage at +1 mA
      let ka = 0, kb = 3;
      for(let k = 0; k < 100; k++){ const m = (ka + kb) / 2; if(idiode(m, d, T) > 1e-3) kb = m; else ka = m; }
      set(el, "b1-3-vi-vd", vd.toFixed(3) + " V");
      set(el, "b1-3-vi-id", fmtI(id));
      set(el, "b1-3-vi-pd", (Math.abs(vd * id) * 1000).toFixed(1) + " mW");
      set(el, "b1-3-vi-vk", ka.toFixed(3) + " V");
      const xs = [], ys = [];
      for(let i = 0; i <= 600; i++){ const v = -8 + 10.5 * i / 600; xs.push(v); ys.push(1000 * Math.max(-60, Math.min(60, idiode(v, d, T)))); }
      const lx = [-8, 2.5], ly = lx.map(v => 1000 * (Vs - v) / R);
      const labels = [];
      if(d.vbr > 8) labels.push({text: "reverse breakdown far beyond −8 V", x: -7.8, y: -30, color: "--muted"});
      else labels.push({text: "Zener breakdown", x: -d.vbr - 0.2, y: -34, align: "right", color: "--muted"});
      plot(el.querySelector("canvas"), {
        xlim: [-8, 2.5], ylim: [-40, 40], xlabel: "Diode voltage (V)", ylabel: "Diode current (mA)",
        series: [
          {x: [-8, 2.5], y: [0, 0], color: "--plot-axis", width: 1},
          {x: [0, 0], y: [-40, 40], color: "--plot-axis", width: 1},
          {x: lx, y: ly, color: "--plot-axis", width: 1.4, dash: [6, 4]},
          {x: xs, y: ys, color: "--accent", width: 2.2},
          {x: [vd], y: [id * 1000], color: "--right", line: false, marker: "dot", msize: 5}
        ],
        labels
      });
    }
  });

  /* ---------- 1.4 frequency response and bandwidth ---------- */
  AT.demo("b1-4-bw", {
    init(el){ bindAll(el, this); },
    draw(el){
      const G = +q(el, "b1-4-bw-g").value;
      const fL = Math.pow(10, +q(el, "b1-4-bw-fl").value);
      let fH = Math.pow(10, +q(el, "b1-4-bw-fh").value);
      const ord = +q(el, "b1-4-bw-ord").value;
      const gbw = q(el, "b1-4-bw-gbw").checked;
      set(el, "b1-4-bw-g-o", G + " dB (×" + (+Math.pow(10, G / 20).toPrecision(3)) + ")");
      set(el, "b1-4-bw-fl-o", fmtF(fL));
      set(el, "b1-4-bw-fh-o", fmtF(fH));
      const Av = Math.pow(10, G / 20);
      const fGbw = 1e6 / Av;                                       // first-order op-amp pole
      const mag = f => {
        const hp = Math.pow(f / fL, ord) / Math.sqrt(1 + Math.pow(f / fL, 2 * ord));
        const lp = 1 / Math.sqrt(1 + Math.pow(f / fH, 2 * ord));
        const op = gbw ? 1 / Math.sqrt(1 + Math.pow(f / fGbw, 2)) : 1;
        return G + db(hp * lp * op);
      };
      const xs = [], ys = [];
      let peak = -1e9;
      const N = 800;
      for(let i = 0; i <= N; i++){ const f = 10 * Math.pow(1e4, i / N); const g = mag(f); xs.push(f); ys.push(g); if(g > peak) peak = g; }
      // find -3 dB points relative to the peak, on a fine log grid
      const thr = peak - 3.0103;
      let lo = null, hi = null;
      for(let i = 1; i <= N; i++){
        if(lo === null && ys[i - 1] < thr && ys[i] >= thr){ const t = (thr - ys[i - 1]) / (ys[i] - ys[i - 1]); lo = xs[i - 1] * Math.pow(xs[i] / xs[i - 1], t); }
        if(ys[i - 1] >= thr && ys[i] < thr){ const t = (ys[i - 1] - thr) / (ys[i - 1] - ys[i]); hi = xs[i - 1] * Math.pow(xs[i] / xs[i - 1], t); }
      }
      set(el, "b1-4-bw-mid", peak.toFixed(1) + " dB");
      set(el, "b1-4-bw-l", lo ? fmtF(lo) : "below 10 Hz");
      set(el, "b1-4-bw-h", hi ? fmtF(hi) : "above 100 kHz");
      set(el, "b1-4-bw-bw", lo && hi ? fmtF(hi - lo) : "n/a");
      set(el, "b1-4-bw-aud", mag(125).toFixed(1) + " / " + mag(8000).toFixed(1) + " dB");
      const ymin = Math.max(-20, Math.floor((G - 40) / 10) * 10), ymax = Math.ceil((G + 8) / 10) * 10;
      const ser = [
        {x: [125, 8000], y: [ymin + 1.5, ymin + 1.5], color: "--left", width: 5},
        {x: [10, 1e5], y: [thr, thr], color: "--right", width: 1, dash: [5, 4]},
        {x: xs, y: ys, color: "--accent", width: 2.2}
      ];
      if(lo) ser.push({x: [lo, lo], y: [ymin, thr], color: "--right", width: 1, dash: [3, 3]});
      if(hi) ser.push({x: [hi, hi], y: [ymin, thr], color: "--right", width: 1, dash: [3, 3]});
      const labels = [];
      if(gbw) labels.push({text: "GBW limit: fH ≤ " + fmtF(fGbw), x: 12, y: ymax - 3, color: "--muted"});
      plot(el.querySelector("canvas"), {
        xlim: [10, 1e5], xlog: true, ylim: [ymin, ymax],
        xticks: [[10,"10"],[100,"100"],[1000,"1k"],[10000,"10k"],[100000,"100k"]],
        xlabel: "Frequency (Hz)", ylabel: "Gain (dB)", series: ser, labels
      });
    }
  });
})();

(function(){
  const {plot, fft} = window.AT;
  const q = (el, id) => el.querySelector("#" + id);
  const setV = (el, id, txt, bad) => { const n = q(el, id); if(!n) return; n.textContent = txt; n.classList.toggle("bad", !!bad); };
  const bindAll = (el, self) => el.querySelectorAll("input,select").forEach(i => { i.addEventListener("input", () => self.draw(el)); i.addEventListener("change", () => self.draw(el)); });
  const fmtI = a => { const x = Math.abs(a); if(x >= 1) return a.toFixed(2) + " A"; if(x >= 1e-3) return (a * 1e3).toFixed(x >= 0.1 ? 0 : 1) + " mA"; return (a * 1e6).toFixed(x >= 1e-4 ? 0 : 1) + " µA"; };
  const fmtR = r => r >= 1000 ? (r / 1000).toFixed(r >= 10000 ? 0 : 1) + " kΩ" : Math.round(r) + " Ω";

  /* ---------- 1.5 rectifier and capacitor filter ---------- */
  const CAPS = [0, 100, 220, 470, 1000, 2200, 4700, 10000, 22000];   // microfarads
  AT.demo("b1-5-rect", {
    init(el){ bindAll(el, this); },
    draw(el){
      const type = q(el, "b1-5-rect-type").value;
      const vr = +q(el, "b1-5-rect-v").value, cu = CAPS[+q(el, "b1-5-rect-c").value], iL = +q(el, "b1-5-rect-i").value / 1000;
      q(el, "b1-5-rect-v-o").textContent = vr + " V RMS" + (type === "ct" ? " per half" : "");
      q(el, "b1-5-rect-c-o").textContent = cu ? cu + " µF" : "none";
      q(el, "b1-5-rect-i-o").textContent = Math.round(iL * 1000) + " mA";
      const vm = vr * Math.SQRT2, drop = type === "br" ? 1.4 : 0.7, f = 50;
      const src = t => { const s = Math.sin(2 * Math.PI * f * t) * vm; const r = type === "hw" ? s : Math.abs(s); return Math.max(0, r - drop); };
      const dt = 1e-5, T = 0.1, C = cu * 1e-6;
      let vc = 0; const x = [], ys = [], yo = [];
      let mx = -1e9, mn = 1e9, sum = 0, cnt = 0;
      for(let k = 0; k * dt <= T + 1e-12; k++){
        const t = k * dt, vs = src(t);
        let vo;
        if(C > 0){ vc = Math.max(0, vc - iL * dt / C); if(vs > vc) vc = vs; vo = vc; }
        else vo = vs;
        if(t >= 0.04 - 1e-12){
          if(k % 20 === 0){ x.push((t - 0.04) * 1000); ys.push(vs); yo.push(vo); }
          mx = Math.max(mx, vo); mn = Math.min(mn, vo); sum += vo; cnt++;
        }
      }
      const avg = sum / cnt, rip = mx - mn;
      const ymax = Math.ceil((vm * 1.12) / 5) * 5;
      plot(el.querySelector("canvas"), {
        xlim:[0, 60], ylim:[0, ymax], xlabel:"Time (ms)", ylabel:"Voltage (V)",
        series:[{x, y:ys, color:"--plot-axis", width:1.2, dash:[4,3]}, {x, y:yo, color:"--accent", width:2.2}],
        labels:[{text:"average " + avg.toFixed(1) + " V", x:1, y:Math.min(ymax * 0.97, avg + ymax * 0.06), color:"--muted"}]
      });
      setV(el, "b1-5-rect-pk", mx.toFixed(2) + " V");
      setV(el, "b1-5-rect-rp", rip.toFixed(2) + " V", C > 0 && rip > 0.25 * mx);
      setV(el, "b1-5-rect-dc", avg.toFixed(2) + " V");
      setV(el, "b1-5-rect-fr", (type === "hw" ? 50 : 100) + " Hz");
      setV(el, "b1-5-rect-piv", (type === "ct" ? 2 * vm : vm).toFixed(1) + " V");
    }
  });

  /* ---------- 1.5 Zener shunt regulator ---------- */
  const VZ = 5.1, RZ = 5, IZMIN = 0.005, PMAX = 0.5;
  function zener(vin, rs, rl){
    const vd = vin * rl / (rs + rl);
    if(vd <= VZ) return {vo: vd, iz: 0};
    const vo = (vin / rs + VZ / RZ) / (1 / rs + 1 / rl + 1 / RZ);
    return {vo, iz: (vo - VZ) / RZ};
  }
  AT.demo("b1-5-zener", {
    init(el){ bindAll(el, this); },
    draw(el){
      const vin = +q(el, "b1-5-zener-vin").value, rs = +q(el, "b1-5-zener-rs").value, rl = +q(el, "b1-5-zener-rl").value;
      q(el, "b1-5-zener-vin-o").textContent = vin.toFixed(1) + " V";
      q(el, "b1-5-zener-rs-o").textContent = fmtR(rs);
      q(el, "b1-5-zener-rl-o").textContent = fmtR(rl);
      const x = [], y = [];
      for(let v = 0; v <= 20.0001; v += 0.1){ x.push(v); y.push(zener(v, rs, rl).vo); }
      const p = zener(vin, rs, rl);
      plot(el.querySelector("canvas"), {
        xlim:[0, 20], ylim:[0, 7], xlabel:"Input voltage (V)", ylabel:"Output voltage (V)",
        series:[{x:[0, 20], y:[VZ, VZ], color:"--plot-axis", width:1, dash:[4,4]}, {x, y, color:"--accent", width:2.2},
                {x:[vin], y:[p.vo], color:"--right", marker:"dot", line:false, msize:6}],
        labels:[{text:"Vz = 5.1 V", x:0.3, y:VZ + 0.3, color:"--muted"}]
      });
      const is = (vin - p.vo) / rs, pz = VZ * p.iz + RZ * p.iz * p.iz;
      setV(el, "b1-5-zener-vo", p.vo.toFixed(2) + " V");
      setV(el, "b1-5-zener-is", (is * 1000).toFixed(1) + " mA");
      setV(el, "b1-5-zener-iz", (p.iz * 1000).toFixed(1) + " mA", p.iz < IZMIN);
      setV(el, "b1-5-zener-pz", (pz * 1000).toFixed(0) + " mW", pz > PMAX);
      let st = "Regulating", bad = false;
      if(p.iz < IZMIN){ st = "Not regulating: Iz below 5 mA"; bad = true; }
      else if(pz > PMAX){ st = "Zener overloaded (over 0.5 W)"; bad = true; }
      setV(el, "b1-5-zener-st", st, bad);
    }
  });

  /* ---------- 1.6 peak, average, RMS ---------- */
  const WF = {
    sine: p => Math.sin(2 * Math.PI * p),
    square: p => (p % 1) < 0.5 ? 1 : -1,
    tri: p => { const u = p % 1; return u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4; },
    fwr: p => Math.abs(Math.sin(2 * Math.PI * p)),
    hwr: p => Math.max(0, Math.sin(2 * Math.PI * p))
  };
  AT.demo("b1-6-rms", {
    init(el){ bindAll(el, this); },
    draw(el){
      const type = q(el, "b1-6-rms-type").value, vp = +q(el, "b1-6-rms-vp").value;
      q(el, "b1-6-rms-vp-o").textContent = vp + " V";
      const N = 2000, x = [], y = [], y2 = [];
      let ss = 0, s = 0;
      for(let i = 0; i <= N; i++){
        const p = 2 * i / N, v = vp * WF[type](p);
        x.push(40 * i / N); y.push(v); y2.push(v * v / vp);
        if(i < N){ ss += v * v; s += v; }
      }
      const rms = Math.sqrt(ss / N), avg = s / N;
      plot(el.querySelector("canvas"), {
        xlim:[0, 40], ylim:[-vp * 1.15, vp * 1.15], xlabel:"Time (ms), 50 Hz", ylabel:"Voltage (V)",
        series:[{x, y:y2, color:"--left", width:1.2, dash:[3,3]}, {x, y, color:"--accent", width:2.2},
                {x:[0, 40], y:[rms, rms], color:"--warn", width:2}, {x:[0, 40], y:[0, 0], color:"--plot-axis", width:1}],
        labels:[{text:"RMS " + rms.toFixed(1) + " V", x:0.5, y:rms, dy:-6, color:"--warn"}]
      });
      setV(el, "b1-6-rms-pk", vp.toFixed(0) + " V");
      setV(el, "b1-6-rms-rms", rms.toFixed(1) + " V (" + (rms / vp).toFixed(3) + " × peak)");
      setV(el, "b1-6-rms-avg", Math.abs(avg) < 1e-6 * vp ? "0 V" : avg.toFixed(1) + " V");
      setV(el, "b1-6-rms-cf", (vp / rms).toFixed(3));
    }
  });

  /* ---------- 1.6 isolation transformer and body current ---------- */
  AT.demo("b1-6-leak", {
    init(el){ bindAll(el, this); },
    draw(el){
      const R = 500 * Math.pow(200, +q(el, "b1-6-leak-r").value / 100);
      const C = 0.1e-9 * Math.pow(100, +q(el, "b1-6-leak-c").value / 100);
      q(el, "b1-6-leak-r-o").textContent = fmtR(R);
      q(el, "b1-6-leak-c-o").textContent = (C * 1e9).toFixed(C < 1e-9 ? 2 : 1) + " nF";
      const V = 230, Xc = 1 / (2 * Math.PI * 50 * C);
      const i1 = r => V / r, i2 = r => V / Math.hypot(r, Xc);
      const x = [], a = [], b = [];
      for(let k = 0; k <= 200; k++){ const r = 500 * Math.pow(200, k / 200); x.push(r); a.push(Math.log10(i1(r))); b.push(Math.log10(i2(r))); }
      const lg = Math.log10;
      plot(el.querySelector("canvas"), {
        xlim:[500, 100000], xlog:true, ylim:[-6, 0], xlabel:"Body resistance (Ω)", ylabel:"Body current",
        xticks:[[500, "500"], [1000, "1k"], [3000, "3k"], [10000, "10k"], [30000, "30k"], [100000, "100k"]],
        yticks:[[-6, "1 µA"], [-5, "10 µA"], [-4, "100 µA"], [-3, "1 mA"], [-2, "10 mA"], [-1, "100 mA"], [0, "1 A"]],
        series:[{x:[500, 100000], y:[-3, -3], color:"--warn", width:1, dash:[4,4]}, {x:[500, 100000], y:[-2, -2], color:"--warn", width:1, dash:[4,4]},
                {x:[500, 100000], y:[-1, -1], color:"--warn", width:1, dash:[4,4]},
                {x, y:a, color:"--right", width:2.2}, {x, y:b, color:"--accent", width:2.2},
                {x:[R, R], y:[lg(i1(R)), lg(i2(R))], color:"--ink", marker:"dot", msize:5, line:false}],
        labels:[{text:"perception", x:60000, y:-3, dy:-4, color:"--muted", align:"right"}, {text:"let-go", x:60000, y:-2, dy:-4, color:"--muted", align:"right"},
                {text:"fibrillation risk", x:60000, y:-1, dy:-4, color:"--muted", align:"right"}]
      });
      setV(el, "b1-6-leak-i1", fmtI(i1(R)), i1(R) > 0.01);
      setV(el, "b1-6-leak-i2", fmtI(i2(R)), i2(R) > 0.001);
      setV(el, "b1-6-leak-ratio", Math.round(i1(R) / i2(R)).toLocaleString("en-GB") + " times less");
    }
  });

  /* ---------- 1.7 UPS calculator ---------- */
  const SIZES = [600, 1000, 1500, 2000, 3000, 5000, 6000, 10000];
  AT.demo("b1-7-ups", {
    init(el){ bindAll(el, this); },
    draw(el){
      const P = +q(el, "b1-7-ups-p").value, pf = +q(el, "b1-7-ups-pf").value, V = +q(el, "b1-7-ups-v").value;
      const Ah = +q(el, "b1-7-ups-ah").value, eta = +q(el, "b1-7-ups-eta").value, dod = +q(el, "b1-7-ups-dod").value;
      const model = q(el, "b1-7-ups-model").value;
      q(el, "b1-7-ups-p-o").textContent = P + " W";
      q(el, "b1-7-ups-pf-o").textContent = pf.toFixed(2);
      q(el, "b1-7-ups-ah-o").textContent = Ah + " Ah";
      q(el, "b1-7-ups-eta-o").textContent = Math.round(eta * 100) + "%";
      q(el, "b1-7-ups-dod-o").textContent = Math.round(dod * 100) + "%";
      const tmin = p => {
        const I = p / eta / V;
        if(model === "simple") return 60 * V * Ah * dod * eta / p;
        return 60 * dod * 20 * Math.pow(Ah / (20 * I), 1.2);
      };
      const x = [], y = [];
      for(let p = 50; p <= 2000; p += 10){ x.push(p); y.push(tmin(p)); }
      const t = tmin(P);
      let ymax = Math.max(10, t * 2.5);
      const step = ymax > 600 ? 120 : ymax > 120 ? 30 : ymax > 40 ? 10 : 5;
      ymax = Math.ceil(ymax / step) * step;
      plot(el.querySelector("canvas"), {
        xlim:[0, 2000], ylim:[0, ymax], xlabel:"Load (W)", ylabel:"Backup time (min)",
        series:[{x, y, color:"--accent", width:2.2}, {x:[P], y:[t], color:"--right", marker:"dot", msize:6, line:false}]
      });
      const va = P / pf, need = va * 1.25;
      const size = SIZES.find(s => s >= need);
      setV(el, "b1-7-ups-va", Math.round(va) + " VA");
      setV(el, "b1-7-ups-size", size ? size + " VA (need ≥ " + Math.round(need) + " VA)" : "over 10 kVA", !size);
      setV(el, "b1-7-ups-wh", Math.round(V * Ah) + " Wh");
      setV(el, "b1-7-ups-i", (P / eta / V).toFixed(1) + " A");
      setV(el, "b1-7-ups-t", t >= 120 ? (t / 60).toFixed(1) + " h" : Math.round(t) + " min", t < 5);
    }
  });

  /* ---------- 1.7 inverter waveforms ---------- */
  AT.demo("b1-7-wave", {
    init(el){ bindAll(el, this); },
    draw(el){
      const type = q(el, "b1-7-wave-type").value, w = +q(el, "b1-7-wave-w").value;
      q(el, "b1-7-wave-w-o").textContent = Math.round(w * 100) + "%";
      q(el, "b1-7-wave-w").disabled = type !== "ms";
      const N = 1024, sig = new Float64Array(N);
      const vp = type === "sq" ? 230 : type === "ms" ? 230 / Math.sqrt(w) : 230 * Math.SQRT2;
      for(let i = 0; i < N; i++){
        const p = i / N, half = p < 0.5 ? 1 : -1, ph = (p % 0.5) / 0.5;
        if(type === "sq") sig[i] = 230 * half;
        else if(type === "ms") sig[i] = Math.abs(ph - 0.5) < w / 2 ? vp * half : 0;
        else sig[i] = 230 * Math.SQRT2 * (Math.sin(2 * Math.PI * p) + 0.012 * Math.sin(2 * Math.PI * 39 * p) + 0.012 * Math.sin(2 * Math.PI * 41 * p));
      }
      let ss = 0, pk = 0;
      for(let i = 0; i < N; i++){ ss += sig[i] * sig[i]; pk = Math.max(pk, Math.abs(sig[i])); }
      const rms = Math.sqrt(ss / N);
      const re = Float64Array.from(sig), im = new Float64Array(N);
      fft(re, im);
      const h = n => 2 * Math.hypot(re[n], im[n]) / N;
      let hs = 0; for(let n = 2; n < N / 2; n++) hs += h(n) * h(n);
      const thd = Math.sqrt(hs) / h(1);
      const x = [], y = [], ys = [];
      for(let i = 0; i <= 2 * N; i++){ x.push(40 * i / (2 * N)); y.push(sig[i % N]); ys.push(230 * Math.SQRT2 * Math.sin(2 * Math.PI * i / N)); }
      const cv = el.querySelectorAll("canvas");
      plot(cv[0], {
        xlim:[0, 40], ylim:[-450, 450], xlabel:"Time (ms)", ylabel:"Voltage (V)",
        series:[{x, y:ys, color:"--plot-axis", width:1.2, dash:[4,3]}, {x, y, color:"--accent", width:2.2}]
      });
      const ser = []; let hm = 0;
      for(let n = 2; n <= 45; n++){ const v = 100 * h(n) / h(1); hm = Math.max(hm, v); ser.push({x:[n, n], y:[0, v], color:"--accent", width:4}); }
      const ym = Math.max(10, Math.ceil((hm + 5) / 10) * 10);
      plot(cv[1], {
        xlim:[1, 46], ylim:[0, ym], xlabel:"Harmonic number (multiple of 50 Hz)", ylabel:"% of fundamental",
        xticks:[[3, "3"], [5, "5"], [7, "7"], [11, "11"], [15, "15"], [21, "21"], [31, "31"], [41, "41"]],
        series:ser
      });
      setV(el, "b1-7-wave-rms", rms.toFixed(0) + " V");
      setV(el, "b1-7-wave-pk", pk.toFixed(0) + " V");
      setV(el, "b1-7-wave-thd", (100 * thd).toFixed(1) + "%", thd > 0.08);
    }
  });
})();

(function(){
  const {plot, css, TAU} = window.AT;

  /* shared: mid-rise quantiser over -1..+1 with 2^N levels */
  function quant(v, N){
    const L = Math.pow(2, N), d = 2 / L;
    let k = Math.floor((v + 1) / d);
    if(k < 0) k = 0; if(k > L - 1) k = L - 1;
    return {code: k, value: -1 + (k + 0.5) * d};
  }
  function toBin(k, N){ let s = k.toString(2); while(s.length < N) s = "0" + s; return s; }
  function fmtHz(f){ return f >= 1000 ? (f / 1000).toFixed(2).replace(/\.?0+$/, "") + " kHz" : Math.round(f) + " Hz"; }
  function fmtV(v){
    const a = Math.abs(v);
    if(a >= 0.1) return v.toFixed(3) + " V";
    if(a >= 1e-3) return (v * 1e3).toFixed(2) + " mV";
    return (v * 1e6).toFixed(1) + " µV";
  }

  /* ---------- b1-8-conv: decimal to binary converter ---------- */
  AT.demo("b1-8-conv", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const N = +el.querySelector("#b1-8-conv-w").value;
      const raw = el.querySelector("#b1-8-conv-n").value;
      let x = parseFloat(raw); if(!isFinite(x) || x < 0) x = 0;
      const maxv = Math.pow(2, N) - 1;
      let ip = Math.floor(x), fp = x - ip;
      const warnEl = el.querySelector("#b1-8-conv-warn");
      if(ip > maxv){ warnEl.textContent = "Too big for " + N + " bits (maximum " + maxv + "). Showing " + maxv + "."; warnEl.classList.add("bad"); ip = maxv; }
      else { warnEl.textContent = "fits (0 to " + maxv + ")"; warnEl.classList.remove("bad"); }

      /* repeated division for the integer part */
      const rows = [];
      let q = ip, step = 1;
      if(q === 0) rows.push([1, "0 ÷ 2", 0, 0]);
      while(q > 0){ rows.push([step++, q + " ÷ 2", Math.floor(q / 2), q % 2]); q = Math.floor(q / 2); }
      let h = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Step</th><th>Divide</th><th>Quotient</th><th>Remainder (bit)</th></tr></thead><tbody>';
      rows.forEach(r => { h += "<tr><td class=\"num\">" + r[0] + "</td><td class=\"num\">" + r[1] + "</td><td class=\"num\">" + r[2] + "</td><td class=\"num\">" + r[3] + "</td></tr>"; });
      h += "</tbody></table></div><p class=\"muted\">Read the remainder column from the bottom row upwards: " + rows.map(r => r[3]).reverse().join("") + ".</p>";

      /* repeated multiplication for the fraction part (up to 8 places) */
      const fbits = [];
      if(fp > 1e-12){
        h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Step</th><th>Multiply</th><th>Result</th><th>Integer part (bit)</th></tr></thead><tbody>';
        let f = fp;
        for(let i = 1; i <= 8 && f > 1e-12; i++){
          const r = f * 2, b = r >= 1 ? 1 : 0;
          h += "<tr><td class=\"num\">" + i + "</td><td class=\"num\">" + (+f.toFixed(6)) + " × 2</td><td class=\"num\">" + (+r.toFixed(6)) + "</td><td class=\"num\">" + b + "</td></tr>";
          fbits.push(b); f = r - b;
        }
        h += "</tbody></table></div><p class=\"muted\">Read the fraction bits from the top row downwards. " + (Math.abs(fbits.reduce((s, b, i) => s + b / Math.pow(2, i + 1), 0) - fp) > 1e-9 ? "This fraction does not end within 8 places, so the binary value is an approximation." : "This fraction ends exactly.") + "</p>";
      }
      el.querySelector("#b1-8-conv-steps").innerHTML = h;

      const bits = toBin(ip, N);
      const fracStr = fbits.length ? "." + fbits.join("") : "";
      const grouped = bits.replace(/(.{4})(?=.)/g, "$1 ");
      el.querySelector("#b1-8-conv-bin").textContent = grouped + fracStr;
      let hex = ip.toString(16).toUpperCase(); while(hex.length < N / 4) hex = "0" + hex;
      el.querySelector("#b1-8-conv-hex").textContent = hex;
      const terms = [];
      for(let i = 0; i < N; i++) if(bits[i] === "1") terms.push(String(Math.pow(2, N - 1 - i)));
      fbits.forEach((b, i) => { if(b) terms.push("1/" + Math.pow(2, i + 1)); });
      const fv = fbits.reduce((s, b, i) => s + b / Math.pow(2, i + 1), 0);
      el.querySelector("#b1-8-conv-sum").textContent = (terms.length ? terms.join(" + ") : "0") + " = " + (+(ip + fv).toFixed(8));
      const nb = ip === 0 ? 1 : Math.floor(Math.log2(ip)) + 1;
      el.querySelector("#b1-8-conv-nb").textContent = nb + (nb === 1 ? " bit" : " bits") + (fbits.length ? " (whole-number part)" : "");

      /* bit-weight cells on canvas: rows of 8 */
      const cv = el.querySelector("canvas");
      const nrows = N / 8 + (fbits.length ? 1 : 0);
      cv.dataset.h = String(20 + nrows * 78);
      const w = cv.clientWidth; if(!w) return;
      const H = +cv.dataset.h, dpr = window.devicePixelRatio || 1;
      cv.style.height = H + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr);
      const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, H);
      const acc = css("--accent"), ink = css("--ink"), muted = css("--muted"), rule = css("--plot-axis"), surf = css("--surface");
      const gap = 4, cw = (w - 16 - 7 * gap) / 8, ch = 44;
      const cell = (r, c, bit, lab) => {
        const x = 8 + c * (cw + gap), y = 10 + r * 78;
        ctx.fillStyle = bit ? acc : surf; ctx.strokeStyle = bit ? acc : rule; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.rect(x + .5, y + .5, cw - 1, ch - 1); ctx.fill(); ctx.stroke();
        ctx.fillStyle = bit ? surf : ink; ctx.font = "600 20px 'JetBrains Mono', ui-monospace, monospace"; ctx.textAlign = "center";
        ctx.fillText(String(bit), x + cw / 2, y + 30);
        ctx.fillStyle = muted; ctx.font = (cw < 44 ? "10px" : "11px") + " 'JetBrains Mono', ui-monospace, monospace";
        ctx.fillText(lab, x + cw / 2, y + ch + 16);
      };
      for(let i = 0; i < N; i++){ const p = N - 1 - i; cell(Math.floor(i / 8), i % 8, +bits[i], String(Math.pow(2, p))); }
      if(fbits.length){ for(let i = 0; i < 8; i++) cell(N / 8, i, i < fbits.length ? fbits[i] : 0, "1/" + Math.pow(2, i + 1)); }
    }
  });

  /* ---------- b1-9-aq: analog vs sampled vs quantised ---------- */
  AT.demo("b1-9-aq", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const spc = +el.querySelector("#b1-9-aq-s").value;
      const N = +el.querySelector("#b1-9-aq-b").value;
      const view = el.querySelector("#b1-9-aq-v").value;
      el.querySelector("#b1-9-aq-s-o").textContent = spc;
      el.querySelector("#b1-9-aq-b-o").textContent = N;
      const f = 1000, fs = spc * f, T = 0.002, A = 0.9;
      const ax = [], ay = [];
      for(let i = 0; i <= 800; i++){ const t = i / 800 * T; ax.push(t * 1000); ay.push(A * Math.sin(TAU * f * t)); }
      const sx = [], sy = [], qy = [], codes = [];
      const ns = Math.floor(T * fs + 1e-9);
      for(let n = 0; n <= ns; n++){ const t = n / fs, v = A * Math.sin(TAU * f * t); const qq = quant(v, N); sx.push(t * 1000); sy.push(v); qy.push(qq.value); codes.push(toBin(qq.code, N)); }
      const L = Math.pow(2, N), d = 2 / L;
      let emax = 0; for(let i = 0; i < sy.length; i++) emax = Math.max(emax, Math.abs(qy[i] - sy[i]));
      const series = [];
      const showA = view === "all" || view === "analog", showS = view === "all" || view === "sampled", showQ = view === "all" || view === "digital";
      if(view !== "analog") series.push({x: ax, y: ay, color: "--plot-axis", width: 1, dash: [4, 4]});
      if(showA) series.push({x: ax, y: ay, color: "--accent", width: 2.2});
      if(showS) series.push({x: sx, y: sy, color: "--right", line: false, marker: "o", msize: 4});
      if(showQ){
        const hx = sx.concat([T * 1000]), hy = qy.concat([qy[qy.length - 1]]);
        series.push({x: hx, y: hy, color: "--left", width: 2, step: true});
        series.push({x: sx, y: qy, color: "--left", line: false, marker: "dot", msize: 3.5});
      }
      const yt = N <= 4 ? Array.from({length: L}, (_, k) => [-1 + (k + 0.5) * d, toBin(k, N)]) : [[-1, "-1"], [-0.5, "-0.5"], [0, "0"], [0.5, "0.5"], [1, "1"]];
      plot(el.querySelector("canvas"), {xlim: [0, 2], ylim: [-1.05, 1.05], xlabel: "Time (ms)", ylabel: N <= 4 ? "Level (code)" : "Voltage (V)", yticks: yt, series});
      el.querySelector("#b1-9-aq-fs").textContent = fmtHz(fs);
      el.querySelector("#b1-9-aq-L").textContent = L + " (" + N + " bit" + (N > 1 ? "s" : "") + ")";
      el.querySelector("#b1-9-aq-d").textContent = fmtV(d);
      el.querySelector("#b1-9-aq-e").textContent = fmtV(emax);
      el.querySelector("#b1-9-aq-c").textContent = codes.slice(0, 6).join(" ") + " ...";
    }
  });

  /* ---------- b1-10-alias: aliasing with sample-rate slider ---------- */
  AT.demo("b1-10-alias", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const f = +el.querySelector("#b1-10-alias-f").value;
      const fs = +el.querySelector("#b1-10-alias-fs").value;
      const aaf = el.querySelector("#b1-10-alias-aaf").value === "on";
      el.querySelector("#b1-10-alias-f-o").textContent = fmtHz(f);
      el.querySelector("#b1-10-alias-fs-o").textContent = fmtHz(fs);
      const k = Math.round(f / fs), fsigned = f - k * fs, fa = Math.abs(fsigned);
      const removed = aaf && f > fs / 2;
      const T = 20 / fs;
      const tx = [], ty = [];
      for(let i = 0; i <= 2000; i++){ const t = i / 2000 * T; tx.push(t * 1000); ty.push(Math.sin(TAU * f * t)); }
      const sx = [], sy = [], rx = [], ry = [];
      for(let n = 0; n <= 20; n++){ const t = n / fs; sx.push(t * 1000); sy.push(removed ? 0 : Math.sin(TAU * f * t)); }
      for(let i = 0; i <= 1000; i++){ const t = i / 1000 * T; rx.push(t * 1000); ry.push(removed ? 0 : Math.sin(TAU * fsigned * t)); }
      const series = [
        {x: tx, y: ty, color: "--accent", width: 1.3},
        {x: rx, y: ry, color: "--left", width: 2.2, dash: [6, 4]},
        {x: sx, y: sy, color: "--right", line: false, marker: "o", msize: 4.5}
      ];
      const cvs = el.querySelectorAll("canvas");
      plot(cvs[0], {xlim: [0, T * 1000], ylim: [-1.2, 1.2], xlabel: "Time (ms), 20 sample periods shown", ylabel: "Amplitude", series});
      /* frequency folding map */
      const fx = [], fy = [];
      for(let i = 0; i <= 600; i++){ const ff = i / 600 * 24000; const kk = Math.round(ff / fs); fx.push(ff / 1000); fy.push(Math.abs(ff - kk * fs) / 1000); }
      const s2 = [
        {x: fx, y: fy, color: "--plot-axis", width: 1.6},
        {x: [fs / 2000, fs / 2000], y: [0, 24], color: "--warn", width: 1.4, dash: [5, 4]},
        {x: [f / 1000], y: [removed ? 0 : fa / 1000], color: removed ? "--muted" : (f > fs / 2 ? "--right" : "--accent"), line: false, marker: "dot", msize: 6}
      ];
      plot(cvs[1], {xlim: [0, 24], ylim: [0, 24], xlabel: "Input frequency (kHz)", ylabel: "Heard after DAC (kHz)", series: s2,
        labels: [{text: "Nyquist fs/2", x: fs / 2000, y: 22, dx: 6, color: "--warn"}]});
      el.querySelector("#b1-10-alias-ny").textContent = fmtHz(fs / 2);
      el.querySelector("#b1-10-alias-spp").textContent = (fs / f).toFixed(2);
      const out = el.querySelector("#b1-10-alias-out"), st = el.querySelector("#b1-10-alias-st");
      if(removed){ out.textContent = "silence"; st.textContent = "removed by anti-aliasing filter"; st.classList.remove("bad"); out.classList.remove("bad"); }
      else if(f > fs / 2){ out.textContent = fmtHz(fa); st.textContent = "ALIASED (false tone)"; st.classList.add("bad"); out.classList.add("bad"); }
      else { out.textContent = fmtHz(fa); st.textContent = f === fs / 2 ? "at the Nyquist limit (unreliable)" : "represented correctly"; st.classList.toggle("bad", f === fs / 2); out.classList.remove("bad"); }
    }
  });

  /* ---------- b1-10-quant: quantisation with bit-depth slider ---------- */
  AT.demo("b1-10-quant", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const N = +el.querySelector("#b1-10-quant-b").value;
      const lev = +el.querySelector("#b1-10-quant-a").value;
      el.querySelector("#b1-10-quant-b-o").textContent = N + " bit" + (N > 1 ? "s" : "");
      el.querySelector("#b1-10-quant-a-o").textContent = lev + " dBFS";
      const A = Math.pow(10, lev / 20) * 0.999, fs = 48000, f = 997, L = Math.pow(2, N), d = 2 / L;
      /* one-cycle view */
      const T = 1 / f;
      const ax = [], ay = [];
      for(let i = 0; i <= 600; i++){ const t = i / 600 * T; ax.push(t * 1000); ay.push(A * Math.sin(TAU * f * t)); }
      const sx = [], qy = [], ex = [], ey = [];
      const ns = Math.ceil(T * fs);
      for(let n = 0; n <= ns; n++){ const t = n / fs, v = A * Math.sin(TAU * f * t), qv = quant(v, N).value; sx.push(t * 1000); qy.push(qv); ex.push(t * 1000); ey.push((qv - v) / d); }
      const yl = Math.max(A * 1.15, d * 0.8);
      const cvs = el.querySelectorAll("canvas");
      plot(cvs[0], {xlim: [0, T * 1000], ylim: [-yl, yl], xlabel: "Time (ms), one cycle of a 997 Hz tone, fs = 48 kHz", ylabel: "Voltage (V, full scale 1 V)",
        series: [{x: ax, y: ay, color: "--accent", width: 2}, {x: sx, y: qy, color: "--left", width: 1.8, step: true}]});
      plot(cvs[1], {xlim: [0, T * 1000], ylim: [-0.75, 0.75], xlabel: "Time (ms)", ylabel: "Error (steps)",
        yticks: [[-0.5, "-1/2"], [0, "0"], [0.5, "+1/2"]],
        series: [{x: [0, T * 1000], y: [0.5, 0.5], color: "--plot-axis", width: 1, dash: [4, 4]}, {x: [0, T * 1000], y: [-0.5, -0.5], color: "--plot-axis", width: 1, dash: [4, 4]},
                 {x: ex, y: ey, color: "--right", width: 1.4, marker: "dot", msize: 2.5}]});
      /* measured SQNR over one second */
      let ps = 0, pe = 0;
      const used = new Set();
      for(let n = 0; n < fs; n++){ const v = A * Math.sin(TAU * f * n / fs), qq = quant(v, N); ps += v * v; pe += (qq.value - v) * (qq.value - v); used.add(qq.code); }
      const snr = 10 * Math.log10(ps / pe);
      el.querySelector("#b1-10-quant-L").textContent = L.toLocaleString("en-GB");
      el.querySelector("#b1-10-quant-d").textContent = fmtV(d);
      el.querySelector("#b1-10-quant-th").textContent = (6.02 * N + 1.76).toFixed(1) + " dB";
      el.querySelector("#b1-10-quant-m").textContent = snr.toFixed(1) + " dB";
      el.querySelector("#b1-10-quant-u").textContent = used.size.toLocaleString("en-GB") + " of " + L.toLocaleString("en-GB");
    }
  });
})();
