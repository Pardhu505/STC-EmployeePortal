// MarigoldToran.js
// Marigold thoranam across the top of the portal — layered-petal marigolds,
// hanging mango leaves, clay diyas with live flames and kandeel lanterns.
//
// Each ornament is defined ONCE as an SVG <symbol> and repeated with <use>,
// so the detail costs almost nothing however wide the screen is.

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

/* one marigold: three rings of petals around a dark centre */
function Marigold({ id, deep, mid, light }) {
  const ring = (n, rad, rx, ry, fill) =>
    Array.from({ length: n }).map((_, i) => (
      <ellipse key={`${fill}${i}`} cx={20} cy={20 - rad} rx={rx} ry={ry} fill={fill}
               transform={`rotate(${(360 / n) * i} 20 20)`} />
    ));
  return (
    <symbol id={id} viewBox="0 0 40 40">
      {ring(16, 13, 4.6, 6.6, deep)}
      {ring(12, 8.5, 4.0, 5.6, mid)}
      {ring(8, 4.5, 3.4, 4.4, light)}
      <circle cx="20" cy="20" r="3.1" fill={deep} opacity=".85" />
      <circle cx="18.6" cy="18.6" r="1.2" fill="#fff" opacity=".5" />
    </symbol>
  );
}

function starPoints(cx, cy, R, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    p.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return p.join(' ');
}

