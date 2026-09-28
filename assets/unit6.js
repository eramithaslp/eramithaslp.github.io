(function(){
  const {plot, css, rng, gauss} = window.AT;

  /* ================= 6.1 Audiogram editor ================= */
  const AG_FREQS = {AC: [125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000],
                    BC: [250, 500, 750, 1000, 1500, 2000, 3000, 4000]};
  const AG_X = [100, 10000], AG_Y = [120, -10];
  const agEmpty = () => ({R: {AC: {}, ACm: {}, BC: {}, BCm: {}}, L: {AC: {}, ACm: {}, BC: {}, BCm: {}}});
  function agExample(){
    const d = agEmpty();
    d.R.AC = {250: 45, 500: 45, 1000: 40, 2000: 35, 4000: 40, 8000: 45};
    d.R.BC = {250: 5, 500: 10, 1000: 10, 2000: 15, 4000: 15};
    d.L.AC = {250: 10, 500: 10, 1000: 5, 2000: 10, 4000: 15, 8000: 20};
    d.L.BC = {250: 5, 500: 5, 1000: 5, 2000: 10, 4000: 10};
    return d;
  }
  // effective threshold: masked if present, else unmasked
  const eff = (e, c, f) => (e[c + "m"][f] !== undefined ? e[c + "m"][f] : e[c][f]);
  function agGeom(cv){
    const w = cv.clientWidth, h = +(cv.dataset.h || 380);
    const m = {l: 56, r: 14, t: 10, b: 40};
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const lx = Math.log10;
    return {
      m, pw, ph,
      X: f => m.l + (lx(f) - lx(AG_X[0])) / (lx(AG_X[1]) - lx(AG_X[0])) * pw,
      Y: v => m.t + (v - AG_Y[1]) / (AG_Y[0] - AG_Y[1]) * ph,
      invX: px => Math.pow(10, lx(AG_X[0]) + (px - m.l) / pw * (lx(AG_X[1]) - lx(AG_X[0]))),
      invY: py => AG_Y[1] + (py - m.t) / ph * (AG_Y[0] - AG_Y[1])
    };
  }
  function whoGrade(p){
    if(p === null) return "incomplete";
    if(p < 20) return "No hearing loss";
    if(p < 35) return "Mild";
    if(p < 50) return "Moderate";
    if(p < 65) return "Moderately severe";
    if(p < 80) return "Severe";
    if(p < 95) return "Profound";
    return "Complete or total";
  }
  function avg(e, fs){
    const v = fs.map(f => eff(e, "AC", f));
    if(v.some(x => x === undefined)) return null;
    return v.reduce((a, b) => a + b, 0) / v.length;
  }
  const fmtF = f => (f >= 1000 ? (f / 1000) + " kHz" : f + " Hz");

  AT.demo("u6-1-audiogram", {
    init(el){
      el._ag = agExample();
      const cv = el.querySelector("canvas");
      el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el)));
      el.querySelector("#u6-1-audiogram-ex").addEventListener("click", () => { el._ag = agExample(); this.draw(el); });
      el.querySelector("#u6-1-audiogram-clr").addEventListener("click", () => { el._ag = agEmpty(); this.draw(el); });
      cv.style.cursor = "crosshair";
      cv.addEventListener("click", ev => {
        const g = agGeom(cv), r = cv.getBoundingClientRect();
        const px = ev.clientX - r.left, py = ev.clientY - r.top;
        if(px < g.m.l || px > g.m.l + g.pw || py < g.m.t || py > g.m.t + g.ph) return;
        const ear = el.querySelector("#u6-1-audiogram-ear").value;
        const cond = el.querySelector("#u6-1-audiogram-cond").value;
        const masked = el.querySelector("#u6-1-audiogram-mk").checked;
        const mode = el.querySelector("#u6-1-audiogram-mode").value;
        const lf = Math.log10(g.invX(px));
        let best = null, bd = 1e9;
        AG_FREQS[cond].forEach(f => { const d = Math.abs(Math.log10(f) - lf); if(d < bd){ bd = d; best = f; } });
        let lev = Math.round(g.invY(py) / 5) * 5;
        lev = Math.max(-10, Math.min(120, lev));
        const e = el._ag[ear];
        const key = cond + (masked ? "m" : "");
        if(mode === "erase"){ delete e[cond][best]; delete e[cond + "m"][best]; }
        else e[key][best] = lev;
        this.draw(el);
      });
    },
    draw(el){
      const d = el._ag || (el._ag = agExample());
      const iaA = +el.querySelector("#u6-1-audiogram-iaa").value;
      const iaB = +el.querySelector("#u6-1-audiogram-iab").value;
      el.querySelector("#u6-1-audiogram-iaa-o").textContent = iaA + " dB";
      el.querySelector("#u6-1-audiogram-iab-o").textContent = iaB + " dB";
      const cv = el.querySelector("canvas");
      const series = [];
      ["R", "L"].forEach(ear => {
        const e = d[ear];
        const fs = AG_FREQS.AC.filter(f => eff(e, "AC", f) !== undefined);
        if(fs.length > 1) series.push({x: fs, y: fs.map(f => eff(e, "AC", f)), color: ear === "R" ? "--right" : "--left", width: 1.6});
      });
      plot(cv, {
        xlim: AG_X, xlog: true, ylim: AG_Y, xlabel: "Frequency (Hz)", ylabel: "Hearing level (dB HL)",
        xticks: [[125, "125"], [250, "250"], [500, "500"], [1000, "1k"], [2000, "2k"], [4000, "4k"], [8000, "8k"]],
        yticks: [-10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].map(v => [v, String(v)]),
        series
      });
      if(!cv.clientWidth) return;
      const g = agGeom(cv), ctx = cv.getContext("2d");
      ctx.save(); ctx.lineWidth = 2; ctx.font = "bold 17px 'JetBrains Mono', ui-monospace, monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
      const surf = css("--surface");
      const sym = (ear, kind, f, v) => {
        const col = css(ear === "R" ? "--right" : "--left");
        ctx.strokeStyle = col; ctx.fillStyle = col;
        const x = g.X(f), y = g.Y(v), s = 6;
        ctx.beginPath();
        if(kind === "AC"){
          if(ear === "R"){ ctx.fillStyle = surf; ctx.arc(x, y, s, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
          else { ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke(); }
        } else if(kind === "ACm"){
          ctx.fillStyle = surf;
          if(ear === "R"){ ctx.moveTo(x, y - s - 1); ctx.lineTo(x + s + 1, y + s); ctx.lineTo(x - s - 1, y + s); ctx.closePath(); }
          else ctx.rect(x - s, y - s, 2 * s, 2 * s);
          ctx.fill(); ctx.stroke();
        } else {
          const ch = kind === "BC" ? (ear === "R" ? "<" : ">") : (ear === "R" ? "[" : "]");
          ctx.fillText(ch, x + (ear === "R" ? -11 : 11), y);
        }
      };
      ["R", "L"].forEach(ear => ["AC", "ACm", "BC", "BCm"].forEach(k => {
        Object.keys(d[ear][k]).forEach(f => sym(ear, k, +f, d[ear][k][f]));
      }));
      ctx.restore();

      // averages and grades
      const res = {};
      ["R", "L"].forEach(ear => {
        const e = d[ear];
        const p3 = avg(e, [500, 1000, 2000]), p4 = avg(e, [500, 1000, 2000, 4000]);
        res[ear] = p4;
        const t = (p3 === null ? "n/a" : p3.toFixed(1)) + " / " + (p4 === null ? "n/a" : p4.toFixed(1)) + " dB HL";
        el.querySelector(ear === "R" ? "#u6-1-audiogram-pr" : "#u6-1-audiogram-pl").textContent = t;
        el.querySelector(ear === "R" ? "#u6-1-audiogram-gr" : "#u6-1-audiogram-gl").textContent = whoGrade(p4);
      });
      let gb;
      if(res.R === null || res.L === null) gb = "needs both ears at 0.5 to 4 kHz";
      else {
        const b = Math.min(res.R, res.L), w = Math.max(res.R, res.L);
        gb = (b < 20 && w >= 35) ? "Unilateral (WHO 2021)" : whoGrade(b) + " (PTA4 " + b.toFixed(1) + ")";
      }
      el.querySelector("#u6-1-audiogram-gb").textContent = gb;

      // air-bone gaps
      const abgTxt = ["R", "L"].map(ear => {
        const e = d[ear], parts = [];
        AG_FREQS.BC.forEach(f => { const a = eff(e, "AC", f), b = eff(e, "BC", f); if(a !== undefined && b !== undefined) parts.push(fmtF(f) + ": " + (a - b)); });
        return (ear === "R" ? "Right" : "Left") + " air-bone gaps (dB): " + (parts.length ? parts.join(", ") : "none measurable");
      });
      el.querySelector("#u6-1-audiogram-abg").textContent = abgTxt.join(". ") + ".";

      // masking flags
      const flags = [];
      ["R", "L"].forEach(ear => {
        const e = d[ear], o = d[ear === "R" ? "L" : "R"], name = ear === "R" ? "Right" : "Left";
        const acF = [], bcF = [];
        AG_FREQS.AC.forEach(f => {
          const a = e.AC[f]; if(a === undefined || e.ACm[f] !== undefined) return;
          let ref = eff(o, "BC", f); if(ref === undefined) ref = eff(o, "AC", f);
          if(ref !== undefined && a - iaA >= ref) acF.push(fmtF(f));
        });
        AG_FREQS.BC.forEach(f => {
          const b = e.BC[f], a = eff(e, "AC", f); if(b === undefined || a === undefined || e.BCm[f] !== undefined) return;
          const ref = eff(o, "BC", f);
          if(a - b > 10 && (ref === undefined || b - iaB >= ref)) bcF.push(fmtF(f));
        });
        if(acF.length) flags.push(name + " AC: mask the other ear at " + acF.join(", "));
        if(bcF.length) flags.push(name + " BC: mask the other ear at " + bcF.join(", "));
      });
      el.querySelector("#u6-1-audiogram-mask").textContent = flags.length ? "Masking needed. " + flags.join("; ") + "." : "No masking flags with the current IA values.";
    }
  });

  /* ================= 6.1 Masking plateau ================= */
  AT.demo("u6-1-masking", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const q = id => +el.querySelector("#u6-1-masking-" + id).value;
      const T = q("t"), gt = q("gt"), bn = q("bn"), gn = q("gn"), ia = q("ia");
      const bt = Math.max(-10, T - gt);
      el.querySelector("#u6-1-masking-t-o").textContent = T + " dB HL";
      el.querySelector("#u6-1-masking-gt-o").textContent = gt + " dB (BC " + bt + " dB HL)";
      el.querySelector("#u6-1-masking-bn-o").textContent = bn + " dB HL";
      el.querySelector("#u6-1-masking-gn-o").textContent = gn + " dB (AC " + (bn + gn) + " dB HL)";
      el.querySelector("#u6-1-masking-ia-o").textContent = ia + " dB";
      const shadowAt = M => Math.max(bn, M - gn) + ia;
      const testAt = M => T + Math.max(0, (M - ia) - bt);
      const meas = M => Math.min(testAt(M), shadowAt(M));
      const x = [], y = [];
      for(let M = 0; M <= 120; M += 1){ x.push(M); y.push(meas(M)); }
      const un = meas(0), sh = bn + ia;
      const mlo = (sh >= T) ? 0 : T - ia + gn;
      const mhi = bt + ia;
      const width = mhi - Math.max(0, mlo);
      const cs = bn + gn + 10;
      const ymax = Math.max(140, Math.ceil((Math.max(...y) + 10) / 10) * 10);
      const series = [
        {x: [0, 120], y: [T, T], color: "--right", width: 1, dash: [5, 4]},
        {x: [cs, cs], y: [-10, ymax], color: "--left", width: 1.2, dash: [3, 3]},
        {x, y, color: "--accent", width: 2.4}
      ];
      const labels = [];
      if(width > 0){
        const a = Math.max(0, mlo), b = Math.min(120, mhi);
        series.push({x: [a, a], y: [-10, ymax], color: "--warn", width: 1.2, dash: [6, 4]});
        if(mhi <= 120) series.push({x: [mhi, mhi], y: [-10, ymax], color: "--warn", width: 1.2, dash: [6, 4]});
        labels.push({text: "plateau", x: (a + b) / 2, y: T, dy: -8, align: "center", color: "--ink"});
        if(a > 12) labels.push({text: "undermasking", x: a / 2, y: Math.min(T, sh), dy: 22, align: "center", color: "--muted"});
        if(mhi < 108) labels.push({text: "overmasking", x: (mhi + 120) / 2, y: T, dy: 22, align: "center", color: "--muted"});
      } else {
        labels.push({text: "no plateau: masking dilemma", x: 60, y: T, dy: -8, align: "center", color: "--warn"});
      }
      plot(el.querySelector("canvas"), {
        xlim: [0, 120], ylim: [-10, ymax], xlabel: "Masking level in non-test ear (dB EM)", ylabel: "Recorded test-ear threshold (dB HL)",
        series, labels
      });
      el.querySelector("#u6-1-masking-un").textContent = un + " dB HL" + (un < T ? " (shadow)" : "");
      el.querySelector("#u6-1-masking-sh").textContent = sh + " dB HL";
      el.querySelector("#u6-1-masking-pl").textContent = width > 0 ? Math.max(0, mlo) + " to " + mhi + " dB EM" : "none";
      el.querySelector("#u6-1-masking-w").textContent = width > 0 ? width + " dB" : "0 dB (dilemma)";
      el.querySelector("#u6-1-masking-cs").textContent = cs + " dB EM";
      let note;
      if(width <= 0) note = "Masking dilemma: the masker needed to remove the shadow already reaches the test cochlea. Theoretical width 2 x IA - ABG(test) - ABG(non-test) = " + (2 * ia - gt - gn) + " dB. Try a larger IA (insert earphones).";
      else if(sh >= T) note = "The shadow level (" + sh + " dB HL) is at or above the true threshold, so the unmasked threshold is already correct; masking would still confirm it. Overmasking starts above " + mhi + " dB EM.";
      else if(cs > mhi) note = "The clinical starting level (" + cs + " dB EM) is already above the overmasking limit: the first masked threshold would be too high.";
      else if(cs < mlo) note = "Starting at " + cs + " dB EM, the first masked thresholds rise with each masker step (undermasking) until the plateau begins at " + mlo + " dB EM.";
      else note = "Starting at " + cs + " dB EM the tester is already on the plateau; three 5 dB masker steps without a threshold change confirm the true threshold of " + T + " dB HL.";
      el.querySelector("#u6-1-masking-note").textContent = note;
    }
  });

  /* ================= 6.6 DPOAE calculator and DP-gram ================= */
  const DP_F2 = [1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000];
  const HF_PTS = [[1000, 10], [2000, 15], [3000, 30], [4000, 45], [6000, 60], [8000, 70]];
  function hlAt(f, cond){
    if(cond === "flat") return 45;
    if(cond !== "hf") return 0;
    const lf = Math.log2(f);
    if(f <= HF_PTS[0][0]) return HF_PTS[0][1];
    for(let i = 1; i < HF_PTS.length; i++){
      if(f <= HF_PTS[i][0]){
        const a = Math.log2(HF_PTS[i - 1][0]), b = Math.log2(HF_PTS[i][0]);
        return HF_PTS[i - 1][1] + (lf - a) / (b - a) * (HF_PTS[i][1] - HF_PTS[i - 1][1]);
      }
    }
    return HF_PTS[HF_PTS.length - 1][1];
  }
  const nfAt = fdp => -14 + 8 * Math.max(0, Math.log2(2000 / fdp));
  function dpSim(f2, r, L1, L2, cond){
    const f1 = f2 / r, fdp = 2 * f1 - f2;
    const R = rng(Math.round(f2) * 13 + {n: 1, hf: 2, flat: 3, me: 4}[cond]);
    let dp = 8 - 2.5 * Math.abs(Math.log2(f2 / 2500));
    dp += 0.4 * (L2 - 55) - 0.08 * Math.pow(L1 - (0.4 * L2 + 39), 2);
    dp -= 550 * Math.pow(r - 1.22, 2);
    dp -= 0.9 * Math.max(0, hlAt(f2, cond) - 15);
    if(cond === "me") dp -= 1.5 * 25;
    dp += 1.2 * gauss(R);
    const nf = nfAt(fdp) + 1.0 * gauss(R);
    const nbin = nf + 2.0 * gauss(R);
    const meas = 10 * Math.log10(Math.pow(10, dp / 10) + Math.pow(10, nbin / 10));
    return {f1, fdp, meas, nf, snr: meas - nf};
  }
  AT.demo("u6-6-dpoae", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const q = id => el.querySelector("#u6-6-dpoae-" + id);
      const f2 = +q("f2").value, r = +q("r").value, L1 = +q("l1").value, L2 = +q("l2").value;
      const cond = q("ear").value, crit = +q("snr").value;
      q("f2-o").textContent = f2 + " Hz";
      q("r-o").textContent = r.toFixed(2);
      q("l1-o").textContent = L1 + " dB SPL";
      q("l2-o").textContent = L2 + " dB SPL";
      const ok = s => s.snr >= crit && s.meas >= -10;
      const pts = DP_F2.map(f => dpSim(f, r, L1, L2, cond));
      const cur = dpSim(f2, r, L1, L2, cond);
      const cvs = el.querySelectorAll("canvas");
      plot(cvs[0], {
        xlim: [800, 10000], xlog: true, ylim: [-30, 30], xlabel: "f2 (Hz)", ylabel: "Level (dB SPL)",
        xticks: [[1000, "1k"], [2000, "2k"], [4000, "4k"], [8000, "8k"]],
        series: [
          {x: DP_F2, y: pts.map(s => s.nf), color: "--plot-axis", width: 1.6},
          {x: DP_F2, y: pts.map(s => s.nf + crit), color: "--warn", width: 1.2, dash: [5, 4]},
          {x: DP_F2, y: pts.map(s => s.meas), color: "--accent", width: 1.4, marker: "o"},
          {x: [f2], y: [cur.meas], color: "--right", line: false, marker: "dot", msize: 5}
        ],
        labels: DP_F2.map((f, i) => ({text: ok(pts[i]) ? "P" : "R", x: f, y: 26, align: "center", color: ok(pts[i]) ? "--accent" : "--right"}))
      });
      // spectrum at the selected f2
      const lo = Math.max(200, Math.floor((cur.fdp - 500) / 100) * 100), hi = f2 + 700;
      const R2 = rng(f2 * 31 + 7), sx = [], sy = [];
      for(let f = lo; f <= hi; f += 12){ sx.push(f); sy.push(nfAt(f) + 3 * gauss(R2)); }
      plot(cvs[1], {
        xlim: [lo, hi], ylim: [-30, 80], xlabel: "Frequency in ear canal (Hz)", ylabel: "Level (dB SPL)",
        series: [
          {x: sx, y: sy, color: "--plot-axis", width: 1},
          {x: [cur.f1, cur.f1], y: [-30, L1], color: "--right", width: 2},
          {x: [f2, f2], y: [-30, L2], color: "--right", width: 2},
          {x: [cur.fdp, cur.fdp], y: [-30, cur.meas], color: "--accent", width: 3}
        ],
        labels: [
          {text: "f1", x: cur.f1, y: L1, dy: -6, align: "center", color: "--ink"},
          {text: "f2", x: f2, y: L2, dy: -6, align: "center", color: "--ink"},
          {text: "2f1-f2", x: cur.fdp, y: Math.max(cur.meas, -20), dy: -8, align: "center", color: "--ink"}
        ]
      });
      q("rf1").textContent = cur.f1.toFixed(0) + " Hz";
      q("rdp").textContent = cur.fdp.toFixed(0) + " Hz";
      q("rdp2").textContent = (2 * f2 - cur.f1).toFixed(0) + " Hz";
      q("rl").textContent = cur.meas.toFixed(1) + " / " + cur.nf.toFixed(1) + " dB SPL";
      q("rs").textContent = cur.snr.toFixed(1) + " dB (" + (ok(cur) ? "meets" : "fails") + " criterion)";
      const scr = [2000, 3000, 4000, 5000].map(f => ok(pts[DP_F2.indexOf(f)]));
      const np = scr.filter(Boolean).length;
      q("rp").textContent = (np >= 3 ? "PASS" : "REFER") + " (" + np + " of 4)";
      const notes = {
        n: "Normal ear: emissions well above the noise floor at most frequencies. Move the ratio away from 1.22 or make L1 much larger or smaller than 0.4 L2 + 39 dB and watch the DP fall.",
        hf: "High-frequency cochlear loss: emissions fade where the hearing level at the f2 place exceeds roughly 30 to 40 dB HL, so the DP-gram follows the audiogram shape without giving thresholds.",
        flat: "Flat moderate cochlear loss (45 dB HL): emissions are absent across frequencies; the measured level in the DP bin is just the noise.",
        me: "Middle-ear effusion: the conductive loss weakens the primaries on the way in and the emission on the way out, so emissions are absent although the cochlea may be normal. Check tympanometry."
      };
      q("note").textContent = notes[cond] + " Optimal L1 for this L2 by the scissors rule: " + (0.4 * L2 + 39).toFixed(0) + " dB SPL.";
    }
  });
})();

