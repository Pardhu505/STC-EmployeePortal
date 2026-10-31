// DiwaliDeepams.js
// Three animated celebration deepams (diyas) that sit above the Festival Game
// Quests pill — flickering flames, warm glow pools and drifting embers.
// Pure CSS, no assets, never blocks clicks.

import React from 'react';

const DIWALI_DATE = new Date('2026-11-08T00:00:00+05:30');
const SHOW_WITHIN_DAYS = 21;
const SHOW_AFTER_DAYS = 2;

function daysUntil(target) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

export default function DiwaliDeepams() {
  const d = daysUntil(DIWALI_DATE);
  if (d > SHOW_WITHIN_DAYS || d < -SHOW_AFTER_DAYS) return null;

  // middle lamp slightly larger, as in a traditional arrangement
  const lamps = [
    { cls: 'dp-small', delay: '0s',   emb: 0.0 },
    { cls: 'dp-big',   delay: '.45s', emb: 0.2 },
    { cls: 'dp-small', delay: '.9s',  emb: 0.4 },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="dp-wrap" aria-hidden="true" title="Shubh Deepavali">
        {lamps.map((l, i) => (
          <div key={i} className={`dp-lamp ${l.cls}`} style={{ animationDelay: l.delay }}>
            <span className="dp-glow" />
            <span className="dp-embers">
              <i style={{ animationDelay: `${l.emb}s` }} />
              <i style={{ animationDelay: `${l.emb + 0.7}s` }} />
              <i style={{ animationDelay: `${l.emb + 1.4}s` }} />
            </span>
            <span className="dp-flame">
              <span className="dp-flame-in" />
            </span>
            <span className="dp-wick" />
            <span className="dp-bowl" />
            <span className="dp-base" />
          </div>
        ))}
      </div>
    </>
  );
}

const CSS = `
.dp-wrap{position:fixed;right:26px;bottom:92px;z-index:9994;pointer-events:none;
  display:flex;align-items:flex-end;gap:14px;}

.dp-lamp{position:relative;width:46px;height:56px;
  animation:dpSway 4s ease-in-out infinite;}
.dp-big{transform:scale(1.18);}
@keyframes dpSway{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.dp-big{animation:dpSwayBig 4s ease-in-out infinite;}
@keyframes dpSwayBig{0%,100%{transform:scale(1.18) translateY(0)}50%{transform:scale(1.18) translateY(-3px)}}

/* warm pool of light behind the lamp */
.dp-glow{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);
  width:72px;height:72px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,186,60,.55) 0%,rgba(255,150,30,.22) 42%,transparent 70%);
  animation:dpGlow 2.2s ease-in-out infinite;}
@keyframes dpGlow{0%,100%{opacity:.85;transform:translateX(-50%) scale(1)}
  50%{opacity:1;transform:translateX(-50%) scale(1.12)}}

/* clay bowl */
.dp-bowl{position:absolute;left:50%;bottom:7px;transform:translateX(-50%);
  width:44px;height:17px;border-radius:0 0 22px 22px;
  background:linear-gradient(180deg,#c76b3a 0%,#8d4523 60%,#5d2d16 100%);
  box-shadow:inset 0 2px 0 rgba(255,210,150,.45), 0 4px 10px rgba(0,0,0,.4);}
/* the oil rim */
.dp-bowl::before{content:'';position:absolute;top:-4px;left:50%;transform:translateX(-50%);
  width:44px;height:9px;border-radius:50%;
  background:linear-gradient(180deg,#e8a964,#b96a33);}
.dp-base{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);
  width:30px;height:6px;border-radius:50%;background:#4a2412;opacity:.85;}

/* wick + flame */
.dp-wick{position:absolute;left:50%;bottom:21px;transform:translateX(-50%);
  width:3px;height:7px;border-radius:2px;background:#3e2723;}
.dp-flame{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);
  width:16px;height:30px;border-radius:50% 50% 50% 50% / 68% 68% 32% 32%;
  background:radial-gradient(ellipse at 50% 78%, #fff3b0 0%, #ffc107 32%, #ff7043 68%, rgba(255,87,34,0) 100%);
  filter:drop-shadow(0 0 10px rgba(255,170,40,.95));
  transform-origin:50% 100%;
  animation:dpFlicker 1.1s ease-in-out infinite;}
@keyframes dpFlicker{
  0%,100%{transform:translateX(-50%) scaleY(1) scaleX(1) rotate(-1.5deg)}
  25%{transform:translateX(-50%) scaleY(1.14) scaleX(.9) rotate(1.5deg)}
  50%{transform:translateX(-50%) scaleY(.94) scaleX(1.08) rotate(-1deg)}
  75%{transform:translateX(-50%) scaleY(1.08) scaleX(.95) rotate(2deg)}}
/* blue-hot centre */
.dp-flame-in{position:absolute;left:50%;bottom:1px;transform:translateX(-50%);
  width:7px;height:12px;border-radius:50% 50% 50% 50% / 65% 65% 35% 35%;
  background:radial-gradient(ellipse at 50% 80%, #fff 0%, #ffe082 45%, rgba(255,224,130,0) 100%);
  animation:dpInner 1.4s ease-in-out infinite;}
@keyframes dpInner{0%,100%{opacity:.9;height:12px}50%{opacity:1;height:15px}}

/* drifting embers */
.dp-embers{position:absolute;left:50%;bottom:40px;width:0;height:0;}
.dp-embers i{position:absolute;width:3px;height:3px;border-radius:50%;background:#ffca5a;
  box-shadow:0 0 7px 2px rgba(255,180,60,.85);opacity:0;
  animation:dpEmber 2.6s ease-out infinite;}
@keyframes dpEmber{
  0%{opacity:0;transform:translate(-50%,0) scale(.6)}
  20%{opacity:1}
  100%{opacity:0;transform:translate(calc(-50% + var(--dx,6px)),-42px) scale(1.25)}}
.dp-embers i:nth-child(2){--dx:-8px}
.dp-embers i:nth-child(3){--dx:12px}

@media(max-width:820px){
  .dp-wrap{right:14px;bottom:76px;gap:9px;transform:scale(.8);transform-origin:bottom right;}
}
@media(prefers-reduced-motion:reduce){
  .dp-lamp,.dp-glow,.dp-flame,.dp-flame-in,.dp-embers i{animation:none!important}
}
`;
