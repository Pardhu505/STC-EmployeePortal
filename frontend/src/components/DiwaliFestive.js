// DiwaliFestive.js
// Diwali festive layer for the employee portal:
//   1. the mouse pointer becomes a small animated gold sparkler
//   2. a rocket sits bottom-left; bring the sparkler to it and it launches,
//      flies across the portal trailing colourful sparks, bursts at the centre
//      and announces "Diwali is in N days"
//   3. animated LED light strings along all four edges
//   4. on Diwali itself, the celebration card appears instead of the countdown
//
// Asset: public/festive/diwali_card.jpg
//
// Everything draws on ONE full-screen canvas (pointer-events: none) so it never
// blocks clicks, plus lightweight DOM for the lights and the card.

import React, { useEffect, useRef, useState, useCallback } from 'react';

// Diwali (Lakshmi Puja) 2026 — Sunday 8 November 2026.
const DIWALI_DATE = new Date('2026-11-08T00:00:00+05:30');
const SHOW_WITHIN_DAYS = 21;   // festive layer switches on this many days before
const SHOW_AFTER_DAYS = 2;     // ...and lingers for Govardhan Puja / Bhai Dooj

const SPARK_COLORS = ['#ffd54f', '#ff9800', '#ff5252', '#e040fb', '#40c4ff', '#69f0ae', '#fff176'];
const BULB_COLORS = ['#ff5252', '#ffd54f', '#69f0ae', '#40c4ff', '#e040fb', '#ff9800'];

function daysUntil(target) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