(function(){
  const {plot, css, TAU, rng, gauss} = window.AT;

  /* ---------- shared helpers ---------- */
  function biquad(type, fc, fs){
    const w0 = TAU * fc / fs, c = Math.cos(w0), s = Math.sin(w0), al = s / (2 * Math.SQRT1_2);
    let b0, b1, b2;
    if(type === "lp"){ b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    const a0 = 1 + al;
    return [b0 / a0, b1 / a0, b2 / a0, (-2 * c) / a0, (1 - al) / a0];
  }
  function filt(x, q){
    const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for(let i = 0; i < x.length; i++){
      const v = q[0] * x[i] + q[1] * x1 + q[2] * x2 - q[3] * y1 - q[4] * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  function chain(x, hp, lp, fs){ return filt(filt(x, biquad("hp", hp, fs)), biquad("lp", lp, fs)); }
  const AMP = 1.3;
  const G = (t, L, a, w) => a * Math.exp(-((t - L) / w) * ((t - L) / w));
  /* normal wave V latency shift with level (ms), illustrative model */
  function levelShift(L){ return L >= 80 ? 0.012 * (80 - L) : 0.032 * (80 - L) + 0.0006 * Math.pow(Math.max(0, 40 - L), 2); }

  /* ---------- u6-2-abr: simulated ABR system ---------- */
  const FS = 20000, DT = 1000 / FS, NPRE = 1200, NWIN = 320, NT = NPRE + NWIN; /* -60 ms to +16 ms */
  const tOf = i => (i - NPRE) * DT;
  let abrSeed = 11;
  let calK = null;

  function rawNoise(r, n){
    const x = new Float64Array(n); let b = 0;
    for(let i = 0; i < n; i++){ const w = gauss(r); b = 0.995 * b + 0.05 * gauss(r); x[i] = w + b; }
    return x;
  }
  function rmsOf(x, i0){ let s = 0, n = 0; for(let i = i0; i < x.length; i++){ s += x[i] * x[i]; n++; } return Math.sqrt(s / n); }
  function calibrate(){
    if(calK) return calK;
    const x = rawNoise(rng(999), 24000);
    calK = 1 / rmsOf(chain(x, 100, 3000, FS), 2000);
    return calK;
  }

  function abrParams(L, rate, pol){
    const thr = 10, SL = L - thr, dr = rate - 11.1;
    let aV = SL <= 0 ? 0 : Math.pow(Math.min(1, SL / 70), 0.4);
    let aIII = SL <= 12 ? 0 : Math.pow(Math.min(1, (SL - 12) / 58), 0.8);
    let aI = SL <= 22 ? 0 : Math.pow(Math.min(1, (SL - 22) / 50), 0.9);
    aI *= Math.max(0, 1 - 0.004 * dr); aIII *= Math.max(0, 1 - 0.002 * dr); aV *= Math.max(0, 1 - 0.0012 * dr);
    const sh = levelShift(L), pc = pol < 0 ? 0.06 : 0;
    return {aI, aIII, aV,
      lI: 1.6 + 0.9 * sh + 0.0015 * dr + pc,
      lIII: 3.75 + 0.95 * sh + 0.0035 * dr + pc,
      lV: 5.65 + sh + 0.005 * dr + pc};
  }
  function abrModel(L, rate, pol){
    const p = abrParams(L, rate, pol), x = new Float64Array(NT);
    const wf = 1 + 1.4 * (1 - p.aV), aIV = 0.5 * (p.aIII + p.aV);
    const Acm = 0.25 * Math.pow(10, (L - 80) / 40), Aart = 1.2 * Math.pow(10, (L - 80) / 20);
    for(let i = NPRE - 100; i < NT; i++){
      const t = tOf(i);
      let v = AMP * (G(t, p.lI, 0.28 * p.aI, 0.16) + G(t, p.lI + 0.5, -0.12 * p.aI, 0.18)
        + G(t, p.lI + 1.2, 0.12 * p.aIII, 0.18)
        + G(t, p.lIII, 0.26 * p.aIII, 0.2) + G(t, p.lIII + 0.55, -0.12 * p.aIII, 0.2)
        + G(t, p.lV - 0.7, 0.22 * aIV, 0.2 * wf)
        + G(t, p.lV, 0.36 * p.aV, 0.24 * wf) + G(t, p.lV + 0.95, -0.26 * p.aV, 0.6 * wf));
      if(t > 0.2) v += pol * Acm * Math.sin(TAU * 1.1 * (t - 0.2)) * Math.exp(-(t - 0.2) / 0.9) * Math.min(1, (t - 0.2) / 0.3);
      v += pol * G(t, -0.85, Aart, 0.05);
      x[i] = v;
    }
    return {x, p};
  }

  AT.demo("u6-2-abr", {
    init(el){
      el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el)));
      el.querySelector("#u6-2-abr-new").addEventListener("click", () => { abrSeed += 1; this.draw(el); });
    },
    draw(el){
      const q = s => el.querySelector(s);
      const L = +q("#u6-2-abr-lvl").value, rate = +q("#u6-2-abr-rate").value, pol = q("#u6-2-abr-pol").value;
      const hp = +q("#u6-2-abr-hp").value, lp = +q("#u6-2-abr-lp").value, sd = +q("#u6-2-abr-sd").value;
      const k = +q("#u6-2-abr-n").value;
      let N = Math.round(Math.pow(10, Math.log10(50) + k / 100 * (Math.log10(8000) - Math.log10(50))));
      N = Math.max(50, 2 * Math.round(N / 2));
      const reps = q("#u6-2-abr-rep").checked;
      q("#u6-2-abr-lvl-o").textContent = L + " dB nHL";
      q("#u6-2-abr-rate-o").textContent = rate + " /s";
      q("#u6-2-abr-pol-o").textContent = pol === "r" ? "rarefaction" : pol === "c" ? "condensation" : "alternating";
      q("#u6-2-abr-hp-o").textContent = hp + " Hz";
      q("#u6-2-abr-lp-o").textContent = lp + " Hz";
      q("#u6-2-abr-n-o").textContent = N;
      q("#u6-2-abr-sd-o").textContent = sd + " µV RMS per sweep";

      /* noise-free signal */
      let sig, par;
      if(pol === "a"){
        const r1 = abrModel(L, rate, 1), r2 = abrModel(L, rate, -1);
        sig = new Float64Array(NT); for(let i = 0; i < NT; i++) sig[i] = 0.5 * (r1.x[i] + r2.x[i]);
        par = r1.p;
      } else { const m = abrModel(L, rate, pol === "r" ? 1 : -1); sig = m.x; par = m.p; }
      const sf = chain(sig, hp, lp, FS);

      /* noise: band-limited by the same filters, scaled to sd in the 100 to 3000 Hz reference band */
      const K = calibrate();
      const bandRel = K * rmsOf(chain(rawNoise(rng(999), 24000), hp, lp, FS), 2000);
      const sweepSD = sd * bandRel;
      const half = Math.sqrt(N / 2);
      const r = rng(abrSeed * 7919);
      const nA = chain(rawNoise(r, NT), hp, lp, FS), nB = chain(rawNoise(r, NT), hp, lp, FS);
      const i0 = NPRE - Math.round(1 / DT), nShow = NT - i0;
      const t = [], A = [], B = [], avg = [];
      for(let i = i0; i < NT; i++){
        const a = sf[i] + nA[i] * K * sd / half, b = sf[i] + nB[i] * K * sd / half;
        t.push(tOf(i)); A.push(a); B.push(b); avg.push(0.5 * (a + b));
      }
      const resid = sweepSD / Math.sqrt(N);

      /* statistics over 1 to 12 ms */
      const w0 = t.findIndex(v => v >= 2), w1 = t.findIndex(v => v >= 11);
      let ma = 0, mb = 0, mv = 0, n = w1 - w0;
      for(let i = w0; i < w1; i++){ ma += A[i]; mb += B[i]; mv += avg[i]; }
      ma /= n; mb /= n; mv /= n;
      let sab = 0, saa = 0, sbb = 0, vs = 0;
      for(let i = w0; i < w1; i++){ const da = A[i] - ma, db = B[i] - mb; sab += da * db; saa += da * da; sbb += db * db; vs += (avg[i] - mv) * (avg[i] - mv); }
      const rr = sab / Math.sqrt(saa * sbb), fsp = (vs / n) / (resid * resid);

      /* peak picking on the average */
      function pick(lat, span){
        let bi = -1, bv = -1e9;
        for(let i = 0; i < t.length; i++) if(t[i] >= lat - 0.35 && t[i] <= lat + 0.7 && avg[i] > bv){ bv = avg[i]; bi = i; }
        let tv = 1e9;
        for(let i = bi; i < t.length && t[i] <= t[bi] + span; i++) if(avg[i] < tv) tv = avg[i];
        const ok = fsp >= 3.1 && (bv - tv) > 3 * resid;
        return {ok, t: t[bi], v: bv, amp: bv - tv};
      }
      const pI = pick(par.lI, 0.8), pIII = pick(par.lIII, 0.8), pV = pick(par.lV, 2.0);
      const mk = [];
      [[pI, "I"], [pIII, "III"], [pV, "V"]].forEach(([p, nm]) => { if(p.ok) mk.push({p, nm}); });

      /* scale */
      let mx = 0;
      const lists = reps ? [A, B] : [avg];
      lists.forEach(arr => arr.forEach((v, i) => { if(t[i] >= -1) mx = Math.max(mx, Math.abs(v)); }));
      const lim = Math.min(3, Math.max(0.6, 1.15 * mx));
      const series = [{x: [-1, 15], y: [0, 0], color: "--plot-axis", width: 1, dash: [3, 4]},
                      {x: [0, 0], y: [-lim, lim], color: "--plot-axis", width: 1, dash: [3, 4]}];
      if(reps){ series.push({x: t, y: A, color: "--accent", width: 1.6}); series.push({x: t, y: B, color: "--right", width: 1.4}); }
      else series.push({x: t, y: avg, color: "--accent", width: 1.8});
      if(mk.length) series.push({x: mk.map(m => m.p.t), y: mk.map(m => m.p.v), color: "--warn", line: false, marker: "o", msize: 4});
      const labels = mk.map(m => ({text: m.nm, x: m.p.t, y: m.p.v, dy: -10, color: "--warn", align: "center"}));
      if(pol !== "a" && L >= 50) labels.push({text: "artefact", x: -0.85, y: -lim, dy: -6, color: "--muted", align: "left"});
      plot(q("canvas"), {xlim: [-1, 15], ylim: [-lim, lim], xlabel: "Time after stimulus arrival (ms)", ylabel: "Amplitude (µV)", series, labels});

      const f = p => p.ok ? p.t.toFixed(2) + " ms" : "not identified";
      q("#u6-2-abr-l1").textContent = f(pI);
      q("#u6-2-abr-l3").textContent = f(pIII);
      q("#u6-2-abr-l5").textContent = f(pV);
      q("#u6-2-abr-iv").textContent = pI.ok && pV.ok ? (pV.t - pI.t).toFixed(2) + " ms" : "n/a";
      q("#u6-2-abr-amp").textContent = pV.ok ? pV.amp.toFixed(2) + " µV" : "n/a";
      q("#u6-2-abr-rn").textContent = resid.toFixed(3) + " µV";
      q("#u6-2-abr-r").textContent = rr.toFixed(2);
      q("#u6-2-abr-fsp").textContent = fsp.toFixed(1) + (fsp >= 3.1 ? " (response)" : " (not detected)");
      const sec = N / rate;
      q("#u6-2-abr-t").textContent = sec < 60 ? sec.toFixed(0) + " s" : (sec / 60).toFixed(1) + " min";
    }
  });

  /* ---------- u6-2-lif: latency-intensity function ---------- */
  const normMean = L => 5.65 + levelShift(L);
  function lifPatient(pat, D){
    const out = {thr: 10, lat: L => normMean(L), iv: 4.0};
    if(pat === "c"){ out.thr = 10 + D; out.lat = L => normMean(L - D); }
    else if(pat === "s"){ out.thr = 10 + D; out.lat = L => normMean(L) + (D / 60) * 1.4 * Math.exp(-(L - out.thr) / 12) + (D / 60) * 0.15; }
    else if(pat === "r"){ out.thr = 10 + 0.4 * D; const ex = 0.2 + D / 60 * 1.3; out.lat = L => normMean(L) + ex; out.iv = 4.0 + ex; }
    return out;
  }
  AT.demo("u6-2-lif", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const q = s => el.querySelector(s);
      const pat = q("#u6-2-lif-p").value, D = +q("#u6-2-lif-d").value;
      const names = {n: "normal", c: "conductive", s: "cochlear", r: "retrocochlear"};
      q("#u6-2-lif-p-o").textContent = names[pat];
      const lbl = {n: "Degree (not used)", c: "Air-bone gap", s: "Hearing loss at 2 to 4 kHz", r: "Severity"}[pat];
      q("#u6-2-lif-d-l").textContent = lbl;
      q("#u6-2-lif-d").disabled = pat === "n";
      const P = lifPatient(pat, pat === "n" ? 0 : D);
      q("#u6-2-lif-d-o").textContent = pat === "n" ? "n/a" : pat === "r" ? D + " (extra delay " + (0.2 + D / 60 * 1.3).toFixed(2) + " ms)" : D + " dB";

      const mx = [], my = [];
      for(let L = 10; L <= 95; L += 1){ mx.push(L); my.push(normMean(L)); }
      const px = [], py = [];
      for(let L = 90; L >= 0; L -= 10){ if(L >= P.thr - 1e-9){ px.push(L); py.push(P.lat(L) + 0.04 * Math.sin(L * 1.7)); } }
      const cv = q("canvas");
      plot(cv, {xlim: [0, 100], ylim: [4, 10], xlabel: "Click level (dB nHL)", ylabel: "Wave V latency (ms)",
        series: [{x: mx, y: my, color: "--plot-axis", width: 1.2, dash: [5, 4]},
                 {x: px, y: py, color: "--right", width: 1.8, marker: "o", msize: 4.5}],
        labels: [{text: "illustrative normal region", x: 62, y: 5.0, color: "--muted"}]});
      /* shaded normal region (mean plus or minus 0.4 ms), drawn behind the plot */
      const w = cv.clientWidth, h = +(cv.dataset.h || 300);
      if(w){
        const ctx = cv.getContext("2d"), m = {l: 56, r: 14, t: 10, b: 40}, pw = w - m.l - m.r, ph = h - m.t - m.b;
        const X = v => m.l + v / 100 * pw, Y = v => m.t + (10 - v) / 6 * ph;
        ctx.save(); ctx.globalCompositeOperation = "destination-over"; ctx.globalAlpha = 0.16; ctx.fillStyle = css("--accent");
        ctx.beginPath();
        mx.forEach((L, i) => { const y = Math.min(10, my[i] + 0.4); i ? ctx.lineTo(X(L), Y(y)) : ctx.moveTo(X(L), Y(y)); });
        for(let i = mx.length - 1; i >= 0; i--) ctx.lineTo(X(mx[i]), Y(my[i] - 0.4));
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      const thrL = px.length ? px[px.length - 1] : null;
      q("#u6-2-lif-th").textContent = thrL === null ? "no response to 90 dB nHL" : thrL + " dB nHL";
      const i80 = px.indexOf(80);
      q("#u6-2-lif-v80").textContent = i80 >= 0 ? py[i80].toFixed(2) + " ms" : "no response";
      q("#u6-2-lif-dv").textContent = i80 >= 0 ? (py[i80] - normMean(80) >= 0 ? "+" : "") + (py[i80] - normMean(80)).toFixed(2) + " ms" : "n/a";
      const iT = px.indexOf(thrL), i20 = px.indexOf(thrL + 20);
      q("#u6-2-lif-sl").textContent = thrL !== null && i20 >= 0 ? ((py[iT] - py[i20]) / 2).toFixed(2) + " ms per 10 dB" : "n/a";
      q("#u6-2-lif-iv").textContent = thrL !== null && thrL <= 80 ? P.iv.toFixed(2) + " ms" + (P.iv > 4.45 ? " (prolonged)" : " (normal)") : "n/a";
    }
  });
})();

