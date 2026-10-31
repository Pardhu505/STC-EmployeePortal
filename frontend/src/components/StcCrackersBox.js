// StcCrackersBox.js
// An "STC Crackers" box that sits above the Festival Game Quests pill.
// Opening it shows a transparent tray of South Indian Diwali crackers —
// hover (or tap) any one and it fires with colour and motion.
//
// Pure CSS/DOM, no assets needed, and it never blocks the page behind it.

import React, { useState } from 'react';

const DIWALI_DATE = new Date('2026-11-08T00:00:00+05:30');
const SHOW_WITHIN_DAYS = 21;
const SHOW_AFTER_DAYS = 2;

function daysUntil(target) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

// name, tamil/telugu name, and which firing animation to use
const CRACKERS = [
  { id: 'poochatti', name: 'Flower Pot',  local: 'பூச்சட்டி · బుడ్డి', kind: 'fountain' },
  { id: 'chakkaram', name: 'Ground Chakra', local: 'நில சக்கரம் · భూచక్రం', kind: 'chakra' },
  { id: 'rocket',    name: 'Rocket',      local: 'ராக்கெட் · రాకెట్', kind: 'rocket' },
  { id: 'matthapu', name: 'Sparkler',     local: 'மத்தாப்பு · మతాబు', kind: 'sparkler' },
  { id: 'saravedi', name: 'Garland Bomb', local: 'சரவெடி · సరవెడి', kind: 'garland' },
  { id: 'vedi',     name: 'Atom Bomb',    local: 'வெடி · లక్ష్మీ బాంబ్', kind: 'bomb' },
];

const COLORS = ['#ffd54f', '#ff5252', '#40c4ff', '#69f0ae', '#e040fb', '#ff9800'];

function Sparks({ n = 18, spread = 360, dist = 90 }) {
  return (
    <span className="cr-sparks" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => {
        const a = (spread / n) * i - spread / 2;
        return (
          <i key={i} style={{
            '--a': `${a}deg`,
            '--d': `${dist * (0.55 + Math.random() * 0.75)}px`,
            '--c': COLORS[i % COLORS.length],
            '--delay': `${(i % 6) * 0.045}s`,
          }} />
        );
      })}
    </span>
  );
}

