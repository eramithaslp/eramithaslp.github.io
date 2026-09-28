(function(){
  const {plot, rng, gauss, $} = window.AT;

  /* ---------- 4.2 Tympanogram ---------- */
  const TYMP_PRESETS = {
    A:  {p: -10,  y: 0.8,  w: 40,  v: 1.0},
    As: {p: -10,  y: 0.2,  w: 45,  v: 1.0},
    Ad: {p: 0,    y: 2.4,  w: 35,  v: 1.1},
    B:  {p: -100, y: 0.08, w: 400, v: 1.0},
    C:  {p: -230, y: 0.6,  w: 55,  v: 1.0}
  };
  AT.demo("u4-tymp", {
    init(el){
      const sel = el.querySelector("#u4-tymp-type");
      sel.addEventListener("change", () => {
        const pr = TYMP_PRESETS[sel.value];
        el.querySelector("#u4-tymp-p").value = pr.p;
        el.querySelector("#u4-tymp-y").value = pr.y;
        el.querySelector("#u4-tymp-w").value = pr.w;
        el.querySelector("#u4-tymp-v").value = pr.v;
        this.draw(el);
      });
      el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el)));
    },
    draw(el){
      const pk = +el.querySelector("#u4-tymp-p").value;
      const Y = +el.querySelector("#u4-tymp-y").value;
      const w = +el.querySelector("#u4-tymp-w").value;
      const vea = +el.querySelector("#u4-tymp-v").value;
      el.querySelector("#u4-tymp-p-o").textContent = pk + " daPa";
      el.querySelector("#u4-tymp-y-o").textContent = Y.toFixed(2) + " mmho";
      el.querySelector("#u4-tymp-w-o").textContent = w + " daPa";
      el.querySelector("#u4-tymp-v-o").textContent = vea.toFixed(2) + " ml";
      const lor = P => 1 / (1 + Math.pow((P - pk) / w, 2));
      const base = lor(200), den = 1 - base;
      const x = [], y = [];
      for(let P = -400; P <= 200; P += 1){ x.push(P); y.push(Y * (lor(P) - base) / den); }
      // numerical measures from the plotted curve
      let im = 0; for(let i = 1; i < y.length; i++) if(y[i] > y[im]) im = i;
      const peak = y[im], tpp = x[im], half = peak / 2;
      let pl = null, ph = null;
      for(let i = im; i > 0; i--) if(y[i-1] < half){ pl = x[i-1] + (half - y[i-1]) / (y[i] - y[i-1]) * (x[i] - x[i-1]); break; }
      for(let i = im; i < y.length - 1; i++) if(y[i+1] < half){ ph = x[i] + (y[i] - half) / (y[i] - y[i+1]) * (x[i+1] - x[i]); break; }
      const tw = (pl !== null && ph !== null) ? ph - pl : null;
      const flat = peak < 0.15 || tw === null || tw > 250;
      let cls;
      if(flat) cls = "B (flat, no clear peak)";
      else if(tpp < -100) cls = "C (negative peak pressure)";
      else if(peak < 0.3) cls = "As (shallow)";
      else if(peak > 1.7) cls = "Ad (deep)";
      else if(tpp > 50) cls = "Positive peak (outside typical range)";
      else cls = "A (within typical adult limits)";
      el.querySelector("#u4-tymp-rp").textContent = flat ? "not identifiable" : tpp + " daPa";
      el.querySelector("#u4-tymp-ry").textContent = peak.toFixed(2) + " mmho";
      el.querySelector("#u4-tymp-rw").textContent = (tw === null || flat) ? "not measurable" : tw.toFixed(0) + " daPa";
      el.querySelector("#u4-tymp-rv").textContent = vea.toFixed(2) + " ml";
      el.querySelector("#u4-tymp-rc").textContent = cls;
      let note;
      if(flat){
        if(vea > 2.0) note = "Flat trace with a large ear canal volume: in an adult, consider a perforation or a patent ventilation tube.";
        else if(vea < 0.3) note = "Flat trace with a very small volume: the probe may be blocked by wax or pressed against the canal wall. Reposition and retest.";
        else note = "Flat trace with a normal ear canal volume: consistent with middle-ear effusion. Confirm with otoscopy and other tests.";
      } else {
        note = "Tympanometric width is measured at half the compensated peak admittance. Typical adult TW is roughly 50 to 110 daPa; wider peaks are associated with effusion.";
        if(vea > 2.0) note += " The ear canal volume is unusually large for an adult with a measurable peak: check probe seal and history.";
        else if(vea < 0.3) note += " The ear canal volume is very small: check the probe position.";
      }
      el.querySelector("#u4-tymp-note").textContent = note + " All limits are typical adult teaching values only.";
      const ytop = Math.max(2, peak * 1.2);
      const series = [
        {x: [-100, 50, 50, -100, -100], y: [0.3, 0.3, 1.7, 1.7, 0.3], color: "--plot-axis", width: 1, dash: [4, 4]},
        {x, y, color: "--accent", width: 2.2}
      ];
      if(!flat){
        series.push({x: [pl, ph], y: [half, half], color: "--warn", width: 2, marker: "dot", msize: 3});
        series.push({x: [tpp], y: [peak], color: "--accent", line: false, marker: "o", msize: 5});
      }
      plot(el.querySelector("canvas"), {
        xlim: [-400, 200], ylim: [-0.2, ytop],
        xticks: [[-400, "-400"], [-300, "-300"], [-200, "-200"], [-100, "-100"], [0, "0"], [100, "+100"], [200, "+200"]],
        xlabel: "Ear canal pressure (daPa)", ylabel: "Admittance (mmho)",
        series,
        labels: [{text: "typical adult box", x: -95, y: 1.7, dy: -6, color: "--muted"}]
      });
    }
  });

  /* ---------- 4.4 ABR averaging ---------- */
  const ABR_FS = 20000, ABR_T = 0.012, ABR_NS = Math.round(ABR_FS * ABR_T);
  const abrT = [], abrS = [];
  (function(){
    const g = (t, mu, sd, a) => a * Math.exp(-0.5 * Math.pow((t - mu) / sd, 2));
    for(let i = 0; i < ABR_NS; i++){
      const t = i / ABR_FS * 1000; abrT.push(t);
      abrS.push(g(t, 1.6, 0.18, 0.25) + g(t, 3.7, 0.2, 0.3) + g(t, 5.6, 0.25, 0.5) + g(t, 6.7, 0.4, -0.3));
    }
  })();
  let abrSeed = 11;
  AT.demo("u4-abr", {
    init(el){
      el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el)));
      el.querySelector("#u4-abr-seed").addEventListener("click", () => { abrSeed += 1; this.draw(el); });
    },
    draw(el){
      const k = +el.querySelector("#u4-abr-n").value;
      const N = Math.max(1, Math.round(Math.pow(10, k / 100 * Math.log10(4000))));
      const sigma = +el.querySelector("#u4-abr-s").value;
      el.querySelector("#u4-abr-n-o").textContent = N;
      el.querySelector("#u4-abr-s-o").textContent = sigma + " µV RMS";
      const r = rng(abrSeed), sum = new Float64Array(ABR_NS), wn = new Float64Array(ABR_NS + 2);
      const scale = sigma / Math.sqrt(0.375);
      for(let s = 0; s < N; s++){
        for(let i = 0; i < ABR_NS + 2; i++) wn[i] = gauss(r);
        for(let i = 0; i < ABR_NS; i++) sum[i] += abrS[i] + scale * (0.25 * wn[i] + 0.5 * wn[i+1] + 0.25 * wn[i+2]);
      }
      const avg = [], err = [];
      let se = 0;
      for(let i = 0; i < ABR_NS; i++){ const a = sum[i] / N; avg.push(a); se += (a - abrS[i]) * (a - abrS[i]); }
      const resid = Math.sqrt(se / ABR_NS), pred = sigma / Math.sqrt(N);
      const vPeak = Math.max(...abrS);
      const snr = vPeak / resid;
      el.querySelector("#u4-abr-rn").textContent = N;
      el.querySelector("#u4-abr-rr").textContent = resid.toFixed(3) + " µV";
      el.querySelector("#u4-abr-rp").textContent = pred.toFixed(3) + " µV";
      el.querySelector("#u4-abr-rs").textContent = snr.toFixed(2) + " (" + (20 * Math.log10(snr)).toFixed(1) + " dB)";
      const sec = N / 21.1;
      el.querySelector("#u4-abr-rt").textContent = sec < 60 ? sec.toFixed(sec < 10 ? 2 : 1) + " s" : (sec / 60).toFixed(1) + " min";
      const lim = Math.max(1.0, 3.5 * pred);
      const labels = [];
      if(pred < 0.2){
        labels.push({text: "I", x: 1.6, y: 0.25, dy: -10, color: "--ink", align: "center"});
        labels.push({text: "III", x: 3.7, y: 0.3, dy: -10, color: "--ink", align: "center"});
        labels.push({text: "V", x: 5.6, y: 0.5, dy: -10, color: "--ink", align: "center"});
      }
      plot(el.querySelector("canvas"), {
        xlim: [0, 12], ylim: [-lim, lim], xlabel: "Time after stimulus (ms)", ylabel: "Amplitude (µV)",
        series: [
          {x: abrT, y: avg, color: "--accent", width: 1.6},
          {x: abrT, y: abrS, color: "--right", width: 1.4, dash: [5, 4]}
        ],
        labels
      });
    }
  });

  /* ---------- 4.6 Frequency weighting ---------- */
  function wA(f){
    const f2 = f * f;
    const ra = (12194 * 12194 * f2 * f2) / ((f2 + 20.6 * 20.6) * Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * (f2 + 12194 * 12194));
    return 20 * Math.log10(ra) + 2.00;
  }
  function wC(f){
    const f2 = f * f;
    const rc = (12194 * 12194 * f2) / ((f2 + 20.6 * 20.6) * (f2 + 12194 * 12194));
    return 20 * Math.log10(rc) + 0.06;
  }
  AT.wA = wA; AT.wC = wC;
  AT.demo("u4-weighting", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const k = +el.querySelector("#u4-weighting-f").value;
      const f = 10 * Math.pow(2000, k / 1000);
      const fTxt = f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2) + " kHz" : f.toFixed(f < 100 ? 1 : 0) + " Hz";
      el.querySelector("#u4-weighting-f-o").textContent = fTxt;
      const xs = [], ya = [], yc = [], yz = [];
      for(let i = 0; i <= 300; i++){ const fi = 10 * Math.pow(2000, i / 300); xs.push(fi); ya.push(wA(fi)); yc.push(wC(fi)); yz.push(0); }
      const a = wA(f), c = wC(f);
      const fmt = v => (v >= 0 ? "+" : "") + v.toFixed(1) + " dB";
      el.querySelector("#u4-weighting-rf").textContent = fTxt;
      el.querySelector("#u4-weighting-ra").textContent = fmt(a);
      el.querySelector("#u4-weighting-rc").textContent = fmt(c);
      el.querySelector("#u4-weighting-rz").textContent = "0.0 dB";
      el.querySelector("#u4-weighting-rl").textContent = (70 + a).toFixed(1) + " dB(A)";
      plot(el.querySelector("canvas"), {
        xlim: [10, 20000], ylim: [-70, 10], xlog: true,
        xticks: [[10, "10"], [31.5, "31.5"], [100, "100"], [250, "250"], [1000, "1k"], [4000, "4k"], [10000, "10k"], [20000, "20k"]],
        xlabel: "Frequency (Hz)", ylabel: "Relative response (dB)",
        series: [
          {x: xs, y: yz, color: "--plot-axis", width: 1.4, dash: [5, 4]},
          {x: xs, y: yc, color: "--left", width: 2},
          {x: xs, y: ya, color: "--accent", width: 2.2},
          {x: [f, f], y: [-70, 10], color: "--right", width: 1.2},
          {x: [f, f], y: [a, c], color: "--right", line: false, marker: "o", msize: 4}
        ],
        labels: [{text: "A", x: 40, y: wA(40), dx: 8, color: "--accent"}, {text: "C", x: 20, y: wC(20), dy: -8, color: "--left"}, {text: "Z", x: 12, y: 0, dy: -6, color: "--muted"}]
      });
    }
  });

  /* ---------- 4.8 Reverberation time ---------- */
  const rtRipple = (function(){ const r = rng(7), out = []; let s = 0; for(let i = 0; i < 401; i++){ s = 0.85 * s + 0.5 * gauss(r); out.push(s); } return out; })();
  AT.demo("u4-rt60", {
    init(el){
      const sel = el.querySelector("#u4-rt60-p"), a = el.querySelector("#u4-rt60-a");
      sel.addEventListener("change", () => { if(sel.value) a.value = sel.value; this.draw(el); });
      a.addEventListener("input", () => { sel.value = ""; this.draw(el); });
      ["l", "w", "h"].forEach(k => el.querySelector("#u4-rt60-" + k).addEventListener("input", () => this.draw(el)));
    },
    draw(el){
      const L = +el.querySelector("#u4-rt60-l").value, W = +el.querySelector("#u4-rt60-w").value, H = +el.querySelector("#u4-rt60-h").value;
      const al = +el.querySelector("#u4-rt60-a").value;
      el.querySelector("#u4-rt60-l-o").textContent = L.toFixed(1) + " m";
      el.querySelector("#u4-rt60-w-o").textContent = W.toFixed(1) + " m";
      el.querySelector("#u4-rt60-h-o").textContent = H.toFixed(1) + " m";
      el.querySelector("#u4-rt60-a-o").textContent = al.toFixed(2);
      const V = L * W * H, S = 2 * (L * W + L * H + W * H), A = al * S;
      const T = 0.161 * V / A, Te = 0.161 * V / (-S * Math.log(1 - al));
      const rc = 0.057 * Math.sqrt(2 * V / T);
      el.querySelector("#u4-rt60-rv").textContent = V.toFixed(1) + " m³";
      el.querySelector("#u4-rt60-rs").textContent = S.toFixed(1) + " m²";
      el.querySelector("#u4-rt60-ra").textContent = A.toFixed(1) + " m² sabins";
      el.querySelector("#u4-rt60-rt").textContent = T.toFixed(2) + " s";
      el.querySelector("#u4-rt60-re").textContent = Te.toFixed(2) + " s";
      el.querySelector("#u4-rt60-rc").textContent = rc.toFixed(2) + " m";
      let note;
      if(T > 0.6){
        const need = 0.161 * V / 0.6 - A;
        note = "Longer than the commonly recommended classroom range (around 0.4 to 0.6 s). About " + need.toFixed(0) + " m² sabins of extra absorption would bring the Sabine estimate to 0.6 s.";
      } else if(T >= 0.4) note = "Within the commonly recommended classroom range of around 0.4 to 0.6 s.";
      else note = "Shorter than the typical classroom recommendation: good for speech clarity and test rooms.";
      if(al > 0.3) note += " With average absorption above about 0.3, Sabine overestimates RT and the Eyring value is more realistic.";
      el.querySelector("#u4-rt60-note").textContent = note + " These are predictions using typical values; measure the room and check current standards.";
      const tmax = 1.25 * T, xs = [], meas = [];
      for(let i = 0; i <= 400; i++){
        const t = tmax * i / 400; xs.push(t);
        const lv = 10 * Math.log10(Math.pow(10, -6 * t / T) + Math.pow(10, -4.5));
        meas.push(i < 3 ? lv : lv + 0.9 * rtRipple[i]);
      }
      const t5 = 5 * T / 60, t25 = 25 * T / 60;
      const tf = x => Math.round(x * 100) / 100;
      plot(el.querySelector("canvas"), {
        xlim: [0, tmax], ylim: [-70, 5], xlabel: "Time after source stops (s)", ylabel: "Level re start (dB)",
        yticks: [[0, "0"], [-5, "-5"], [-25, "-25"], [-45, "-45"], [-60, "-60"]],
        series: [
          {x: xs, y: meas, color: "--accent", width: 1.6},
          {x: [0, T], y: [0, -60], color: "--warn", width: 1.4, dash: [6, 4]},
          {x: [t5, t25], y: [-5, -25], color: "--warn", width: 4},
          {x: [0, tmax], y: [-45, -45], color: "--plot-axis", width: 1, dash: [2, 4]},
          {x: [T], y: [-60], color: "--right", line: false, marker: "o", msize: 6}
        ],
        labels: [
          {text: "T20 range (-5 to -25 dB)", x: t25, y: -25, dx: 10, dy: 4, color: "--warn"},
          {text: "background noise floor", x: tmax, y: -45, dx: -6, dy: -6, color: "--muted", align: "right"},
          {text: "-60 dB at RT60 = " + tf(T) + " s", x: T, y: -60, dx: -10, dy: -8, color: "--right", align: "right"},
          {text: "extrapolated", x: T * 0.72, y: -43.2, dx: 12, dy: 14, color: "--warn"}
        ]
      });
    }
  });
})();