export default function MarigoldToran() {
  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  const d = daysUntil(DIWALI_DATE);
  if (d > SHOW_WITHIN_DAYS || d < -SHOW_AFTER_DAYS) return null;

  const swags = Math.max(3, Math.round(vw / 240));
  const w = vw / swags;
  const TOP = 10, DIP = 46, H = 230;
  const FLOWERS = ['mg-a', 'mg-b', 'mg-c'];
  const HANGERS = ['lantern', 'diya', 'star', 'diya', 'lantern', 'diya'];

  const beads = [], leaves = [];
  for (let s = 0; s < swags; s++) {
    const x0 = s * w, x1 = (s + 1) * w, cx = (x0 + x1) / 2;
    const n = Math.max(10, Math.round(w / 21));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
      const y = (1 - t) ** 2 * TOP + 2 * (1 - t) * t * (TOP + DIP * 2) + t ** 2 * TOP;
      beads.push({ x, y, f: FLOWERS[(s + i) % 3], sz: 25 + (i % 3) * 3 });
      if (i % 3 === 1) {
        leaves.push({ x: x - 4, y: y + 5, rot: -20 });
        leaves.push({ x: x + 8, y: y + 3, rot: 17 });
      }
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="mt-wrap" aria-hidden="true">
        <svg className="mt-svg" width={vw} height={H} viewBox={`0 0 ${vw} ${H}`}>
          <defs>
            <Marigold id="mg-a" deep="#ef6c00" mid="#fb8c00" light="#ffb300" />
            <Marigold id="mg-b" deep="#f57c00" mid="#ffa726" light="#ffd54f" />
            <Marigold id="mg-c" deep="#ffa000" mid="#ffc107" light="#ffe082" />

            <linearGradient id="mtLeaf" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4caf50" />
              <stop offset="55%" stopColor="#2e7d32" />
              <stop offset="100%" stopColor="#1b5e20" />
            </linearGradient>
            <symbol id="mt-leaf" viewBox="0 0 24 54">
              <path d="M12 1 C21 13, 22 34, 12 53 C2 34, 3 13, 12 1 Z" fill="url(#mtLeaf)" />
              <path d="M12 4 C16 16, 16 36, 12 49" stroke="#1b5e20" strokeWidth="1.1"
                    fill="none" opacity=".75" />
            </symbol>

            <linearGradient id="mtClay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d2793a" />
              <stop offset="100%" stopColor="#7a3c1a" />
            </linearGradient>
            <symbol id="mt-diya" viewBox="0 0 60 40">
              <path d="M5 18 Q30 31 55 18 Q55 26 30 30 Q5 26 5 18 Z" fill="url(#mtClay)" />
              <ellipse cx="30" cy="18" rx="25" ry="5.4" fill="#c8732f" />
              <ellipse cx="30" cy="18" rx="20" ry="3.6" fill="#8d4a21" />
              <ellipse cx="30" cy="17.4" rx="13" ry="2.2" fill="#f0b45e" opacity=".8" />
              <rect x="28.6" y="9" width="2.8" height="8" rx="1.3" fill="#3e2723" />
            </symbol>

            <linearGradient id="mtLan" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8e24aa" />
              <stop offset="55%" stopColor="#e91e63" />
              <stop offset="100%" stopColor="#ff6f00" />
            </linearGradient>
            <symbol id="mt-lantern" viewBox="0 0 54 70">
              <rect x="20" y="1" width="14" height="5" rx="2" fill="#ffd54f" />
              <path d="M27 7 L50 25 L44 57 L10 57 L4 25 Z" fill="url(#mtLan)" />
              <path d="M27 13 L41 25 L27 37 L13 25 Z" fill="#ffe082" opacity=".9" />
              <path d="M27 18 L36 25 L27 32 L18 25 Z" fill="#fff59d" />
              <rect x="9" y="56" width="36" height="5" rx="2" fill="#ffd54f" />
            </symbol>
          </defs>

          {/* the thread each swag hangs on */}
          {Array.from({ length: swags }).map((_, s) => {
            const x0 = s * w, x1 = (s + 1) * w, cx = (x0 + x1) / 2;
            return <path key={`c${s}`} d={`M ${x0} ${TOP} Q ${cx} ${TOP + DIP * 2} ${x1} ${TOP}`}
                         fill="none" stroke="#8d6e3a" strokeWidth="1.4" opacity=".5" />;
          })}

          {/* mango leaves hanging behind the flowers */}
          {leaves.map((l, i) => (
            <g key={`lf${i}`} transform={`rotate(${l.rot} ${l.x} ${l.y})`}>
              <use href="#mt-leaf" x={l.x - 9} y={l.y} width="19" height="43" />
            </g>
          ))}

          {/* the marigolds */}
          {beads.map((b, i) => (
            <use key={`f${i}`} href={`#${b.f}`} x={b.x - b.sz / 2} y={b.y - b.sz / 2}
                 width={b.sz} height={b.sz} />
          ))}

          {/* hanging ornaments */}
          {Array.from({ length: swags + 1 }).map((_, s) => {
            const kind = HANGERS[s % HANGERS.length];
            const len = 52 + (s % 3) * 30;
            const x = s * w;
            return (
              <g key={`h${s}`} className="mt-hanger"
                 style={{ transformOrigin: `${x}px ${TOP}px`, animationDelay: `${(s % 5) * 0.5}s` }}>
                <line x1={x} y1={TOP} x2={x} y2={TOP + len} stroke="#8d6e3a" strokeWidth="1.3" />
                {kind === 'diya' && (
                  <g>
                    <use href="#mt-diya" x={x - 21} y={TOP + len} width="42" height="28" />
                    <g className="mt-flame"
                       style={{ transformOrigin: `${x}px ${TOP + len + 8}px` }}>
                      <ellipse cx={x} cy={TOP + len + 1} rx="9" ry="13" fill="#ff9800" opacity=".35" />
                      <ellipse cx={x} cy={TOP + len + 2} rx="5" ry="9.5" fill="#ffc107" />
                      <ellipse cx={x} cy={TOP + len + 4} rx="2.4" ry="5.4" fill="#fff9c4" />
                    </g>
                  </g>
                )}
                {kind === 'lantern' && (
                  <g>
                    <use href="#mt-lantern" x={x - 19} y={TOP + len} width="38" height="49" />
                    {[-12, -6, 0, 6, 12].map((o) => (
                      <line key={o} x1={x + o} y1={TOP + len + 44} x2={x + o} y2={TOP + len + 62}
                            stroke={o === 0 || o === 12 || o === -12 ? '#ffd54f' : '#e91e63'}
                            strokeWidth="2.6" />
                    ))}
                  </g>
                )}
                {kind === 'star' && (
                  <polygon className="mt-star"
                           style={{ transformOrigin: `${x}px ${TOP + len + 18}px` }}
                           points={starPoints(x, TOP + len + 18, 19, 8)}
                           fill="url(#mtLan)" stroke="#ffd54f" strokeWidth="1.5" />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

const CSS = `
.mt-wrap{position:fixed;top:0;left:0;right:0;z-index:10015;pointer-events:none;
  transform-origin:50% 0;will-change:transform;animation:mtSway 7s ease-in-out infinite;}
@keyframes mtSway{0%,100%{transform:rotate(-.22deg)}50%{transform:rotate(.22deg)}}
.mt-svg{display:block;overflow:visible;}
.mt-hanger{will-change:transform;animation:mtSwing 4.4s ease-in-out infinite;}
@keyframes mtSwing{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.mt-flame{animation:mtFlame 1.1s ease-in-out infinite;}
@keyframes mtFlame{0%,100%{transform:scaleY(1) scaleX(1)}50%{transform:scaleY(1.18) scaleX(.9)}}
.mt-star{animation:mtStar 5s ease-in-out infinite;}
@keyframes mtStar{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}
@media(prefers-reduced-motion:reduce){
  .mt-wrap,.mt-hanger,.mt-flame,.mt-star{animation:none!important}
}
`;