(function(){
  const {plot, rng, gauss, TAU} = window.AT;

  /* ---------- shared ABR template ---------- */
  const g = (t, mu, sd) => Math.exp(-0.5 * ((t - mu) / sd) * ((t - mu) / sd));
  const NS = 480, T = [];
  for(let i = 0; i < NS; i++) T.push(i * 12 / (NS - 1));
  /* shapes for waves I, III, V (unit peak); V includes its following trough */
  function abr(aI, aIII, aV, shiftV){
    const y = new Float64Array(NS), sv = shiftV || 0;
    for(let i = 0; i < NS; i++){
      const t = T[i];
      y[i] = aI * g(t, 1.6, 0.18) + aIII * g(t, 3.75, 0.2)
           + aV * (g(t, 5.6 + sv, 0.25) - 0.55 * g(t, 6.7 + sv, 0.45));
    }
    return y;
  }
  /* filtered noise with unit RMS */
  function noise(r, n){
    const w = new Float64Array(n + 4), y = new Float64Array(n);
    for(let i = 0; i < n + 4; i++) w[i] = gauss(r);
    let s = 0;
    for(let i = 0; i < n; i++){ y[i] = 0.1*w[i] + 0.25*w[i+1] + 0.3*w[i+2] + 0.25*w[i+3] + 0.1*w[i+4]; s += y[i]*y[i]; }
    const k = 1 / Math.sqrt(s / n);
    for(let i = 0; i < n; i++) y[i] *= k;
    return y;
  }
  const fmtUV = v => (Math.abs(v) < 0.1 ? v.toFixed(3) : v.toFixed(2)) + " µV";

  /* ---------- demo 1: montage ---------- */
  /* illustrative site potentials (microvolts) for waves I, III, V; latency shift of V (ms) */
  const SITE = {
    cz:   {I: 0.05,  III: 0.18,  V: 0.32, name: "Cz"},
    fz:   {I: 0.045, III: 0.16,  V: 0.28, name: "Fz"},
    fpz:  {I: 0.035, III: 0.11,  V: 0.19, name: "Fpz"},
    mi:   {I: -0.22, III: -0.05, V: -0.12, name: "ipsilateral mastoid"},
    ai:   {I: -0.25, III: -0.05, V: -0.11, name: "ipsilateral earlobe"},
    mc:   {I: -0.02, III: 0.03,  V: -0.10, name: "contralateral mastoid", sv: 0.12},
    nape: {I: -0.03, III: -0.06, V: -0.18, name: "nape"}
  };
  const EMG = {sleep: 0.8, relax: 2.5, tense: 5};
  const REFEMG = {mi: 1.0, ai: 0.8, mc: 1.0, nape: 2.0};
  AT.demo("u6-3-montage", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); el.querySelectorAll("select,input[type=checkbox]").forEach(i => i.addEventListener("change", () => this.draw(el))); },
    draw(el){
      const q = id => el.querySelector("#u6-3-montage-" + id);
      const act = q("act").value, ref = q("ref").value, gnd = q("gnd").value, st = q("st").value, sw = q("sw").checked;
      const A = SITE[act], R = SITE[ref];
      const sign = sw ? -1 : 1;
      const aI = sign * (A.I - R.I), aIII = sign * (A.III - R.III), aV = sign * (A.V - R.V);
      const clean = abr(aI, aIII, aV, R.sv || 0);
      const refTrace = abr(SITE.cz.I - SITE.mi.I, SITE.cz.III - SITE.mi.III, SITE.cz.V - SITE.mi.V, 0);
      /* noise model: EEG 1.5 uV + EMG (state x reference site; nape matters less asleep) */
      let emg = EMG[st] * (st === "sleep" ? 1 + (REFEMG[ref] - 1) * 0.2 : REFEMG[ref]);
      if(act === "fpz" && st !== "sleep") emg *= 1.2; /* eye and frontal muscle */
      let mains = 0.3; /* uV RMS single sweep */
      if(gnd === "cb") { mains = 1.5; emg *= 1.15; }
      const sigma = Math.sqrt(1.5 * 1.5 + emg * emg + mains * mains);
      const N = 2000, rn = sigma / Math.sqrt(N);
      const seed = 7 + act.length * 13 + ref.length * 31 + gnd.length * 5 + st.length * 3;
      const nz = noise(rng(seed), NS);
      const y = [];
      for(let i = 0; i < NS; i++) y.push(clean[i] + rn * nz[i] + 0.3 * (mains / Math.sqrt(N)) * Math.sin(TAU * 50 * T[i] / 1000));
      /* readouts */
      q("w1").textContent = fmtUV(aI) + (Math.abs(aI) < 0.1 ? " (small)" : "");
      q("w5").textContent = fmtUV(aV);
      q("nz").textContent = sigma.toFixed(1) + " µV RMS";
      q("rn").textContent = fmtUV(rn);
      const msg = [];
      if(sw) msg.push("Leads swapped: every wave is inverted; do not mark troughs as peaks.");
      if(ref === "mc") msg.push("Reference on the contralateral mastoid: wave I nearly disappears and wave V is slightly later, as in a contralateral channel.");
      if(ref === "nape") msg.push("Nape reference: wave I is smaller (the nape is far from the auditory nerve), wave V is similar or larger" + (st === "sleep" ? "; EMG is low because the patient is asleep." : "; neck-muscle EMG raises the noise in an awake patient."));
      if(ref === "ai") msg.push("Earlobe reference: wave I clear, slightly less neck EMG than the mastoid.");
      if(act === "fz") msg.push("High forehead active: wave V a little smaller than at Cz; standard in infants.");
      if(act === "fpz") msg.push("Low forehead active: electrodes closer to the ground site and further from the vertex dipole, so wave V is clearly smaller.");
      if(gnd === "cb") msg.push("Collarbone ground: waveform unchanged in principle, but more common-mode ECG and mains to reject.");
      if(gnd === "fh" && act === "fpz") msg.push("Warning: active and ground both on the forehead. Keep the ground away from the recording electrode (move ground to the contralateral mastoid).");
      if(gnd === "mc" && ref === "mc") msg.push("Warning: ground and reference cannot share the contralateral mastoid; choose another ground site.");
      if(st === "tense") msg.push("Tense patient: EMG dominates the noise; relaxing or sleeping would cut the sweeps needed several-fold.");
      if(!msg.length) msg.push("Standard montage: wave I, III and V clear with low noise.");
      q("msg").textContent = msg.join(" ");
      const lim = Math.max(0.8, Math.min(2.5, Math.max(...y.map(Math.abs)) * 1.15));
      const labels = [];
      if(!sw){
        labels.push({text: "I", x: 1.6, y: Math.max(aI, 0) , dy: -10, color: "--ink", align: "center"});
        labels.push({text: "V", x: 5.6 + (R.sv || 0), y: Math.max(aV, 0), dy: -10, color: "--ink", align: "center"});
      } else {
        labels.push({text: "inverted", x: 5.6, y: aV, dy: 16, color: "--ink", align: "center"});
      }
      plot(el.querySelector("canvas"), {
        xlim: [0, 12], ylim: [-lim, lim], xlabel: "Time after stimulus (ms)", ylabel: "Amplitude (µV)",
        series: [
          {x: T, y: Array.from(refTrace), color: "--right", width: 1.2, dash: [5, 4]},
          {x: T, y: y, color: "--accent", width: 1.8}
        ],
        labels
      });
    }
  });

  /* ---------- demo 2: impedance imbalance ---------- */
  AT.demo("u6-3-imbalance", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const q = id => el.querySelector("#u6-3-imbalance-" + id);
      const z1 = +q("z1").value * 1000, z2 = +q("z2").value * 1000;
      const zin = Math.pow(10, +q("zin").value);
      const cmrr = +q("cmrr").value;
      const vcm = Math.pow(10, +q("vcm").value) * 1e-3; /* volts RMS */
      q("z1-o").textContent = (z1 / 1000).toFixed(1) + " kΩ";
      q("z2-o").textContent = (z2 / 1000).toFixed(1) + " kΩ";
      const zs = zin >= 1e9 ? (zin / 1e9).toFixed(zin < 1e10 ? 1 : 0) + " GΩ" : (zin / 1e6).toFixed(zin < 1e7 ? 1 : 0) + " MΩ";
      q("zin-o").textContent = zs;
      q("cmrr-o").textContent = cmrr + " dB";
      q("vcm-o").textContent = vcm >= 1 ? vcm.toFixed(2) + " V" : (vcm * 1e3 >= 10 ? (vcm * 1e3).toFixed(0) : (vcm * 1e3).toFixed(2)) + " mV";
      const eImb = vcm * Math.abs(zin / (z1 + zin) - zin / (z2 + zin));
      const eAmp = vcm / Math.pow(10, cmrr / 20);
      const eTot = eImb + eAmp;
      const uv = v => { const u = v * 1e6; return (u >= 100 ? u.toFixed(0) : u >= 1 ? u.toFixed(2) : u.toFixed(3)) + " µV"; };
      q("ei").textContent = uv(eImb);
      q("ea").textContent = uv(eAmp);
      q("et").textContent = uv(eTot);
      const ce = 20 * Math.log10(vcm / eTot);
      q("ce").textContent = ce.toFixed(1) + " dB";
      const ratio = eTot * 1e6 / 0.5;
      q("vd").textContent = ratio >= 1 ? "error " + ratio.toFixed(ratio >= 10 ? 0 : 1) + " × wave V" : ratio >= 0.2 ? "comparable to wave V" : "small vs wave V";
      const clean = abr(0.27, 0.23, 0.44, 0);
      const pk = eTot * 1e6 * Math.SQRT2;
      const y = [];
      for(let i = 0; i < NS; i++) y.push(clean[i] + pk * Math.sin(TAU * 50 * T[i] / 1000 + 0.6));
      const lim = Math.max(0.8, Math.min(1e4, Math.max(...y.map(Math.abs)) * 1.15));
      plot(el.querySelector("canvas"), {
        xlim: [0, 12], ylim: [-lim, lim], xlabel: "Time after stimulus (ms)", ylabel: "Amplitude (µV)",
        series: [
          {x: T, y: Array.from(clean), color: "--right", width: 1.2, dash: [5, 4]},
          {x: T, y: y, color: "--accent", width: 1.8}
        ],
        labels: [{text: "one 12 ms sweep; 50 Hz period is 20 ms", x: 0.3, y: -lim * 0.85, color: "--muted", align: "left"}]
      });
    }
  });

  /* ---------- demo 3: residual noise vs sweeps ---------- */
  const LEVELS = [{s: 2, c: "--accent", id: "g"}, {s: 4, c: "--left", id: "a"}, {s: 8, c: "--right", id: "p"}];
  AT.demo("u6-3-noise", {
    init(el){ el.querySelectorAll("input,select").forEach(i => { i.addEventListener("input", () => this.draw(el)); i.addEventListener("change", () => this.draw(el)); }); },
    draw(el){
      const q = id => el.querySelector("#u6-3-noise-" + id);
      const tg = +q("tg").value, rate = +q("rt").value, rj = +q("rj").value / 100;
      q("tg-o").textContent = tg.toFixed(3) + " µV";
      q("rj-o").textContent = Math.round(rj * 100) + " %";
      const ymax = 0.3, series = [], labels = [];
      LEVELS.forEach(L => {
        const x = [], y = [];
        const n0 = Math.max(100, Math.pow(L.s / ymax, 2));
        for(let k = 0; k <= 200; k++){
          const n = n0 * Math.pow(1e5 / n0, k / 200);
          x.push(n); y.push(L.s / Math.sqrt(n));
        }
        series.push({x, y, color: L.c, width: 2});
        const N = Math.ceil(Math.pow(L.s / tg, 2));
        const sec = N / (rate * (1 - rj));
        const tStr = sec < 90 ? sec.toFixed(0) + " s" : (sec / 60).toFixed(1) + " min";
        q(L.id).textContent = N.toLocaleString("en-GB") + " sweeps, " + tStr;
        if(N <= 1e5) series.push({x: [N], y: [tg], color: L.c, marker: "o", msize: 5, line: false});
      });
      series.push({x: [100, 1e5], y: [tg, tg], color: "--warn", width: 1.5, dash: [6, 4]});
      labels.push({text: "target", x: 120, y: tg, dy: -8, color: "--warn", align: "left"});
      plot(el.querySelector("canvas"), {
        xlim: [100, 1e5], ylim: [0, ymax], xlog: true,
        xticks: [[100, "100"], [300, "300"], [1000, "1k"], [3000, "3k"], [10000, "10k"], [30000, "30k"], [100000, "100k"]],
        xlabel: "Accepted sweeps N (log scale)", ylabel: "Residual noise (µV RMS)",
        series, labels
      });
    }
  });
})();

