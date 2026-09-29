(function(){
  const {plot, css, TAU} = window.AT;

  /* ---------- 2.1 animated longitudinal wave ---------- */
  AT.demo("b2-1-wave", {
    init(el){
      const st = el._st = {t: 0, run: true, last: null, visible: true, raf: 0};
      el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el)));
      const btn = el.querySelector("#b2-1-wave-p");
      btn.addEventListener("click", () => {
        st.run = !st.run; btn.textContent = st.run ? "Pause" : "Play"; st.last = null;
        if(st.run) loop();
      });
      const self = this;
      function loop(){
        cancelAnimationFrame(st.raf);
        st.raf = requestAnimationFrame(ts => {
          if(!st.run || !st.visible) return;
          if(st.last !== null) st.t += Math.min(0.05, (ts - st.last) / 1000) * (+el.querySelector("#b2-1-wave-f").value);
          st.last = ts; self.draw(el); loop();
        });
      }
      st.loop = loop;
      if("IntersectionObserver" in window){
        new IntersectionObserver(es => { es.forEach(e => { st.visible = e.isIntersecting; st.last = null; if(st.visible && st.run) loop(); }); }).observe(el);
      }
      loop();
    },
    draw(el){
      const st = el._st || {t: 0};
      const A = +el.querySelector("#b2-1-wave-a").value;
      const sp = +el.querySelector("#b2-1-wave-f").value;
      const lam = +el.querySelector("#b2-1-wave-l").value;
      el.querySelector("#b2-1-wave-a-o").textContent = A + " px";
      el.querySelector("#b2-1-wave-f-o").textContent = sp.toFixed(1) + " cycles/s";
      el.querySelector("#b2-1-wave-l-o").textContent = lam + " px";
      const cv = el.querySelector("canvas"); const w = cv.clientWidth; if(!w) return;
      const h = +(cv.dataset.h || 270), dpr = window.devicePixelRatio || 1;
      cv.style.height = h + "px";
      if(cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
      const ctx = cv.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
      const acc = css("--accent"), red = css("--right"), blue = css("--left"), axis = css("--plot-axis"), muted = css("--muted");
      const k = TAU / lam, ph = TAU * st.t;              // phase advances with time, wave moves to +x
      const spacing = 12, rows = 7, top = 22, rowGap = 16;
      const x0 = 14, x1 = w - 14;
      // particles
      for(let r = 0; r < rows; r++){
        const y = top + r*rowGap;
        for(let xr = x0 + (r % 2) * spacing/2; xr <= x1; xr += spacing){
          const x = xr + A * Math.sin(k*xr - ph);
          ctx.beginPath(); ctx.fillStyle = acc; ctx.arc(x, y, 2.6, 0, TAU); ctx.fill();
        }
      }
      // tracked particle
      const xt = x0 + spacing/2 + spacing * Math.round((w/2 - x0) / spacing);
      const yt = top + 3*rowGap;
      ctx.strokeStyle = red; ctx.setLineDash([3,3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xt, top - 10); ctx.lineTo(xt, top + (rows-1)*rowGap + 10); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.fillStyle = red; ctx.arc(xt + A*Math.sin(k*xt - ph), yt, 5, 0, TAU); ctx.fill();
      // pressure curve: p proportional to -d(xi)/dx = -A k cos(kx - wt)
      const yc = top + rows*rowGap + 58, amp = 40 * (A / 20);
      ctx.strokeStyle = axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, yc); ctx.lineTo(x1, yc); ctx.stroke();
      ctx.strokeStyle = blue; ctx.lineWidth = 2; ctx.beginPath();
      for(let x = x0; x <= x1; x += 2){ const y = yc - amp * (-Math.cos(k*x - ph)); x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.font = "600 12px 'Schibsted Grotesk', Arial, sans-serif"; ctx.fillStyle = muted; ctx.textAlign = "left";
      ctx.fillText("sound pressure (above zero line: compression)", x0, h - 8);
      // label the first compression peak fully in view
      let xc = ((ph + Math.PI) / k) % lam; if(xc < 0) xc += lam; xc += x0 - (x0 % lam);
      while(xc < x0 + 40) xc += lam;
      if(xc < x1 - 60 && amp > 4){ ctx.textAlign = "center"; ctx.fillText("C", xc, yc - amp - 6); if(xc + lam/2 < x1 - 20) ctx.fillText("R", xc + lam/2, yc + amp + 16); }
    }
  });

  /* ---------- 2.2 sine wave ---------- */
  AT.demo("b2-2-sine", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const FR = [100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000];
      const f = FR[+el.querySelector("#b2-2-sine-f").value];
      const A = +el.querySelector("#b2-2-sine-a").value;
      const phd = +el.querySelector("#b2-2-sine-p").value;
      const c = +el.querySelector("#b2-2-sine-m").value;
      el.querySelector("#b2-2-sine-f-o").textContent = f + " Hz";
      el.querySelector("#b2-2-sine-a-o").textContent = A.toFixed(2) + " Pa";
      el.querySelector("#b2-2-sine-p-o").textContent = phd + "°";
      const tmax = 10, n = 800, x = [], y = [], yr = [];
      const ph = phd * Math.PI / 180;
      for(let i = 0; i <= n; i++){ const t = tmax * i / n; x.push(t); y.push(A * Math.sin(TAU * f * t / 1000 + ph)); yr.push(A * Math.sin(TAU * f * t / 1000)); }
      const T = 1000 / f, lam = c / f, rms = A / Math.SQRT2, L = 20 * Math.log10(rms / 2e-5);
      plot(el.querySelector("canvas"), {
        xlim: [0, tmax], ylim: [-2.2, 2.2], xlabel: "Time (ms)", ylabel: "Pressure (Pa)",
        series: [
          {x, y: yr, color: "--plot-axis", width: 1, dash: [4,4]},
          {x: [0, tmax], y: [rms, rms], color: "--muted", width: 1, dash: [2,3]},
          {x, y, color: "--accent", width: 2}
        ],
        labels: [{text: "RMS", x: 0, y: rms, dx: 4, dy: -5, color: "--muted"}]
      });
      el.querySelector("#b2-2-sine-T").textContent = (T >= 1 ? T.toFixed(2) : T.toFixed(3)) + " ms";
      el.querySelector("#b2-2-sine-L").textContent = lam >= 1 ? lam.toFixed(2) + " m" : (lam * 100).toFixed(1) + " cm";
      el.querySelector("#b2-2-sine-R").textContent = rms.toFixed(3) + " Pa";
      el.querySelector("#b2-2-sine-D").textContent = L.toFixed(1) + " dB SPL";
    }
  });

  /* ---------- 2.3 pressure to SPL ---------- */
  const LAND = [[2e-5, "threshold"], [6.3e-4, "whisper"], [0.02, "speech 1 m"], [0.36, "85 dB"], [6.3, "concert"], [63, "pain"]];
  function fmtP(p){
    if(p < 1e-3) return (p * 1e6).toPrecision(3) + " µPa";
    if(p < 1) return (p * 1e3).toPrecision(3) + " mPa";
    return p.toPrecision(3) + " Pa";
  }
  function typical(L){
    if(L < 10) return "near threshold";
    if(L < 35) return "whisper, quiet room";
    if(L < 50) return "quiet office";
    if(L < 70) return "conversation";
    if(L < 85) return "busy street";
    if(L < 100) return "risk with long exposure";
    if(L < 120) return "concert, very loud";
    return "discomfort or pain";
  }
  AT.demo("b2-3-spl", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const e = +el.querySelector("#b2-3-spl-p").value, p = Math.pow(10, e);
      const L = 20 * Math.log10(p / 2e-5), I = p * p / 413;
      el.querySelector("#b2-3-spl-p-o").textContent = fmtP(p);
      const x = [], y = [];
      for(let v = -5; v <= 3.001; v += 0.05){ const pp = Math.pow(10, v); x.push(pp); y.push(20 * Math.log10(pp / 2e-5)); }
      const lx = LAND.map(d => d[0]), ly = LAND.map(d => 20 * Math.log10(d[0] / 2e-5));
      const cvs = el.querySelector("canvas"), narrow = cvs.clientWidth < 520;
      const xt = narrow ? [[1e-5,"10µ"],[1e-3,"1m"],[1e-1,"0.1"],[10,"10"],[1000,"1000"]] : [[1e-5,"10µ"],[1e-4,"100µ"],[1e-3,"1m"],[1e-2,"10m"],[1e-1,"0.1"],[1,"1"],[10,"10"],[100,"100"],[1000,"1000"]];
      plot(cvs, {
        xlim: [1e-5, 1e3], ylim: [-10, 160], xlog: true,
        xticks: xt,
        yticks: [[0,"0"],[20,"20"],[40,"40"],[60,"60"],[80,"80"],[100,"100"],[120,"120"],[140,"140"]],
        xlabel: "RMS sound pressure (Pa, log scale)", ylabel: "Level (dB SPL)",
        series: [
          {x, y, color: "--accent", width: 2},
          {x: lx, y: ly, color: "--muted", line: false, marker: "dot", msize: 3},
          {x: [p, p], y: [-10, L], color: "--right", width: 1, dash: [3,3]},
          {x: [p], y: [L], color: "--right", line: false, marker: "o", msize: 6}
        ],
        labels: LAND.map((d, i) => ({text: d[1], x: d[0], y: ly[i], dx: 6, dy: 14, color: "--muted"}))
      });
      el.querySelector("#b2-3-spl-L").textContent = L.toFixed(1) + " dB SPL";
      const r = p / 2e-5;
      el.querySelector("#b2-3-spl-r").textContent = r < 10 ? r.toPrecision(3) : r < 99999.5 ? String(Math.round(r)) : r.toExponential(2).replace("e+", " × 10^");
      el.querySelector("#b2-3-spl-i").textContent = I.toExponential(2).replace("e", " × 10^") + " W/m²";
      el.querySelector("#b2-3-spl-t").textContent = typical(L);
    }
  });

  /* ---------- 2.3 adding two sources ---------- */
  AT.demo("b2-3-add", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const a = +el.querySelector("#b2-3-add-a").value, b = +el.querySelector("#b2-3-add-b").value;
      el.querySelector("#b2-3-add-a-o").textContent = a + " dB";
      el.querySelector("#b2-3-add-b-o").textContent = b + " dB";
      const tot = 10 * Math.log10(Math.pow(10, a/10) + Math.pow(10, b/10));
      const d = Math.abs(a - b), inc = tot - Math.max(a, b);
      const x = [], y = [];
      for(let v = 0; v <= 20.001; v += 0.25){ x.push(v); y.push(10 * Math.log10(1 + Math.pow(10, -v/10))); }
      const dd = Math.min(d, 20);
      plot(el.querySelector("canvas"), {
        xlim: [-0.4, 20], ylim: [0, 3.5], xlabel: "Difference between the two levels (dB)", ylabel: "Added to louder (dB)",
        series: [
          {x, y, color: "--accent", width: 2},
          {x: [dd], y: [10 * Math.log10(1 + Math.pow(10, -dd/10))], color: "--right", line: false, marker: "o", msize: 6}
        ],
        labels: d > 20 ? [{text: "difference > 20 dB: increase < 0.05 dB", x: 19.5, y: 3.1, align: "right", color: "--muted"}] : []
      });
      el.querySelector("#b2-3-add-t").textContent = tot.toFixed(1) + " dB";
      el.querySelector("#b2-3-add-i").textContent = "+" + inc.toFixed(2) + " dB";
      el.querySelector("#b2-3-add-w").textContent = (a + b) + " dB (incorrect)";
    }
  });

  /* ---------- 2.4 ISO 226:2003 equal loudness contours ---------- */
  const F = [20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500];
  const AF = [0.532,0.506,0.480,0.455,0.432,0.409,0.387,0.367,0.349,0.330,0.315,0.301,0.288,0.276,0.267,0.259,0.253,0.250,0.246,0.244,0.243,0.243,0.243,0.242,0.242,0.245,0.254,0.271,0.301];
  const LU = [-31.6,-27.2,-23.0,-19.1,-15.9,-13.0,-10.3,-8.1,-6.2,-4.5,-3.1,-2.0,-1.1,-0.4,0.0,0.3,0.5,0.0,-2.7,-4.1,-1.0,1.7,2.5,1.2,-2.1,-7.1,-11.2,-10.7,-3.1];
  const TF = [78.5,68.7,59.5,51.1,44.0,37.5,31.5,26.5,22.1,17.9,14.4,11.4,8.6,6.2,4.4,3.0,2.2,2.4,3.5,1.7,-1.3,-4.2,-6.0,-5.4,-1.5,6.0,12.6,13.9,12.3];
  function contour(Ln){
    const ys = [], xs = [];
    for(let i = 0; i < F.length; i++){
      if(Ln >= 90 && F[i] > 4000) break;
      const Af = 4.47e-3 * (Math.pow(10, 0.025 * Ln) - 1.15) + Math.pow(0.4 * Math.pow(10, (TF[i] + LU[i]) / 10 - 9), AF[i]);
      xs.push(F[i]); ys.push(10 / AF[i] * Math.log10(Af) - LU[i] + 94);
    }
    return {x: xs, y: ys};
  }
  function aWeight(f){
    const f2 = f * f;
    const ra = 12194*12194 * f2*f2 / ((f2 + 20.6*20.6) * Math.sqrt((f2 + 107.7*107.7) * (f2 + 737.9*737.9)) * (f2 + 12194*12194));
    return 20 * Math.log10(ra) + 2.0;
  }
  AT.demo("b2-4-elc", {
    init(el){
      const sel = el.querySelector("#b2-4-elc-f");
      sel.innerHTML = F.map(f => `<option value="${f}"${f === 100 ? " selected" : ""}>${f >= 1000 ? (f/1000) + " kHz" : f + " Hz"}</option>`).join("");
      el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el)));
      el.querySelectorAll("input,select").forEach(i => i.addEventListener("change", () => this.draw(el)));
    },
    draw(el){
      const P = +el.querySelector("#b2-4-elc-p").value;
      const fsel = +el.querySelector("#b2-4-elc-f").value;
      const showA = el.querySelector("#b2-4-elc-a").checked, all = el.querySelector("#b2-4-elc-all").checked;
      const series = [], labels = [];
      if(all){
        for(let L = 20; L <= 90; L += 10){ if(L === P) continue; const c = contour(L); series.push({x: c.x, y: c.y, color: "--plot-axis", width: 1}); }
      }
      for(let L = 20; L <= 90; L += 10){ if(all || L === P) labels.push({text: L + " phon", x: 1000, y: L, dx: 4, dy: -4, color: L === P ? "--accent" : "--muted"}); }
      const thr = {x: F.slice(), y: TF.slice()};
      series.push({x: thr.x, y: thr.y, color: "--left", width: P === -1 ? 2.5 : 1.5, dash: P === -1 ? [] : [5,3]});
      labels.push({text: "threshold", x: 25, y: 70, color: "--left"});
      let cur = P === -1 ? thr : contour(P);
      if(P !== -1) series.push({x: cur.x, y: cur.y, color: "--accent", width: 2.5});
      if(showA){
        const ax = [], ay = [];
        for(let lf = Math.log10(20); lf <= Math.log10(12500) + 1e-9; lf += 0.02){ const f = Math.pow(10, lf); ax.push(f); ay.push(40 - aWeight(f)); }
        series.push({x: ax, y: ay, color: "--right", width: 1.8, dash: [6,3]});
      }
      const idx = cur.x.indexOf(fsel);
      if(idx >= 0) series.push({x: [fsel], y: [cur.y[idx]], color: "--accent", line: false, marker: "o", msize: 6});
      plot(el.querySelector("canvas"), {
        xlim: [20, 12500], ylim: [-10, 130], xlog: true,
        xticks: [[20,"20"],[50,"50"],[100,"100"],[200,"200"],[500,"500"],[1000,"1k"],[2000,"2k"],[5000,"5k"],[10000,"10k"]],
        yticks: [[0,"0"],[20,"20"],[40,"40"],[60,"60"],[80,"80"],[100,"100"],[120,"120"]],
        xlabel: "Frequency (Hz)", ylabel: "Sound pressure level (dB SPL)",
        series, labels
      });
      const v = el.querySelector("#b2-4-elc-v"), d = el.querySelector("#b2-4-elc-d"), s = el.querySelector("#b2-4-elc-s");
      if(idx >= 0){
        const val = cur.y[idx], ref = P === -1 ? TF[F.indexOf(1000)] : P;
        v.textContent = val.toFixed(1) + " dB SPL";
        const df = val - ref; d.textContent = (df >= 0 ? "+" : "") + df.toFixed(1) + " dB";
      } else { v.textContent = "outside standard range"; d.textContent = "not defined"; }
      if(P === -1) s.textContent = "just audible";
      else if(P >= 40) s.textContent = Math.pow(2, (P - 40) / 10).toFixed(P >= 40 ? 0 : 2) + " sone" + (P === 40 ? "" : "s");
      else s.textContent = "below 1 sone (doubling rule not valid)";
    }
  });
})();

