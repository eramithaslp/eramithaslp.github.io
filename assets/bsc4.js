(function(){
  const {plot, css, rng} = window.AT;
  const q = (el, id) => el.querySelector("#" + id);
  const L10 = Math.log10;

  /* ---------- 4.1 memory hierarchy ---------- */
  const LEVELS = [
    {k:"Reg", name:"Registers",  t:0.25,  tt:"about 0.25 ns",       c:2e3,   cc:"a few kB per core"},
    {k:"L1",  name:"L1 cache",   t:1,     tt:"about 1 ns",          c:64e3,  cc:"32 to 64 kB per core"},
    {k:"L2",  name:"L2 cache",   t:4,     tt:"about 3 to 5 ns",     c:2e6,   cc:"1 to 3 MB per core"},
    {k:"L3",  name:"L3 cache",   t:15,    tt:"about 10 to 20 ns",   c:24e6,  cc:"8 to 36 MB shared"},
    {k:"RAM", name:"RAM (DDR5)", t:80,    tt:"about 60 to 100 ns",  c:16e9,  cc:"8 to 64 GB"},
    {k:"SSD", name:"NVMe SSD",   t:80e3,  tt:"about 50 to 100 µs",  c:1e12,  cc:"256 GB to 2 TB"},
    {k:"HDD", name:"Hard disk",  t:8e6,   tt:"about 5 to 10 ms",    c:4e12,  cc:"1 to 8 TB"}
  ];
  function human(ns){
    const s = ns; // 1 ns becomes 1 s
    if(s < 60) return (s < 10 ? s.toFixed(2).replace(/\.?0+$/, "") : s.toFixed(0)) + " s";
    if(s < 3600) return (s/60).toFixed(1) + " min";
    if(s < 86400) return (s/3600).toFixed(1) + " hours";
    return (s/86400).toFixed(0) + " days";
  }
  AT.demo("b4-1-mem", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const mode = q(el, "b4-1-mem-m").value, sel = +q(el, "b4-1-mem-l").value;
      const lv = LEVELS[sel];
      q(el, "b4-1-mem-l-o").textContent = lv.name;
      q(el, "b4-1-mem-t").textContent = lv.tt;
      q(el, "b4-1-mem-c").textContent = lv.cc;
      q(el, "b4-1-mem-h").textContent = human(lv.t);
      const cv = el.querySelector("canvas");
      const bw = Math.max(10, Math.min(30, (cv.clientWidth || 400) / 16));
      let ylim, yticks, ylabel, val;
      if(mode === "t"){
        ylim = [-1, 7.5]; ylabel = "Access time (log)";
        yticks = [[-1,"0.1n"],[0,"1n"],[1,"10n"],[2,"100n"],[3,"1µ"],[4,"10µ"],[5,"100µ"],[6,"1m"],[7,"10m"]];
        val = d => L10(d.t);
      } else {
        ylim = [2, 13]; ylabel = "Capacity, bytes (log)";
        yticks = [[3,"1k"],[4,"10k"],[5,"100k"],[6,"1M"],[7,"10M"],[8,"100M"],[9,"1G"],[10,"10G"],[11,"100G"],[12,"1T"]];
        val = d => L10(d.c);
      }
      const series = LEVELS.map((d, i) => ({x:[i, i], y:[ylim[0], val(d)], width:bw, color: i === sel ? "--accent" : "--plot-axis"}));
      plot(cv, {
        xlim:[-0.6, 6.6], ylim, ylabel,
        xticks: LEVELS.map((d, i) => [i, d.k]),
        yticks, series
      });
    }
  });

  /* ---------- 4.3 CPU scheduling ---------- */
  const PROCS = [
    {id:"P1", burst:3, row:3, color:"--accent"},
    {id:"P2", burst:8, row:2, color:"--right"},
    {id:"P3", burst:5, row:1, color:"--left"}
  ];
  function schedule(alg, qn){
    const segs = [];
    let t = 0;
    if(alg === "fcfs" || alg === "sjf"){
      const order = PROCS.slice();
      if(alg === "sjf") order.sort((a, b) => a.burst - b.burst);
      order.forEach(p => { segs.push({p, s:t, e:t + p.burst}); t += p.burst; });
    } else {
      const rem = {}; PROCS.forEach(p => rem[p.id] = p.burst);
      const queue = PROCS.slice();
      while(queue.length){
        const p = queue.shift(), d = Math.min(qn, rem[p.id]);
        segs.push({p, s:t, e:t + d}); t += d; rem[p.id] -= d;
        if(rem[p.id] > 0) queue.push(p);
      }
    }
    return segs;
  }
  AT.demo("b4-3-sched", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const alg = q(el, "b4-3-sched-alg").value, qn = +q(el, "b4-3-sched-q").value;
      q(el, "b4-3-sched-q-o").textContent = qn + " ms" + (alg === "rr" ? "" : " (not used)");
      const segs = schedule(alg, qn);
      const done = {};
      segs.forEach(g => { done[g.p.id] = g.e; });
      let wsum = 0, tsum = 0;
      PROCS.forEach(p => { tsum += done[p.id]; wsum += done[p.id] - p.burst; });
      let cs = 0;
      for(let i = 1; i < segs.length; i++) if(segs[i].p !== segs[i-1].p) cs++;
      q(el, "b4-3-sched-w").textContent = (wsum/3).toFixed(2) + " ms";
      q(el, "b4-3-sched-t").textContent = (tsum/3).toFixed(2) + " ms";
      q(el, "b4-3-sched-c").textContent = String(cs);
      const series = segs.map(g => ({x:[g.s, g.e], y:[g.p.row, g.p.row], width:20, color:g.p.color}));
      // thin separators so adjacent slices of the same process stay visible
      segs.forEach(g => series.push({x:[g.s, g.s], y:[g.p.row - 0.28, g.p.row + 0.28], width:1.5, color:"--ink"}));
      const labels = PROCS.map(p => ({text:"done " + done[p.id], x:Math.min(done[p.id], 16), y:p.row + 0.3, dx:-4, align:"right", color:"--muted"}));
      plot(el.querySelector("canvas"), {
        xlim:[0, 16.5], ylim:[0.4, 3.7], xlabel:"Time (ms)",
        yticks:[[3,"P1"],[2,"P2"],[1,"P3"]],
        xticks:[[0,"0"],[2,"2"],[4,"4"],[6,"6"],[8,"8"],[10,"10"],[12,"12"],[14,"14"],[16,"16"]],
        series, labels
      });
    }
  });

  /* ---------- 4.5 adaptive digits-in-noise ---------- */
  const N_TRIALS = 23, STEP = 2, SLOPE = 1.2;
  AT.demo("b4-5-din", {
    init(el){
      el._seed = 7;
      q(el, "b4-5-din-new").addEventListener("click", () => { el._seed += 1; this.draw(el); });
      q(el, "b4-5-din-srt").addEventListener("input", () => this.draw(el));
    },
    draw(el){
      const srt = +q(el, "b4-5-din-srt").value;
      q(el, "b4-5-din-srt-o").textContent = srt.toFixed(1) + " dB SNR";
      const r = rng(el._seed || 7);
      const snr = [0], ok = [];
      for(let i = 0; i < N_TRIALS; i++){
        const p = 1 / (1 + Math.exp(-(snr[i] - srt) / SLOPE));
        const correct = r() < p;
        ok.push(correct);
        snr.push(snr[i] + (correct ? -STEP : STEP));
      }
      // estimate: mean of SNRs of trials 5 to 24 (trial 24 is the level that would come next)
      let s = 0; for(let i = 4; i < snr.length; i++) s += snr[i];
      const est = s / (snr.length - 4);
      q(el, "b4-5-din-est").textContent = est.toFixed(1) + " dB SNR";
      q(el, "b4-5-din-true").textContent = srt.toFixed(1) + " dB SNR";
      q(el, "b4-5-din-n").textContent = ok.filter(Boolean).length + " of " + N_TRIALS;
      const xs = snr.slice(0, N_TRIALS).map((_, i) => i + 1);
      const cx = [], cy = [], wx = [], wy = [];
      ok.forEach((c, i) => { (c ? cx : wx).push(i + 1); (c ? cy : wy).push(snr[i]); });
      plot(el.querySelector("canvas"), {
        xlim:[0, 24.5], ylim:[-22, 8], xlabel:"Triplet number", ylabel:"SNR (dB)",
        series:[
          {x:xs, y:snr.slice(0, N_TRIALS), color:"--plot-axis", width:1.2},
          {x:[0, 24.5], y:[srt, srt], color:"--muted", width:1, dash:[4,4]},
          {x:[5, 24], y:[est, est], color:"--warn", width:2},
          {x:cx, y:cy, color:"--accent", line:false, marker:"o", msize:4},
          {x:wx, y:wy, color:"--right", line:false, marker:"x", msize:4}
        ],
        labels:[{text:"true SRT", x:0.5, y:srt, dy:-5, color:"--muted"}]
      });
    }
  });

  /* ---------- 4.6 loading a web page ---------- */
  const NODES = {
    pc:  {x:0.07, y:0.68, t:"Laptop"},
    rt:  {x:0.26, y:0.68, t:"Router"},
    isp: {x:0.45, y:0.68, t:"ISP"},
    dns: {x:0.45, y:0.22, t:"DNS resolver"},
    ns:  {x:0.80, y:0.22, t:"Root/TLD/auth"},
    net: {x:0.68, y:0.68, t:"Backbone"},
    srv: {x:0.91, y:0.68, t:"Web server"}
  };
  const LINKS = [["pc","rt"],["rt","isp"],["isp","dns"],["dns","ns"],["isp","net"],["net","srv"]];
  const TO_SRV = ["pc","rt","isp","net","srv"], TO_DNS = ["pc","rt","isp","dns"];
  function steps(cached){
    const s = [{msg:"Step 1. You type https://www.who.int and press Enter. The browser needs the server's IP address.", path:null}];
    if(cached){
      s.push({msg:"Step 2. The IP address is already in the browser or OS cache, so no DNS lookup is needed.", path:null});
    } else {
      s.push({msg:"Step 2. The laptop sends a DNS query to the resolver (usually run by the ISP).", path:TO_DNS});
      s.push({msg:"Step 3. The resolver asks the root, TLD (.int) and authoritative servers in turn.", path:["dns","ns"], back:true});
      s.push({msg:"Step 4. The resolver returns the IP address to the laptop and caches it.", path:TO_DNS.slice().reverse()});
    }
    s.push({msg:"TCP handshake: SYN, SYN-ACK, ACK set up a reliable connection to port 443 (one round trip).", path:TO_SRV, back:true});
    s.push({msg:"TLS handshake: keys are agreed and the server's certificate is checked (one round trip with TLS 1.3).", path:TO_SRV, back:true});
    s.push({msg:"HTTP GET request travels to the server inside the encrypted connection.", path:TO_SRV});
    s.push({msg:"The server replies (200 OK). Packets are routed back, reassembled by TCP and the browser renders HTML, CSS and JavaScript.", path:TO_SRV.slice().reverse()});
    s.forEach((x, i) => { if(i > 0 && !/^Step/.test(x.msg)) x.msg = "Step " + (i + 1) + ". " + x.msg; });
    return s;
  }
  function sizeCanvas(cv){
    const w = cv.clientWidth; if(!w) return null;
    const h = +(cv.dataset.h || 220), dpr = window.devicePixelRatio || 1;
    cv.style.height = h + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return {ctx, w, h};
  }
  function pointOnPath(path, back, f, P){
    let pts = path.map(k => P[k]);
    if(back) pts = pts.concat(pts.slice(0, -1).reverse());
    const segL = []; let tot = 0;
    for(let i = 1; i < pts.length; i++){ const d = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y); segL.push(d); tot += d; }
    let target = f * tot;
    for(let i = 1; i < pts.length; i++){
      if(target <= segL[i-1] || i === pts.length - 1){
        const g = segL[i-1] ? Math.min(1, target / segL[i-1]) : 1;
        return {x: pts[i-1].x + (pts[i].x - pts[i-1].x) * g, y: pts[i-1].y + (pts[i].y - pts[i-1].y) * g, pts};
      }
      target -= segL[i-1];
    }
    return {x: pts[0].x, y: pts[0].y, pts};
  }
  AT.demo("b4-6-web", {
    init(el){
      el._step = 0; el._f = 1;
      const self = this;
      const animate = () => {
        const t0 = performance.now(), dur = 1400;
        if(el._raf) cancelAnimationFrame(el._raf);
        const tick = now => { el._f = Math.min(1, (now - t0) / dur); self.draw(el); if(el._f < 1) el._raf = requestAnimationFrame(tick); };
        el._raf = requestAnimationFrame(tick);
      };
      q(el, "b4-6-web-next").addEventListener("click", () => {
        const n = steps(q(el, "b4-6-web-c").value === "1").length;
        el._step = (el._step + 1) % n; el._f = 0; this.draw(el); animate();
      });
      q(el, "b4-6-web-reset").addEventListener("click", () => { el._step = 0; el._f = 1; this.draw(el); });
      q(el, "b4-6-web-c").addEventListener("input", () => { el._step = 0; el._f = 1; this.draw(el); });
      q(el, "b4-6-web-d").addEventListener("input", () => this.draw(el));
    },
    draw(el){
      const d = +q(el, "b4-6-web-d").value, cached = q(el, "b4-6-web-c").value === "1";
      q(el, "b4-6-web-d-o").textContent = d.toLocaleString("en-GB") + " km";
      const rtt = d / 100 + 10;               // ms: 2d / (200 000 km/s) + 10 ms access
      const n = 3 + (cached ? 0 : 1);         // DNS (if needed), TCP, TLS 1.3, HTTP
      q(el, "b4-6-web-rtt").textContent = rtt.toFixed(0) + " ms";
      q(el, "b4-6-web-n").textContent = String(n);
      q(el, "b4-6-web-t").textContent = (n * rtt).toFixed(0) + " ms";
      const st = steps(cached), step = st[Math.min(el._step || 0, st.length - 1)];
      q(el, "b4-6-web-msg").textContent = step.msg;
      const s = sizeCanvas(el.querySelector("canvas")); if(!s) return;
      const {ctx, w, h} = s;
      const P = {}; Object.keys(NODES).forEach(k => { P[k] = {x: NODES[k].x * w, y: NODES[k].y * h}; });
      const ink = css("--ink"), muted = css("--muted"), rule = css("--rule") || muted, acc = css("--accent"), warn = css("--warn"), surf = css("--surface") || "transparent", surf2 = css("--surface-2") || surf;
      ctx.lineWidth = 2; ctx.strokeStyle = rule;
      LINKS.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke(); });
      let dot = null;
      if(step.path){
        const r = pointOnPath(step.path, step.back, el._f == null ? 1 : el._f, P);
        ctx.strokeStyle = acc; ctx.lineWidth = 4; ctx.beginPath();
        r.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
        dot = r;
      }
      const small = w < 520;
      ctx.font = (small ? "600 10px " : "600 12px ") + "'Schibsted Grotesk', Arial, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      Object.keys(NODES).forEach(k => {
        const txt = NODES[k].t, bw = ctx.measureText(txt).width + 14, bh = small ? 22 : 26;
        const p = {x: Math.max(bw/2 + 2, Math.min(w - bw/2 - 2, P[k].x)), y: P[k].y};
        const on = step.path && step.path.indexOf(k) >= 0;
        ctx.fillStyle = on ? surf2 : surf; ctx.strokeStyle = on ? acc : muted; ctx.lineWidth = on ? 2 : 1;
        ctx.beginPath(); ctx.rect(p.x - bw/2, p.y - bh/2, bw, bh); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink; ctx.fillText(txt, p.x, p.y + 1);
      });
      if(dot){ ctx.fillStyle = warn; ctx.beginPath(); ctx.arc(dot.x, dot.y, 7, 0, 2 * Math.PI); ctx.fill(); }
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = muted;
      ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillText("step " + ((el._step || 0) + 1) + " of " + st.length, 8, h - 10);
    }
  });

  /* ---------- 4.8 bandwidth check ---------- */
  const AUDIO = 0.1, DATA = 0.05, OVER = 0.2, EFF = 0.8;
  const upFromSlider = v => 0.25 * Math.pow(200, v / 100);
  function fmtT(s){
    if(s < 60) return s.toFixed(s < 10 ? 1 : 0) + " s";
    if(s < 3600) return s.toFixed(0) + " s (" + (s/60).toFixed(1) + " min)";
    return (s/3600).toFixed(2) + " h";
  }
  AT.demo("b4-8-bw", {
    init(el){ el.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => this.draw(el))); },
    draw(el){
      const vid = +q(el, "b4-8-bw-v").value;
      const up = upFromSlider(+q(el, "b4-8-bw-up").value);
      const fMB = +q(el, "b4-8-bw-f").value;
      q(el, "b4-8-bw-up-o").textContent = up.toFixed(up < 10 ? 2 : 1) + " Mbit/s";
      q(el, "b4-8-bw-f-o").textContent = fMB + " MB";
      const req = (vid + AUDIO + DATA) * (1 + OVER);
      const tUp = fMB * 8 / (up * EFF);
      const head = (up - req) / req * 100;
      q(el, "b4-8-bw-req").textContent = req.toFixed(2) + " Mbit/s";
      const hn = q(el, "b4-8-bw-head"); hn.textContent = (head >= 0 ? "+" : "") + head.toFixed(0) + "%"; hn.classList.toggle("bad", head < 0);
      q(el, "b4-8-bw-time").textContent = fmtT(tUp);
      q(el, "b4-8-bw-sug").textContent = up >= req * 1.25 ? "Synchronous OK" : up >= req ? "Synchronous, marginal" : "Store-and-forward or lower video";
      const xs = [], ys = [];
      for(let i = 0; i <= 120; i++){ const u = 0.25 * Math.pow(200, i / 120); xs.push(u); ys.push(L10(fMB * 8 / (u * EFF))); }
      const series = [
        {x:xs, y:ys, color:"--accent", width:2},
        {x:[req, req], y:[-1, 4.5], color:"--right", width:1.5, dash:[5,4]},
        {x:[up], y:[L10(tUp)], color:"--warn", line:false, marker:"dot", msize:6}
      ];
      const labels = req >= 0.25 ? [{text:"live needs " + req.toFixed(2), x:req, y:4.1, dx:6, color:"--right"}] : [{text:"audio-only need is below 0.25", x:0.27, y:4.1, color:"--right"}];
      plot(el.querySelector("canvas"), {
        xlim:[0.25, 50], xlog:true, ylim:[-1, 4.5], xlabel:"Upload speed (Mbit/s, log)", ylabel:"Upload time (s, log)",
        xticks:[[0.25,"0.25"],[0.5,"0.5"],[1,"1"],[2,"2"],[5,"5"],[10,"10"],[20,"20"],[50,"50"]],
        yticks:[[-1,"0.1"],[0,"1"],[1,"10"],[2,"100"],[3,"1k"],[4,"10k"]],
        series, labels
      });
    }
  });
})();
