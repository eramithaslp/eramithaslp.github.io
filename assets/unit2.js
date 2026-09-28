(function(){
  const {plot} = window.AT;

  /* ---------- shared helpers ---------- */
  function erf(x){
    // Abramowitz and Stegun 7.1.26, absolute error below 1.5e-7
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t + 0.254829592)*t*Math.exp(-x*x);
    return s * y;
  }
  const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
  const pdf = x => Math.exp(-0.5*x*x) / Math.sqrt(2*Math.PI);
  const q = (el, id) => el.querySelector("#" + id);
  const setV = (el, id, txt, bad) => { const n = q(el, id); if(!n) return; n.textContent = txt; n.classList.toggle("bad", !!bad); };
  function fmtTime(s){
    if(!isFinite(s)) return "n/a";
    if(s < 60) return s.toFixed(0) + " s";
    if(s < 3600) return s.toFixed(0) + " s (" + (s/60).toFixed(1) + " min)";
    return (s/3600).toFixed(2) + " h";
  }

  /* ---------- 2.5 tele-audiology link budget ---------- */
  const LINKS = {
    "4g":  {name:"4G",    up:5,  lat:35,  upR:"2 to 10",   latR:"20 to 50"},
    "bb":  {name:"Fibre", up:20, lat:10,  upR:"10 to 100", latR:"5 to 20"},
    "geo": {name:"GEO",   up:2,  lat:300, upR:"1 to 5",    latR:"at least 239, typically 280 to 350"},
    "leo": {name:"LEO",   up:10, lat:30,  upR:"5 to 20",   latR:"20 to 40"}
  };
  const ORDER = ["4g", "bb", "geo", "leo"];
  const VIDEO = {a0:0, v360:0.5, v720:1.5, v1080:3, v2x:3};
  const OVERHEAD = 0.10, EFF = 0.80, PROC_MS = 60;

  AT.demo("u2-link", {
    init(el){
      const net = q(el, "u2-link-net"), up = q(el, "u2-link-up");
      net.addEventListener("change", () => { up.value = LINKS[net.value].up; this.draw(el); });
      el.querySelectorAll("input,select").forEach(i => { if(i !== net) i.addEventListener("input", () => this.draw(el)); });
    },
    draw(el){
      const mode = q(el, "u2-link-mode").value;
      const netKey = q(el, "u2-link-net").value, link = LINKS[netKey];
      const up = +q(el, "u2-link-up").value;
      const vid = VIDEO[q(el, "u2-link-vid").value] || 0;
      const fs = +q(el, "u2-link-fs").value;
      const [bits, ch] = q(el, "u2-link-bits").value.split(",").map(Number);
      const codec = q(el, "u2-link-codec").value;
      const sizeMB = +q(el, "u2-link-size").value;
      q(el, "u2-link-up-o").textContent = up + " Mbit/s";
      q(el, "u2-link-size-o").textContent = sizeMB + " MB";

      const pcm = fs * bits * ch / 1e6;                 // Mbit/s
      const audio = codec === "pcm" ? pcm : 0.064 * ch; // Mbit/s
      const req = (vid + audio) * (1 + OVERHEAD);
      const sync = mode === "sync";
      const oneWay = link.lat + (sync ? PROC_MS : 0);
      const upload = sizeMB * 8 / (up * EFF);           // seconds
      const use = req / up * 100;

      if(sync){
        setV(el, "u2-link-req", req.toFixed(2) + " Mbit/s", req > up);
        setV(el, "u2-link-use", use.toFixed(0) + "% of uplink", use > 80);
      } else {
        setV(el, "u2-link-req", "no minimum (not real time)");
        setV(el, "u2-link-use", "n/a");
      }
      setV(el, "u2-link-time", fmtTime(upload));
      setV(el, "u2-link-lat", oneWay.toFixed(0) + " ms", sync && oneWay > 150);
      setV(el, "u2-link-rtt", (2*oneWay).toFixed(0) + " ms", sync && oneWay > 150);

      const mbPerMin = pcm * 60 / 8;
      let note = "Assumed for " + link.name + ": uplink typically " + link.upR + " Mbit/s, one-way network delay " + link.latR + " ms (" + link.lat + " ms used). ";
      note += "Uncompressed audio at these settings is " + pcm.toFixed(3) + " Mbit/s (" + mbPerMin.toFixed(2) + " MB per minute). ";
      if(sync){
        note += "Required uplink = (video " + vid + " + audio " + audio.toFixed(3) + ") x 1.1 overhead; latency includes about " + PROC_MS + " ms of codec and jitter buffering. ";
        if(req > up) note += "Warning: the session needs more uplink than is available. Lower the video preset, compress audio, or use store-and-forward. ";
        else if(use > 80) note += "Caution: less than 20% headroom; video will degrade when the link fluctuates. ";
        if(oneWay > 400) note += "Warning: one-way latency above 400 ms clearly impairs conversation and makes remote-controlled testing impractical; prefer store-and-forward or a hybrid model.";
        else if(oneWay > 150) note += "Warning: one-way latency is above the 150 ms comfort guidance (ITU-T G.114); expect talk-over and sluggish remote control during synchronous testing.";
        else note += "Latency is within the 150 ms comfort guidance for conversation.";
      } else {
        note += "Store-and-forward is not affected by latency; upload time assumes " + (EFF*100) + "% link efficiency.";
      }
      q(el, "u2-link-note").textContent = note;

      // bar chart across link types
      const vals = ORDER.map(k => {
        const L = LINKS[k], u = k === netKey ? up : L.up;
        return sync ? L.lat + PROC_MS : sizeMB * 8 / (u * EFF) / 60;
      });
      const series = [], labels = [];
      const ymax = sync ? Math.max(500, Math.max(...vals) * 1.15) : Math.max(1, Math.max(...vals) * 1.2);
      ORDER.forEach((k, i) => {
        series.push({x:[i+1, i+1], y:[0, vals[i]], color: k === netKey ? "--accent" : "--plot-axis", width: 28});
        labels.push({text: sync ? vals[i].toFixed(0) + " ms" : vals[i].toFixed(1) + " min", x: i+1, y: vals[i], dy: -6, align: "center", color: "--ink"});
      });
      if(sync){
        series.push({x:[0.4, 4.6], y:[150, 150], color:"--warn", width:1.5, dash:[5,4]});
        series.push({x:[0.4, 4.6], y:[400, 400], color:"--right", width:1.5, dash:[5,4]});
      }
      plot(el.querySelector("canvas"), {
        xlim:[0.4, 4.6], ylim:[0, ymax],
        xticks: ORDER.map((k, i) => [i+1, LINKS[k].name]),
        xlabel: "Link type (typical values; selected link uses your uplink setting)",
        ylabel: sync ? "One-way latency (ms)" : "Upload time (min)",
        series, labels
      });
    }
  });

  /* ---------- 2.7 ROC and confusion matrix ---------- */
  AT.demo("u2-roc", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const thr = +q(el, "u2-roc-thr").value;
      const d = +q(el, "u2-roc-d").value;
      const prev = +q(el, "u2-roc-prev").value;
      q(el, "u2-roc-thr-o").textContent = thr.toFixed(2);
      q(el, "u2-roc-d-o").textContent = d.toFixed(1) + " SD";

      const sens = 1 - Phi(thr - d), spec = Phi(thr);
      const P = Math.round(1000 * prev), N = 1000 - P;
      const TP = Math.round(P * sens), FN = P - TP;
      const TN = Math.round(N * spec), FP = N - TN;
      const ppv = TP + FP > 0 ? TP / (TP + FP) : NaN;
      const npv = TN + FN > 0 ? TN / (TN + FN) : NaN;
      const auc = Phi(d / Math.SQRT2);
      q(el, "u2-roc-tp").textContent = "TP = " + TP;
      q(el, "u2-roc-fn").textContent = "FN = " + FN;
      q(el, "u2-roc-fp").textContent = "FP = " + FP;
      q(el, "u2-roc-tn").textContent = "TN = " + TN;
      setV(el, "u2-roc-sens", sens.toFixed(3));
      setV(el, "u2-roc-spec", spec.toFixed(3));
      setV(el, "u2-roc-ppv", isFinite(ppv) ? ppv.toFixed(3) : "n/a (no positives)", isFinite(ppv) && ppv < 0.5);
      setV(el, "u2-roc-npv", isFinite(npv) ? npv.toFixed(3) : "n/a");
      setV(el, "u2-roc-auc", auc.toFixed(3));

      // distributions
      const xs = [], y0 = [], y1 = [];
      for(let x = -4; x <= 8.0001; x += 0.05){ xs.push(x); y0.push(pdf(x)); y1.push(pdf(x - d)); }
      plot(q(el, "u2-roc-dist"), {
        xlim:[-4, 8], ylim:[0, 0.48], xlabel:"Model score", ylabel:"Density",
        series:[
          {x:xs, y:y0, color:"--left", width:2},
          {x:xs, y:y1, color:"--right", width:2},
          {x:[thr, thr], y:[0, 0.48], color:"--warn", width:2, dash:[5,4]}
        ],
        labels:[
          {text:"normal hearing", x:0, y:0.43, align:"center", color:"--left"},
          {text:"hearing loss", x:d, y:0.43, dy: d < 1.6 ? 14 : 0, align:"center", color:"--right"},
          {text:"positive if score ≥ threshold", x:thr, y:0.02, dx:6, dy:-4, color:"--muted"}
        ]
      });

      // ROC curve
      const fx = [], fy = [];
      for(let t = 8; t >= -6; t -= 0.05){ fx.push(1 - Phi(t)); fy.push(1 - Phi(t - d)); }
      plot(q(el, "u2-roc-curve"), {
        xlim:[0, 1], ylim:[0, 1], xlabel:"False positive rate (1 − specificity)", ylabel:"True positive rate (sensitivity)",
        series:[
          {x:[0, 1], y:[0, 1], color:"--plot-axis", width:1, dash:[4,4]},
          {x:fx, y:fy, color:"--accent", width:2},
          {x:[1 - spec], y:[sens], color:"--accent", line:false, marker:"o", msize:6}
        ],
        labels:[
          {text:"AUC = " + auc.toFixed(3), x:0.6, y:0.12, color:"--ink"},
          {text:"chance", x:0.8, y:0.74, color:"--muted"},
          {text:"operating point", x:1 - spec, y:sens, dx:10, dy:16, color:"--ink"}
        ]
      });
    }
  });

  /* ---------- 2.8 UPS and battery sizing ---------- */
  const SIZES = [500, 600, 800, 1000, 1500, 2000, 3000, 5000, 6000, 8000, 10000];
  const H = 20; // hour-rate at which lead-acid capacity is usually stated
  function runtimes(P, V, Ah, u, eta, k){
    if(P <= 0) return {simple: Infinity, derated: Infinity, I: 0};
    const simple = V * Ah * u * eta / P;          // hours
    const I = P / (V * eta);                      // amperes
    const derated = u * H * Math.pow(Ah / (I * H), k);
    return {simple, derated, I};
  }
  function fmtMin(h){
    if(!isFinite(h)) return "n/a";
    const m = h * 60;
    if(m < 120) return m.toFixed(0) + " min";
    return (m/60).toFixed(1) + " h";
  }

  AT.demo("u2-ups", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      let P = 0;
      for(let i = 1; i <= 6; i++){ const v = parseFloat(q(el, "u2-ups-w" + i).value); if(isFinite(v) && v > 0) P += v; }
      const pf = +q(el, "u2-ups-pf").value;
      const m = +q(el, "u2-ups-m").value / 100;
      const V = +q(el, "u2-ups-v").value;
      const Ah = +q(el, "u2-ups-ah").value;
      const eta = +q(el, "u2-ups-eta").value / 100;
      const u = +q(el, "u2-ups-u").value / 100;
      const k = +q(el, "u2-ups-chem").value;
      q(el, "u2-ups-pf-o").textContent = pf.toFixed(2);
      q(el, "u2-ups-m-o").textContent = (m*100).toFixed(0) + "%";
      q(el, "u2-ups-ah-o").textContent = Ah + " Ah (" + (V*Ah).toFixed(0) + " Wh)";
      q(el, "u2-ups-eta-o").textContent = (eta*100).toFixed(0) + "%";
      q(el, "u2-ups-u-o").textContent = (u*100).toFixed(0) + "%";

      const S = P / pf, Sm = S * (1 + m), Pm = P * (1 + m);
      const size = SIZES.find(s => s >= Sm);
      const r = runtimes(P, V, Ah, u, eta, k);
      setV(el, "u2-ups-p", P.toFixed(0) + " W");
      setV(el, "u2-ups-s", S.toFixed(0) + " VA");
      setV(el, "u2-ups-sm", Sm.toFixed(0) + " VA, " + Pm.toFixed(0) + " W");
      setV(el, "u2-ups-size", P <= 0 ? "n/a" : size ? size + " VA class" : "above 10 kVA: consult", !size && P > 0);
      setV(el, "u2-ups-i", r.I.toFixed(1) + " A");
      setV(el, "u2-ups-t1", fmtMin(r.simple));
      setV(el, "u2-ups-t2", fmtMin(r.derated), isFinite(r.derated) && r.derated * 60 < 10);

      let note = "Choose a UPS whose VA rating is at least " + Sm.toFixed(0) + " VA and whose watt rating is at least " + Pm.toFixed(0) + " W. ";
      note += "Backup times are estimates: the simple method uses battery energy x usable fraction x efficiency; the derated method applies a Peukert correction to the capacity quoted at the " + H + "-hour rate. Real runtime also falls with battery age and temperature, so check the manufacturer's runtime chart.";
      if(P > 0 && r.I > Ah) note += " Battery current is above 1C (more amperes than the battery's Ah value). This is common in small UPS units, but capacity is then well below the rated value, so rely on the derated estimate; a larger battery gives disproportionately longer runtime.";
      q(el, "u2-ups-note").textContent = note;

      // runtime vs load
      const xmax = Math.max(1500, Math.ceil(P * 1.5 / 100) * 100);
      const xs = [], ts = [], td = [];
      for(let L = 20; L <= xmax; L += xmax / 200){
        const rr = runtimes(L, V, Ah, u, eta, k);
        xs.push(L); ts.push(rr.simple * 60); td.push(rr.derated * 60);
      }
      const here = P > 0 ? Math.max(r.simple, r.derated) * 60 : 60;
      const ymax = Math.max(30, Math.ceil(here * 2.5 / 10) * 10);
      const series = [
        {x:xs, y:ts, color:"--plot-axis", width:1.5, dash:[5,4]},
        {x:xs, y:td, color:"--accent", width:2}
      ];
      const labels = [];
      if(P > 0){
        series.push({x:[P, P], y:[0, ymax], color:"--right", width:1.2, dash:[3,3]});
        series.push({x:[P], y:[r.derated * 60], color:"--right", line:false, marker:"o", msize:5});
        labels.push({text: P.toFixed(0) + " W: about " + fmtMin(r.derated), x:P, y:Math.min(r.derated * 60, ymax * 0.9), dx:10, dy:-8, color:"--ink"});
      }
      plot(el.querySelector("canvas"), {
        xlim:[0, xmax], ylim:[0, ymax], xlabel:"Total load (W)", ylabel:"Estimated backup (min)",
        series, labels
      });
    }
  });
})();