(function(){
  const {plot, $} = window.AT;
  const BANDS = [125, 250, 500, 1000, 2000, 4000];
  const BLAB = ["125", "250", "500", "1k", "2k", "4k"];
  // Typical absorption coefficients (same values as the table in topic 2.5)
  const MAT = {
    plaster: [0.01, 0.02, 0.02, 0.03, 0.04, 0.05],
    brick:   [0.03, 0.03, 0.03, 0.04, 0.05, 0.07],
    vinyl:   [0.02, 0.03, 0.03, 0.03, 0.03, 0.02],
    wood:    [0.15, 0.11, 0.10, 0.07, 0.06, 0.07],
    glass:   [0.35, 0.25, 0.18, 0.12, 0.07, 0.04],
    ply:     [0.28, 0.22, 0.17, 0.09, 0.10, 0.11],
    carpet:  [0.02, 0.06, 0.14, 0.37, 0.60, 0.65],
    curtain: [0.14, 0.35, 0.55, 0.72, 0.70, 0.65],
    tile:    [0.50, 0.60, 0.65, 0.75, 0.80, 0.75],
    wool:    [0.25, 0.65, 0.90, 0.95, 0.95, 0.90]
  };
  const PERSON = [0.25, 0.35, 0.42, 0.46, 0.50, 0.50];
  const lg = v => Math.log10(v);
  const bind = (el, self) => el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => self.draw(el)));
  const fmtHz = f => f >= 1000 ? (f / 1000) + " kHz" : f + " Hz";

  /* ---------- 2.5 energy split ---------- */
  AT.demo("b2-5-split", {
    init(el){ bind(el, this); },
    draw(el){
      const mat = $("#b2-5-split-mat", el).value, bi = +$("#b2-5-split-f", el).value, m = +$("#b2-5-split-m", el).value;
      $("#b2-5-split-m-o", el).textContent = m + " kg/m²";
      const f = BANDS[bi], a = MAT[mat][bi];
      const TLf = ff => Math.max(0, 20 * lg(m * ff) - 47);
      const TL = TLf(f), tau = Math.pow(10, -TL / 10);
      const R = (1 - tau) * (1 - a), Aab = (1 - tau) * a, T = tau;
      $("#b2-5-split-a", el).textContent = a.toFixed(2);
      $("#b2-5-split-r", el).textContent = (100 * R).toFixed(1) + " %";
      $("#b2-5-split-rd", el).textContent = (10 * lg(R)).toFixed(1) + " dB";
      $("#b2-5-split-tl", el).textContent = TL.toFixed(1) + " dB";
      $("#b2-5-split-t", el).textContent = T < 0.001 ? (100 * T).toExponential(1) + " %" : (100 * T).toFixed(2) + " %";
      const cv = el.querySelectorAll("canvas");
      const r = 100 * R, ab = 100 * Aab, tt = 100 * T;
      const series = [
        {x:[0, r], y:[0.5, 0.5], color:"--left", width:34},
        {x:[r, r + ab], y:[0.5, 0.5], color:"--warn", width:34}
      ];
      if(tt > 0.05) series.push({x:[r + ab, 100], y:[0.5, 0.5], color:"--right", width:34});
      const labels = [];
      if(r > 14) labels.push({text:"reflected " + r.toFixed(0) + "%", x:r / 2, y:0.5, dy:4, align:"center", color:"--ink"});
      if(ab > 14) labels.push({text:"absorbed " + ab.toFixed(0) + "%", x:r + ab / 2, y:0.5, dy:4, align:"center", color:"--ink"});
      plot(cv[0], {xlim:[0, 100], ylim:[0, 1], yticks:[], xticks:[[0,"0"],[25,"25"],[50,"50"],[75,"75"],[100,"100"]], xlabel:"Share of incident energy (%)", series, labels});
      const fx = [], fy = [];
      for(let i = 0; i <= 80; i++){ const ff = 63 * Math.pow(8000 / 63, i / 80); fx.push(ff); fy.push(TLf(ff)); }
      plot(cv[1], {xlim:[63, 8000], ylim:[0, 90], xlog:true,
        xticks:[[63,"63"],[125,"125"],[250,"250"],[500,"500"],[1000,"1k"],[2000,"2k"],[4000,"4k"],[8000,"8k"]],
        xlabel:"Frequency (Hz)", ylabel:"Transmission loss (dB)",
        series:[{x:fx, y:fy, color:"--accent", width:2}, {x:[f], y:[TL], color:"--right", line:false, marker:"o", msize:6}],
        labels:[{text:"m = " + m + " kg/m²", x:70, y:82, color:"--muted"}]});
    }
  });

  /* ---------- 2.6 Sabine calculator ---------- */
  AT.demo("b2-6-sabine", {
    init(el){ bind(el, this); },
    draw(el){
      const g = id => $("#b2-6-sabine-" + id, el);
      const L = +g("l").value, W = +g("w").value, H = +g("h").value, P = +g("p").value;
      g("l-o").textContent = L.toFixed(1) + " m"; g("w-o").textContent = W.toFixed(1) + " m";
      g("h-o").textContent = H.toFixed(1) + " m"; g("p-o").textContent = P;
      const fl = MAT[g("fl").value], ce = MAT[g("ce").value], wa = MAT[g("wa").value], bi = +g("b").value;
      const V = L * W * H, Sf = L * W, Sw = 2 * (L + W) * H, S = 2 * Sf + Sw;
      const Ts = [], Te = [], As = [];
      for(let i = 0; i < 6; i++){
        const A = Sf * fl[i] + Sf * ce[i] + Sw * wa[i] + P * PERSON[i];
        const ab = Math.min(A / S, 0.99);
        As.push(A); Ts.push(0.161 * V / A); Te.push(0.161 * V / (-S * Math.log(1 - ab)));
      }
      g("v").textContent = V.toFixed(0) + " m³";
      g("s").textContent = S.toFixed(0) + " m²";
      g("a").textContent = As[bi].toFixed(1) + " m²";
      g("ab").textContent = (As[bi] / S).toFixed(3);
      g("ts").textContent = Ts[bi].toFixed(2) + " s";
      g("te").textContent = Te[bi].toFixed(2) + " s";
      const cv = el.querySelectorAll("canvas");
      const ymax = Math.max(1, Math.ceil(Math.max(...Ts) * 1.15 * 2) / 2);
      plot(cv[0], {xlim:[100, 5000], ylim:[0, ymax], xlog:true,
        xticks:BANDS.map((b, i) => [b, BLAB[i]]), xlabel:"Octave band (Hz)", ylabel:"Reverberation time (s)",
        series:[
          {x:[100, 5000], y:[0.6, 0.6], color:"--warn", width:1.4, dash:[5, 4]},
          {x:BANDS, y:Ts, color:"--accent", width:2, marker:"o"},
          {x:BANDS, y:Te, color:"--left", width:1.6, dash:[4, 3], marker:"dot", msize:3}
        ]});
      const T = Ts[bi], tmax = Math.max(0.4, T * 1.3);
      // pseudo-measured decay: seeded fluctuation around the ideal line, limited by a noise floor at -55 dB
      let seed = 12345; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
      const tx = [], ty = [], ix = [], iy = [];
      const t0 = 0.08 * tmax;
      let sm = 0;
      for(let k = 0; k <= 300; k++){
        const t = k / 300 * tmax; sm = 0.7 * sm + 0.3 * rnd() * 6;
        const ideal = t < t0 ? 0 : -60 * (t - t0) / T;
        const lvl = 10 * lg(Math.pow(10, ideal / 10) + Math.pow(10, -55 / 10));
        tx.push(t); ty.push(lvl + sm);
      }
      ix.push(t0, t0 + T); iy.push(0, -60);
      plot(cv[1], {xlim:[0, tmax], ylim:[-70, 6], xlabel:"Time after source stops (s)", ylabel:"Level (dB)",
        series:[
          {x:tx, y:ty, color:"--accent", width:1.4},
          {x:ix, y:iy, color:"--right", width:1.6, dash:[5, 4]},
          {x:[0, tmax], y:[-60, -60], color:"--plot-axis", width:1, dash:[2, 3]}
        ],
        labels:[{text:"T = " + T.toFixed(2) + " s at " + fmtHz(BANDS[bi]), x:tmax * 0.98, y:-6, align:"right", color:"--ink"},
                {text:"-60 dB", x:tmax * 0.02, y:-57, color:"--muted"}]});
    }
  });

  /* ---------- 2.7 SNR against distance ---------- */
  AT.demo("b2-7-snr", {
    init(el){ bind(el, this); },
    draw(el){
      const g = id => $("#b2-7-snr-" + id, el);
      const L1 = +g("l1").value, N = +g("n").value, T = +g("t").value, r0 = +g("r").value;
      g("l1-o").textContent = L1 + " dBA"; g("n-o").textContent = N + " dBA";
      g("t-o").textContent = T.toFixed(1) + " s"; g("r-o").textContent = r0.toFixed(1) + " m";
      const V = 189, Q = 2, A = 0.161 * V / T;
      const Lw = L1 + 10 * lg(4 * Math.PI / Q), Lr = Lw + 10 * lg(4 / A);
      const rc = Math.sqrt(Q * A / (16 * Math.PI));
      const Ld = r => L1 - 20 * lg(r);
      const add = (...ls) => 10 * lg(ls.reduce((s, l) => s + Math.pow(10, l / 10), 0));
      const xs = [], yd = [], yt = [];
      for(let i = 0; i <= 120; i++){ const r = 0.5 * Math.pow(20, i / 120); xs.push(r); yd.push(Ld(r)); yt.push(add(Ld(r), Lr)); }
      const Ls = add(Ld(r0), Lr), snr = Ls - N, dr = Ld(r0) - add(Lr, N);
      g("ls").textContent = Ls.toFixed(1) + " dBA";
      g("snr").textContent = (snr >= 0 ? "+" : "") + snr.toFixed(1) + " dB";
      g("dr").textContent = (dr >= 0 ? "+" : "") + dr.toFixed(1) + " dB";
      g("rc").textContent = rc.toFixed(2) + " m";
      g("ok").textContent = snr >= 15 ? "met" : "not met (" + (15 - snr).toFixed(1) + " dB short)";
      const cv = el.querySelector("canvas");
      plot(cv, {xlim:[0.5, 10], ylim:[20, 90], xlog:true,
        xticks:[[0.5,"0.5"],[1,"1"],[2,"2"],[4,"4"],[8,"8"],[10,"10"]],
        xlabel:"Distance from talker (m)", ylabel:"Level (dBA)",
        series:[
          {x:[rc, rc], y:[20, 90], color:"--plot-axis", width:1, dash:[2, 3]},
          {x:xs, y:yd, color:"--left", width:1.4, dash:[5, 4]},
          {x:[0.5, 10], y:[Lr, Lr], color:"--muted", width:1.4, dash:[3, 3]},
          {x:[0.5, 10], y:[N, N], color:"--right", width:2},
          {x:xs, y:yt, color:"--accent", width:2.2},
          {x:[r0], y:[Ls], color:"--accent", line:false, marker:"o", msize:6}
        ],
        labels:[{text:"rc", x:rc, y:86, dx:4, color:"--muted"},
                {text:"SNR " + (snr >= 0 ? "+" : "") + snr.toFixed(1) + " dB", x:r0, y:Ls, dy:-12, align:"center", color:"--ink"}]});
    }
  });

  /* ---------- 2.8 MPANL checker ---------- */
  const OB = [125, 250, 500, 1000, 2000, 4000, 8000];
  const OBL = ["125", "250", "500", "1k", "2k", "4k", "8k"];
  const MPANL = {sa:[39, 25, 21, 26, 34, 37, 37], ins:[67, 53, 50, 47, 49, 50, 56], enc:[29, 21, 16, 13, 14, 11, 14]};
  const OFFICE = [13, 8, 3, 0, -4, -9, -14];  // office spectrum relative to the 1 kHz band
  const BOOTH = {none:[0, 0, 0, 0, 0, 0, 0], single:[25, 35, 44, 50, 55, 58, 58], double:[38, 52, 65, 73, 78, 80, 80]};
  AT.demo("b2-8-mpanl", {
    init(el){ bind(el, this); },
    draw(el){
      const g = id => $("#b2-8-mpanl-" + id, el);
      const amb = +g("amb").value; g("amb-o").textContent = amb + " dB SPL";
      const nr = BOOTH[g("booth").value], lim = MPANL[g("tr").value];
      const out = OFFICE.map(o => amb + o), inside = out.map((v, i) => v - nr[i]);
      let wi = 0, wm = -1e9;
      inside.forEach((v, i) => { if(v - lim[i] > wm){ wm = v - lim[i]; wi = i; } });
      g("res").textContent = wm <= 0 ? "passes in all bands" : "fails in " + inside.filter((v, i) => v > lim[i]).length + " band(s)";
      g("wb").textContent = OBL[wi] + " Hz";
      g("mg").textContent = wm <= 0 ? (-wm).toFixed(0) + " dB below limit" : wm.toFixed(0) + " dB above limit";
      const lo = Math.min(-10, Math.floor((Math.min(...inside) - 5) / 10) * 10), hi = Math.max(80, Math.ceil(Math.max(...out) / 10) * 10);
      plot(el.querySelector("canvas"), {xlim:[90, 11000], ylim:[lo, hi], xlog:true,
        xticks:OB.map((b, i) => [b, OBL[i]]), xlabel:"Octave band (Hz)", ylabel:"Band level (dB SPL)",
        series:[
          {x:OB, y:out, color:"--muted", width:1.4, dash:[4, 3], marker:"dot", msize:3},
          {x:OB, y:lim, color:"--right", width:2, marker:"x", msize:5},
          {x:OB, y:inside, color:"--accent", width:2, marker:"o"}
        ]});
    }
  });
})();