export default function DiwaliFestive() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef({
    mx: -200, my: -200, t: 0,
    sparks: [],      // sparkler trail from the cursor
    rocket: null,    // { x, y, vx, vy, tx, ty }
    burst: [],       // firework particles
    banner: 0,       // frames remaining for the countdown banner
    launching: false,
  });

  const [days, setDays] = useState(() => daysUntil(DIWALI_DATE));
  const [active, setActive] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardDismissed, setCardDismissed] = useState(false);
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onR = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  const GAP = 26;                                   // px between bulb centres
  const hCount = Math.max(12, Math.floor(vp.w / GAP));
  const vCount = Math.max(8, Math.floor(vp.h / GAP));

  /* ---------- is the festive layer on? ---------- */
  useEffect(() => {
    const d = daysUntil(DIWALI_DATE);
    const inWindow = d <= SHOW_WITHIN_DAYS && d >= -SHOW_AFTER_DAYS;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    setActive(inWindow && !reduce);
    setShowCard(inWindow && d <= 0);
    // keep the countdown honest across midnight
    const id = setInterval(() => setDays(daysUntil(DIWALI_DATE)), 60 * 60 * 1000);
    // the sparkler cursor only makes sense where there is a real pointer
    if (inWindow && !reduce && fine) document.body.classList.add('dw-nocursor');
    return () => { clearInterval(id); document.body.classList.remove('dw-nocursor'); };
  }, []);

  /* ---------- pointer tracking ---------- */
  useEffect(() => {
    if (!active) return;
    const onMove = (e) => { const s = stateRef.current; s.mx = e.clientX; s.my = e.clientY; };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [active]);

  const launchRocket = useCallback(() => {
    const s = stateRef.current;
    if (s.rocket || s.launching) return;
    const W = window.innerWidth, H = window.innerHeight;
    s.launching = true;
    // start bottom-left, finish at the centre — angle varies each time so it
    // flies diagonally / steeply / shallow on different launches
    const tx = W * (0.44 + Math.random() * 0.12);
    const ty = H * (0.34 + Math.random() * 0.12);
    s.rocket = { x: 68, y: H - 74, tx, ty, t: 0, dur: 72 + Math.random() * 26 };
  }, []);

  /* ---------- the one animation loop ---------- */
  useEffect(() => {
    if (!active) return;
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = window.innerWidth * dpr; cv.height = window.innerHeight * dpr;
      cv.style.width = window.innerWidth + 'px'; cv.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);

    const step = () => {
      const s = stateRef.current;
      const W = cv.clientWidth, H = cv.clientHeight;
      s.t++;
      ctx.clearRect(0, 0, W, H);

      /* --- sparkler trail at the pointer --- */
      if (s.mx > -100) {
        for (let i = 0; i < 7; i++) {           // denser shower
          const a = Math.random() * Math.PI * 2, sp = 1.1 + Math.random() * 4.2;
          s.sparks.push({
            x: s.mx, y: s.my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.8,
            life: 1, r: 1.4 + Math.random() * 2.8,     // thicker sparks
            c: Math.random() < 0.72 ? '#ffd76a' : (Math.random() < 0.5 ? '#fff6cf' : '#ffb300'),
          });
        }
      }
      s.sparks = s.sparks.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.97; p.life -= 0.032;
        if (p.life <= 0) return false;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;

      // the sparkler itself: glowing tip exactly at the pointer so clicks stay precise
      if (s.mx > -100) {
        // long thick wire, angled down-right like a held sparkler
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(70,45,18,.9)'; ctx.lineWidth = 4.2;
        ctx.beginPath(); ctx.moveTo(s.mx + 4, s.my + 6); ctx.lineTo(s.mx + 34, s.my + 44); ctx.stroke();
        ctx.strokeStyle = 'rgba(190,150,80,.75)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(s.mx + 4, s.my + 6); ctx.lineTo(s.mx + 34, s.my + 44); ctx.stroke();
        // burning head: outer halo, body, white-hot core
        const pulse = 1 + Math.sin(s.t / 2.6) * 0.16;
        ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 42;
        ctx.fillStyle = 'rgba(255,183,0,.55)';
        ctx.beginPath(); ctx.arc(s.mx, s.my, 13 * pulse, 0, 7); ctx.fill();
        ctx.shadowBlur = 26; ctx.fillStyle = '#ffd76a';
        ctx.beginPath(); ctx.arc(s.mx, s.my, 7.5 * pulse, 0, 7); ctx.fill();
        ctx.shadowBlur = 14; ctx.fillStyle = '#fffbe8';
        ctx.beginPath(); ctx.arc(s.mx, s.my, 3.6 * pulse, 0, 7); ctx.fill();
        // radiating needles
        ctx.strokeStyle = 'rgba(255,235,160,.75)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
          const a = (s.t / 14) + i * Math.PI / 4;
          const L = 11 + Math.sin(s.t / 5 + i) * 5;
          ctx.beginPath();
          ctx.moveTo(s.mx + Math.cos(a) * 5, s.my + Math.sin(a) * 5);
          ctx.lineTo(s.mx + Math.cos(a) * L, s.my + Math.sin(a) * L);
          ctx.stroke();
        }
        ctx.restore();
      }

      /* --- rocket in flight --- */
      if (s.rocket) {
        const r = s.rocket;
        r.t++;
        const k = Math.min(1, r.t / r.dur);
        const ease = 1 - Math.pow(1 - k, 2);          // fast away, easing in
        const x0 = 68, y0 = H - 74;
        r.x = x0 + (r.tx - x0) * ease;
        r.y = y0 + (r.ty - y0) * ease - Math.sin(k * Math.PI) * 60;   // arc
        // colourful trail
        for (let i = 0; i < 4; i++) {
          s.sparks.push({
            x: r.x + (Math.random() - 0.5) * 6, y: r.y + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 1.6, vy: 0.6 + Math.random() * 1.6,
            life: 1, r: 1 + Math.random() * 2.2,
            c: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0],
          });
        }
        // the rocket body
        const ang = Math.atan2(r.ty - y0, r.tx - x0);
        ctx.save();
        ctx.translate(r.x, r.y); ctx.rotate(ang);
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -4.5); ctx.lineTo(-7, 4.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd54f'; ctx.fillRect(-9, -2, 5, 4);
        ctx.restore();

        if (k >= 1) {
          // BURST
          for (let i = 0; i < 150; i++) {
            const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 6.5;
            s.burst.push({
              x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              life: 1, r: 1.4 + Math.random() * 2.6,
              c: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0],
            });
          }
          s.bx = r.x; s.by = r.y;
          s.banner = 210;          // show the countdown for ~3.5s
          s.rocket = null;
          setTimeout(() => { stateRef.current.launching = false; }, 1400);
        }
      }

      /* --- firework particles --- */
      s.burst = s.burst.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.085; p.vx *= 0.985; p.life -= 0.012;
        if (p.life <= 0) return false;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;

      /* --- the announcement after the burst --- */
      if (s.banner > 0) {
        s.banner--;
        const fade = Math.min(1, s.banner / 45);
        const pop = Math.min(1, (210 - s.banner) / 14);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(s.bx || W / 2, s.by || H / 2);
        ctx.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 16;
        const label = days > 0
          ? `Diwali is in ${days} ${days === 1 ? 'day' : 'days'}`
          : 'Happy Diwali! 🪔';
        ctx.font = '800 34px Inter, Segoe UI, sans-serif';
        ctx.fillStyle = '#ffd76a';
        ctx.fillText(label, 0, 0);
        ctx.font = '700 15px Inter, Segoe UI, sans-serif';
        ctx.fillStyle = '#fff3c4';
        ctx.fillText('✨ ShowTime Consulting ✨', 0, 28);
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      window.removeEventListener('resize', fit);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, days]);

  if (!active) return null;

  // one bulb every ~26px so the string reads as a real strip, not dots
  const bulbs = (n) => Array.from({ length: n }).map((_, i) => {
    const c = BULB_COLORS[i % BULB_COLORS.length];
    return (
      <i key={i} className="dw-bulb" style={{
        '--c': c,
        animationDelay: `${(i % 5) * 0.3}s`,
      }} />
    );
  });

  return (
    <>
      <style>{CSS}</style>

      {/* LED strings on every edge */}
      <div className="dw-lights" aria-hidden="true">
        <div className="dw-strip dw-top">{bulbs(hCount)}</div>
        <div className="dw-strip dw-bottom">{bulbs(hCount)}</div>
        <div className="dw-strip dw-left">{bulbs(vCount)}</div>
        <div className="dw-strip dw-right">{bulbs(vCount)}</div>
      </div>

      {/* sparks + rocket canvas */}
      <canvas ref={canvasRef} className="dw-canvas" aria-hidden="true" />

      {/* the rocket waiting bottom-left */}
      <div className="dw-rocket" onMouseEnter={launchRocket} onClick={launchRocket}
           title="Light the rocket!">
        <div className="dw-rk">
          <span className="dw-rk-nose" />
          <span className="dw-rk-body" />
          <span className="dw-rk-fin dw-fl" />
          <span className="dw-rk-fin dw-fr" />
          <span className="dw-rk-fuse" />
        </div>
        <span className="dw-rk-hint">Touch me 🔥</span>
      </div>

      {/* Diwali day card */}
      {showCard && !cardDismissed && (
        <div className="dw-cardwrap" role="dialog" aria-label="Happy Diwali">
          <div className="dw-confetti" aria-hidden="true">
            {Array.from({ length: 34 }).map((_, i) => (
              <i key={i} style={{
                left: `${(i * 3 + (i % 7) * 2) % 100}%`,
                background: SPARK_COLORS[i % SPARK_COLORS.length],
                animationDelay: `${(i % 9) * 0.4}s`,
                animationDuration: `${4.2 + (i % 5)}s`,
              }} />
            ))}
          </div>
          <div className="dw-card">
            <button className="dw-x" onClick={() => setCardDismissed(true)} aria-label="Close">✕</button>
            <img src="/festive/diwali_card.jpg" alt="Happy Deepavali from ShowTime Consulting"
                 onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div className="dw-diyas" aria-hidden="true">
              {Array.from({ length: 7 }).map((_, i) => (
                <span key={i} style={{ animationDelay: `${i * 0.3}s` }}>🪔</span>
              ))}
            </div>
            <button className="dw-close" onClick={() => setCardDismissed(true)}>
              Continue to Portal
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
body.dw-nocursor, body.dw-nocursor * { cursor: none !important; }

.dw-canvas{position:fixed;inset:0;z-index:10030;pointer-events:none;}

/* ---------- LED strings ---------- */
.dw-lights{position:fixed;inset:0;z-index:10020;pointer-events:none;}
.dw-strip{position:absolute;display:flex;justify-content:space-between;align-items:center;}
.dw-bulb{position:relative;display:block;width:11px;height:15px;
  border-radius:50% 50% 46% 46% / 42% 42% 58% 58%;
  background:radial-gradient(circle at 34% 30%, #fff 0 12%, var(--c) 45%, rgba(0,0,0,.35) 100%);
  box-shadow:0 0 10px 3px var(--c), 0 0 22px 6px color-mix(in srgb, var(--c) 55%, transparent),
             inset 0 -3px 5px rgba(0,0,0,.3);
  animation:dwGlow 2.4s ease-in-out infinite;}
/* brass screw cap where the bulb meets the wire */
.dw-bulb::before{content:'';position:absolute;top:-4px;left:50%;transform:translateX(-50%);
  width:6px;height:5px;border-radius:2px 2px 1px 1px;
  background:linear-gradient(180deg,#d6b25e,#8a6c2c);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.5);}
/* glass highlight */
.dw-bulb::after{content:'';position:absolute;top:3px;left:2.5px;width:3px;height:4px;
  border-radius:50%;background:rgba(255,255,255,.8);}
@keyframes dwGlow{0%,100%{filter:brightness(1.15)}50%{filter:brightness(.55)}}
.dw-left .dw-bulb,.dw-right .dw-bulb{transform:rotate(-90deg);}
.dw-top{top:4px;left:0;right:0;height:20px;align-items:flex-start;}
.dw-bottom{bottom:4px;left:0;right:0;height:20px;align-items:flex-end;}
.dw-left{left:6px;top:0;bottom:0;width:20px;flex-direction:column;}
.dw-right{right:6px;top:0;bottom:0;width:20px;flex-direction:column;}
/* the wire the bulbs hang from */
.dw-top::before{content:'';position:absolute;left:0;right:0;top:1px;height:2.5px;
  background:linear-gradient(90deg,#4a3115,#6b4a1f,#4a3115);border-radius:2px;}
.dw-bottom::before{content:'';position:absolute;left:0;right:0;bottom:1px;height:2.5px;
  background:linear-gradient(90deg,#4a3115,#6b4a1f,#4a3115);border-radius:2px;}
.dw-left::before{content:'';position:absolute;top:0;bottom:0;left:1px;width:2.5px;
  background:linear-gradient(180deg,#4a3115,#6b4a1f,#4a3115);border-radius:2px;}
.dw-right::before{content:'';position:absolute;top:0;bottom:0;right:1px;width:2.5px;
  background:linear-gradient(180deg,#4a3115,#6b4a1f,#4a3115);border-radius:2px;}

/* ---------- the rocket ---------- */
.dw-rocket{position:fixed;left:40px;bottom:28px;z-index:10025;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;gap:6px;
  animation:dwIdle 2.8s ease-in-out infinite;}
@keyframes dwIdle{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-5px) rotate(-2deg)}}
.dw-rk{position:relative;width:26px;height:58px;}
.dw-rk-nose{position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;
  border-bottom:18px solid #c0392b;}
.dw-rk-body{position:absolute;top:17px;left:50%;transform:translateX(-50%);width:20px;height:32px;
  border-radius:4px;background:linear-gradient(180deg,#ffd54f,#ff9800 60%,#e65100);
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.35);}
.dw-rk-fin{position:absolute;bottom:8px;width:0;height:0;
  border-top:12px solid transparent;border-bottom:0 solid transparent;}
.dw-fl{left:-2px;border-right:9px solid #c0392b;}
.dw-fr{right:-2px;border-left:9px solid #c0392b;}
.dw-rk-fuse{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
  width:3px;height:10px;background:#8d6e63;border-radius:2px;}
.dw-rk-fuse::after{content:'';position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
  width:7px;height:7px;border-radius:50%;background:#ffca28;
  box-shadow:0 0 10px 3px rgba(255,170,40,.85);animation:dwFuse .5s ease-in-out infinite alternate;}
@keyframes dwFuse{from{opacity:.55;transform:translateX(-50%) scale(.8)}to{opacity:1;transform:translateX(-50%) scale(1.25)}}
.dw-rk-hint{font-size:10px;font-weight:800;color:#ffd76a;letter-spacing:.4px;white-space:nowrap;
  text-shadow:0 1px 4px rgba(0,0,0,.8);background:rgba(40,16,4,.6);padding:3px 9px;border-radius:999px;
  border:1px solid rgba(255,200,100,.4);}

/* ---------- Diwali day card ---------- */
.dw-cardwrap{position:fixed;inset:0;z-index:10090;display:flex;align-items:center;justify-content:center;
  padding:18px;background:rgba(26,6,0,.82);backdrop-filter:blur(6px);
  font-family:'Inter','Segoe UI',Tahoma,sans-serif;animation:dwFade .5s ease-out both;}
@keyframes dwFade{from{opacity:0}to{opacity:1}}
.dw-card{position:relative;width:min(1020px,96vw);max-height:92vh;overflow:auto;border-radius:20px;
  border:3px solid #e8a33d;box-shadow:0 26px 70px rgba(0,0,0,.65);background:#2b0f04;text-align:center;
  animation:dwPop .6s cubic-bezier(.2,1.1,.35,1) both;}
@keyframes dwPop{from{opacity:0;transform:scale(.9) translateY(18px)}to{opacity:1;transform:none}}
.dw-card img{width:100%;height:auto;display:block;}
.dw-x{position:absolute;top:12px;right:12px;z-index:3;width:36px;height:36px;border-radius:50%;
  border:2px solid #fff;background:rgba(160,40,25,.9);color:#fff;font-size:15px;cursor:pointer;}
.dw-diyas{display:flex;justify-content:center;gap:12px;padding:12px 0 2px;font-size:22px;}
.dw-diyas span{animation:dwFlicker 1.6s ease-in-out infinite;}
@keyframes dwFlicker{0%,100%{opacity:1;transform:translateY(0) scale(1)}50%{opacity:.6;transform:translateY(-4px) scale(1.12)}}
.dw-close{margin:4px auto 16px;cursor:pointer;border:none;border-radius:999px;padding:11px 30px;
  font-size:14px;font-weight:800;color:#fff;background:linear-gradient(135deg,#c0392b,#e8a33d);
  box-shadow:0 10px 24px rgba(0,0,0,.4);}
.dw-close:hover{filter:brightness(1.1);}
.dw-confetti{position:fixed;inset:0;overflow:hidden;pointer-events:none;}
.dw-confetti i{position:absolute;top:-16px;width:9px;height:14px;border-radius:2px;opacity:.9;
  animation-name:dwFall;animation-timing-function:linear;animation-iteration-count:infinite;}
@keyframes dwFall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(106vh) rotate(700deg)}}

@media(max-width:820px){
  body.dw-nocursor, body.dw-nocursor *{cursor:auto !important;}
  .dw-rocket{left:14px;bottom:16px;}
  .dw-rk-hint{display:none;}
  .dw-bulb{width:9px;height:12px;}
}
`;