(function(){
  const {plot, TAU, rng, gauss, fft} = window.AT;
  const q = (el, id) => el.querySelector("#" + id);
  const setV = (el, id, txt, bad) => { const n = q(el, id); if(!n) return; n.textContent = txt; n.classList.toggle("bad", !!bad); };
  const kHz = f => (+(f / 1000).toFixed(2)) + " kHz";
  const pct = v => (100 * v).toFixed(1) + "%";

  /* ---------- 2.9 analogue modulation: time and spectrum ---------- */
  const FS1 = 512000, N1 = 8192, DF1 = FS1 / N1;   // 62.5 Hz bins
  AT.demo("u2m-analog", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const sch = q(el, "u2m-analog-sch").value;
      const fc = +q(el, "u2m-analog-fc").value * 1000;
      const fm = +q(el, "u2m-analog-fm").value * 1000;
      const m = +q(el, "u2m-analog-m").value;
      const beta = +q(el, "u2m-analog-beta").value;
      q(el, "u2m-analog-fc-o").textContent = kHz(fc);
      q(el, "u2m-analog-fm-o").textContent = kHz(fm);
      q(el, "u2m-analog-m-o").textContent = m.toFixed(2);
      q(el, "u2m-analog-beta-o").textContent = beta.toFixed(2);
      q(el, "u2m-analog-m").disabled = sch !== "am";
      q(el, "u2m-analog-beta").disabled = !(sch === "fm" || sch === "pm");

      const sig = t => {
        const x = Math.cos(TAU * fm * t);
        if(sch === "am") return Math.max(0, 1 + m * x) * Math.cos(TAU * fc * t);
        if(sch === "dsb") return x * Math.cos(TAU * fc * t);
        if(sch === "fm") return Math.cos(TAU * fc * t + beta * Math.sin(TAU * fm * t));
        return Math.cos(TAU * fc * t + beta * x);
      };

      /* time plots: two message periods */
      const T = 2 / fm, NP = 2400;
      const tx = [], xm = [], xc = [], xs = [], eu = [], ed = [];
      for(let i = 0; i <= NP; i++){
        const t = T * i / NP, x = Math.cos(TAU * fm * t);
        tx.push(t * 1000); xm.push(x); xc.push(Math.cos(TAU * fc * t)); xs.push(sig(t));
        if(sch === "am"){ eu.push(1 + m * x); ed.push(-(1 + m * x)); }
        else if(sch === "dsb"){ eu.push(x); ed.push(-x); }
      }
      const xl = [0, T * 1000];
      plot(q(el, "u2m-analog-msg"), {xlim: xl, ylim: [-1.4, 1.4], yticks: [[-1, "-1"], [0, "0"], [1, "1"]], ylabel: "Message",
        series: [{x: tx, y: xm, color: "--accent", width: 2}]});
      plot(q(el, "u2m-analog-car"), {xlim: xl, ylim: [-1.4, 1.4], yticks: [[-1, "-1"], [0, "0"], [1, "1"]], ylabel: "Carrier",
        series: [{x: tx, y: xc, color: "--plot-axis", width: 1.2}]});
      const over = sch === "am" && m > 1;
      const ymax = sch === "am" ? Math.max(1.4, (1 + m) * 1.1) : 1.4;
      const ser = [{x: tx, y: xs, color: "--left", width: 1.2}];
      if(eu.length){
        const ec = over ? "--warn" : "--right";
        ser.push({x: tx, y: eu, color: ec, width: 2, dash: [6, 4]}, {x: tx, y: ed, color: ec, width: 2, dash: [6, 4]});
      }
      plot(q(el, "u2m-analog-mod"), {xlim: xl, ylim: [-ymax, ymax], xlabel: "Time (ms)", ylabel: "Modulated",
        series: ser, labels: over ? [{text: "envelope crosses zero: overmodulation", x: xl[1] * 0.02, y: ymax * 0.8, color: "--warn"}] : []});

      /* spectrum by FFT (coherent: fc and fm fall on bins) */
      const re = new Float64Array(N1), im = new Float64Array(N1);
      for(let n = 0; n < N1; n++) re[n] = sig(n / FS1);
      fft(re, im);
      const half = N1 / 2, P = new Float64Array(half + 1);
      let Ptot = 0;
      for(let k = 0; k <= half; k++){ P[k] = re[k] * re[k] + im[k] * im[k]; Ptot += P[k]; }
      const kc = Math.round(fc / DF1);
      const ref = (N1 / 2) * (N1 / 2);           // power of a unit carrier bin
      let span = (sch === "am" || sch === "dsb") ? 6 * fm : (beta + 4) * fm * 1.15;
      span = Math.max(span, 5000);
      const f0 = Math.max(0, fc - span), f1 = Math.min(FS1 / 2, fc + span);
      const sx = [], sy = [];
      for(let k = Math.ceil(f0 / DF1); k <= Math.floor(f1 / DF1); k++){
        const db = Math.max(-80, 10 * Math.log10(P[k] / ref + 1e-30));
        if(db > -79){ const f = k * DF1 / 1000; sx.push(f, f, f); sy.push(-80, db, -80); }
      }
      if(!sx.length){ sx.push(f0 / 1000); sy.push(-80); }
      plot(q(el, "u2m-analog-spec"), {xlim: [f0 / 1000, f1 / 1000], ylim: [-80, 5], xlabel: "Frequency (kHz)", ylabel: "Level (dB re carrier)",
        series: [{x: sx, y: sy, color: "--accent", width: 1.6}],
        labels: [{text: "fc", x: fc / 1000, y: 1, dx: 4, color: "--muted"}]});

      /* 98% power bandwidth centred on fc */
      let acc = P[kc] || 0, d = 0;
      while(acc < 0.98 * Ptot && d < half){ d++; acc += (kc - d >= 0 ? P[kc - d] : 0) + (kc + d <= half ? P[kc + d] : 0); }
      const bw98 = 2 * d * DF1;
      const carrierShare = (P[kc] || 0) / Ptot;

      let bwRule, dev = "n/a", psb, st = "", bad = false;
      if(sch === "am"){
        bwRule = "2fm = " + kHz(2 * fm);
        psb = pct(1 - carrierShare) + (m <= 1 ? " (theory " + pct(m * m / (2 + m * m)) + ")" : "");
        if(over){ st = "Overmodulated: clipping and splatter"; bad = true; }
        else st = m === 1 ? "100% modulation" : "Normal AM";
      } else if(sch === "dsb"){
        bwRule = "2fm = " + kHz(2 * fm);
        psb = pct(1 - carrierShare) + " (no carrier)";
        st = "Needs coherent detection";
      } else {
        const df = beta * fm;
        bwRule = "Carson " + kHz(2 * (df + fm));
        dev = kHz(df) + (sch === "pm" ? " (for this tone)" : "");
        psb = pct(1 - carrierShare) + " (carrier J0^2 = " + pct(carrierShare) + ")";
        if(df + 3 * fm >= fc){ st = "Deviation near fc: display folds"; bad = true; }
        else st = beta < 0.3 ? "Narrowband (like AM)" : beta <= 1 ? "Moderate index" : "Wideband";
      }
      setV(el, "u2m-analog-bw", bwRule);
      setV(el, "u2m-analog-bw98", kHz(bw98));
      setV(el, "u2m-analog-dev", dev);
      setV(el, "u2m-analog-psb", psb);
      setV(el, "u2m-analog-st", st, bad);
    }
  });

  /* ---------- 2.9 pulse modulation ---------- */
  AT.demo("u2m-pulse", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const view = q(el, "u2m-pulse-view").value;
      const fm = +q(el, "u2m-pulse-fm").value * 1000;
      const fs = +q(el, "u2m-pulse-fs").value * 1000;
      const nb = +q(el, "u2m-pulse-n").value;
      const dlt = +q(el, "u2m-pulse-d").value;
      q(el, "u2m-pulse-fm-o").textContent = kHz(fm);
      q(el, "u2m-pulse-fs-o").textContent = kHz(fs);
      q(el, "u2m-pulse-n-o").textContent = nb + (nb === 1 ? " bit" : " bits") + " (" + (1 << nb) + " levels)";
      q(el, "u2m-pulse-d-o").textContent = dlt.toFixed(2);
      q(el, "u2m-pulse-n").disabled = view !== "pcm";
      q(el, "u2m-pulse-d").disabled = view !== "dm";

      const A = 0.9, msg = t => A * Math.sin(TAU * fm * t);
      const Ts = 1 / fs, T = 2 / fm, ms = 1000;
      const nS = Math.floor(T / Ts + 1e-9);
      const OFF = 1.4;                                    // upper trace offset
      const mx = [], my = [];
      for(let i = 0; i <= 600; i++){ const t = T * i / 600; mx.push(t * ms); my.push(msg(t)); }
      const upper = [{x: mx, y: my, color: "--accent", width: 2, off: OFF}];
      const lx = [], ly = [], ux = [], uy = [];
      const L = 1 << nb, D = 2 / L;
      const quant = v => { const c = Math.min(L - 1, Math.max(0, Math.floor((v + 1) / D))); return c; };
      const lvl = c => -1 + (c + 0.5) * D;
      const lo = -1.0, hi = 0.0;                          // lower trace logic levels
      const push = (x, y) => { lx.push(x * ms); ly.push(y); };

      if(view === "pam"){
        const base = -0.5, g = 0.55, tau = 0.4 * Ts;
        push(0, base);
        for(let k = 0; k < nS; k++){
          const t0 = k * Ts, v = msg(t0);
          push(t0, base); push(t0, base + g * v); push(t0 + tau, base + g * v); push(t0 + tau, base);
          ux.push(t0 * ms); uy.push(v + OFF);
        }
        push(T, base);
        upper.push({x: ux, y: uy, color: "--right", width: 1.4, line: false, marker: "dot", msize: 2.5});
      } else if(view === "pwm" || view === "ppm"){
        push(0, lo);
        for(let k = 0; k < nS; k++){
          const t0 = k * Ts, v = msg(t0), frac = (1 + v) / 2;
          if(view === "pwm"){ const w = frac * Ts; push(t0, lo); push(t0, hi); push(t0 + w, hi); push(t0 + w, lo); }
          else { const p = t0 + (0.1 + 0.7 * frac) * Ts, w = 0.12 * Ts; push(p, lo); push(p, hi); push(p + w, hi); push(p + w, lo); }
          ux.push(t0 * ms); uy.push(v + OFF);
        }
        push(T, lo);
        upper.push({x: ux, y: uy, color: "--right", width: 1.4, line: false, marker: "dot", msize: 2.5});
      } else if(view === "pcm"){
        push(0, lo);
        for(let k = 0; k < nS; k++){
          const t0 = k * Ts, c = quant(msg(t0)), v = lvl(c);
          ux.push(t0 * ms, (t0 + Ts) * ms); uy.push(v, v);
          for(let b = 0; b < nb; b++){
            const bit = (c >> (nb - 1 - b)) & 1, tb = t0 + b * Ts / nb;
            push(tb, bit ? hi : lo); push(tb + Ts / nb, bit ? hi : lo);
          }
        }
        push(T, lo);
        upper.push({x: ux, y: uy, color: "--right", width: 1.8, off: OFF});
      } else {
        let y = 0;
        push(0, lo);
        for(let k = 0; k < nS; k++){
          const t0 = k * Ts, bit = msg(t0) >= y ? 1 : 0;
          y += bit ? dlt : -dlt;
          ux.push(t0 * ms, (t0 + Ts) * ms); uy.push(y, y);
          push(t0, bit ? hi : lo); push(t0 + Ts, bit ? hi : lo);
        }
        push(T, lo);
        upper.push({x: ux, y: uy, color: "--right", width: 1.8, off: OFF});
      }
      const lowLabel = {pam: "PAM pulses", pwm: "PWM", ppm: "PPM", pcm: "PCM bits (MSB first)", dm: "DM bits (1 = up)"}[view];
      plot(q(el, "u2m-pulse-cv"), {xlim: [0, T * ms], ylim: [-1.35, 2.55], xlabel: "Time (ms)",
        yticks: (view === "pam" ? [[-0.5, "0"]] : [[lo, "0"], [hi, "1"]]).concat([[OFF - 1, "-1"], [OFF, "0"], [OFF + 1, "+1"]]),
        series: [...upper, {x: lx, y: ly, color: "--left", width: 1.5}],
        labels: [{text: "message", x: 0, y: 2.4, dx: 4, color: "--muted"}, {text: lowLabel, x: 0, y: 0.32, dx: 4, color: "--muted"}]});

      /* readouts, measured over a long run */
      const NL = 4000;
      let ps = 0, pe = 0, yd = 0, psd = 0, ped = 0;
      for(let k = 0; k < NL; k++){
        const v = msg(k / fs + 0.37e-4);
        const e = v - lvl(quant(v)); ps += v * v; pe += e * e;
        const bit = v >= yd ? 1 : 0; yd += bit ? dlt : -dlt; const e2 = v - yd;
        if(k > 50){ psd += v * v; ped += e2 * e2; }
      }
      const sq = 10 * Math.log10(ps / pe), sqd = 10 * Math.log10(psd / ped);
      const ratio = dlt * fs / (TAU * fm * A);
      const nyOK = fs > 2 * fm;
      if(view === "pcm") setV(el, "u2m-pulse-rb", (fs * nb / 1000).toFixed(0) + " kbit/s (fs x n)");
      else if(view === "dm") setV(el, "u2m-pulse-rb", (fs / 1000).toFixed(0) + " kbit/s (1 bit/sample)");
      else setV(el, "u2m-pulse-rb", "analogue pulses: " + (fs / 1000).toFixed(0) + " k pulses/s");
      setV(el, "u2m-pulse-ny", nyOK ? "fs > 2fm: OK" : "fs <= 2fm: aliasing", !nyOK);
      if(view === "pcm"){ setV(el, "u2m-pulse-sq", sq.toFixed(1) + " dB"); setV(el, "u2m-pulse-sqt", (6.02 * nb + 1.76 - 0.92).toFixed(1) + " dB"); }
      else if(view === "dm"){ setV(el, "u2m-pulse-sq", sqd.toFixed(1) + " dB (DM)"); setV(el, "u2m-pulse-sqt", "n/a"); }
      else { setV(el, "u2m-pulse-sq", "n/a"); setV(el, "u2m-pulse-sqt", "n/a"); }
      if(view === "dm") setV(el, "u2m-pulse-sl", ratio.toFixed(2) + (ratio < 1 ? ": slope overload" : ratio > 3 ? ": granular noise large" : ": tracking"), ratio < 1);
      else setV(el, "u2m-pulse-sl", "n/a (DM view only)");
    }
  });

  /* ---------- 2.9 digital modulation ---------- */
  function erfc(x){
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z*z - 1.26551223 + t*(1.00002368 + t*(0.37409196 + t*(0.09678418 + t*(-0.18628806 + t*(0.27886807 + t*(-1.13520398 + t*(1.48851587 + t*(-0.82215223 + t*0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const Qf = x => 0.5 * erfc(x / Math.SQRT2);
  function constellation(M){
    if(M === 2) return [[-1, 0], [1, 0]];
    const s = Math.round(Math.sqrt(M)), pts = [], nrm = Math.sqrt(2 * (M - 1) / 3);
    for(let i = 0; i < s; i++) for(let j = 0; j < s; j++) pts.push([(2*i - s + 1) / nrm, (2*j - s + 1) / nrm]);
    return pts;
  }
  const fmtP = p => p <= 0 ? "0" : p < 1e-6 ? "< 1e-6" : p < 0.001 ? p.toExponential(1) : p.toFixed(4);

  AT.demo("u2m-digital", {
    init(el){
      el._seed = 7; el._bits = 11;
      el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el)));
      q(el, "u2m-digital-rand").addEventListener("click", () => {
        const r = rng(++el._bits * 97); let s = "";
        for(let i = 0; i < 16; i++) s += r() < 0.5 ? "0" : "1";
        q(el, "u2m-digital-bits").value = s; this.draw(el);
      });
      q(el, "u2m-digital-seed").addEventListener("click", () => { el._seed++; this.draw(el); });
    },
    draw(el){
      if(el._seed === undefined){ el._seed = 7; el._bits = 11; }
      let bits = (q(el, "u2m-digital-bits").value.match(/[01]/g) || []).slice(0, 32).map(Number);
      if(!bits.length) bits = [1, 0, 1, 1, 0, 0, 1, 0];
      if(bits.length % 2) bits.push(0);
      const cyc = +q(el, "u2m-digital-cyc").value;
      const M = +q(el, "u2m-digital-mod").value;
      const eb = +q(el, "u2m-digital-eb").value;
      const rb = +q(el, "u2m-digital-rb").value;
      q(el, "u2m-digital-cyc-o").textContent = cyc;
      q(el, "u2m-digital-eb-o").textContent = eb.toFixed(1) + " dB";
      q(el, "u2m-digital-rb-o").textContent = rb + " Mbit/s";

      /* waveforms */
      const nb = bits.length, SPB = 60, B = {d: 10.4, a: 7.8, f: 5.2, p: 2.6, q: 0};
      const X = [], D = [], ASK = [], FSK = [], BP = [], QP = [];
      let ph = 0;
      for(let i = 0; i < nb * SPB; i++){
        const t = i / SPB, k = Math.floor(t), b = bits[k];
        const f = b ? 2 * cyc : cyc;
        X.push(t); D.push(B.d + (b ? 0.8 : -0.8));
        ASK.push(B.a + b * Math.cos(TAU * cyc * t));
        FSK.push(B.f + Math.cos(ph)); ph += TAU * f / SPB;
        BP.push(B.p + Math.cos(TAU * cyc * t + (b ? 0 : Math.PI)));
        const s0 = k - (k % 2), I = bits[s0] ? 1 : -1, Qv = bits[s0 + 1] ? 1 : -1;
        QP.push(B.q + (I * Math.cos(TAU * cyc * t) - Qv * Math.sin(TAU * cyc * t)) / Math.SQRT2);
      }
      X.push(nb); D.push(D[D.length - 1]); ASK.push(ASK[ASK.length - 1]); FSK.push(FSK[FSK.length - 1]); BP.push(BP[BP.length - 1]); QP.push(QP[QP.length - 1]);
      const lab = (text, y) => ({text, x: 0, y, dx: 4, color: "--muted"});
      plot(q(el, "u2m-digital-wave"), {xlim: [0, nb], ylim: [-1.3, 12.2], xlabel: "Time (bit periods)",
        yticks: [[B.d, "data"], [B.a, "ASK"], [B.f, "FSK"], [B.p, "BPSK"], [B.q, "QPSK"]],
        series: [{x: X, y: D, color: "--ink", width: 1.8}, {x: X, y: ASK, color: "--accent", width: 1.3},
          {x: X, y: FSK, color: "--left", width: 1.3}, {x: X, y: BP, color: "--warn", width: 1.3}, {x: X, y: QP, color: "--left", width: 1.3}],
        labels: [lab("bits: " + bits.join(""), B.d + 1.2)]});

      /* constellation with noise */
      const k = Math.log2(M), es = Math.pow(10, eb / 10) * k, sig = Math.sqrt(1 / (2 * es));
      const pts = constellation(M), r = rng(1000 + el._seed * 31 + M);
      const NS = 2000, okx = [], oky = [], erx = [], ery = [];
      let err = 0;
      for(let n = 0; n < NS; n++){
        const idx = Math.floor(r() * M), p = pts[idx];
        const x = p[0] + sig * gauss(r), y = p[1] + sig * gauss(r);
        let best = 0, bd = Infinity;
        for(let j = 0; j < M; j++){ const dx = x - pts[j][0], dy = y - pts[j][1], d2 = dx*dx + dy*dy; if(d2 < bd){ bd = d2; best = j; } }
        if(best === idx){ okx.push(x); oky.push(y); } else { err++; erx.push(x); ery.push(y); }
      }
      const cv = q(el, "u2m-digital-const");
      const lim = 1.75, w = cv.clientWidth || 480, h = 340;
      const aspect = Math.max(1, (w - 70) / (h - 50));
      const ser = [];
      /* decision boundaries */
      if(M === 2) ser.push({x: [0, 0], y: [-lim, lim], color: "--plot-axis", width: 1, dash: [4, 4]});
      else {
        const s = Math.round(Math.sqrt(M)), nrm = Math.sqrt(2 * (M - 1) / 3);
        for(let i = 1; i < s; i++){ const v = (2*i - s) / nrm;
          ser.push({x: [v, v], y: [-lim * 2, lim * 2], color: "--plot-axis", width: 1, dash: [4, 4]});
          ser.push({x: [-lim * aspect * 2, lim * aspect * 2], y: [v, v], color: "--plot-axis", width: 1, dash: [4, 4]}); }
      }
      ser.push({x: okx, y: oky, color: "--left", line: false, marker: "dot", msize: 1.6});
      ser.push({x: erx, y: ery, color: "--right", line: false, marker: "dot", msize: 2.2});
      ser.push({x: pts.map(p => p[0]), y: pts.map(p => p[1]), color: "--accent", line: false, marker: "o", msize: M >= 64 ? 3 : 5});
      plot(cv, {xlim: [-lim * aspect, lim * aspect], ylim: [-lim, lim], xlabel: "In-phase (I)", ylabel: "Quadrature (Q)", series: ser});

      /* readouts */
      let pth;
      if(M === 2) pth = Qf(Math.sqrt(2 * es));
      else { const pm = 2 * (1 - 1 / Math.sqrt(M)) * Qf(Math.sqrt(3 * es / (M - 1))); pth = 1 - (1 - pm) * (1 - pm); }
      const rs = rb / k;
      setV(el, "u2m-digital-k", k + " (M = " + M + ")");
      setV(el, "u2m-digital-rs", (+rs.toFixed(3)) + " Msymbol/s");
      setV(el, "u2m-digital-bw", (+(rs * 1.25).toFixed(3)) + " MHz");
      setV(el, "u2m-digital-es", (10 * Math.log10(es)).toFixed(1) + " dB");
      setV(el, "u2m-digital-ser", fmtP(err / NS) + " (" + err + " of " + NS + ")", err / NS > 0.01);
      setV(el, "u2m-digital-sert", fmtP(pth));
    }
  });
})();

(function(){
  const {plot, heat, css, TAU, rng, gauss, fft} = window.AT;
  const db10 = v => 10 * Math.log10(v);
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const bind = (el, self) => el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => self.draw(el)));

  /* =====================================================================
     u2ai-mask: time-frequency masking with oracle and estimated masks
     ===================================================================== */
  const FS = 8000, NFFT = 256, HOP = 128, DUR = 1.2;
  const maskCache = {};
  function stftOf(x){
    const win = new Float64Array(NFFT);
    for(let i = 0; i < NFFT; i++) win[i] = 0.5 - 0.5 * Math.cos(TAU * i / NFFT);
    const nf = Math.floor((x.length - NFFT) / HOP) + 1, nb = NFFT / 2 + 1;
    const re = new Float64Array(nf * nb), im = new Float64Array(nf * nb);
    const r = new Float64Array(NFFT), q = new Float64Array(NFFT);
    for(let m = 0; m < nf; m++){
      for(let i = 0; i < NFFT; i++){ r[i] = x[m * HOP + i] * win[i]; q[i] = 0; }
      fft(r, q);
      for(let k = 0; k < nb; k++){ re[m * nb + k] = r[k]; im[m * nb + k] = q[k]; }
    }
    return {re, im, nf, nb};
  }
  function makeSignals(noiseType){
    if(maskCache[noiseType]) return maskCache[noiseType];
    const n = Math.round(FS * DUR), s = new Float64Array(n), w = new Float64Array(n);
    const r = rng(20261);
    let ph = 0;
    for(let i = 0; i < n; i++){
      const t = i / FS;
      const f0 = 125 + 45 * Math.sin(TAU * 0.6 * t + 0.3);            /* gliding pitch */
      ph += TAU * f0 / FS;
      const u = 0.5 + 0.5 * Math.sin(TAU * 0.8 * t);                  /* vowel trajectory 0..1 */
      const F1 = 700 - 400 * u, F2 = 1100 + 1200 * u, F3 = 2600;       /* formant-like peaks */
      const syl = Math.pow(Math.max(0, Math.sin(TAU * 3.5 * t)), 1.5); /* syllables with pauses */
      let v = 0;
      for(let k = 1; k * f0 < 3800; k++){
        const f = k * f0;
        const env = Math.exp(-Math.pow((f - F1) / 150, 2)) + 0.6 * Math.exp(-Math.pow((f - F2) / 200, 2))
                  + 0.25 * Math.exp(-Math.pow((f - F3) / 250, 2)) + 0.03;
        v += env * Math.sin(k * ph);
      }
      s[i] = syl * v;
    }
    let lp = 0;
    for(let i = 0; i < n; i++){
      const g = gauss(r);
      if(noiseType === "white") w[i] = g;
      else { lp = 0.9 * lp + g; w[i] = lp; }                          /* low-pass, speech-shaped-like */
    }
    const S = stftOf(s), N = stftOf(w);
    let es = 0, en = 0;
    for(let i = 0; i < S.re.length; i++){ es += S.re[i] ** 2 + S.im[i] ** 2; en += N.re[i] ** 2 + N.im[i] ** 2; }
    return (maskCache[noiseType] = {S, N, es, en});
  }

  AT.demo("u2ai-mask", {
    init(el){ bind(el, this); },
    draw(el){
      const snr = +el.querySelector("#u2ai-mask-snr").value;
      const type = el.querySelector("#u2ai-mask-type").value;
      const lc = +el.querySelector("#u2ai-mask-lc").value;
      const noiseType = el.querySelector("#u2ai-mask-noise").value;
      el.querySelector("#u2ai-mask-snr-o").textContent = (snr > 0 ? "+" : "") + snr + " dB";
      el.querySelector("#u2ai-mask-lc-o").textContent = (lc > 0 ? "+" : "") + lc + " dB" + (type === "ibm" ? "" : " (IBM only)");
      const {S, N, es, en} = makeSignals(noiseType);
      const g = Math.sqrt(es / (en * Math.pow(10, snr / 10)));      /* noise gain for the chosen SNR */
      const nf = S.nf, nb = S.nb, L = nf * nb;
      const Xp = new Float64Array(L), M = new Float64Array(L);
      const lcr = Math.pow(10, lc / 10);
      const frameE = new Float64Array(nf);
      for(let m = 0; m < nf; m++) for(let k = 0; k < nb; k++){
        const i = m * nb + k, xr = S.re[i] + g * N.re[i], xi = S.im[i] + g * N.im[i];
        Xp[i] = xr * xr + xi * xi; frameE[m] += Xp[i];
      }
      if(type === "wiener"){
        const sorted = Array.from(frameE).sort((a, b) => a - b), thr = sorted[Math.floor(0.15 * nf)];
        const lam = new Float64Array(nb); let cnt = 0;
        for(let m = 0; m < nf; m++) if(frameE[m] < thr){ cnt++; for(let k = 0; k < nb; k++) lam[k] += Xp[m * nb + k]; }
        for(let k = 0; k < nb; k++) lam[k] = lam[k] / Math.max(cnt, 1) + 1e-12;
        for(let m = 0; m < nf; m++) for(let k = 0; k < nb; k++){
          const i = m * nb + k, xi = Math.max(Xp[i] / lam[k] - 1, 1e-3);
          M[i] = Math.max(xi / (1 + xi), 0.1);
        }
      } else {
        for(let i = 0; i < L; i++){
          const ps = S.re[i] ** 2 + S.im[i] ** 2, pn = g * g * (N.re[i] ** 2 + N.im[i] ** 2);
          M[i] = type === "ibm" ? (ps > lcr * pn ? 1 : 0) : Math.sqrt(ps / (ps + pn + 1e-20));
        }
      }
      let e0 = 0, e1 = 0, kept = 0, sig = 0, noi = 0, pmax = 0;
      const Ey = new Float64Array(L);
      for(let i = 0; i < L; i++){
        const xr = S.re[i] + g * N.re[i], xi = S.im[i] + g * N.im[i];
        const yr = M[i] * xr, yi = M[i] * xi;
        Ey[i] = yr * yr + yi * yi;
        e1 += (yr - S.re[i]) ** 2 + (yi - S.im[i]) ** 2;
        sig += S.re[i] ** 2 + S.im[i] ** 2; noi += g * g * (N.re[i] ** 2 + N.im[i] ** 2);
        if(M[i] > 0.5) kept++;
        if(Xp[i] > pmax) pmax = Xp[i];
      }
      e0 = noi;
      const snrIn = db10(sig / e0), snrOut = db10(sig / e1);
      /* heat maps: columns are frames (x), rows are bins (y) */
      const nbShow = nb, dN = new Float64Array(nf * nbShow), dM = new Float64Array(nf * nbShow), dY = new Float64Array(nf * nbShow);
      const ref = db10(pmax);
      for(let m = 0; m < nf; m++) for(let k = 0; k < nbShow; k++){
        const i = m * nb + k, j = m * nbShow + k;
        dN[j] = db10(Xp[i] + 1e-20) - ref; dY[j] = db10(Ey[i] + 1e-20) - ref; dM[j] = M[i];
      }
      const cv = el.querySelectorAll("canvas");
      const common = {nx: nf, ny: nbShow, xlim: [0, nf * HOP / FS], ylim: [0, FS / 2000], xlabel: "Time (s)", ylabel: "Frequency (kHz)"};
      heat(cv[0], Object.assign({data: dN, zmin: -60, zmax: 0}, common));
      heat(cv[1], Object.assign({data: dM, zmin: 0, zmax: 1}, common));
      heat(cv[2], Object.assign({data: dY, zmin: -60, zmax: 0}, common));
      el.querySelector("#u2ai-mask-in").textContent = f1(snrIn) + " dB";
      el.querySelector("#u2ai-mask-out").textContent = f1(snrOut) + " dB";
      el.querySelector("#u2ai-mask-gain").textContent = (snrOut - snrIn >= 0 ? "+" : "") + f1(snrOut - snrIn) + " dB";
      el.querySelector("#u2ai-mask-kept").textContent = Math.round(100 * kept / L) + " %";
      el.querySelector("#u2ai-mask-kind").textContent = type === "wiener" ? "estimated from the mixture" : "oracle (uses clean speech and noise)";
    }
  });

  /* =====================================================================
     Shared vowel data (F1, F2) for u2ai-classify and u2ai-train
     ===================================================================== */
  /* approximate adult male averages of the Peterson and Barney type; illustrative only */
  const VOW = [
    {lab: "i", f1: 270, f2: 2290, col: "--left"},
    {lab: "e", f1: 530, f2: 1840, col: "--accent"},
    {lab: "a", f1: 730, f2: 1090, col: "--right"},
    {lab: "o", f1: 570, f2: 840, col: "--warn"},
    {lab: "u", f1: 300, f2: 870, col: "--ink"}
  ];
  const NC = VOW.length;
  function vowelData(seed, nPer, spread){
    const r = rng(seed), X = [], y = [];
    for(let c = 0; c < NC; c++) for(let j = 0; j < nPer; j++){
      const scale = 1 + spread * 0.12 * gauss(r);           /* talker vocal-tract scaling */
      const a = VOW[c].f1 * scale * (1 + spread * 0.08 * gauss(r));
      const b = VOW[c].f2 * scale * (1 + spread * 0.07 * gauss(r));
      X.push([Math.max(150, a), Math.max(500, b)]); y.push(c);
    }
    return {X, y};
  }
  /* standardise with fixed, typical scaling so the two formants carry similar weight */
  const Z = p => [(p[0] - 500) / 180, (p[1] - 1400) / 550];
  const F2LIM = [3000, 500], F1LIM = [1000, 150];
  const F2T = [[3000, "3000"], [2500, "2500"], [2000, "2000"], [1500, "1500"], [1000, "1000"], [500, "500"]];
  const F1T = [[200, "200"], [400, "400"], [600, "600"], [800, "800"], [1000, "1000"]];

  function paintRegions(cv, predict, alpha){
    /* paint decision regions behind what plot() already drew, using the same margins as plot() */
    const ctx = cv.getContext("2d"), w = cv.clientWidth, h = +cv.dataset.h;
    const m = {l: 56, r: 14, t: 10, b: 40}, pw = w - m.l - m.r, ph = h - m.t - m.b;
    const G = 90, gh = 60, cols = VOW.map(v => css(v.col));
    const off = document.createElement("canvas"); off.width = G; off.height = gh;
    const octx = off.getContext("2d");
    for(let i = 0; i < G; i++) for(let j = 0; j < gh; j++){
      const fx = F2LIM[0] + (i + 0.5) / G * (F2LIM[1] - F2LIM[0]);
      const fy = F1LIM[0] + (j + 0.5) / gh * (F1LIM[1] - F1LIM[0]);
      octx.fillStyle = cols[predict([fy, fx])];
      octx.fillRect(i, gh - 1 - j, 1, 1);
    }
    ctx.save(); ctx.globalCompositeOperation = "destination-over"; ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, m.l, m.t, pw, ph);
    ctx.restore();
  }
  function scatterSeries(tr, te){
    const out = [];
    for(let c = 0; c < NC; c++){
      const a = {x: [], y: [], color: VOW[c].col, line: false, marker: "o", msize: 3.5};
      const b = {x: [], y: [], color: VOW[c].col, line: false, marker: "x", msize: 3.5};
      tr.X.forEach((p, i) => { if(tr.y[i] === c){ a.x.push(p[1]); a.y.push(p[0]); } });
      if(te) te.X.forEach((p, i) => { if(te.y[i] === c){ b.x.push(p[1]); b.y.push(p[0]); } });
      out.push(a); if(te) out.push(b);
    }
    return out;
  }
  const vowelLabels = () => VOW.map(v => ({text: "/" + v.lab + "/", x: v.f2, y: v.f1, dx: 8, dy: -8, color: "--ink"}));
  function accuracy(pred, D){ let ok = 0; D.X.forEach((p, i) => { if(pred(p) === D.y[i]) ok++; }); return ok / D.X.length; }
  function confusionHTML(pred, D){
    const C = VOW.map(() => VOW.map(() => 0));
    D.X.forEach((p, i) => C[D.y[i]][pred(p)]++);
    const th = '<th style="text-transform:none">';
    let h = '<table class="tbl"><thead><tr>' + th + "true / predicted</th>" + VOW.map(v => th + "/" + v.lab + "/</th>").join("") + "</tr></thead><tbody>";
    C.forEach((row, i) => { h += "<tr><td>/" + VOW[i].lab + "/</td>" + row.map(v => '<td class="num">' + v + "</td>").join("") + "</tr>"; });
    return h + "</tbody></table>";
  }

  /* ---------- classifiers ---------- */
  function knn(tr, k){
    const Zt = tr.X.map(Z);
    return p => {
      const z = Z(p), d = Zt.map((q, i) => [(q[0] - z[0]) ** 2 + (q[1] - z[1]) ** 2, tr.y[i]]).sort((a, b) => a[0] - b[0]);
      const votes = new Array(NC).fill(0);
      for(let i = 0; i < Math.min(k, d.length); i++) votes[d[i][1]] += 1 + 1e-6 / (1 + i);  /* nearer neighbour breaks ties */
      return votes.indexOf(Math.max(...votes));
    };
  }
  function centroid(tr){
    const cen = VOW.map(() => [0, 0, 0]);
    tr.X.forEach((p, i) => { const z = Z(p), c = cen[tr.y[i]]; c[0] += z[0]; c[1] += z[1]; c[2]++; });
    cen.forEach(c => { c[0] /= c[2]; c[1] /= c[2]; });
    return p => { const z = Z(p); let best = 0, bd = Infinity; cen.forEach((c, i) => { const d = (c[0] - z[0]) ** 2 + (c[1] - z[1]) ** 2; if(d < bd){ bd = d; best = i; } }); return best; };
  }
  function lda(tr){
    /* linear discriminant analysis: class means, pooled covariance, equal priors */
    const mu = VOW.map(() => [0, 0, 0]);
    const Zt = tr.X.map(Z);
    Zt.forEach((z, i) => { const c = mu[tr.y[i]]; c[0] += z[0]; c[1] += z[1]; c[2]++; });
    mu.forEach(c => { c[0] /= c[2]; c[1] /= c[2]; });
    let a = 0, b = 0, d = 0;
    Zt.forEach((z, i) => { const c = mu[tr.y[i]], u = z[0] - c[0], v = z[1] - c[1]; a += u * u; b += u * v; d += v * v; });
    const n = Zt.length - NC; a /= n; b /= n; d /= n;
    const det = a * d - b * b, ia = d / det, ib = -b / det, id = a / det;
    const W = mu.map(c => [ia * c[0] + ib * c[1], ib * c[0] + id * c[1]]);
    const B = mu.map((c, i) => -0.5 * (c[0] * W[i][0] + c[1] * W[i][1]));
    return p => { const z = Z(p); let best = 0, bs = -Infinity; W.forEach((w, i) => { const s = w[0] * z[0] + w[1] * z[1] + B[i]; if(s > bs){ bs = s; best = i; } }); return best; };
  }

  AT.demo("u2ai-classify", {
    init(el){ bind(el, this); },
    draw(el){
      const kind = el.querySelector("#u2ai-classify-model").value;
      const k = +el.querySelector("#u2ai-classify-k").value;
      const spread = +el.querySelector("#u2ai-classify-spread").value / 10;
      const nPer = +el.querySelector("#u2ai-classify-n").value;
      el.querySelector("#u2ai-classify-k-o").textContent = k + (kind === "knn" ? "" : " (k-NN only)");
      el.querySelector("#u2ai-classify-spread-o").textContent = "×" + spread.toFixed(1);
      el.querySelector("#u2ai-classify-n-o").textContent = nPer + " per vowel";
      const tr = vowelData(11, nPer, spread), te = vowelData(97, 30, spread);
      const pred = kind === "knn" ? knn(tr, k) : kind === "centroid" ? centroid(tr) : lda(tr);
      const cv = el.querySelector("canvas");
      plot(cv, {xlim: F2LIM, ylim: F1LIM, xticks: F2T, yticks: F1T, xlabel: "F2 (Hz)", ylabel: "F1 (Hz)",
        series: scatterSeries(tr, te), labels: vowelLabels()});
      paintRegions(cv, pred, 0.16);
      el.querySelector("#u2ai-classify-tr").textContent = (100 * accuracy(pred, tr)).toFixed(1) + " %";
      el.querySelector("#u2ai-classify-te").textContent = (100 * accuracy(pred, te)).toFixed(1) + " %";
      el.querySelector("#u2ai-classify-cm").innerHTML = confusionHTML(pred, te);
    }
  });

  /* =====================================================================
     u2ai-train: softmax regression or a small network trained by gradient descent
     ===================================================================== */
  const H = 8;
  function newModel(kind){
    const r = rng(5);
    if(kind === "lin") return {kind, W: VOW.map(() => [0, 0]), b: new Array(NC).fill(0)};
    return {kind,
      W1: Array.from({length: H}, () => [gauss(r) * 0.8, gauss(r) * 0.8]), b1: Array.from({length: H}, () => 0.2 * gauss(r)),
      W2: VOW.map(() => Array.from({length: H}, () => gauss(r) * 0.5)), b2: new Array(NC).fill(0)};
  }
  function forward(M, z){
    if(M.kind === "lin"){
      const s = M.W.map((w, c) => w[0] * z[0] + w[1] * z[1] + M.b[c]);
      return {p: softmax(s)};
    }
    const h = M.W1.map((w, j) => Math.tanh(w[0] * z[0] + w[1] * z[1] + M.b1[j]));
    const s = M.W2.map((w, c) => w.reduce((acc, v, j) => acc + v * h[j], M.b2[c]));
    return {p: softmax(s), h};
  }
  function softmax(s){ const mx = Math.max(...s), e = s.map(v => Math.exp(v - mx)), t = e.reduce((a, b) => a + b, 0); return e.map(v => v / t); }
  function lossOf(M, D){ let L = 0; D.Z.forEach((z, i) => { L -= Math.log(Math.max(forward(M, z).p[D.y[i]], 1e-12)); }); return L / D.Z.length; }
  function step(M, D, lr){
    const n = D.Z.length;
    if(M.kind === "lin"){
      const gW = VOW.map(() => [0, 0]), gb = new Array(NC).fill(0);
      D.Z.forEach((z, i) => { const {p} = forward(M, z); for(let c = 0; c < NC; c++){ const d = p[c] - (D.y[i] === c ? 1 : 0); gW[c][0] += d * z[0]; gW[c][1] += d * z[1]; gb[c] += d; } });
      for(let c = 0; c < NC; c++){ M.W[c][0] -= lr * gW[c][0] / n; M.W[c][1] -= lr * gW[c][1] / n; M.b[c] -= lr * gb[c] / n; }
      return;
    }
    const gW1 = M.W1.map(() => [0, 0]), gb1 = new Array(H).fill(0), gW2 = M.W2.map(() => new Array(H).fill(0)), gb2 = new Array(NC).fill(0);
    D.Z.forEach((z, i) => {
      const {p, h} = forward(M, z), dh = new Array(H).fill(0);
      for(let c = 0; c < NC; c++){ const d = p[c] - (D.y[i] === c ? 1 : 0); gb2[c] += d; for(let j = 0; j < H; j++){ gW2[c][j] += d * h[j]; dh[j] += d * M.W2[c][j]; } }
      for(let j = 0; j < H; j++){ const da = dh[j] * (1 - h[j] * h[j]); gW1[j][0] += da * z[0]; gW1[j][1] += da * z[1]; gb1[j] += da; }
    });
    for(let j = 0; j < H; j++){ M.W1[j][0] -= lr * gW1[j][0] / n; M.W1[j][1] -= lr * gW1[j][1] / n; M.b1[j] -= lr * gb1[j] / n; }
    for(let c = 0; c < NC; c++){ for(let j = 0; j < H; j++) M.W2[c][j] -= lr * gW2[c][j] / n; M.b2[c] -= lr * gb2[c] / n; }
  }
  const argmax = a => a.indexOf(Math.max(...a));

  AT.demo("u2ai-train", {
    init(el){
      const self = this;
      const reset = () => {
        const kind = el.querySelector("#u2ai-train-model").value;
        const tr = vowelData(11, 20, 1), te = vowelData(97, 30, 1);
        tr.Z = tr.X.map(Z); te.Z = te.X.map(Z);
        el._st = {M: newModel(kind), tr, te, it: 0, hist: []};
        el._st.hist.push([0, lossOf(el._st.M, tr), lossOf(el._st.M, te)]);
      };
      const run = n => {
        const st = el._st, lr = Math.pow(10, +el.querySelector("#u2ai-train-lr").value / 10);
        for(let i = 0; i < n; i++){
          step(st.M, st.tr, lr); st.it++;
          if(st.it % 5 === 0 || n < 5) st.hist.push([st.it, lossOf(st.M, st.tr), lossOf(st.M, st.te)]);
        }
        self.draw(el);
      };
      reset();
      el.querySelector("#u2ai-train-lr").addEventListener("input", () => self.draw(el));
      el.querySelector("#u2ai-train-model").addEventListener("input", () => { reset(); self.draw(el); });
      el.querySelector("#u2ai-train-step").addEventListener("click", () => run(1));
      el.querySelector("#u2ai-train-run").addEventListener("click", () => run(50));
      el.querySelector("#u2ai-train-reset").addEventListener("click", () => { reset(); self.draw(el); });
    },
    draw(el){
      const st = el._st; if(!st) return;
      const lr = Math.pow(10, +el.querySelector("#u2ai-train-lr").value / 10);
      el.querySelector("#u2ai-train-lr-o").textContent = lr < 0.1 ? lr.toFixed(3) : lr < 1 ? lr.toFixed(2) : lr.toFixed(1);
      const cv = el.querySelectorAll("canvas");
      const hx = st.hist.map(h => h[0]), htr = st.hist.map(h => Math.min(h[1], 5)), hte = st.hist.map(h => Math.min(h[2], 5));
      const xmax = Math.max(50, st.it);
      plot(cv[0], {xlim: [0, xmax], ylim: [0, 2.5], xlabel: "Iteration (full-batch gradient steps)", ylabel: "Cross-entropy loss",
        series: [{x: [0, xmax], y: [Math.log(NC), Math.log(NC)], color: "--plot-axis", width: 1, dash: [4, 4]},
                 {x: hx, y: hte, color: "--right", width: 1.6, dash: [5, 3]},
                 {x: hx, y: htr, color: "--accent", width: 2.2, marker: hx.length === 1 ? "dot" : undefined, msize: 4}],
        labels: [{text: "chance level ln 5 = 1.61", x: xmax, y: Math.log(NC) + 0.12, dx: -6, align: "right", color: "--muted"}]});
      const pred = p => argmax(forward(st.M, Z(p)).p);
      plot(cv[1], {xlim: F2LIM, ylim: F1LIM, xticks: F2T, yticks: F1T, xlabel: "F2 (Hz)", ylabel: "F1 (Hz)",
        series: scatterSeries(st.tr, null), labels: vowelLabels()});
      paintRegions(cv[1], pred, 0.16);
      const last = st.hist[st.hist.length - 1];
      el.querySelector("#u2ai-train-it").textContent = st.it;
      el.querySelector("#u2ai-train-loss").textContent = isFinite(last[1]) ? last[1].toFixed(3) : "diverged";
      el.querySelector("#u2ai-train-acc").textContent = (100 * accuracy(pred, st.tr)).toFixed(1) + " %";
      el.querySelector("#u2ai-train-tacc").textContent = (100 * accuracy(pred, st.te)).toFixed(1) + " %";
    }
  });
})();

(function(){
  const {plot, rng} = window.AT;

  /* ---------- 2.11 toy next-token sampler (illustration only) ---------- */
  // Made-up probabilities at temperature 1 for the word after
  // "The patient's audiogram shows". They sum to 1.
  const WORDS = ["a", "mild", "normal", "bilateral", "moderate", "no", "an", "severe", "notched", "cookies"];
  const P1 =    [0.22, 0.16,  0.14,     0.12,        0.10,       0.08, 0.07, 0.05,     0.04,      0.02];
  const PROMPT = "The patient's audiogram shows";

  function withTemp(T){
    // p_i^(1/T) renormalised; equivalent to softmax(log p / T)
    const q = P1.map(p => Math.pow(p, 1 / T));
    const s = q.reduce((a, b) => a + b, 0);
    return q.map(v => v / s);
  }
  function entropyBits(q){
    return q.reduce((h, p) => p > 0 ? h - p * Math.log2(p) : h, 0);
  }

  AT.demo("u2llm-tokens", {
    init(el){
      this.state = {seed: 2026, r: rng(2026), n: 0, last: -1};
      el.querySelector("#u2llm-tokens-t").addEventListener("input", () => this.draw(el));
      el.querySelector("#u2llm-tokens-s").addEventListener("click", () => {
        const T = +el.querySelector("#u2llm-tokens-t").value;
        const q = withTemp(T);
        const u = this.state.r();
        let c = 0, k = q.length - 1;
        for(let i = 0; i < q.length; i++){ c += q[i]; if(u < c){ k = i; break; } }
        this.state.last = k; this.state.n += 1;
        this.draw(el);
      });
      el.querySelector("#u2llm-tokens-r").addEventListener("click", () => {
        this.state.r = rng(this.state.seed); this.state.n = 0; this.state.last = -1;
        this.draw(el);
      });
    },
    draw(el){
      if(!this.state) this.state = {seed: 2026, r: rng(2026), n: 0, last: -1};
      const T = +el.querySelector("#u2llm-tokens-t").value;
      el.querySelector("#u2llm-tokens-t-o").textContent = T.toFixed(1);
      const q = withTemp(T);
      const series = [];
      q.forEach((p, i) => {
        series.push({x:[i + 1, i + 1], y:[0, p], color: i === this.state.last ? "--right" : "--accent", width: 16});
      });
      series.push({x: P1.map((_, i) => i + 1), y: P1, color:"--muted", line:false, marker:"o", msize:4});
      const ymax = Math.max(0.3, Math.ceil(Math.max(...q) * 10) / 10);
      plot(el.querySelector("canvas"), {
        xlim:[0.3, WORDS.length + 0.7], ylim:[0, ymax],
        xticks: WORDS.map((w, i) => [i + 1, w]),
        xlabel:"Candidate next word", ylabel:"Probability",
        series
      });
      const top = Math.max(...q);
      el.querySelector("#u2llm-tokens-top").textContent = WORDS[q.indexOf(top)] + " " + (100 * top).toFixed(1) + " %";
      el.querySelector("#u2llm-tokens-h").textContent = entropyBits(q).toFixed(2) + " bits (max " + Math.log2(WORDS.length).toFixed(2) + ")";
      el.querySelector("#u2llm-tokens-w").textContent = this.state.last >= 0 ? WORDS[this.state.last] : "none yet";
      el.querySelector("#u2llm-tokens-n").textContent = String(this.state.n);
      el.querySelector("#u2llm-tokens-sent").textContent = PROMPT + " " + (this.state.last >= 0 ? WORDS[this.state.last] + " ..." : "...");
    }
  });
})();

(function(){
  const {plot, TAU, fft} = window.AT;
  const q = (el, id) => el.querySelector("#" + id);
  const setV = (el, id, txt, bad) => { const n = q(el, id); if(!n) return; n.textContent = txt; n.classList.toggle("bad", !!bad); };
  const bindAll = (el, self) => el.querySelectorAll("input,select").forEach(i => { i.addEventListener("input", () => self.draw(el)); i.addEventListener("change", () => self.draw(el)); });

  /* common analysis: N samples covering exactly NC cycles of 50 Hz */
  const F0 = 50, NC = 4, N = 4096, FS = N * F0 / NC;   // 51 200 samples/s
  function analyse(v){
    let ss = 0, pk = 0;
    for(let i = 0; i < N; i++){ ss += v[i] * v[i]; pk = Math.max(pk, Math.abs(v[i])); }
    const rms = Math.sqrt(ss / N);
    const re = Float64Array.from(v), im = new Float64Array(N);
    fft(re, im);
    const mag = k => 2 * Math.hypot(re[k], im[k]) / N;     // peak amplitude of bin k
    const h = [];                                         // h[n] = peak amplitude of harmonic n
    for(let n = 1; n <= 40; n++) h[n] = mag(n * NC);
    let hs = 0; for(let n = 2; n <= 40; n++) hs += h[n] * h[n];
    const thd = h[1] > 1e-6 ? Math.sqrt(hs) / h[1] : NaN;
    const cyc = [];
    const per = N / NC;
    for(let c = 0; c < NC; c++){ let s = 0; for(let i = c * per; i < (c + 1) * per; i++) s += v[i] * v[i]; cyc.push(Math.sqrt(s / per)); }
    return {rms, pk, cf: rms > 1e-6 ? pk / rms : NaN, thd, h, cyc};
  }
  const tAxis = () => { const t = []; for(let i = 0; i < N; i++) t.push(1000 * i / FS); return t; };
  const decim = (t, v, step) => { const x = [], y = []; for(let i = 0; i < t.length; i += step){ x.push(t[i]); y.push(v[i]); } return {x, y}; };

  /* ---------- 1. power-quality waveform viewer ---------- */
  const VP = 230 * Math.SQRT2;
  const VERDICT = {
    clean: "Ideal 230 V, 50 Hz sine. Equipment power supplies, transformers and UPS chargers behave as designed.",
    sag: "A dip lasting a few cycles. Deep or long dips can restart PCs, reset instruments mid-test and drop contactors; online UPS or a line-interactive UPS rides through it.",
    swell: "A short rise in RMS voltage. Stresses surge suppressors and power supplies; prolonged overvoltage (for example a lost neutral) can destroy equipment. Stabiliser cut-off or online UPS protects.",
    spike: "An impulsive transient superimposed on the wave. Can puncture insulation, damage SMPS input stages and USB interfaces, and appear as clicks or artefacts. SPD cascade and good earthing protect.",
    harm: "Harmonic distortion. Causes transformer and neutral heating, flat-topped voltage, and 100 to 350 Hz components that can leak into recordings as buzz. Treat at the source (PFC supplies, filters).",
    notch: "Commutation notches from thyristor or rectifier equipment. Produce high-frequency ringing and zero-crossing errors that disturb timing circuits and can couple into sensitive amplifiers.",
    flat: "Flat-topped voltage, typical where many rectifier loads draw current at the crest. Rectifier supplies get a lower DC voltage and work harder; 3rd and 5th harmonics rise.",
    out: "Complete loss of supply. Anything without a UPS or battery stops; unsaved data and the current test are lost, and file systems may be corrupted."
  };
  function pqWave(kind, lev, h3, h5, h7){
    const v = new Float64Array(N);
    for(let i = 0; i < N; i++){
      const t = i / FS, th = TAU * F0 * t, cyc = t * F0;
      let x = Math.sin(th);
      if(kind === "harm") x = Math.sin(th) + h3 / 100 * Math.sin(3 * th) + h5 / 100 * Math.sin(5 * th) + h7 / 100 * Math.sin(7 * th);
      if(kind === "sag" && cyc >= 1 && cyc < 3) x *= lev / 100;
      if(kind === "swell" && cyc >= 1 && cyc < 3) x *= lev / 100;
      if(kind === "out" && cyc >= 1.5) x = 0;
      if(kind === "flat"){ const c = lev / 100; x = Math.max(-c, Math.min(c, x)); }
      if(kind === "notch"){ const deg = (360 * cyc) % 60; if(deg > 30 && deg < 34) x *= 0.4; }
      v[i] = VP * x;
      if(kind === "spike"){ const t0 = 1.2 / F0; if(t >= t0){ const d = t - t0; v[i] += lev * Math.exp(-d / 60e-6) * Math.cos(TAU * 8000 * d); } }
    }
    return v;
  }
  AT.demo("u2p-quality", {
    init(el){ bindAll(el, this); },
    draw(el){
      const kind = q(el, "u2p-quality-type").value;
      const lr = q(el, "u2p-quality-lev");
      const cfg = {sag: [10, 95, 60, "%"], swell: [105, 150, 120, "%"], spike: [200, 3000, 1200, " V"], flat: [70, 99, 90, "%"]};
      const c = cfg[kind];
      lr.disabled = !c;
      if(c){ if(lr.dataset.kind !== kind){ lr.min = c[0]; lr.max = c[1]; lr.value = c[2]; lr.dataset.kind = kind; } }
      const lev = +lr.value;
      const labLev = {sag: "Residual voltage during dip", swell: "Voltage during swell", spike: "Transient peak added", flat: "Clipping level (of peak)"};
      q(el, "u2p-quality-lev-l").textContent = c ? labLev[kind] + ": " : "Level (not used): ";
      q(el, "u2p-quality-lev-o").textContent = c ? lev + c[3] : "";
      const h3 = +q(el, "u2p-quality-h3").value, h5 = +q(el, "u2p-quality-h5").value, h7 = +q(el, "u2p-quality-h7").value;
      ["h3", "h5", "h7"].forEach(k => { q(el, "u2p-quality-" + k).disabled = kind !== "harm"; });
      q(el, "u2p-quality-h3-o").textContent = h3 + "%"; q(el, "u2p-quality-h5-o").textContent = h5 + "%"; q(el, "u2p-quality-h7-o").textContent = h7 + "%";
      const v = pqWave(kind, lev, h3, h5, h7);
      const t = tAxis();
      const ideal = new Float64Array(N); for(let i = 0; i < N; i++) ideal[i] = VP * Math.sin(TAU * F0 * i / FS);
      const a = decim(t, v, 2), b = decim(t, ideal, 4);
      const ym = Math.max(500, Math.ceil(Math.max(...v.map(Math.abs)) / 100) * 100 + 50);
      plot(q(el, "u2p-quality-cv"), {xlim: [0, 80], ylim: [-ym, ym], xlabel: "Time (ms)", ylabel: "Voltage (V)",
        series: [{x: b.x, y: b.y, color: "--plot-axis", width: 1, dash: [5, 4]}, {x: a.x, y: a.y, color: "--accent", width: 1.8}]});
      const r = analyse(v);
      setV(el, "u2p-quality-rms", r.rms.toFixed(1) + " V", Math.abs(r.rms - 230) > 0.06 * 230);
      setV(el, "u2p-quality-pk", r.pk.toFixed(0) + " V", r.pk > 1.1 * VP || r.pk < 0.9 * VP);
      setV(el, "u2p-quality-cf", isNaN(r.cf) ? "n/a" : r.cf.toFixed(2), !isNaN(r.cf) && Math.abs(r.cf - Math.SQRT2) > 0.1);
      setV(el, "u2p-quality-thd", isNaN(r.thd) ? "n/a" : (100 * r.thd).toFixed(1) + "%", r.thd > 0.08);
      setV(el, "u2p-quality-cyc", r.cyc.map(x => x.toFixed(0)).join(", ") + " V", r.cyc.some(x => Math.abs(x - 230) > 0.1 * 230));
      q(el, "u2p-quality-verdict").textContent = VERDICT[kind] + (kind === "sag" || kind === "swell" || kind === "spike" || kind === "out" ? " (THD over the 80 ms window is shown for completeness; it is not a meaningful index for a non-repetitive event.)" : "");
    }
  });

  /* ---------- 2. UPS / inverter output comparison ---------- */
  const SRC = {
    grid: "Typical utility supply with slight flat-topping. Suitable, subject to the other power-quality problems in this topic.",
    square: "Square wave: fast edges and strong odd harmonics. Not suitable for medical equipment, transformers, motors or many SMPS; may cause buzzing, overheating and interference.",
    msw: "Modified (quasi) sine: a stepped wave with the right RMS but high THD. Often runs PCs but can make transformers and motors hum, confuse some power supplies and chargers, and inject interference. Avoid for medical equipment unless the manufacturer approves it.",
    online: "Pure sine from a PWM inverter (online UPS or good sine-wave inverter). Low THD; the type to use for clinical equipment, subject to the equipment manufacturer's instructions."
  };
  function srcWave(kind, w){
    const v = new Float64Array(N);
    for(let i = 0; i < N; i++){
      const th = TAU * F0 * i / FS, s = Math.sin(th), ph = ((th % TAU) + TAU) % TAU;
      let x;
      if(kind === "grid"){ x = Math.max(-0.95, Math.min(0.95, 1.02 * s)); x *= VP; }
      else if(kind === "square"){ x = 230 * Math.sign(s); }
      else if(kind === "msw"){
        const half = ph < Math.PI ? ph : ph - Math.PI, sgn = ph < Math.PI ? 1 : -1, a = (Math.PI - w) / 2;
        const Vpk = 230 / Math.sqrt(w / Math.PI);          // keeps RMS at 230 V
        x = (half >= a && half <= Math.PI - a) ? sgn * Vpk : 0;
      } else { x = VP * (s + 0.012 * Math.sin(3 * th + 0.4) + 0.008 * Math.sin(5 * th)) + 3 * Math.sin(TAU * 20000 * i / FS); }
      v[i] = x;
    }
    return v;
  }
  AT.demo("u2p-ups", {
    init(el){ bindAll(el, this); },
    draw(el){
      const kind = q(el, "u2p-ups-src").value;
      const wdeg = +q(el, "u2p-ups-w").value;
      q(el, "u2p-ups-w").disabled = kind !== "msw";
      q(el, "u2p-ups-w-o").textContent = wdeg + "°";
      const v = srcWave(kind, wdeg * Math.PI / 180);
      const t = tAxis(), a = decim(t, v, 2);
      const ym = Math.max(450, Math.ceil(Math.max(...v.map(Math.abs)) / 50) * 50 + 50);
      const ideal = new Float64Array(N); for(let i = 0; i < N; i++) ideal[i] = VP * Math.sin(TAU * F0 * i / FS);
      const b = decim(t, ideal, 4);
      plot(q(el, "u2p-ups-wv"), {xlim: [0, 40], ylim: [-ym, ym], xlabel: "Time (ms)", ylabel: "Voltage (V)",
        series: [{x: b.x, y: b.y, color: "--plot-axis", width: 1, dash: [5, 4]}, {x: a.x, y: a.y, color: "--left", width: 1.8}]});
      const r = analyse(v);
      const ser = [];
      for(let n = 1; n <= 25; n++){
        const p = 100 * r.h[n] / r.h[1];
        if(p < 0.05) continue;
        ser.push({x: [n, n], y: [0, p], color: n === 1 ? "--accent" : "--right", width: 7});
      }
      plot(q(el, "u2p-ups-sp"), {xlim: [0, 26], ylim: [0, 105], xlabel: "Harmonic number (x 50 Hz)", ylabel: "% of fundamental",
        xticks: [[1, "1"], [3, "3"], [5, "5"], [7, "7"], [9, "9"], [11, "11"], [13, "13"], [15, "15"], [17, "17"], [19, "19"], [21, "21"], [23, "23"], [25, "25"]], series: ser});
      setV(el, "u2p-ups-rms", r.rms.toFixed(1) + " V");
      setV(el, "u2p-ups-pk", r.pk.toFixed(0) + " V", r.pk < 0.9 * VP || r.pk > 1.1 * VP);
      setV(el, "u2p-ups-thd", (100 * r.thd).toFixed(1) + "%", r.thd > 0.08);
      setV(el, "u2p-ups-h3", (100 * r.h[3] / r.h[1]).toFixed(1) + "%", r.h[3] / r.h[1] > 0.05);
      const ok = kind === "online" || kind === "grid";
      setV(el, "u2p-ups-ok", ok ? "Suitable (sine)" : "Not recommended", !ok);
      q(el, "u2p-ups-note").textContent = SRC[kind];
    }
  });

  /* ---------- 3. earth fault and touch voltage ---------- */
  AT.demo("u2p-earth", {
    init(el){ bindAll(el, this); },
    draw(el){
      const sys = q(el, "u2p-earth-sys").value;
      const ra = +q(el, "u2p-earth-ra").value, rb = +q(el, "u2p-earth-rb").value;
      const rpe = +q(el, "u2p-earth-rpe").value / 100, rl = +q(el, "u2p-earth-rl").value / 100;
      const inom = +q(el, "u2p-earth-mcb").value, rcd = q(el, "u2p-earth-rcd").checked;
      q(el, "u2p-earth-ra-o").textContent = ra + " Ω";
      q(el, "u2p-earth-rb-o").textContent = rb + " Ω";
      q(el, "u2p-earth-rpe-o").textContent = rpe.toFixed(2) + " Ω";
      q(el, "u2p-earth-rl-o").textContent = rl.toFixed(2) + " Ω";
      q(el, "u2p-earth-ra").disabled = sys !== "tt";
      q(el, "u2p-earth-rb").disabled = sys !== "tt";
      const U0 = 230;
      const model = x => sys === "tt" ? {I: U0 / (rl + rpe + x + rb), Ut: U0 * (rpe + x) / (rl + rpe + x + rb)}
                                      : {I: U0 / (rl + x), Ut: U0 * x / (rl + x)};
      const m = model(sys === "tt" ? ra : rpe);
      const mcbTrip = m.I >= 5 * inom;           // type B magnetic trip, upper limit 5 x In
      const rcdTrip = rcd && m.I >= 0.03;
      setV(el, "u2p-earth-i", m.I >= 10 ? m.I.toFixed(0) + " A" : m.I.toFixed(2) + " A");
      setV(el, "u2p-earth-ut", m.Ut.toFixed(0) + " V", m.Ut > 50);
      setV(el, "u2p-earth-mcbv", mcbTrip ? "Yes, fast (≥ 5 x In)" : "No fast trip (" + (m.I / inom).toFixed(1) + " x In)", !mcbTrip);
      setV(el, "u2p-earth-rcdv", rcd ? (rcdTrip ? "Yes (fault ≫ 30 mA)" : "No") : "No RCD fitted", !rcdTrip);
      const safe = mcbTrip || rcdTrip;
      setV(el, "u2p-earth-verd", safe ? (m.Ut > 50 ? "Dangerous voltage, but disconnected quickly" : "Low touch voltage and disconnected") : (m.Ut > 50 ? "Dangerous voltage persists" : "Touch voltage low but fault persists"), !safe && m.Ut > 50);
      // curve of touch voltage against the chosen variable
      const xs = [], ys = [], lo = sys === "tt" ? 1 : 0.02, hi = sys === "tt" ? 300 : 3;
      for(let i = 0; i <= 120; i++){ const x = lo * Math.pow(hi / lo, i / 120); xs.push(x); ys.push(model(x).Ut); }
      plot(q(el, "u2p-earth-cv"), {xlim: [lo, hi], xlog: true, ylim: [0, 240],
        xlabel: sys === "tt" ? "Installation earth electrode + PE resistance R_A (Ω)" : "Protective conductor resistance R_PE (Ω)",
        ylabel: "Touch voltage (V)",
        xticks: sys === "tt" ? [[1, "1"], [3, "3"], [10, "10"], [30, "30"], [100, "100"], [300, "300"]] : [[0.02, "0.02"], [0.05, "0.05"], [0.1, "0.1"], [0.3, "0.3"], [1, "1"], [3, "3"]],
        series: [{x: xs, y: ys, color: "--accent", width: 2}, {x: [lo, hi], y: [50, 50], color: "--right", width: 1.2, dash: [5, 4]},
                 {x: [sys === "tt" ? ra : rpe], y: [m.Ut], color: "--left", marker: "o", line: false, msize: 6}],
        labels: [{text: "50 V conventional limit", x: hi * 0.9, y: 36, color: "--right", align: "right"}]});
    }
  });

  /* ---------- 4. three-phase neutral current ---------- */
  AT.demo("u2p-threephase", {
    init(el){ bindAll(el, this); },
    draw(el){
      const k3 = +q(el, "u2p-threephase-h3").value / 100, k5 = +q(el, "u2p-threephase-h5").value / 100;
      const bb = +q(el, "u2p-threephase-b").value / 100;
      q(el, "u2p-threephase-h3-o").textContent = Math.round(k3 * 100) + "%";
      q(el, "u2p-threephase-h5-o").textContent = Math.round(k5 * 100) + "%";
      q(el, "u2p-threephase-b-o").textContent = Math.round(bb * 100) + "%";
      const amp = [10 * Math.SQRT2, 10 * Math.SQRT2 * bb, 10 * Math.SQRT2];   // phase A and C 10 A fundamental RMS
      const sh = [0, -TAU / 3, TAU / 3];
      const M = 800, T = 0.04, tx = [], ph = [[], [], []], nn = [];
      let sN = 0, sA = 0;
      for(let i = 0; i < M; i++){
        const t = T * i / M, th = TAU * F0 * t; let s = 0;
        for(let p = 0; p < 3; p++){
          const a = th + sh[p];
          const x = amp[p] * (Math.sin(a) + k3 * Math.sin(3 * a) + k5 * Math.sin(5 * a));
          ph[p].push(x); s += x;
        }
        tx.push(1000 * t); nn.push(s); sN += s * s; sA += ph[0][i] * ph[0][i];
      }
      const iN = Math.sqrt(sN / M), iA = Math.sqrt(sA / M);
      const ym = Math.max(40, Math.ceil(Math.max(...nn.map(Math.abs), ...ph[0].map(Math.abs)) / 10) * 10 + 5);
      plot(q(el, "u2p-threephase-cv"), {xlim: [0, 40], ylim: [-ym, ym], xlabel: "Time (ms)", ylabel: "Current (A)",
        series: [{x: tx, y: ph[0], color: "--accent", width: 1.3}, {x: tx, y: ph[1], color: "--left", width: 1.3}, {x: tx, y: ph[2], color: "--warn", width: 1.3},
                 {x: tx, y: nn, color: "--right", width: 2.4}]});
      setV(el, "u2p-threephase-ia", iA.toFixed(1) + " A");
      setV(el, "u2p-threephase-in", iN.toFixed(1) + " A", iN > iA);
      setV(el, "u2p-threephase-r", (iN / iA).toFixed(2), iN > iA);
    }
  });
})();