/* Unit 6 part d: ASSR (6.4) and other electrophysiological tests (6.5) */
(function(){
  const {plot, css, TAU, rng, gauss, fft, $} = window.AT;

  /* ---------- helpers ---------- */
  function fmtHz(v){ return (Math.round(v * 100) / 100) + " Hz"; }
  function fmtP(p){
    if(!isFinite(p)) return "-";
    if(p < 0.0001) return "< 0.0001";
    return p < 0.01 ? p.toFixed(4) : p.toFixed(3);
  }
  /* log-gamma (Lanczos) */
  function lgamma(x){
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if(x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + g + 0.5;
    for(let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(TAU) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  /* continued fraction for the incomplete beta function (Numerical Recipes style) */
  function betacf(a, b, x){
    const MAXIT = 300, EPS = 1e-14, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap; if(Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for(let m = 1; m <= MAXIT; m++){
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if(Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if(Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if(Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if(Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del; if(Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  /* regularised incomplete beta I_x(a, b) */
  function betainc(x, a, b){
    if(x <= 0) return 0; if(x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if(x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }
  /* upper-tail p-value of the F distribution with (d1, d2) degrees of freedom */
  function fPvalue(F, d1, d2){
    if(F <= 0) return 1;
    const x = d1 * F / (d1 * F + d2);
    return Math.max(0, 1 - betainc(x, d1 / 2, d2 / 2));
  }
  function fCritical(alpha, d1, d2){
    let lo = 0, hi = 100;
    for(let i = 0; i < 80; i++){ const mid = (lo + hi) / 2; if(fPvalue(mid, d1, d2) > alpha) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  /* ---------- 6.4 demo 1: ASSR stimulus builder ---------- */
  AT.demo("u6-4-stim", {
    init(el){
      const pre = el.querySelector("#u6-4-stim-pre");
      pre.addEventListener("change", () => {
        const v = pre.value, am = el.querySelector("#u6-4-stim-am"), fmd = el.querySelector("#u6-4-stim-fmd"), env = el.querySelector("#u6-4-stim-env");
        if(v === "am"){ am.value = 100; fmd.value = 0; env.value = "1"; }
        if(v === "fm"){ am.value = 0; fmd.value = 20; env.value = "1"; }
        if(v === "mm"){ am.value = 100; fmd.value = 20; env.value = "1"; }
        if(v === "am2"){ am.value = 100; fmd.value = 0; env.value = "2"; }
        this.draw(el);
      });
      el.querySelectorAll("input,select").forEach(i => { if(i !== pre) i.addEventListener("input", () => { pre.value = ""; this.draw(el); }); });
    },
    draw(el){
      const fc = +el.querySelector("#u6-4-stim-fc").value;
      const fm = +el.querySelector("#u6-4-stim-fm").value;
      const m = +el.querySelector("#u6-4-stim-am").value / 100;
      const D = +el.querySelector("#u6-4-stim-fmd").value / 100;
      const N = +el.querySelector("#u6-4-stim-env").value;
      el.querySelector("#u6-4-stim-fm-o").textContent = fm + " Hz";
      el.querySelector("#u6-4-stim-am-o").textContent = Math.round(m * 100) + " %";
      el.querySelector("#u6-4-stim-fmd-o").textContent = Math.round(D * 100) + " % (" + (fc * (1 - D / 2)).toFixed(0) + " to " + (fc * (1 + D / 2)).toFixed(0) + " Hz)";

      const key = [fc, fm, m, D, N].join(",");
      if(this._key !== key){
        const fs = 16384, n = 16384; /* 1 s: 1 Hz bins, integer fc and fm fall exactly on bins */
        const dF = D * fc / 2, beta = dF / fm;
        const re = new Float64Array(n), im = new Float64Array(n), env = new Float64Array(n);
        for(let i = 0; i < n; i++){
          const t = i / fs, s = Math.sin(TAU * fm * t);
          const e = Math.pow((1 + m * s) / (1 + m), N);
          env[i] = e;
          re[i] = e * Math.sin(TAU * fc * t - beta * Math.cos(TAU * fm * t));
        }
        const x = Float64Array.from(re);
        fft(re, im);
        const mag = new Float64Array(n / 2); let mx = 0;
        for(let k = 0; k < n / 2; k++){ mag[k] = Math.hypot(re[k], im[k]); if(mag[k] > mx) mx = mag[k]; }
        const db = new Float64Array(n / 2);
        for(let k = 0; k < n / 2; k++) db[k] = Math.max(-80, 20 * Math.log10(mag[k] / mx + 1e-12));
        this._c = {fs, x, env, db, mag, beta, dF};
        this._key = key;
      }
      const {fs, x, env, db, mag, beta, dF} = this._c;
      const cv = el.querySelectorAll("canvas");

      /* time waveform: three modulation periods */
      const dur = Math.min(0.15, 3 / fm), nt = Math.floor(dur * fs);
      const tx = [], ty = [], ex = [], ey = [], ey2 = [];
      for(let i = 0; i < nt; i++){ const t = i / fs * 1000; tx.push(t); ty.push(x[i]); }
      for(let i = 0; i < nt; i += 8){ const t = i / fs * 1000; ex.push(t); ey.push(env[i]); ey2.push(-env[i]); }
      plot(cv[0], {xlim:[0, dur * 1000], ylim:[-1.15, 1.15], xlabel:"Time (ms)", ylabel:"Amplitude",
        series:[{x:tx, y:ty, color:"--accent", width:1}, {x:ex, y:ey, color:"--right", width:1.6, dash:[5,4]}, {x:ex, y:ey2, color:"--right", width:1.6, dash:[5,4]}]});

      /* spectrum around the carrier */
      const half = Math.max(5 * fm, dF + 4 * fm, 150);
      const f0 = Math.max(1, Math.floor(fc - half)), f1 = Math.min(fs / 2 - 1, Math.ceil(fc + half));
      const sx = [], sy = [];
      for(let k = f0; k <= f1; k++){ sx.push(k); sy.push(db[k]); }
      const mk = [fc - fm, fc + fm].filter(f => f >= f0 && f <= f1);
      plot(cv[1], {xlim:[f0, f1], ylim:[-80, 5], xlabel:"Frequency (Hz)", ylabel:"Level re largest (dB)",
        series:[{x:sx, y:sy, color:"--accent", width:1.4},
          {x:mk, y:mk.map(f => db[f]), color:"--right", line:false, marker:"o", msize:5},
          {x:[fc], y:[db[fc]], color:"--ink", line:false, marker:"x", msize:5}],
        labels:[{text:"fc", x:fc, y:db[fc], dy:-10, align:"center", color:"--ink"},
          {text:"fc-fm", x:fc - fm, y:db[fc - fm], dy:-10, align:"center", color:"--right"},
          {text:"fc+fm", x:fc + fm, y:db[fc + fm], dy:-10, align:"center", color:"--right"}]});

      el.querySelector("#u6-4-stim-lsb").textContent = (fc - fm) + " Hz";
      el.querySelector("#u6-4-stim-usb").textContent = (fc + fm) + " Hz";
      const car = mag[fc], sb = Math.max(mag[fc + fm], mag[fc - fm]);
      let sbl;
      if(car < 1e-6 * Math.max(...[mag[fc + fm], 1e-12])) sbl = "carrier near zero";
      else sbl = (20 * Math.log10(sb / car)).toFixed(1) + " dB re carrier";
      el.querySelector("#u6-4-stim-sbl").textContent = sbl;
      el.querySelector("#u6-4-stim-beta").textContent = D > 0 ? beta.toFixed(2) + " (Δf " + dF.toFixed(0) + " Hz)" : "0 (no FM)";
      let lo = -1, hi = -1;
      for(let k = 1; k < db.length; k++) if(db[k] > -30){ if(lo < 0) lo = k; hi = k; }
      el.querySelector("#u6-4-stim-bw").textContent = (hi - lo) + " Hz (" + lo + " to " + hi + ")";
    }
  });

  /* ---------- 6.4 demo 2: F-test and phase coherence ---------- */
  const FT = {fs:1000, N:1024, kSig:92, L:60};
  FT.fm = FT.kSig * FT.fs / FT.N;
  FT.fcrit = fCritical(0.05, 2, 4 * FT.L);

  AT.demo("u6-4-ftest", {
    init(el){
      this._seed = 13;
      el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el)));
      el.querySelector("#u6-4-ftest-seed").addEventListener("click", () => { this._seed += 1; this.draw(el); });
    },
    compute(A, sigma, M, seed){
      const {N, fs, kSig} = FT, kmax = 210;
      const r = rng(seed * 7919 + 13);
      const sumRe = new Float64Array(kmax), sumIm = new Float64Array(kmax), ph = new Float64Array(M);
      const re = new Float64Array(N), im = new Float64Array(N), w = TAU * FT.fm / fs, phi0 = 0.9;
      for(let e = 0; e < M; e++){
        for(let n = 0; n < N; n++){ re[n] = A * Math.sin(w * n + phi0) + sigma * gauss(r); im[n] = 0; }
        fft(re, im);
        for(let k = 0; k < kmax; k++){ sumRe[k] += re[k]; sumIm[k] += im[k]; }
        ph[e] = Math.atan2(im[kSig], re[kSig]);
      }
      const amp = new Float64Array(kmax);
      for(let k = 0; k < kmax; k++) amp[k] = 2 / N * Math.hypot(sumRe[k] / M, sumIm[k] / M);
      return {amp, ph};
    },
    draw(el){
      const A = +el.querySelector("#u6-4-ftest-a").value;
      const noiseUv = +el.querySelector("#u6-4-ftest-n").value;
      const M = Math.pow(2, +el.querySelector("#u6-4-ftest-k").value);
      el.querySelector("#u6-4-ftest-a-o").textContent = A + " nV";
      el.querySelector("#u6-4-ftest-n-o").textContent = noiseUv + " µV";
      el.querySelector("#u6-4-ftest-k-o").textContent = M + " (" + (M * FT.N / FT.fs).toFixed(1) + " s)";
      const key = [A, noiseUv, M, this._seed].join(",");
      if(this._key !== key){ this._res = this.compute(A, noiseUv * 1000, M, this._seed); this._key = key; }
      const {amp, ph} = this._res, {kSig, L, N, fs} = FT;
      const df = fs / N;

      /* statistics */
      let pn = 0; const nb = [];
      for(let k = kSig - L; k <= kSig + L; k++){ if(k === kSig) continue; pn += amp[k] * amp[k]; nb.push(k); }
      pn /= nb.length;
      const As = amp[kSig], F = As * As / pn, p = fPvalue(F, 2, 2 * nb.length);
      let cx = 0, cy = 0; for(let i = 0; i < M; i++){ cx += Math.cos(ph[i]); cy += Math.sin(ph[i]); }
      const R = Math.hypot(cx, cy) / M, Rn = R * M;
      let pr = Math.exp(Math.sqrt(1 + 4 * M + 4 * (M * M - Rn * Rn)) - (1 + 2 * M));
      pr = Math.min(1, Math.max(0, pr));
      const noiseRms = Math.sqrt(pn), aCrit = noiseRms * Math.sqrt(FT.fcrit);

      el.querySelector("#u6-4-ftest-t").textContent = (M * N / fs).toFixed(1) + " s";
      el.querySelector("#u6-4-ftest-as").textContent = As.toFixed(1) + " nV";
      el.querySelector("#u6-4-ftest-an").textContent = noiseRms.toFixed(1) + " nV";
      el.querySelector("#u6-4-ftest-f").textContent = F.toFixed(2) + " (crit " + FT.fcrit.toFixed(2) + ")";
      el.querySelector("#u6-4-ftest-p").textContent = fmtP(p);
      el.querySelector("#u6-4-ftest-r").textContent = R.toFixed(3);
      el.querySelector("#u6-4-ftest-pr").textContent = fmtP(pr);
      el.querySelector("#u6-4-ftest-d").textContent = p < 0.05 ? "Detected (p < 0.05)" : "Not detected";

      /* spectrum */
      const cvs = el.querySelectorAll("canvas"), cv = cvs[0];
      const xs = [], ys = [];
      for(let k = 1; k < amp.length; k++){ xs.push(k * df); ys.push(amp[k]); }
      let ymax = Math.max(aCrit, As); for(let k = 5; k < amp.length; k++) ymax = Math.max(ymax, amp[k]);
      ymax = Math.max(10, ymax * 1.25);
      const nx = nb.map(k => k * df), ny = nb.map(k => amp[k]);
      plot(cv, {xlim:[0, 200], ylim:[0, ymax], xlabel:"Frequency (Hz)", ylabel:"Amplitude (nV)",
        series:[{x:xs, y:ys, color:"--plot-axis", width:1},
          {x:nx, y:ny, color:"--left", line:false, marker:"dot", msize:2.2},
          {x:[0, 200], y:[aCrit, aCrit], color:"--warn", width:1.4, dash:[6,4]},
          {x:[0, 200], y:[noiseRms, noiseRms], color:"--left", width:1, dash:[2,3]},
          {x:[FT.fm, FT.fm], y:[0, As], color:"--right", width:2.4},
          {x:[FT.fm], y:[As], color:"--right", line:false, marker:"o", msize:5}],
        labels:[{text:"fm = " + FT.fm.toFixed(2) + " Hz", x:FT.fm, y:As, dy:-10, align:"center", color:"--right"},
          {text:"p = 0.05 level", x:198, y:aCrit, dy:-5, align:"right", color:"--warn"}]});
      /* shade the noise-bin region (drawn over the plot using the same margins as AT.plot) */
      try {
        const ctx = cv.getContext("2d"), w = cv.clientWidth, h = +cv.dataset.h;
        const ml = 56, mr = 14, mt = 10, mb = 40, pw = w - ml - mr, phh = h - mt - mb;
        const X = v => ml + v / 200 * pw;
        const a = X((kSig - L - 0.5) * df), b = X((kSig - 0.5) * df), c = X((kSig + 0.5) * df), d = X((kSig + L + 0.5) * df);
        ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = css("--left");
        ctx.fillRect(a, mt, b - a, phh); ctx.fillRect(c, mt, d - c, phh); ctx.restore();
      } catch(e){}

      /* polar plot of epoch phases */
      const pc = cvs[1], w = pc.clientWidth; if(!w) return;
      const h = +(pc.dataset.h || 260), dpr = window.devicePixelRatio || 1;
      pc.style.height = h + "px"; pc.width = Math.round(w * dpr); pc.height = Math.round(h * dpr);
      const ctx = pc.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const cxp = w / 2, cyp = h / 2 - 6, rad = Math.min(w, h) / 2 - 26;
      ctx.strokeStyle = css("--plot-grid"); ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(f => { ctx.beginPath(); ctx.arc(cxp, cyp, rad * f, 0, TAU); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(cxp - rad, cyp); ctx.lineTo(cxp + rad, cyp); ctx.moveTo(cxp, cyp - rad); ctx.lineTo(cxp, cyp + rad); ctx.stroke();
      ctx.strokeStyle = css("--plot-axis"); ctx.beginPath(); ctx.arc(cxp, cyp, rad, 0, TAU); ctx.stroke();
      const rc = Math.sqrt(-Math.log(0.05) / M);
      ctx.strokeStyle = css("--warn"); ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(cxp, cyp, rad * Math.min(1, rc), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = css("--accent"); ctx.globalAlpha = M > 64 ? 0.45 : 0.8;
      const show = Math.min(M, 256);
      for(let i = 0; i < show; i++){ ctx.beginPath(); ctx.arc(cxp + rad * Math.cos(ph[i]), cyp - rad * Math.sin(ph[i]), 3, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      const mx = cx / M, my = cy / M;
      ctx.strokeStyle = css("--right"); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cxp, cyp); ctx.lineTo(cxp + rad * mx, cyp - rad * my); ctx.stroke();
      ctx.fillStyle = css("--right"); ctx.beginPath(); ctx.arc(cxp + rad * mx, cyp - rad * my, 4, 0, TAU); ctx.fill();
      ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace"; ctx.fillStyle = css("--muted"); ctx.textAlign = "center";
      ctx.fillText("R = " + R.toFixed(2) + "   (dashed: p = 0.05)", cxp, h - 6);
      ctx.fillText("0°", cxp + rad + 12, cyp + 4 > h ? h : cyp + 4);
    }
  });

  /* ---------- 6.5 demo: typical waveforms ---------- */
  const G = (t, mu, sd, a) => a * Math.exp(-0.5 * ((t - mu) / sd) * ((t - mu) / sd));
  const S = z => 1 / (1 + Math.exp(-z));
  const WAVES = {
    ecochg: {
      xlim:[-1, 5], xlabel:"Time (ms)", ylabel:"Amplitude (µV)", win:"-1 to 5 ms (clinical window about 10 ms)",
      make(v){ const sp = v ? 0.8 : 0.35, ap = v ? 0.7 : 0.85;
        return {sp, ap, f: t => -sp * S((t - 0.8) / 0.07) * (1 - S((t - 2.7) / 0.15)) + G(t, 1.5, 0.15, -ap) + G(t, 2.0, 0.2, 0.25) + G(t, 2.55, 0.18, -0.3)}; },
      labels(o){ return [{t:1.05, text:"SP", dy:16}, {t:1.5, text:"AP (N1)", dy:16}, {t:2.55, text:"N2", dy:16}]; },
      measure(o, f){ let mn = 0; for(let t = 1.2; t < 1.8; t += 0.005) mn = Math.min(mn, f(t)); const APamp = -mn; return "SP/AP = " + (o.sp / APamp).toFixed(2) + " (SP " + o.sp.toFixed(2) + " µV, AP " + APamp.toFixed(2) + " µV)"; },
      note:["ECochG: SP is a DC shift from hair cells (baseline to the shoulder on the AP); AP N1 at about 1.3 to 1.8 ms is the compound action potential of the distal auditory nerve (same as ABR wave I). The CM (not shown) follows the stimulus and cancels with alternating polarity. Negative is plotted downwards here; many clinics plot ECochG negative-up.",
            "Clinical variant: enlarged SP with the same click gives an SP/AP ratio above a typical extratympanic upper limit of about 0.4 to 0.5, the pattern associated with endolymphatic hydrops (Menière's disease). Sensitivity is moderate, so a normal ratio does not exclude hydrops."]
    },
    mlr: {
      xlim:[0, 80], xlabel:"Time (ms)", ylabel:"Amplitude (µV)", win:"0 to 80 ms (commonly 80 to 100 ms)",
      make(v){ const pa = v ? 0.35 : 1.0, nb = v ? -0.35 : -0.7;
        return {f: t => G(t, 6, 0.7, 0.3) + G(t, 18, 3, -0.6) + G(t, 30, 4, pa) + G(t, 42, 4, nb) + G(t, 55, 5, 0.6)}; },
      labels(){ return [{t:6, text:"V", dy:-8}, {t:18, text:"Na", dy:16}, {t:30, text:"Pa", dy:-8}, {t:42, text:"Nb", dy:16}, {t:55, text:"Pb", dy:-8}]; },
      measure(o, f){ return "Na-Pa = " + (f(30) - f(18)).toFixed(2) + " µV"; },
      note:["MLR: Na about 15 to 20 ms (subcortical, thalamus and upper midbrain), Pa about 25 to 35 ms (primary auditory cortex, thalamocortical), Nb about 35 to 45 ms, Pb about 50 to 60 ms (= P1 of the CAEP). Waves spaced about 25 ms apart underlie the 40 Hz ASSR. Filter about 10 to 200 Hz; rate below about 11/s.",
            "Clinical variant: Pa markedly reduced, as might be seen over a hemisphere with a thalamocortical lesion (electrode effect: compare C3 and C4), or with deep sleep, sedation or anaesthesia. Interpret by comparison between hemispheres and ears, not absolute amplitude."]
    },
    caep: {
      xlim:[-100, 500], xlabel:"Time (ms)", ylabel:"Amplitude (µV)", win:"-100 to 500 ms",
      make(v){ return v ? {infant:true, f: t => G(t, 210, 50, 5) + G(t, 380, 60, -2.2)} : {f: t => G(t, 55, 12, 1.5) + G(t, 100, 18, -4.5) + G(t, 180, 30, 3.5)}; },
      labels(o){ return o.infant ? [{t:210, text:"P1 (infant)", dy:-8}, {t:380, text:"N2", dy:16}] : [{t:55, text:"P1", dy:-8}, {t:100, text:"N1", dy:16}, {t:180, text:"P2", dy:-8}]; },
      measure(o, f){ return o.infant ? "P1 latency about 210 ms" : "N1-P2 = " + (f(180) - f(100)).toFixed(1) + " µV; N1 100 ms"; },
      note:["CAEP (adult): P1 about 50 to 80 ms, N1 about 80 to 150 ms, P2 about 150 to 250 ms; generators in the supratemporal auditory cortex. Awake patient, stimuli about one per second, filter about 1 to 30 Hz. Used for aided cortical testing with speech tokens such as /m/, /g/, /t/.",
            "Clinical variant: infant-type response dominated by a large, late P1 (latency up to about 200 to 300 ms in early infancy, decreasing with age). P1 latency is used as a marker of cortical maturation, for example after cochlear implantation."]
    },
    p300: {
      xlim:[-100, 700], xlabel:"Time (ms)", ylabel:"Amplitude (µV) at Pz", win:"-100 to 700 ms",
      make(v){ const lat = v ? 420 : 320, a = v ? 5 : 10;
        const std = t => G(t, 55, 12, 1) + G(t, 100, 18, -4) + G(t, 180, 30, 3);
        return {lat, std, f: t => std(t) + G(t, 230, 25, -2) + G(t, lat, 60, a)}; },
      labels(o){ return [{t:100, text:"N1", dy:16}, {t:180, text:"P2", dy:-8}, {t:235, text:"N2", dy:16}, {t:o.lat, text:"P300 (target)", dy:-8}]; },
      extra(o){ return {fn:o.std, color:"--left", label:"standard"}; },
      measure(o, f){ return "P300 latency " + o.lat + " ms, amplitude " + f(o.lat).toFixed(1) + " µV"; },
      note:["P300 (P3b): active oddball task (count or press for rare targets, about 10 to 20 %). Large positive wave at about 250 to 400 ms, largest at Pz, from a distributed temporo-parietal and frontal network. Red: target average; blue: standard average (no P300).",
            "Clinical variant: delayed and smaller P300, as seen with ageing, cognitive decline or inattention to the task. Wide normal variability limits individual diagnosis."]
    },
    mmn: {
      xlim:[-100, 400], xlabel:"Time (ms)", ylabel:"Amplitude (µV) at Fz", win:"-100 to 400 ms",
      make(v){ const lat = v ? 210 : 170, a = v ? -1.2 : -2.5;
        const std = t => G(t, 50, 12, 1) + G(t, 100, 18, -3.5) + G(t, 180, 30, 2.5);
        const dev = t => std(t) + G(t, lat, 35, a);
        return {lat, std, dev, f: t => dev(t) - std(t)}; },
      labels(o){ return [{t:o.lat, text:"MMN (difference)", dy:16}]; },
      extra(o){ return [{fn:o.std, color:"--left", label:"standard"}, {fn:o.dev, color:"--right", label:"deviant"}]; },
      measure(o, f){ return "MMN peak " + f(o.lat).toFixed(1) + " µV at " + o.lat + " ms"; },
      note:["MMN: passive oddball (patient ignores the sounds). Blue: standard; red: deviant; teal (thick): difference wave, deviant minus standard, with the MMN peaking at about 100 to 250 ms, largest at Fz, inverting at the mastoids with a nose reference. Generators in auditory cortex and frontal regions.",
            "Clinical variant: a less discriminable contrast (or poorer discrimination) gives a smaller and later MMN. The MMN is small (about 0.5 to 5 µV), so individual results are often uncertain."]
    },
    cvemp: {
      xlim:[-10, 50], xlabel:"Time (ms)", ylabel:"Amplitude (µV)", win:"-10 to 50 ms",
      make(v){ const k = v ? 0.4 : 1; const r = rng(5), nz = []; for(let i = 0; i <= 600; i++) nz.push(gauss(r) * 3);
        return {k, f: t => { const i = Math.max(0, Math.min(600, Math.round((t + 10) * 10))); return G(t, 13, 1.6, 60 * k) + G(t, 23, 2.4, -70 * k) + nz[i]; }}; },
      labels(){ return [{t:13, text:"p13", dy:-8}, {t:23, text:"n23", dy:16}]; },
      measure(o, f){ return "p13-n23 = " + (130 * o.k).toFixed(0) + " µV (raw; normalise by EMG)"; },
      note:["cVEMP: recorded from the ipsilateral SCM during tonic contraction; p13 (about 11 to 15 ms) and n23 (about 20 to 26 ms) reflect a brief inhibition of muscle activity via the saccule, inferior vestibular nerve and vestibulospinal pathway. Stimulus typically a 500 Hz tone burst at high level, about 5/s.",
            "Clinical variant: reduced response on the affected side (for example after inferior vestibular nerve involvement). Before calling it abnormal, normalise by the pre-stimulus rectified EMG and compute the asymmetry ratio."]
    },
    ovemp: {
      xlim:[-10, 50], xlabel:"Time (ms)", ylabel:"Amplitude (µV)", win:"-10 to 50 ms",
      make(v){ const k = v ? 3 : 1; return {k, f: t => G(t, 10.5, 1.2, -4 * k) + G(t, 15.5, 1.6, 3.5 * k) + G(t, 21, 2, -0.8 * k)}; },
      labels(){ return [{t:10.5, text:"n10", dy:16}, {t:15.5, text:"p15", dy:-8}]; },
      measure(o, f){ return "n10-p15 = " + (f(15.5) - f(10.5)).toFixed(1) + " µV"; },
      note:["oVEMP: recorded beneath the eye opposite the stimulated ear during upward gaze; n10 (about 9 to 12 ms) is a crossed excitatory response of the inferior oblique, mainly via the utricle and superior vestibular nerve. Amplitude a few microvolts with air conduction, larger with bone conduction.",
            "Clinical variant: markedly enlarged oVEMP (often with a lowered threshold), the pattern associated with superior semicircular canal dehiscence."]
    }
  };

  AT.demo("u6-5-waves", {
    init(el){ el.querySelectorAll("select").forEach(i => i.addEventListener("change", () => this.draw(el))); },
    draw(el){
      const id = el.querySelector("#u6-5-waves-sel").value, v = +el.querySelector("#u6-5-waves-mod").value;
      const W = WAVES[id], o = W.make(v), f = o.f;
      const [t0, t1] = W.xlim, n = 700, dt = (t1 - t0) / n;
      const x = [], y = [];
      for(let i = 0; i <= n; i++){ const t = t0 + i * dt; x.push(t); y.push(f(t)); }
      const series = [];
      let all = y.slice();
      if(W.extra){
        let ex = W.extra(o); if(!Array.isArray(ex)) ex = [ex];
        ex.forEach(e => { const yy = x.map(e.fn); all = all.concat(yy); series.push({x, y:yy, color:e.color, width:1.4, dash:[5,3]}); });
      }
      series.push({x, y, color: W.extra ? (id === "mmn" ? "--accent" : "--right") : "--accent", width: id === "mmn" ? 2.8 : 2});
      series.push({x:[t0, t1], y:[0, 0], color:"--plot-axis", width:1, dash:[3,3]});
      series.push({x:[0, 0], y:[-1e6, 1e6], color:"--plot-axis", width:1});
      let lo = Math.min(...all), hi = Math.max(...all); const pad = 0.25 * (hi - lo || 1);
      lo -= pad; hi += pad;
      const labels = W.labels(o).map(L => ({text:L.text, x:L.t, y:f(L.t), dy:L.dy, align:"center", color:"--ink"}));
      if(id === "p300" || id === "mmn") labels.push({text:"standard (dashed blue)", x:t1, y:hi, dy:14, align:"right", color:"--left"});
      if(id === "mmn") labels.push({text:"deviant (dashed red)", x:t1, y:hi, dy:30, align:"right", color:"--right"});
      labels.push({text:"stimulus onset", x:0, y:lo, dy:-6, dx:4, align:"left", color:"--muted"});
      plot(el.querySelector("canvas"), {xlim:W.xlim, ylim:[lo, hi], xlabel:W.xlabel, ylabel:W.ylabel, series, labels});
      el.querySelector("#u6-5-waves-win").textContent = W.win;
      el.querySelector("#u6-5-waves-meas").textContent = W.measure(o, f);
      const note = el.querySelector("#u6-5-waves-note");
      note.innerHTML = '<span class="lbl">' + (v ? "Clinical link" : "Remember") + '</span>';
      note.appendChild(document.createTextNode(W.note[v]));
    }
  });
})();

(function(){
  const {plot} = window.AT;
  const bind = (el, self) => {
    el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => self.draw(el)));
    el.querySelectorAll("select").forEach(i => i.addEventListener("change", () => self.draw(el)));
  };
  const sig = (v, n) => { if(!isFinite(v)) return "-"; const a = Math.abs(v); if(a === 0) return "0"; const d = Math.max(0, (n || 3) - 1 - Math.floor(Math.log10(a))); return v.toFixed(Math.min(d, 6)); };
  const fmtV = v => { /* volts to readable */
    const a = Math.abs(v);
    if(a >= 1) return sig(v, 3) + " V";
    if(a >= 1e-3) return sig(v * 1e3, 3) + " mV";
    if(a >= 1e-6) return sig(v * 1e6, 3) + " µV";
    return sig(v * 1e9, 3) + " nV";
  };
  const fmtConc = mM => mM >= 1 ? sig(mM, 3) + " mM" : mM >= 1e-3 ? sig(mM * 1e3, 3) + " µM" : sig(mM * 1e6, 3) + " nM";
  const SI = e => { const p = ["p","n","µ","m",""], k = Math.floor((e + 12) / 3), m = Math.pow(10, (e + 12) - 3 * k); return (m >= 1 ? m : m) + (p[k] !== undefined ? p[k] : "") ; };
  const logTicks = (lo, hi, lab) => { const t = []; for(let k = Math.ceil(lo); k <= Math.floor(hi); k++) t.push([k, lab(Math.pow(10, k))]); return t; };

  /* ---------- 1. Nernst calculator ---------- */
  const ION = {
    K:  {z: 1,  ci: 140,    co: 5,   name: "K+"},
    Na: {z: 1,  ci: 12,     co: 145, name: "Na+"},
    Cl: {z: -1, ci: 7,      co: 110, name: "Cl-"},
    Ca: {z: 2,  ci: 0.0001, co: 2,   name: "Ca2+"}
  };
  AT.demo("u6-7-nernst", {
    init(el){
      bind(el, this);
      const sel = el.querySelector("#u6-7-nernst-ion");
      sel.addEventListener("change", () => {
        const d = ION[sel.value];
        el.querySelector("#u6-7-nernst-ci").value = Math.log10(d.ci);
        el.querySelector("#u6-7-nernst-co").value = Math.log10(d.co);
        this.draw(el);
      });
    },
    draw(el){
      const q = id => el.querySelector("#u6-7-nernst-" + id);
      const ion = ION[q("ion").value];
      const ci = Math.pow(10, +q("ci").value), co = Math.pow(10, +q("co").value), tc = +q("t").value;
      q("ci-o").textContent = fmtConc(ci);
      q("co-o").textContent = fmtConc(co);
      q("t-o").textContent = tc + " °C";
      const T = tc + 273.15, k = 8.314 * T / (ion.z * 96485); /* volts */
      const E = k * Math.log(co / ci) * 1000; /* mV */
      q("k").textContent = (k * 1000).toFixed(2) + " mV";
      q("r").textContent = sig(co / ci, 3);
      q("e").textContent = (E >= 0 ? "+" : "") + E.toFixed(1) + " mV";
      const xl = [-150, 200], Ec = Math.max(xl[0], Math.min(xl[1], E));
      plot(el.querySelector("canvas"), {
        xlim: xl, ylim: [0, 1], xlabel: "Membrane potential, inside relative to outside (mV)", yticks: [],
        series: [
          {x: [0, Ec], y: [0.5, 0.5], color: "--accent", width: 22},
          {x: [-70, -70], y: [0.05, 0.95], color: "--muted", width: 2, dash: [5, 4]},
          {x: [0, 0], y: [0, 1], color: "--plot-axis", width: 1}
        ],
        labels: [
          {text: ion.name + ": " + (E >= 0 ? "+" : "") + E.toFixed(1) + " mV", x: Ec, y: 0.5, dy: 4, dx: E >= 0 ? 8 : -8, align: E >= 0 ? "left" : "right", color: "--ink"},
          {text: "rest ≈ -70", x: -70, y: 0.12, dx: 4, color: "--muted"}
        ]
      });
      let m = "E = (RT/zF) ln(out/in) = " + (k * 1000).toFixed(2) + " mV × ln(" + sig(co / ci, 3) + ").";
      if(Math.abs(E) > 150) m += " The value is off the scale of the bar.";
      if(q("ion").value === "K") m += " Potassium is close to the resting potential because the resting membrane is most permeable to K+.";
      if(q("ion").value === "Na") m += " The action potential swings towards E_Na when sodium channels open.";
      if(q("ion").value === "Ca") m += " The tiny free intracellular calcium gives a large positive E_Ca; note z = 2 halves RT/zF.";
      if(q("ion").value === "Cl") m += " For a negative ion (z = -1) the sign of the logarithm is reversed.";
      q("msg").textContent = m;
    }
  });

  /* ---------- 2. Dipole amplitude against distance ---------- */
  const SIG = 0.33;
  const SITES = [[5, "transtympanic"], [15, "ear canal"], [35, "mastoid"], [80, "vertex"]];
  const vDip = (pnAm, rmm) => pnAm * 1e-9 / (4 * Math.PI * SIG * Math.pow(rmm / 1000, 2)); /* volts */
  AT.demo("u6-7-dipole", {
    init(el){ bind(el, this); },
    draw(el){
      const q = id => el.querySelector("#u6-7-dipole-" + id);
      const p = Math.pow(10, +q("p").value);
      q("p-o").textContent = sig(p, 3) + " nA·m";
      const ra = +q("a").value, rb = +q("b").value;
      const x = [], y = [];
      for(let i = 0; i <= 200; i++){ const r = 2 * Math.pow(100, i / 200); x.push(r); y.push(Math.log10(vDip(p, r) * 1e6)); }
      const sx = SITES.map(s => s[0]), sy = SITES.map(s => Math.log10(vDip(p, s[0]) * 1e6));
      const lab = v => SI(Math.round(Math.log10(v)) - 6) + "V";
      plot(el.querySelector("canvas"), {
        xlim: [2, 200], xlog: true, ylim: [-4, 4.2], xlabel: "Distance from dipole (mm)", ylabel: "Potential (log)",
        xticks: [[2, "2"], [5, "5"], [10, "10"], [20, "20"], [50, "50"], [100, "100"], [200, "200"]],
        yticks: logTicks(-4, 4, lab),
        series: [
          {x, y, color: "--accent", width: 2},
          {x: sx, y: sy, color: "--right", line: false, marker: "dot", msize: 5}
        ],
        labels: SITES.map((s, i) => ({text: s[1], x: s[0], y: sy[i], dx: 6, dy: -6, color: "--ink"}))
      });
      const va = vDip(p, ra), vb = vDip(p, rb);
      q("va").textContent = fmtV(va);
      q("vb").textContent = fmtV(vb);
      q("r").textContent = sig(va / vb, 3) + " : 1";
      const db = 20 * Math.log10(va / vb);
      q("db").textContent = (db >= 0 ? "+" : "") + db.toFixed(1) + " dB";
    }
  });

  /* ---------- 3. Front-end design calculator ---------- */
  const KB = 1.380649e-23, TB = 310;
  AT.demo("u6-7-frontend", {
    init(el){ bind(el, this); },
    draw(el){
      const q = id => el.querySelector("#u6-7-frontend-" + id);
      const off = +q("off").value * 1e-3;                 /* V */
      const G = Math.pow(10, +q("g").value);
      const rng = +q("rng").value, bits = +q("bits").value;
      const B = +q("bw").value, en = +q("en").value * 1e-9, R = +q("z").value * 1e3;
      q("off-o").textContent = (off * 1e3).toFixed(0) + " mV";
      q("g-o").textContent = G >= 100 ? Math.round(G).toLocaleString("en-GB") : sig(G, 3);
      q("bw-o").textContent = B + " Hz";
      q("en-o").textContent = (en * 1e9).toFixed(0) + " nV/√Hz";
      q("z-o").textContent = (R / 1e3).toFixed(0) + " kΩ";
      const oa = off * G, sat = oa >= rng;
      const lsb = 2 * rng / (Math.pow(2, bits) * G);       /* V, referred to input */
      const qn = lsb / Math.sqrt(12);
      const th = Math.sqrt(4 * KB * TB * R * B);
      const am = en * Math.sqrt(B);
      const tot = Math.sqrt(th * th + am * am + qn * qn);
      q("oa").textContent = sat ? fmtV(oa) + " (exceeds ±" + rng + " V)" : fmtV(oa);
      q("hr").textContent = sat ? "none: saturated" : fmtV(rng - oa) + " (" + (100 * (rng - oa) / rng).toFixed(1) + " % of range left)";
      q("ir").textContent = "±" + fmtV(rng / G);
      q("lsb").textContent = fmtV(lsb);
      q("q").textContent = fmtV(qn) + " RMS";
      q("th").textContent = fmtV(th) + " RMS";
      q("tot").textContent = fmtV(tot) + " RMS";
      const vals = [th, am, qn, tot, 5e-6].map(v => Math.log10(v * 1e6));
      const cols = ["--accent", "--accent", "--warn", "--left", "--muted"];
      const lo = -4.5;
      const series = vals.map((v, i) => ({x: [i + 1, i + 1], y: [lo, Math.max(lo, Math.min(3, v))], color: cols[i], width: 26}));
      const lab = v => SI(Math.round(Math.log10(v)) - 6) + "V";
      plot(el.querySelector("canvas"), {
        xlim: [0.4, 5.6], ylim: [lo, 2], ylabel: "RMS at input (log)",
        xticks: [[1, "thermal"], [2, "amplifier"], [3, "quantisation"], [4, "instrument"], [5, "EEG"]],
        yticks: logTicks(-4, 2, lab), series
      });
      const msg = [];
      if(sat) msg.push("Saturated: offset × gain = " + fmtV(oa) + " exceeds the ADC range. Reduce the gain below " + sig(rng / Math.max(off, 1e-6), 3) + " or remove the offset with a high-pass (AC coupling) before the gain.");
      else if(oa > 0.8 * rng) msg.push("Close to saturation: a small change in offset (movement, drift) will clip the signal.");
      if(lsb > 1e-6) msg.push("LSB above 1 µV: too coarse to resolve an ABR in one sweep; increase gain or bits.");
      if(qn > th && !sat) msg.push("Quantisation noise exceeds electrode thermal noise: the ADC is limiting the design.");
      if(!msg.length) msg.push("Workable design: no saturation, and quantisation noise below the electrode's thermal noise. Background EEG (5 µV) still dominates.");
      q("msg").textContent = msg.join(" ");
    }
  });

  /* ---------- 4. Interface impedance against frequency ---------- */
  const fmtR = kOhm => kOhm >= 1000 ? sig(kOhm / 1000, 3) + " MΩ" : kOhm >= 1 ? sig(kOhm, 3) + " kΩ" : sig(kOhm * 1000, 3) + " Ω";
  AT.demo("u6-7-interface", {
    init(el){ bind(el, this); },
    draw(el){
      const q = id => el.querySelector("#u6-7-interface-" + id);
      const Rs = Math.pow(10, +q("rs").value) * 1e3, C = Math.pow(10, +q("cd").value) * 1e-6, Rc = Math.pow(10, +q("rc").value) * 1e3;
      const ft = +q("ft").value;
      q("rs-o").textContent = fmtR(Rs / 1e3);
      q("cd-o").textContent = sig(C * 1e6, 3) + " µF";
      q("rc-o").textContent = fmtR(Rc / 1e3);
      const Z = f => { const w = 2 * Math.PI * f, a = w * Rc * C, d = 1 + a * a; const re = Rs + Rc / d, im = -Rc * a / d; return Math.hypot(re, im); };
      const x = [], y = [];
      for(let i = 0; i <= 250; i++){ const f = 0.1 * Math.pow(1e5, i / 250); x.push(f); y.push(Math.log10(Z(f) / 1e3)); }
      const lab = v => { const e = Math.round(Math.log10(v)) + 3; return e >= 6 ? Math.pow(10, e - 6) + "M" : e >= 3 ? Math.pow(10, e - 3) + "k" : String(Math.pow(10, e)); };
      plot(el.querySelector("canvas"), {
        xlim: [0.1, 10000], xlog: true, ylim: [-1.3, 3.3], xlabel: "Frequency (Hz)", ylabel: "|Z| in ohms (log)",
        xticks: [[0.1, "0.1"], [1, "1"], [10, "10"], [100, "100"], [1000, "1k"], [10000, "10k"]],
        yticks: logTicks(-1, 3, lab),
        series: [
          {x: [100, 100], y: [-1.3, 3.3], color: "--left", width: 1, dash: [5, 4]},
          {x: [3000, 3000], y: [-1.3, 3.3], color: "--left", width: 1, dash: [5, 4]},
          {x: [ft, ft], y: [-1.3, 3.3], color: "--right", width: 1.5},
          {x, y, color: "--accent", width: 2.2}
        ],
        labels: [{text: "ABR band", x: 550, y: 3.0, align: "center", color: "--left"}]
      });
      q("zt").textContent = fmtR(Z(ft) / 1e3);
      q("z100").textContent = fmtR(Z(100) / 1e3);
      q("z1k").textContent = fmtR(Z(1000) / 1e3);
      const fc = 1 / (2 * Math.PI * Rc * C);
      q("fc").textContent = fc >= 1000 ? sig(fc / 1000, 3) + " kHz" : sig(fc, 3) + " Hz";
    }
  });
})();