export default function StcCrackersBox() {
  const [open, setOpen] = useState(false);
  const [lit, setLit] = useState(null);
  const d = daysUntil(DIWALI_DATE);
  if (d > SHOW_WITHIN_DAYS || d < -SHOW_AFTER_DAYS) return null;

  return (
    <>
      <style>{CSS}</style>

      {/* the box, sitting just above the Festival Game Quests pill */}
      <button className="cr-box" onClick={() => setOpen(true)} title="Open the STC crackers box">
        <span className="cr-fizz" aria-hidden="true"><i /><i /><i /></span>
        <span className="cr-lid" aria-hidden="true" />
        <span className="cr-body" aria-hidden="true">
          <span className="cr-stick cr-s1" /><span className="cr-stick cr-s2" />
          <span className="cr-stick cr-s3" />
        </span>
        <span className="cr-label">STC<br />Crackers</span>
      </button>

      {open && (
        <div className="cr-overlay" role="dialog" aria-label="STC Crackers">
          <div className="cr-sheet">
            <div className="cr-head">
              <h3>🎆 STC Crackers</h3>
              <p>Hover a cracker to light it — {d > 0 ? `Diwali in ${d} ${d === 1 ? 'day' : 'days'}` : 'Happy Diwali!'} 🪔</p>
            </div>

            <div className="cr-tray">
              {CRACKERS.map((c) => (
                <div key={c.id}
                     className={`cr-item cr-${c.kind} ${lit === c.id ? 'lit' : ''}`}
                     onMouseEnter={() => setLit(c.id)}
                     onMouseLeave={() => setLit(null)}
                     onClick={() => setLit(lit === c.id ? null : c.id)}>
                  <div className="cr-stage">
                    {/* the firework effect */}
                    {c.kind === 'fountain' && <Sparks n={22} spread={110} dist={110} />}
                    {c.kind === 'chakra'   && <Sparks n={20} spread={360} dist={70} />}
                    {c.kind === 'rocket'   && <Sparks n={24} spread={360} dist={95} />}
                    {c.kind === 'sparkler' && <Sparks n={18} spread={360} dist={55} />}
                    {c.kind === 'garland'  && <Sparks n={20} spread={200} dist={80} />}
                    {c.kind === 'bomb'     && <Sparks n={28} spread={360} dist={120} />}

                    {/* the cracker itself */}
                    <div className="cr-art">
                      {c.kind === 'fountain' && <span className="cr-pot" />}
                      {c.kind === 'chakra'   && <span className="cr-wheel" />}
                      {c.kind === 'rocket'   && <span className="cr-rkt" />}
                      {c.kind === 'sparkler' && <span className="cr-spk" />}
                      {c.kind === 'garland'  && <span className="cr-gar" />}
                      {c.kind === 'bomb'     && <span className="cr-bomb" />}
                    </div>
                  </div>
                  <div className="cr-name">{c.name}</div>
                  <div className="cr-local">{c.local}</div>
                </div>
              ))}
            </div>

            <div className="cr-foot">
              ✨ Wishing everyone a safe and sparkling Deepavali — ShowTime Consulting ✨
            </div>
            <button className="cr-close" onClick={() => { setOpen(false); setLit(null); }}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
/* ---------------- the box ---------------- */
.cr-box{position:fixed;right:22px;bottom:92px;z-index:9994;cursor:pointer;width:96px;height:92px;
  border:none;background:transparent;display:flex;flex-direction:column;align-items:center;
  justify-content:flex-end;font-family:'Inter','Segoe UI',Tahoma,sans-serif;
  animation:crBob 3s ease-in-out infinite;}
@keyframes crBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.cr-box:hover{filter:brightness(1.08)}
.cr-box:hover .cr-lid{transform:translateY(-10px) rotate(-12deg)}
.cr-body{position:relative;width:62px;height:40px;border-radius:5px;
  background:linear-gradient(180deg,#e53935,#8e1b16);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.35),0 8px 18px rgba(0,0,0,.4);}
.cr-body::after{content:'';position:absolute;inset:7px 6px auto 6px;height:4px;border-radius:2px;
  background:repeating-linear-gradient(90deg,#ffd54f 0 6px,#fff 6px 12px);}
.cr-lid{position:absolute;top:16px;width:70px;height:12px;border-radius:4px;
  background:linear-gradient(180deg,#ffd54f,#e8a33d);
  box-shadow:0 3px 8px rgba(0,0,0,.35);transition:transform .35s cubic-bezier(.2,1.2,.3,1);}
.cr-stick{position:absolute;bottom:34px;width:7px;height:26px;border-radius:2px;}
.cr-s1{left:10px;background:linear-gradient(180deg,#40c4ff,#0277bd);transform:rotate(-16deg)}
.cr-s2{left:27px;background:linear-gradient(180deg,#69f0ae,#00897b)}
.cr-s3{right:10px;background:linear-gradient(180deg,#e040fb,#6a1b9a);transform:rotate(16deg)}
.cr-label{margin-top:5px;font-size:10px;font-weight:800;line-height:1.15;color:#ffd76a;
  text-shadow:0 1px 4px rgba(0,0,0,.85);letter-spacing:.3px;}
.cr-fizz{position:absolute;top:2px;left:50%;transform:translateX(-50%);width:40px;height:22px;}
.cr-fizz i{position:absolute;bottom:0;left:50%;width:4px;height:4px;border-radius:50%;
  background:#ffd54f;box-shadow:0 0 8px 2px #ffb300;animation:crFizz 1.5s ease-out infinite;}
.cr-fizz i:nth-child(2){animation-delay:.5s;background:#ff5252;box-shadow:0 0 8px 2px #ff5252}
.cr-fizz i:nth-child(3){animation-delay:1s;background:#40c4ff;box-shadow:0 0 8px 2px #40c4ff}
@keyframes crFizz{0%{opacity:0;transform:translate(-50%,0) scale(.6)}
  30%{opacity:1}100%{opacity:0;transform:translate(-50%,-20px) scale(1.3)}}

/* ---------------- tray ---------------- */
.cr-overlay{position:fixed;inset:0;z-index:10095;display:flex;align-items:center;justify-content:center;
  padding:18px;background:rgba(20,6,0,.42);backdrop-filter:blur(3px);
  font-family:'Inter','Segoe UI',Tahoma,sans-serif;animation:crFade .35s ease-out both;}
@keyframes crFade{from{opacity:0}to{opacity:1}}
.cr-sheet{width:min(940px,96vw);max-height:92vh;overflow-y:auto;border-radius:22px;padding:20px 20px 18px;
  text-align:center;background:rgba(32,12,2,.55);border:2px solid rgba(255,200,110,.45);
  backdrop-filter:blur(10px);box-shadow:0 24px 60px rgba(0,0,0,.5);
  animation:crPop .45s cubic-bezier(.2,1.1,.35,1) both;}
@keyframes crPop{from{opacity:0;transform:scale(.92) translateY(16px)}to{opacity:1;transform:none}}
.cr-head h3{margin:0;font-size:clamp(19px,3vw,26px);font-weight:900;color:#ffd76a;
  text-shadow:0 2px 10px rgba(0,0,0,.6);}
.cr-head p{margin:4px 0 0;font-size:12.5px;color:#ffe9b8;opacity:.95;}
.cr-tray{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:18px 0 6px;}
.cr-item{position:relative;padding:12px 8px 10px;border-radius:14px;cursor:pointer;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,200,110,.28);transition:all .25s;}
.cr-item:hover{background:rgba(255,255,255,.12);transform:translateY(-3px);
  border-color:rgba(255,215,120,.7);}
.cr-stage{position:relative;height:92px;display:flex;align-items:flex-end;justify-content:center;}
.cr-art{position:relative;z-index:2;}
.cr-name{margin-top:8px;font-size:12.5px;font-weight:800;color:#fff3d6;}
.cr-local{font-size:9.5px;color:#ffd76a;opacity:.85;margin-top:1px;}

/* ---------------- the crackers ---------------- */
.cr-pot{display:block;width:34px;height:30px;border-radius:4px 4px 14px 14px;
  background:linear-gradient(180deg,#8d6e63,#4e342e);box-shadow:inset 0 2px 0 rgba(255,255,255,.2);}
.cr-wheel{display:block;width:40px;height:40px;border-radius:50%;
  border:7px dashed #ffd54f;background:radial-gradient(circle,#c0392b 30%,transparent 32%);}
.lit .cr-wheel{animation:crSpin .5s linear infinite;}
@keyframes crSpin{to{transform:rotate(360deg)}}
.cr-rkt{display:block;position:relative;width:16px;height:40px;border-radius:8px 8px 2px 2px;
  background:linear-gradient(180deg,#e53935,#8e1b16);}
.cr-rkt::after{content:'';position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);
  width:3px;height:22px;background:#8d6e63;}
.lit .cr-rkt{animation:crFly .9s ease-in forwards;}
@keyframes crFly{to{transform:translateY(-70px) scale(.7);opacity:0}}
.cr-spk{display:block;width:4px;height:44px;border-radius:2px;
  background:linear-gradient(180deg,#ffd54f 0 30%,#8d6e63 30%);}
.lit .cr-spk{box-shadow:0 -6px 16px 5px rgba(255,200,60,.9);}
.cr-gar{display:block;width:40px;height:34px;border-radius:4px;
  background:repeating-linear-gradient(180deg,#e53935 0 6px,#ffd54f 6px 10px);}
.lit .cr-gar{animation:crShake .12s linear infinite;}
@keyframes crShake{0%,100%{transform:translateX(-2px)}50%{transform:translateX(2px)}}
.cr-bomb{display:block;width:32px;height:32px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#616161,#212121);}
.lit .cr-bomb{animation:crBoom .5s ease-out forwards;}
@keyframes crBoom{60%{transform:scale(1.35)}100%{transform:scale(.2);opacity:0}}

/* ---------------- spark burst ---------------- */
.cr-sparks{position:absolute;left:50%;bottom:22px;width:0;height:0;z-index:1;}
.cr-sparks i{position:absolute;width:6px;height:6px;border-radius:50%;background:var(--c);
  box-shadow:0 0 10px 3px var(--c);opacity:0;}
.lit .cr-sparks i{animation:crShoot .85s ease-out infinite;animation-delay:var(--delay);}
@keyframes crShoot{
  0%{opacity:0;transform:rotate(var(--a)) translateY(0) scale(.5)}
  18%{opacity:1}
  100%{opacity:0;transform:rotate(var(--a)) translateY(calc(var(--d) * -1)) scale(1.1)}
}
.cr-foot{margin-top:12px;font-size:11.5px;color:#ffd76a;opacity:.9;}
.cr-close{margin-top:12px;cursor:pointer;border:none;border-radius:999px;padding:10px 28px;
  font-size:13.5px;font-weight:800;color:#fff;background:linear-gradient(135deg,#c0392b,#e8a33d);
  box-shadow:0 8px 20px rgba(0,0,0,.35);}
.cr-close:hover{filter:brightness(1.1);}

@media(max-width:820px){
  .cr-box{right:12px;bottom:76px;width:76px;height:76px;}
  .cr-body{width:52px;height:34px} .cr-lid{width:58px;top:12px}
  .cr-tray{grid-template-columns:repeat(auto-fit,minmax(108px,1fr));}
}
@media(prefers-reduced-motion:reduce){
  .cr-box,.cr-fizz i,.cr-sheet{animation:none!important}
  .lit .cr-sparks i,.lit .cr-wheel,.lit .cr-rkt,.lit .cr-gar,.lit .cr-bomb{animation:none!important}
}
`;
