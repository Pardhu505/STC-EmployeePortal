// MarigoldToran.js
// A festive marigold thoranam draped across the top of the portal: swags of
// marigolds with mango leaves, and hanging kandeel lanterns, diyas and stars
// that sway gently. Drawn with SVG + CSS, so there are no image assets and it
// scales to any screen width.

import React, { useEffect, useState } from 'react';

const DIWALI_DATE = new Date('2026-11-08T00:00:00+05:30');
const SHOW_WITHIN_DAYS = 21;
const SHOW_AFTER_DAYS = 2;

function daysUntil(target) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

const MARIGOLD = ['#ff8f00', '#ffa726', '#ffd54f', '#fb8c00', '#ffb300'];
const HANGERS = ['lantern-a', 'diya', 'lantern-b', 'star', 'diya', 'lantern-a'];

export default function MarigoldToran() {
  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  const d = daysUntil(DIWALI_DATE);
  if (d > SHOW_WITHIN_DAYS || d < -SHOW_AFTER_DAYS) return null;

  // split the width into even swags of roughly 230px
  const swags = Math.max(3, Math.round(vw / 230));
  const w = vw / swags;
  const DIP = 54;          // how far each swag droops
  const TOP = 16;          // where the string is pinned

  // marigolds + leaves along one quadratic curve
  const beads = [];
  for (let s = 0; s < swags; s++) {
    const x0 = s * w, x1 = (s + 1) * w, cx = (x0 + x1) / 2;
    const n = Math.max(9, Math.round(w / 17));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // quadratic bezier: P0(x0,TOP) C(cx, TOP+DIP*2) P1(x1,TOP)
      const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
      const y = (1 - t) ** 2 * TOP + 2 * (1 - t) * t * (TOP + DIP * 2) + t ** 2 * TOP;
      beads.push({
        x, y,
        r: 7 + (i % 3) * 1.1,
        c: MARIGOLD[(s + i) % MARIGOLD.length],
        leaf: i % 4 === 2,
        li: i,
      });
    }
  }

  const H = TOP + DIP + 150;   // SVG height: swag + the longest hanger

  return (
    <>
      <style>{CSS}</style>
      <div className="mt-wrap" aria-hidden="true">
        <svg className="mt-svg" width={vw} height={H} viewBox={`0 0 ${vw} ${H}`}>
          {/* the string each swag hangs from */}
          {Array.from({ length: swags }).map((_, s) => {
            const x0 = s * w, x1 = (s + 1) * w, cx = (x0 + x1) / 2;
            return (
              <path key={`c${s}`}
                    d={`M ${x0} ${TOP} Q ${cx} ${TOP + DIP * 2} ${x1} ${TOP}`}
                    fill="none" stroke="#7a5b1f" strokeWidth="1.6" opacity=".55" />
            );
          })}

          {/* mango leaves tucked behind the flowers */}
          {beads.filter(b => b.leaf).map((b, i) => (
            <g key={`l${i}`} transform={`translate(${b.x} ${b.y}) rotate(${(i % 2 ? 18 : -18)})`}>
              <path d="M0 0 C 7 10, 7 26, 0 36 C -7 26, -7 10, 0 0 Z" fill="#2e7d32" />
              <path d="M0 2 C 4 11, 4 25, 0 33" stroke="#1b5e20" strokeWidth="1" fill="none" />
            </g>
          ))}

          {/* the marigolds */}
          {beads.map((b, i) => (
            <g key={`f${i}`}>
              <circle cx={b.x} cy={b.y} r={b.r} fill={b.c} />
              <circle cx={b.x} cy={b.y} r={b.r * 0.68} fill="none"
                      stroke="rgba(255,255,255,.38)" strokeWidth="1.1" />
              <circle cx={b.x} cy={b.y} r={b.r * 0.3} fill="#e65100" opacity=".5" />
            </g>
          ))}
        </svg>

        {/* hanging lanterns, diyas and stars at each junction */}
        {Array.from({ length: swags + 1 }).map((_, s) => {
          const kind = HANGERS[s % HANGERS.length];
          const len = 26 + (s % 3) * 22;
          return (
            <div key={`h${s}`} className="mt-hanger"
                 style={{ left: `${s * w}px`, animationDelay: `${(s % 5) * 0.4}s` }}>
              <span className="mt-cord" style={{ height: len }} />
              {kind === 'diya' ? (
                <span className="mt-diya"><i className="mt-flame" /></span>
              ) : kind === 'star' ? (
                <span className="mt-star" />
              ) : (
                <span className={`mt-lantern ${kind === 'lantern-b' ? 'alt' : ''}`}>
                  <i className="mt-lan-glow" />
                  <u className="mt-tassel" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

const CSS = `
.mt-wrap{position:fixed;top:0;left:0;right:0;z-index:10015;pointer-events:none;
  transform-origin:50% 0;will-change:transform;animation:mtSway 7s ease-in-out infinite;}
@keyframes mtSway{0%,100%{transform:rotate(-.25deg)}50%{transform:rotate(.25deg)}}
.mt-svg{display:block;}

/* ---- hangers ---- */
.mt-hanger{position:absolute;top:14px;display:flex;flex-direction:column;align-items:center;
  transform-origin:50% 0;will-change:transform;animation:mtSwing 4.2s ease-in-out infinite;}
@keyframes mtSwing{0%,100%{transform:rotate(-3.5deg)}50%{transform:rotate(3.5deg)}}
.mt-cord{display:block;width:1.6px;background:linear-gradient(180deg,#a1803a,#7a5b1f);}

/* kandeel lantern */
.mt-lantern{position:relative;display:block;width:34px;height:44px;
  background:linear-gradient(180deg,#8e24aa,#d81b60 48%,#f4511e);
  clip-path:polygon(20% 0,80% 0,100% 28%,80% 100%,20% 100%,0 28%);
  box-shadow:0 6px 14px rgba(0,0,0,.35);}
.mt-lantern.alt{background:linear-gradient(180deg,#1e88e5,#00acc1 50%,#43a047);}
.mt-lan-glow{position:absolute;inset:26% 24%;border-radius:50%;
  background:radial-gradient(circle,#fff6c4,rgba(255,214,110,.25) 65%,transparent 72%);
  animation:mtGlow 2.4s ease-in-out infinite;}
@keyframes mtGlow{0%,100%{opacity:.75}50%{opacity:1}}
.mt-tassel{position:absolute;left:50%;transform:translateX(-50%);bottom:-15px;
  width:22px;height:16px;
  background:repeating-linear-gradient(90deg,#ffd54f 0 3px,#f4511e 3px 6px);
  clip-path:polygon(0 0,100% 0,88% 100%,72% 0,56% 100%,40% 0,24% 100%,12% 0);}

/* hanging diya */
.mt-diya{position:relative;display:block;width:30px;height:15px;border-radius:0 0 16px 16px;
  background:linear-gradient(180deg,#c76b3a,#6d3519);
  box-shadow:inset 0 2px 0 rgba(255,210,150,.45);}
.mt-flame{position:absolute;left:50%;bottom:11px;transform:translateX(-50%);
  width:11px;height:19px;border-radius:50% 50% 50% 50% / 66% 66% 34% 34%;
  background:radial-gradient(ellipse at 50% 78%,#fff3b0,#ffc107 36%,#ff7043 72%,transparent);
  filter:drop-shadow(0 0 7px rgba(255,170,40,.9));transform-origin:50% 100%;
  animation:mtFlame 1.2s ease-in-out infinite;}
@keyframes mtFlame{0%,100%{transform:translateX(-50%) scaleY(1) rotate(-2deg)}
  50%{transform:translateX(-50%) scaleY(1.16) rotate(2deg)}}

/* paper star */
.mt-star{display:block;width:38px;height:38px;background:linear-gradient(135deg,#8e24aa,#ffb300);
  clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);
  filter:drop-shadow(0 0 8px rgba(255,190,80,.7));
  animation:mtStar 5s linear infinite;}
@keyframes mtStar{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}

@media(max-width:820px){
  .mt-lantern{width:26px;height:34px}
  .mt-star{width:28px;height:28px}
  .mt-diya{width:24px;height:12px}
}
@media(prefers-reduced-motion:reduce){
  .mt-wrap,.mt-hanger,.mt-flame,.mt-star,.mt-lan-glow{animation:none!important}
}
`;
