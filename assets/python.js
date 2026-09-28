(function(){
"use strict";
const AT = window.AT; const {$, $$, css, TAU, rng, gauss, fft, makeTone, plot, heat, highlight, esc} = AT;
const cache = {};
Object.assign(AT.plots, {
  vec(cv){ const fs=44100, n=221, x=[], y=[]; for(let i=0;i<n;i++){ x.push(i/fs*1000); y.push(0.5*Math.sin(TAU*1000*i/fs)); }
    cv.dataset.h = 200; plot(cv, {xlim:[0,5], ylim:[-0.6,0.6], xlabel:"Time (ms)", ylabel:"Amplitude", series:[{x, y, color:"--accent"}]}); },
  ramp(cv){ if(!cache.ramp) cache.ramp = makeTone(2000, 0.3); const t = cache.ramp, x=[], y=[]; for(let i=0;i<t.length;i++){ x.push(i/44.1); y.push(t[i]); }
    cv.dataset.h = 200; plot(cv, {xlim:[0,300], ylim:[-0.6,0.6], xlabel:"Time (ms)", ylabel:"Amplitude", series:[{x, y, color:"--accent", width:1}]}); },
  fft(cv){ if(!cache.fft){ const fs=44100, s1=makeTone(1000,0.5,fs,0.5), s2=makeTone(3000,0.5,fs,0.1), N=s1.length, M=32768, re=new Float64Array(M), im=new Float64Array(M);
      for(let i=0;i<N;i++){ const w = 0.5-0.5*Math.cos(TAU*i/(N-1)); re[i]=(s1[i]+s2[i])*w; } fft(re, im);
      const mags=[]; let mx=0; const kmax = Math.ceil(5200/(fs/M)); for(let k=0;k<kmax;k++){ const v=Math.hypot(re[k],im[k]); mags.push(v); if(v>mx) mx=v; }
      cache.fft = {x: mags.map((_,k)=>k*fs/M), y: mags.map(v=>20*Math.log10(v/mx+1e-12))}; }
    cv.dataset.h = 220; plot(cv, {xlim:[0,5000], ylim:[-100,5], xlabel:"Frequency (Hz)", ylabel:"Magnitude (dB re peak)", series:[{x:cache.fft.x, y:cache.fft.y, color:"--accent", width:1.3}],
      labels:[{text:"1 kHz, 0 dB", x:1000, y:0, dx:8, dy:4, color:"--muted"}, {text:"3 kHz, -14 dB", x:3000, y:-14, dx:8, dy:4, color:"--muted"}]}); },
  bp(cv){ const fs=44100, N=4, pw = f=>Math.tan(Math.PI*f/fs), wl=pw(300), wh=pw(3400), w0=Math.sqrt(wl*wh), B=wh-wl, x=[], y=[];
    for(let i=0;i<=400;i++){ const f = 20*Math.pow(1000, i/400); if(f>=fs/2) break; const w=pw(f), O=(w*w-w0*w0)/(w*B); x.push(f); y.push(-10*Math.log10(1+Math.pow(O*O, N))); }
    cv.dataset.h = 220; plot(cv, {xlog:true, xlim:[20,20000], ylim:[-80,5], xticks:[[20,"20"],[100,"100"],[300,"300"],[1000,"1k"],[3400,"3.4k"],[10000,"10k"],[20000,"20k"]], xlabel:"Frequency (Hz)", ylabel:"Gain (dB)",
      series:[{x, y, color:"--accent", width:2}, {x:[20,20000], y:[-3,-3], color:"--right", width:1, dash:[4,4]}], labels:[{text:"-3 dB", x:20, y:-3, dx:6, dy:-6, color:"--right"}]}); },
  notch(cv){ const fs=44100, w0=TAU*50/fs, bw=w0/30, beta=Math.tan(bw/2), g=1/(1+beta), b=[g,-2*g*Math.cos(w0),g], a=[1,-2*g*Math.cos(w0),2*g-1], x=[], y=[];
    for(let i=0;i<=600;i++){ const f = 10 + i*190/600, w = TAU*f/fs; const e1r=Math.cos(w), e1i=-Math.sin(w), e2r=Math.cos(2*w), e2i=-Math.sin(2*w);
      const nr=b[0]+b[1]*e1r+b[2]*e2r, ni=b[1]*e1i+b[2]*e2i, dr=a[0]+a[1]*e1r+a[2]*e2r, di=a[1]*e1i+a[2]*e2i;
      x.push(f); y.push(20*Math.log10(Math.hypot(nr,ni)/Math.hypot(dr,di)+1e-9)); }
    cv.dataset.h = 220; plot(cv, {xlim:[10,200], ylim:[-45,3], xlabel:"Frequency (Hz)", ylabel:"Gain (dB)", series:[{x, y, color:"--accent", width:2}], labels:[{text:"50 Hz mains", x:50, y:-40, dx:8, color:"--right"}]}); },
  audiogram(cv){ const f=[250,500,1000,2000,4000,8000], r=[20,25,30,45,60,65], l=[15,20,30,50,75,70];
    cv.dataset.h = 340; plot(cv, {xlog:true, xlim:[180,11000], ylim:[-10,120], invertY:true, xticks:f.map((v,i)=>[v,["250","500","1k","2k","4k","8k"][i]]), yticks:[-10,0,10,20,30,40,50,60,70,80,90,100,110,120].map(v=>[v,String(v)]),
      xlabel:"Frequency (Hz)", ylabel:"Hearing level (dB HL)", series:[{x:f, y:r, color:"--right", marker:"o"}, {x:f, y:l, color:"--left", marker:"x"}],
      labels:[{text:"O  Right ear (AC)", x:200, y:105, color:"--right"}, {text:"X  Left ear (AC)", x:200, y:115, color:"--left"}]}); },
  spec(cv){ if(!cache.spec){ const sr=16000, n=32000, nfft=512, hop=160, fmin=200, fmax=4000, L=Math.log(fmax/fmin), y=new Float64Array(n);
      for(let i=0;i<n;i++){ const t=i/sr; y[i]=Math.cos(TAU*fmin*2/L*(Math.exp(t*L/2)-1)); }
      const nfr = 1 + Math.floor(n/hop), nb = nfft/2+1, data = new Float32Array(nfr*nb); let mx = 0; const win = Array.from({length:nfft}, (_,k)=>0.5-0.5*Math.cos(TAU*k/nfft));
      for(let fr=0; fr<nfr; fr++){ const re=new Float64Array(nfft), im=new Float64Array(nfft), st=fr*hop-nfft/2;
        for(let k=0;k<nfft;k++){ const idx=st+k; re[k] = (idx>=0 && idx<n) ? y[idx]*win[k] : 0; } fft(re, im);
        for(let b=0;b<nb;b++){ const v=Math.hypot(re[b],im[b]); data[fr*nb+b]=v; if(v>mx) mx=v; } }
      for(let i=0;i<data.length;i++) data[i] = Math.max(-80, 20*Math.log10(data[i]/mx+1e-10));
      cache.spec = {data, nx:nfr, ny:nb}; }
    cv.dataset.h = 260; heat(cv, Object.assign({zmin:-80, zmax:0, xlim:[0,2], ylim:[0,8000], xlabel:"Time (s)", ylabel:"Frequency (Hz)"}, cache.spec)); },
  snr(cv){ if(!cache.snr){ const r=rng(7), fs=44100, n=Math.round(0.02*fs), sp=makeTone(1000,1.0,fs,0.3), x=[], s=[], m=[]; let ps=0, pn=0; const noise=[];
      for(let i=0;i<fs;i++){ const g=gauss(r); noise.push(g); pn+=g*g; ps+=sp[i]*sp[i]; } const gain=Math.sqrt(ps/pn);
      for(let i=0;i<n;i++){ const k=i+4410; x.push(i/fs*1000); s.push(sp[k]); m.push(sp[k]+gain*noise[k]); } cache.snr={x,s,m}; }
    cv.dataset.h = 220; plot(cv, {xlim:[0,20], ylim:[-1.3,1.3], xlabel:"Time (ms)", ylabel:"Amplitude", series:[{x:cache.snr.x, y:cache.snr.m, color:"--left", width:1}, {x:cache.snr.x, y:cache.snr.s, color:"--right", width:2}],
      labels:[{text:"red: speech   blue: mix at 0 dB SNR", x:0.4, y:1.12, color:"--muted"}]}); },
  abr(cv){ if(!cache.abr){ const r=rng(3), fs=20000, n=200, t=[], abr=[];
      for(let i=0;i<n;i++){ const tm=i*1000/fs; t.push(tm); abr.push(0.25*Math.exp(-(((tm-1.6)/0.25)**2))+0.3*Math.exp(-(((tm-3.8)/0.3)**2))+0.5*Math.exp(-(((tm-5.7)/0.35)**2))); }
      const avg = N => abr.map(v => v + 5*gauss(r)/Math.sqrt(N)); cache.abr={t, abr, a100:avg(100), a2000:avg(2000)}; }
    const A=cache.abr; cv.dataset.h = 280;
    plot(cv, {xlim:[0,10], ylim:[-3.9,1.0], yticks:[], xlabel:"Time after stimulus (ms)", ylabel:"Amplitude (offset)",
      series:[{x:A.t, y:A.abr, color:"--accent", width:2}, {x:A.t, y:A.a2000, off:-1.4, color:"--left", width:1.4}, {x:A.t, y:A.a100, off:-2.9, color:"--right", width:1.2}],
      labels:[{text:"True response (waves I, III, V)", x:6.6, y:0.55, color:"--accent"}, {text:"Average of 2000 sweeps", x:6.6, y:-0.95, color:"--left"}, {text:"Average of 100 sweeps", x:6.6, y:-2.25, color:"--right"}, {text:"V", x:5.7, y:0.62, dx:-4, color:"--muted"}, {text:"I", x:1.6, y:0.37, dx:-2, color:"--muted"}, {text:"III", x:3.8, y:0.42, dx:-8, color:"--muted"}]}); }
});
/* ---------- hero scope ---------- */
let heroF = 1000;
function drawHero(){
  const cv = $("#heroCanvas"), fs = 44100, n = 221, x = [], y = [];
  for(let i=0;i<n;i++){ x.push(i/fs*1000); y.push(0.5*Math.sin(TAU*heroF*i/fs)); }
  const ser = [{x, y, color:"--accent", width:1.8}]; if(heroF >= 2000) ser.push({x, y, color:"--left", line:false, marker:"dot", msize:1.8});
  plot(cv, {xlim:[0,5], ylim:[-0.6,0.6], yticks:[[-0.5,"-0.5"],[0,"0"],[0.5,"0.5"]], xticks:[0,1,2,3,4,5].map(v=>[v, v+" ms"]), series:ser});
  $("#heroCode").innerHTML = highlight(`x = 0.5 * np.sin(2 * np.pi * ${heroF} * t)   # ${(fs/heroF).toFixed(1)} samples per cycle`, "python");
}
function initHero(){
  const row = $("#heroFreqs");
  [125,250,500,1000,2000,4000,8000].forEach(f => { const b = document.createElement("button"); b.type = "button"; b.textContent = f >= 1000 ? (f/1000)+"k" : f; b.setAttribute("aria-label", f + " hertz");
    if(f === heroF) b.classList.add("on"); b.addEventListener("click", () => { heroF = f; $$("button", row).forEach(x => x.classList.toggle("on", x === b)); drawHero(); }); row.appendChild(b); });
}

/* ---------- labs ---------- */
function drawAlias(){
  const f = +$("#aFreq").value, fs = +$("#aFs").value, W = +$("#aWin").value;
  $("#aFreqOut").textContent = f.toLocaleString("en-IN") + " Hz"; $("#aWinOut").textContent = W + " ms";
  const k = Math.round(f/fs), d = f - k*fs, fa = Math.abs(d), sgn = d >= 0 ? 1 : -1;
  const tEnd = W/1000, nc = 1600, cx = [], cy = [], rx = [], ry = [], sx = [], sy = [];
  for(let i=0;i<=nc;i++){ const t = tEnd*i/nc; cx.push(t*1000); cy.push(Math.sin(TAU*f*t)); rx.push(t*1000); ry.push(sgn*Math.sin(TAU*fa*t)); }
  for(let n=0; n/fs <= tEnd; n++){ sx.push(n/fs*1000); sy.push(Math.sin(TAU*f*n/fs)); }
  plot($("#aliasCanvas"), {xlim:[0,W], ylim:[-1.2,1.2], yticks:[[-1,"-1"],[0,"0"],[1,"1"]], xlabel:"Time (ms)", series:[{x:cx, y:cy, color:"--plot-axis", width:1}, {x:rx, y:ry, color:"--right", width:2.2}, {x:sx, y:sy, color:"--left", line:false, marker:"dot", msize: sx.length > 120 ? 2 : 3.5}]});
  $("#aNyq").textContent = (fs/2).toLocaleString("en-IN") + " Hz";
  const a = $("#aApp"); a.textContent = Math.round(fa).toLocaleString("en-IN") + " Hz" + (f > fs/2 ? "  (aliased)" : ""); a.classList.toggle("bad", f > fs/2);
  $("#aSpc").textContent = (fs/f).toFixed(2);
  $("#aliasCode").innerHTML = highlight(`fs = ${fs}\nf = ${f}\nt = np.arange(int(fs * ${W/1000})) / fs\nx = np.sin(2 * np.pi * f * t)\nplt.plot(t * 1000, x, "o")        # the samples the ADC stores\n# apparent frequency after folding: abs(f - fs * round(f / fs)) = ${Math.round(fa)} Hz`, "python");
}
function drawQuant(){
  const N = +$("#qBits").value, amp = +$("#qAmp").value, gdb = +$("#qClip").value, g = Math.pow(10, gdb/20);
  $("#qBitsOut").textContent = N + " bits"; $("#qAmpOut").textContent = amp.toFixed(2); $("#qClipOut").textContent = "+" + gdb + " dB";
  const q = 2/Math.pow(2, N), Q = v => Math.max(-1, Math.min(1-q, Math.round(v/q)*q));
  const x = [], a = [], y = []; for(let i=0;i<=500;i++){ const t = i/500; const v = amp*g*Math.sin(TAU*t); x.push(t*10); a.push(v); y.push(Q(v)); }
  plot($("#quantCanvas"), {xlim:[0,10], ylim:[-1.3,1.3], yticks:[[-1,"-1 FS"],[0,"0"],[1,"+1 FS"]], xlabel:"Time (ms), one cycle of 100 Hz", series:[{x, y:a, color:"--plot-axis", width:1.2}, {x, y, color:"--right", width:2, step:true}]});
  let ps = 0, pe = 0, clip = 0; const M = 20000;
  for(let i=0;i<M;i++){ const v = amp*g*Math.sin(TAU*37.3*i/M); const o = Q(v); ps += v*v; pe += (o-v)*(o-v); if(Math.abs(v) > 1-q/2) clip++; }
  $("#qLev").textContent = Math.pow(2, N).toLocaleString("en-IN");
  $("#qSq").textContent = (6.02*N + 1.76).toFixed(1) + " dB";
  $("#qMeas").textContent = (10*Math.log10(ps/pe)).toFixed(1) + " dB";
  const c = $("#qClipped"); c.textContent = (100*clip/M).toFixed(1) + " %"; c.classList.toggle("bad", clip > 0);
}
function initLabs(){
  ["#aFreq","#aFs","#aWin"].forEach(s => $(s).addEventListener("input", drawAlias));
  ["#qBits","#qAmp","#qClip"].forEach(s => $(s).addEventListener("input", drawQuant));
}

/* ---------- matrix shape visuals ---------- */
function initMatrices(){
  const st = $("#mgStereo"); st.style.gridTemplateColumns = "repeat(2, 14px)"; for(let i=0;i<14;i++){ const s = document.createElement("span"); if(i%2) s.classList.add("hl"); st.appendChild(s); }
  const fr = $("#mgFrames"); fr.style.gridTemplateColumns = "repeat(14, 14px)"; for(let r=0;r<6;r++) for(let c=0;c<14;c++){ const s = document.createElement("span"); if(r === 2) s.classList.add("hl"); fr.appendChild(s); }
}

/* ---------- quiz ---------- */
const QUIZ = [
  {q:"What does import numpy as np do?", o:["Installs NumPy from the internet","Loads NumPy and lets you refer to it as np","Creates a variable called np that holds an array","Converts the notebook to NumPy format"], a:1, e:"import loads an installed package; as gives it a short alias."},
  {q:"fs = 16000 and dur = 2.0. What is the shape of np.arange(int(fs*dur)) / fs?", o:["(2,)","(16000,)","(32000,)","(32000, 1)"], a:2, e:"16000 samples per second for 2 s gives 32 000 samples in a 1-D array."},
  {q:"A sine wave has peak amplitude 1.0. What is its RMS level in dBFS?", o:["0 dBFS","-3.01 dBFS","-6.02 dBFS","-9.03 dBFS"], a:1, e:"RMS = 1/√2 = 0.707, and 20·log10(0.707) = -3.01 dB."},
  {q:"thr has shape (2, 6): two ears by six frequencies. What does thr.mean(axis=1) return?", o:["Six values, one per frequency","Two values, one per ear","One overall mean","A (2, 6) matrix"], a:1, e:"axis=1 averages across the columns of each row, giving one value per ear."},
  {q:"An FFT of N = 4096 samples at fs = 44 100 Hz has what bin spacing?", o:["4.1 Hz","10.8 Hz","22.05 Hz","44.1 Hz"], a:1, e:"Frequency resolution is fs / N = 44 100 / 4096 = 10.8 Hz."},
  {q:"Why pass output=\"sos\" to signal.butter?", o:["It makes the filter FIR","It gives linear phase","It splits a high-order IIR filter into stable second-order sections","It speeds up plotting"], a:2, e:"Second-order sections avoid the numerical errors of long polynomial coefficients."},
  {q:"On a Matplotlib audiogram, which call places better hearing at the top?", o:["ax.set_xscale(\"log\")","ax.set_ylim(120, -10)","ax.grid(True)","plt.show()"], a:1, e:"Giving the larger value first reverses the y axis, matching audiogram convention."},
  {q:"librosa.load(\"file.wav\") without sr returns audio at which rate?", o:["The file's original rate","16 000 Hz","22 050 Hz","44 100 Hz"], a:2, e:"librosa resamples to 22 050 Hz by default. Use sr=None to keep the original."}
];
function pyQuiz(){
  const box = $("#quiz"); let answered = 0, right = 0;
  QUIZ.forEach((item, qi) => {
    const d = document.createElement("div"); d.className = "q";
    d.innerHTML = `<div class="qt">${qi+1}. ${esc(item.q)}</div><div class="opts"></div><div class="fb" aria-live="polite"></div>`;
    const opts = $(".opts", d), fb = $(".fb", d);
    item.o.forEach((txt, oi) => { const b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = txt;
      b.addEventListener("click", () => { if(d.dataset.done) return; d.dataset.done = "1"; answered++;
        if(oi === item.a){ right++; b.classList.add("right"); fb.textContent = "Correct. " + item.e; }
        else { b.classList.add("wrong"); opts.children[item.a].classList.add("right"); fb.textContent = "Not quite. " + item.e; }
        $("#quizScore").textContent = `Score: ${right} of ${answered} answered (${QUIZ.length} questions)`; });
      opts.appendChild(b); });
    box.appendChild(d);
  });
}

AT.onInit(() => { initHero(); initLabs(); initMatrices(); });
AT.onRedraw(() => { drawHero(); drawAlias(); drawQuant(); });
})();