(function(){
  const {plot, css, TAU} = window.AT;

  function fmtDb(v){
    if(!isFinite(v) || v < -60) return "null";
    return (v >= 0 ? "" : "−") + Math.abs(v).toFixed(1) + " dB";
  }
  function fmtHz(f){ return f >= 1000 ? (f / 1000).toFixed(2).replace(/\.?0+$/, "") + " kHz" : Math.round(f) + " Hz"; }
  function sizeCanvas(cv){
    const w = cv.clientWidth; if(!w) return null;
    const h = +(cv.dataset.h || 300), dpr = window.devicePixelRatio || 1;
    cv.style.height = h + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return {ctx, w, h};
  }

  /* ---------- b2-9-polar: polar pattern explorer ---------- */
  AT.demo("b2-9-polar", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const q = s => el.querySelector(s);
      const mode = q("#b2-9-polar-sel").value;
      const ang = +q("#b2-9-polar-ang").value;
      const T = +q("#b2-9-polar-t").value * 1e-6;
      const d = +q("#b2-9-polar-d").value * 1e-3;
      const f = 125 * Math.pow(64, +q("#b2-9-polar-f").value / 100);
      const tau = d / 343;
      q("#b2-9-polar-ang-o").textContent = ang + "°";
      q("#b2-9-polar-t-o").textContent = Math.round(T * 1e6) + " µs";
      q("#b2-9-polar-d-o").textContent = Math.round(d * 1e3) + " mm (d/c = " + Math.round(tau * 1e6) + " µs)";
      q("#b2-9-polar-f-o").textContent = fmtHz(f);
      const ha = mode === "ha";
      ["#b2-9-polar-t", "#b2-9-polar-d", "#b2-9-polar-f"].forEach(s => { q(s).disabled = !ha; });

      let mag; // magnitude, normalised to front = 1 (sign kept for first-order)
      let frontRe = 1;
      if(ha){
        const w = TAU * f;
        const H = th => 2 * Math.abs(Math.sin(w * (T + tau * Math.cos(th)) / 2));
        const h0 = H(0);
        frontRe = h0 / 1; // relative to one omni (|H| of a single mic = 1)
        mag = th => h0 > 1e-12 ? H(th) / h0 : 0;
      } else {
        const a = +mode;
        mag = th => a + (1 - a) * Math.cos(th);
      }
      const lvl = v => Math.abs(v) < 1e-9 ? -Infinity : 20 * Math.log10(Math.abs(v));

      // directivity index, numerical integration over the sphere
      let s = 0; const N = 720;
      for(let i = 0; i < N; i++){ const th = (i + 0.5) * Math.PI / N; const m = mag(th); s += m * m * Math.sin(th) * Math.PI / N; }
      const di = 10 * Math.log10(1 / (0.5 * s));

      // null angle(s)
      let nulls = [];
      if(ha){
        if(tau > 0 && T <= tau * 1.02){ nulls.push(Math.acos(Math.max(-1, -T / tau)) * 180 / Math.PI); }
      } else {
        const a = +mode;
        if(a <= 0.5) nulls.push(Math.acos(-a / (1 - a)) * 180 / Math.PI);
      }
      const r180 = mag(Math.PI);
      q("#b2-9-polar-lv").textContent = fmtDb(lvl(mag(ang * Math.PI / 180))) + (!ha && mag(ang * Math.PI / 180) < -1e-9 ? ", inverted" : "");
      q("#b2-9-polar-rear").textContent = fmtDb(lvl(r180)) + (!ha && r180 < -1e-9 ? ", inverted" : "");
      q("#b2-9-polar-null").textContent = nulls.length ? nulls.map(v => v.toFixed(0) + "°").join(", ") : "none";
      q("#b2-9-polar-di").textContent = (isFinite(di) ? di.toFixed(1) : "0.0") + " dB";
      q("#b2-9-polar-fr").textContent = ha ? fmtDb(lvl(frontRe)) : "n/a (single mic)";

      const cv = el.querySelector("canvas"), c = sizeCanvas(cv); if(!c) return;
      const {ctx, w, h} = c;
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 24, range = 30;
      const rho = v => { const L = lvl(v); return isFinite(L) ? Math.max(0, (L + range) / range) * R : 0; };
      const grid = css("--plot-grid"), axis = css("--plot-axis"), muted = css("--muted");
      ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace";
      ctx.lineWidth = 1;
      [0, -10, -20].forEach(v => {
        const rr = (v + range) / range * R;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.strokeStyle = v === 0 ? axis : grid;
        ctx.setLineDash(v === 0 ? [4, 4] : []); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = muted; ctx.fillText((v === 0 ? "0" : "−" + (-v)) + " dB", cx + 4, cy - rr + 12);
      });
      for(let k = 0; k < 12; k++){
        const t = k * Math.PI / 6;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.sin(t), cy - R * Math.cos(t)); ctx.strokeStyle = grid; ctx.stroke();
      }
      ctx.fillStyle = muted; ctx.textAlign = "center";
      ctx.fillText("0° front", cx, cy - R - 8);
      ctx.fillText("180°", cx, cy + R + 16);
      ctx.textAlign = "left"; ctx.fillText("90°", Math.min(w - 30, cx + R + 4), cy + 4);
      ctx.textAlign = "right"; ctx.fillText("270°", Math.max(34, cx - R - 4), cy + 4);
      ctx.textAlign = "left";

      ctx.beginPath();
      for(let i = 0; i <= 360; i++){
        const t = i * Math.PI / 180, r = rho(mag(t));
        const x = cx + r * Math.sin(t), y = cy - r * Math.cos(t);
        if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = css("--accent"); ctx.lineWidth = 2.2; ctx.stroke();

      const ta = ang * Math.PI / 180, rs = rho(mag(ta));
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.sin(ta), cy - R * Math.cos(ta));
      ctx.strokeStyle = css("--right"); ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cx + rs * Math.sin(ta), cy - rs * Math.cos(ta), 4.5, 0, TAU); ctx.fillStyle = css("--right"); ctx.fill();
    }
  });

  /* ---------- b2-9-cap: capacitance and voltage vs displacement ---------- */
  AT.demo("b2-9-cap", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const q = s => el.querySelector(s);
      const e0 = 8.854e-12;
      const D = +q("#b2-9-cap-dia").value * 1e-3;
      const d0 = +q("#b2-9-cap-gap").value * 1e-6;
      const V0 = +q("#b2-9-cap-v").value;
      const frac = +q("#b2-9-cap-x").value / 100;   // fraction of gap
      const x = frac * d0;
      const A = Math.PI * D * D / 4;
      const C0 = e0 * A / d0 * 1e12, Cn = e0 * A / (d0 - x) * 1e12;
      const e = V0 * x / d0;
      q("#b2-9-cap-x-o").textContent = (x * 1e6).toFixed(1) + " µm (" + Math.round(frac * 100) + " % of gap)";
      q("#b2-9-cap-dia-o").textContent = (D * 1e3).toFixed(0) + " mm";
      q("#b2-9-cap-gap-o").textContent = (d0 * 1e6).toFixed(0) + " µm";
      q("#b2-9-cap-v-o").textContent = V0 + " V";
      const f2 = v => v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
      q("#b2-9-cap-c0").textContent = f2(C0) + " pF";
      q("#b2-9-cap-cn").textContent = f2(Cn) + " pF";
      const dC = Cn - C0;
      q("#b2-9-cap-dc").textContent = (dC >= 0 ? "+" : "−") + f2(Math.abs(dC)) + " pF (" + (dC >= 0 ? "+" : "−") + Math.abs(100 * dC / C0).toFixed(1) + " %)";
      q("#b2-9-cap-e").textContent = (e >= 0 ? "+" : "−") + Math.abs(e).toFixed(1) + " V";

      const xs = [], cs = [], vs = [];
      for(let i = -80; i <= 80; i++){ const xx = i / 100 * d0; xs.push(xx * 1e6); cs.push(e0 * A / (d0 - xx) * 1e12); vs.push(V0 * i / 100); }
      const xl = [-0.8 * d0 * 1e6, 0.8 * d0 * 1e6];
      const cmax = cs[cs.length - 1];
      plot(q("#b2-9-cap-c1"), {
        xlim: xl, ylim: [0, cmax * 1.08], xlabel: "Displacement towards backplate (µm)", ylabel: "C (pF)",
        series: [
          {x: xs, y: cs, color: "--accent", width: 2},
          {x: [xl[0], xl[1]], y: [C0, C0], color: "--plot-axis", width: 1, dash: [4, 4]},
          {x: [x * 1e6], y: [Cn], color: "--right", marker: "o", msize: 5, line: false}
        ],
        labels: [{text: "C at rest", x: xl[0], y: C0, dx: 4, dy: -6, color: "--muted"}]
      });
      plot(q("#b2-9-cap-c2"), {
        xlim: xl, ylim: [-0.85 * V0, 0.85 * V0], xlabel: "Displacement towards backplate (µm)", ylabel: "Output e (V)",
        series: [
          {x: xs, y: vs, color: "--left", width: 2},
          {x: [xl[0], xl[1]], y: [0, 0], color: "--plot-axis", width: 1, dash: [4, 4]},
          {x: [x * 1e6], y: [e], color: "--right", marker: "o", msize: 5, line: false}
        ]
      });
    }
  });

  /* ---------- b2-10-ia: interaural attenuation and cross-hearing ---------- */
  AT.demo("b2-10-ia", {
    init(el){ el.querySelectorAll("input").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const q = s => el.querySelector(s);
      const pl = +q("#b2-10-ia-pl").value, bc = +q("#b2-10-ia-bc").value;
      const ias = +q("#b2-10-ia-s").value, iai = +q("#b2-10-ia-i").value;
      q("#b2-10-ia-pl-o").textContent = pl + " dB HL";
      q("#b2-10-ia-bc-o").textContent = bc + " dB HL";
      q("#b2-10-ia-s-o").textContent = ias + " dB";
      q("#b2-10-ia-i-o").textContent = iai + " dB";
      const rs = pl - ias, ri = pl - iai;
      const verdict = r => r >= bc ? " (masking needed)" : " (below threshold)";
      q("#b2-10-ia-rs").textContent = rs + " dB HL" + verdict(rs);
      q("#b2-10-ia-ri").textContent = ri + " dB HL" + verdict(ri);
      q("#b2-10-ia-ms").textContent = (bc + ias) + " dB HL";
      q("#b2-10-ia-mi").textContent = (bc + iai) + " dB HL";
      const xs = [0, 120];
      plot(q("canvas"), {
        xlim: [0, 120], ylim: [-60, 90], xlabel: "Presentation level at test ear (dB HL)", ylabel: "At non-test cochlea (dB HL)",
        series: [
          {x: xs, y: xs.map(v => v - ias), color: "--right", width: 2},
          {x: xs, y: xs.map(v => v - iai), color: "--left", width: 2},
          {x: xs, y: [bc, bc], color: "--warn", width: 2, dash: [6, 4]},
          {x: [pl, pl], y: [-60, 90], color: "--plot-axis", width: 1, dash: [3, 3]},
          {x: [pl, pl], y: [rs, ri], color: "--ink", marker: "o", msize: 5, line: false}
        ],
        labels: [
          {text: "supra-aural", x: 112, y: 112 - ias, dx: -4, dy: -8, color: "--right", align: "right"},
          {text: "insert", x: 112, y: 112 - iai, dx: -4, dy: 14, color: "--left", align: "right"},
          {text: "non-test BC threshold", x: 2, y: bc, dx: 4, dy: -6, color: "--warn"}
        ]
      });
    }
  });
})();
